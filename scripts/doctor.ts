import { Client } from "pg";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { requiredRuntimeKeys } from "../apps/server/src/config.js";
import { fetchHederaFacilitatorSupport } from "../apps/server/src/payments/facilitator.js";
import { hasPlaceholder, jsonLog, loadRootEnv, safeErrorDetail } from "./shared.js";

loadRootEnv();
type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

const missing = requiredRuntimeKeys.filter((key) => hasPlaceholder(process.env[key]));
checks.push({
  name: "environment",
  ok: missing.length === 0,
  detail: missing.length === 0 ? "required runtime values are configured" : `missing or placeholder keys: ${missing.join(", ")}`
});

async function check(name: string, action: () => Promise<string>): Promise<void> {
  try {
    checks.push({ name, ok: true, detail: await action() });
  } catch (error) {
    checks.push({ name, ok: false, detail: safeErrorDetail(name, error) });
  }
}

if (!hasPlaceholder(process.env.DATABASE_URL)) {
  await check("database", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
    await client.connect();
    try { await client.query("SELECT 1"); } finally { await client.end(); }
    return "connection succeeded";
  });
}

if (!hasPlaceholder(process.env.ENS_RPC_URL) && process.env.ENS_CHAIN_ID === "11155111") {
  await check("ens-rpc", async () => {
    const client = createPublicClient({ chain: sepolia, transport: http(process.env.ENS_RPC_URL) });
    const block = await client.getBlockNumber();
    return `Sepolia RPC responded at block ${block.toString()}`;
  });
}

if (process.env.BLOCKY402_FACILITATOR_URL === "https://api.testnet.blocky402.com") {
  await check("blocky402", async () => {
    const support = await fetchHederaFacilitatorSupport(process.env.BLOCKY402_FACILITATOR_URL!);
    return `exact x402 v${support.x402Version} Hedera testnet; advertised fee payer ${support.feePayer}`;
  });
}

for (const [name, urlKey, keyKey] of [
  ["agent-model", "AGENT_MODEL_BASE_URL", "AGENT_MODEL_API_KEY"],
  ["extraction-model", "EXTRACTION_MODEL_BASE_URL", "EXTRACTION_MODEL_API_KEY"]
] as const) {
  if (!hasPlaceholder(process.env[urlKey]) && !hasPlaceholder(process.env[keyKey])) {
    await check(name, async () => {
      const url = new URL(process.env[urlKey]!);
      if (url.protocol !== "https:") throw new Error("model endpoint must use HTTPS");
      const response = await fetch(url, {
        method: "HEAD",
        headers: { authorization: `Bearer ${process.env[keyKey]!}` },
        redirect: "error",
        signal: AbortSignal.timeout(8_000)
      });
      if (response.status >= 500) throw new Error(`model endpoint returned HTTP ${response.status}`);
      return `endpoint responded with HTTP ${response.status} without inference`;
    });
  }
}

jsonLog({ ok: checks.every(({ ok }) => ok), checks });
if (checks.some(({ ok }) => !ok)) process.exitCode = 1;
