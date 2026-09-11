import cors from "cors";
import express, { type RequestHandler } from "express";
import type { RuntimeConfig } from "./config.js";
import { createGeminiInvoiceExtractor, type InvoiceExtractor } from "./extraction/gemini.js";
import { validateInvoiceImage } from "./extraction/image.js";
import { errorHandler, notFound } from "./http/errors.js";
import { createProviderPaymentMiddleware } from "./payments/server.js";

interface AppDependencies {
  extractor?: InvoiceExtractor;
  paymentMiddleware?: RequestHandler;
}

export function createApp(config: RuntimeConfig, dependencies: AppDependencies = {}) {
  const app = express();
  const extractor = dependencies.extractor ?? createGeminiInvoiceExtractor(config);
  app.disable("x-powered-by");
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(express.raw({ type: ["image/png", "image/jpeg"], limit: config.MAX_INPUT_BYTES }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", network: "hedera:testnet", ensChainId: 11155111 });
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
