import Link from 'next/link';
import { executionResult } from '@/lib/mockData';

export default function ResultPage() {
  const { provider, capability, cost, completedAt, output, proofTrail } = executionResult;

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
          <span className="dash-mono">{completedAt}</span>. The result below is what the agent
          paid for — and every step that produced it is provable.
        </p>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Inference output</h2>
            <span className="dash-badge lime">confidence {(output.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="result-output">{output.text}</div>
          <div className="result-total">TOTAL DUE: {output.total}</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Proof trail</h2>
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