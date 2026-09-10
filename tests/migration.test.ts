import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/001_initial.sql", import.meta.url);

describe("initial persistence migration", () => {
  it("contains the release-blocking durability constraints", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("UNIQUE (session_id, idempotency_key)");
    expect(sql).toContain("UNIQUE (transaction_reference)");
    expect(sql).toContain("payer_budget_locks");
    expect(sql).toContain("'UNKNOWN'");
    expect(sql).toContain("execution_lease_expires_at");
  });
});

