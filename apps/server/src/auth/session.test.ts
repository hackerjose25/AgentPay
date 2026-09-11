import { describe, expect, it } from "vitest";
import { issueSession, readCookie, secretMatches, verifySession } from "./session.js";

const secret = "s".repeat(32);

describe("demo sessions", () => {
  it("issues, verifies and expires an authenticated session", () => {
    const { token, claims } = issueSession(secret, 1_000);
    expect(verifySession(token, secret, 1_001)).toEqual(claims);
    expect(verifySession(token, "x".repeat(32), 1_001)).toBeNull();
    expect(verifySession(token, secret, claims.expiresAt)).toBeNull();
  });

  it("compares secrets without accepting unequal lengths and reads exact cookies", () => {
    expect(secretMatches("demo-code-123", "demo-code-123")).toBe(true);
    expect(secretMatches("demo-code-12", "demo-code-123")).toBe(false);
    expect(readCookie("other=1; agentpay_session=abc.def", "agentpay_session")).toBe("abc.def");
  });
});
