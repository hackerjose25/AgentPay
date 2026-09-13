import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InvoiceImageError, validateInvoiceImage } from "./image.js";

const fixturePath = resolve(process.cwd(), "fixtures/synthetic-invoice.png");

describe("invoice image validation", () => {
  it("accepts the synthetic PNG and reports its dimensions", async () => {
    const bytes = await readFile(fixturePath);
    const image = validateInvoiceImage(bytes, "image/png", { maxBytes: 5_000_000, maxPixels: 20_000_000 });

    expect(image.mimeType).toBe("image/png");
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  });

  it("rejects a declared type that differs from the file signature", async () => {
    const bytes = await readFile(fixturePath);
    expect(() => validateInvoiceImage(bytes, "image/jpeg", { maxBytes: 5_000_000, maxPixels: 20_000_000 }))
      .toThrowError(InvoiceImageError);
  });

  it("enforces byte and decoded-pixel limits", async () => {
    const bytes = await readFile(fixturePath);
    expect(() => validateInvoiceImage(bytes, "image/png", { maxBytes: bytes.length - 1, maxPixels: 20_000_000 }))
      .toThrowError(/byte limit/);
    expect(() => validateInvoiceImage(bytes, "image/png", { maxBytes: 5_000_000, maxPixels: 1 }))
      .toThrowError(/pixel limit/);
  });
});
