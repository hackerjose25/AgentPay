import { providerOfferSchema } from "@agentpay/core";

export interface PaidExtractionRecoveryRow {
  request_id: string;
  run_id: string;
  session_id: string;
  input_reference: string;
  run_input_hash: string;
  provider_name: string;
  payer_account_id: string;
  request_input_hash: string;
  quote_snapshot: unknown;
  execution_status: string;
  result: unknown;
  execution_lease_expires_at: Date | null;
  payment_id: string;
  payment_status: string;
  amount_tinybars: string;
  asset: string;
  network: string;
  recipient_account_id: string;
  transaction_reference: string | null;
  reservation_status: string;
  settled_payment_count: string;
  unresolved_payment_count: string;
}

export interface PaidExtractionRecoveryExpectation {
  requestId: string;
  inputHash: string;
  providerName: string;
  payerAccountId: string;
  recipientAccountId: string;
  amountTinybars: string;
}

export class PaidExtractionRecoveryError extends Error {
  readonly code = "RECOVERY_PRECONDITION_FAILED";
}

function requireRecovery(condition: boolean): asserts condition {
  if (!condition) throw new PaidExtractionRecoveryError("paid extraction recovery precondition failed");
}

export function validatePaidExtractionRecovery(
  row: PaidExtractionRecoveryRow,
  expected: PaidExtractionRecoveryExpectation,
  now = new Date()
): void {
  const quote = providerOfferSchema.safeParse(row.quote_snapshot);
  requireRecovery(quote.success);
  requireRecovery(row.request_id === expected.requestId);
  requireRecovery(row.session_id === "live-smoke");
  requireRecovery(row.input_reference === "fixture:synthetic-invoice.png");
  requireRecovery(row.run_input_hash === expected.inputHash && row.request_input_hash === expected.inputHash);
  requireRecovery(row.provider_name === expected.providerName);
  requireRecovery(row.payer_account_id === expected.payerAccountId);
  requireRecovery(row.result === null && row.execution_status !== "SUCCEEDED");
  requireRecovery(
    row.execution_status === "FAILED"
      || (row.execution_status === "RUNNING" && row.execution_lease_expires_at !== null && row.execution_lease_expires_at <= now)
  );
  requireRecovery(row.payment_status === "SETTLED" && row.reservation_status === "CONSUMED");
  requireRecovery(row.transaction_reference !== null);
  requireRecovery(row.settled_payment_count === "1" && row.unresolved_payment_count === "0");
  requireRecovery(row.amount_tinybars === expected.amountTinybars);
  requireRecovery(row.asset === "0.0.0" && row.network === "hedera:testnet");
  requireRecovery(row.recipient_account_id === expected.recipientAccountId);
  requireRecovery(
    quote.data.capability === "invoice-extraction"
      && quote.data.amount === expected.amountTinybars
      && quote.data.asset === "0.0.0"
      && quote.data.network === "hedera:testnet"
      && quote.data.recipient === expected.recipientAccountId
  );
}
