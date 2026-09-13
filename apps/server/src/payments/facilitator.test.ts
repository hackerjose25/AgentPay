import { describe, expect, it, vi } from "vitest";
import { fetchHederaFacilitatorSupport } from "./facilitator.js";

describe("facilitator capability validation", () => {
  it("accepts only exact x402 v2 Hedera testnet support", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      kinds: [{ scheme: "exact", network: "hedera:testnet", x402Version: 2, extra: { feePayer: "0.0.7162784" } }],
      signers: { "hedera:*": ["0.0.7162784"] }
    }), { status: 200 }));
    await expect(fetchHederaFacilitatorSupport("https://api.testnet.blocky402.com", fetcher)).resolves.toEqual({
      feePayer: "0.0.7162784",
      x402Version: 2
    });
  });

  it("fails closed on a different network", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      kinds: [{ scheme: "exact", network: "hedera:mainnet", x402Version: 2 }]
    }), { status: 200 }));
    await expect(fetchHederaFacilitatorSupport("https://api.testnet.blocky402.com", fetcher)).rejects.toThrow(
      "does not advertise"
    );
  });
});

