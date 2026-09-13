import { isIP } from "node:net";

const forbiddenHostnames = new Set(["localhost", "metadata.google.internal"]);

function isForbiddenIp(hostname: string): boolean {
  if (!isIP(hostname)) return false;
  return /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(hostname);
}

export function validateServiceEndpoint(value: string, allowedOrigins: ReadonlySet<string>, allowLocalHttp: boolean): URL {
  const url = new URL(value);
  if (url.username || url.password) throw new Error("endpoint userinfo is forbidden");
  if (forbiddenHostnames.has(url.hostname) && !allowLocalHttp) throw new Error("local endpoint is forbidden");
  if (isForbiddenIp(url.hostname) && !allowLocalHttp) throw new Error("private or metadata endpoint is forbidden");
  if (url.protocol !== "https:" && !(allowLocalHttp && url.protocol === "http:")) throw new Error("endpoint protocol is forbidden");
  if (!allowedOrigins.has(url.origin)) throw new Error("endpoint origin is not allowlisted");
  return url;
}

