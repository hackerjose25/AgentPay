import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "./config.js";
import { createApp } from "./app.js";

const expected = {
  invoiceNumber: "AP-2026-0001",
  invoiceDate: "2026-09-10",
  currency: "USD",
  subtotal: "100.00",
  tax: "18.00",
  total: "118.00"
};

const config = {
  WEB_ORIGIN: "http://localhost:3000",
  HEDERA_NETWORK: "hedera:testnet",
  ENS_CHAIN_ID: 11155111,
  ALPHA_PRICE_TINYBARS: 1_000_000n,
  BETA_PRICE_TINYBARS: 2_000_000n,
  ALPHA_RECIPIENT_ACCOUNT_ID: "0.0.2001",
  BETA_RECIPIENT_ACCOUNT_ID: "0.0.2002",
  MAX_INPUT_BYTES: 5_000_000,
  MAX_INPUT_PIXELS: 20_000_000
} as RuntimeConfig;

const servers: Array<ReturnType<ReturnType<typeof createApp>["listen"]>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  })));
});

async function start(extract: () => Promise<typeof expected>): Promise<string> {
  const app = createApp(config, {
    extractor: { extract },
    paymentMiddleware: (_request, _response, next) => next()
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolveListen) => server.once("listening", resolveListen));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("provider extraction route", () => {
  it("passes a validated image to the extractor and returns its schema", async () => {
    const extract = vi.fn(() => Promise.resolve(expected));
    const origin = await start(extract);
    const bytes = await readFile(resolve(process.cwd(), "fixtures/synthetic-invoice.png"));

    const response = await fetch(`${origin}/providers/alpha/extract`, {
      method: "POST",
      headers: { "content-type": "image/png", "x-request-id": "offline-route-test" },
      body: new Uint8Array(bytes)
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      provider: "alpha",
      requestId: "offline-route-test",
      extraction: expected
    });
    expect(extract).toHaveBeenCalledOnce();
  });

  it("rejects non-image JSON before calling the model adapter", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const extract = vi.fn(() => Promise.resolve(expected));
    const origin = await start(extract);

    const response = await fetch(`${origin}/providers/alpha/extract`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "invalid-image-test" },
      body: JSON.stringify({ proof: "not-an-image" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_IMAGE", requestId: "invalid-image-test" });
    expect(extract).not.toHaveBeenCalled();
  });
});
