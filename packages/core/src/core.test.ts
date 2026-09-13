import { describe, expect, it } from "vitest";
import { formatTinybars, parseTinybars, parseCapabilities, interpretTask, selectCheapestEligible, type Candidate } from "./index.js";

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

describe("interpretTask", () => {
  it("maps extraction mentions to invoice-extraction", () => {
    expect(interpretTask("Extract the invoice fields")).toBe("invoice-extraction");
    expect(interpretTask("invoice processing")).toBe("invoice-extraction");
  });

  it("maps questions to invoice-qa", () => {
    expect(interpretTask("What is the total?")).toBe("invoice-qa");
    expect(interpretTask("is the tax rate 18%")).toBe("invoice-qa");
    expect(interpretTask("How much is the subtotal")).toBe("invoice-qa");
  });

  it("returns null for empty or unsupported tasks", () => {
    expect(interpretTask("")).toBeNull();
    expect(interpretTask("  ")).toBeNull();
    expect(interpretTask("weather report")).toBeNull();
  });
});

describe("parseCapabilities", () => {
  it("splits comma-separated capability records", () => {
    expect(parseCapabilities("invoice-extraction")).toEqual(["invoice-extraction"]);
    expect(parseCapabilities("invoice-extraction,invoice-qa")).toEqual(["invoice-extraction", "invoice-qa"]);
    expect(parseCapabilities("invoice-qa,invoice-extraction")).toEqual(["invoice-qa", "invoice-extraction"]);
  });

  it("ignores unknown capabilities", () => {
    expect(parseCapabilities("invoice-extraction,unknown")).toEqual(["invoice-extraction"]);
    expect(parseCapabilities("something-else")).toEqual([]);
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
      "invoice-extraction",
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
      "invoice-extraction",
      new Date("2026-09-10T12:00:00.000Z")
    );

    expect(result.selected).toBeNull();
    expect(result.excluded.map(({ reason }) => reason)).toEqual([
      "offer recipient differs from ENS",
      "over budget"
    ]);
  });

  it("excludes providers that do not advertise the requested capability", () => {
    const qaCandidate = structuredClone(baseCandidate);
    qaCandidate.offer.capability = "invoice-qa";

    const result = selectCheapestEligible(
      [qaCandidate],
      5_000_000n,
      new Set(["https://provider.example"]),
      "invoice-extraction",
      new Date("2026-09-10T12:00:00.000Z")
    );

    expect(result.selected).toBeNull();
    expect(result.excluded[0]?.reason).toBe("offer capability differs from requested");
  });

  it("excludes candidates whose metadata does not list the requested capability", () => {
    const qaOnly = structuredClone(baseCandidate);
    qaOnly.metadata.capability = "invoice-qa";

    const result = selectCheapestEligible(
      [qaOnly],
      5_000_000n,
      new Set(["https://provider.example"]),
      "invoice-extraction",
      new Date("2026-09-10T12:00:00.000Z")
    );

    expect(result.selected).toBeNull();
    expect(result.excluded[0]?.reason).toBe("capability not advertised");
  });
});

