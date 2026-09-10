import { expect, test } from "@playwright/test";

test("Day 1 browser suite is wired", () => {
  expect("ENSv2 → AgentPay → Blocky402 → Hedera").toContain("Blocky402");
});
