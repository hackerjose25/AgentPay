'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRun } from '@/context/RunContext';
import { useWallet } from '@/context/WalletContext';

export default function AgentConsolePage() {
  const {
    session,
    routePreview,
    activeRun,
    isRunning,
    isCompleted,
    error,
    message,
    selectedFile,
    taskCapability,
    prompt,
    question,
    budgetHbar,
    setSelectedFile,
    setTaskCapability,
    setPrompt,
    setQuestion,
    setBudgetHbar,
    unlockSession,
    previewRoute,
    createPaymentIntent,
    signAndExecute,
    cancelActiveRun,
    reconcileActiveRun,
    recoverActiveRun,
    refreshRunState,
    logoutSession,
  } = useRun();

  const { isConnected, displayAddress, openModal } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accessCode, setAccessCode] = useState(process.env.NEXT_PUBLIC_DEMO_CODE || 'ethonline2026');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await unlockSession(accessCode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Session Lock Banner */}
      {session && !session.authenticated && (
        <div className="dash-card" style={{ border: '1px solid rgba(255,180,0,0.4)', background: 'rgba(255,180,0,0.05)' }}>
          <div className="dash-card-head">
            <h2 className="dash-card-title" style={{ color: '#ffb400' }}>🔒 Console Locked — Access Code Required</h2>
          </div>
          <form onSubmit={handleUnlock} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter demo access code (ethonline2026)"
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                flex: '1',
                minWidth: '220px',
              }}
              required
            />
            <button type="submit" className="console-run" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} disabled={isRunning}>
              Unlock Session
            </button>
          </form>
        </div>
      )}

      {/* Real-time Status / Error Message */}
      {(message || error) && (
        <div className="dash-card" style={{ border: error ? '1px solid #f87171' : '1px solid var(--lime)', background: error ? 'rgba(248,113,113,0.05)' : 'rgba(206,255,69,0.05)' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: error ? '#f87171' : 'var(--lime)' }}>
            {error ? `⚠️ ${error}` : `⚡ ${message}`}
          </div>
        </div>
      )}

      {/* Control Console Form */}
      <div className="dash-card" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
        <div className="dash-card-head" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <div>
              <h2 className="dash-card-title">AegisPay Agent Router Console</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Configure capability task, select invoice image, set budget limit, and run the real backend workflow.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setTaskCapability('invoice-extraction')}
              className={`dash-badge ${taskCapability === 'invoice-extraction' ? 'lime' : 'gray'}`}
              style={{ cursor: 'pointer', padding: '0.4rem 0.85rem' }}
            >
              📄 Invoice Extraction
            </button>
            <button
              onClick={() => setTaskCapability('invoice-qa')}
              className={`dash-badge ${taskCapability === 'invoice-qa' ? 'lime' : 'gray'}`}
              style={{ cursor: 'pointer', padding: '0.4rem 0.85rem' }}
            >
              💬 Invoice QA
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Prompt / Question Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {taskCapability === 'invoice-qa' ? 'Question for AI Inference:' : 'Task Prompt:'}
            </label>
            <input
              type="text"
              className="console-task-prompt"
              value={taskCapability === 'invoice-qa' ? question : prompt}
              onChange={(e) => (taskCapability === 'invoice-qa' ? setQuestion(e.target.value) : setPrompt(e.target.value))}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.65rem 0.85rem',
                color: '#fff',
                width: '100%',
                fontSize: '0.9rem',
              }}
              placeholder={taskCapability === 'invoice-qa' ? 'e.g. What is the total amount due?' : 'e.g. Extract invoice fields'}
            />
          </div>

          {/* Settings Row */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Max Budget:</span>
              <input
                type="number"
                step="0.005"
                value={budgetHbar}
                onChange={(e) => setBudgetHbar(e.target.value)}
                style={{
                  width: '90px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--border)',
                  color: 'var(--lime)',
                  borderRadius: '4px',
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--lime)', fontWeight: 700 }}>HBAR</span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="dash-badge gray"
              style={{ cursor: 'pointer', border: '1px dashed var(--lime)', color: 'var(--lime)', padding: '0.45rem 0.85rem' }}
            >
              {selectedFile ? `📎 ${selectedFile.name}` : '📁 Select Custom Invoice Image'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
            />

            <button
              onClick={previewRoute}
              disabled={isRunning}
              className="console-run"
              style={{ marginLeft: 'auto', padding: '0.65rem 1.4rem' }}
            >
              {isRunning ? '🔄 Resolving Route...' : '1. Preview Route (ENSv2 + Policy)'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Route Preview Results */}
      {routePreview && (
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Step 2: Route Decision & Candidates <span className="dash-tag">ENSv2 RESOLVED</span>
            </h2>
            <span className="dash-badge lime">{routePreview.selected.metadata.name}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SELECTED PROVIDER</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--lime)', marginTop: '0.25rem' }}>
                {routePreview.selected.metadata.name}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>OFFER PRICE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>
                {routePreview.selected.offer.amount} tinybars ({(Number(routePreview.selected.offer.amount) / 100_000_000).toFixed(3)} HBAR)
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RECIPIENT ACCOUNT</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                {routePreview.selected.metadata.recipient}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>NETWORK & ASSET</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>
                {routePreview.selected.metadata.network} ({routePreview.selected.metadata.asset})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isConnected ? (
              <button onClick={openModal} className="console-run" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--border)' }}>
                🔗 Connect Payer Wallet
              </button>
            ) : (
              <span className="dash-badge lime">Connected: {displayAddress}</span>
            )}

            <button
              onClick={createPaymentIntent}
              disabled={isRunning}
              className="console-run"
            >
              {isRunning ? 'Creating Intent...' : '2. Create Payment Intent (Reserve Budget)'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Active Payment Run & Settlement */}
      {activeRun && (
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Step 3: Payment Settlement & AI Execution <span className="dash-tag">{activeRun.status}</span>
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="dash-badge lime">Payment: {activeRun.paymentStatus}</span>
              <span className="dash-badge gray">Run: {activeRun.runId.slice(0, 12)}...</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>AMOUNT RESERVED</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--lime)', marginTop: '0.25rem' }}>
                {activeRun.amountTinybars} tinybars
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PAYER ACCOUNT</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                {activeRun.payerAccountId}
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TRANSACTION REF</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                {activeRun.transactionReference || 'Awaiting wallet signature'}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {activeRun.paymentStatus === 'RESERVED' && (
              <button onClick={signAndExecute} disabled={isRunning} className="console-run">
                {isRunning ? 'Processing...' : '3. Sign Payment & Execute AI Extraction'}
              </button>
            )}

            <button onClick={refreshRunState} disabled={isRunning} className="dash-badge gray" style={{ cursor: 'pointer', padding: '0.5rem 0.85rem' }}>
              🔄 Refresh Status
            </button>

            {activeRun.paymentStatus === 'RESERVED' && (
              <button onClick={cancelActiveRun} disabled={isRunning} className="dash-badge gray" style={{ cursor: 'pointer', padding: '0.5rem 0.85rem', color: '#f87171' }}>
                ✖ Cancel Intent
              </button>
            )}

            {['UNKNOWN', 'SUBMITTING'].includes(activeRun.paymentStatus) && (
              <button onClick={reconcileActiveRun} disabled={isRunning} className="dash-badge gray" style={{ cursor: 'pointer', padding: '0.5rem 0.85rem', color: '#ffb400' }}>
                🔍 Reconcile Payment
              </button>
            )}

            {activeRun.paymentStatus === 'SETTLED' && activeRun.status !== 'SUCCEEDED' && (
              <button onClick={recoverActiveRun} disabled={isRunning} className="dash-badge lime" style={{ cursor: 'pointer', padding: '0.5rem 0.85rem' }}>
                🔄 Recover Free Result
              </button>
            )}
          </div>

          {/* Result Block */}
          {activeRun.result ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--lime)', marginBottom: '0.5rem' }}> Inferred Extraction Result:</h3>
              <pre className="result-output" style={{ background: '#0d0d0d', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', overflowX: 'auto' }}>
                {JSON.stringify(activeRun.result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}