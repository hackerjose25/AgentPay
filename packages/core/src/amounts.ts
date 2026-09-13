import { z } from "zod";

export const tinybarStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "must be an unsigned base-10 integer")
  .refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), {
    message: "amount exceeds the supported safe integer boundary"
  });

export function parseTinybars(value: string): bigint {
  return BigInt(tinybarStringSchema.parse(value));
}

export function formatTinybars(value: bigint): string {
  if (value < 0n) {
    throw new RangeError("tinybar amount cannot be negative");
  }
  return value.toString(10);
}

export function isWithinBudget(amount: bigint, remainingBudget: bigint): boolean {
  return amount >= 0n && amount <= remainingBudget;
}

