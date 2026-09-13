import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./rate-limit.js";

describe("rate limiter", () => {
  it("rejects requests after the configured limit", () => {
    const middleware = createRateLimit({ max: 1, windowMs: 60_000, key: () => "one" });
    const response = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();
    middleware({} as Request, response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(() => middleware({} as Request, response, next)).toThrowError(/Too many requests/);
  });
});
