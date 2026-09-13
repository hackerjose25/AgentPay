import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client, type PoolClient } from "pg";
import { z } from "zod";
import { loadRuntimeConfig } from "../apps/server/src/config.js";
import { createGeminiInvoiceExtractor } from "../apps/server/src/extraction/gemini.js";
import { validateInvoiceImage } from "../apps/server/src/extraction/image.js";
import {
  validatePaidExtractionRecovery,
  type PaidExtractionRecoveryExpectation,
  type PaidExtractionRecoveryRow
} from "../apps/server/src/recovery/paid-extraction.js";
import { jsonLog, loadRootEnv, projectRoot, safeErrorDetail } from "./shared.js";

const requestIdSchema = z.string().uuid();
const leaseDurationSeconds = 120;

function argumentValue(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

async function loadRecoveryRow(client: Client | PoolClient, requestId: string, lock: boolean): Promise<PaidExtractionRecoveryRow> {
  const result = await client.query<PaidExtractionRecoveryRow>(`
    SELECT
      q.id AS request_id,
      q.run_id,
      r.session_id,
      r.input_reference,
      r.input_hash AS run_input_hash,
      q.provider_name,
      q.payer_account_id,
      q.input_hash AS request_input_hash,
      q.quote_snapshot,
      q.execution_status,
      q.result,
      q.execution_lease_expires_at,
      p.id AS payment_id,
      p.status AS payment_status,
      p.amount_tinybars::text,
      p.asset,
      p.network,
      p.recipient_account_id,
      p.transaction_reference,
      br.status AS reservation_status,
      (SELECT count(*)::text FROM payments settled WHERE settled.request_id = q.id AND settled.status = 'SETTLED') AS settled_payment_count,
      (SELECT count(*)::text FROM payments unresolved WHERE unresolved.request_id = q.id AND unresolved.status IN ('RESERVED', 'SUBMITTING', 'UNKNOWN')) AS unresolved_payment_count
    FROM requests q
    JOIN runs r ON r.id = q.run_id
    JOIN payments p ON p.request_id = q.id AND p.status = 'SETTLED'
    JOIN budget_reservations br ON br.payment_id = p.id
    WHERE q.id = $1
    ORDER BY p.settled_at DESC
    LIMIT 1
    ${lock ? "FOR UPDATE OF q" : ""}
  `, [requestId]);
  const row = result.rows[0];
  if (!row) throw new Error("settled recovery request was not found");
  return row;
}

async function main(): Promise<void> {
  loadRootEnv();
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("choose exactly one of --dry-run or --apply");

  const requestId = requestIdSchema.parse(argumentValue("--request-id"));
  const config = loadRuntimeConfig();
  const providerName = config.ENS_PROVIDER_NAMES.find((name) => name.startsWith("alpha."));
  if (!providerName) throw new Error("configured Alpha ENS provider is missing");

  const fixtureBytes = await readFile(resolve(projectRoot, "fixtures/synthetic-invoice.png"));
  const inputHash = createHash("sha256").update(fixtureBytes).digest("hex");
  const expected: PaidExtractionRecoveryExpectation = {
    requestId,
    inputHash,
    providerName,
    payerAccountId: config.HEDERA_AGENT_ACCOUNT_ID,
    recipientAccountId: config.ALPHA_RECIPIENT_ACCOUNT_ID,
    amountTinybars: config.ALPHA_PRICE_TINYBARS.toString()
  };

  const client = new Client({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const initial = await loadRecoveryRow(client, requestId, false);
    validatePaidExtractionRecovery(initial, expected);
    if (dryRun) {
      jsonLog({
        mode: "dry-run",
        requestId,
        provider: initial.provider_name,
        payer: initial.payer_account_id,
        recipient: initial.recipient_account_id,
        amountTinybars: initial.amount_tinybars,
        network: initial.network,
        paymentStatus: initial.payment_status,
        reservationStatus: initial.reservation_status,
        transactionReference: initial.transaction_reference,
        nextAction: "one Gemini extraction; no payment"
      });
      return;
    }

    const leaseOwner = randomUUID();
    await client.query("BEGIN");
    try {
      const locked = await loadRecoveryRow(client, requestId, true);
      validatePaidExtractionRecovery(locked, expected);
      const claim = await client.query(`
        UPDATE requests
        SET execution_status = 'RUNNING', error = NULL, execution_lease_owner = $2,
            execution_lease_expires_at = now() + ($3 * interval '1 second'), updated_at = now()
        WHERE id = $1
          AND (execution_status = 'FAILED'
            OR (execution_status = 'RUNNING' AND execution_lease_expires_at <= now()))
      `, [requestId, leaseOwner, leaseDurationSeconds]);
      if (claim.rowCount !== 1) throw new Error("recovery execution lease was not acquired");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    try {
      const image = validateInvoiceImage(fixtureBytes, "image/png", {
        maxBytes: config.MAX_INPUT_BYTES,
        maxPixels: config.MAX_INPUT_PIXELS
      });
      const extraction = await createGeminiInvoiceExtractor(config).extract(image);
      const completed = await client.query(`
        UPDATE requests q
        SET execution_status = 'SUCCEEDED', result = $3, error = NULL,
            execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE q.id = $1 AND q.execution_lease_owner = $2 AND q.execution_status = 'RUNNING'
          AND EXISTS (
            SELECT 1 FROM payments p JOIN budget_reservations br ON br.payment_id = p.id
            WHERE p.request_id = q.id AND p.status = 'SETTLED' AND br.status = 'CONSUMED'
          )
      `, [requestId, leaseOwner, JSON.stringify(extraction)]);
      if (completed.rowCount !== 1) throw new Error("recovery completion lease was lost");
      jsonLog({ mode: "apply", requestId, paymentCreated: false, extraction });
    } catch {
      await client.query(`
        UPDATE requests
        SET execution_status = 'FAILED', result = NULL, error = $3,
            execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $2 AND execution_status = 'RUNNING'
      `, [requestId, leaseOwner, JSON.stringify({ code: "RECOVERY_EXTRACTION_FAILED" })]);
      throw new Error("recovery model execution failed");
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  jsonLog({ ok: false, error: safeErrorDetail("paid extraction recovery", error) });
  process.exitCode = 1;
});
