'use client';

import { useRun } from '@/context/RunContext';
import { capabilities, providers as fallbackProviders } from '@/lib/mockData';

const capabilityLabels: Record<string, string> = {
  'document-ocr': 'Document OCR',
  'invoice-extraction': 'Invoice Extraction',
  translation: 'Translation',
  'image-analysis': 'Image Analysis',
};

export default function DiscoveryPage() {
  const { services } = useRun();

  const providerList = services && services.length > 0
    ? services.map(s => ({
        name: s.name,
        capability: s.capability,
        price: s.price,
        endpoint: s.endpoint,
        paymentMethod: s.paymentMethod || 'x402-hedera',
        status: s.status || 'active',
        providerAddress: s.providerAddress || '0.0.4829103',
      }))
    : fallbackProviders;

  const caps = Array.from(new Set([...capabilities, ...providerList.map(p => p.capability)]));

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            ENSv2 identity graph <span className="dash-tag">agentpay.eth</span>
          </h2>
          <span className="dash-badge gray">resolved via ENSv2</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Providers register under <span className="dash-mono">agentpay.eth</span> with machine-readable
          capability records. The router resolves subdomains to discover who can serve a task, what they
          charge, and how to pay them — no manual provider lists.
        </p>
      </div>

      {caps.map((cap) => {
        const group = providerList.filter((p) => p.capability === cap);
        if (group.length === 0) return null;
        return (
          <div key={cap} className="dash-card cap-group">
            <div className="cap-group-title">
              {capabilityLabels[cap] || cap}
              <span className="count">{group.length} provider{group.length > 1 ? 's' : ''}</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>ENS identity</th>
                    <th>Price / request</th>
                    <th>Endpoint</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <span className="dash-mono" style={{ color: 'var(--lime)' }}>{p.name}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          {p.providerAddress}
                        </div>
                      </td>
                      <td>
                        <b>{typeof p.price === 'number' ? p.price.toFixed(3) : p.price}</b> HBAR
                      </td>
                      <td className="dash-mono">{p.endpoint}</td>
                      <td>
                        <span className="dash-badge lime">x402</span>
                      </td>
                      <td>
                        <span className={`dash-badge ${p.status === 'active' ? 'lime' : 'amber'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}