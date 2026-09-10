import { resolveProviderMetadata } from "../apps/server/src/ens/resolver.js";
import { jsonLog, loadRootEnv, requiredValue } from "./shared.js";

loadRootEnv();
if (process.env.ENS_CHAIN_ID !== "11155111") throw new Error("ENS_CHAIN_ID must be Sepolia chain 11155111");
const rpcUrl = requiredValue("ENS_RPC_URL");
const names = requiredValue("ENS_PROVIDER_NAMES").split(",").map((name) => name.trim());

const results = [];
for (const name of names) {
  try {
    const metadata = await resolveProviderMetadata(name, rpcUrl);
    results.push({ name: metadata.name, ok: true, resolver: metadata.resolver, resolvedAt: metadata.resolvedAt });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : "unknown resolution error" });
  }
}
jsonLog({ chainId: 11155111, results });
if (results.some((result) => !result.ok)) process.exitCode = 1;

