import { describe, expect, it } from "vitest";
import {
  PaidExtractionRecoveryError,
  validatePaidExtractionRecovery,
  type PaidExtractionRecoveryExpectation,
  type PaidExtractionRecoveryRow
} from "./paid-extraction.js";

const expected: PaidExtractionRecoveryExpectation = {
  requestId: "6a5f6d04-89cb-4348-8162-b834d56550e2",
  inputHash: "a".repeat(64),
  providerName: "alpha.ocr.agentpayapp.eth",
  payerAccountId: "0.0.10463298",
  recipientAccountId: "0.0.10463387",
  amountTinybars: "1000000"
};

const row: PaidExtractionRecoveryRow = {
  request_id: expected.requestId,
  run_id: "run-id",
  session_id: "live-smoke",
  input_reference: "fixture:synthetic-invoice.png",
  run_input_hash: expected.inputHash,
  provider_name: expected.providerName,
  payer_account_id: expected.payerAccountId,
  request_input_hash: expected.inputHash,
  quote_snapshot: {
    capability: "invoice-extraction",
    amount: expected.amountTinybars,
    asset: "0.0.0",
    network: "hedera:testnet",
    recipient: expected.recipientAccountId,
    expiresAt: "2026-09-11T08:00:00.000Z",
    available: true
  },
  execution_status: "FAILED",
  result: null,
  execution_lease_expires_at: null,
  payment_id: "payment-id",
  payment_status: "SETTLED",
  amount_tinybars: expected.amountTinybars,
  asset: "0.0.0",
  network: "hedera:testnet",
  recipient_account_id: expected.recipientAccountId,
  transaction_reference: "0.0.7162784@1789113168.530015612",
  reservation_status: "CONSUMED",
  settled_payment_count: "1",
  unresolved_payment_count: "0"
};

describe("paid extraction recovery validation", () => {
  it("accepts the exact failed request backed by one consumed settlement", () => {
    expect(() => validatePaidExtractionRecovery(row, expected)).not.toThrow();
  });

  it.each([
    ["recipient substitution", { recipient_account_id: "0.0.999" }],
    ["unresolved payment", { unresolved_payment_count: "1" }],
    ["different fixture hash", { request_input_hash: "b".repeat(64) }],
    ["already completed request", { execution_status: "SUCCEEDED", result: { invoiceNumber: "x" } }]
  ])("rejects %s", (_case, override) => {
    expect(() => validatePaidExtractionRecovery({ ...row, ...override }, expected)).toThrow(PaidExtractionRecoveryError);
  });
});
