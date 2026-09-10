import { describe, expect, it } from "vitest";
import { formatTinybars, parseTinybars, selectCheapestEligible, type Candidate } from "./index.js";

const baseCandidate: Candidate = {
  metadata: {
    name: "alpha.ocr.agentpay.eth",
    schema: "1",
    capability: "invoice-extraction",
    endpoint: "https://provider.example/providers/alpha",
    network: "hedera:testnet",
    asset: "0.0.0",
    recipient: "0.0.1234",
    active: true,
    resolvedAt: "2026-09-10T00:00:00.000Z",
    resolver: "0x1111111111111111111111111111111111111111"
  },
  offer: {
    capability: "invoice-extraction",
    amount: "1000000",
    network: "hedera:testnet",
    asset: "0.0.0",
    recipient: "0.0.1234",
    available: true,
    expiresAt: "2026-09-11T00:00:00.000Z"
  }
};

describe("tinybar helpers", () => {
  it("uses integer strings without floating-point conversion", () => {
    expect(formatTinybars(parseTinybars("1000000"))).toBe("1000000");
    expect(() => parseTinybars("0.01")).toThrow();
  });
});

describe("selection policy", () => {
  it("chooses the cheapest eligible candidate with an ENS-name tie break", () => {
    const beta = structuredClone(baseCandidate);
    beta.metadata.name = "beta.ocr.agentpay.eth";
    beta.offer.amount = "2000000";

    const result = selectCheapestEligible(
      [beta, baseCandidate],
      5_000_000n,
      new Set(["https://provider.example"]),
      new Date("2026-09-10T12:00:00.000Z")
    );

    expect(result.selected?.metadata.name).toBe("alpha.ocr.agentpay.eth");
  });

  it("rejects recipient substitution and over-budget offers", () => {
    const changedRecipient = structuredClone(baseCandidate);
    changedRecipient.offer.recipient = "0.0.9999";
    const expensive = structuredClone(baseCandidate);
    expensive.metadata.name = "beta.ocr.agentpay.eth";
    expensive.offer.amount = "6000000";

    const result = selectCheapestEligible(
      [changedRecipient, expensive],
      5_000_000n,
      new Set(["https://provider.example"]),
      new Date("2026-09-10T12:00:00.000Z")
    );

    expect(result.selected).toBeNull();
    expect(result.excluded.map(({ reason }) => reason)).toEqual([
      "offer recipient differs from ENS",
      "over budget"
    ]);
  });
});

