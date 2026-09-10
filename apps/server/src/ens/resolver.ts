import { providerMetadataSchema, type ProviderMetadata } from "@agentpay/core";
import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";

const textKeys = {
  schema: "agentpay.schema",
  capability: "agentpay.capability",
  endpoint: "agentpay.endpoint",
  network: "agentpay.payment.network",
  asset: "agentpay.payment.asset",
  recipient: "agentpay.payment.recipient",
  active: "agentpay.active"
} as const;

export async function resolveProviderMetadata(nameInput: string, rpcUrl: string): Promise<ProviderMetadata> {
  const name = normalize(nameInput);
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const resolver = await client.getEnsResolver({ name });
  const values = await Promise.all(
    Object.values(textKeys).map((key) => client.getEnsText({ name, key }))
  );
  const [schema, capability, endpoint, network, asset, recipient, active] = values;

  return providerMetadataSchema.parse({
    name,
    schema,
    capability,
    endpoint,
    network,
    asset,
    recipient,
    active: active === "true",
    resolvedAt: new Date().toISOString(),
    resolver: resolver as Address | null
  });
}

export const agentPayTextKeys = textKeys;

