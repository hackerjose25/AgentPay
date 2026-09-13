'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AgentPayApi,
  RoutePreview,
  RunView,
  ProviderService,
  SessionState,
} from '@/lib/agentpay';
import { useWallet } from './WalletContext';

export interface RunContextType {
  api: AgentPayApi;
  session: SessionState | null;
  services: ProviderService[];
  routePreview: RoutePreview | null;
  activeRun: RunView | null;
  isRunning: boolean;
  isCompleted: boolean;
  error: string | null;
  message: string | null;
  selectedFile: File | null;
  taskCapability: 'invoice-extraction' | 'invoice-qa';
  prompt: string;
  question: string;
  budgetHbar: string;
  setSelectedFile: (file: File | null) => void;
  setTaskCapability: (cap: 'invoice-extraction' | 'invoice-qa') => void;
  setPrompt: (prompt: string) => void;
  setQuestion: (q: string) => void;
  setBudgetHbar: (budget: string) => void;
  unlockSession: (code: string) => Promise<void>;
  previewRoute: () => Promise<void>;
  createPaymentIntent: () => Promise<void>;
  signAndExecute: () => Promise<void>;
  cancelActiveRun: () => Promise<void>;
  reconcileActiveRun: () => Promise<void>;
  recoverActiveRun: () => Promise<void>;
  refreshRunState: () => Promise<void>;
  refreshServices: () => Promise<void>;
  logoutSession: () => Promise<void>;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

// Helper to generate a synthetic invoice PNG image file if user does not upload one
export async function getSyntheticInvoiceFile(): Promise<File> {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" fill="none">
    <rect width="600" height="800" fill="#ffffff"/>
    <text x="40" y="60" font-family="monospace" font-size="24" font-weight="bold" fill="#111827">INVOICE #INV-2026-0912</text>
    <text x="40" y="100" font-family="sans-serif" font-size="14" fill="#4B5563">Vendor: Meridian Labs GmbH</text>
    <text x="40" y="120" font-family="sans-serif" font-size="14" fill="#4B5563">Client: AegisPay Research</text>
    <text x="40" y="140" font-family="sans-serif" font-size="14" fill="#4B5563">Date: 2026-09-12</text>
    <line x1="40" y1="170" x2="560" y2="170" stroke="#E5E7EB" stroke-width="2"/>
    <text x="40" y="210" font-family="sans-serif" font-size="14" font-weight="bold" fill="#111827">Description</text>
    <text x="440" y="210" font-family="sans-serif" font-size="14" font-weight="bold" fill="#111827">Amount</text>
    <text x="40" y="250" font-family="sans-serif" font-size="14" fill="#374151">Neural inference cluster (8x H100) — 48h</text>
    <text x="440" y="250" font-family="sans-serif" font-size="14" fill="#374151">$1,920.00</text>
    <text x="40" y="280" font-family="sans-serif" font-size="14" fill="#374151">Data egress (1.2 TB)</text>
    <text x="440" y="280" font-family="sans-serif" font-size="14" fill="#374151">$86.40</text>
    <text x="40" y="310" font-family="sans-serif" font-size="14" fill="#374151">Storage (2.4 TB x 30 d)</text>
    <text x="440" y="310" font-family="sans-serif" font-size="14" fill="#374151">$144.00</text>
    <line x1="40" y1="350" x2="560" y2="350" stroke="#E5E7EB" stroke-width="1"/>
    <text x="350" y="390" font-family="sans-serif" font-size="14" fill="#4B5563">Subtotal:</text>
    <text x="440" y="390" font-family="sans-serif" font-size="14" fill="#374151">$2,150.40</text>
    <text x="350" y="420" font-family="sans-serif" font-size="14" fill="#4B5563">Tax (7.25%):</text>
    <text x="440" y="420" font-family="sans-serif" font-size="14" fill="#374151">$155.90</text>
    <text x="350" y="460" font-family="sans-serif" font-size="18" font-weight="bold" fill="#111827">TOTAL DUE:</text>
    <text x="440" y="460" font-family="sans-serif" font-size="18" font-weight="bold" fill="#111827">$2,306.30</text>
  </svg>`;

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });

  return new Promise<File>((resolve) => {
    canvas.toBlob((b) => {
      const file = new File([b!], 'synthetic-invoice.png', { type: 'image/png' });
      resolve(file);
    }, 'image/png');
  });
}

export function RunProvider({ children }: { children: React.ReactNode }) {
  const { address, createPaymentSignature, disconnect } = useWallet();
  const [api] = useState(() => new AgentPayApi());

  const [session, setSession] = useState<SessionState | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [activeRun, setActiveRun] = useState<RunView | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [taskCapability, setTaskCapability] = useState<'invoice-extraction' | 'invoice-qa'>('invoice-extraction');
  const [prompt, setPrompt] = useState('Extract text and total due from this invoice');
  const [question, setQuestion] = useState('What is the total amount due on this invoice?');
  const [budgetHbar, setBudgetHbar] = useState('0.05');

  const unlockSession = useCallback(async (code: string) => {
    setError(null);
    try {
      const sess = await api.unlock(code);
      setSession(sess);
      setMessage("Session active.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Unlock error: ${msg}`);
      throw err;
    }
  }, [api]);

  const logoutSession = useCallback(async () => {
    setError(null);
    try {
      await api.logout();
      disconnect();
      setSession(null);
      setRoutePreview(null);
      setActiveRun(null);
      setMessage("Session closed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Logout error: ${msg}`);
    }
  }, [api, disconnect]);

  const refreshServices = useCallback(async () => {
    try {
      const list = await api.getServices();
      if (list && Array.isArray(list)) {
        setServices(list);
      }
    } catch (err: unknown) {
      console.warn("Failed to fetch services from backend:", err);
    }
  }, [api]);

  useEffect(() => {
    api.getSession().then((s) => setSession(s)).catch(() => undefined);
    refreshServices();
  }, [api, refreshServices]);

  // Step 1: Preview route live from backend server
  const previewRoute = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setMessage("Resolving ENSv2 records & evaluating policy router...");

    try {
      const tinybars = Math.round(parseFloat(budgetHbar) * 100_000_000).toString();
      const taskName = taskCapability === 'invoice-qa' ? `invoice-qa: ${question}` : 'invoice-extraction';
      const preview = await api.preview(taskName, tinybars);
      setRoutePreview(preview);
      setMessage(`Route selected: ${preview.selected.metadata.name} (${preview.selected.offer.amount} tinybars).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Route preview error: ${msg}`);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [api, budgetHbar, taskCapability, question]);

  // Step 2: Create Payment Intent on backend server
  const createPaymentIntent = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setMessage("Creating payment intent on server...");

    try {
      const tinybars = Math.round(parseFloat(budgetHbar) * 100_000_000).toString();
      const invoiceFile = selectedFile || (await getSyntheticInvoiceFile());
      const payerAccountId = address || '0.0.5902184';
      const idempotencyKey = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const run = await api.createRun(
        {
          task: taskCapability,
          maxSpendTinybars: tinybars,
          payerAccountId,
          invoice: invoiceFile,
          ...(taskCapability === 'invoice-qa' && question.trim() ? { question: question.trim() } : {}),
        },
        idempotencyKey
      );

      setActiveRun(run);
      setMessage(`Payment intent reserved: ${run.runId}. Ready for wallet payment signature.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Create run error: ${msg}`);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [api, selectedFile, budgetHbar, address, taskCapability, question]);

  // Step 3: Sign payment with Hedera/HashPack wallet & Execute on backend
  const signAndExecute = useCallback(async () => {
    if (!activeRun || !activeRun.paymentRequired) {
      const msg = "No payment required terms found for the active run.";
      setError(msg);
      throw new Error(msg);
    }

    if (new Date(activeRun.expiresAt).getTime() <= Date.now()) {
      const msg = "Payment intent expired. Cancel and create a new intent.";
      setError(msg);
      throw new Error(msg);
    }

    setIsRunning(true);
    setError(null);
    setMessage("Waiting for Hedera wallet signature approval...");

    try {
      const paymentSignature = await createPaymentSignature(activeRun.paymentRequired);
      setMessage("Submitting signed x402 payment to server & executing AI inference...");

      const completed = await api.execute(activeRun.runId, paymentSignature);
      setActiveRun(completed);

      if (completed.status === 'SUCCEEDED') {
        setIsCompleted(true);
        setMessage("Run complete! Extraction result delivered.");
      } else {
        setMessage(`Run execution status: ${completed.status} / ${completed.paymentStatus}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Execution error: ${msg}`);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [api, activeRun, createPaymentSignature]);

  const refreshRunState = useCallback(async () => {
    if (!activeRun) return;
    setError(null);
    try {
      const refreshed = await api.getRun(activeRun.runId);
      setActiveRun(refreshed);
      setMessage(`Refreshed run status: ${refreshed.status} / ${refreshed.paymentStatus}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Refresh error: ${msg}`);
    }
  }, [activeRun, api]);

  const cancelActiveRun = useCallback(async () => {
    if (!activeRun) return;
    setIsRunning(true);
    setError(null);
    try {
      const view = await api.cancel(activeRun.runId);
      setActiveRun(view);
      setIsRunning(false);
      setMessage("Unsigned payment intent canceled. Budget reservation released.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Cancel error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  }, [activeRun, api]);

  const reconcileActiveRun = useCallback(async () => {
    if (!activeRun) return;
    setIsRunning(true);
    setError(null);
    try {
      const view = await api.reconcile(activeRun.runId);
      setActiveRun(view);
      setMessage(`Reconciliation result: ${view.paymentStatus}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Reconcile error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  }, [activeRun, api]);

  const recoverActiveRun = useCallback(async () => {
    if (!activeRun) return;
    setIsRunning(true);
    setError(null);
    try {
      setMessage("Recovering paid extraction result from backend...");
      const view = await api.recover(activeRun.runId);
      setActiveRun(view);
      if (view.status === 'SUCCEEDED') {
        setIsCompleted(true);
        setMessage("Result successfully recovered at zero additional cost.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Recover error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  }, [activeRun, api]);

  return (
    <RunContext.Provider
      value={{
        api,
        session,
        services,
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
        refreshServices,
        logoutSession,
      }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRun() {
  const context = useContext(RunContext);
  if (!context) {
    throw new Error('useRun must be used within a RunProvider');
  }
  return context;
}
