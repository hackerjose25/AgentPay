import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { RuntimeConfig } from "./config.js";

const config = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://test:test@localhost/test",
  ENS_RPC_URL: "https://rpc.example",
  ENS_CHAIN_ID: 11155111,
  PROVIDER_ALLOWED_ORIGINS: ["https://provider.example"],
  BLOCKY402_FACILITATOR_URL: "https://api.testnet.blocky402.com",
  HEDERA_NETWORK: "hedera:testnet",
  PAYMENT_ASSET: "0.0.0",
  MAX_INPUT_BYTES: 5_000_000,
  MAX_INPUT_PIXELS: 20_000_000,
  DEMO_ACCESS_CODE: "correct-demo-code",
  SESSION_SECRET: "s".repeat(32)
} as RuntimeConfig;

const runView = {
  runId: "c0640201-328d-4b9e-b9f0-62488ca47423",
  requestId: "d09b2d03-8d35-4078-87c0-b316c361adbe",
  status: "NOT_STARTED",
  provider: "alpha.ocr.agentpayapp.eth",
  payerAccountId: "0.0.1001",
  amountTinybars: "1000000",
  recipientAccountId: "0.0.2001",
  network: "hedera:testnet" as const,
  asset: "0.0.0" as const,
  paymentStatus: "RESERVED",
  transactionReference: null,
  reservationStatus: "HELD",
  result: null,
  error: null,
  paymentRequired: { x402Version: 2, accepts: [] },
  expiresAt: "2099-09-11T10:00:00.000Z"
};

const servers: Array<ReturnType<ReturnType<typeof createApp>["listen"]>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  })));
});

describe("browser API contract", () => {
  it("requires a signed session and CSRF token before accepting an invoice run", async () => {
    const browserFlow = {
      listServices: vi.fn(() => Promise.resolve([])),
      preview: vi.fn(() => Promise.resolve({
        selected: { metadata: { name: runView.provider }, offer: { amount: runView.amountTinybars } },
        readiness: [], excluded: [], unavailable: [], facilitator: {}, validatedAt: new Date().toISOString()
      })),
      createRun: vi.fn(() => Promise.resolve(runView)),
      getRun: vi.fn(() => Promise.resolve(runView)),
      execute: vi.fn(() => Promise.resolve({ ...runView, status: "SUCCEEDED" })),
      cancel: vi.fn(() => Promise.resolve({ ...runView, status: "FAILED" })),
      reconcile: vi.fn(() => Promise.resolve({ ...runView, paymentStatus: "SETTLED" })),
      recover: vi.fn(() => Promise.resolve({ ...runView, status: "SUCCEEDED" }))
    };
    const app = createApp(config, {
      browserFlow: browserFlow as never,
      paymentMiddleware: (_request, _response, next) => next(),
      extractor: { extract: vi.fn() }
    });
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolveListen) => server.once("listening", resolveListen));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const denied = await fetch(`${origin}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ code: "wrong-code" })
    });
    expect(denied.status).toBe(401);

    const login = await fetch(`${origin}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ code: config.DEMO_ACCESS_CODE })
    });
    expect(login.status).toBe(201);
    const session = await login.json() as { csrfToken: string };
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toContain("agentpay_session=");

    const fixture = await readFile(resolve(process.cwd(), "fixtures/synthetic-invoice-2.png"));
    const form = new FormData();
    form.set("task", "Extract this invoice");
    form.set("maxSpendTinybars", "5000000");
    form.set("payerAccountId", "0.0.1001");
    form.set("invoice", new Blob([new Uint8Array(fixture)], { type: "image/png" }), "invoice.png");
    const created = await fetch(`${origin}/api/runs`, {
      method: "POST",
      headers: {
        origin: config.WEB_ORIGIN,
        cookie: cookie!,
        "x-csrf-token": session.csrfToken,
        "idempotency-key": "browser-api-test-1"
      },
      body: form
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ runId: runView.runId, paymentStatus: "RESERVED" });
    expect(browserFlow.createRun).toHaveBeenCalledOnce();

    const executed = await fetch(`${origin}/api/runs/${runView.runId}/execute`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: config.WEB_ORIGIN,
        cookie: cookie!,
        "x-csrf-token": session.csrfToken
      },
      body: JSON.stringify({ paymentSignature: "signed-payment-payload" })
    });
    expect(executed.status).toBe(200);
    expect(browserFlow.execute).toHaveBeenCalledOnce();

    const reconciled = await fetch(`${origin}/api/runs/${runView.runId}/reconcile`, {
      method: "POST",
      headers: { origin: config.WEB_ORIGIN, cookie: cookie!, "x-csrf-token": session.csrfToken }
    });
    expect(reconciled.status).toBe(200);
    expect(browserFlow.reconcile).toHaveBeenCalledOnce();

    const recovered = await fetch(`${origin}/api/runs/${runView.runId}/recover`, {
      method: "POST",
      headers: { origin: config.WEB_ORIGIN, cookie: cookie!, "x-csrf-token": session.csrfToken }
    });
    expect(recovered.status).toBe(200);
    expect(browserFlow.recover).toHaveBeenCalledOnce();
  });
});
