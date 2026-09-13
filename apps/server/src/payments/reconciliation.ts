import { z } from "zod";

const mirrorResponseSchema = z.object({
  transactions: z.array(z.object({ transaction_id: z.string(), result: z.string() }))
});

export type ReconciliationOutcome = "PENDING" | "SETTLED" | "FAILED";

export function toMirrorTransactionId(transactionId: string): string {
  const match = /^(0\.0\.[1-9]\d*)@(\d+)\.(\d+)$/.exec(transactionId);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  if (/^0\.0\.[1-9]\d*-\d+-\d+$/.test(transactionId)) return transactionId;
  throw new Error("invalid Hedera transaction ID");
}

export function classifyMirrorTransaction(body: unknown, transactionId: string): ReconciliationOutcome {
  const mirrorTransactionId = toMirrorTransactionId(transactionId);
  const matching = mirrorResponseSchema.parse(body).transactions.filter(
    (transaction) => transaction.transaction_id === mirrorTransactionId
  );
  if (matching.length === 0) return "PENDING";
  return matching.some((transaction) => transaction.result === "SUCCESS") ? "SETTLED" : "FAILED";
}
