import { describe, expect, it } from "vitest";
import { formatVariantTitle } from "../src/lib/variant-formatter";

describe("formatVariantTitle", () => {
  it("extracts parenthesized warranties and cleans title", () => {
    const res = formatVariantTitle("CapCut Pro 30 Days (Full Warranty)");
    expect(res.title).toBe("CapCut Pro 30 Days");
    expect(res.tags).toEqual(["Full Warranty"]);
  });

  it("handles multiple sub-tags inside parentheses and drops junk supplier codes", () => {
    const res = formatVariantTitle("Gemini Pro Official - 1 Year - Activation Support (Add Slot, KBH)");
    expect(res.title).toBe("Gemini Pro Official - 1 Year - Activation Support");
    expect(res.tags).toEqual(["Add Slot"]);
  });

  it("expands raw bot month notations into clean readable strings", () => {
    const res = formatVariantTitle("GEMINI PRO 18M LINK");
    expect(res.title).toBe("GEMINI PRO 18 Months Link");
  });

  it("handles Arabic variant titles gracefully", () => {
    const res = formatVariantTitle("كانفا برو سنة كاملة (حساب رسمي - ضمان كامل)");
    expect(res.title).toBe("كانفا برو سنة كاملة");
    expect(res.tags).toEqual(["حساب رسمي", "ضمان كامل"]);
  });

  it("handles titles without tags safely", () => {
    const res = formatVariantTitle("Windows 11 Pro Retail Key");
    expect(res.title).toBe("Windows 11 Pro Retail Key");
    expect(res.tags).toEqual([]);
  });
});
