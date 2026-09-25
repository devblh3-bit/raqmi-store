/**
 * Pricing engine (plan §4). Accounting currency is USD minor units.
 * Provider costs may be VND (exponent 0) — converted via env
 * `FX_RATE_<CUR>_USD` = USD per 1 <CUR> major unit (e.g. FX_RATE_VND_USD=0.00004).
 * ponytail: env-var FX rates, no rate table/history; upgrade path is an FxRate
 * model refreshed by cron when non-USD providers go live for real.
 */
import { prisma } from "./db";
import { applyMarkupPercent, applyDiscountPercent, convertMinor } from "./money";

export type LinkQuote = {
  providerOfferId: string;
  priority: number; // lower = preferred (fulfillment order); pricing tie-break only
  isEnabled: boolean;
  availability: string; // AVAILABLE | OUT_OF_STOCK | UNKNOWN
  costMinor: number; // minor units of `currency`
  currency: string;
};

export type PriceBreakdown = {
  sourceCurrency: string;
  fxRate: number | null; // null when source is USD
  markupPercent: number;
  afterMarkupMinor: number;
  overrideApplied: boolean;
  discountPercent: number;
  clampedToCost: boolean;
};

export type OfferPrice =
  | {
      available: true;
      priceMinor: number; // USD minor
      costMinor: number; // USD minor (converted)
      currency: "USD";
      providerOfferId: string;
      breakdown: PriceBreakdown;
    }
  | { available: false; reason: "NO_ENABLED_LINK" | "OUT_OF_STOCK" | "NO_FX_RATE" };

/** USD per 1 major unit of `currency`, from env. null = not configured (link unusable). */
export function usdRateFor(
  currency: string,
  env: Record<string, string | undefined> = process.env,
): number | null {
  const c = currency.toUpperCase();
  if (c === "USD") return 1;
  const rate = Number(env[`FX_RATE_${c}_USD`]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Pure core, DB-free (unit-testable). Cheapest AVAILABLE enabled link wins
 * (tie: lower priority). markup → tier override (explicit price, no discount
 * on top) → tier discount. Never sells below converted cost: a bad override
 * or deep discount clamps to cost and flags it.
 */
export function computeOfferPrice(input: {
  links: LinkQuote[];
  markupPercent: number;
  tier?: { discountPercent: number; overridePriceMinor?: number } | null;
  env?: Record<string, string | undefined>;
}): OfferPrice {
  const enabled = input.links.filter((l) => l.isEnabled);
  if (enabled.length === 0) return { available: false, reason: "NO_ENABLED_LINK" };

  const inStock = enabled.filter((l) => l.availability?.toUpperCase() === "AVAILABLE");
  if (inStock.length === 0) return { available: false, reason: "OUT_OF_STOCK" };

  const quotes: Array<{ link: LinkQuote; usdCost: number; fxRate: number | null }> = [];
  for (const l of inStock) {
    const rate = usdRateFor(l.currency, input.env);
    if (rate === null) continue; // unpriceable link ≠ wrong price; skip it
    const isUsd = l.currency.toUpperCase() === "USD";
    const usdCost = isUsd
      ? l.costMinor
      : convertMinor({ amountMinor: l.costMinor, fromCurrency: l.currency, toCurrency: "USD", rate });
    quotes.push({ link: l, usdCost, fxRate: isUsd ? null : rate });
  }
  if (quotes.length === 0) return { available: false, reason: "NO_FX_RATE" };

  quotes.sort((a, b) => a.usdCost - b.usdCost || a.link.priority - b.link.priority);
  const win = quotes[0];

  const afterMarkup = applyMarkupPercent(win.usdCost, input.markupPercent);
  const discountPercent = input.tier?.discountPercent ?? 0;
  let priceMinor: number = afterMarkup;
  let overrideApplied = false;
  if (input.tier?.overridePriceMinor !== undefined) {
    priceMinor = input.tier.overridePriceMinor;
    overrideApplied = true;
  } else if (discountPercent > 0) {
    priceMinor = applyDiscountPercent(afterMarkup, discountPercent);
  }

  let clampedToCost = false;
  if (priceMinor < win.usdCost) {
    priceMinor = win.usdCost;
    clampedToCost = true;
  }

  return {
    available: true,
    priceMinor,
    costMinor: win.usdCost,
    currency: "USD",
    providerOfferId: win.link.providerOfferId,
    breakdown: {
      sourceCurrency: win.link.currency.toUpperCase(),
      fxRate: win.fxRate,
      markupPercent: input.markupPercent,
      afterMarkupMinor: afterMarkup,
      overrideApplied,
      discountPercent,
      clampedToCost,
    },
  };
}

/** DB entry point: loads offer + links (+ tier/override), computes, materializes OfferComputedPrice. */
export async function priceForOffer(offerId: string, tierId?: string | null): Promise<OfferPrice> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { links: { include: { providerOffer: { include: { provider: true } } } } },
  });
  if (!offer || !offer.isActive) {
    await materialize(offerId, tierId ?? null, { available: false, reason: "NO_ENABLED_LINK" });
    return { available: false, reason: "NO_ENABLED_LINK" };
  }

  let tier: { discountPercent: number; overridePriceMinor?: number } | null = null;
  if (tierId) {
    const [t, override] = await Promise.all([
      prisma.resellerTier.findUnique({ where: { id: tierId } }),
      prisma.offerTierPriceOverride.findUnique({ where: { offerId_tierId: { offerId, tierId } } }),
    ]);
    tier = {
      discountPercent: Number(t?.discountPercent ?? 0),
      overridePriceMinor: override ? Number(override.priceMinor) : undefined,
    };
  }

  const result = computeOfferPrice({
    links: offer.links.map((l) => ({
      providerOfferId: l.providerOfferId,
      priority: l.priority,
      isEnabled: l.isEnabled && l.providerOffer.provider.isActive, // paused provider = link disabled
      availability: l.providerOffer.availability,
      costMinor: Number(l.providerOffer.costMinor), // money.ts asserts MAX_SAFE_INTEGER
      currency: l.providerOffer.currency,
    })),
    markupPercent: Number(offer.markupPercent),
    tier,
  });

  await materialize(offerId, tierId ?? null, result);
  return result;
}

/** Recompute retail + every tier for one offer (call after sync / markup / override edits). */
export async function refreshComputedPrices(offerId: string): Promise<void> {
  const tiers = await prisma.resellerTier.findMany({ select: { id: true } });
  await priceForOffer(offerId, null);
  for (const t of tiers) await priceForOffer(offerId, t.id);
}

// ponytail: Postgres treats NULL tierId as distinct in the @@unique, so retail
// rows (tierId=null) can't use upsert — findFirst+update instead. A concurrent
// double-create of a retail row is possible but harmless (stale row wins one
// read, next refresh converges); a partial unique index fixes it if it matters.
async function materialize(offerId: string, tierId: string | null, r: OfferPrice): Promise<void> {
  const existing = await prisma.offerComputedPrice.findFirst({ where: { offerId, tierId } });
  if (!r.available) {
    if (existing) await prisma.offerComputedPrice.delete({ where: { id: existing.id } });
    return;
  }
  const data = {
    priceMinor: BigInt(r.priceMinor),
    costMinor: BigInt(r.costMinor),
    providerOfferId: r.providerOfferId,
    computedAt: new Date(),
  };
  if (existing) await prisma.offerComputedPrice.update({ where: { id: existing.id }, data });
  else await prisma.offerComputedPrice.create({ data: { offerId, tierId, ...data } });
}
