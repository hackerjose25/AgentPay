import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../config.js";
import { createGeminiInvoiceExtractor } from "./gemini.js";
import { validateInvoiceImage } from "./image.js";

const expected = {
  invoiceNumber: "AP-2026-0001",
  invoiceDate: "2026-09-10",
  currency: "USD",
  subtotal: "100.00",
  tax: "18.00",
  total: "118.00"
};

const modelConfig = {
  EXTRACTION_MODEL_API_KEY: "test-key",
  EXTRACTION_MODEL_BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
  EXTRACTION_MODEL_ID: "gemini-2.5-flash"
} as RuntimeConfig;

describe("Gemini invoice extractor", () => {
  it("sends the validated image and returns schema-validated output without a live request", async () => {
    const generate = vi.fn(() => Promise.resolve({ output: expected })) as unknown as typeof generateText;
    const bytes = await readFile(resolve(process.cwd(), "fixtures/synthetic-invoice.png"));
    const image = validateInvoiceImage(bytes, "image/png", { maxBytes: 5_000_000, maxPixels: 20_000_000 });

    await expect(createGeminiInvoiceExtractor(modelConfig, generate).extract(image)).resolves.toEqual(expected);
    expect(generate).toHaveBeenCalledOnce();
    const request = vi.mocked(generate).mock.calls[0]?.[0];
    const message = request?.messages?.[0];
    if (!message || message.role !== "user" || typeof message.content === "string") throw new Error("expected user content parts");
    expect(message.content.some((part) => part.type === "image" && part.mediaType === "image/png")).toBe(true);
  });

  it("rejects model output that violates the invoice contract", async () => {
    const generate = vi.fn(() => Promise.resolve({ output: { ...expected, total: "118" } })) as unknown as typeof generateText;
    const bytes = await readFile(resolve(process.cwd(), "fixtures/synthetic-invoice.png"));
    const image = validateInvoiceImage(bytes, "image/png", { maxBytes: 5_000_000, maxPixels: 20_000_000 });

    await expect(createGeminiInvoiceExtractor(modelConfig, generate).extract(image)).rejects.toThrow();
  });
});
