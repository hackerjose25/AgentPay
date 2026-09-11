"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AgentPayApi, type RoutePreview, type RunView } from "../lib/agentpay";

const task = "Extract the invoice fields";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function Home() {
  const api = useMemo(() => new AgentPayApi(apiBaseUrl), []);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [budget, setBudget] = useState("5000000");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [payerAccountId, setPayerAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Enter the demo access code to begin.");
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    void api.getSession()
      .then((session) => {
        setAuthenticated(session.authenticated);
        if (session.authenticated) setMessage("Session ready. Choose an invoice and preview the route.");
      })
      .catch(() => setMessage("Backend is unavailable."));
  }, [api]);

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
      setMessage("Route ready. Connect a Hedera Testnet wallet to create the payment intent.");
    });
  }

  function connectWallet(): void {
    void runAction(async () => {
      if (!window.agentPayWallet) throw new Error("No Hedera wallet adapter is installed. The prebuilt UI must provide window.agentPayWallet.");
      const wallet = await window.agentPayWallet.connect();
      setPayerAccountId(wallet.accountId);
      setMessage(`Wallet connected: ${wallet.accountId}`);
    });
  }

  function createPaymentIntent(): void {
    void runAction(async () => {
      if (!invoice || !payerAccountId) throw new Error("Connect the payer wallet and choose an invoice first.");
      const nextRun = await api.createRun({ task, maxSpendTinybars: budget, payerAccountId, invoice }, idempotencyKey.current);
      setRun(nextRun);
      setMessage("Payment intent reserved. Review the exact terms before signing.");
    });
  }

  function signAndExecute(): void {
    void runAction(async () => {
      if (!run?.paymentRequired || !window.agentPayWallet) throw new Error("Wallet adapter or payment requirements are unavailable.");
      setMessage("Waiting for wallet approval…");
      const signature = await window.agentPayWallet.createPaymentSignature(run.paymentRequired);
      setMessage("Submitting the signed payment and waiting for settlement…");
      const completed = await api.execute(run.runId, signature);
      setRun(completed);
      setMessage(completed.status === "SUCCEEDED" ? "Extraction complete." : `Run status: ${completed.status}`);
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
      setAuthenticated(false);
      setPreview(null);
      setRun(null);
      setPayerAccountId(null);
      setMessage("Session closed.");
    });
  }

  return (
    <main>
      <header>
        <div><p className="eyebrow">AgentPay · Hedera Testnet</p><h1>Invoice extraction</h1></div>
        <div className="actions">
          <span className={authenticated ? "badge ready" : "badge"}>{authenticated ? "Session active" : "Locked"}</span>
          {authenticated && <button type="button" className="secondary" onClick={logout} disabled={busy}>Log out</button>}
        </div>
      </header>
      <p className="message" role="status">{message}</p>

      {!authenticated ? (
        <section>
          <h2>Demo access</h2>
          <form onSubmit={unlock}>
            <label htmlFor="access-code">Access code</label>
            <input id="access-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required />
            <button disabled={busy}>Unlock</button>
          </form>
        </section>
      ) : (
        <>
          <section>
            <h2>1. Prepare request</h2>
            <form onSubmit={previewRoute}>
              <label htmlFor="invoice">Invoice image</label>
              <input id="invoice" type="file" accept="image/png,image/jpeg" onChange={(event) => setInvoice(event.target.files?.[0] ?? null)} required />
              <label htmlFor="budget">Maximum spend in tinybars</label>
              <input id="budget" inputMode="numeric" pattern="[1-9][0-9]*" value={budget} onChange={(event) => setBudget(event.target.value)} required />
              <button disabled={busy}>Preview route</button>
            </form>
          </section>

          {preview && (
            <section>
              <h2>2. Review route</h2>
              <dl>
                <div><dt>ENS provider</dt><dd>{preview.selected.metadata.name}</dd></div>
                <div><dt>Price</dt><dd>{preview.selected.offer.amount} tinybars</dd></div>
                <div><dt>Recipient</dt><dd>{preview.selected.metadata.recipient}</dd></div>
                <div><dt>Network</dt><dd>{preview.selected.metadata.network}</dd></div>
                <div><dt>Readiness</dt><dd>{preview.readiness[0]?.attempts ?? 0} attempt(s)</dd></div>
              </dl>
              <div className="actions">
                <button type="button" onClick={connectWallet} disabled={busy}>{payerAccountId ? "Wallet connected" : "Connect Hedera wallet"}</button>
                <button type="button" onClick={createPaymentIntent} disabled={busy || !payerAccountId}>Create payment intent</button>
              </div>
            </section>
          )}

          {run && (
            <section>
              <h2>3. Payment and result</h2>
              <dl>
                <div><dt>Run</dt><dd>{run.runId}</dd></div>
                <div><dt>Payment</dt><dd>{run.paymentStatus}</dd></div>
                <div><dt>Execution</dt><dd>{run.status}</dd></div>
                <div><dt>Amount</dt><dd>{run.amountTinybars} tinybars</dd></div>
              </dl>
              {run.result ? <pre>{JSON.stringify(run.result, null, 2)}</pre> : (
                <div className="actions">
                  <button type="button" onClick={signAndExecute} disabled={busy || run.paymentStatus !== "RESERVED"}>Sign and execute</button>
                  <button type="button" className="secondary" onClick={refreshRun} disabled={busy}>Refresh status</button>
                  <button type="button" className="secondary" onClick={cancelRun} disabled={busy || run.paymentStatus !== "RESERVED"}>Cancel intent</button>
                  <button type="button" className="secondary" onClick={reconcileRun} disabled={busy || !["UNKNOWN", "SUBMITTING"].includes(run.paymentStatus)}>Reconcile payment</button>
                  <button type="button" className="secondary" onClick={recoverRun} disabled={busy || run.paymentStatus !== "SETTLED" || run.status === "SUCCEEDED"}>Recover result</button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
