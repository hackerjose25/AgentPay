# AgentPay

**Autonomous AI agent marketplace with x402 pay-per-inference on Hedera**

Instead of pre-purchasing API keys or subscription quotas, AgentPay lets AI agents discover, evaluate, and pay for model inference directly from their own Hedera wallet — one request at a time, on-chain, with no middleman taking a cut. An agent finds a service, pays HBAR via the x402 protocol, gets the inference result, and both sides have a cryptographically verifiable receipt. No subscriptions. No API key management. No human in the loop for every call.

---

## Table of Contents

1. [Problem](#1-problem)
2. [Solution](#2-solution)
3. [How It Works — Full Technical Flow](#3-how-it-works--full-technical-flow)
4. [x402 Protocol Deep Dive](#4-x402-protocol-deep-dive)
5. [Architecture Overview](#5-architecture-overview)
6. [Tech Stack — What We Use and Why](#6-tech-stack--what-we-use-and-why)
7. [Frontend — Pages, Design, and User Flow](#7-frontend--pages-design-and-user-flow)
8. [Backend — Services, APIs, and Integration](#8-backend--services-apis-and-integration)
9. [Smart Contracts](#9-smart-contracts)
10. [How Everything Connects](#10-how-everything-connects)
11. [Demo Structure](#11-demo-structure)
12. [Honest Limitations](#12-honest-limitations)
13. [Research and Prior Art](#13-research-and-prior-art)
14. [Docs and References](#14-docs-and-references)

---

## 1. Problem

When an AI agent needs to call an external model — a language model, a vision model, a specialized inference endpoint — the current workflow forces a human into the loop:

1. **Human signs up** for an AI provider (OpenAI, Anthropic, etc.)
2. **Human provides payment** (credit card, UPI, subscription)
3. **Human gets an API key** and manually injects it into the agent's environment
4. **Agent uses the key** until the quota runs out, the card expires, or the human revokes it

This breaks the promise of autonomous agents. The agent can't:
- **Discover** which services exist and what they cost
- **Pay** for a single inference without a pre-existing account
- **Prove** it paid — there's no on-chain receipt, just a private billing dashboard
- **Switch providers** mid-task based on price or availability

Three concrete patterns this creates:

**Pattern 1 — The API key bottleneck.** An agent hits its rate limit on Provider A. It can't autonomously switch to Provider B because a human needs to sign up, add a card, and rotate the key. The agent stalls.

**Pattern 2 — The subscription trap.** An agent needs 50 inference calls per day. The cheapest plan is $20/month for unlimited calls. The agent pays $20/month for what it actually uses once. No pay-per-request option exists.

**Pattern 3 — The trust gap.** An orchestrator hires 10 agents. Each agent calls paid services. The orchestrator has no way to verify which agents actually paid, which services were consumed, and whether the charges match the work delivered. Everything is trust-the-dashboard.

In all three cases, the human is the payment layer. And once the agent is running, there's no on-chain record of what was consumed — the next team that deploys it starts from zero information, every time.

---

## 2. Solution

AgentPay builds a marketplace where AI services expose x402-gated endpoints and AI agents pay for them directly from a Hedera wallet — no API keys, no subscriptions, no human intervention per call.

A three-layer architecture sits between the agent and the model provider:

- **Service Registry** — providers list their x402-gated endpoints with pricing, capabilities, and uptime history. Agents query this to discover what's available and what it costs.
- **x402 Payment Layer** — when an agent hits a gated endpoint, the server responds with HTTP 402 Payment Required and a payment request. The agent's wallet signs and submits the HBAR payment via Hedera. The Blocky402 facilitator confirms payment, and the service delivers the inference result.
- **Agent Wallet** — each agent has its own Hedera account funded with HBAR. It signs its own payments, maintains its own balance, and builds a verifiable on-chain history of every service it consumed.

Once a payment is confirmed, the transaction is visible on Hedera's public explorer — anyone can verify that this agent paid this service at this time for this inference. Over time, this builds a portable, auditable record of agent behavior that no private billing dashboard can match.

**The payment is the proof. The agent is the payer. The chain is the receipt. This is the part that doesn't exist anywhere else today.**

---

## 3. How It Works — Full Technical Flow

### Step 1 — Provider registers an x402-gated service

A model provider deploys an inference endpoint (e.g., `/v1/inference`) and wraps it with x402 middleware. The service advertises its price per request in HBAR, its capabilities, and a description. This gets registered in the Service Registry contract on Hedera Testnet.

### Step 2 — Agent discovers available services

The agent (or its orchestrator) queries the Service Registry for available endpoints. The registry returns a list of services with their prices, supported models, and on-chain identity — the agent can evaluate options before choosing one.

### Step 3 — Agent requests inference

The agent sends a standard HTTP request to the chosen service endpoint. The x402 middleware intercepts it and responds with `HTTP 402 Payment Required`, including:
- The amount of HBAR to pay
- The payment recipient (service provider's Hedera account)
- A unique payment reference tying this request to this inference

### Step 4 — Agent pays via Hedera

The agent's wallet constructs a Hedera transfer transaction, signs it with its private key, and submits it to the Hedera network. The Blocky402 facilitator monitors for the payment and confirms it to the service provider.

### Step 5 — Service delivers the inference

Once payment is confirmed (typically within 1-2 seconds on Hedera), the x402 middleware releases the request to the actual inference endpoint. The model processes the input and returns the result to the agent.

### Step 6 — On-chain receipt

Both the payment transaction and a lightweight attestation (agent ID, service ID, timestamp, cost) are recorded on Hedera. This is permanent, public, and independently verifiable — anyone can look up an agent's payment history without trusting AgentPay's dashboard.

### Step 7 — Agent continues or switches

The agent uses the inference result and, if needed, discovers and pays for the next service autonomously — no human in the loop, no key rotation, no quota anxiety.

---

## 4. x402 Protocol Deep Dive

The x402 protocol reimagines HTTP 402 ("Payment Required") as a machine-readable payment gate:

| Component | Role |
|---|---|
| **HTTP 402** | Server responds with payment requirements when an unauthenticated request hits a gated endpoint |
| **Payment Request** | Structured payload: amount, currency, recipient, reference, expiry |
| **Blocky402 Facilitator** | Mediates between payer and payee — verifies payment, confirms to the service, handles refunds if service fails |
| **Hedera Network** | The settlement layer — fast (3-5s finality), low-cost (< $0.01 per transaction), public and auditable |

Why Hedera for x402:
- **Sub-second finality** — agents don't wait 10 minutes for confirmations
- **Microsecond costs** — paying $0.001 per inference is economically viable
- **aBFT consensus** — Byzantine fault tolerant, not "probabilistically final"
- **Native HTS (Hedera Token Service)** — HBAR transfers are first-class, not smart contract calls

---

## 5. Architecture Overview

```
+------------------------------------------------------------+
|                    FRONTEND (Dashboard)                     |
|   Service Browser · Agent Wallet · Payment History · Demo   |
+----------------------+---------------------------------------+
                       | HTTP / REST
+----------------------v---------------------------------------+
|                  BACKEND (Registry · Router ·               |
|                          Payment Coordinator)               |
+------+--------------------------+-----------------------------+
       |                          |
+------v------+           +-------v--------+
|  SERVICE    |           |  HEDERA        |
|  REGISTRY   |           |  NETWORK       |
|  (on-chain) |           |  (x402 + HBAR) |
+-------------+           +----------------+
       |
+------v-------------------------------------------------------+
|             BLOCKY402 FACILITATOR                            |
|     Payment verification · Service unlock · Refund handling   |
+-----------------------------------------------------------------+
       |
+------v-------------------------------------------------------+
|             AI INFERENCE ENDPOINTS                            |
|     x402-gated model providers · Pay-per-request             |
+-----------------------------------------------------------------+
```

---

## 6. Tech Stack — What We Use and Why

### Hedera Testnet
The settlement layer for all agent payments. chosen for sub-second finality, micro-cost transactions, and a reliable public faucet for demo purposes.

| Hedera Testnet detail | Value |
|---|---|
| Chain ID | `296` |
| Public RPC | `https://hashio.io/api` |
| Block explorer | `https://hashscan.io/testnet` |
| Faucet | `https://portal.hedera.com/faucet` |

### x402 Protocol + Blocky402
The payment standard and facilitator that make HTTP 402 a real, machine-negotiable payment gate. Blocky402 handles payment verification and service unlock — we don't reimplement settlement logic.

### Hedera SDK (JavaScript/TypeScript)
Used by both the backend (to register services, manage the registry) and the agent wallet (to sign and submit payments). Official SDK, not a community wrapper.

### LLM Inference Endpoints
The actual AI services that agents pay for. We demonstrate with:
- A self-hosted lightweight model endpoint (for the demo — deterministic, no external API key needed)
- An x402-gated wrapper around a hosted model (to show real pay-per-request)

### Express.js Backend
REST API layer that coordinates service discovery, payment verification, and inference routing. Lightweight, well-understood, fast to build.

### React Frontend
Dashboard for browsing services, managing agent wallets, viewing payment history, and running the live demo.

---

## 7. Frontend — Pages, Design, and User Flow

### Design Principles
Dark, clean, Web3-native aesthetic. Color reserved for status only: green (payment confirmed), amber (pending), red (failed). Wallet addresses and transaction hashes in monospace; labels in sans-serif.

### Page 1 — Service Browser
Grid of available x402-gated services. Each card shows: service name, description, price per inference in HBAR, provider identity, and uptime. Agent can select a service to view details and initiate a payment flow.

### Page 2 — Agent Wallet
Shows the agent's Hedera account: current HBAR balance, recent transactions, and a history of services consumed. Each entry shows: service name, cost, timestamp, and a link to the Hedera explorer transaction.

### Page 3 — Payment History
Full audit trail of every x402 payment: agent ID, service ID, amount, timestamp, transaction hash. Filterable by agent, service, date range. This is the portable, on-chain reputation — not a private log.

### Page 4 — Live Demo
Two panels side-by-side:
- **Left**: Agent wallet with initial balance, service browser showing available endpoints
- **Right**: Live Hedera explorer showing transactions as they happen
- A "Run Agent" button triggers the full flow: agent discovers service, pays, receives inference, transaction appears on-chain in real time

### Page 5 — How It Works
Static explainer: the problem with API keys and subscriptions, how x402 works, why on-chain receipts matter, and how this enables truly autonomous agents.

---

## 8. Backend — Services, APIs, and Integration

### Endpoints

**`GET /api/services`** — List all registered x402-gated services with pricing and metadata.

**`POST /api/services`** — Register a new x402-gated service (provider-only).

**`POST /api/pay`** — Initiate an x402 payment request for a specific service. Returns the payment details (amount, recipient, reference) for the agent to sign.

**`POST /api/verify`** — Verify that a payment transaction was confirmed on Hedera. Returns the attestation and unlocks the service.

**`POST /api/inference`** — x402-gated inference endpoint. Responds with HTTP 402 if payment is not confirmed; returns the inference result if payment is verified.

**`GET /api/agents/:id/history`** — Pull an agent's full on-chain payment history for display.

### Data Flow

Agent sends request → x402 middleware intercepts → responds with 402 + payment details → agent pays via Hedera → Blocky402 confirms → middleware unlocks service → inference delivered → on-chain attestation recorded.

### Environment Variables

```
# Hedera Testnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...        # funded via Hedera faucet, server-side only
HEDERA_NETWORK=testnet
HEDERA_CHAIN_ID=296

# x402
BLOCKY402_FACILITATOR_URL=https://...
X402_SERVICE_PRICE_HBAR=0.001     # price per inference in HBAR

# LLM
INFERENCE_ENDPOINT_URL=http://localhost:3001/v1/inference
INFERENCE_MODEL=local-model

# Server
PORT=3000
```

`HEDERA_PRIVATE_KEY` is never exposed to the frontend — all signing happens server-side or in the agent's own wallet. The server-side key funds the Service Registry operations only.

---

## 9. Smart Contracts

### ServiceRegistry.sol

**Stored per service:**
```
serviceId: address
name: string
description: string
pricePerRequest: uint256    // in HBAR (tinybars)
endpoint: string
registeredAt: uint256
active: bool
```

**Events:**
- `ServiceRegistered(serviceId, name, price, timestamp)`
- `ServiceUpdated(serviceId, field, value, timestamp)`

**Functions:**
- `registerService(string name, string description, uint256 price, string endpoint)` — registers a new x402-gated service
- `updateService(uint256 serviceId, ...)` — update service metadata or pricing
- `deactivateService(uint256 serviceId)` — take a service offline
- `getService(uint256 serviceId) returns (Service)` — public view function
- `listActiveServices() returns (Service[])` — returns all active services

### EfficiencyAttestation.sol (optional, for agent reputation)

**Stored per attestation:**
```
agentId: address
serviceId: address
cost: uint256
timestamp: uint256
success: bool
```

**Events:**
- `InferenceAttested(agentId, serviceId, cost, timestamp)`

**Functions:**
- `attestInference(address agentId, address serviceId, uint256 cost, bool success)` — records a completed, paid inference
- `getAgentHistory(address agentId) returns (Attestation[])` — public, queryable by anyone

These contracts are intentionally small. The goal is genuine, verifiable public records — not a large or novel cryptographic system built under time pressure.

---

## 10. How Everything Connects

**Frontend → Backend**: dashboard calls backend REST endpoints only; no direct chain or inference access from the browser.

**Backend → Chain**: Service Registry reads and writes happen through the Hedera SDK against the testnet.

**Backend → x402**: payment requests are coordinated through the Blocky402 facilitator, which monitors Hedera for confirmed transactions.

**Backend → Inference**: x402-gated endpoints are proxied through the backend; the agent never calls the model directly (the payment gate is the backend).

**Chain → Frontend**: agent payment history and service details are read directly from the contract (or a simple indexer) so the public record is visibly independent of AgentPay's own database.

---

## 11. Demo Structure

**Minute 1 — Show the landscape.** Open the Service Browser. Point out three available x402-gated services with different prices. Show the agent's wallet with a starting HBAR balance. Nothing has happened yet.

**Minute 2 — Trigger autonomous payment.** Click "Run Agent." Watch the agent discover a service, construct the payment, sign it, and submit to Hedera. The right panel shows the transaction landing on HashScan in real time — a permanent, public record of this exact payment.

**Minute 3 — Show the inference result.** The service unlocks after payment confirmation. The inference result appears. Point out: no API key was used, no subscription was pre-purchased, no human approved this specific call.

**Minute 4 — Show the receipt.** Open the agent's payment history. Show the on-chain attestation: agent ID, service ID, cost, timestamp. Click through to HashScan to verify independently. This is the portable reputation — not a private log.

**Minute 5 — Switch providers autonomously.** The agent hits a rate limit on Service A. It autonomously discovers Service B, evaluates the price, pays, and continues — no human intervention, no key rotation.

Closing line: *"API keys make agents dependent on humans. x402 makes agents independent — and every payment is a public, verifiable receipt."*

---

## 12. Honest Limitations

This is a testnet proof-of-concept, not a production payment platform. The x402 integration follows the protocol specification; it is not a claim of formal certification with a still-maturing standard. The demo compresses time: agent wallet funding, service registration, and payment flow happen within minutes — in production, these would span days or weeks of normal operation. The on-chain attestation records payment events; it does not capture inference quality, latency, or correctness — those are separate concerns. Hedera Testnet has known faucet rate limits; live demos should pre-fund wallets. The Blocky402 facilitator is a third-party dependency; its availability during the demo is outside our control.

---

## 13. Research and Prior Art

AI agent payment infrastructure is an emerging space. Current approaches fall into three categories:

**Traditional API keys** (OpenAI, Anthropic, Google) — the agent needs a human to provision and manage the key. No machine-negotiable payment. No on-chain proof.

**Crypto payment rails** (Request Network, Superfluid) — enable crypto payments but don't integrate with the HTTP layer. The agent still needs off-chain coordination to match payments to requests.

**x402 + Hedera** — the protocol that makes HTTP 402 a real, machine-negotiable payment gate on a network fast and cheap enough for micropayments. AgentPay's contribution is building the complete agent-facing marketplace on top of this stack: discovery, payment, verification, and reputation — not just the payment rail.

ERC-8004 defines Identity, Reputation, and Validation registries for agents. AgentPay's optional EfficiencyAttestation contract mirrors this pattern for payment behavior — recording which agents paid for which services, permanently and publicly.

---

## 14. Docs and References

| Topic | URL |
|---|---|
| Hedera Testnet | `https://docs.hedera.com/hedera-api/testnet` |
| Hedera SDK (JS/TS) | `https://github.com/hashgraph/hedera-sdk-js` |
| x402 Protocol | `https://x402.org` |
| Blocky402 Facilitator | `https://github.com/blocky402/x402` |
| HTTP 402 Specification | `https://tools.ietf.org/html/rfc7231#section-6.5.2` |
| Hedera Portal (Faucet) | `https://portal.hedera.com/faucet` |
| HashScan Explorer | `https://hashscan.io/testnet` |
| ERC-8004 | `https://eips.ethereum.org/EIPS/eip-8004` |
| ETHOnline 2026 | `https://ethglobal.com` |

---

*Built for ETHOnline 2026 — Track: Hedera AI & Agentic Payments*
*AgentPay — agents that pay for themselves, and prove it on-chain.*
