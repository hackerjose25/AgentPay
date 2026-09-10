import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..");

export function loadRootEnv(filename = ".env"): NodeJS.ProcessEnv {
  loadDotenv({ path: resolve(projectRoot, filename), quiet: true });
  return process.env;
}

export function hasPlaceholder(value: string | undefined): boolean {
  return !value || /(?:REPLACE_ME|YOUR_|USER:PASSWORD|CHANGE_ME)/i.test(value);
}

export function requiredValue(name: string, environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment[name];
  if (hasPlaceholder(value)) throw new Error(`${name} is missing or still contains a placeholder`);
  return value!;
}

export function jsonLog(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

