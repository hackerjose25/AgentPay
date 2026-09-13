// ============================================================
// AegisPay — Mock data for the frontend dashboard.
// The backend (built separately) will replace these with live
// ENSv2 / Hedera / x402 data. All values mirror the
// examples in README.md so the UI matches the documented flow.
// ============================================================

export interface Provider {
  name: string;
  capability: string;
  capabilityLabel: string;
  price: number; // HBAR per request
  endpoint: string;
  paymentMethod: string;
  status: 'active' | 'paused';
  completedRequests: number;
  successfulRequests: number;
  successRate: number; // 0-1
  recentActivity: 'very high' | 'high' | 'medium' | 'low';
  activityScore: number; // 0-100
  usageScore: number; // 0-100
  reliabilityScore: number; // 0-100
  providerAddress: string;
}

export const providers: Provider[] = [
  {
    name: 'ocr.alpha.eth',
    capability: 'document-ocr',
    capabilityLabel: 'OCR',
    price: 0.01,
    endpoint: 'https://alpha.example/ocr',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 2431,
    successfulRequests: 2401,
    successRate: 0.987,
    recentActivity: 'high',
    activityScore: 90,
    usageScore: 80,
    reliabilityScore: 100,
    providerAddress: '0.0.4829103',
  },
  {
    name: 'ocr.beta.eth',
    capability: 'document-ocr',
    capabilityLabel: 'OCR',
    price: 0.007,
    endpoint: 'https://beta.example/ocr',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 48,
    successfulRequests: 44,
    successRate: 0.916,
    recentActivity: 'low',
    activityScore: 25,
    usageScore: 15,
    reliabilityScore: 70,
    providerAddress: '0.0.3912048',
  },
  {
    name: 'ocr.gamma.eth',
    capability: 'document-ocr',
    capabilityLabel: 'OCR',
    price: 0.012,
    endpoint: 'https://gamma.example/ocr',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 8921,
    successfulRequests: 8671,
    successRate: 0.972,
    recentActivity: 'very high',
    activityScore: 98,
    usageScore: 95,
    reliabilityScore: 92,
    providerAddress: '0.0.5902184',
  },
  {
    name: 'translate.alpha.eth',
    capability: 'translation',
    capabilityLabel: 'Translation',
    price: 0.015,
    endpoint: 'https://alpha.example/translate',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 1520,
    successfulRequests: 1498,
    successRate: 0.985,
    recentActivity: 'medium',
    activityScore: 60,
    usageScore: 55,
    reliabilityScore: 96,
    providerAddress: '0.0.4829103',
  },
  {
    name: 'translate.beta.eth',
    capability: 'translation',
    capabilityLabel: 'Translation',
    price: 0.011,
    endpoint: 'https://beta.example/translate',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 310,
    successfulRequests: 296,
    successRate: 0.955,
    recentActivity: 'medium',
    activityScore: 55,
    usageScore: 40,
    reliabilityScore: 88,
    providerAddress: '0.0.3912048',
  },
  {
    name: 'vision.alpha.eth',
    capability: 'image-analysis',
    capabilityLabel: 'Vision',
    price: 0.02,
    endpoint: 'https://alpha.example/vision',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 640,
    successfulRequests: 622,
    successRate: 0.972,
    recentActivity: 'high',
    activityScore: 85,
    usageScore: 70,
    reliabilityScore: 94,
    providerAddress: '0.0.4829103',
  },
  {
    name: 'vision.gamma.eth',
    capability: 'image-analysis',
    capabilityLabel: 'Vision',
    price: 0.018,
    endpoint: 'https://gamma.example/vision',
    paymentMethod: 'x402-hedera',
    status: 'active',
    completedRequests: 2104,
    successfulRequests: 2041,
    successRate: 0.97,
    recentActivity: 'very high',
    activityScore: 95,
    usageScore: 90,
    reliabilityScore: 90,
    providerAddress: '0.0.5902184',
  },
];

export const capabilities = ['document-ocr', 'translation', 'image-analysis'];

// ------------------------------------------------------------
// Route decision (README §5 — The Autonomous Routing Decision)
// ------------------------------------------------------------
export const routeDecision = {
  task: 'invoice_ocr',
  selectedProvider: 'ocr.alpha.eth',
  alternativesConsidered: ['ocr.beta.eth', 'ocr.gamma.eth'],
  decisionFactors: {
    capability: 0.3,
    reliability: 0.35,
    activity: 0.2,
    price: 0.15,
  },
  reason: 'Best reliability/cost tradeoff for this task',
};

export interface CandidateScore {
  provider: string;
  capabilityMatch: number; // 0-1
  reliabilitySignal: number; // 0-1
  activitySignal: number; // 0-1
  priceScore: number; // 0-1 (higher = cheaper)
  total: number; // weighted score
}

export const candidateScores: CandidateScore[] = [
  {
    provider: 'ocr.alpha.eth',
    capabilityMatch: 1.0,
    reliabilitySignal: 1.0,
    activitySignal: 0.9,
    priceScore: 0.7,
    total: 0.93,
  },
  {
    provider: 'ocr.gamma.eth',
    capabilityMatch: 1.0,
    reliabilitySignal: 0.92,
    activitySignal: 0.98,
    priceScore: 0.55,
    total: 0.9,
  },
  {
    provider: 'ocr.beta.eth',
    capabilityMatch: 1.0,
    reliabilitySignal: 0.7,
    activitySignal: 0.25,
    priceScore: 1.0,
    total: 0.72,
  },
];

// ------------------------------------------------------------
// Payment trace (README §12 — x402 + Hedera Payment Flow)
// ------------------------------------------------------------
export const paymentTrace = {
  request: {
    method: 'POST',
    url: 'https://alpha.example/ocr',
    headers: { 'Content-Type': 'application/json' },
    body: { image: 'invoice_2026_09_06.png', task: 'extract text and totals' },
  },
  challenge: {
    status: 'HTTP/1.1 402 Payment Required',
    headers: {
      'X-402-Version': '1.0',
      'X-402-PayTo': '0.0.4829103',
      'X-402-Amount': '0.01',
      'X-402-Currency': 'HBAR',
      'X-402-Nonce': '0x8f2d4e19b',
    },
  },
  signature: {
    signer: '0.0.5902184 (agent wallet)',
    message: 'x402 payment for ocr.alpha.eth · nonce 0x8f2d4e19b',
    signedAt: '2026-09-06T14:32:08.000Z',
  },
  transaction: {
    id: '0.0.18293@1718293812.000000000',
    amount: '0.01 HBAR',
    from: '0.0.5902184',
    to: '0.0.4829103',
    consensus: 'SUCCESS',
    latency: '840ms',
    explorerUrl: 'https://hashscan.io/testnet',
  },
  verification: {
    facilitator: 'Blocky402',
    status: 'verified',
    verifiedAt: '2026-09-06T14:32:09.000Z',
  },
  unlock: {
    status: 'service unlocked',
    unlockedAt: '2026-09-06T14:32:09.500Z',
  },
};

// ------------------------------------------------------------
// Execution result (README §17 — Page 5)
// ------------------------------------------------------------
export const executionResult = {
  provider: 'ocr.alpha.eth',
  capability: 'document-ocr',
  cost: '0.01 HBAR',
  completedAt: '2026-09-06T14:32:10.000Z',
  output: {
    text: [
      'INVOICE #INV-2026-0912',
      '',
      'Vendor: Meridian Labs GmbH',
      'Client: AegisPay Research',
      '',
      'Line items:',
      '  · Neural inference cluster (8× H100) — 48.0 h — $1,920.00',
      '  · Data egress (1.2 TB) — $86.40',
      '  · Storage (2.4 TB × 30 d) — $144.00',
      '',
      'Subtotal: $2,150.40',
      'Tax (7.25%): $155.90',
      'TOTAL DUE: $2,306.30',
    ].join('\n'),
    total: '$2,306.30',
    confidence: 0.994,
  },
  proofTrail: [
    { step: 'ENS identity', value: 'ocr.alpha.eth → 0.0.4829103', href: 'https://ens.domains/' },
    { step: 'Provider evidence', value: 'Live active status · 100% endpoint readiness', href: '/dashboard/intelligence' },
    { step: 'Routing decision', value: 'Selected: ocr.alpha.eth — best reliability/cost tradeoff', href: '/dashboard' },
    { step: 'Hedera payment', value: '0.01 HBAR · tx 0.0.18293@1718293812.000000000', href: 'https://hashscan.io/testnet' },
    { step: 'x402 verification', value: 'Blocky402 verified · service unlocked', href: 'https://blocky402.com/' },
    { step: 'Inference result', value: 'OCR output delivered · confidence 99.4%', href: '/dashboard/result' },
  ],
};

// ------------------------------------------------------------
// Agent console flow steps (README §4 — How It Works)
// ------------------------------------------------------------
export interface FlowStep {
  id: string;
  label: string;
  desc: string;
  detail: string;
}

export const flowSteps: FlowStep[] = [
  { id: 'task', label: 'Task understood', desc: 'Capability identified', detail: 'Required capability: invoice-extraction (OCR / document extraction)' },
  { id: 'discover', label: 'ENSv2 discovery', desc: 'Candidates found', detail: 'alpha.ocr.agentpay.eth · beta.ocr.agentpay.eth resolved via ENSv2 Sepolia' },
  { id: 'evaluate', label: 'Readiness & Policy', desc: 'Offers verified', detail: 'Live endpoint readiness, price check, and hard budget filtering' },
  { id: 'decide', label: 'Route decision', desc: 'ocr.alpha.agentpay.eth selected', detail: 'Lowest price candidate selected under budget policy' },
  { id: 'x402', label: 'HTTP 402', desc: 'Payment required', detail: '402 Payment Required · 0.01 HBAR → 0.0.4829103' },
  { id: 'pay', label: 'Hedera payment', desc: 'Transaction submitted', detail: 'Agent wallet signed and submitted HBAR transfer' },
  { id: 'verify', label: 'Blocky402 verification', desc: 'Payment verified', detail: 'Facilitator confirmed settlement on Hedera Testnet' },
  { id: 'execute', label: 'Service executes', desc: 'Result returned', detail: 'Gemini AI processed the invoice and returned structured fields' },
];

export const agentTask = {
  prompt: 'Extract the text and totals from this invoice.',
  capability: 'document-ocr',
  budget: '0.05 HBAR',
};