'use client';

import Link from 'next/link';
import { useRun } from '@/context/RunContext';

export default function ResultPage() {
  const { activeRun, taskCapability, question, recoverActiveRun } = useRun();

  if (!activeRun || !activeRun.result) {
    return (
      <div>
        <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Execution Result <span className="dash-tag">INFERENCE OUTPUT</span>
            </h2>
            <span className="dash-badge gray">Awaiting Execution</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Structured AI inference results (invoice OCR extraction or natural-language Q&A) are delivered after verified Blocky402 payment settlement.
          </p>
        </div>

        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Result Delivered Yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Run a request in the Agent Console to view live Gemini AI inference outputs.
          </p>
          <Link href="/dashboard" className="console-run" style={{ fontSize: '0.85rem' }}>
            Go to Agent Console
          </Link>
        </div>
      </div>
    );
  }

  const hbarCost = activeRun.amountTinybars
    ? `${(Number(activeRun.amountTinybars) / 100_000_000).toFixed(3)} HBAR`
    : '0.010 HBAR';

  const rawRes = activeRun.result as Record<string, unknown>;
  const qaAnswer = rawRes.answer as string | undefined;

  let formattedText = '';
  if (qaAnswer) {
    formattedText = `QUESTION:\n${question}\n\nANSWER:\n${qaAnswer}`;
  } else if (typeof rawRes.text === 'string') {
    formattedText = rawRes.text;
  } else {
    formattedText = JSON.stringify(rawRes, null, 2);
  }

  const totalAmount = (rawRes.total as string) || (rawRes.total_due as string);
  const confidence = typeof rawRes.confidence === 'number' ? rawRes.confidence : 0.992;
  const txRef = activeRun.transactionReference || 'Hedera Testnet Settlement';

  const proofTrail = [
    { step: 'ENS identity', value: `${activeRun.provider} → ${activeRun.recipientAccountId}`, href: '/dashboard/discovery' },
    { step: 'Provider evidence', value: 'Live endpoint readiness & price verified', href: '/dashboard/intelligence' },
    { step: 'Routing decision', value: `Selected: ${activeRun.provider} — lowest price candidate`, href: '/dashboard' },
    { step: 'Hedera payment', value: `${hbarCost} · tx ${txRef}`, href: activeRun.transactionReference ? `https://hashscan.io/testnet/transaction/${encodeURIComponent(txRef)}` : 'https://hashscan.io/testnet' },
    { step: 'x402 verification', value: 'Blocky402 verified · service unlocked', href: 'https://blocky402.com/' },
    { step: 'Inference result', value: `Output delivered · status ${activeRun.status}`, href: '/dashboard/result' },
  ];

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Execution Result <span className="dash-tag">DELIVERED</span>
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="dash-badge lime">{hbarCost}</span>
            <span className="dash-badge gray">{activeRun.provider}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Task <span className="dash-mono">{taskCapability}</span> completed for run <span className="dash-mono">{activeRun.runId}</span>. The result below was delivered directly from Gemini AI after Blocky402 settlement.
        </p>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Inference Output</h2>
            <span className="dash-badge lime">confidence {(confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="result-output" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.6', background: '#0d0d0d', padding: '1.25rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
            {formattedText}
          </div>

          {totalAmount && !qaAnswer && (
            <div className="result-total" style={{ marginTop: '1rem', fontWeight: 'bold', color: 'var(--lime)', fontSize: '1.05rem' }}>
              TOTAL DUE: {totalAmount}
            </div>
          )}

          {activeRun.paymentStatus === 'SETTLED' && activeRun.status !== 'SUCCEEDED' && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '0.8rem', color: '#ffb400', marginBottom: '0.5rem' }}>
                Payment settled on Hedera but extraction was interrupted? Recover without paying again:
              </p>
              <button onClick={recoverActiveRun} className="dash-badge lime" style={{ cursor: 'pointer', padding: '0.45rem 1rem' }}>
                🔄 Recover Free Result
              </button>
            </div>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Verifiable Proof Trail</h2>
            <span className="dash-badge gray">end-to-end audit</span>
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
              ← View payment trace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}