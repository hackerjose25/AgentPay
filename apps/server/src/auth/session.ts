import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const sessionCookieName = "agentpay_session";
export const sessionTtlSeconds = 2 * 60 * 60;

const claimsSchema = z.object({
  sessionId: z.string().uuid(),
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive()
});

export type SessionClaims = z.infer<typeof claimsSchema>;

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function secretMatches(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueSession(secret: string, now = Date.now()): { token: string; claims: SessionClaims } {
  const claims: SessionClaims = {
    sessionId: randomUUID(),
    csrfToken: createHmac("sha256", secret).update(randomUUID()).digest("hex"),
    expiresAt: now + sessionTtlSeconds * 1_000
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${payload}.${signature(payload, secret).toString("base64url")}`, claims };
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  const payload = parts[0];
  const encodedSignature = parts[1];
  if (!payload || !encodedSignature || parts.length !== 2) return null;
  let received: Buffer;
  try {
    received = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  const expected = signature(payload, secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return claims.expiresAt > now ? claims : null;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}
