import { describe, it, expect } from "vitest";
import {
  toMinor,
  fromMinor,
  applyMarkupPercent,
  applyDiscountPercent,
  enforceMinMargin,
  convertMinor,
  CURRENCY_EXPONENT,
  assertSameCurrency,
  formatMinor,
  formatIndicativeSecondary,
  sumMinor,
  allocateMinor,
  computeRefundMinor,
} from "../src/lib/money";

describe("branded type constructors", () => {
  it("toMinor accepts integers and rejects floats/negatives/non-finite/overflow", () => {
    expect(fromMinor(toMinor(1500))).toBe(1500);
    expect(() => toMinor(1.5)).toThrow();
    expect(() => toMinor(-1)).toThrow();
    expect(() => toMinor(Number.NaN)).toThrow();
    expect(() => toMinor(Infinity)).toThrow();
    expect(() => toMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  // Type-level: a raw number must not be assignable to Minor.
  // const m: Minor = 100; // <- does not typecheck (branded).
});

describe("markup rounding (round-half-up on the minor unit)", () => {
  it("exact values pass through", () => {
    expect(applyMarkupPercent(1000, 20)).toBe(1200);
  });

  it("rounds half-up at the boundary", () => {
    // 999 * 1.005 = 1003.995 -> 100400 (half-up)
    expect(applyMarkupPercent(99900, 0.5)).toBe(100400);
    // 1 cent * 1.5 = 1.5 -> 2 (half-up, not banker's rounding)
    expect(applyMarkupPercent(1, 50)).toBe(2);
    // 3 * 1.25 = 3.75 -> 4
    expect(applyMarkupPercent(3, 25)).toBe(4);
  });

  it("deterministic: same inputs, same output across many calls", () => {
    for (let i = 0; i < 100; i++) {
      expect(applyMarkupPercent(99900, 0.5)).toBe(100400);
    }
  });

  it("rejects negative cost, NaN percent, and overflow", () => {
    expect(() => applyMarkupPercent(-1, 10)).toThrow();
    expect(() => applyMarkupPercent(100, Number.NaN)).toThrow();
    expect(() => applyMarkupPercent(100, -5)).toThrow();
    expect(() => applyMarkupPercent(Number.MAX_SAFE_INTEGER, 100)).toThrow();
  });
});

describe("discount rounding", () => {
  it("applies and rounds half-up", () => {
    expect(applyDiscountPercent(1000, 25)).toBe(750);
    // 999 * 0.995 = 994.005 -> 99401
    expect(applyDiscountPercent(99900, 0.5)).toBe(99401);
    // 1 * 0.5 = 0.5 -> 1 (half-up)
    expect(applyDiscountPercent(1, 50)).toBe(1);
  });

  it("clamps at zero and rejects >100%", () => {
    expect(applyDiscountPercent(1000, 100)).toBe(0);
    expect(() => applyDiscountPercent(1000, 101)).toThrow();
  });
});

describe("enforceMinMargin", () => {
  it("ok when price covers cost + floor(cost * minMargin/100)", () => {
    const r = enforceMinMargin({ priceMinor: 1100, costMinor: 1000, minMarginPercent: 10 });
    expect(r).toEqual({ ok: true, requiredMinor: 1100 });
  });

  it("violation when a provider price hike pushes price below the floor", () => {
    const r = enforceMinMargin({ priceMinor: 1099, costMinor: 1000, minMarginPercent: 10 });
    expect(r.ok).toBe(false);
    expect(r.requiredMinor).toBe(1100);
  });

  it("uses integer floor on the margin (not round)", () => {
    // floor(105 * 10 / 100) = floor(10.5) = 10 -> required 115
    const r = enforceMinMargin({ priceMinor: 115, costMinor: 105, minMarginPercent: 10 });
    expect(r.requiredMinor).toBe(115);
    expect(r.ok).toBe(true);
    expect(enforceMinMargin({ priceMinor: 114, costMinor: 105, minMarginPercent: 10 }).ok).toBe(false);
  });
});

describe("FX exponent correctness", () => {
  it("CURRENCY_EXPONENT table", () => {
    expect(CURRENCY_EXPONENT).toEqual({ USD: 2, VND: 0, DZD: 2 });
  });

  it("VND (0 decimals) -> USD (2 decimals): no phantom 100x", () => {
    // 250,000 VND at 25,000 VND/USD = 10 USD = 1000 cents.
    // If the exponent were treated as 2, we'd get 1,000,000 cents (100x bug).
    expect(convertMinor({ amountMinor: 250000, fromCurrency: "VND", toCurrency: "USD", rate: 1 / 25000 })).toBe(1000);
  });

  it("USD -> VND with integer VND units", () => {
    // $10 at 25,000 VND/USD = 250,000 VND; VND exponent is 0, so minor == major.
    expect(convertMinor({ amountMinor: 1000, fromCurrency: "USD", toCurrency: "VND", rate: 25000 })).toBe(250000);
  });

  it("USD -> DZD (both 2 decimals)", () => {
    // $10.00 at 134.5 DZD/USD = 1345.00 DZD = 134500 centimes
    expect(convertMinor({ amountMinor: 1000, fromCurrency: "USD", toCurrency: "DZD", rate: 134.5 })).toBe(134500);
  });

  it("rounds half-up on the target minor unit", () => {
    // $0.01 -> DZD at 134.25 = 1.3425 DZD = 134.25 centimes -> 134
    expect(convertMinor({ amountMinor: 1, fromCurrency: "USD", toCurrency: "DZD", rate: 134.25 })).toBe(134);
    // $0.01 -> DZD at 134.75 = 134.75 -> 135
    expect(convertMinor({ amountMinor: 1, fromCurrency: "USD", toCurrency: "DZD", rate: 134.75 })).toBe(135);
  });

  it("unknown currency and bad rate throw", () => {
    expect(() => convertMinor({ amountMinor: 1, fromCurrency: "EUR", toCurrency: "USD", rate: 1 })).toThrow(/exponent/);
    expect(() => convertMinor({ amountMinor: 1, fromCurrency: "USD", toCurrency: "DZD", rate: 0 })).toThrow();
    expect(() => convertMinor({ amountMinor: 1, fromCurrency: "USD", toCurrency: "DZD", rate: -1 })).toThrow();
    expect(() => convertMinor({ amountMinor: 1, fromCurrency: "USD", toCurrency: "DZD", rate: Number.NaN })).toThrow();
  });

  it("assertSameCurrency", () => {
    expect(() => assertSameCurrency("USD", "usd")).not.toThrow();
    expect(() => assertSameCurrency("USD", "VND")).toThrow(/mismatch/);
  });
});

describe("formatting (Intl only)", () => {
  it("en locale USD", () => {
    expect(formatMinor({ amountMinor: 123456, currency: "USD", locale: "en" })).toBe("$1,234.56");
  });

  it("fr locale USD", () => {
    const s = formatMinor({ amountMinor: 123456, currency: "USD", locale: "fr" });
    expect(s).toContain("1");
    expect(s).toContain("234,56");
  });

  it("ar locale maps to ar-DZ for DZD (2 fraction digits, Arabic symbol)", () => {
    // 13500 centimes = 135.00 DZD; ar-DZ renders "135,00" with the د.ج symbol
    // (which itself contains "." — so no naive "no dots" assertion here).
    const s = formatMinor({ amountMinor: 13500, currency: "DZD", locale: "ar" });
    expect(s).toContain("135,00");
    expect(s).toContain("د.ج");
  });

  it("VND formats with no decimals", () => {
    const s = formatMinor({ amountMinor: 250000, currency: "VND", locale: "en" });
    expect(s).toBe("₫250,000");
  });

  it("formatIndicativeSecondary labels the DZD line as approximate", () => {
    const s = formatIndicativeSecondary({ amountMinor: 1000, currency: "DZD", rate: 134, locale: "en" });
    expect(s.startsWith("≈ ")).toBe(true);
    expect(s).toContain("DZD");
  });
});

describe("sumMinor / allocateMinor", () => {
  it("sums and throws on overflow", () => {
    expect(sumMinor(1, 2, 3)).toBe(6);
    expect(() => sumMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(() => sumMinor(1.5)).toThrow();
  });

  it("allocateMinor conserves the total exactly across many random splits", () => {
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let t = 0; t < 500; t++) {
      const total = Math.floor(rand() * 100000);
      const n = 1 + Math.floor(rand() * 8);
      const weights = Array.from({ length: n }, () => Math.floor(rand() * 100));
      if (Math.max(...weights) === 0) weights[0] = 1;
      const out = allocateMinor(total, weights);
      const sum = out.reduce((s, x) => s + x, 0);
      expect(sum).toBe(total); // no lost or invented cents
      expect(out.every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
    }
  });

  it("distributes remainder pennies by largest remainder (deterministic ties)", () => {
    expect(allocateMinor(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateMinor(10, [0, 1])).toEqual([0, 10]);
    expect(() => allocateMinor(10, [])).toThrow();
    expect(() => allocateMinor(10, [0, 0])).toThrow();
  });
});

describe("partial-refund math", () => {
  it("refunds only the undelivered portion", () => {
    expect(computeRefundMinor({ unitPriceMinor: 500, orderedQty: 10, deliveredQty: 7 })).toBe(1500);
    expect(computeRefundMinor({ unitPriceMinor: 500, orderedQty: 10, deliveredQty: 10 })).toBe(0);
    expect(computeRefundMinor({ unitPriceMinor: 500, orderedQty: 10, deliveredQty: 0 })).toBe(5000);
  });

  it("clamps at zero when delivered exceeds ordered (Canboso bonusQuantity)", () => {
    expect(computeRefundMinor({ unitPriceMinor: 500, orderedQty: 10, deliveredQty: 15 })).toBe(0);
    expect(computeRefundMinor({ unitPriceMinor: 500, orderedQty: 10, deliveredQty: 999 })).toBe(0);
  });

  it("rejects invalid quantities", () => {
    expect(() => computeRefundMinor({ unitPriceMinor: 500, orderedQty: -1, deliveredQty: 0 })).toThrow();
    expect(() => computeRefundMinor({ unitPriceMinor: 500, orderedQty: 1.5, deliveredQty: 0 })).toThrow();
    expect(() => computeRefundMinor({ unitPriceMinor: 500, orderedQty: 1, deliveredQty: -1 })).toThrow();
  });
});