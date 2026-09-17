import { describe, expect, it } from "vitest";
import { computeOfferPrice, usdRateFor, type LinkQuote } from "../src/lib/pricing";

const link = (over: Partial<LinkQuote> = {}): LinkQuote => ({
  providerOfferId: "po1",
  priority: 1,
  isEnabled: true,
  availability: "AVAILABLE",
  costMinor: 500, // $5.00
  currency: "USD",
  ...over,
});

describe("usdRateFor", () => {
  it("USD is always 1, others come from env, garbage is null", () => {
    expect(usdRateFor("USD", {})).toBe(1);
    expect(usdRateFor("usd", {})).toBe(1);
    expect(usdRateFor("VND", { FX_RATE_VND_USD: "0.00004" })).toBe(0.00004);
    expect(usdRateFor("VND", {})).toBeNull();
    expect(usdRateFor("VND", { FX_RATE_VND_USD: "nope" })).toBeNull();
    expect(usdRateFor("VND", { FX_RATE_VND_USD: "-1" })).toBeNull();
  });
});

describe("computeOfferPrice", () => {
  it("applies markup on the cheapest available link", () => {
    const r = computeOfferPrice({ links: [link()], markupPercent: 20 });
    expect(r).toMatchObject({ available: true, priceMinor: 600, costMinor: 500 });
  });

  it("picks cheapest USD cost across currencies (VND exponent 0, no 100x)", () => {
    // 100000 VND minor = 100000 major (exp 0) * 0.00004 = $4.00 = 400 minor — beats $5 USD link
    const r = computeOfferPrice({
      links: [
        link({ providerOfferId: "usd5" }),
        link({ providerOfferId: "vnd4", costMinor: 100000, currency: "VND", priority: 9 }),
      ],
      markupPercent: 0,
      env: { FX_RATE_VND_USD: "0.00004" },
    });
    expect(r).toMatchObject({
      available: true,
      priceMinor: 400,
      providerOfferId: "vnd4",
      breakdown: { sourceCurrency: "VND", fxRate: 0.00004 },
    });
  });

  it("breaks cost ties by lower priority", () => {
    const r = computeOfferPrice({
      links: [link({ providerOfferId: "b", priority: 2 }), link({ providerOfferId: "a", priority: 1 })],
      markupPercent: 0,
    });
    expect(r).toMatchObject({ available: true, providerOfferId: "a" });
  });

  it("tier override replaces price exactly, no discount stacked", () => {
    const r = computeOfferPrice({
      links: [link()],
      markupPercent: 50, // afterMarkup 750
      tier: { discountPercent: 10, overridePriceMinor: 700 },
    });
    expect(r).toMatchObject({
      available: true,
      priceMinor: 700,
      breakdown: { overrideApplied: true, afterMarkupMinor: 750 },
    });
  });

  it("tier discount applies after markup when no override", () => {
    const r = computeOfferPrice({
      links: [link()],
      markupPercent: 100, // 1000
      tier: { discountPercent: 10 }, // 900
    });
    expect(r).toMatchObject({ available: true, priceMinor: 900, breakdown: { overrideApplied: false } });
  });

  it("never sells below cost: bad override clamps and flags", () => {
    const r = computeOfferPrice({
      links: [link()],
      markupPercent: 20,
      tier: { discountPercent: 0, overridePriceMinor: 300 }, // below $5 cost
    });
    expect(r).toMatchObject({ available: true, priceMinor: 500, breakdown: { clampedToCost: true } });
  });

  it("NO_ENABLED_LINK when nothing is enabled", () => {
    expect(computeOfferPrice({ links: [link({ isEnabled: false })], markupPercent: 10 })).toEqual({
      available: false,
      reason: "NO_ENABLED_LINK",
    });
    expect(computeOfferPrice({ links: [], markupPercent: 10 })).toEqual({
      available: false,
      reason: "NO_ENABLED_LINK",
    });
  });

  it("OUT_OF_STOCK when enabled links exist but none AVAILABLE", () => {
    expect(
      computeOfferPrice({
        links: [link({ availability: "OUT_OF_STOCK" }), link({ availability: "UNKNOWN" })],
        markupPercent: 10,
      }),
    ).toEqual({ available: false, reason: "OUT_OF_STOCK" });
  });

  it("NO_FX_RATE when the only in-stock link has an unconfigured currency", () => {
    expect(
      computeOfferPrice({
        links: [link({ currency: "VND", costMinor: 100000 })],
        markupPercent: 10,
        env: {},
      }),
    ).toEqual({ available: false, reason: "NO_FX_RATE" });
  });

  it("skips unpriceable links but still sells via a priceable one", () => {
    const r = computeOfferPrice({
      links: [link({ currency: "VND", costMinor: 1, priority: 1 }), link({ providerOfferId: "usd", priority: 2 })],
      markupPercent: 0,
      env: {},
    });
    expect(r).toMatchObject({ available: true, providerOfferId: "usd" });
  });
});
