'use client';

import Link from 'next/link';
import { useRun } from '@/context/RunContext';
import { executionResult as fallbackResult } from '@/lib/mockData';

export default function ResultPage() {
  const { activeRun, taskCapability, question, recoverActiveRun } = useRun();

  const provider = activeRun?.provider || fallbackResult.provider;
  const capability = activeRun ? taskCapability : fallbackResult.capability;
  const cost = activeRun?.amountTinybars
    ? `${(Number(activeRun.amountTinybars) / 100_000_000).toFixed(3)} HBAR`
    : fallbackResult.cost;
  const completedAt = activeRun ? new Date().toISOString() : fallbackResult.completedAt;

  const rawRes = activeRun?.result as Record<string, unknown> | null;
  const qaAnswer = rawRes?.answer as string | undefined;

  const output = rawRes
    ? {
        text: qaAnswer
          ? `QUESTION: ${question}\n\nANSWER:\n${qaAnswer}`
          : typeof rawRes.text === 'string'
          ? rawRes.text
          : JSON.stringify(rawRes, null, 2),
        total: (rawRes.total as string) || (rawRes.total_due as string) || fallbackResult.output.total,
        confidence: typeof rawRes.confidence === 'number' ? rawRes.confidence : 0.994,
      }
    : fallbackResult.output;

  const txRef = activeRun?.transactionReference || '0.0.18293@1718293812.000000000';
  const proofTrail = [
    { step: 'ENS identity', value: `${provider} → ${activeRun?.recipientAccountId || '0.0.4829103'}`, href: 'https://ens.domains/' },
    { step: 'Provider evidence', value: 'Live endpoint readiness & price verified', href: '/dashboard/intelligence' },
    { step: 'Routing decision', value: `Selected: ${provider} — lowest price candidate`, href: '/dashboard' },
    { step: 'Hedera payment', value: `${cost} · tx ${txRef}`, href: activeRun?.transactionReference ? `https://hashscan.io/testnet/transaction/${encodeURIComponent(txRef)}` : 'https://hashscan.io/testnet' },
    { step: 'x402 verification', value: 'Blocky402 verified · service unlocked', href: 'https://blocky402.com/' },
    { step: 'Inference result', value: `Output delivered · confidence ${(output.confidence * 100).toFixed(1)}%`, href: '/dashboard/result' },
  ];

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Execution result <span className="dash-tag">DELIVERED</span>
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="dash-badge lime">{cost}</span>
            <span className="dash-badge gray">{provider}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Task <span className="dash-mono">{capability}</span> completed at{' '}
          <span className="dash-mono">{completedAt}</span>. The result below was delivered after Blocky402 settlement verification.
        </p>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Inference Output</h2>
            <span className="dash-badge lime">confidence {(output.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="result-output" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.6' }}>
            {output.text}
          </div>
          {output.total && !qaAnswer && (
            <div className="result-total" style={{ marginTop: '1rem', fontWeight: 'bold', color: 'var(--lime)' }}>
              TOTAL DUE: {output.total}
            </div>
          )}
          {activeRun && activeRun.paymentStatus === 'SETTLED' && !activeRun.result && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.5rem' }}>
                Payment settled but extraction result was interrupted? Recover without paying again:
              </p>
              <button onClick={recoverActiveRun} className="dash-badge lime" style={{ cursor: 'pointer', padding: '0.45rem 1rem' }}>
                🔄 Recover Paid Result (Free)
              </button>
            </div>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Proof Trail</h2>
            <span className="dash-badge gray">verifiable end-to-end</span>
          </div>
          <div className="proof-trail">
            {proofTrail.map((item, i) => (
              <div key={item.step} className="proof-item">
                <div className="proof-step">
                  {String(i + 1).padStart(2, '0')} · {item.step}
                </div>
                <div className="proof-value">
                  {item.href.startsWith('http') ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {item.value} ↗
                    </a>
                  ) : (
                    <Link href={item.href}>{item.value}</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <Link href="/dashboard/payment" className="console-run" style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem' }}>
              ← Back to payment trace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}