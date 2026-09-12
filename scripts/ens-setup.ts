import { encodeFunctionData, createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";
import { jsonLog, loadRootEnv, requiredValue } from "./shared.js";

loadRootEnv();
loadRootEnv(".env.ens-setup");
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("choose exactly one of --dry-run or --apply");
if (process.env.ENS_CHAIN_ID !== "11155111") throw new Error("ENS setup is restricted to Sepolia chain 11155111");

const rpcUrl = requiredValue("ENS_RPC_URL");
const name = normalize(requiredValue("ENS_SETUP_PROVIDER_NAME"));
const endpoint = new URL(requiredValue("ENS_SETUP_ENDPOINT"));
if (endpoint.protocol !== "https:") throw new Error("ENS provider endpoint must use HTTPS");
const recipient = requiredValue("ENS_SETUP_RECIPIENT");
if (!/^0\.0\.[1-9]\d*$/.test(recipient)) throw new Error("ENS_SETUP_RECIPIENT must be an existing Hedera account ID");

const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const resolver = await client.getEnsResolver({ name });
if (!resolver) throw new Error(`no active resolver found for ${name}; registration/configuration must be completed first`);
const records = [
  ["agentpay.schema", "1"],
  ["agentpay.capability", "invoice-extraction,invoice-qa"],
  ["agentpay.endpoint", endpoint.toString().replace(/\/$/, "")],
  ["agentpay.payment.network", "hedera:testnet"],
  ["agentpay.payment.asset", "0.0.0"],
  ["agentpay.payment.recipient", recipient],
  ["agentpay.active", "true"]
] as const;

jsonLog({ mode: apply ? "apply" : "dry-run", chainId: 11155111, name, resolver, records });
if (dryRun) process.exit(0);

const privateKey = requiredValue("ENS_SETUP_OWNER_PRIVATE_KEY") as `0x${string}`;
const account = privateKeyToAccount(privateKey);
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
const resolverAbi = parseAbi([
  "function setText(bytes32 node, string key, string value)",
  "function multicall(bytes[] data) returns (bytes[])"
]);
const node = namehash(name);
const calls = records.map(([key, value]) => encodeFunctionData({
  abi: resolverAbi,
  functionName: "setText",
  args: [node, key, value]
}));
const transactionHash = await wallet.writeContract({
  address: resolver,
  abi: resolverAbi,
  functionName: "multicall",
  args: [calls]
});
const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
jsonLog({ name, chainId: 11155111, transactionHash, blockNumber: receipt.blockNumber.toString(), status: receipt.status });
if (receipt.status !== "success") process.exitCode = 1;
