import { createHash, randomUUID } from "node:crypto";
import { decodePaymentResponseHeader, decodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequirements } from "@x402/core/types";
import { HEDERA_TESTNET_MIRROR_NODE_URL, getNetForAccount, getPositiveReceivers, inspectHederaTransaction } from "@x402/hedera";
import {
  capabilitySchema,
  hederaAccountIdSchema,
  interpretTask,
  invoiceAnswerSchema,
  invoiceExtractionSchema,
  type Capability
} from "@agentpay/core";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import type { RuntimeConfig } from "../config.js";
import { resolveProviderMetadata } from "../ens/resolver.js";
import type { InvoiceExtractor } from "../extraction/gemini.js";
import { validateInvoiceImage } from "../extraction/image.js";
import { HttpError } from "../http/errors.js";
import { classifyMirrorTransaction, toMirrorTransactionId } from "../payments/reconciliation.js";
import { reserveBudgetInTransaction } from "../persistence/database.js";
import { createRoutePreview, type RoutePreview } from "../routing/prepayment.js";

const taskSchema = z.string().trim().min(1).max(200).refine(
  (task) => interpretTask(task) !== null,
  "Only invoice extraction and invoice question answering are supported"
);
const questionSchema = z.string().trim().min(1).max(500);
const tinybarBudgetSchema = z.string().regex(/^[1-9]\d*$/).transform(BigInt);
const idempotencyKeySchema = z.string().trim().min(8).max(128);
const paymentSignatureSchema = z.string().min(16).max(65_536);
const uuidSchema = z.string().uuid();
const paymentRequirementSchema = z.object({
  scheme: z.literal("exact"),
  network: z.literal("hedera:testnet"),
  asset: z.literal("0.0.0"),
  amount: z.string().regex(/^[1-9]\d*$/),
  payTo: hederaAccountIdSchema,
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.record(z.string(), z.unknown())
});
const routingSnapshotSchema = z.object({
  capability: capabilitySchema,
  executeUrl: z.url(),
  paymentRequired: z.unknown(),
  paymentRequirement: paymentRequirementSchema,
  validatedAt: z.iso.datetime(),
  selected: z.object({
    metadata: z.object({ name: z.string(), recipient: hederaAccountIdSchema }),
    offer: z.object({ expiresAt: z.iso.datetime() })
  })
});

export interface BrowserRunInput {
  sessionId: string;
  idempotencyKey: string;
  task: string;
  maxSpendTinybars: string;
  payerAccountId: string;
  image: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" };
  question?: string;
}

export interface BrowserRunView {
  runId: string;
  requestId: string;
  status: string;
  provider: string;
  payerAccountId: string;
  amountTinybars: string;
  recipientAccountId: string;
  network: "hedera:testnet";
  asset: "0.0.0";
  paymentStatus: string;
  transactionReference: string | null;
  reservationStatus: string;
  result: unknown;
  error: unknown;
  paymentRequired?: unknown;
  expiresAt: string;
}

interface RunRow {
  run_id: string;
  request_id: string;
  session_id: string;
  task: string;
  question: string | null;
  budget_tinybars: string;
  input_hash: string;
  expires_at: Date;
  routing_snapshot: unknown;
  provider_name: string;
  payer_account_id: string;
  quote_snapshot: unknown;
  execution_status: string;
  result: unknown;
  error: unknown;
  execution_lease_owner: string | null;
  execution_lease_expires_at: Date | null;
  payment_id: string;
  payment_status: string;
  amount_tinybars: string;
  asset: "0.0.0";
  network: "hedera:testnet";
  recipient_account_id: string;
  transaction_reference: string | null;
  submitted_at: Date | null;
  reservation_status: string;
  image_bytes: Buffer | null;
  mime_type: "image/png" | "image/jpeg" | null;
}

interface PostgresError extends Error {
  code?: string;
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function publicRun(row: RunRow, includeIntent = false): BrowserRunView {
  const snapshot = routingSnapshotSchema.parse(row.routing_snapshot);
  return {
    runId: row.run_id,
    requestId: row.request_id,
    status: row.execution_status,
    provider: row.provider_name,
    payerAccountId: row.payer_account_id,
    amountTinybars: row.amount_tinybars,
    recipientAccountId: row.recipient_account_id,
    network: row.network,
    asset: row.asset,
    paymentStatus: row.payment_status,
    transactionReference: row.transaction_reference,
    reservationStatus: row.reservation_status,
    result: row.result,
    error: row.error,
    ...(includeIntent ? { paymentRequired: snapshot.paymentRequired } : {}),
    expiresAt: row.expires_at.toISOString()
  };
}

function paymentTermsMatch(left: PaymentRequirements, right: PaymentRequirements): boolean {
  return left.scheme === right.scheme
    && left.network === right.network
    && left.asset === right.asset
    && left.amount === right.amount
    && left.payTo === right.payTo
    && left.extra.paymentFlow === right.extra.paymentFlow;
}

export class BrowserFlowService {
  private readonly pool: Pool;

  constructor(
    private readonly config: RuntimeConfig,
    pool?: Pool,
    private readonly extractor?: InvoiceExtractor
  ) {
    this.pool = pool ?? new Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 5_000 });
  }

  async listServices(): Promise<Array<{ name: string; available: boolean; metadata?: unknown }>> {
    const enrolled = await this.pool.query<{ ens_name: string }>(
      "SELECT ens_name FROM providers WHERE enrollment_status = 'ACTIVE' ORDER BY ens_name"
    );
    return Promise.all(enrolled.rows.map(async ({ ens_name }) => {
      try {
        return { name: ens_name, available: true, metadata: await resolveProviderMetadata(ens_name, this.config.ENS_RPC_URL) };
      } catch {
        return { name: ens_name, available: false };
      }
    }));
  }

  async preview(maxSpendTinybarsValue: string, capability: Capability): Promise<RoutePreview> {
    const maxSpendTinybars = tinybarBudgetSchema.parse(maxSpendTinybarsValue);
    const enrolled = await this.pool.query<{ ens_name: string }>(
      "SELECT ens_name FROM providers WHERE enrollment_status = 'ACTIVE' ORDER BY ens_name"
    );
    return createRoutePreview(this.config, enrolled.rows.map((row) => row.ens_name), maxSpendTinybars, capability);
  }

  private async findRun(runId: string, sessionId: string): Promise<RunRow> {
    const result = await this.pool.query<RunRow>(`
      SELECT r.id AS run_id, q.id AS request_id, r.session_id, r.task, r.question,
        r.budget_tinybars::text, r.input_hash, r.expires_at, r.routing_snapshot,
        q.provider_name, q.payer_account_id, q.quote_snapshot, q.execution_status,
        q.result, q.error, q.execution_lease_owner, q.execution_lease_expires_at,
        p.id AS payment_id, p.status AS payment_status, p.amount_tinybars::text,
        p.asset, p.network, p.recipient_account_id, p.transaction_reference, p.submitted_at,
        br.status AS reservation_status, i.image_bytes, i.mime_type
      FROM runs r
      JOIN requests q ON q.run_id = r.id
      JOIN payments p ON p.request_id = q.id
      JOIN budget_reservations br ON br.payment_id = p.id
      LEFT JOIN run_inputs i ON i.run_id = r.id
      WHERE r.id = $1 AND r.session_id = $2
      ORDER BY p.created_at DESC LIMIT 1
    `, [uuidSchema.parse(runId), sessionId]);
    const row = result.rows[0];
    if (!row) throw new HttpError("NOT_FOUND", "Run was not found for this session", 404);
    return row;
  }

  async getRun(runId: string, sessionId: string): Promise<BrowserRunView> {
    return publicRun(await this.findRun(runId, sessionId));
  }

  async createRun(input: BrowserRunInput): Promise<BrowserRunView> {
    const task = taskSchema.parse(input.task);
    const capability = interpretTask(task);
    if (!capability) throw new HttpError("UNSUPPORTED_TASK", "Only invoice extraction and invoice question answering are supported", 400);
    const question = input.question?.trim() || null;
    if (capability === "invoice-qa" && !question) {
      throw new HttpError("QUESTION_REQUIRED", "A question is required for invoice question answering", 400);
    }
    if (capability === "invoice-extraction" && question) {
      throw new HttpError("QUESTION_NOT_ALLOWED", "A question is only allowed for invoice question answering", 400);
    }
    if (question) questionSchema.parse(question);
    const budgetTinybars = tinybarBudgetSchema.parse(input.maxSpendTinybars);
    const payerAccountId = hederaAccountIdSchema.parse(input.payerAccountId);
    const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);
    if (budgetTinybars > this.config.MAX_SPEND_PER_TASK_TINYBARS) {
      throw new HttpError("INVALID_BUDGET", "Budget exceeds the server task cap", 400);
    }
    const inputHash = createHash("sha256").update(input.image.bytes).digest("hex");
    const existing = await this.pool.query<{ id: string; task: string; question: string | null; budget_tinybars: string; input_hash: string }>(
      "SELECT id, task, question, budget_tinybars::text, input_hash FROM runs WHERE session_id = $1 AND idempotency_key = $2",
      [input.sessionId, idempotencyKey]
    );
    const prior = existing.rows[0];
    if (prior) {
      if (prior.task !== task || prior.question !== question || prior.budget_tinybars !== budgetTinybars.toString() || prior.input_hash !== inputHash) {
        throw new HttpError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used with different input", 409);
      }
      return publicRun(await this.findRun(prior.id, input.sessionId), true);
    }

    const preview = await this.preview(budgetTinybars.toString(), capability);
    if (Date.now() - new Date(preview.validatedAt).getTime() > 30_000 || new Date(preview.selected.offer.expiresAt) <= new Date()) {
      throw new HttpError("QUOTE_EXPIRED", "The route preview expired before reservation", 409, true);
    }
    const runId = randomUUID();
    const requestId = randomUUID();
    const routingSnapshot = {
      capability,
      selected: preview.selected,
      executeUrl: preview.executeUrl,
      paymentRequired: preview.paymentRequired,
      paymentRequirement: preview.paymentRequirement,
      readiness: preview.readiness,
      facilitator: preview.facilitator,
      validatedAt: preview.validatedAt
    };
    const expiresAt = new Date(Date.now() + this.config.RESULT_RETENTION_HOURS * 60 * 60 * 1_000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO runs (id, session_id, idempotency_key, task, capability, question, budget_tinybars,
          input_reference, input_hash, routing_snapshot, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [runId, input.sessionId, idempotencyKey, task, capability, question, budgetTinybars.toString(), `database:run_inputs:${runId}`, inputHash, JSON.stringify(routingSnapshot), expiresAt]);
      await client.query(`
        INSERT INTO requests (id, run_id, provider_name, payer_account_id, input_hash, quote_snapshot)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [requestId, runId, preview.selected.metadata.name, payerAccountId, inputHash, JSON.stringify(preview.selected.offer)]);
      await client.query(`
        INSERT INTO run_inputs (run_id, mime_type, byte_size, image_bytes, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [runId, input.image.mimeType, input.image.bytes.byteLength, Buffer.from(input.image.bytes), expiresAt]);
      await reserveBudgetInTransaction(client, {
        requestId,
        runId,
        payerAccountId,
        amountTinybars: BigInt(preview.selected.offer.amount),
        recipientAccountId: preview.selected.metadata.recipient
      }, {
        perRequest: this.config.MAX_SPEND_PER_REQUEST_TINYBARS,
        perTask: minimum(budgetTinybars, this.config.MAX_SPEND_PER_TASK_TINYBARS),
        perDay: this.config.MAX_SPEND_PER_DAY_TINYBARS
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      const message = error instanceof Error ? error.message : "";
      if (["PER_REQUEST_BUDGET_EXCEEDED", "TASK_BUDGET_EXCEEDED", "DAILY_BUDGET_EXCEEDED"].includes(message)) {
        throw new HttpError("BUDGET_EXCEEDED", "The selected payment exceeds an enforced server budget", 409);
      }
      if ((error as PostgresError).code === "23505") {
        const concurrent = await this.pool.query<{ id: string; task: string; question: string | null; budget_tinybars: string; input_hash: string }>(
          "SELECT id, task, question, budget_tinybars::text, input_hash FROM runs WHERE session_id = $1 AND idempotency_key = $2",
          [input.sessionId, idempotencyKey]
        );
        const concurrentRun = concurrent.rows[0];
        if (concurrentRun) {
          if (concurrentRun.task !== task || concurrentRun.question !== question || concurrentRun.budget_tinybars !== budgetTinybars.toString() || concurrentRun.input_hash !== inputHash) {
            throw new HttpError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used with different input", 409);
          }
          return publicRun(await this.findRun(concurrentRun.id, input.sessionId), true);
        }
      }
      throw error;
    } finally {
      client.release();
    }
    return publicRun(await this.findRun(runId, input.sessionId), true);
  }

  async execute(runId: string, sessionId: string, paymentSignatureValue: string): Promise<BrowserRunView> {
    const paymentSignature = paymentSignatureSchema.parse(paymentSignatureValue);
    const initial = await this.findRun(runId, sessionId);
    if (initial.execution_status === "SUCCEEDED") return publicRun(initial);
    if (initial.payment_status !== "RESERVED" || initial.reservation_status !== "HELD") {
      throw new HttpError("PAYMENT_NOT_RETRYABLE", "This payment cannot be submitted again", 409);
    }
    const snapshot = routingSnapshotSchema.parse(initial.routing_snapshot);
    if (new Date(initial.expires_at) <= new Date() || new Date(snapshot.selected.offer.expiresAt) <= new Date()) {
      throw new HttpError("QUOTE_EXPIRED", "The payment intent has expired; cancel this run and create a new preview", 409);
    }
    const payload = decodePaymentSignatureHeader(paymentSignature);
    if (payload.x402Version !== 2 || !paymentTermsMatch(payload.accepted, snapshot.paymentRequirement)) {
      throw new HttpError("QUOTE_CHANGED", "Signed payment terms do not match this run", 409);
    }
    const transaction = payload.payload.transaction;
    if (typeof transaction !== "string") throw new HttpError("INVALID_PAYMENT", "Payment payload has no Hedera transaction", 400);
    const inspected = inspectHederaTransaction(transaction);
    const amount = BigInt(snapshot.paymentRequirement.amount);
    const transfers = inspected.hbarTransfers;
    const positiveReceivers = getPositiveReceivers(transfers);
    if (inspected.hasNonTransferOperations
      || getNetForAccount(transfers, initial.recipient_account_id) !== amount
      || getNetForAccount(transfers, initial.payer_account_id) !== -amount
      || positiveReceivers.length !== 1
      || positiveReceivers[0] !== initial.recipient_account_id) {
      throw new HttpError("INVALID_PAYMENT", "Signed transaction does not match the selected payer, recipient and amount", 400);
    }
    if (!initial.image_bytes || !initial.mime_type) {
      throw new HttpError("INPUT_EXPIRED", "The retained invoice is no longer available", 410);
    }

    const leaseOwner = randomUUID();
    const claimClient = await this.pool.connect();
    try {
      await claimClient.query("BEGIN");
      const claimed = await claimClient.query(`
        UPDATE payments p
        SET status = 'SUBMITTING', transaction_reference = $3, submitted_at = now(), updated_at = now()
        FROM requests q, runs r
        WHERE p.id = $1 AND p.request_id = q.id AND q.run_id = r.id AND r.session_id = $2
          AND p.status = 'RESERVED' AND q.execution_status = 'NOT_STARTED'
      `, [initial.payment_id, sessionId, inspected.transactionId]);
      if (claimed.rowCount !== 1) throw new HttpError("PAYMENT_NOT_RETRYABLE", "Another execution already claimed this run", 409);
      const executionClaimed = await claimClient.query(`
        UPDATE requests SET execution_status = 'RUNNING', execution_lease_owner = $2,
          execution_lease_expires_at = now() + interval '2 minutes', updated_at = now()
        WHERE id = $1 AND execution_status = 'NOT_STARTED'
      `, [initial.request_id, leaseOwner]);
      if (executionClaimed.rowCount !== 1) throw new HttpError("PAYMENT_NOT_RETRYABLE", "Another execution already claimed this run", 409);
      await claimClient.query("COMMIT");
    } catch (error) {
      await claimClient.query("ROLLBACK");
      throw error;
    } finally {
      claimClient.release();
    }

    let response: Response;
    try {
      const executeUrl = new URL(snapshot.executeUrl);
      if (snapshot.capability === "invoice-qa") {
        if (!initial.question) throw new HttpError("QUESTION_REQUIRED", "The retained question is no longer available", 410);
        executeUrl.searchParams.set("question", initial.question);
      }
      response = await fetch(executeUrl, {
        method: "POST",
        headers: {
          "content-type": initial.mime_type,
          "payment-signature": paymentSignature,
          "idempotency-key": initial.request_id,
          "x-request-id": initial.request_id
        },
        body: new Uint8Array(initial.image_bytes),
        redirect: "error",
        signal: AbortSignal.timeout(90_000)
      });
    } catch {
      await this.markUnknown(initial.payment_id, initial.request_id, leaseOwner);
      throw new HttpError("PAYMENT_UNKNOWN", "Payment submission outcome is unknown and requires reconciliation; do not pay again", 409);
    }

    const paymentResponseHeader = response.headers.get("payment-response");
    if (!paymentResponseHeader) {
      await this.markUnknown(initial.payment_id, initial.request_id, leaseOwner);
      throw new HttpError("PAYMENT_UNKNOWN", "Provider returned no settlement evidence; reconcile this run and do not pay again", 409);
    }
    let settlement;
    try {
      settlement = decodePaymentResponseHeader(paymentResponseHeader);
    } catch {
      await this.markUnknown(initial.payment_id, initial.request_id, leaseOwner);
      throw new HttpError("PAYMENT_UNKNOWN", "Settlement evidence could not be decoded; reconcile this run and do not pay again", 409);
    }
    if (settlement.network !== "hedera:testnet"
      || settlement.transaction !== inspected.transactionId
      || (settlement.payer !== undefined && settlement.payer !== initial.payer_account_id)
      || (settlement.amount !== undefined && settlement.amount !== snapshot.paymentRequirement.amount)) {
      await this.markUnknown(initial.payment_id, initial.request_id, leaseOwner);
      throw new HttpError("PAYMENT_UNKNOWN", "Settlement evidence did not match the submitted transaction; reconcile this run and do not pay again", 409);
    }
    if (!settlement.success) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("UPDATE payments SET status = 'FAILED', failure_code = 'FACILITATOR_REJECTED', updated_at = now() WHERE id = $1 AND status = 'SUBMITTING'", [initial.payment_id]);
        await client.query("UPDATE budget_reservations SET status = 'RELEASED', released_at = now() WHERE payment_id = $1 AND status = 'HELD'", [initial.payment_id]);
        await client.query("UPDATE requests SET execution_status = 'FAILED', error = $2, execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now() WHERE id = $1", [initial.request_id, JSON.stringify({ code: "PAYMENT_FAILED" })]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      throw new HttpError("PAYMENT_FAILED", "The facilitator rejected the payment", 402);
    }

    let result: unknown;
    try {
      if (snapshot.capability === "invoice-qa") {
        const body = z.object({ ok: z.literal(true), answer: invoiceAnswerSchema.shape.answer }).parse(await response.json());
        if (!response.ok) throw new Error("provider failed after settlement");
        result = { answer: body.answer };
      } else {
        const body = z.object({ ok: z.literal(true), extraction: invoiceExtractionSchema }).parse(await response.json());
        if (!response.ok) throw new Error("provider failed after settlement");
        result = body.extraction;
      }
    } catch {
      await this.markSettled(initial.payment_id, settlement.transaction);
      await this.pool.query(`
        UPDATE requests SET execution_status = 'FAILED', result = NULL, error = $2,
          execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $3
      `, [initial.request_id, JSON.stringify({ code: "PAID_EXTRACTION_FAILED" }), leaseOwner]);
      throw new HttpError("PAID_EXTRACTION_FAILED", "Payment settled but the provider failed; recover this run without paying again", 502, true);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.markSettled(initial.payment_id, settlement.transaction, client);
      const completed = await client.query(`
        UPDATE requests SET execution_status = 'SUCCEEDED', result = $2, error = NULL,
          execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $3 AND execution_status = 'RUNNING'
      `, [initial.request_id, JSON.stringify(result), leaseOwner]);
      if (completed.rowCount !== 1) throw new Error("execution lease was lost");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return publicRun(await this.findRun(runId, sessionId));
  }

  async reconcile(runId: string, sessionId: string): Promise<BrowserRunView> {
    const row = await this.findRun(runId, sessionId);
    if (row.payment_status !== "UNKNOWN" && row.payment_status !== "SUBMITTING") {
      return publicRun(row);
    }
    if (!row.transaction_reference) {
      throw new HttpError("RECONCILIATION_UNAVAILABLE", "The original transaction reference is unavailable", 409);
    }
    const mirrorTransactionId = toMirrorTransactionId(row.transaction_reference);
    let response: Response;
    try {
      response = await fetch(`${HEDERA_TESTNET_MIRROR_NODE_URL}/api/v1/transactions/${encodeURIComponent(mirrorTransactionId)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new HttpError("RECONCILIATION_UNAVAILABLE", "Hedera Mirror Node is temporarily unavailable", 503, true);
    }
    if (response.status === 404) {
      if (!row.submitted_at || Date.now() - row.submitted_at.getTime() < 10 * 60_000) return publicRun(row);
      return this.markReconciledFailure(row, runId, sessionId);
    }
    if (!response.ok) throw new HttpError("RECONCILIATION_UNAVAILABLE", "Hedera Mirror Node could not confirm the transaction", 503, true);
    const outcome = classifyMirrorTransaction(await response.json(), row.transaction_reference);
    if (outcome === "PENDING") return publicRun(row);
    if (outcome === "SETTLED") {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await this.markSettled(row.payment_id, row.transaction_reference, client);
        await client.query(`
          UPDATE requests SET execution_status = 'FAILED', result = NULL, error = $2,
            execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
          WHERE id = $1 AND execution_status <> 'SUCCEEDED'
        `, [row.request_id, JSON.stringify({ code: "PAID_EXTRACTION_FAILED" })]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return publicRun(await this.findRun(runId, sessionId));
    }

    return this.markReconciledFailure(row, runId, sessionId);
  }

  private async markReconciledFailure(row: RunRow, runId: string, sessionId: string): Promise<BrowserRunView> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE payments SET status = 'FAILED', failure_code = 'HEDERA_TRANSACTION_FAILED', updated_at = now() WHERE id = $1 AND status IN ('UNKNOWN', 'SUBMITTING')", [row.payment_id]);
      await client.query("UPDATE budget_reservations SET status = 'RELEASED', released_at = now() WHERE payment_id = $1 AND status = 'HELD'", [row.payment_id]);
      await client.query("UPDATE requests SET execution_status = 'FAILED', error = $2, execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now() WHERE id = $1", [row.request_id, JSON.stringify({ code: "PAYMENT_FAILED" })]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return publicRun(await this.findRun(runId, sessionId));
  }

  async recover(runId: string, sessionId: string): Promise<BrowserRunView> {
    if (!this.extractor) throw new HttpError("RECOVERY_UNAVAILABLE", "The extraction recovery adapter is unavailable", 503, true);
    const row = await this.findRun(runId, sessionId);
    const recoverableExecution = row.execution_status === "FAILED"
      || (row.execution_status === "RUNNING" && row.execution_lease_expires_at !== null && row.execution_lease_expires_at <= new Date());
    if (row.payment_status !== "SETTLED" || row.reservation_status !== "CONSUMED"
      || !recoverableExecution || row.result !== null) {
      throw new HttpError("RECOVERY_NOT_ALLOWED", "Only a paid run with a missing result can be recovered", 409);
    }
    if (row.expires_at <= new Date()) throw new HttpError("RUN_EXPIRED", "This run has passed its retention window", 410);
    if (!row.image_bytes || !row.mime_type) throw new HttpError("INPUT_EXPIRED", "The retained invoice is no longer available", 410);
    const leaseOwner = randomUUID();
    const claim = await this.pool.query(`
      UPDATE requests q SET execution_status = 'RUNNING', error = NULL, execution_lease_owner = $2,
        execution_lease_expires_at = now() + interval '2 minutes', updated_at = now()
      WHERE q.id = $1 AND q.result IS NULL
        AND (q.execution_status = 'FAILED'
          OR (q.execution_status = 'RUNNING' AND q.execution_lease_expires_at <= now()))
        AND EXISTS (SELECT 1 FROM payments p JOIN budget_reservations br ON br.payment_id = p.id
          WHERE p.request_id = q.id AND p.status = 'SETTLED' AND br.status = 'CONSUMED')
    `, [row.request_id, leaseOwner]);
    if (claim.rowCount !== 1) throw new HttpError("RECOVERY_IN_PROGRESS", "Another recovery already claimed this run", 409, true);
    try {
      const image = validateInvoiceImage(row.image_bytes, row.mime_type, {
        maxBytes: this.config.MAX_INPUT_BYTES,
        maxPixels: this.config.MAX_INPUT_PIXELS
      });
      const snapshot = routingSnapshotSchema.parse(row.routing_snapshot);
      const result = snapshot.capability === "invoice-qa"
        ? { answer: (await this.extractor.answerQuestion(image, row.question ?? "")).answer }
        : await this.extractor.extract(image);
      const completed = await this.pool.query(`
        UPDATE requests SET execution_status = 'SUCCEEDED', result = $3, error = NULL,
          execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $2 AND execution_status = 'RUNNING'
      `, [row.request_id, leaseOwner, JSON.stringify(result)]);
      if (completed.rowCount !== 1) throw new Error("recovery lease was lost");
    } catch {
      await this.pool.query(`
        UPDATE requests SET execution_status = 'FAILED', result = NULL, error = $3,
          execution_lease_owner = NULL, execution_lease_expires_at = NULL, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $2 AND execution_status = 'RUNNING'
      `, [row.request_id, leaseOwner, JSON.stringify({ code: "RECOVERY_EXTRACTION_FAILED" })]);
      throw new HttpError("RECOVERY_EXTRACTION_FAILED", "Recovery failed; no new payment was made", 502, true);
    }
    return publicRun(await this.findRun(runId, sessionId));
  }

  async cancel(runId: string, sessionId: string): Promise<BrowserRunView> {
    const row = await this.findRun(runId, sessionId);
    if (row.payment_status !== "RESERVED" || row.execution_status !== "NOT_STARTED") {
      throw new HttpError("RUN_NOT_CANCELABLE", "Only an unsigned reserved run can be canceled", 409);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE payments SET status = 'FAILED', failure_code = 'USER_CANCELLED', updated_at = now() WHERE id = $1 AND status = 'RESERVED'", [row.payment_id]);
      await client.query("UPDATE budget_reservations SET status = 'RELEASED', released_at = now() WHERE payment_id = $1 AND status = 'HELD'", [row.payment_id]);
      await client.query("UPDATE requests SET execution_status = 'FAILED', error = $2, updated_at = now() WHERE id = $1 AND execution_status = 'NOT_STARTED'", [row.request_id, JSON.stringify({ code: "USER_CANCELLED" })]);
      await client.query("DELETE FROM run_inputs WHERE run_id = $1", [row.run_id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { ...publicRun(row), status: "FAILED", paymentStatus: "FAILED", reservationStatus: "RELEASED", error: { code: "USER_CANCELLED" } };
  }

  private async markUnknown(paymentId: string, requestId: string, leaseOwner: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE payments SET status = 'UNKNOWN', updated_at = now() WHERE id = $1 AND status = 'SUBMITTING'", [paymentId]);
      await client.query(`
        UPDATE requests SET execution_status = 'NOT_STARTED', execution_lease_owner = NULL,
          execution_lease_expires_at = NULL, error = $2, updated_at = now()
        WHERE id = $1 AND execution_lease_owner = $3
      `, [requestId, JSON.stringify({ code: "PAYMENT_UNKNOWN" }), leaseOwner]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async markSettled(paymentId: string, transaction: string, client?: PoolClient): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(`
      UPDATE payments SET status = 'SETTLED', transaction_reference = $2,
        settled_at = now(), updated_at = now()
      WHERE id = $1 AND status IN ('SUBMITTING', 'UNKNOWN')
    `, [paymentId, transaction]);
    await executor.query("UPDATE budget_reservations SET status = 'CONSUMED' WHERE payment_id = $1 AND status = 'HELD'", [paymentId]);
  }
}
