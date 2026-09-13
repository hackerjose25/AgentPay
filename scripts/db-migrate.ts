import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { loadRootEnv, projectRoot, requiredValue } from "./shared.js";

loadRootEnv();
const connectionString = requiredValue("DATABASE_URL");
const migrationsDirectory = resolve(projectRoot, "migrations");
const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('agentpay-migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const filenames = (await readdir(migrationsDirectory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const filename of filenames) {
    const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
    const normalizedSql = sql.replace(/\r\n/g, "\n");
    const checksum = createHash("sha256").update(normalizedSql).digest("hex");
    const existing = await client.query<{ checksum: string }>("SELECT checksum FROM schema_migrations WHERE filename = $1", [filename]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`applied migration ${filename} was modified`);
      process.stdout.write(`already applied: ${filename}\n`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)", [filename, checksum]);
      await client.query("COMMIT");
      process.stdout.write(`applied: ${filename}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('agentpay-migrations'))").catch(() => undefined);
  await client.end();
}

