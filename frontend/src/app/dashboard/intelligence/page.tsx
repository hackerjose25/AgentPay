import { providers } from '@/lib/mockData';

const activityLabel: Record<string, string> = {
  'very high': 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function IntelligencePage() {
  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Provider intelligence <span className="dash-tag">THE GRAPH</span>
          </h2>
          <span className="dash-badge gray">indexed on-chain evidence</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Live signals indexed by The Graph: recent activity, historical usage, and reliability.
          The AI routing engine weighs these against price to pick the best provider for each task.
        </p>
      </div>

      <div className="dash-card">
        {providers.map((p) => (
          <div key={p.name} className="intel-provider">
            <div className="intel-provider-head">
              <span className="intel-provider-name">{p.name}</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="dash-badge gray">{p.capabilityLabel}</span>
                <span className="dash-badge lime">{p.price.toFixed(3)} HBAR</span>
              </div>
            </div>

            <div className="intel-signal">
              <div className="intel-signal-top">
                <span className="lbl">Recent activity</span>
                <span className="val">{activityLabel[p.recentActivity]} · {p.activityScore}/100</span>
              </div>
              <div className="intel-bar">
                <div className="intel-bar-fill lime" style={{ width: `${p.activityScore}%` }} />
              </div>
            </div>

            <div className="intel-signal">
              <div className="intel-signal-top">
                <span className="lbl">Historical usage</span>
                <span className="val">{p.completedRequests.toLocaleString()} completed · {p.usageScore}/100</span>
              </div>
              <div className="intel-bar">
                <div className="intel-bar-fill gray" style={{ width: `${p.usageScore}%` }} />
              </div>
            </div>

            <div className="intel-signal">
              <div className="intel-signal-top">
                <span className="lbl">Reliability</span>
                <span className="val">{(p.successRate * 100).toFixed(1)}% success · {p.reliabilityScore}/100</span>
              </div>
              <div className="intel-bar">
                <div className="intel-bar-fill amber" style={{ width: `${p.reliabilityScore}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}