import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createClientHederaSigner, inspectHederaTransaction, PrivateKey } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

export interface ExpectedPayment {
  endpoint: URL;
  amount: string;
  asset: "0.0.0";
  network: "hedera:testnet";
  recipient: string;
  payerAccountId: string;
  payerPrivateKey: string;
  requestId: string;
}

export interface PaymentCallbacks {
  onSigned?: (transactionId: string) => Promise<void>;
  onSettled?: (settlement: SettleResponse) => Promise<void>;
  onAmbiguous?: (error: Error) => Promise<void>;
}

export function exactlyMatches(requirement: PaymentRequirements, expected: ExpectedPayment): boolean {
  return requirement.scheme === "exact"
    && requirement.network === expected.network
    && requirement.asset === expected.asset
    && requirement.amount === expected.amount
    && requirement.payTo === expected.recipient
    && requirement.extra.paymentFlow === "upfront";
}

export async function executeExpectedPayment(
  expected: ExpectedPayment,
  body: BodyInit,
  contentType: "application/json" | "image/png" | "image/jpeg",
  callbacks: PaymentCallbacks = {}
): Promise<Response> {
  if (expected.endpoint.protocol !== "https:" && expected.endpoint.hostname !== "localhost") {
    throw new Error("paid endpoint must use HTTPS outside localhost");
  }
  const signer = createClientHederaSigner(
    expected.payerAccountId,
    PrivateKey.fromStringECDSA(expected.payerPrivateKey),
    { network: "hedera:testnet" }
  );
  let signedAttemptPersisted = false;
  const client = new x402Client()
    .register("hedera:testnet", new ExactHederaScheme(signer))
    .setSpendControls({
      maxAmountPerPayment: false,
      allowedAssets: [{
        network: "hedera:testnet",
        asset: "0.0.0",
        maxAmountPerPayment: expected.amount
      }]
    })
    .registerPolicy((_version, requirements) => requirements.filter((requirement) => exactlyMatches(requirement, expected)))
    .onBeforePaymentCreation(({ selectedRequirements }) => Promise.resolve(
      exactlyMatches(selectedRequirements, expected)
        ? undefined
        : { abort: true as const, reason: "QUOTE_CHANGED" }
    ))
    .onAfterPaymentCreation(async ({ paymentPayload }) => {
      const transaction = paymentPayload.payload.transaction;
      if (typeof transaction !== "string") throw new Error("signed Hedera payload has no transaction");
      const inspected = inspectHederaTransaction(transaction);
      await callbacks.onSigned?.(inspected.transactionId);
      signedAttemptPersisted = true;
    })
    .onPaymentResponse(async ({ settleResponse, error }) => {
      if (settleResponse?.success) await callbacks.onSettled?.(settleResponse);
      else if (settleResponse || error) {
        await callbacks.onAmbiguous?.(error ?? new Error(settleResponse?.errorReason ?? "settlement did not succeed"));
      }
    });

  const paidFetch = wrapFetchWithPayment(fetch, client);
  try {
    return await paidFetch(expected.endpoint, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "idempotency-key": expected.requestId,
        "x-request-id": expected.requestId
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(90_000)
    });
  } catch (error) {
    if (signedAttemptPersisted) {
      await callbacks.onAmbiguous?.(error instanceof Error ? error : new Error("paid request failed after signing"));
    }
    throw error;
  }
}
