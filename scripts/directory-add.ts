import { normalize } from "viem/ens";
import { Client } from "pg";
import { resolveProviderMetadata } from "../apps/server/src/ens/resolver.js";
import { loadRootEnv, requiredValue } from "./shared.js";

loadRootEnv();
const nameIndex = process.argv.indexOf("--name");
const suppliedName = nameIndex >= 0 ? process.argv[nameIndex + 1] : undefined;
if (!suppliedName) throw new Error("usage: npm run directory:add -- --name <provider.eth>");
const name = normalize(suppliedName);
const metadata = await resolveProviderMetadata(name, requiredValue("ENS_RPC_URL"));
const client = new Client({ connectionString: requiredValue("DATABASE_URL") });
await client.connect();
try {
  await client.query(`
    INSERT INTO providers (ens_name, enrollment_status)
    VALUES ($1, 'ACTIVE')
    ON CONFLICT (ens_name) DO UPDATE SET enrollment_status = 'ACTIVE', updated_at = now()
  `, [metadata.name]);
  process.stdout.write(`enrolled ${metadata.name}\n`);
} finally {
  await client.end();
}

