/**
 * Integer minor-unit money. All amounts in this app are integer minor units
 * (cents). Float money is a bug; every constructor validates.
 *
 * ROUNDING RULE (documented, deterministic): round-half-up on the minor unit,
 * applied once at the boundary (markup/discount/conversion result). No intermediate rounding.
 */
export type Minor = number & { readonly __brand: "Minor" };

const MAX = Number.MAX_SAFE_INTEGER;

function assertInt(n: number, what: string): Minor {
  if (!Number.isFinite(n)) throw new Error(`money: ${what} is not finite`);
  if (!Number.isInteger(n)) throw new Error(`money: ${what} is not an integer minor amount`);
  if (n < 0) throw new Error(`money: ${what} is negative`);
  if (n > MAX) throw new Error(`money: ${what} exceeds MAX_SAFE_INTEGER`);
  return n as Minor;
}

export function toMinor(n: number): Minor {
  if (n < 0) throw new Error("money: negative amount");
  return assertInt(n, "amount");
}

export function fromMinor(m: Minor): number {
  return m as number;
}

/** Round-half-up on a positive scaled value. Deterministic, no float trickery beyond the single multiply. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

function guardPercent(p: number, what: string): void {
  if (!Number.isFinite(p) || p < 0) throw new Error(`money: invalid ${what} ${p}`);
}

/**
 * price = cost * (1 + markup/100), rounded half-up to a whole minor unit.
 * Checks the scaled result fits in a safe integer before rounding.
 */
export function applyMarkupPercent(costMinor: number, markupPercent: number): Minor {
  const cost = assertInt(costMinor, "costMinor");
  guardPercent(markupPercent, "markupPercent");
  const scaled = cost * (100 + markupPercent);
  if (scaled > MAX) throw new Error("money: markup overflows MAX_SAFE_INTEGER");
  return assertInt(roundHalfUp(scaled / 100), "markup result");
}

/** price * (1 - discount/100), rounded half-up. Discount must be in [0, 100]. */
export function applyDiscountPercent(priceMinor: number, discountPercent: number): Minor {
  const price = assertInt(priceMinor, "priceMinor");
  guardPercent(discountPercent, "discountPercent");
  if (discountPercent > 100) throw new Error("money: discountPercent above 100");
  const scaled = price * (100 - discountPercent);
  if (scaled > MAX) throw new Error("money: discount overflows MAX_SAFE_INTEGER");
  return assertInt(roundHalfUp(scaled / 100), "discount result");
}

export function enforceMinMargin(opts: {
  priceMinor: number;
  costMinor: number;
  minMarginPercent: number;
}): { ok: boolean; requiredMinor: number } {
  const { priceMinor, costMinor, minMarginPercent } = opts;
  const price = assertInt(priceMinor, "priceMinor");
  const cost = assertInt(costMinor, "costMinor");
  guardPercent(minMarginPercent, "minMarginPercent");
  // Invariant: price >= cost + floor(cost * minMargin/100). Integer floor — a
  // provider price hike can never push us below cost.
  const required = cost + Math.floor((cost * minMarginPercent) / 100);
  return { ok: price >= required, requiredMinor: required };
}

/** Minor-unit decimal exponents. Getting this wrong is a 100x bug. */
export const CURRENCY_EXPONENT: Record<string, number> = {
  USD: 2,
  VND: 0,
  DZD: 2,
};

export function currencyExponent(currency: string): number {
  const e = CURRENCY_EXPONENT[currency.toUpperCase()];
  if (e === undefined) throw new Error(`money: unknown currency exponent for ${currency}`);
  return e;
}

export function assertSameCurrency(a: string, b: string): void {
  if (a.toUpperCase() !== b.toUpperCase()) {
    throw new Error(`money: currency mismatch ${a} vs ${b}`);
  }
}

/**
 * Exponent-aware FX. `rate` is the price of 1 unit of `fromCurrency` expressed
 * in `toCurrency` MAJOR units (e.g. USD->DZD rate 134). Converts minor→major
 * using each side's exponent, multiplies, rounds half-up to target minor units.
 */
export function convertMinor(opts: {
  amountMinor: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fromExponent?: number;
  toExponent?: number;
}): Minor {
  const { amountMinor, fromCurrency, toCurrency, rate } = opts;
  const amount = assertInt(amountMinor, "amountMinor");
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("money: invalid FX rate");
  const fromExp = opts.fromExponent ?? currencyExponent(fromCurrency);
  const toExp = opts.toExponent ?? currencyExponent(toCurrency);
  const major = amount / Math.pow(10, fromExp);
  const targetMajor = major * rate;
  const targetMinor = targetMajor * Math.pow(10, toExp);
  if (Math.abs(targetMinor) > MAX) throw new Error("money: FX result overflows MAX_SAFE_INTEGER");
  return assertInt(roundHalfUp(targetMinor), "FX result");
}

/** Format via Intl only. Locales: en, fr, ar (ar-DZ). Currency must be in the exponent table. */
export function formatMinor(opts: {
  amountMinor: number;
  currency: string;
  locale: string;
}): string {
  const { amountMinor, currency, locale } = opts;
  const exp = currencyExponent(currency);
  const tag =
    locale.toLowerCase().startsWith("ar") ? "ar-DZ" :
    locale.toLowerCase().startsWith("fr") ? "fr-FR" : "en-US";
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(amountMinor / Math.pow(10, exp));
}

/** Muted indicative "≈ DZD" line next to a USD price. Display-only; the app charges only USD. */
export function formatIndicativeSecondary(opts: {
  amountMinor: number;
  currency: string;
  rate: number;
  fromCurrency?: string;
  locale: string;
}): string {
  const { amountMinor, currency, rate, locale } = opts;
  const fromCurrency = opts.fromCurrency ?? "USD";
  const converted = convertMinor({ amountMinor, fromCurrency, toCurrency: currency, rate });
  return `≈ ${formatMinor({ amountMinor: converted, currency, locale })}`;
}

/** Sum integer minor amounts; throws on overflow instead of silently corrupting. */
export function sumMinor(...amounts: number[]): Minor {
  let total = 0;
  for (const a of amounts) total += assertInt(a, "summand");
  if (total > MAX) throw new Error("money: sum overflows MAX_SAFE_INTEGER");
  return total as Minor;
}

/**
 * Largest-remainder allocation: distributes `totalMinor` across positive
 * integer weights without losing or inventing a cent. Remainder pennies go to
 * the largest remainders (ties: earlier index wins — deterministic).
 */
export function allocateMinor(totalMinor: number, weights: number[]): Minor[] {
  const total = assertInt(totalMinor, "totalMinor");
  if (weights.length === 0) throw new Error("money: allocateMinor needs weights");
  const sum = weights.reduce((s, w) => {
    if (!Number.isInteger(w) || w < 0) throw new Error("money: weights must be non-negative integers");
    return s + w;
  }, 0);
  if (sum === 0) throw new Error("money: weights sum to zero");
  if (total < 0) throw new Error("money: negative total");
  const shares = weights.map((w) => (total * w) / sum);
  const floors = shares.map(Math.floor);
  let leftover = total - floors.reduce((s, f) => s + f, 0);
  const order = shares
    .map((s, i) => ({ i, rem: s - Math.floor(s) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = [...floors] as Minor[];
  for (const { i } of order) {
    if (leftover <= 0) break;
    out[i] = (out[i] + 1) as Minor;
    leftover--;
  }
  return out;
}

/**
 * Partial refund of the undelivered portion. Delivered may EXCEED ordered
 * (Canboso bonusQuantity) — the refund clamps at zero, never negative.
 */
export function computeRefundMinor(opts: {
  unitPriceMinor: number;
  orderedQty: number;
  deliveredQty: number;
}): Minor {
  const { unitPriceMinor, orderedQty, deliveredQty } = opts;
  const unit = assertInt(unitPriceMinor, "unitPriceMinor");
  if (!Number.isInteger(orderedQty) || orderedQty < 0) throw new Error("money: invalid orderedQty");
  if (!Number.isInteger(deliveredQty) || deliveredQty < 0) throw new Error("money: invalid deliveredQty");
  const undelivered = Math.max(0, orderedQty - deliveredQty);
  const refund = unit * undelivered;
  if (refund > MAX) throw new Error("money: refund overflows MAX_SAFE_INTEGER");
  return Math.max(0, refund) as Minor;
}