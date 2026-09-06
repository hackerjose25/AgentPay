import { paymentTrace } from '@/lib/mockData';

export default function PaymentPage() {
  const { request, challenge, signature, transaction, verification, unlock } = paymentTrace;

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Payment trace <span className="dash-tag">x402 + HEDERA</span>
          </h2>
          <span className="dash-badge lime">0.01 HBAR · settled</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Every machine payment leaves a verifiable trail: the agent hits the service, receives an
          HTTP 402 challenge, signs a payment request, settles on Hedera, and the x402 facilitator
          unlocks the response.
        </p>
      </div>

      <div className="dash-card">
        {/* 1 — Request */}
        <div className="pay-step">
          <div className="pay-step-num">1</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Agent calls the service</div>
            <div className="pay-step-code">
              <span className="k">{request.method}</span> {request.url}
              <span className="s">Content-Type: {request.headers['Content-Type']}</span>
              <span className="s">body: {JSON.stringify(request.body)}</span>
            </div>
          </div>
        </div>

        {/* 2 — 402 challenge */}
        <div className="pay-step">
          <div className="pay-step-num">2</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Service responds: payment required</div>
            <div className="pay-step-code">
              <span className="k">{challenge.status}</span>
              <span className="s">X-402-Version: {challenge.headers['X-402-Version']}</span>
              <span className="s">X-402-PayTo: {challenge.headers['X-402-PayTo']}</span>
              <span className="s">X-402-Amount: {challenge.headers['X-402-Amount']}</span>
              <span className="s">X-402-Currency: {challenge.headers['X-402-Currency']}</span>
              <span className="s">X-402-Nonce: {challenge.headers['X-402-Nonce']}</span>
            </div>
          </div>
        </div>

        {/* 3 — Signature */}
        <div className="pay-step">
          <div className="pay-step-num">3</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Agent signs the payment request</div>
            <div className="pay-step-code">
              <span className="k">signer:</span> {signature.signer}
              <span className="k">message:</span> {signature.message}
              <span className="k">signedAt:</span> {signature.signedAt}
            </div>
          </div>
        </div>

        {/* 4 — Hedera transaction */}
        <div className="pay-step">
          <div className="pay-step-num">4</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Hedera settles the transfer</div>
            <div className="pay-step-code">
              <span className="k">transaction:</span> {transaction.id}
              <span className="k">amount:</span> {transaction.amount}
              <span className="k">from:</span> {transaction.from}
              <span className="k">to:</span> {transaction.to}
              <span className="k">consensus:</span> {transaction.consensus} · latency {transaction.latency}
            </div>
            <div style={{ marginTop: '0.6rem' }}>
              <a
                href={transaction.explorerUrl}
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
            <div className="pay-step-title">x402 facilitator verifies</div>
            <div className="pay-step-code">
              <span className="k">facilitator:</span> {verification.facilitator}
              <span className="k">status:</span> {verification.status}
              <span className="k">verifiedAt:</span> {verification.verifiedAt}
            </div>
          </div>
        </div>

        {/* 6 — Unlock */}
        <div className="pay-step">
          <div className="pay-step-num">6</div>
          <div className="pay-step-body">
            <div className="pay-step-title">Service unlocks the response</div>
            <div className="pay-step-code">
              <span className="k">status:</span> {unlock.status}
              <span className="k">unlockedAt:</span> {unlock.unlockedAt}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}