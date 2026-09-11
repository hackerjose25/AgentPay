import { describe, expect, it, vi } from "vitest";
import { ProviderReadinessError, waitForProviderReadiness } from "./provider.js";

describe("pre-payment provider readiness", () => {
  it("retries read-only offer requests until a cold provider becomes ready", async () => {
    let clock = 0;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new Error("cold start connection reset"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const result = await waitForProviderReadiness(new URL("https://provider.example/offer"), {
      totalTimeoutMs: 10_000,
      attemptTimeoutMs: 2_000,
      initialDelayMs: 100,
      maxDelayMs: 500,
      fetcher,
      now: () => clock,
      sleep: (milliseconds) => {
        clock += milliseconds;
        return Promise.resolve();
      }
    });

    expect(result).toEqual({ attempts: 3, waitedMs: 300 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("fails closed after the bounded readiness window", async () => {
    let clock = 0;
    const fetcher = vi.fn(() => Promise.resolve(new Response(null, { status: 503 })));

    await expect(waitForProviderReadiness(new URL("https://provider.example/offer"), {
      totalTimeoutMs: 1_000,
      attemptTimeoutMs: 200,
      initialDelayMs: 250,
      maxDelayMs: 500,
      fetcher,
      now: () => clock,
      sleep: (milliseconds) => {
        clock += milliseconds;
        return Promise.resolve();
      }
    })).rejects.toThrow(ProviderReadinessError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
