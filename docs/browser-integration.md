# Browser UI integration contract

The checked-in web app is a deliberately small integration harness. A replacement UI should import or preserve the contract in `apps/web/lib/agentpay.ts`; it should not duplicate payment policy or access backend secrets.

## Required environment

Set `NEXT_PUBLIC_API_BASE_URL` to the public Express origin. This is the only browser-exposed runtime value. Keep database, Gemini, ENS RPC, demo-code, session-secret, and private-key values server-only.

The API must set `WEB_ORIGIN` to the exact deployed UI origin. Browser state-changing requests use that Origin, a signed HttpOnly cookie, and the CSRF token returned by the session endpoints.

## UI sequence

1. Call `AgentPayApi.unlock(code)` and retain the CSRF state inside the adapter.
2. Select one local PNG/JPEG and call `preview(task, budget)`. Preview wakes the provider, re-resolves ENS, obtains a fresh offer, and checks the unsigned x402 terms. It does not upload the invoice or reserve funds.
3. Connect a Hedera Testnet wallet through a UI-owned `HederaBrowserWalletAdapter` and obtain its `0.0.x` payer account ID.
4. Generate one idempotency key for this logical submission and reuse it for all retries of `createRun(...)`. The server persists the image and atomically reserves the selected tinybar amount, but still does not sign or pay.
5. Display the returned network, asset, amount, recipient, provider, and expiry. Pass only its `paymentRequired` value to `createPaymentSignature(...)` after explicit user approval.
6. Send the resulting encoded x402 `PAYMENT-SIGNATURE` value to `execute(...)` once. The backend verifies the exact payer/recipient/amount/network before forwarding it to the selected endpoint.
7. Poll `getRun(...)` or use the controls below. Never generate another signature because a request timed out.

## Wallet hook

The temporary harness looks for this replaceable interface:

```ts
interface HederaBrowserWalletAdapter {
  connect(): Promise<{ accountId: string }>;
  createPaymentSignature(paymentRequired: unknown): Promise<string>;
}

window.agentPayWallet = yourAdapter;
```

The adapter must use a Hedera Testnet account and return the x402 v2 encoded header value for the exact server-supplied requirements. It must not expose a private key to AgentPay, silently switch to mainnet, edit payment terms, or accept an arbitrary URL. The specific HashPack/WalletConnect adapter belongs in the later prebuilt UI integration because it depends on that UI's chosen wallet SDK and connection lifecycle.

## Recovery controls

- `cancel(runId)` works only while the reservation is unsigned and releases it.
- `reconcile(runId)` checks the already recorded Hedera transaction. A Mirror Node 404 remains `UNKNOWN`; it does not release budget or authorize another payment.
- `recover(runId)` works only after settlement when extraction has no result. It uses the retained input, an execution lease, and one model attempt without constructing a payment.
- `getRun(runId)` is session-owned. A transaction reference is never authentication.

The server applies exact Origin/CORS checks, signed two-hour sessions, CSRF validation, bounded upload parsing, request throttling, durable idempotency, database budget locks, and structured errors. The minimal harness intentionally contains no styling system, wallet vendor dependency, or product navigation so it can be replaced cleanly.
