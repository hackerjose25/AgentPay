import type { PaymentRequirements } from "@x402/core/types";
import { describe, expect, it } from "vitest";
import { exactlyMatches, type ExpectedPayment } from "./client.js";

const expected: ExpectedPayment = {
  endpoint: new URL("https://provider.example/providers/alpha/extract"),
  amount: "1000000",
  asset: "0.0.0",
  network: "hedera:testnet",
  recipient: "0.0.2001",
  payerAccountId: "0.0.1001",
  payerPrivateKey: "not-used-in-this-test",
  requestId: "request-1"
};

const requirement: PaymentRequirements = {
  scheme: "exact",
  network: "hedera:testnet",
  asset: "0.0.0",
  amount: "1000000",
  payTo: "0.0.2001",
  maxTimeoutSeconds: 60,
  extra: { paymentFlow: "upfront", feePayer: "0.0.7162784" }
};

describe("signer boundary", () => {
  it("accepts only the exact selected terms and upfront settlement", () => {
    expect(exactlyMatches(requirement, expected)).toBe(true);
    expect(exactlyMatches({ ...requirement, amount: "1000001" }, expected)).toBe(false);
    expect(exactlyMatches({ ...requirement, payTo: "0.0.9999" }, expected)).toBe(false);
    expect(exactlyMatches({ ...requirement, network: "hedera:mainnet" }, expected)).toBe(false);
    expect(exactlyMatches({ ...requirement, extra: {} }, expected)).toBe(false);
  });
});

