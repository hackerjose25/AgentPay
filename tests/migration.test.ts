import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/001_initial.sql", import.meta.url);
const qaMigrationUrl = new URL("../migrations/003_invoice_qa.sql", import.meta.url);

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

describe("invoice-qa migration", () => {
  it("widens the runs capability constraint and adds the question column", async () => {
    const sql = await readFile(qaMigrationUrl, "utf8");
    expect(sql).toContain("DROP CONSTRAINT runs_capability_check");
    expect(sql).toContain("capability IN ('invoice-extraction', 'invoice-qa')");
    expect(sql).toContain("ADD COLUMN question text");
    expect(sql).toContain("(capability = 'invoice-qa') = (question IS NOT NULL)");
  });
});

