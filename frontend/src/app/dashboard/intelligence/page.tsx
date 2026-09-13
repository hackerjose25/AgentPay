'use client';

import { useRun } from '@/context/RunContext';

export default function IntelligencePage() {
  const { services, routePreview } = useRun();

  const providerList = services.map(s => ({
    name: s.name,
    capability: s.capability,
    price: s.price,
    endpoint: s.endpoint,
    providerAddress: s.providerAddress,
    status: s.status,
  }));

  const selectedName = routePreview?.selected?.metadata?.name;

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Provider Intelligence <span className="dash-tag">ROUTER EVALUATION</span>
          </h2>
          <span className="dash-badge gray">ENSv2 & Policy Verification</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Live candidate signals evaluated by AegisPay router: ENSv2 record resolution, price verification, endpoint availability, and budget filtering.
          The deterministic policy engine chooses the lowest price candidate that satisfies all constraints.
        </p>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-card-title">Candidate Evaluation Matrix</h2>
          {selectedName ? (
            <span className="dash-badge lime">Selected: {selectedName}</span>
          ) : (
            <span className="dash-badge gray">Ready for Router Query</span>
          )}
        </div>

        {providerList.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No evaluated candidates yet. Initiate a preview query in the Agent Console to inspect candidate evaluation.
          </div>
        ) : (
          providerList.map((p) => {
            const isWinner = selectedName === p.name;
            return (
              <div
                key={p.name}
                className={`score-row ${isWinner ? 'selected' : ''}`}
                style={{
                  border: isWinner ? '1px solid var(--lime)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: isWinner ? 'rgba(206,255,69,0.04)' : 'rgba(0,0,0,0.2)',
                }}
              >
                <div className="score-row-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="score-row-name" style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: isWinner ? 'var(--lime)' : '#fff' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                      ({p.capability})
                    </span>
                  </div>
                  <div className="score-row-total">
                    {p.price} HBAR / request
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Endpoint: </span>
                    <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>{p.endpoint}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Recipient: </span>
                    <span style={{ fontFamily: 'monospace', color: '#e5e7eb' }}>{p.providerAddress}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
                    <span className="dash-badge lime">{p.status}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}