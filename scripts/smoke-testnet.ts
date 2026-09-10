import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { providerOfferSchema, selectCheapestEligible, type Candidate } from "@agentpay/core";
import { Client } from "pg";
import { resolveProviderMetadata } from "../apps/server/src/ens/resolver.js";
import { reserveBudget, createPool } from "../apps/server/src/persistence/database.js";
import { executeExpectedPayment } from "../apps/server/src/payments/client.js";
import { fetchHederaFacilitatorSupport } from "../apps/server/src/payments/facilitator.js";
import { validateServiceEndpoint } from "../apps/server/src/security/endpoints.js";
import { jsonLog, loadRootEnv, projectRoot, requiredValue } from "./shared.js";

loadRootEnv();
const pay = process.argv.includes("--pay");
const dryRun = process.argv.includes("--dry-run");
if (pay === dryRun) throw new Error("choose exactly one of --dry-run or --pay");
if (process.env.ENS_CHAIN_ID !== "11155111") throw new Error("ENS_CHAIN_ID must be Sepolia chain 11155111");
if (process.env.HEDERA_NETWORK !== "hedera:testnet") throw new Error("HEDERA_NETWORK must be hedera:testnet");
if (process.env.PAYMENT_ASSET !== "0.0.0") throw new Error("PAYMENT_ASSET must be native HBAR 0.0.0");
const facilitatorUrl = requiredValue("BLOCKY402_FACILITATOR_URL");
if (facilitatorUrl !== "https://api.testnet.blocky402.com") throw new Error("Blocky402 testnet is the only allowed facilitator");

const rpcUrl = requiredValue("ENS_RPC_URL");
const names = requiredValue("ENS_PROVIDER_NAMES").split(",").map((name) => name.trim());
const allowedOrigins = new Set(requiredValue("PROVIDER_ALLOWED_ORIGINS").split(",").map((origin) => new URL(origin.trim()).origin));
const maxPerRequest = BigInt(requiredValue("MAX_SPEND_PER_REQUEST_TINYBARS"));
const candidates: Candidate[] = [];
const unavailable: Array<{ name: string; reason: string }> = [];

for (const name of names) {
  try {
    const metadata = await resolveProviderMetadata(name, rpcUrl);
    const base = validateServiceEndpoint(metadata.endpoint, allowedOrigins, process.env.NODE_ENV === "development");
    const offerUrl = new URL(`${base.pathname.replace(/\/$/, "")}/offer`, base.origin);
    const response = await fetch(offerUrl, { redirect: "error", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`offer returned HTTP ${response.status}`);
    candidates.push({ metadata, offer: providerOfferSchema.parse(await response.json()) });
  } catch (error) {
    unavailable.push({ name, reason: error instanceof Error ? error.message : "unknown provider failure" });
  }
}

const selection = selectCheapestEligible(candidates, maxPerRequest, allowedOrigins);
if (!selection.selected) {
  jsonLog({ mode: pay ? "pay" : "dry-run", selected: null, unavailable, excluded: selection.excluded });
  throw new Error("no eligible provider is available within the configured per-request budget");
}
const selected = selection.selected;
const providerBase = new URL(selected.metadata.endpoint);
const extractUrl = new URL(`${providerBase.pathname.replace(/\/$/, "")}/extract`, providerBase.origin);
validateServiceEndpoint(extractUrl.toString(), allowedOrigins, process.env.NODE_ENV === "development");
const support = await fetchHederaFacilitatorSupport(facilitatorUrl);
const proofRequestId = randomUUID();

if (dryRun) {
  const response = await fetch(extractUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": proofRequestId },
    body: JSON.stringify({ proof: "day-1-payment-path" }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status !== 402) throw new Error(`expected HTTP 402, received ${response.status}`);
  const header = response.headers.get("payment-required");
  if (!header) throw new Error("HTTP 402 did not include PAYMENT-REQUIRED");
  const paymentRequired = decodePaymentRequiredHeader(header);
  const exactMatch = paymentRequired.x402Version === 2 && paymentRequired.accepts.some((requirement) =>
    requirement.scheme === "exact"
    && requirement.network === "hedera:testnet"
    && requirement.asset === "0.0.0"
    && requirement.amount === selected.offer.amount
    && requirement.payTo === selected.metadata.recipient
    && requirement.extra.paymentFlow === "upfront"
  );
  if (!exactMatch) throw new Error("HTTP 402 requirements differ from the selected ENS metadata and offer");
  jsonLog({
    mode: "dry-run",
    facilitator: { url: facilitatorUrl, x402Version: support.x402Version, feePayer: support.feePayer },
    selected: { name: selected.metadata.name, endpoint: selected.metadata.endpoint, amount: selected.offer.amount },
    http402Validated: true,
    excluded: selection.excluded,
    unavailable
  });
  process.exit(0);
}

const databaseUrl = requiredValue("DATABASE_URL");
const payerAccountId = requiredValue("HEDERA_AGENT_ACCOUNT_ID");
const payerPrivateKey = requiredValue("HEDERA_AGENT_PRIVATE_KEY");
const fixturePath = resolve(projectRoot, "fixtures/synthetic-invoice.png");
const inputHash = createHash("sha256").update(await readFile(fixturePath)).digest("hex");
const idempotencyArgument = process.argv.indexOf("--idempotency-key");
const idempotencyKey = idempotencyArgument >= 0 ? process.argv[idempotencyArgument + 1] : `day1-${inputHash}`;
if (!idempotencyKey) throw new Error("--idempotency-key requires a value");

const setupClient = new Client({ connectionString: databaseUrl });
await setupClient.connect();
let runId: string = randomUUID();
let requestId: string = randomUUID();
let isNewRequest = false;
try {
  await setupClient.query("BEGIN");
  const enrolled = await setupClient.query("SELECT ens_name FROM providers WHERE ens_name = $1 AND enrollment_status = 'ACTIVE'", [selected.metadata.name]);
  if (!enrolled.rows[0]) throw new Error(`selected provider ${selected.metadata.name} is not enrolled in the directory`);
  const insertedRun = await setupClient.query<{ id: string }>(`
    INSERT INTO runs (id, session_id, idempotency_key, task, capability, budget_tinybars, input_reference, input_hash, routing_snapshot, expires_at)
    VALUES ($1, 'live-smoke', $2, 'Extract the synthetic invoice', 'invoice-extraction', $3, 'fixture:synthetic-invoice.png', $4, $5, now() + interval '24 hours')
    ON CONFLICT (session_id, idempotency_key) DO NOTHING RETURNING id
  `, [runId, idempotencyKey, maxPerRequest.toString(), inputHash, JSON.stringify({ selected: selected.metadata.name, offer: selected.offer })]);
  if (!insertedRun.rows[0]) {
    const existing = await setupClient.query<{ id: string; input_hash: string; budget_tinybars: string }>(
      "SELECT id, input_hash, budget_tinybars::text FROM runs WHERE session_id = 'live-smoke' AND idempotency_key = $1",
      [idempotencyKey]
    );
    const prior = existing.rows[0];
    if (!prior || prior.input_hash !== inputHash || prior.budget_tinybars !== maxPerRequest.toString()) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    runId = prior.id;
    const existingRequest = await setupClient.query<{ id: string }>("SELECT id FROM requests WHERE run_id = $1", [runId]);
    if (existingRequest.rows[0]) requestId = existingRequest.rows[0].id;
  } else {
    await setupClient.query(`
      INSERT INTO requests (id, run_id, provider_name, payer_account_id, input_hash, quote_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [requestId, runId, selected.metadata.name, payerAccountId, inputHash, JSON.stringify(selected.offer)]);
    isNewRequest = true;
  }
  await setupClient.query("COMMIT");
} catch (error) {
  await setupClient.query("ROLLBACK");
  throw error;
} finally {
  await setupClient.end();
}

const pool = createPool(databaseUrl);
try {
  const priorPayment = await pool.query<{ status: string; transaction_reference: string | null }>(
    "SELECT status, transaction_reference FROM payments WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1",
    [requestId]
  );
  if (!isNewRequest && priorPayment.rows[0]) {
    jsonLog({ mode: "pay", requestId, existing: true, payment: priorPayment.rows[0] });
    if (priorPayment.rows[0].status !== "FAILED") process.exit(0);
    throw new Error("existing payment failed; automatic creation of a second signed attempt is disabled");
  }

  const reservation = await reserveBudget(pool, {
    requestId,
    runId,
    payerAccountId,
    amountTinybars: BigInt(selected.offer.amount),
    recipientAccountId: selected.metadata.recipient
  }, {
    perRequest: maxPerRequest,
    perTask: BigInt(requiredValue("MAX_SPEND_PER_TASK_TINYBARS")),
    perDay: BigInt(requiredValue("MAX_SPEND_PER_DAY_TINYBARS"))
  });

  const response = await executeExpectedPayment({
    endpoint: extractUrl,
    amount: selected.offer.amount,
    asset: "0.0.0",
    network: "hedera:testnet",
    recipient: selected.metadata.recipient,
    payerAccountId,
    payerPrivateKey,
    requestId
  }, JSON.stringify({ inputHash, fixture: "synthetic-invoice.png" }), {
    onSigned: async (transactionId) => {
      await pool.query(`
        UPDATE payments SET status = 'SUBMITTING', transaction_reference = $2, submitted_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'RESERVED'
      `, [reservation.paymentId, transactionId]);
    },
    onSettled: async (settlement) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          UPDATE payments SET status = 'SETTLED', transaction_reference = $2, settled_at = now(), updated_at = now()
          WHERE id = $1 AND status IN ('SUBMITTING', 'UNKNOWN')
        `, [reservation.paymentId, settlement.transaction]);
        await client.query("UPDATE budget_reservations SET status = 'CONSUMED' WHERE payment_id = $1 AND status = 'HELD'", [reservation.paymentId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    onAmbiguous: async () => {
      await pool.query("UPDATE payments SET status = 'UNKNOWN', updated_at = now() WHERE id = $1 AND status IN ('RESERVED', 'SUBMITTING')", [reservation.paymentId]);
    }
  });
  if (!response.ok) throw new Error(`paid endpoint returned HTTP ${response.status}`);
  const result: unknown = await response.json();
  jsonLog({ mode: "pay", requestId, selected: selected.metadata.name, result });
} finally {
  await pool.end();
}
