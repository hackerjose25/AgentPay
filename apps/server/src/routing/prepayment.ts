import { randomUUID } from "node:crypto";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { providerOfferSchema, selectCheapestEligible, type Candidate, type Capability } from "@agentpay/core";
import type { RuntimeConfig } from "../config.js";
import { resolveProviderMetadata } from "../ens/resolver.js";
import { HttpError } from "../http/errors.js";
import { fetchHederaFacilitatorSupport } from "../payments/facilitator.js";
import { waitForProviderReadiness } from "../readiness/provider.js";
import { validateServiceEndpoint } from "../security/endpoints.js";

export interface RoutePreview {
  selected: Candidate;
  executeUrl: string;
  paymentRequired: PaymentRequired;
  paymentRequirement: PaymentRequirements;
  readiness: Array<{ name: string; attempts: number; waitedMs: number }>;
  excluded: Array<{ name: string; reason: string }>;
  unavailable: Array<{ name: string; reason: string }>;
  facilitator: { url: string; x402Version: 2; feePayer: string };
  validatedAt: string;
}

interface PreviewDependencies {
  fetcher?: typeof fetch;
  resolveMetadata?: typeof resolveProviderMetadata;
  waitUntilReady?: typeof waitForProviderReadiness;
  facilitatorSupport?: typeof fetchHederaFacilitatorSupport;
}

function matchesRequirement(requirement: PaymentRequirements, selected: Candidate): boolean {
  return requirement.scheme === "exact"
    && requirement.network === "hedera:testnet"
    && requirement.asset === "0.0.0"
    && requirement.amount === selected.offer.amount
    && requirement.payTo === selected.metadata.recipient
    && requirement.extra.paymentFlow === "upfront";
}

export async function createRoutePreview(
  config: RuntimeConfig,
  providerNames: readonly string[],
  maxSpendTinybars: bigint,
  capability: Capability,
  dependencies: PreviewDependencies = {}
): Promise<RoutePreview> {
  if (maxSpendTinybars <= 0n || maxSpendTinybars > config.MAX_SPEND_PER_REQUEST_TINYBARS) {
    throw new HttpError("INVALID_BUDGET", "Budget must be positive and cannot exceed the server per-request cap", 400);
  }
  const fetcher = dependencies.fetcher ?? fetch;
  const resolveMetadata = dependencies.resolveMetadata ?? resolveProviderMetadata;
  const waitUntilReady = dependencies.waitUntilReady ?? waitForProviderReadiness;
  const facilitatorSupport = dependencies.facilitatorSupport ?? fetchHederaFacilitatorSupport;
  const allowedOrigins = new Set(config.PROVIDER_ALLOWED_ORIGINS.map((origin) => new URL(origin).origin));
  const candidates: Candidate[] = [];
  const unavailable: Array<{ name: string; reason: string }> = [];
  const readiness: Array<{ name: string; attempts: number; waitedMs: number }> = [];

  for (const name of providerNames) {
    try {
      let metadata = await resolveMetadata(name, config.ENS_RPC_URL);
      let wakeResult: Awaited<ReturnType<typeof waitForProviderReadiness>> | undefined;
      let stableEndpoint = false;
      for (let endpointCheck = 0; endpointCheck < 2; endpointCheck += 1) {
        const initialBase = validateServiceEndpoint(metadata.endpoint, allowedOrigins, config.NODE_ENV === "development");
        const initialOfferUrl = new URL(`${initialBase.pathname.replace(/\/$/, "")}/offer`, initialBase.origin);
        wakeResult = await waitUntilReady(initialOfferUrl, { fetcher });
        const refreshed = await resolveMetadata(name, config.ENS_RPC_URL);
        if (refreshed.endpoint === metadata.endpoint) {
          metadata = refreshed;
          stableEndpoint = true;
          break;
        }
        metadata = refreshed;
      }
      if (!stableEndpoint || !wakeResult) throw new Error("provider endpoint changed during readiness");
      const base = validateServiceEndpoint(metadata.endpoint, allowedOrigins, config.NODE_ENV === "development");
      const offerUrl = new URL(`${base.pathname.replace(/\/$/, "")}/offer`, base.origin);
      offerUrl.searchParams.set("capability", capability);
      const offerResponse = await fetcher(offerUrl, { redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!offerResponse.ok) throw new Error("provider offer unavailable");
      candidates.push({ metadata, offer: providerOfferSchema.parse(await offerResponse.json()) });
      readiness.push({ name, attempts: wakeResult.attempts, waitedMs: wakeResult.waitedMs });
    } catch {
      unavailable.push({ name, reason: "provider unavailable during readiness" });
    }
  }

  const selection = selectCheapestEligible(candidates, maxSpendTinybars, allowedOrigins, capability);
  if (!selection.selected) {
    throw new HttpError("NO_ELIGIBLE_PROVIDER", "No eligible provider is currently available within this budget", 422, true);
  }
  const selected = selection.selected;
  const providerBase = new URL(selected.metadata.endpoint);
  const executePath = capability === "invoice-qa" ? "/qa" : "/extract";
  const executeUrl = new URL(`${providerBase.pathname.replace(/\/$/, "")}${executePath}`, providerBase.origin);
  validateServiceEndpoint(executeUrl.toString(), allowedOrigins, config.NODE_ENV === "development");

  const [support, paymentResponse] = await Promise.all([
    facilitatorSupport(config.BLOCKY402_FACILITATOR_URL, fetcher),
    fetcher(executeUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": randomUUID() },
      body: JSON.stringify({ proof: "browser-prepayment-readiness" }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000)
    })
  ]);
  if (paymentResponse.status !== 402) {
    throw new HttpError("PAYMENT_REQUIREMENTS_UNAVAILABLE", "Provider did not return payment requirements", 502, true);
  }
  const header = paymentResponse.headers.get("payment-required");
  if (!header) throw new HttpError("PAYMENT_REQUIREMENTS_UNAVAILABLE", "Provider omitted payment requirements", 502, true);
  const paymentRequired = decodePaymentRequiredHeader(header);
  const paymentRequirement = paymentRequired.accepts.find((requirement) => matchesRequirement(requirement, selected));
  if (paymentRequired.x402Version !== 2 || !paymentRequirement) {
    throw new HttpError("QUOTE_CHANGED", "Provider payment terms differ from the selected ENS metadata and offer", 409, true);
  }

  return {
    selected,
    executeUrl: executeUrl.toString(),
    paymentRequired,
    paymentRequirement,
    readiness,
    excluded: selection.excluded,
    unavailable,
    facilitator: { url: config.BLOCKY402_FACILITATOR_URL, ...support },
    validatedAt: new Date().toISOString()
  };
}
