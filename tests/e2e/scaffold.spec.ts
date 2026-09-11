import { expect, test } from "@playwright/test";

test("minimal browser integration harness exposes the session boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Invoice extraction" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo access" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
});
