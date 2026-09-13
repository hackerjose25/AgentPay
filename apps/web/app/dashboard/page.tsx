"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AgentPayApi, type RoutePreview, type RunView } from "../../lib/agentpay";
import { getWalletAccountId, subscribeWalletAccount } from "../../lib/wallet-store";

const extractionTask = "Extract the invoice fields";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export default function DashboardPage() {
  const api = useMemo(() => new AgentPayApi(apiBaseUrl), []);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [budget, setBudget] = useState("5000000");
  const [question, setQuestion] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [payerAccountId, setPayerAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Enter the demo access code to begin.");
  const idempotencyKey = useRef(crypto.randomUUID());
  const task = question.trim() ? question.trim() : extractionTask;

  useEffect(() => {
    void api.getSession()
      .then((session) => {
        setAuthenticated(session.authenticated);
        if (session.authenticated) setMessage("Session ready. Choose an invoice and preview the route.");
      })
      .catch(() => setMessage("Backend is unavailable."));
  }, [api]);

  useEffect(() => {
    setPayerAccountId(getWalletAccountId());
    const unsubscribe = subscribeWalletAccount(setPayerAccountId);
    void import("../../lib/hashpack-wallet")
      .then(({ restoreWalletConnection }) => restoreWalletConnection({ projectId: walletConnectProjectId, origin: window.location.origin }))
      .catch(() => { /* keep current state */ });
    return unsubscribe;
  }, []);

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  function unlock(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void runAction(async () => {
      const session = await api.unlock(accessCode);
      setAuthenticated(session.authenticated);
      setAccessCode("");
      setMessage("Session ready. Choose an invoice and preview the route.");
    });
  }

  function previewRoute(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!invoice) {
      setMessage("Choose one PNG or JPEG invoice first.");
      return;
    }
    if (!["image/png", "image/jpeg"].includes(invoice.type)) {
      setMessage("The invoice must be a PNG or JPEG.");
      return;
    }
    void runAction(async () => {
      setMessage("Warming providers and checking ENS and payment terms…");
      const nextPreview = await api.preview(task, budget);
      idempotencyKey.current = crypto.randomUUID();
      setPreview(nextPreview);
      setRun(null);
      setMessage("Route ready. Connect your wallet from the home page header to create the payment intent.");
    });
  }

  function createPaymentIntent(): void {
    void runAction(async () => {
      if (!invoice || !payerAccountId) throw new Error("Connect your wallet from the home page header, then choose an invoice first.");
      const nextRun = await api.createRun({ task, maxSpendTinybars: budget, payerAccountId, invoice, ...(question.trim() ? { question: question.trim() } : {}) }, idempotencyKey.current);
      setRun(nextRun);
      setMessage("Payment intent reserved. Review the exact terms before signing.");
    });
  }

  function signAndExecute(): void {
    void runAction(async () => {
      if (!run?.paymentRequired || !window.agentPayWallet) throw new Error("Connect your wallet from the home page header before approving a payment.");
      if (new Date(run.expiresAt).getTime() <= Date.now()) throw new Error("This payment intent expired. Cancel it and create a fresh intent.");
      setMessage("Waiting for wallet approval…");
      const signature = await window.agentPayWallet.createPaymentSignature(run.paymentRequired);
      setMessage("Submitting the signed payment and waiting for settlement…");
      const completed = await api.execute(run.runId, signature);
      setRun(completed);
      setMessage(completed.status === "SUCCEEDED" ? "Run complete." : `Run status: ${completed.status}`);
    });
  }

  function refreshRun(): void {
    if (!run) return;
    void runAction(async () => {
      const refreshed = await api.getRun(run.runId);
      setRun(refreshed);
      setMessage(`Run status refreshed: ${refreshed.status} / ${refreshed.paymentStatus}`);
    });
  }

  function cancelRun(): void {
    if (!run) return;
    void runAction(async () => {
      const canceled = await api.cancel(run.runId);
      setRun(canceled);
      idempotencyKey.current = crypto.randomUUID();
      setMessage("Unsigned payment intent canceled. No payment was submitted.");
    });
  }

  function reconcileRun(): void {
    if (!run) return;
    void runAction(async () => {
      const reconciled = await api.reconcile(run.runId);
      setRun(reconciled);
      setMessage(`Reconciliation result: ${reconciled.paymentStatus}`);
    });
  }

  function recoverRun(): void {
    if (!run) return;
    void runAction(async () => {
      setMessage("Recovering the paid extraction without another payment…");
      const recovered = await api.recover(run.runId);
      setRun(recovered);
      setMessage("Extraction recovered. No new payment was created.");
    });
  }

  function logout(): void {
    void runAction(async () => {
      await api.logout();
      await window.agentPayWallet?.disconnect?.();
      setAuthenticated(false);
      setPreview(null);
      setRun(null);
      setPayerAccountId(null);
      setMessage("Session closed.");
    });
  }

  return (
    <>
      <header className="dash-topbar">
        <h1 className="dash-title">Agent Console</h1>
        <div className="dash-topbar-right">
          <span className="dash-network">
            <span className="dash-dot"></span>
            Hedera Testnet · 296
          </span>
          <span className={`dash-wallet-status${payerAccountId ? " connected" : ""}`} title={payerAccountId ? "Connected via HashPack" : "Connect your wallet from the home page header"}>
            <span className="dash-dot"></span>
            {payerAccountId ? payerAccountId : "Wallet not connected"}
          </span>
          {authenticated && (
            <button className="dash-btn-secondary" onClick={logout} disabled={busy}>Log out</button>
          )}
        </div>
      </header>

      <div className="dash-page">
        <p className="dash-status" role="status">{message}</p>

        {!authenticated ? (
          <section className="dash-card">
            <div className="dash-card-head">
              <h2 className="dash-card-title">Demo Access</h2>
              <span className="dash-badge gray">Locked</span>
            </div>
            <form className="dash-form" onSubmit={unlock}>
              <div className="dash-field">
                <label htmlFor="access-code">Access code</label>
                <input id="access-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required />
              </div>
              <button className="console-run" disabled={busy || !payerAccountId}>Unlock</button>
            </form>
            {!payerAccountId && <p className="dash-hint">Connect your wallet from the home page header to enable sign-in.</p>}
          </section>
        ) : (
          <>
            <section className="dash-card">
              <div className="dash-card-head">
                <h2 className="dash-card-title">1. Prepare Request</h2>
              </div>
              <form className="dash-form" onSubmit={previewRoute}>
                <div className="dash-field">
                  <label htmlFor="invoice">Invoice image</label>
                  <input id="invoice" type="file" accept="image/png,image/jpeg" onChange={(event) => setInvoice(event.target.files?.[0] ?? null)} required />
                </div>
                <div className="dash-field">
                  <label htmlFor="question">Question (optional — leave empty to extract the invoice fields)</label>
                  <textarea id="question" rows={2} maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. What is the total?" />
                </div>
                <div className="dash-field">
                  <label htmlFor="budget">Maximum spend in tinybars</label>
                  <input id="budget" inputMode="numeric" pattern="[1-9][0-9]*" value={budget} onChange={(event) => setBudget(event.target.value)} required />
                </div>
                <button className="console-run" disabled={busy}>Preview route</button>
              </form>
            </section>

            {preview && (
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2 className="dash-card-title">2. Review Route</h2>
                  <span className="dash-badge gray">Preview</span>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <tbody>
                      <tr><th>ENS provider</th><td>{preview.selected.metadata.name}</td></tr>
                      <tr><th>Price</th><td>{preview.selected.offer.amount} tinybars</td></tr>
                      <tr><th>Recipient</th><td>{preview.selected.metadata.recipient}</td></tr>
                      <tr><th>Network</th><td>{preview.selected.metadata.network}</td></tr>
                      <tr><th>Readiness</th><td>{preview.readiness[0]?.attempts ?? 0} attempt(s)</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="dash-card-actions">
                  <button className="dash-btn-secondary" onClick={createPaymentIntent} disabled={busy || !payerAccountId}>Create payment intent</button>
                  {!payerAccountId && <span className="dash-hint">Connect your wallet from the home page header first.</span>}
                </div>
              </section>
            )}

            {run && (
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2 className="dash-card-title">3. Payment &amp; Result</h2>
                  <span className="dash-badge gray">{run.paymentStatus}</span>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <tbody>
                      <tr><th>Run</th><td className="dash-mono">{run.runId}</td></tr>
                      <tr><th>Payment</th><td>{run.paymentStatus}</td></tr>
                      <tr><th>Execution</th><td>{run.status}</td></tr>
                      <tr><th>Amount</th><td>{run.amountTinybars} tinybars</td></tr>
                    </tbody>
                  </table>
                </div>
                {run.result ? <pre className="result-output">{JSON.stringify(run.result, null, 2)}</pre> : (
                  <div className="dash-card-actions">
                    <button className="console-run" onClick={signAndExecute} disabled={busy || run.paymentStatus !== "RESERVED"}>Sign and execute</button>
                    <button className="dash-btn-secondary" onClick={refreshRun} disabled={busy}>Refresh status</button>
                    <button className="dash-btn-secondary" onClick={cancelRun} disabled={busy || run.paymentStatus !== "RESERVED"}>Cancel intent</button>
                    <button className="dash-btn-secondary" onClick={reconcileRun} disabled={busy || !["UNKNOWN", "SUBMITTING"].includes(run.paymentStatus)}>Reconcile payment</button>
                    <button className="dash-btn-secondary" onClick={recoverRun} disabled={busy || run.paymentStatus !== "SETTLED" || run.status === "SUCCEEDED"}>Recover result</button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}