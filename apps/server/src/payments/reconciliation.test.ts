import { describe, expect, it } from "vitest";
import { classifyMirrorTransaction, toMirrorTransactionId } from "./reconciliation.js";

describe("Hedera payment reconciliation", () => {
  it("normalizes SDK transaction IDs for Mirror Node", () => {
    expect(toMirrorTransactionId("0.0.7162784@1789123959.119920599"))
      .toBe("0.0.7162784-1789123959-119920599");
  });

  it("keeps missing propagation pending and distinguishes final outcomes", () => {
    const transactionId = "0.0.7162784@1789123959.119920599";
    expect(classifyMirrorTransaction({ transactions: [] }, transactionId)).toBe("PENDING");
    expect(classifyMirrorTransaction({ transactions: [{
      transaction_id: "0.0.7162784-1789123959-119920599",
      result: "SUCCESS"
    }] }, transactionId)).toBe("SETTLED");
    expect(classifyMirrorTransaction({ transactions: [{
      transaction_id: "0.0.7162784-1789123959-119920599",
      result: "INSUFFICIENT_PAYER_BALANCE"
    }] }, transactionId)).toBe("FAILED");
  });
});
