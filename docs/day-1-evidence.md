# Day 1 implementation evidence

Recorded September 10, 2026. `HISTORY.md` is the canonical action log; this file keeps the concise technical evidence referenced by it.

## Implemented locally

- Node.js `22.23.2` and npm `10.9.8` project contract.
- npm workspaces for `apps/web`, `apps/server`, and `packages/core`.
- Strict shared Zod schemas, integer-tinybar helpers, and deterministic provider selection.
- Express server with public offers and x402-protected raw PNG/JPEG extraction routes.
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
| Vercel AI SDK (`ai`) | 7.0.97 |
| Google AI SDK provider (`@ai-sdk/google`) | 4.0.67 |
| Image dimension parser (`image-size`) | 2.0.2 |
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
- `npm test`: 8 files and 16 tests passed, including mocked Gemini structured output, image validation, and provider-route coverage.
- `npm run test:e2e`: 1 scaffold test passed; this is not yet the later-day browser journey.
- `npm run build`: passed for core, server, and web.
- Live `GET https://api.testnet.blocky402.com/supported`: the local parser confirmed exact x402 v2 for `hedera:testnet` and advertised fee payer `0.0.7162784`.
- Read-only readiness against the configured environment: Supabase connected successfully, the Sepolia RPC returned block `11676293`, and Blocky402 advertised compatible x402 v2 Hedera Testnet support.
- A second readiness run after the payer and recipient runtime fields were populated passed all checks: environment configuration, Supabase connectivity, Sepolia RPC at block `11679435`, and exact x402 v2 Hedera Testnet support. This validates configuration shape and connectivity, not account balances or signing authority.
- The post-integration readiness run passed environment, Supabase, Sepolia RPC at block `11680310`, Blocky402, and authenticated metadata checks for both configured Gemini adapters. Each Gemini metadata request returned HTTP 200 without invoking inference or sending invoice data.
- ENSv2 parent setup: `agentpayapp.eth` is registered on Sepolia and points to Permissioned Registry `0xB639d5947Bfe5Be7B8e82a3e3d5478f125F28cF4`, created and attached in transaction `0x2fc0008641a83725d2aa045c05d6d8f5e4fbb8ecbcd97be70db22277ffbfa50f`. ENS Explorer reports zero labels in the registry at this checkpoint.
- ENSv2 provider hierarchy: `ocr.agentpayapp.eth` points to Permissioned Registry `0x1988fD199eF04761f582672f89Be4C4DA2505750`, created and attached in transaction `0x496c8245f785dacce1e30ee7c6d66b65d3619284eb26e182645a44964ed0560a`. That registry contains `alpha.ocr.agentpayapp.eth`, created in transaction `0x89b77df704bb91515f427b6b44364f29a4df35f8cf4636bebdcf569d8ea9da95`. Alpha resolves through official Permissioned Resolver `0xaA3F591e37433968fa45c1643761a179F05698dA` and currently has zero application records.
- Local dummy-account server check: `/health` returned testnet configuration, `/providers/alpha/offer` returned an integer-tinybar HBAR offer, and an unsigned `/providers/alpha/extract` request returned HTTP 402 with matching x402 v2 terms and `paymentFlow: upfront`.
- The first Render build of Git commit `3b9dee424fa2e634ead4c3b1376f0bac8b3ae7de` failed because the production environment caused plain `npm ci` to omit TypeScript declaration packages. The Blueprint now uses `npm ci --include=dev`; an equivalent clean production-mode install followed by both backend workspace builds passed locally, and the corrected deployment subsequently succeeded.
- The corrected backend deployment is live at `https://agentpay-api-sbwi.onrender.com`: `/health` returned HTTP 200 with `hedera:testnet` and ENS chain `11155111`; `/providers/alpha/offer` returned HTTP 200 with capability `invoice-extraction`, amount `1000000`, asset `0.0.0`, network `hedera:testnet`, availability true, and a syntactically valid configured Hedera recipient.
- The Gemini-enabled deployment subsequently passed the same health and Alpha offer checks. Posting the synthetic PNG without a payment returned HTTP 402 and a `PAYMENT-REQUIRED` header, proving the deployed request still stops at the x402 boundary before inference.
- The Alpha ENS setup dry-run resolved active Permissioned Resolver `0xaA3F591e37433968fa45c1643761a179F05698dA` and prepared the seven expected records, including endpoint `https://agentpay-api-sbwi.onrender.com/providers/alpha` and Hedera Testnet recipient `0.0.10463387`. No record was written.
- Alpha's seven application records were subsequently written by the owner and resolve successfully from `alpha.ocr.agentpayapp.eth` through Permissioned Resolver `0xaA3F591e37433968fa45c1643761a179F05698dA`. The read-only smoke command selected Alpha at `1000000` tinybars and validated matching x402 v2 upfront terms and Blocky402 fee payer `0.0.7162784`.
- Hedera Mirror Node read-only checks found the configured payer and both recipient accounts on testnet as ECDSA accounts. Normalizing the public-key encodings confirmed the configured payer private key derives the public key on payer account `0.0.10463298`; no key material was printed or used to sign.
- The first authorized paid Alpha request settled on Hedera Testnet as transaction `0.0.7162784@1789113168.530015612`. Mirror Node reports `SUCCESS`: payer `0.0.10463298` transferred `1000000` tinybars to Alpha recipient `0.0.10463387`, and facilitator fee payer `0.0.7162784` paid the `265030` tinybar transaction fee. The provider then returned HTTP 500, so this is settlement evidence but not a successful extraction journey.
- The corrected Gemini 3.6 Flash revision is deployed. Read-only checks returned HTTP 200 from `/health` and Alpha's offer, while an unsigned synthetic upload returned HTTP 402 with `PAYMENT-REQUIRED`; no inference or payment was triggered.
- The paid-extraction recovery dry-run validated request `6a5f6d04-89cb-4348-8162-b834d56550e2` against its exact synthetic fixture hash, Alpha provider/payer/recipient, `1000000` tinybar amount, Hedera Testnet settlement, and consumed reservation. Recovery apply is lease-protected and cannot create a payment.
- The explicitly authorized recovery apply invoked Gemini 3.6 Flash once with the synthetic fixture and returned the expected schema-valid fields: invoice `AP-2026-0001`, date `2026-09-10`, currency `USD`, subtotal `100.00`, tax `18.00`, and total `118.00`. Supabase now records the original request as `SUCCEEDED`, with the result persisted, error and execution lease cleared, exactly one payment still present, that payment still `SETTLED`, and its reservation still `CONSUMED`. No second payment was created.

## Not yet verified

- Migration `001_initial.sql` was applied transactionally to the configured Supabase database. An immediate second run reported it already applied with the expected checksum, confirming migration-ledger idempotency. A read-only catalog check found all seven expected tables and confirmed RLS is enabled on each.
- The ENSv2 hierarchy, Alpha name, and application records are live and read back successfully. The owner's browser-wallet write proved resolver editing authority; the transaction hash was not supplied for the local evidence log.
- Transaction-level budget reservation and recovery have now been exercised against the configured Supabase database. Concurrent budget pressure, ambiguous-payment reconciliation, and crash/restart recovery still need dedicated integration coverage.
- The Hedera payer and both recipients exist, are ECDSA accounts, and have sufficient testnet balances for the configured Alpha price. The payer key-to-account public identity matches, but no signed payload, payment, or settlement has been produced.
- The deployed extraction adapter targets Gemini 3.6 Flash and validates image signatures, dimensions, size limits, and structured model output. The no-payment recovery path has now produced and persisted a real schema-valid Gemini extraction. The result recovery was run locally against the shared durable request rather than through a deployed user-facing recovery endpoint.
- `npm audit` reports 14 transitive advisories (1 moderate, 13 high), primarily through the current `@x402/hedera`/Hiero SDK dependency tree; npm reports no compatible fix for that chain. No forced overrides were applied.

## Synthetic fixture provenance

`fixtures/synthetic-invoice.png` was generated with OpenAI's built-in image generation tool for this project. Prompt summary: a clean fictional invoice for Northstar Office Labs, invoice `AP-2026-0001`, USD subtotal `100.00`, tax `18.00`, total `118.00`, visibly marked “SYNTHETIC TEST INVOICE” and “NOT A REAL BILL,” with no personal names, addresses, accounts, QR codes, or payment instructions.
