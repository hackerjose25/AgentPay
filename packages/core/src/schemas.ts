import { z } from "zod";
import { tinybarStringSchema } from "./amounts.js";

export const CAPABILITIES = ["invoice-extraction", "invoice-qa"] as const;
export type Capability = (typeof CAPABILITIES)[number];
export const capabilitySchema = z.enum(CAPABILITIES);
export const CAPABILITY = CAPABILITIES[0];
export const HEDERA_TESTNET = "hedera:testnet" as const;
export const HBAR_ASSET = "0.0.0" as const;

export const hederaAccountIdSchema = z.string().regex(/^0\.0\.[1-9]\d*$/);
export const ensNameSchema = z.string().trim().toLowerCase().min(3).refine(
  (name) => name.includes(".") && !name.includes("/"),
  "must be a dot-separated ENS name"
);

/** Splits a comma-separated ENS capability record into the known capabilities it advertises. */
export function parseCapabilities(raw: string): Capability[] {
  return raw.split(",").map((part) => part.trim()).filter((part): part is Capability =>
    (CAPABILITIES as readonly string[]).includes(part)
  );
}

const questionStartPattern = /^(what|which|who|whom|whose|when|where|why|how|is|are|was|were|do|does|did|can|could|would|should|will)\b/i;

/**
 * Deterministically maps a free-text task to a supported capability.
 * A question (question mark or leading question word) maps to invoice-qa;
 * otherwise an invoice/extraction mention maps to invoice-extraction.
 */
export function interpretTask(task: string): Capability | null {
  const trimmed = task.trim();
  if (!trimmed) return null;
  if (trimmed.includes("?") || questionStartPattern.test(trimmed)) return "invoice-qa";
  if (/invoice|extract/i.test(trimmed)) return "invoice-extraction";
  return null;
}

export const providerMetadataSchema = z.object({
  name: ensNameSchema,
  schema: z.literal("1"),
  capability: z.string().min(1).refine(
    (value) => parseCapabilities(value).length > 0,
    "must advertise at least one known capability"
  ),
  endpoint: z.url().refine((url) => new URL(url).username === "" && new URL(url).password === "", {
    message: "endpoint must not contain userinfo"
  }),
  network: z.literal(HEDERA_TESTNET),
  asset: z.literal(HBAR_ASSET),
  recipient: hederaAccountIdSchema,
  active: z.boolean(),
  resolvedAt: z.iso.datetime(),
  resolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable()
});

export const providerOfferSchema = z.object({
  capability: capabilitySchema,
  amount: tinybarStringSchema,
  asset: z.literal(HBAR_ASSET),
  network: z.literal(HEDERA_TESTNET),
  recipient: hederaAccountIdSchema,
  expiresAt: z.iso.datetime(),
  available: z.boolean()
});

export const paymentStatusSchema = z.enum([
  "UNPAID",
  "RESERVED",
  "SUBMITTING",
  "SETTLED",
  "FAILED",
  "UNKNOWN"
]);

export const executionStatusSchema = z.enum([
  "NOT_STARTED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED"
]);

export const invoiceExtractionSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1).nullable(),
  currency: z.string().length(3),
  subtotal: z.string().regex(/^\d+(\.\d{2})$/),
  tax: z.string().regex(/^\d+(\.\d{2})$/),
  total: z.string().regex(/^\d+(\.\d{2})$/)
});

export const invoiceAnswerSchema = z.object({
  answer: z.string().min(1).max(4000)
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  retryable: z.boolean()
});

export type ProviderMetadata = z.infer<typeof providerMetadataSchema>;
export type ProviderOffer = z.infer<typeof providerOfferSchema>;
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;
export type InvoiceAnswer = z.infer<typeof invoiceAnswerSchema>;

