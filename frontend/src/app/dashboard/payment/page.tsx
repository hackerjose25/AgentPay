'use client';

import Link from 'next/link';
import { useRun } from '@/context/RunContext';

export default function PaymentPage() {
  const { activeRun, isCompleted } = useRun();

  if (!activeRun) {
    return (
      <div>
        <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Payment Trace <span className="dash-tag">x402 + HEDERA</span>
            </h2>
            <span className="dash-badge gray">Awaiting Agent Run</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Every machine payment leaves a verifiable audit trail: HTTP 402 challenge, signed x402 payment header, Hedera Testnet consensus transaction, and Blocky402 facilitator verification.
          </p>
        </div>

        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Active Payment Intent Found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Initiate a payment request in the Agent Console to inspect live 402 challenges and Hedera consensus traces.
          </p>
          <Link href="/dashboard" className="console-run" style={{ fontSize: '0.85rem' }}>
            Go to Agent Console
          </Link>
        </div>
      </div>
    );
  }

  const hbarAmount = activeRun.amountTinybars
    ? (Number(activeRun.amountTinybars) / 100_000_000).toFixed(3)
    : '0.010';

  const explorerUrl = activeRun.transactionReference
    ? `https://hashscan.io/testnet/transaction/${encodeURIComponent(activeRun.transactionReference)}`
    : 'https://hashscan.io/testnet';

  const paymentReq = activeRun.paymentRequired as Record<string, unknown> | undefined;

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Payment Trace <span className="dash-tag">x402 + HEDERA</span>
          </h2>
          <span className="dash-badge lime">{hbarAmount} HBAR · {activeRun.paymentStatus}</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Live payment trace for run <span className="dash-mono">{activeRun.runId}</span> on Hedera Testnet settled via Blocky402 facilitator.
        </p>
      </div>

      <div className="dash-card">
        {/* 1 — Request */}
        <div className="pay-step">
          <div className="pay-step-num">1</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Agent creates payment intent on backend</div>
            <div className="pay-step-code">
              <span className="k">POST</span> /api/runs
              <span className="s">runId: {activeRun.runId}</span>
              <span className="s">payerAccountId: {activeRun.payerAccountId}</span>
              <span className="s">amountTinybars: {activeRun.amountTinybars} ({hbarAmount} HBAR)</span>
            </div>
          </div>
        </div>

        {/* 2 — 402 challenge */}
        <div className="pay-step">
          <div className="pay-step-num">2</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Service responds with HTTP 402 challenge</div>
            <div className="pay-step-code">
              <span className="k">HTTP/1.1 402 Payment Required</span>
              <span className="s">X-402-Version: 2.0</span>
              <span className="s">X-402-PayTo: {activeRun.recipientAccountId}</span>
              <span className="s">X-402-Amount: {activeRun.amountTinybars} tinybars</span>
              <span className="s">X-402-Network: {activeRun.network}</span>
              <span className="s">X-402-Asset: {activeRun.asset}</span>
              {paymentReq && <span className="s">Payment Terms: {JSON.stringify(paymentReq, null, 2)}</span>}
            </div>
          </div>
        </div>

        {/* 3 — Wallet signature */}
        <div className="pay-step">
          <div className="pay-step-num">3</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Hedera wallet signs x402 payment signature</div>
            <div className="pay-step-code">
              <span className="k">signer:</span> {activeRun.payerAccountId} (Hedera Testnet Wallet)
              <span className="k">payTo:</span> {activeRun.recipientAccountId}
              <span className="k">status:</span> {['SETTLED', 'SUCCEEDED'].includes(activeRun.paymentStatus) ? 'SIGNED & SETTLED' : activeRun.paymentStatus}
            </div>
          </div>
        </div>

        {/* 4 — Hedera transaction */}
        <div className="pay-step">
          <div className="pay-step-num">4</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Hedera Testnet consensus transfer</div>
            <div className="pay-step-code">
              <span className="k">transactionRef:</span> {activeRun.transactionReference || 'Awaiting settlement'}
              <span className="k">amount:</span> {hbarAmount} HBAR ({activeRun.amountTinybars} tinybars)
              <span className="k">from:</span> {activeRun.payerAccountId}
              <span className="k">to:</span> {activeRun.recipientAccountId}
              <span className="k">consensus:</span> {activeRun.paymentStatus}
            </div>
            <div style={{ marginTop: '0.6rem' }}>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-badge lime"
                style={{ textDecoration: 'none' }}
              >
                View on HashScan ↗
              </a>
            </div>
          </div>
        </div>

        {/* 5 — Verification */}
        <div className="pay-step">
          <div className="pay-step-num">5</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Blocky402 facilitator settlement verification</div>
            <div className="pay-step-code">
              <span className="k">facilitator:</span> https://api.testnet.blocky402.com
              <span className="k">status:</span> {['SETTLED', 'SUCCEEDED'].includes(activeRun.paymentStatus) || isCompleted ? 'SETTLED_VERIFIED' : activeRun.paymentStatus}
            </div>
          </div>
        </div>

        {/* 6 — Execution */}
        <div className="pay-step">
          <div className="pay-step-num">6</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Service unlocks AI inference response</div>
            <div className="pay-step-code">
              <span className="k">status:</span> {activeRun.status}
              <span className="k">result:</span> {activeRun.result ? 'DELIVERED' : 'PENDING_EXECUTION'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}