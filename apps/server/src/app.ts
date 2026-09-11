import cors from "cors";
import express, { type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { issueSession, readCookie, secretMatches, sessionCookieName, sessionTtlSeconds, verifySession, type SessionClaims } from "./auth/session.js";
import { BrowserFlowService } from "./browser/flow.js";
import type { RuntimeConfig } from "./config.js";
import { createGeminiInvoiceExtractor, type InvoiceExtractor } from "./extraction/gemini.js";
import { validateInvoiceImage } from "./extraction/image.js";
import { errorHandler, HttpError, notFound } from "./http/errors.js";
import { createRateLimit } from "./http/rate-limit.js";
import { createProviderPaymentMiddleware } from "./payments/server.js";

interface AppDependencies {
  extractor?: InvoiceExtractor;
  paymentMiddleware?: RequestHandler;
  browserFlow?: Pick<BrowserFlowService, "listServices" | "preview" | "createRun" | "getRun" | "execute" | "cancel" | "reconcile" | "recover">;
}

const accessCodeSchema = z.object({ code: z.string().min(1).max(256) });
const previewSchema = z.object({
  task: z.string().trim().min(1).max(200),
  maxSpendTinybars: z.string().regex(/^[1-9]\d*$/)
});
const executeSchema = z.object({ paymentSignature: z.string().min(16).max(65_536) });
const runFieldsSchema = z.object({
  task: z.string(),
  maxSpendTinybars: z.string(),
  payerAccountId: z.string()
});

function requireTrustedOrigin(config: RuntimeConfig): RequestHandler {
  return (request, _response, next) => {
    if (request.header("origin") !== config.WEB_ORIGIN) throw new HttpError("INVALID_ORIGIN", "Request origin is not allowed", 403);
    next();
  };
}

function sessionClaims(request: Parameters<RequestHandler>[0], config: RuntimeConfig): SessionClaims {
  const claims = verifySession(readCookie(request.header("cookie"), sessionCookieName), config.SESSION_SECRET);
  if (!claims) throw new HttpError("UNAUTHENTICATED", "A valid demo session is required", 401);
  return claims;
}

function requireCsrf(request: Parameters<RequestHandler>[0], claims: SessionClaims): void {
  if (!secretMatches(request.header("x-csrf-token") ?? "", claims.csrfToken)) {
    throw new HttpError("INVALID_CSRF", "Request verification failed", 403);
  }
}

function requireBrowserSession(config: RuntimeConfig, csrf: boolean): RequestHandler {
  return (request, _response, next) => {
    const claims = sessionClaims(request, config);
    if (csrf) requireCsrf(request, claims);
    next();
  };
}

export function createApp(config: RuntimeConfig, dependencies: AppDependencies = {}) {
  const app = express();
  const extractor = dependencies.extractor ?? createGeminiInvoiceExtractor(config);
  const browserFlow = dependencies.browserFlow ?? new BrowserFlowService(config, undefined, extractor);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.MAX_INPUT_BYTES, files: 1, fields: 4 }
  });
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(express.raw({ type: ["image/png", "image/jpeg"], limit: config.MAX_INPUT_BYTES }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", network: "hedera:testnet", ensChainId: 11155111 });
  });

  const loginRateLimit = createRateLimit({ max: 10, windowMs: 60_000, key: (request) => request.ip ?? "unknown" });
  const sessionRateLimit = createRateLimit({
    max: 60,
    windowMs: 60_000,
    key: (request) => sessionClaims(request, config).sessionId
  });

  app.post("/api/session", requireTrustedOrigin(config), loginRateLimit, (request, response) => {
    const { code } = accessCodeSchema.parse(request.body);
    if (!secretMatches(code, config.DEMO_ACCESS_CODE)) throw new HttpError("INVALID_ACCESS_CODE", "Access code is incorrect", 401);
    const { token, claims } = issueSession(config.SESSION_SECRET);
    response.cookie(sessionCookieName, token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: config.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: sessionTtlSeconds * 1_000
    });
    response.status(201).json({ authenticated: true, csrfToken: claims.csrfToken, expiresAt: new Date(claims.expiresAt).toISOString() });
  });

  app.get("/api/session", (request, response) => {
    const claims = verifySession(readCookie(request.header("cookie"), sessionCookieName), config.SESSION_SECRET);
    response.json(claims
      ? { authenticated: true, csrfToken: claims.csrfToken, expiresAt: new Date(claims.expiresAt).toISOString() }
      : { authenticated: false });
  });

  app.delete("/api/session", requireTrustedOrigin(config), (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: config.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    });
    response.status(204).end();
  });

  app.get("/api/services", async (_request, response) => {
    response.json({ services: await browserFlow.listServices() });
  });

  app.post("/api/route", requireTrustedOrigin(config), sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    const input = previewSchema.parse(request.body);
    if (!/invoice|extract/i.test(input.task)) throw new HttpError("UNSUPPORTED_TASK", "Only invoice extraction is supported", 400);
    const preview = await browserFlow.preview(input.maxSpendTinybars);
    response.json({
      capability: "invoice-extraction",
      selected: preview.selected,
      readiness: preview.readiness,
      excluded: preview.excluded,
      unavailable: preview.unavailable,
      facilitator: preview.facilitator,
      validatedAt: preview.validatedAt
    });
  });

  app.post("/api/runs", requireTrustedOrigin(config), requireBrowserSession(config, true), sessionRateLimit, upload.single("invoice"), async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    const file = request.file;
    if (!file) throw new HttpError("INVALID_IMAGE", "One invoice PNG or JPEG is required", 400);
    const image = validateInvoiceImage(file.buffer, file.mimetype, {
      maxBytes: config.MAX_INPUT_BYTES,
      maxPixels: config.MAX_INPUT_PIXELS
    });
    const idempotencyKey = request.header("idempotency-key");
    if (!idempotencyKey) throw new HttpError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required", 400);
    const fields = runFieldsSchema.parse(request.body);
    const run = await browserFlow.createRun({
      sessionId: claims.sessionId,
      idempotencyKey,
      task: fields.task,
      maxSpendTinybars: fields.maxSpendTinybars,
      payerAccountId: fields.payerAccountId,
      image: { bytes: image.bytes, mimeType: image.mimeType }
    });
    response.status(201).json(run);
  });

  app.get("/api/runs/:id", sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    response.json(await browserFlow.getRun(String(request.params.id), claims.sessionId));
  });

  app.post("/api/runs/:id/execute", requireTrustedOrigin(config), sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    const { paymentSignature } = executeSchema.parse(request.body);
    response.json(await browserFlow.execute(String(request.params.id), claims.sessionId, paymentSignature));
  });

  app.post("/api/runs/:id/cancel", requireTrustedOrigin(config), sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    response.json(await browserFlow.cancel(String(request.params.id), claims.sessionId));
  });

  app.post("/api/runs/:id/reconcile", requireTrustedOrigin(config), sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    response.json(await browserFlow.reconcile(String(request.params.id), claims.sessionId));
  });

  app.post("/api/runs/:id/recover", requireTrustedOrigin(config), sessionRateLimit, async (request, response) => {
    const claims = sessionClaims(request, config);
    requireCsrf(request, claims);
    response.json(await browserFlow.recover(String(request.params.id), claims.sessionId));
  });

  app.get("/providers/:id/offer", (request, response) => {
    const provider = request.params.id;
    const isAlpha = provider === "alpha";
    const isBeta = provider === "beta";
    if (!isAlpha && !isBeta) return notFound(request, response);
    const amount = isAlpha ? config.ALPHA_PRICE_TINYBARS : config.BETA_PRICE_TINYBARS;
    const recipient = isAlpha ? config.ALPHA_RECIPIENT_ACCOUNT_ID : config.BETA_RECIPIENT_ACCOUNT_ID;
    response.json({
      capability: "invoice-extraction",
      amount: amount.toString(),
      asset: "0.0.0",
      network: "hedera:testnet",
      recipient,
      available: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
  });

  app.use(dependencies.paymentMiddleware ?? createProviderPaymentMiddleware(config));

  app.post("/providers/:id/extract", async (request, response) => {
    const provider = request.params.id;
    if (provider !== "alpha" && provider !== "beta") return notFound(request, response);
    const image = validateInvoiceImage(request.body, request.header("content-type"), {
      maxBytes: config.MAX_INPUT_BYTES,
      maxPixels: config.MAX_INPUT_PIXELS
    });
    const extraction = await extractor.extract(image);
    response.json({
      ok: true,
      provider,
      requestId: request.header("x-request-id") ?? null,
      extraction
    });
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
