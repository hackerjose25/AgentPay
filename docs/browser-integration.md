# Browser UI integration contract

The checked-in web app is a deliberately small integration harness. A replacement UI should import or preserve the contract in `apps/web/lib/agentpay.ts`; it should not duplicate payment policy or access backend secrets.

## Required environment

Set `NEXT_PUBLIC_API_BASE_URL` to the public Express origin and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to the public project identifier created in the Reown dashboard. For local development, put those two values in the ignored `apps/web/.env.local`; for a deployed frontend, set them in its build environment. Keep database, Gemini, ENS RPC, demo-code, session-secret, and private-key values server-only.

The API must set `WEB_ORIGIN` to the exact deployed UI origin. Browser state-changing requests use that Origin, a signed HttpOnly cookie, and the CSRF token returned by the session endpoints.

## UI sequence

1. Call `AgentPayApi.unlock(code)` and retain the CSRF state inside the adapter.
2. Select one local PNG/JPEG and call `preview(task, budget)`. Preview wakes the provider, re-resolves ENS, obtains a fresh offer, and checks the unsigned x402 terms. It does not upload the invoice or reserve funds.
3. Choose **Connect HashPack** and scan the displayed WalletConnect QR with HashPack mobile. The built-in adapter requests only `hedera:testnet` and `hedera_signTransaction`, rejects a non-HashPack peer, and returns its `0.0.x` payer account ID.
4. Generate one idempotency key for this logical submission and reuse it for all retries of `createRun(...)`. The server persists the image and atomically reserves the selected tinybar amount, but still does not sign or pay.
5. Display the returned network, asset, amount, recipient, provider, and expiry. Pass only its `paymentRequired` value to `createPaymentSignature(...)` after explicit user approval.
6. Send the resulting encoded x402 `PAYMENT-SIGNATURE` value to `execute(...)` once. The backend verifies the exact payer/recipient/amount/network before forwarding it to the selected endpoint.
7. Poll `getRun(...)` or use the controls below. Never generate another signature because a request timed out.

## Wallet hook

The temporary harness looks for this replaceable interface:

```ts
interface HederaBrowserWalletAdapter {
  connect(options?: { onPairingUri?(uri: string): void }): Promise<{ accountId: string }>;
  createPaymentSignature(paymentRequired: unknown): Promise<string>;
  disconnect?(): Promise<void>;
}

window.agentPayWallet = yourAdapter;
```

`apps/web/lib/hashpack-wallet.ts` now installs the built-in implementation. It uses a custom QR presentation and the Hedera WalletConnect sign-only method; it never calls the wallet's sign-and-execute method. `apps/web/lib/hedera-wallet-payment.ts` rejects non-v2, multiple-choice, non-exact, non-Testnet, non-HBAR, non-upfront, zero, or malformed terms before asking HashPack to sign. The server revalidates the encoded x402 header before forwarding it.

A replacement UI can continue using this interface or instantiate `HashPackWalletAdapter` itself. It must display the server-returned amount, recipient, provider, network, and expiry before calling `createPaymentSignature`. Never expose a wallet private key, silently switch to mainnet, edit payment terms, accept an arbitrary destination URL, or use `hedera_signAndExecuteTransaction`; Blocky402 remains the only transaction submitter.

## HashPack setup

1. Create a free project at `https://dashboard.reown.com`, add the local/deployed frontend origins, and copy its project ID.
2. Install HashPack mobile and create or import the funded **payer** account on Hedera Testnet. Alpha and Beta remain recipient accounts and do not connect to the browser.
3. Create the ignored `apps/web/.env.local`:

   ```dotenv
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_REOWN_PROJECT_ID
   ```

4. Restart `npm run dev`, unlock the demo, preview a route, click **Connect HashPack**, and scan the QR from HashPack's WalletConnect scanner.

Creating a connection and previewing a route do not spend HBAR. Creating a payment intent reserves budget but does not spend. The **Sign and execute** action prompts HashPack and may settle the exact Testnet HBAR payment, so use it only for the deliberately authorized paid smoke test.

## Recovery controls

- `cancel(runId)` works only while the reservation is unsigned and releases it.
- `reconcile(runId)` checks the already recorded Hedera transaction. A Mirror Node 404 remains `UNKNOWN`; it does not release budget or authorize another payment.
- `recover(runId)` works only after settlement when extraction has no result. It uses the retained input, an execution lease, and one model attempt without constructing a payment.
- `getRun(runId)` is session-owned. A transaction reference is never authentication.

The server applies exact Origin/CORS checks, signed two-hour sessions, CSRF validation, bounded upload parsing, request throttling, durable idempotency, database budget locks, and structured errors. The minimal harness intentionally contains no styling system or product navigation; its wallet adapter remains isolated behind the replaceable interface above.
