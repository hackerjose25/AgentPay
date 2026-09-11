import type { RequestHandler } from "express";
import { HttpError } from "./errors.js";

interface RateWindow {
  count: number;
  resetsAt: number;
}

export function createRateLimit(options: {
  max: number;
  windowMs: number;
  key: (request: Parameters<RequestHandler>[0]) => string;
}): RequestHandler {
  const windows = new Map<string, RateWindow>();
  return (request, response, next) => {
    const now = Date.now();
    const key = options.key(request);
    const current = windows.get(key);
    const window = !current || current.resetsAt <= now
      ? { count: 0, resetsAt: now + options.windowMs }
      : current;
    window.count += 1;
    windows.set(key, window);
    if (windows.size > 5_000) {
      for (const [candidate, value] of windows) if (value.resetsAt <= now) windows.delete(candidate);
    }
    response.setHeader("ratelimit-limit", options.max);
    response.setHeader("ratelimit-remaining", Math.max(0, options.max - window.count));
    response.setHeader("ratelimit-reset", Math.ceil(window.resetsAt / 1_000));
    if (window.count > options.max) {
      response.setHeader("retry-after", Math.ceil((window.resetsAt - now) / 1_000));
      throw new HttpError("RATE_LIMITED", "Too many requests; wait before trying again", 429, true);
    }
    next();
  };
}
