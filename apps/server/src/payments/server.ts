import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import type { RuntimeConfig } from "../config.js";

export function createProviderPaymentMiddleware(config: RuntimeConfig) {
  const facilitator = new HTTPFacilitatorClient({ url: config.BLOCKY402_FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitator).register(
    "hedera:testnet",
    new ExactHederaScheme({
      defaultAssets: { "hedera:testnet": { asset: "0.0.0", decimals: 8 } }
    })
  );

  return paymentMiddleware(
    {
      "POST /providers/alpha/extract": {
        accepts: {
          scheme: "exact",
          price: { asset: "0.0.0", amount: config.ALPHA_PRICE_TINYBARS.toString() },
          network: "hedera:testnet",
          payTo: config.ALPHA_RECIPIENT_ACCOUNT_ID,
          maxTimeoutSeconds: 60,
          extra: { paymentFlow: "upfront" }
        },
        description: "AgentPay Day 1 paid-path proof for provider alpha",
        mimeType: "application/json"
      },
      "POST /providers/beta/extract": {
        accepts: {
          scheme: "exact",
          price: { asset: "0.0.0", amount: config.BETA_PRICE_TINYBARS.toString() },
          network: "hedera:testnet",
          payTo: config.BETA_RECIPIENT_ACCOUNT_ID,
          maxTimeoutSeconds: 60,
          extra: { paymentFlow: "upfront" }
        },
        description: "AgentPay Day 1 paid-path proof for provider beta",
        mimeType: "application/json"
      }
    },
    resourceServer
  );
}

