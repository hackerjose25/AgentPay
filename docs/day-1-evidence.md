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
- Read-only readiness against the configured environment: Supabase connected successfully, the Sepolia RPC returned block `11676293`, and Blocky402 advertised compatible x402 v2 Hedera Testnet support.
- A second readiness run after the payer and recipient runtime fields were populated passed all checks: environment configuration, Supabase connectivity, Sepolia RPC at block `11679435`, and exact x402 v2 Hedera Testnet support. This validates configuration shape and connectivity, not account balances or signing authority.
- ENSv2 parent setup: `agentpayapp.eth` is registered on Sepolia and points to Permissioned Registry `0xB639d5947Bfe5Be7B8e82a3e3d5478f125F28cF4`, created and attached in transaction `0x2fc0008641a83725d2aa045c05d6d8f5e4fbb8ecbcd97be70db22277ffbfa50f`. ENS Explorer reports zero labels in the registry at this checkpoint.
- ENSv2 provider hierarchy: `ocr.agentpayapp.eth` points to Permissioned Registry `0x1988fD199eF04761f582672f89Be4C4DA2505750`, created and attached in transaction `0x496c8245f785dacce1e30ee7c6d66b65d3619284eb26e182645a44964ed0560a`. That registry contains `alpha.ocr.agentpayapp.eth`, created in transaction `0x89b77df704bb91515f427b6b44364f29a4df35f8cf4636bebdcf569d8ea9da95`. Alpha resolves through official Permissioned Resolver `0xaA3F591e37433968fa45c1643761a179F05698dA` and currently has zero application records.
- Local dummy-account server check: `/health` returned testnet configuration, `/providers/alpha/offer` returned an integer-tinybar HBAR offer, and an unsigned `/providers/alpha/extract` request returned HTTP 402 with matching x402 v2 terms and `paymentFlow: upfront`.
- The first Render build of Git commit `3b9dee424fa2e634ead4c3b1376f0bac8b3ae7de` failed because the production environment caused plain `npm ci` to omit TypeScript declaration packages. The Blueprint now uses `npm ci --include=dev`; an equivalent clean production-mode install followed by both backend workspace builds passed locally. A successful Render redeploy is still pending.

## Not yet verified

- Migration `001_initial.sql` was applied transactionally to the configured Supabase database. An immediate second run reported it already applied with the expected checksum, confirming migration-ledger idempotency. A read-only catalog check found all seven expected tables and confirmed RLS is enabled on each.
- The ENSv2 hierarchy and Alpha name are live, but the `agentpay.*` provider records have not been written or read back. The configured setup signer must still prove it can edit Alpha's Permissioned Resolver records.
- Transaction-level budget reservation, concurrency, recovery, and reconciliation behavior have not yet been exercised against the configured Supabase database.
- The Hedera payer and both recipient fields are configured and pass local syntax validation, but balances and signing authority have not been checked. No signed payload, payment, or settlement was produced.
- No extraction-model endpoint was supplied; Day 1 routes return a clearly labelled payment-path proof response, not an invoice extraction result.
- `npm audit` reports 14 transitive advisories (1 moderate, 13 high), primarily through the current `@x402/hedera`/Hiero SDK dependency tree; npm reports no compatible fix for that chain. No forced overrides were applied.

## Synthetic fixture provenance

`fixtures/synthetic-invoice.png` was generated with OpenAI's built-in image generation tool for this project. Prompt summary: a clean fictional invoice for Northstar Office Labs, invoice `AP-2026-0001`, USD subtotal `100.00`, tax `18.00`, total `118.00`, visibly marked “SYNTHETIC TEST INVOICE” and “NOT A REAL BILL,” with no personal names, addresses, accounts, QR codes, or payment instructions.
