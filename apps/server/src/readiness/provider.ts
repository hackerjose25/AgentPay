export type ReadinessFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface ProviderReadinessOptions {
  totalTimeoutMs?: number;
  attemptTimeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  fetcher?: ReadinessFetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface ProviderReadinessResult {
  attempts: number;
  waitedMs: number;
}

export class ProviderReadinessError extends Error {
  readonly code = "PROVIDER_READINESS_TIMEOUT";

  constructor() {
    super("provider did not become ready before the pre-payment deadline");
    this.name = "ProviderReadinessError";
  }
}

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds);
});

export async function waitForProviderReadiness(
  offerUrl: URL,
  options: ProviderReadinessOptions = {}
): Promise<ProviderReadinessResult> {
  const totalTimeoutMs = options.totalTimeoutMs ?? 90_000;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 25_000;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = now();
  const deadline = startedAt + totalTimeoutMs;
  let attempts = 0;
  let delayMs = initialDelayMs;

  while (now() < deadline) {
    attempts += 1;
    const remainingMs = Math.max(1, deadline - now());
    try {
      const response = await fetcher(offerUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(attemptTimeoutMs, remainingMs))
      });
      if (response.ok) {
        await response.body?.cancel();
        return { attempts, waitedMs: now() - startedAt };
      }
      await response.body?.cancel();
    } catch {
      // A cold service can reset or time out the wake-up request. Retry only
      // inside this read-only phase; no budget has been reserved or signed.
    }

    const remainingAfterAttempt = deadline - now();
    if (remainingAfterAttempt <= 0) break;
    await sleep(Math.min(delayMs, remainingAfterAttempt));
    delayMs = Math.min(delayMs * 2, maxDelayMs);
  }

  throw new ProviderReadinessError();
}
