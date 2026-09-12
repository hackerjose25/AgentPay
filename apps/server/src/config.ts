import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const runtimeEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
loadDotenv({ path: runtimeEnvPath, quiet: true });

const placeholderPattern = /(?:REPLACE_ME|YOUR_|USER:PASSWORD|CHANGE_ME)/i;
const nonPlaceholder = z.string().min(1).refine((value) => !placeholderPattern.test(value), "placeholder value is not allowed");
const tinybarEnv = z.string().regex(/^[1-9]\d*$/).transform(BigInt);
const geminiBaseUrl = nonPlaceholder.pipe(z.url({ protocol: /^https$/ })).refine((value) => {
  const url = new URL(value);
  return url.hostname === "generativelanguage.googleapis.com" && url.pathname.replace(/\/$/, "") === "/v1beta";
}, "Gemini base URL must be https://generativelanguage.googleapis.com/v1beta");

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.url(),
  DATABASE_URL: nonPlaceholder.pipe(z.url({ protocol: /^postgres(?:ql)?$/ })),
  ENS_RPC_URL: nonPlaceholder.pipe(z.url({ protocol: /^https$/ })),
  ENS_CHAIN_ID: z.coerce.number().int().refine((value) => value === 11155111, "ENS must use Sepolia chain 11155111"),
  ENS_PARENT_NAME: nonPlaceholder.toLowerCase(),
  ENS_PROVIDER_NAMES: nonPlaceholder.transform((value) => value.split(",").map((name) => name.trim().toLowerCase())),
  HEDERA_NETWORK: z.literal("hedera:testnet"),
  HEDERA_AGENT_ACCOUNT_ID: nonPlaceholder.regex(/^0\.0\.[1-9]\d*$/),
  HEDERA_AGENT_PRIVATE_KEY: nonPlaceholder,
  BLOCKY402_FACILITATOR_URL: z.literal("https://api.testnet.blocky402.com"),
  PAYMENT_ASSET: z.literal("0.0.0"),
  ALPHA_RECIPIENT_ACCOUNT_ID: nonPlaceholder.regex(/^0\.0\.[1-9]\d*$/),
  BETA_RECIPIENT_ACCOUNT_ID: nonPlaceholder.regex(/^0\.0\.[1-9]\d*$/),
  ALPHA_PRICE_TINYBARS: tinybarEnv,
  BETA_PRICE_TINYBARS: tinybarEnv,
  PROVIDER_ALLOWED_ORIGINS: nonPlaceholder.transform((value) => value.split(",").map((origin) => origin.trim())),
  EXTRACTION_MODEL_BASE_URL: geminiBaseUrl,
  EXTRACTION_MODEL_API_KEY: nonPlaceholder,
  EXTRACTION_MODEL_ID: z.literal("gemini-3.6-flash"),
  MAX_SPEND_PER_REQUEST_TINYBARS: tinybarEnv,
  MAX_SPEND_PER_TASK_TINYBARS: tinybarEnv,
  MAX_SPEND_PER_DAY_TINYBARS: tinybarEnv,
  MAX_INPUT_BYTES: z.coerce.number().int().positive(),
  MAX_INPUT_PIXELS: z.coerce.number().int().positive(),
  RESULT_RETENTION_HOURS: z.coerce.number().int().positive(),
  DEMO_ACCESS_CODE: nonPlaceholder.min(12),
  SESSION_SECRET: nonPlaceholder.min(32)
});

export type RuntimeConfig = z.infer<typeof runtimeEnvSchema>;

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = runtimeEnvSchema.parse(environment);
  if (parsed.MAX_SPEND_PER_REQUEST_TINYBARS > parsed.MAX_SPEND_PER_TASK_TINYBARS) {
    throw new Error("MAX_SPEND_PER_REQUEST_TINYBARS cannot exceed MAX_SPEND_PER_TASK_TINYBARS");
  }
  if (parsed.MAX_SPEND_PER_TASK_TINYBARS > parsed.MAX_SPEND_PER_DAY_TINYBARS) {
    throw new Error("MAX_SPEND_PER_TASK_TINYBARS cannot exceed MAX_SPEND_PER_DAY_TINYBARS");
  }
  return parsed;
}

export const requiredRuntimeKeys = Object.keys(runtimeEnvSchema.shape);
