'use client';

import { useRun } from '@/context/RunContext';

const capabilityLabels: Record<string, string> = {
  'document-ocr': 'Document OCR',
  'invoice-extraction': 'Invoice Extraction',
  'invoice-qa': 'Invoice Q&A',
  translation: 'Translation',
  'image-analysis': 'Image Analysis',
};

export default function DiscoveryPage() {
  const { services, refreshServices } = useRun();

  // Active enrolled providers from Express server & ENS directory
  const providerList = services.map(s => ({
    name: s.name,
    capability: s.capability,
    price: s.price,
    endpoint: s.endpoint,
    paymentMethod: s.paymentMethod || 'x402-hedera',
    status: s.status || 'active',
    providerAddress: s.providerAddress || '0.0.4829103',
  }));

  const caps = Array.from(new Set(providerList.map(p => p.capability)));

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            ENSv2 identity graph <span className="dash-tag">aegispayapp.eth</span>
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={refreshServices} className="dash-badge gray" style={{ cursor: 'pointer' }}>
              🔄 Refresh Directory
            </button>
            <span className="dash-badge lime">{providerList.length} Live Provider(s)</span>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Providers register under <span className="dash-mono">aegispayapp.eth</span> with machine-readable
          ENSv2 text records (`agentpay.capability`, `agentpay.endpoint`, `agentpay.payment.recipient`).
          The router resolves subdomains at runtime to discover candidates, verify prices, and settle payments.
        </p>
      </div>

      {providerList.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Active Enrolled Providers Found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Ensure the backend server is running on port 4000 (`npm run dev`) to query live ENS directory services.
          </p>
          <button onClick={refreshServices} className="console-run" style={{ fontSize: '0.85rem' }}>
            Query Backend Directory Now
          </button>
        </div>
      ) : (
        caps.map((cap) => {
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
                            Recipient: {p.providerAddress}
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
        })
      )}
    </div>
  );
}