import { z } from "zod";
import { tinybarStringSchema } from "./amounts.js";

export const CAPABILITY = "invoice-extraction" as const;
export const HEDERA_TESTNET = "hedera:testnet" as const;
export const HBAR_ASSET = "0.0.0" as const;

export const hederaAccountIdSchema = z.string().regex(/^0\.0\.[1-9]\d*$/);
export const ensNameSchema = z.string().trim().toLowerCase().min(3).refine(
  (name) => name.includes(".") && !name.includes("/"),
  "must be a dot-separated ENS name"
);

export const providerMetadataSchema = z.object({
  name: ensNameSchema,
  schema: z.literal("1"),
  capability: z.literal(CAPABILITY),
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
  capability: z.literal(CAPABILITY),
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

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  retryable: z.boolean()
});

export type ProviderMetadata = z.infer<typeof providerMetadataSchema>;
export type ProviderOffer = z.infer<typeof providerOfferSchema>;
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;

