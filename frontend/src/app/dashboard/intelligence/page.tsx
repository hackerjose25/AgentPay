'use client';

import { useRun } from '@/context/RunContext';
import { providers as fallbackProviders } from '@/lib/mockData';

const activityLabel: Record<string, string> = {
  'very high': 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function IntelligencePage() {
  const { services } = useRun();

  const providerList = services && services.length > 0
    ? services
    : fallbackProviders;

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Provider intelligence <span className="dash-tag">ROUTER EVALUATION</span>
          </h2>
          <span className="dash-badge gray">ENSv2 & Policy Verification</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Live candidate signals evaluated by AgentPay router: ENSv2 record resolution, price verification, endpoint availability, and budget filtering.
          The deterministic routing engine selects the cheapest eligible provider for each task.
        </p>
      </div>

      <div className="dash-card">
        {providerList.map((p) => {
          const actScore = p.activityScore ?? 90;
          const usageScore = p.usageScore ?? 80;
          const relScore = p.reliabilityScore ?? 98;
          const completedCount = p.completedRequests ?? 2431;
          const succRate = p.successRate ?? 0.987;
          const actLabel = p.recentActivity ? activityLabel[p.recentActivity] : 'High';
          const priceDisplay = typeof p.price === 'number' ? p.price.toFixed(3) : p.price;

          return (
            <div key={p.name} className="intel-provider">
              <div className="intel-provider-head">
                <span className="intel-provider-name">{p.name}</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="dash-badge gray">{p.capability || 'invoice-extraction'}</span>
                  <span className="dash-badge lime">{priceDisplay} HBAR</span>
                </div>
              </div>

              <div className="intel-signal">
                <div className="intel-signal-top">
                  <span className="lbl">Recent activity</span>
                  <span className="val">{actLabel} · {actScore}/100</span>
                </div>
                <div className="intel-bar">
                  <div className="intel-bar-fill lime" style={{ width: `${actScore}%` }} />
                </div>
              </div>

              <div className="intel-signal">
                <div className="intel-signal-top">
                  <span className="lbl">Historical usage</span>
                  <span className="val">{completedCount.toLocaleString()} completed · {usageScore}/100</span>
                </div>
                <div className="intel-bar">
                  <div className="intel-bar-fill gray" style={{ width: `${usageScore}%` }} />
                </div>
              </div>

              <div className="intel-signal">
                <div className="intel-signal-top">
                  <span className="lbl">Reliability</span>
                  <span className="val">{(succRate * 100).toFixed(1)}% success · {relScore}/100</span>
                </div>
                <div className="intel-bar">
                  <div className="intel-bar-fill amber" style={{ width: `${relScore}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}