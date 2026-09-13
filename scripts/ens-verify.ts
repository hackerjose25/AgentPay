import { resolveProviderMetadata } from "../apps/server/src/ens/resolver.js";
import { jsonLog, loadRootEnv, requiredValue, safeErrorDetail } from "./shared.js";
import { ZodError } from "zod";

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
    const detail = error instanceof ZodError
      ? `ENS metadata is missing or invalid: ${[...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ")}`
      : safeErrorDetail("ENS resolution", error);
    results.push({ name, ok: false, error: detail });
  }
}
jsonLog({ chainId: 11155111, results });
if (results.some((result) => !result.ok)) process.exitCode = 1;
