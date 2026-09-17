import "server-only";
import { z } from "zod";
import {
  parseWith,
  request,
  requireEnvKey,
  type ProviderErrorContext,
} from "./http";
import {
  fail,
  notSupported,
  ok,
  majorToMinor,
  type AdapterResult,
  type CreateOrderInput,
  type CustomerInputType,
  type ListProductsOptions,
  type NormalizedBalance,
  type NormalizedDelivery,
  type NormalizedError,
  type NormalizedOrder,
  type NormalizedOrderStatus,
  type NormalizedProviderOffer,
  type ProductListResult,
  type ProviderAdapter,
  type ProviderCapabilities,
  type QuoteInput,
  type Result,
} from "./types";

/**
 * VenteBot Reseller API 1.2.0 —
 * https://ventetelegrambotrailway-production.up.railway.app
 * (spec servers is just "/" so the host is pinned in code; see http.ts allowlist)
 *
 * Key characteristics (verified against /tmp/vbr.json):
 *  - Auth: `X-Reseller-Key` header (spec also accepts `X-API-Key` as a compat
 *    alias; we send the canonical header).
 *  - Money: `price_usd` etc. are FLOATS in USD. Converted to integer minor
 *    units (cents) via `majorToMinor` — half-up at 12 significant digits,
 *    never truncated.
 *  - Order ids are INTEGERS. We stringify for the normalized shape; callers
 *    must pass numeric strings to getOrder.
 *  - `idempotency_key` goes in the request BODY (not a header). Retrying with
 *    the same key returns the original order; same key + different payload
 *    returns HTTP 409.
 *  - GET /api/reseller/products supports If-None-Match/ETag; a 304 returns an
 *    empty body and we surface `{ notModified: true, etag }`.
 *  - POST /api/reseller/quote exists (product_id + quantity).
 *  - No cancel endpoint → notSupported.
 */

const BASE_URL = "https://ventetelegrambotrailway-production.up.railway.app";
const ENV_KEY = "VBR_API_KEY";
const CURRENCY = "USD"; // all VBR money fields are *_usd per the spec

/* ------------------------------------------------------------------ schemas */

const PriceTier = z.looseObject({
  min_qty: z.number().int(),
  max_qty: z.number().int().nullable().optional(),
  price_usd: z.number(),
});

const Product = z.looseObject({
  id: z.number().int(),
  name: z.string(),
  description: z.string().optional(),
  emoji: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  price_usd: z.number(),
  standard_price_usd: z.number().nullable().optional(),
  pricing_type: z.string().optional(),
  special_price_expires_at: z.string().nullable().optional(),
  warranty_days: z.number().int().optional(),
  delivery_type: z.string().optional(),
  stock: z.number().int().nullable().optional(),
  price_tiers: z.array(PriceTier).optional(),
  api_test: z.boolean().optional(),
});

const ProductListResponse = z.looseObject({
  success: z.boolean(),
  products: z.array(Product),
});

const ErrorSchema = z.looseObject({
  success: z.boolean().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

const ValidationError = z.looseObject({
  success: z.boolean().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  details: z
    .array(z.looseObject({ loc: z.array(z.unknown()).optional(), msg: z.unknown() }))
    .optional(),
});

const QuoteRequest = z.looseObject({}); // outbound only, validated by caller

const QuoteResponse = z.looseObject({
  success: z.boolean(),
  quote: z.looseObject({
    product_id: z.number().int(),
    quantity: z.number().int(),
    unit_price: z.number(),
    standard_unit_price: z.number().nullable().optional(),
    pricing_type: z.string().optional(),
    total: z.number(),
    delivery_type: z.string().optional(),
    stock: z.number().int().nullable().optional(),
  }),
  wallet_balance: z.number().optional(),
});

const OrderItem = z.looseObject({
  id: z.number().int().optional(),
  account_data: z.string().optional(),
});

const Order = z.looseObject({
  id: z.number().int(),
  status: z.string(),
  product_id: z.number().int(),
  product_name: z.string().optional(),
  quantity: z.number().int().optional(),
  amount_usd: z.number().optional(),
  delivery_type: z.string().optional(),
  customer_reference: z.string().optional(),
  idempotency_key: z.string().optional(),
  activation_identifier: z.string().nullable().optional(),
  created_at: z.string().optional(),
  items: z.array(OrderItem).optional(),
});

const OrderResponse = z.looseObject({
  success: z.boolean(),
  status: z.string().optional(),
  idempotent: z.boolean().optional(),
  balance_after: z.number().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  order: Order,
});

const OrderGetResponse = z.looseObject({
  success: z.boolean(),
  order: Order,
});

const MeResponse = z.looseObject({
  success: z.boolean(),
  user_telegram_id: z.number().int(),
  username: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  wallet_balance: z.number(),
  key_name: z.string().optional(),
  key_prefix: z.string().optional(),
});

type ProductT = z.output<typeof Product>;
type OrderT = z.output<typeof Order>;

/* -------------------------------------------------------------- error mapper */

function mapVbrError(ctx: ProviderErrorContext): NormalizedError {
  const err = ErrorSchema.safeParse(ctx.body);

  if (ctx.status === 422) {
    const ve = ValidationError.safeParse(ctx.body);
    if (ve.success && ve.data.message) {
      return {
        kind: "validation",
        retryable: false,
        status: 422,
        providerCode: ve.data.code,
        message: ve.data.message,
      };
    }
  }

  if (err.success && err.data.message) {
    return {
      kind: ctx.kind,
      // 409 is a conflict by definition; the caller reconciles, never retries.
      retryable: ctx.status === 409 ? false : defaultRetryable(ctx.status),
      retryAfterMs: ctx.retryAfterMs,
      providerCode: err.data.code,
      status: ctx.status,
      message: err.data.message,
    };
  }

  return {
    kind: ctx.kind,
    retryable: ctx.status === 409 ? false : defaultRetryable(ctx.status),
    retryAfterMs: ctx.retryAfterMs,
    status: ctx.status,
    message: `VBR returned HTTP ${ctx.status}`,
  };
}

function defaultRetryable(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status < 600);
}

/* ------------------------------------------------------------------ mapping */

function mapDeliveryTypeToInput(p: ProductT): CustomerInputType {
  if (p.delivery_type === "activation") return "ACTIVATION_IDENTIFIER";
  return "NONE";
}

function toOffer(p: ProductT): NormalizedProviderOffer {
  const warranty =
    p.warranty_days !== undefined && p.warranty_days !== null
      ? `${p.warranty_days} days`
      : null;

  const stockType =
    p.delivery_type === "stock"
      ? "STOCK"
      : p.delivery_type === "activation"
        ? "ACTIVATION"
        : p.delivery_type === "supplier_api"
          ? "SUPPLIER_API"
          : null;

  const availability =
    p.stock === null || p.stock === undefined
      ? "unknown"
      : p.stock > 0
        ? "available"
        : "unavailable";

  return {
    providerCode: "VBR",
    providerSku: String(p.id),
    rawName: p.name,
    rawNameEn: p.name, // single-language catalog; `lang` query only affects description
    rawDescription: p.description ?? null,
    rawDescriptionEn: null,
    rawWarranty: warranty,
    customerInputType: mapDeliveryTypeToInput(p),
    customerPrompt:
      p.delivery_type === "activation"
        ? "Telegram ID, Grok ID, email, or service identifier to activate"
        : null,
    fulfillmentMode: p.delivery_type ?? null,
    availability,
    stockType,
    stockQuantity: p.stock ?? null,
    minQuantity: null,
    maxQuantity: null,
    // price_usd is a float in USD major units → integer cents, rounded
    // half-up (see majorToMinor). E.g. 5.0 USD -> 500 cents.
    costMinor: majorToMinor(p.price_usd, CURRENCY),
    currency: CURRENCY,
    pricingSource: p.pricing_type ?? null,
    fixedQuantity: null,
    allowedMonths: null,
    priceTiers:
      p.price_tiers?.map((t) => ({
        minQty: t.min_qty,
        maxQty: t.max_qty ?? null,
        priceMinor: majorToMinor(t.price_usd, CURRENCY),
        currency: CURRENCY,
      })) ?? null,
    promotions: null,
    rawJson: p,
  };
}

function mapOrderStatus(raw: string): NormalizedOrderStatus {
  switch (raw) {
    case "COMPLETED":
      return "COMPLETED";
    case "PAID_PENDING_DELIVERY":
      return "PAID_PENDING_DELIVERY";
    case "AWAITING_ACTIVATION_INFO":
      return "AWAITING_INPUT";
    case "AWAITING_ACTIVATION":
      return "AWAITING_ACTIVATION";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

function toOrder(o: OrderT, idempotencyReplayed = false): NormalizedOrder {
  const items = o.items ?? [];
  const delivery: NormalizedDelivery | null = items.length
    ? {
        available: true,
        accounts: items.map((i) => ({
          user: null,
          password: null,
          verifyEmail: null,
          expiryText: null,
          otherInfo: null,
          credentialBlob: i.account_data ?? null,
          raw: i,
        })),
        raw: items,
      }
    : null;

  return {
    providerCode: "VBR",
    providerOrderId: String(o.id),
    clientOrderId: o.idempotency_key ?? null,
    status: mapOrderStatus(o.status),
    rawStatus: o.status,
    quantity: o.quantity ?? null,
    costMinor:
      o.amount_usd !== undefined && o.amount_usd !== null
        ? majorToMinor(o.amount_usd, CURRENCY)
        : null,
    currency: CURRENCY,
    cancellable: false, // no cancel endpoint
    delivery,
    deliveryExpiresAt: null,
    createdAt: o.created_at ?? null,
    updatedAt: null,
    providerError: null,
    idempotencyReplayed,
    rawJson: o,
  };
}

/* ------------------------------------------------------------------ adapter */

const capabilities: ProviderCapabilities = {
  polling: true,
  cancel: false, // no cancel endpoint in the spec
  quote: true,
  synchronousDelivery: false, // stock orders may complete instantly but must be polled
  getProductById: false, // catalog-only; we filter client-side
  catalogEtag: true,
  idempotency: "body",
};

function authHeaders(): Result<Record<string, string>> {
  const key = requireEnvKey(ENV_KEY);
  if (!key.ok) return key;
  // Canonical header per the spec. X-API-Key is accepted server-side as a
  // compat alias but we send only X-Reseller-Key.
  return ok({ "X-Reseller-Key": key.value });
}

function parseSku(id: string): Result<number> {
  const n = Number(id);
  if (!/^\d+$/.test(id.trim()) || !Number.isInteger(n) || n < 1) {
    return fail({
      kind: "validation",
      retryable: false,
      message: "VBR product/order ids are positive integers",
    });
  }
  return ok(n);
}

export const vbrAdapter: ProviderAdapter = {
  code: "VBR",
  capabilities,

  async listProducts(
    opts?: ListProductsOptions,
  ): Promise<AdapterResult<ProductListResult>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    // `lang` is a QUERY param in the spec (default "en"), not a header.
    const qs = opts?.lang ? `?lang=${encodeURIComponent(opts.lang)}` : "";
    const res = await request({
      url: `${BASE_URL}/api/reseller/products${qs}`,
      headers: {
        ...headers.value,
        ...(opts?.etag ? { "If-None-Match": opts.etag } : {}),
      },
      passthroughStatuses: [304],
      mapError: mapVbrError,
    });
    if (!res.ok) return res;

    const etag = res.value.headers.get("etag");
    if (res.value.status === 304) {
      return ok({ notModified: true, etag });
    }

    const parsed = parseWith(ProductListResponse, res.value.body, "VBR product list");
    if (!parsed.ok) return parsed;

    return ok({
      notModified: false,
      offers: parsed.value.products.map(toOffer),
      etag,
    });
  },

  async getProduct(id: string): Promise<AdapterResult<NormalizedProviderOffer>> {
    // VBR has no per-product GET. Filter the catalog client-side.
    const list = await this.listProducts();
    if (!list.ok) return list;
    if (list.value.notModified) {
      return fail({
        kind: "not_found",
        retryable: false,
        message: "VBR catalog not modified; cannot filter for a single product. " +
          "Use listProducts and cache the offers.",
      });
    }
    const hit = list.value.offers.find((o) => o.providerSku === id.trim());
    if (!hit) {
      return fail({
        kind: "not_found",
        retryable: false,
        message: `VBR product ${id} not found in catalog`,
      });
    }
    return ok(hit);
  },

  async getBalance(): Promise<AdapterResult<NormalizedBalance>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      url: `${BASE_URL}/api/reseller/me`,
      headers: headers.value,
      mapError: mapVbrError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(MeResponse, res.value.body, "VBR me");
    if (!parsed.ok) return parsed;

    return ok({
      providerCode: "VBR",
      availableMinor: majorToMinor(parsed.value.wallet_balance, CURRENCY),
      currency: CURRENCY,
      rawJson: parsed.value,
    });
  },

  async quote(
    input: QuoteInput,
  ): Promise<AdapterResult<import("./types").NormalizedQuote>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const productId = parseSku(input.providerSku);
    if (!productId.ok) return productId;

    const res = await request({
      method: "POST",
      url: `${BASE_URL}/api/reseller/quote`,
      headers: headers.value,
      json: { product_id: productId.value, quantity: input.quantity },
      mapError: mapVbrError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(QuoteResponse, res.value.body, "VBR quote");
    if (!parsed.ok) return parsed;
    const q = parsed.value.quote;

    return ok({
      providerCode: "VBR",
      providerSku: String(q.product_id),
      quantity: q.quantity,
      unitCostMinor: majorToMinor(q.unit_price, CURRENCY),
      totalCostMinor: majorToMinor(q.total, CURRENCY),
      currency: CURRENCY,
      walletBalanceMinor:
        parsed.value.wallet_balance !== undefined
          ? majorToMinor(parsed.value.wallet_balance, CURRENCY)
          : null,
      rawJson: parsed.value,
    });
  },

  async createOrder(input: CreateOrderInput): Promise<AdapterResult<NormalizedOrder>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const productId = parseSku(input.providerSku);
    if (!productId.ok) return productId;

    if (input.idempotencyKey !== undefined && input.idempotencyKey.length > 120) {
      return fail({
        kind: "validation",
        retryable: false,
        message: "VBR idempotency_key is limited to 120 characters",
      });
    }

    const res = await request({
      method: "POST",
      url: `${BASE_URL}/api/reseller/orders`,
      headers: headers.value,
      json: {
        product_id: productId.value,
        quantity: input.quantity,
        ...(input.activationIdentifier
          ? { activation_identifier: input.activationIdentifier }
          : {}),
        ...(input.customerReference
          ? { customer_reference: input.customerReference }
          : {}),
        // Body field, NOT a header, per the spec.
        idempotency_key: input.idempotencyKey ?? input.clientOrderId,
      },
      // Same body replays the original order server-side, so a transient
      // retry is safe. 409 (same key, different payload) is never retried.
      maxRetries: 1,
      mapError: mapVbrError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(OrderResponse, res.value.body, "VBR order");
    if (!parsed.ok) return parsed;
    return ok(toOrder(parsed.value.order, parsed.value.idempotent ?? false));
  },

  async getOrder(id: string): Promise<AdapterResult<NormalizedOrder>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const orderId = parseSku(id);
    if (!orderId.ok) return orderId;

    const res = await request({
      url: `${BASE_URL}/api/reseller/orders/${orderId.value}`,
      headers: headers.value,
      mapError: mapVbrError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(OrderGetResponse, res.value.body, "VBR order");
    if (!parsed.ok) return parsed;
    return ok(toOrder(parsed.value.order));
  },

  async cancelOrder(_id: string) {
    return notSupported(
      "cancel",
      "VBR has no cancel endpoint in the Reseller API 1.2.0 spec.",
    );
  },
};