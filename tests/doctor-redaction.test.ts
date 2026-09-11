import { describe, expect, it } from "vitest";
import { safeErrorDetail } from "../scripts/shared.js";

describe("doctor error redaction", () => {
  it("does not expose credential-bearing error messages", () => {
    const error = new Error("request failed for https://rpc.example/v2/secret-api-key");
    expect(safeErrorDetail("ens-rpc", error)).toBe("ens-rpc check failed");
  });

  it("keeps only a safe machine error code", () => {
    const error = Object.assign(new Error("getaddrinfo ENOTFOUND secret-host.example"), { code: "ENOTFOUND" });
    expect(safeErrorDetail("database", error)).toBe("database check failed (ENOTFOUND)");
  });
});
