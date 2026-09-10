# Day 1 implementation evidence

Recorded September 10, 2026. `HISTORY.md` is the canonical action log; this file keeps the concise technical evidence referenced by it.

## Implemented locally

- Node.js `22.23.2` and npm `10.9.8` project contract.
- npm workspaces for `apps/web`, `apps/server`, and `packages/core`.
- Strict shared Zod schemas, integer-tinybar helpers, and deterministic provider selection.
- Express server with public offers and x402-protected Day 1 proof routes.
- Next.js console shell.
- PostgreSQL migration for directory, runs, requests, payments, reservations, payer locks, reconciliation, idempotency, and execution leases.
- ENSv2 text-record resolution and an existing-name Sepolia record update script that discovers the active resolver.
- Read-only readiness, ENS verification, enrollment, migration, and testnet smoke command interfaces.
- A fictional PNG invoice fixture and expected extraction JSON.

## Versions pinned and inspected

| Dependency | Version |
|---|---:|
| Node.js | 22.23.2 |
| TypeScript | 5.9.3 |
| Next.js | 16.3.4 |
| Express | 5.2.1 |
| viem | 2.56.3 |
| `@x402/core` | 2.25.0 |
| `@x402/fetch` | 2.25.0 |
| `@x402/express` | 2.25.0 |
| `@x402/hedera` | 2.25.0 |
| PostgreSQL client (`pg`) | 8.23.0 |

The x402 packages are Apache-2.0. No Hedera inference starter code was copied. The local implementation was written against the installed package declarations and lifecycle source. ENS behavior was checked against the official ENSv2 application and readiness documentation.

## Verified

- `npm ci`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 4 files and 7 tests passed.
- `npm run test:e2e`: 1 scaffold test passed; this is not yet the later-day browser journey.
- `npm run build`: passed for core, server, and web.
- Live `GET https://api.testnet.blocky402.com/supported`: the local parser confirmed exact x402 v2 for `hedera:testnet` and advertised fee payer `0.0.7162784`.
- Local dummy-account server check: `/health` returned testnet configuration, `/providers/alpha/offer` returned an integer-tinybar HBAR offer, and an unsigned `/providers/alpha/extract` request returned HTTP 402 with matching x402 v2 terms and `paymentFlow: upfront`.

## Not yet verified

- No PostgreSQL target was supplied, so migration execution and transaction-level reservation behavior were not live-tested.
- No owned Sepolia name, RPC, owner/operator key, or authorized record target was supplied, so no ENS write/read proof was performed.
- No funded Hedera payer, recipients, or spending bound authorization was supplied, so no signed payload, payment, or settlement was produced.
- No extraction-model endpoint was supplied; Day 1 routes return a clearly labelled payment-path proof response, not an invoice extraction result.
- `npm audit` reports 14 transitive advisories (1 moderate, 13 high), primarily through the current `@x402/hedera`/Hiero SDK dependency tree; npm reports no compatible fix for that chain. No forced overrides were applied.

## Synthetic fixture provenance

`fixtures/synthetic-invoice.png` was generated with OpenAI's built-in image generation tool for this project. Prompt summary: a clean fictional invoice for Northstar Office Labs, invoice `AP-2026-0001`, USD subtotal `100.00`, tax `18.00`, total `118.00`, visibly marked “SYNTHETIC TEST INVOICE” and “NOT A REAL BILL,” with no personal names, addresses, accounts, QR codes, or payment instructions.

