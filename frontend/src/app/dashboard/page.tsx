'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useRun } from '@/context/RunContext';
import {
  candidateScores as fallbackCandidates,
  flowSteps,
  paymentTrace as fallbackPaymentTrace,
  routeDecision as fallbackDecision,
} from '@/lib/mockData';

export default function AgentConsolePage() {
  const {
    activeRun,
    routePreview,
    activeStep,
    isRunning,
    isCompleted,
    error,
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
    runAgentFlow,
    cancelActiveRun,
    reconcileActiveRun,
    recoverActiveRun,
  } = useRun();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const selectedProvider = routePreview?.selected?.metadata?.name || fallbackDecision.selectedProvider;
  const candidatesList = routePreview?.candidates || fallbackCandidates;
  const reasonText = routePreview?.reason || fallbackDecision.reason;

  const txId = activeRun?.transactionReference || fallbackPaymentTrace.transaction.id;
  const payTo = activeRun?.recipientAccountId || fallbackPaymentTrace.challenge.headers['X-402-PayTo'];
  const amountStr = activeRun?.amountTinybars
    ? (Number(activeRun.amountTinybars) / 100_000_000).toFixed(3)
    : fallbackPaymentTrace.challenge.headers['X-402-Amount'];

  return (
    <div>
      {/* Task & Console Command Bar */}
      <div className="dash-card" style={{ marginBottom: '1.5rem', background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
        <div className="dash-card-head" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <div>
              <h2 className="dash-card-title">Agent Control Console</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Configure capability task, file input, and spend bounds to initiate autonomous routing.
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Prompt / Question Input */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="console-task-prompt"
              value={taskCapability === 'invoice-qa' ? question : prompt}
              onChange={(e) => (taskCapability === 'invoice-qa' ? setQuestion(e.target.value) : setPrompt(e.target.value))}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.6rem 0.85rem',
                color: '#fff',
                width: '100%',
                fontSize: '0.9rem',
              }}
              placeholder={taskCapability === 'invoice-qa' ? 'Ask a question about the invoice image...' : 'Extraction prompt...'}
            />
          </div>

          {/* Controls row */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Budget Limit:</span>
              <input
                type="number"
                step="0.005"
                value={budgetHbar}
                onChange={(e) => setBudgetHbar(e.target.value)}
                style={{
                  width: '80px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--border)',
                  color: 'var(--lime)',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--lime)' }}>HBAR</span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="dash-badge gray"
              style={{ cursor: 'pointer', border: '1px dashed var(--lime)', color: 'var(--lime)', padding: '0.35rem 0.75rem' }}
            >
              {selectedFile ? `📎 ${selectedFile.name}` : '📁 Select Invoice Image'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
            />

            <button
              className={`console-run ${isRunning ? 'running' : ''}`}
              onClick={() => runAgentFlow()}
              disabled={isRunning}
              style={{ marginLeft: 'auto' }}
            >
              {isRunning ? 'Running…' : isCompleted ? 'Run again' : '▶ Execute Agent Flow'}
            </button>
          </div>
        </div>

        {/* Operational recovery buttons */}
        {activeRun && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.75rem', color: '#888', alignSelf: 'center' }}>Run Controls:</span>
            {activeRun.paymentStatus === 'RESERVED' && (
              <button onClick={cancelActiveRun} className="dash-badge amber" style={{ cursor: 'pointer' }}>
                🚫 Cancel Reservation
              </button>
            )}
            <button onClick={reconcileActiveRun} className="dash-badge gray" style={{ cursor: 'pointer' }}>
              🔍 Reconcile Hedera Mirror Node
            </button>
            <button onClick={recoverActiveRun} className="dash-badge lime" style={{ cursor: 'pointer' }}>
              🔄 Recover Extraction (0 Cost)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="dash-card" style={{ borderLeft: '4px solid #ef4444', color: '#f87171', marginBottom: '1.5rem' }}>
          <b>Execution Notice:</b> {error}
        </div>
      )}

      <div className="dash-grid-2">
        {/* Flow timeline */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Execution flow <span className="dash-tag">LIVE PIPELINE</span>
            </h2>
            {isCompleted && <span className="dash-badge lime">✓ completed</span>}
          </div>
          <div className="flow-timeline">
            {flowSteps.map((step, i) => {
              const stepIndex = i + 1;
              const isDone = activeStep > stepIndex || isCompleted;
              const isActive = activeStep === stepIndex && isRunning;
              const statusClass = isDone ? 'done' : isActive ? 'active' : 'pending';

              return (
                <div key={step.id} className={`flow-step ${statusClass}`}>
                  <div className="flow-step-dot">
                    {isDone ? '✓' : stepIndex}
                  </div>
                  <div className="flow-step-body">
                    <div className="flow-step-label">
                      {step.label}
                      {isActive && <span className="dash-badge amber">in progress</span>}
                    </div>
                    <div className="flow-step-desc">{step.desc}</div>
                    <div className="flow-step-detail">{step.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Results column */}
        <div>
          {/* Candidates discovered */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Discovered Candidates</h2>
              <span className="dash-badge gray">ENSv2 · Sepolia</span>
            </div>
            {candidatesList.map((c) => {
              const isSel = c.provider === selectedProvider;
              return (
                <div key={c.provider} className={`score-row ${isSel ? 'selected' : ''}`}>
                  <div className="score-row-top">
                    <span className="score-row-name">
                      {c.provider}
                      {isSel && (
                        <span className="dash-badge lime" style={{ marginLeft: '0.5rem' }}>selected</span>
                      )}
                    </span>
                    <span className="score-row-total">{c.total.toFixed(2)}</span>
                  </div>
                  <div className="score-bar">
                    <div className="score-bar-fill" style={{ width: `${c.total * 100}%` }} />
                  </div>
                  <div className="score-row-factors">
                    <span>capability <b>{c.capabilityMatch.toFixed(2)}</b></span>
                    <span>reliability <b>{c.reliabilitySignal.toFixed(2)}</b></span>
                    <span>activity <b>{c.activitySignal.toFixed(2)}</b></span>
                    <span>price <b>{c.priceScore.toFixed(2)}</b></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Routing decision */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Policy Routing Decision</h2>
              <span className="dash-badge lime">BRYAN ROUTER</span>
            </div>
            <p className="decision-reason">
              <b>{selectedProvider}</b> — {reasonText}. Alternatives considered: beta.ocr.agentpay.eth.
            </p>
            <div className="decision-factors">
              <div className="decision-factor">
                <div className="val">0.30</div>
                <div className="lbl">capability</div>
              </div>
              <div className="decision-factor">
                <div className="val">0.35</div>
                <div className="lbl">reliability</div>
              </div>
              <div className="decision-factor">
                <div className="val">0.20</div>
                <div className="lbl">activity</div>
              </div>
              <div className="decision-factor">
                <div className="val">0.15</div>
                <div className="lbl">price</div>
              </div>
            </div>
          </div>

          {/* Payment status */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Payment &amp; Consensus Status</h2>
              <span className={`dash-badge ${isCompleted ? 'lime' : activeRun ? 'amber' : 'gray'}`}>
                {isCompleted ? 'PAID · VERIFIED' : activeRun ? 'RESERVED · SIGNING' : 'AWAITING RUN'}
              </span>
            </div>
            <div className="dash-mono" style={{ lineHeight: 1.9, fontSize: '0.8rem' }}>
              <div>X-402-PayTo: <span style={{ color: 'var(--lime)' }}>{payTo}</span></div>
              <div>X-402-Amount: <span style={{ color: 'var(--lime)' }}>{amountStr} HBAR</span></div>
              <div>Transaction: {txId}</div>
              <div>Status: {activeRun?.paymentStatus || (isCompleted ? 'SETTLED' : 'PENDING')}</div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <Link href="/dashboard/payment" className="console-run" style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem' }}>
                View payment trace →
              </Link>
              {isCompleted && (
                <Link href="/dashboard/result" className="console-run" style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem', background: 'var(--lime)', color: '#000' }}>
                  View extracted result →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}