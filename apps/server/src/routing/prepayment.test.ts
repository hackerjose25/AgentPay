import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../config.js";
import { createRoutePreview } from "./prepayment.js";

const config = {
  NODE_ENV: "production",
  ENS_RPC_URL: "https://rpc.example",
  PROVIDER_ALLOWED_ORIGINS: ["https://provider.example"],
  BLOCKY402_FACILITATOR_URL: "https://api.testnet.blocky402.com",
  MAX_SPEND_PER_REQUEST_TINYBARS: 5_000_000n
} as RuntimeConfig;
const metadata = {
  name: "alpha.ocr.agentpayapp.eth",
  schema: "1" as const,
  capability: "invoice-extraction" as const,
  endpoint: "https://provider.example/providers/alpha",
  network: "hedera:testnet" as const,
  asset: "0.0.0" as const,
  recipient: "0.0.2001",
  active: true,
  resolvedAt: "2026-09-11T10:00:00.000Z",
  resolver: "0x1111111111111111111111111111111111111111"
};
const offer = {
  capability: "invoice-extraction" as const,
  amount: "1000000",
  asset: "0.0.0" as const,
  network: "hedera:testnet" as const,
  recipient: "0.0.2001",
  available: true,
  expiresAt: "2099-09-11T10:00:00.000Z"
};
const paymentRequired: PaymentRequired = {
  x402Version: 2,
  resource: { url: "https://provider.example/providers/alpha/extract" },
  accepts: [{
    scheme: "exact",
    network: "hedera:testnet",
    asset: "0.0.0",
    amount: "1000000",
    payTo: "0.0.2001",
    maxTimeoutSeconds: 60,
    extra: { paymentFlow: "upfront", feePayer: "0.0.7162784" }
  }]
};

describe("browser pre-payment preview", () => {
  it("warms first, refreshes ENS, and accepts only matching unsigned 402 terms", async () => {
    const fetcher = vi.fn((input: string | URL) => Promise.resolve(String(input).endsWith("/offer")
      ? new Response(JSON.stringify(offer), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(null, { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(paymentRequired) } })));
    const resolveMetadata = vi.fn(() => Promise.resolve(metadata));
    const waitUntilReady = vi.fn(() => Promise.resolve({ attempts: 2, waitedMs: 31_000 }));

    const result = await createRoutePreview(config, [metadata.name], 2_000_000n, {
      fetcher: fetcher as typeof fetch,
      resolveMetadata,
      waitUntilReady,
      facilitatorSupport: () => Promise.resolve({ x402Version: 2, feePayer: "0.0.7162784" })
    });

    expect(result.selected.metadata.name).toBe(metadata.name);
    expect(result.paymentRequirement.amount).toBe("1000000");
    expect(result.readiness).toEqual([{ name: metadata.name, attempts: 2, waitedMs: 31_000 }]);
    expect(resolveMetadata).toHaveBeenCalledTimes(2);
    expect(waitUntilReady).toHaveBeenCalledBefore(fetcher);
  });

  it("rejects a recipient substitution in the 402 response", async () => {
    const changed = { ...paymentRequired, accepts: [{ ...paymentRequired.accepts[0]!, payTo: "0.0.9999" }] };
    const fetcher = vi.fn((input: string | URL) => Promise.resolve(String(input).endsWith("/offer")
      ? new Response(JSON.stringify(offer), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(null, { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(changed) } })));

    await expect(createRoutePreview(config, [metadata.name], 2_000_000n, {
      fetcher: fetcher as typeof fetch,
      resolveMetadata: () => Promise.resolve(metadata),
      waitUntilReady: () => Promise.resolve({ attempts: 1, waitedMs: 0 }),
      facilitatorSupport: () => Promise.resolve({ x402Version: 2, feePayer: "0.0.7162784" })
    })).rejects.toMatchObject({ code: "QUOTE_CHANGED" });
  });
});
