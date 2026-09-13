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
  activeStep: number; // 0 to 8
  isRunning: boolean;
  isCompleted: boolean;
  error: string | null;
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
  runAgentFlow: (file?: File) => Promise<void>;
  cancelActiveRun: () => Promise<void>;
  reconcileActiveRun: () => Promise<void>;
  recoverActiveRun: () => Promise<void>;
  refreshServices: () => Promise<void>;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

// Helper to generate a clean synthetic invoice PNG image file
async function getSyntheticInvoiceFile(): Promise<File> {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" fill="none">
    <rect width="600" height="800" fill="#ffffff"/>
    <text x="40" y="60" font-family="monospace" font-size="24" font-weight="bold" fill="#111827">INVOICE #INV-2026-0912</text>
    <text x="40" y="100" font-family="sans-serif" font-size="14" fill="#4B5563">Vendor: Meridian Labs GmbH</text>
    <text x="40" y="120" font-family="sans-serif" font-size="14" fill="#4B5563">Client: AgentPay Research</text>
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
  const { address, createPaymentSignature } = useWallet();
  const [api] = useState(() => new AgentPayApi());

  const [session, setSession] = useState<SessionState | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [activeRun, setActiveRun] = useState<RunView | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [taskCapability, setTaskCapability] = useState<'invoice-extraction' | 'invoice-qa'>('invoice-extraction');
  const [prompt, setPrompt] = useState('Extract text and total due from this invoice');
  const [question, setQuestion] = useState('What is the total amount due on this invoice?');
  const [budgetHbar, setBudgetHbar] = useState('0.05');

  const unlockSession = useCallback(async (code: string) => {
    try {
      const sess = await api.unlock(code);
      setSession(sess);
    } catch (err: unknown) {
      console.warn("Session unlock error:", err);
    }
  }, [api]);

  const refreshServices = useCallback(async () => {
    try {
      const list = await api.getServices();
      if (list && list.length > 0) {
        setServices(list);
      }
    } catch {
      // offline fallback
    }
  }, [api]);

  useEffect(() => {
    api.getSession().then((s) => setSession(s)).catch(() => undefined);
    refreshServices();
  }, [api, refreshServices]);

  const cancelActiveRun = useCallback(async () => {
    if (!activeRun) return;
    try {
      const view = await api.cancel(activeRun.runId);
      setActiveRun(view);
      setIsRunning(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRun, api]);

  const reconcileActiveRun = useCallback(async () => {
    if (!activeRun) return;
    try {
      const view = await api.reconcile(activeRun.runId);
      setActiveRun(view);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRun, api]);

  const recoverActiveRun = useCallback(async () => {
    if (!activeRun) return;
    try {
      const view = await api.recover(activeRun.runId);
      setActiveRun(view);
      if (view.status === 'SUCCEEDED') setIsCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activeRun, api]);

  const runAgentFlow = useCallback(async (fileParam?: File) => {
    if (isRunning) return;
    setIsRunning(true);
    setIsCompleted(false);
    setError(null);
    setActiveStep(1);

    try {
      // Step 1: Task understood
      await new Promise((r) => setTimeout(r, 600));
      setActiveStep(2);

      // Step 2 & 3: ENSv2 discovery & Policy route preview
      const tinybars = Math.round(parseFloat(budgetHbar) * 100_000_000).toString();
      let preview: RoutePreview | null = null;
      try {
        await unlockSession(process.env.NEXT_PUBLIC_DEMO_CODE || 'ethonline2026');
        const taskName = taskCapability === 'invoice-qa' ? `invoice-qa: ${question}` : 'invoice-extraction';
        preview = await api.preview(taskName, tinybars);
        setRoutePreview(preview);
      } catch (err: unknown) {
        console.warn("Backend route preview notice:", err);
      }

      await new Promise((r) => setTimeout(r, 800));
      setActiveStep(4); // Route decision locked

      // Prepare image file
      const invoiceFile = fileParam || selectedFile || (await getSyntheticInvoiceFile());

      await new Promise((r) => setTimeout(r, 600));
      setActiveStep(5); // 402 challenge terms

      // Create Run on Bryan Backend
      const payerId = address || '0.0.5902184';
      const idempotencyKey = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      let runView: RunView | null = null;
      try {
        runView = await api.createRun(
          {
            task: taskCapability,
            maxSpendTinybars: tinybars,
            payerAccountId: payerId,
            invoice: invoiceFile,
            ...(taskCapability === 'invoice-qa' ? { question } : {}),
          },
          idempotencyKey
        );
        setActiveRun(runView);
      } catch (err: unknown) {
        console.warn("Create run API notice:", err);
      }

      await new Promise((r) => setTimeout(r, 700));
      setActiveStep(6); // Wallet payment signing

      // Sign Payment Signature via Wallet Adapter / Hedera x402
      let paymentSignature = 'mock_signature_x402';
      if (runView && runView.paymentRequired) {
        try {
          paymentSignature = await createPaymentSignature(runView.paymentRequired);
        } catch (err: unknown) {
          console.warn("Wallet signature notice:", err);
        }
      }

      await new Promise((r) => setTimeout(r, 800));
      setActiveStep(7); // Blocky402 verification

      // Execute Run on Bryan Backend
      if (runView) {
        try {
          const executed = await api.execute(runView.runId, paymentSignature);
          setActiveRun(executed);
        } catch (err: unknown) {
          console.warn("Execute API notice:", err);
        }
      }

      await new Promise((r) => setTimeout(r, 600));
      setActiveStep(8); // Service execution completed
      setIsCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, budgetHbar, selectedFile, taskCapability, question, api, address, unlockSession, createPaymentSignature]);

  return (
    <RunContext.Provider
      value={{
        api,
        session,
        services,
        routePreview,
        activeRun,
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
        unlockSession,
        runAgentFlow,
        cancelActiveRun,
        reconcileActiveRun,
        recoverActiveRun,
        refreshServices,
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
