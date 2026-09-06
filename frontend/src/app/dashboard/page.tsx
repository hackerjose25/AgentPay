'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  agentTask,
  candidateScores,
  flowSteps,
  paymentTrace,
  routeDecision,
} from '@/lib/mockData';

type StepStatus = 'pending' | 'active' | 'done';

const STEP_DELAYS = [900, 1100, 1300, 1200, 1000, 1400, 1100, 1300];

export default function AgentConsolePage() {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    flowSteps.map(() => 'pending')
  );
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const runAgent = () => {
    if (running) return;
    setRunning(true);
    setCompleted(false);
    setStepStatuses(flowSteps.map(() => 'pending'));

    let elapsed = 300;
    flowSteps.forEach((_, i) => {
      elapsed += STEP_DELAYS[i];
      setTimeout(() => {
        setStepStatuses((prev) => prev.map((s, j) => (j === i ? 'active' : s)));
      }, elapsed - STEP_DELAYS[i] / 2);
      setTimeout(() => {
        setStepStatuses((prev) => prev.map((s, j) => (j === i ? 'done' : s)));
      }, elapsed);
    });

    setTimeout(() => {
      setRunning(false);
      setCompleted(true);
    }, elapsed + 400);
  };

  const selected = candidateScores.find((c) => c.provider === routeDecision.selectedProvider)!;

  return (
    <div>
      {/* Task */}
      <div className="console-task">
        <video
          className="console-task-video"
          src="/videos/footer.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="console-task-icon">📄</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="console-task-prompt">“{agentTask.prompt}”</p>
          <div className="console-task-meta">
            <span className="dash-badge lime">capability: {agentTask.capability}</span>
            <span className="dash-badge gray">budget: {agentTask.budget}</span>
            <span className="dash-badge gray">policy: default-routing</span>
          </div>
        </div>
        <button
          className={`console-run ${running ? 'running' : ''}`}
          onClick={runAgent}
          disabled={running}
        >
          {running ? 'Running…' : completed ? 'Run again' : '▶ Run Agent'}
        </button>
      </div>

      <div className="dash-grid-2">
        {/* Flow timeline */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">
              Execution flow <span className="dash-tag">LIVE</span>
            </h2>
            {completed && <span className="dash-badge lime">✓ completed</span>}
          </div>
          <div className="flow-timeline">
            {flowSteps.map((step, i) => (
              <div key={step.id} className={`flow-step ${stepStatuses[i]}`}>
                <div className="flow-step-dot">
                  {stepStatuses[i] === 'done' ? '✓' : i + 1}
                </div>
                <div className="flow-step-body">
                  <div className="flow-step-label">
                    {step.label}
                    {stepStatuses[i] === 'active' && (
                      <span className="dash-badge amber">in progress</span>
                    )}
                  </div>
                  <div className="flow-step-desc">{step.desc}</div>
                  <div className="flow-step-detail">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        <div>
          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Candidates discovered</h2>
              <span className="dash-badge gray">ENSv2 · The Graph</span>
            </div>
            {candidateScores.map((c) => (
              <div key={c.provider} className={`score-row ${c.provider === selected.provider ? 'selected' : ''}`}>
                <div className="score-row-top">
                  <span className="score-row-name">
                    {c.provider}
                    {c.provider === selected.provider && (
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
            ))}
          </div>

          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Routing decision</h2>
              <span className="dash-badge lime">AI DECIDED</span>
            </div>
            <p className="decision-reason">
              <b>{routeDecision.selectedProvider}</b> — {routeDecision.reason}. Alternatives
              considered: {routeDecision.alternativesConsidered.join(', ')}.
            </p>
            <div className="decision-factors">
              {Object.entries(routeDecision.decisionFactors).map(([k, v]) => (
                <div key={k} className="decision-factor">
                  <div className="val">{v.toFixed(2)}</div>
                  <div className="lbl">{k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Payment status</h2>
              <span className={`dash-badge ${completed ? 'lime' : 'gray'}`}>
                {completed ? 'PAID · VERIFIED' : 'AWAITING RUN'}
              </span>
            </div>
            <div className="dash-mono" style={{ lineHeight: 1.9 }}>
              <div>X-402-PayTo: <span style={{ color: 'var(--lime)' }}>{paymentTrace.challenge.headers['X-402-PayTo']}</span></div>
              <div>X-402-Amount: <span style={{ color: 'var(--lime)' }}>{paymentTrace.challenge.headers['X-402-Amount']} {paymentTrace.challenge.headers['X-402-Currency']}</span></div>
              <div>Transaction: {paymentTrace.transaction.id}</div>
              <div>Consensus: {paymentTrace.transaction.consensus} · {paymentTrace.transaction.latency}</div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Link href="/dashboard/payment" className="console-run" style={{ padding: '0.55rem 1.2rem', fontSize: '0.8rem' }}>
                View full trace →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}