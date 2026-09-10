import { parseTinybars } from "./amounts.js";
import type { ProviderMetadata, ProviderOffer } from "./schemas.js";

export interface Candidate {
  metadata: ProviderMetadata;
  offer: ProviderOffer;
}

export interface SelectionResult {
  selected: Candidate | null;
  excluded: Array<{ name: string; reason: string }>;
}

export function selectCheapestEligible(
  candidates: readonly Candidate[],
  remainingBudgetTinybars: bigint,
  allowedOrigins: ReadonlySet<string>,
  now = new Date()
): SelectionResult {
  const eligible: Candidate[] = [];
  const excluded: Array<{ name: string; reason: string }> = [];

  for (const candidate of candidates) {
    const { metadata, offer } = candidate;
    let reason: string | null = null;

    if (!metadata.active || !offer.available) reason = "unavailable";
    else if (!allowedOrigins.has(new URL(metadata.endpoint).origin)) reason = "endpoint origin is not allowed";
    else if (metadata.network !== offer.network || metadata.asset !== offer.asset) reason = "offer network or asset differs from ENS";
    else if (metadata.recipient !== offer.recipient) reason = "offer recipient differs from ENS";
    else if (new Date(offer.expiresAt) <= now) reason = "offer expired";
    else if (parseTinybars(offer.amount) > remainingBudgetTinybars) reason = "over budget";

    if (reason) excluded.push({ name: metadata.name, reason });
    else eligible.push(candidate);
  }

  eligible.sort((left, right) => {
    const amountOrder = parseTinybars(left.offer.amount) - parseTinybars(right.offer.amount);
    if (amountOrder !== 0n) return amountOrder < 0n ? -1 : 1;
    return left.metadata.name.localeCompare(right.metadata.name);
  });

  return { selected: eligible[0] ?? null, excluded };
}

