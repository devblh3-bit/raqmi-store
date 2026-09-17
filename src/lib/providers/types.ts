import "server-only";

/**
 * Shared normalized types for the provider adapter layer.
 *
 * Design rules enforced here (see also http.ts):
 *  - No FX conversion. Every money value keeps the currency the provider reported.
 *  - Money is always an integer in the currency's own minor unit (`costMinor`).
 *    VND has exponent 0, so VND minor == VND major. USD has exponent 2.
 *  - Adapters never throw for expected failures; they return a Result with a
 *    NormalizedError. Unsupported capabilities return NotSupportedResult.
 */

export type ProviderCode = "QCST" | "VBR" | "CANBOSO";

/* ------------------------------------------------------------------ errors */

export type NormalizedErrorKind =
  | "rate_limited"
  | "auth"
  | "not_found"
  | "validation"
  | "provider"
  | "network"
  | "conflict";

export interface NormalizedError {
  kind: NormalizedErrorKind;
  retryable: boolean;
  /** Wait at least this long before retrying. Set for 429 and Retry-After 503. */
  retryAfterMs?: number;
  /** Provider's own machine code, e.g. QCST `error_code`, VBR `code`. */
  providerCode?: string;
  message: string;
  requestId?: string;
  /** HTTP status, when the failure came from a response. */
  status?: number;
  /** Rate-limit scope reported by Canboso on 429. */
  rateLimitScope?: string;
  /** Escalating penalty level reported by Canboso on 429 (0-5). */
  rateLimitPenaltyLevel?: number;
}

export interface NotSupportedResult {
  ok: false;
  notSupported: true;
  capability: string;
  message: string;
}

export type Ok<T> = { ok: true; value: T };
export type Fail = { ok: false; notSupported?: false; error: NormalizedError };

/** Result of a call the provider supports. */
export type Result<T> = Ok<T> | Fail;

/** Result of any adapter method: may additionally be "this provider can't". */
export type AdapterResult<T> = Result<T> | NotSupportedResult;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function fail(error: NormalizedError): Fail {
  return { ok: false, error };
}

export function notSupported(
  capability: string,
  message: string,
): NotSupportedResult {
  return { ok: false, notSupported: true, capability, message };
}

export function isNotSupported<T>(
  r: AdapterResult<T>,
): r is NotSupportedResult {
  return r.ok === false && "notSupported" in r && r.notSupported === true;
}

/* ------------------------------------------------------------------- money */

/**
 * Minor-unit exponent per ISO-4217 currency.
 * VND and JPY are zero-decimal: 50000 VND is 50000 minor units, not 5000000.
 */
const CURRENCY_EXPONENT: Record<string, number> = {
  VND: 0,
  JPY: 0,
  KRW: 0,
  CLP: 0,
  ISK: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  USDT: 2,
};

export function currencyExponent(currency: string): number {
  const exp = CURRENCY_EXPONENT[currency.trim().toUpperCase()];
  return exp === undefined ? 2 : exp;
}

/**
 * Convert a major-unit float (VBR `price_usd`, Canboso `price.amount`) into an
 * integer number of minor units.
 *
 * Rounding: half-up on the value as printed at 12 significant digits. The
 * `toPrecision(12)` step removes binary float artefacts so that e.g.
 * 1.005 USD -> 100.49999999999999 -> "100.500000000" -> 101 minor units,
 * rather than truncating to 100. Never uses Math.trunc/floor.
 */
export function majorToMinor(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError("majorToMinor: amount is not finite");
  }
  const scaled = amount * 10 ** currencyExponent(currency);
  return Math.round(Number(scaled.toPrecision(12)));
}

/* ---------------------------------------------------------------- products */

/**
 * Normalized customer-input requirement, unioned across all three providers:
 *  - QCST  `customer_input_type` (NONE / EMAIL / free text)
 *  - VBR   `delivery_type === "activation"` needs `activation_identifier`
 *  - Canboso `purchaseRequirements.customerEmail` / `.slotMonths`
 */
export type CustomerInputType =
  | "NONE"
  | "EMAIL"
  | "TEXT"
  | "ACTIVATION_IDENTIFIER"
  | "SLOT_MONTHS"
  | "EMAIL_AND_SLOT_MONTHS"
  | "UNKNOWN";

export interface NormalizedPriceTier {
  minQty: number | null;
  maxQty: number | null;
  priceMinor: number;
  currency: string;
}

export interface NormalizedPromotion {
  type: string | null;
  minQty: number | null;
  percent: number | null;
  bonusQty: number | null;
}

export interface NormalizedProviderOffer {
  providerCode: ProviderCode;
  /** Provider's own product id, stringified (VBR ids are integers). */
  providerSku: string;
  rawName: string | null;
  rawNameEn: string | null;
  rawDescription: string | null;
  rawDescriptionEn: string | null;
  rawWarranty: string | null;
  customerInputType: CustomerInputType;
  customerPrompt: string | null;
  /** QCST `fulfillment_mode`, VBR `delivery_type`, Canboso `productType`. */
  fulfillmentMode: string | null;
  /** QCST `availability`; derived for the others. */
  availability: string | null;
  stockType: string | null;
  stockQuantity: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  /** Integer, in `currency`'s minor unit. */
  costMinor: number;
  /** As reported by the provider. NOT normalized to USD here. */
  currency: string;
  pricingSource: string | null;

  /* extras a checkout implementer needs; everything else is in rawJson */
  fixedQuantity: number | null;
  allowedMonths: number[] | null;
  priceTiers: NormalizedPriceTier[] | null;
  promotions: NormalizedPromotion[] | null;

  /** Untouched provider payload for this product. */
  rawJson: unknown;
}

export type ProductListResult =
  | { notModified: true; etag: string | null }
  | {
      notModified: false;
      offers: NormalizedProviderOffer[];
      etag: string | null;
    };

export interface ListProductsOptions {
  /** VBR only: sent as If-None-Match; a 304 yields `notModified: true`. */
  etag?: string | null;
  /** VBR `lang`, QCST order `locale`. */
  lang?: string;
}

/* ------------------------------------------------------------------ orders */

export type NormalizedOrderStatus =
  | "PENDING"
  | "PAID_PENDING_DELIVERY"
  | "AWAITING_INPUT"
  | "AWAITING_ACTIVATION"
  | "AWAITING_SELLER"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "UNKNOWN";

export interface NormalizedDeliveryAccount {
  user: string | null;
  password: string | null;
  verifyEmail: string | null;
  expiryText: string | null;
  otherInfo: string | null;
  /** VBR ships one opaque `account_data` string per item. */
  credentialBlob: string | null;
  raw: unknown;
}

export interface NormalizedDelivery {
  available: boolean;
  accounts: NormalizedDeliveryAccount[];
  raw: unknown;
}

export interface NormalizedOrder {
  providerCode: ProviderCode;
  /** Stringified provider order id (VBR integer id, Canboso orderCode). */
  providerOrderId: string;
  clientOrderId: string | null;
  status: NormalizedOrderStatus;
  /** Exact provider status string, for audit and for statuses we don't model. */
  rawStatus: string | null;
  quantity: number | null;
  /** Total charged, integer minor units of `currency`. */
  costMinor: number | null;
  currency: string | null;
  cancellable: boolean;
  delivery: NormalizedDelivery | null;
  deliveryExpiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  providerError: { code: string | null; detail: string | null } | null;
  /** True when the provider replayed a prior idempotent request. */
  idempotencyReplayed: boolean;
  rawJson: unknown;
}

export interface CreateOrderInput {
  providerSku: string;
  quantity: number;
  /** Our own id. QCST sends it in the body; all providers key idempotency on it. */
  clientOrderId: string;
  /** Defaults to clientOrderId when omitted. */
  idempotencyKey?: string;
  /** QCST `customer_inputs`: one line per item. */
  customerInputs?: string[];
  /** Canboso `customer_email`; also used as the single QCST EMAIL input. */
  customerEmail?: string;
  /** Canboso `slot_months` (must be in the offer's allowedMonths). */
  slotMonths?: number;
  /** VBR `activation_identifier`. */
  activationIdentifier?: string;
  /** VBR `customer_reference`. */
  customerReference?: string;
  /** QCST `locale` ("vi" | "en"). */
  locale?: string;
}

export interface QuoteInput {
  providerSku: string;
  quantity: number;
}

export interface NormalizedQuote {
  providerCode: ProviderCode;
  providerSku: string;
  quantity: number;
  unitCostMinor: number;
  totalCostMinor: number;
  currency: string;
  /** Provider wallet balance at quote time, minor units, when reported. */
  walletBalanceMinor: number | null;
  rawJson: unknown;
}

export interface NormalizedBalance {
  providerCode: ProviderCode;
  availableMinor: number;
  currency: string;
  rawJson: unknown;
}

/* ---------------------------------------------------------- adapter surface */

export interface ProviderCapabilities {
  /** Order state can be re-read after creation (getOrder works). */
  polling: boolean;
  cancel: boolean;
  quote: boolean;
  /** createOrder can already return delivered goods. */
  synchronousDelivery: boolean;
  /** A single product can be fetched by id (possibly client-side filtered). */
  getProductById: boolean;
  /** Catalog supports If-None-Match / ETag. */
  catalogEtag: boolean;
  /** Idempotency key goes in the header, the body, or both. */
  idempotency: "header" | "body" | "header+body" | "none";
}

export interface ProviderAdapter {
  readonly code: ProviderCode;
  readonly capabilities: ProviderCapabilities;

  listProducts(opts?: ListProductsOptions): Promise<AdapterResult<ProductListResult>>;
  getProduct(id: string): Promise<AdapterResult<NormalizedProviderOffer>>;
  getBalance(): Promise<AdapterResult<NormalizedBalance>>;
  createOrder(input: CreateOrderInput): Promise<AdapterResult<NormalizedOrder>>;
  getOrder(id: string): Promise<AdapterResult<NormalizedOrder>>;
  cancelOrder(id: string): Promise<AdapterResult<NormalizedOrder>>;
  quote(input: QuoteInput): Promise<AdapterResult<NormalizedQuote>>;
}
