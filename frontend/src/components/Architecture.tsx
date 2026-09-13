'use client';

import { useState, useEffect, useRef } from 'react';

interface PipelineStage {
  id: string;
  stepNum: string;
  name: string;
  sub: string;
  icon: React.ReactNode;
  status: string;
  statusType: 'ready' | 'active' | 'success';
  headline: string;
  description: string;
  specs: { label: string; value: string }[];
  payload: string;
  fileLabel: string;
  badge: string;
}

const pipelineStages: PipelineStage[] = [
  {
    id: 'discover',
    stepNum: '01',
    name: 'DISCOVER',
    sub: 'ENSv2 Registry',
    badge: 'ENSv2 · Machine Directory',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    status: 'ENS RESOLVED',
    statusType: 'success',
    headline: 'Machine-Readable Service Discovery',
    description:
      'The agent queries ENSv2 for subname candidates providing required capabilities under the owned parent domain on Sepolia without central gatekeepers.',
    specs: [
      { label: 'Parent Name', value: 'aegispay.eth' },
      { label: 'Network', value: 'ENSv2 (Sepolia)' },
      { label: 'Candidates Found', value: '2 Active Services' },
      { label: 'Endpoint Protocol', value: 'x402-v2 / HTTPS' },
    ],
    fileLabel: 'ens_discovery_lookup.json',
    payload: `// 1. ENSv2 machine discovery query
RESOLVE ens_records("*.ocr.aegispay.eth", { capability: "invoice-extraction" })

--> RESOLVED CANDIDATES:
[
  {
    "domain": "alpha.ocr.aegispay.eth",
    "endpoint": "https://alpha.example/extract",
    "price": "0.010 HBAR",
    "hederaAccount": "0.0.4829103"
  },
  {
    "domain": "beta.ocr.aegispay.eth",
    "endpoint": "https://beta.example/extract",
    "price": "0.020 HBAR",
    "hederaAccount": "0.0.3912048"
  }
]`,
  },
  {
    id: 'evaluate',
    stepNum: '02',
    name: 'EVALUATE',
    sub: 'Deterministic Policy',
    badge: 'Policy · Endpoint Verification',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    status: 'POLICY VERIFIED',
    statusType: 'success',
    headline: 'Hard Eligibility & Price Verification',
    description:
      'The routing policy evaluates candidate offers against strict rules: capability match, active state, allowed HTTPS origin, network/asset, recipient, and budget limit.',
    specs: [
      { label: 'Filter Rule', value: 'Hard Eligibility & Budget' },
      { label: 'Price Verification', value: '1,000,000 tinybars' },
      { label: 'Network / Asset', value: 'hedera:testnet / 0.0.0' },
      { label: 'Validation Time', value: '45ms' },
    ],
    fileLabel: 'policy_route_verification.json',
    payload: `// 2. Policy verifies provider candidates & price offers
POST /api/route
{
  "task": "invoice-extraction",
  "maxSpendTinybars": "5000000"
}

--> VERIFIED CANDIDATES:
[
  {
    "name": "alpha.ocr.aegispay.eth",
    "endpoint": "https://alpha.example/extract",
    "recipient": "0.0.4829103",
    "price": "1,000,000 tinybars (0.010 HBAR)",
    "status": "ACTIVE_ELIGIBLE"
  },
  {
    "name": "beta.ocr.aegispay.eth",
    "endpoint": "https://beta.example/extract",
    "recipient": "0.0.3912048",
    "price": "2,000,000 tinybars (0.020 HBAR)",
    "status": "ACTIVE_ELIGIBLE"
  }
]`,
  },
  {
    id: 'decide',
    stepNum: '03',
    name: 'DECIDE',
    sub: 'AI Policy Engine',
    badge: 'LLM Scoring · Policy Bounds',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.45 2.1-1.17 2.83L16 10h-8l1.17-1.17A4 4 0 0 1 12 2z" />
        <path d="M4 22h16l-2-6H6l-2 6z" />
      </svg>
    ),
    status: 'ROUTE DECISION LOCKED',
    statusType: 'success',
    headline: 'Multi-Factor Policy Route Selection',
    description:
      'Decision engine evaluates candidates against policy budget and SLA bounds to lock in the cheapest eligible provider.',
    specs: [
      { label: 'Winner Selected', value: 'alpha.ocr.aegispay.eth' },
      { label: 'Composite Score', value: '0.932 / 1.000' },
      { label: 'Budget Cap', value: '0.050 HBAR max' },
      { label: 'Route Rationale', value: 'Lowest price eligible offer' },
    ],
    fileLabel: 'agent_routing_verdict.json',
    payload: `// 3. Router selects cheapest eligible provider
{
  "task": "invoice-extraction",
  "policyBounds": {
    "maxBudget": "0.050 HBAR",
    "allowedAsset": "0.0.0",
    "network": "hedera:testnet"
  },
  "selectedProvider": "alpha.ocr.aegispay.eth",
  "offerTinybars": "1000000",
  "alternativesConsidered": ["beta.ocr.aegispay.eth"],
  "decisionStatus": "ROUTE_CONFIRMED"
}`,
  },
  {
    id: 'settle',
    stepNum: '04',
    name: 'SETTLE',
    sub: 'Hedera + x402',
    badge: 'HTTP 402 · HBAR Settlement',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    status: 'CONSENSUS FINALIZED',
    statusType: 'success',
    headline: 'Machine-to-Machine Instant Micro-Settlement',
    description:
      'The service returns HTTP 402. The autonomous agent immediately executes an on-chain HBAR transfer on Hedera via Blocky402 with sub-second finality.',
    specs: [
      { label: 'Protocol Gate', value: 'HTTP 402 Payment Required' },
      { label: 'Settlement Asset', value: '0.010 HBAR ($0.0006)' },
      { label: 'Consensus Latency', value: '840ms Finality' },
      { label: 'Hedera Network', value: 'Hedera Testnet' },
    ],
    fileLabel: 'hedera_consensus_receipt.http',
    payload: `// 4. x402 challenge issued & paid on Hedera
--> POST https://alpha.example/extract
<-- HTTP/1.1 402 Payment Required
    X-402-PayTo: 0.0.4829103
    X-402-Amount: 1000000 tinybars
    X-402-FeePayer: 0.0.7162784

--> HEDERA TRANSACT:
    Payer: 0.0.5902184 (Agent) → Receiver: 0.0.4829103
    Amount: 1,000,000 tinybars (0.010 HBAR)

<-- HEDERA CONSENSUS CONFIRMATION:
    Status: SUCCESS (200 OK)
    TxID: 0.0.5902184@1718293812.000000000
    Receipt: https://hashscan.io/testnet/transaction/0.0.5902184@1718293812`,
  },
  {
    id: 'unlock',
    stepNum: '05',
    name: 'UNLOCK',
    sub: 'Protected Execution',
    badge: 'Execution · Zero Human Loop',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    status: 'SERVICE DELIVERED',
    statusType: 'success',
    headline: 'Cryptographic Proof & Execution Result',
    description:
      'Blocky402 validator validates the Hedera consensus receipt. The endpoint unlocks instantly and delivers high-fidelity Gemini AI invoice extraction output.',
    specs: [
      { label: 'Response Code', value: '200 OK' },
      { label: 'Validator', value: 'Blocky402 Consensus Gate' },
      { label: 'Execution Time', value: '312ms' },
      { label: 'Human Steps', value: '0 (Autonomous)' },
    ],
    fileLabel: 'ai_service_result.json',
    payload: `// 5. Proof verified → Service execution completed
--> POST https://alpha.example/extract
    Payment-Signature: x402-0.0.5902184@1718293812

<-- HTTP/1.1 200 OK
    Content-Type: application/json
    X-x402-Verified-By: Blocky402-Hedera-Validator

{
  "status": "completed",
  "task": "invoice-extraction",
  "result": {
    "vendor": "Meridian Labs GmbH",
    "invoiceNumber": "INV-2026-0912",
    "total": "$2,306.30",
    "confidence": 0.994
  },
  "computeTimeMs": 312,
  "gasSettled": "0.010 HBAR"
}`,
  },
];

export default function Architecture() {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStage = pipelineStages[activeStepIndex];

  // Auto-play simulation loop
  useEffect(() => {
    if (isSimulating) {
      simulationTimerRef.current = setInterval(() => {
        setActiveStepIndex((prev) => (prev + 1) % pipelineStages.length);
      }, 2600);
    } else {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    }
    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, [isSimulating]);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentStage.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="arch-section" id="architecture">
      <div className="inner">
        {/* Section Title */}
        <div className="section-title arch-title-row">
          <div>
            <h2 data-scroll>
              Autonomous routing,<br />
              from discovery to <span>instant settlement</span>.
            </h2>
            <p>
              ENSv2 discovers. Policy evaluates. AI scores. Hedera settles. x402 unlocks. Zero human intervention in the execution loop.
            </p>
          </div>

          <div className="pipeline-top-cta">
            <button
              className={`pipeline-sim-toggle ${isSimulating ? 'simulating' : ''}`}
              onClick={() => setIsSimulating(!isSimulating)}
              title="Simulate autonomous pipeline execution"
            >
              <span className="sim-pulse"></span>
              <span>{isSimulating ? 'Pause Flow Simulation' : 'Run Pipeline Simulation'}</span>
            </button>
          </div>
        </div>

        {/* Master Pipeline Showcase Container */}
        <div className="pipeline-showcase-card" data-scroll data-anim="fade-up">
          {/* Card Header with Status & Architecture Badges */}
          <div className="pipeline-card-header">
            <div className="pipeline-status-badge">
              <span className="pulsing-dot"></span>
              <span>AUTONOMOUS PIPELINE RUNTIME</span>
            </div>
            <div className="pipeline-meta-tags">
              <span className="pipeline-network-pill">HEDERA TESTNET</span>
              <span className="pipeline-network-pill">ENSv2 NATIVE</span>
              <span className="pipeline-network-pill">x402 STANDARD</span>
            </div>
          </div>

          {/* 5-Stage Interactive Pipeline Stepper Track */}
          <div className="pipeline-stepper-track">
            {pipelineStages.map((stage, idx) => {
              const isActive = idx === activeStepIndex;
              const isPast = idx < activeStepIndex;
              return (
                <div key={stage.id} className="pipeline-step-wrapper">
                  <button
                    className={`pipeline-step-node ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''}`}
                    onClick={() => {
                      setIsSimulating(false);
                      setActiveStepIndex(idx);
                    }}
                    aria-label={`Step ${stage.stepNum}: ${stage.name}`}
                  >
                    <div className="step-node-header">
                      <span className="step-node-index">{stage.stepNum}</span>
                      <span className="step-node-indicator">
                        {isActive && <span className="active-ping" />}
                      </span>
                    </div>

                    <div className="step-node-icon">{stage.icon}</div>
                    <div className="step-node-name">{stage.name}</div>
                    <div className="step-node-sub">{stage.sub}</div>
                  </button>

                  {/* Connecting conduit arrow on desktop */}
                  {idx < pipelineStages.length - 1 && (
                    <div className={`pipeline-conduit ${idx < activeStepIndex ? 'conduit-active' : ''}`}>
                      <div className="conduit-line">
                        <div className="conduit-particle" />
                      </div>
                      <span className="conduit-arrow">&rarr;</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dual-Pane Telemetry & Protocol Inspector */}
          <div className="pipeline-workspace-grid">
            {/* Left Column: Stage Deep Dive & Live Parameters */}
            <div className="pipeline-telemetry-pane">
              <div className="pane-header">
                <div className="pane-step-badge">
                  <span>STAGE {currentStage.stepNum} OF 05</span>
                  <span className="pane-stage-tag">{currentStage.badge}</span>
                </div>
                <div className="pane-status-indicator">
                  <span className="pulsing-dot" />
                  <span>{currentStage.status}</span>
                </div>
              </div>

              <div className="pane-body">
                <h3 className="pane-headline">{currentStage.headline}</h3>
                <p className="pane-description">{currentStage.description}</p>

                {/* Technical Specs Key-Value Grid */}
                <div className="pane-specs-grid">
                  {currentStage.specs.map((spec, i) => (
                    <div key={i} className="spec-item">
                      <div className="spec-label">{spec.label}</div>
                      <div className="spec-value">{spec.value}</div>
                    </div>
                  ))}
                </div>

                {/* Stage Navigation Stepper Controls */}
                <div className="pane-nav-controls">
                  <button
                    className="pane-nav-btn prev"
                    disabled={activeStepIndex === 0}
                    onClick={() => {
                      setIsSimulating(false);
                      setActiveStepIndex((prev) => Math.max(0, prev - 1));
                    }}
                  >
                    &larr; Prev Step
                  </button>

                  <div className="pane-nav-dots">
                    {pipelineStages.map((_, i) => (
                      <span
                        key={i}
                        className={`nav-dot ${i === activeStepIndex ? 'active' : ''}`}
                        onClick={() => {
                          setIsSimulating(false);
                          setActiveStepIndex(i);
                        }}
                      />
                    ))}
                  </div>

                  <button
                    className="pane-nav-btn next"
                    disabled={activeStepIndex === pipelineStages.length - 1}
                    onClick={() => {
                      setIsSimulating(false);
                      setActiveStepIndex((prev) => Math.min(pipelineStages.length - 1, prev + 1));
                    }}
                  >
                    Next Step &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Protocol Terminal Inspector */}
            <div className="pipeline-terminal-pane">
              <div className="terminal-header">
                <div className="terminal-window-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="terminal-file-title">
                  <span className="terminal-file-icon">&#9639;</span>
                  <span>{currentStage.fileLabel}</span>
                </div>
                <button
                  className="terminal-copy-btn"
                  onClick={handleCopy}
                  title="Copy protocol payload"
                >
                  {copied ? 'Copied ✓' : 'Copy Payload'}
                </button>
              </div>

              <div className="terminal-body">
                <pre className="terminal-code">
                  <code>{currentStage.payload}</code>
                </pre>
              </div>

              <div className="terminal-footer">
                <div className="terminal-foot-item">
                  <span className="foot-label">Protocol:</span>
                  <span className="foot-val">HTTP/1.1 402 / ENSv2 / Hedera</span>
                </div>
                <div className="terminal-foot-item">
                  <span className="foot-label">Status:</span>
                  <span className="foot-val success">Consensus Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Metrics Bar */}
          <div className="pipeline-metrics-bar">
            <div className="pipeline-metric">
              <div className="metric-val">&lt; 850ms</div>
              <div className="metric-lbl">Average End-to-End Latency</div>
            </div>
            <div className="pipeline-metric">
              <div className="metric-val">0.010 HBAR</div>
              <div className="metric-lbl">Machine Micro-Settlement Unit</div>
            </div>
            <div className="pipeline-metric">
              <div className="metric-val">0 Humans</div>
              <div className="metric-lbl">In the Loop · Fully Autonomous</div>
            </div>
            <div className="pipeline-metric">
              <div className="metric-val">100% On-Chain</div>
              <div className="metric-lbl">Hedera Consensus Timestamped</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
