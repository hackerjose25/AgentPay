import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeEnvPath } from "./config.js";

describe("runtime environment path", () => {
  it("is anchored to the repository root instead of the workspace current directory", () => {
    expect(runtimeEnvPath).toBe(resolve(process.cwd(), ".env"));
  });
});
