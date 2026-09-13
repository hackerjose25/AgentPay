import { z } from "zod";

const supportedSchema = z.object({
  kinds: z.array(z.object({
    scheme: z.string(),
    network: z.string(),
    x402Version: z.number(),
    extra: z.record(z.string(), z.unknown()).optional()
  })),
  signers: z.record(z.string(), z.array(z.string())).optional()
});

export interface HederaFacilitatorSupport {
  feePayer: string;
  x402Version: 2;
}

export async function fetchHederaFacilitatorSupport(
  facilitatorUrl: string,
  fetcher: typeof fetch = fetch
): Promise<HederaFacilitatorSupport> {
  const url = new URL("/supported", facilitatorUrl);
  const response = await fetcher(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!response.ok) throw new Error(`facilitator returned HTTP ${response.status}`);
  const body = supportedSchema.parse(await response.json());
  const kind = body.kinds.find(
    (candidate) => candidate.scheme === "exact" && candidate.network === "hedera:testnet" && candidate.x402Version === 2
  );
  if (!kind) throw new Error("facilitator does not advertise exact x402 v2 for hedera:testnet");
  const extraFeePayer = kind.extra?.feePayer;
  const signerFeePayer = body.signers?.["hedera:*"]?.[0];
  const feePayer = typeof extraFeePayer === "string" ? extraFeePayer : signerFeePayer;
  if (!feePayer || !/^0\.0\.[1-9]\d*$/.test(feePayer)) throw new Error("facilitator did not advertise a valid Hedera fee payer");
  return { feePayer, x402Version: 2 };
}

