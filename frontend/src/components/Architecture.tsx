'use client';

import { useState } from 'react';

const layers = [
  {
    num: 'LAYER 01',
    title: 'Frontend & Client SDK',
    desc: 'Autonomous agent runtime, service marketplace browser, non-custodial Hedera wallet management, and real-time transaction ledger.',
    tag: 'Next.js 16 · Turbopack',
    bgType: 'hero' as const,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    num: 'LAYER 02',
    title: 'Backend & Payment Coordinator',
    desc: 'Registry cache, REST routing engine, x402 challenge interceptor, and Blocky402 verification facilitator bridge.',
    tag: 'Node.js · REST Router',
    bgType: 'coordinator' as const,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="3" />
        <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="3" />
      </svg>
    ),
  },
  {
    num: 'LAYER 03',
    title: 'Hedera Settlement Layer',
    desc: 'Sub-second finality aBFT consensus, native HBAR micro-transfers (HTS), and ServiceRegistry.sol EVM smart contract.',
    tag: 'Chain ID 296 · ~1s Finality',
    bgType: 'hedera' as const,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    num: 'LAYER 04',
    title: 'x402 AI Inference Endpoints',
    desc: 'Pay-per-inference gateways protecting DeepSeek, Llama 3, Claude, OpenAI, and local Ollama workers with zero human subscription accounts.',
    tag: 'HTTP 402 Gated · Pay-Per-Call',
    bgType: 'x402' as const,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
];

const mockPayloads = {
  request: `// 1. Agent calls endpoint without key
POST /v1/chat/completions HTTP/1.1
Host: api.provider.ai
Content-Type: application/json

{ "model": "deepseek-r1", "prompt": "Analyze contract" }`,
  challenge: `// 2. Gateway intercepts with HTTP 402
HTTP/1.1 402 Payment Required
X-402-Version: 1.0
X-402-PayTo: 0.0.4829103
X-402-Amount: 0.05
X-402-Currency: HBAR
X-402-Nonce: 0x8f2d4e19b`,
  settlement: `// 3. Hedera settles & service unlocks
HBAR Transfer: 0.05 HBAR -> 0.0.4829103
Transaction ID: 0.0.18293@1718293812.000000000
Consensus: SUCCESS (Latency: 840ms)
Receipt: https://hashscan.io/testnet/tx/...`,
};

export default function Architecture() {
  const [activeTab, setActiveTab] = useState<'request' | 'challenge' | 'settlement'>('challenge');

  return (
    <section className="arch-section" id="architecture">
      <div className="inner">
        <div className="section-title">
          <div>
            <h2 data-scroll>
              Three layers, <span>zero</span><br />
              human intervention.
            </h2>
            <p>
              Decoupled client, coordination middleware, and public ledger settlement. Each tier is modular and permissionless.
            </p>
          </div>
        </div>

        <div className="arch-grid">
          {/* Left Column: Featured Architecture Core Card */}
          <div className="featured-card" data-scroll data-anim="fade-up">
            <div className="featured-header">
              <div className="status-pill">
                <span className="pulsing-dot"></span>
                <span>DATA FLOW PIPELINE</span>
              </div>
              <div className="chain-badge">HEDERA TESTNET · 296</div>
            </div>

            {/* Interactive Data Flow Diagram */}
            <div className="pipeline-schematic">
              <div className="node agent">
                <div className="node-icon">🤖</div>
                <div className="node-label">Autonomous Agent</div>
                <div className="node-sub">Hedera Wallet Signer</div>
              </div>

              <div className="flow-arrow forward">
                <span className="arrow-line"></span>
                <span className="flow-tag">1. HTTP POST</span>
              </div>

              <div className="node gateway">
                <div className="node-icon">⚡</div>
                <div className="node-label">x402 Gateway</div>
                <div className="node-sub">Middleware Gate</div>
              </div>

              <div className="flow-arrow backward">
                <span className="arrow-line"></span>
                <span className="flow-tag challenge">2. HTTP 402</span>
              </div>

              <div className="node hedera">
                <div className="node-icon">⛓️</div>
                <div className="node-label">Hedera Network</div>
                <div className="node-sub">Consensus Settlement</div>
              </div>

              <div className="flow-arrow forward">
                <span className="arrow-line"></span>
                <span className="flow-tag success">3. Unlock</span>
              </div>

              <div className="node provider">
                <div className="node-icon">🧠</div>
                <div className="node-label">AI Inference</div>
                <div className="node-sub">LLM / Vision Model</div>
              </div>
            </div>

            {/* Interactive Protocol Inspector */}
            <div className="protocol-inspector">
              <div className="inspector-tabs">
                <button
                  className={`tab-btn ${activeTab === 'request' ? 'active' : ''}`}
                  onClick={() => setActiveTab('request')}
                >
                  Request
                </button>
                <button
                  className={`tab-btn ${activeTab === 'challenge' ? 'active' : ''}`}
                  onClick={() => setActiveTab('challenge')}
                >
                  HTTP 402
                </button>
                <button
                  className={`tab-btn ${activeTab === 'settlement' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settlement')}
                >
                  On-Chain Receipt
                </button>
              </div>

              <div className="inspector-code">
                <pre><code>{mockPayloads[activeTab]}</code></pre>
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="featured-metrics">
              <div className="metric">
                <div className="val">&lt; 1.2s</div>
                <div className="lbl">Finality</div>
              </div>
              <div className="metric">
                <div className="val">&lt; $0.001</div>
                <div className="lbl">Tx Cost</div>
              </div>
              <div className="metric">
                <div className="val">aBFT</div>
                <div className="lbl">Security</div>
              </div>
            </div>
          </div>

          {/* Right Column: Layer Stack (RLY News/Grid modular style) */}
          <div className="layers-stack">
            {layers.map((l, i) => (
              <div
                key={i}
                className="layer-item"
                data-scroll
                data-anim="fade-left"
                data-anim-delay={i * 90}
              >
                {/* Background graphic for each layer */}
                <div className="layer-bg">
                  {l.bgType === 'hero' && <div className="layer-bg-hero" />}
                  {l.bgType === 'coordinator' && (
                    <div className="layer-bg-coordinator">
                      <svg viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="35" cy="80" r="18" stroke="currentColor" strokeWidth="2" />
                        <circle cx="110" cy="35" r="14" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="110" cy="125" r="14" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="185" cy="80" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
                        <path d="M53 80 L96 35 M53 80 L96 125 M124 35 L165 80 M124 125 L165 80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                        <circle cx="35" cy="80" r="7" fill="currentColor" />
                        <circle cx="110" cy="35" r="5" fill="currentColor" />
                        <circle cx="110" cy="125" r="5" fill="currentColor" />
                        <circle cx="185" cy="80" r="8" fill="currentColor" />
                        <path d="M5 80 H17 M205 80 H218" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                  )}
                  {l.bgType === 'hedera' && <div className="layer-bg-hedera" />}
                  {l.bgType === 'x402' && <div className="layer-bg-x402" />}
                </div>

                <div className="layer-top">
                  <span className="layer-tag">{l.num}</span>
                  <span className="layer-badge">{l.tag}</span>
                </div>

                <div className="layer-main">
                  <div className="layer-icon-box">
                    {l.icon}
                  </div>
                  <div className="layer-details">
                    <h3 className="layer-title">{l.title}</h3>
                    <p className="layer-desc">{l.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
