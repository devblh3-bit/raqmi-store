import "server-only";
import { z } from "zod";
import {
  parseWith,
  request,
  requireEnvKey,
  safeLog,
  type ProviderErrorContext,
} from "./http";
import {
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
 * Canboso Buyer API 2.1.0 - https://canboso.com
 *
 * Key characteristics (verified against /tmp/canboso.json):
 *  - Auth: `key` QUERY PARAM on GET products / GET balance, but in the BODY
 *    plus a REQUIRED `Idempotency-Key` HEADER (8-128 chars) on POST purchase.
 *  - POST /purchase is SYNCHRONOUS. There is NO order-status GET endpoint, so
 *    `getOrder` is notSupported: callers must persist the purchase response.
 *  - A success response either carries `delivery.accounts[]` (status
 *    "completed") or `order.fulfillmentStatus === "waiting_seller"`, mapped to
 *    the normalized AWAITING_SELLER status.
 *  - Money: nested `price: { amount, currency, text }`. Currency is VND or USD
 *    and is preserved as reported (no FX in this layer).
 *  - Rate limits (info.description): 60s windows, escalating penalties of
 *    1m/5m/15m/1h/6h. A 429 carries Retry-After, X-RateLimit-Scope and
 *    X-RateLimit-Penalty-Level; we surface all three and never tight-loop.
 */

const BASE_URL = "https://canboso.com";
const ENV_KEY = "CANBOSO_API_KEY";

/* ------------------------------------------------------------------ schemas */

const Product = z.looseObject({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  image: z.string().optional(),
  emoji: z.string().optional(),
  productType: z.string().optional(), // account | slot | upgrade_account
  price: z.looseObject({
    amount: z.number(),
    currency: z.string(),
    text: z.string().optional(),
  }),
  availability: z
    .looseObject({
      available: z.number().nullable().optional(),
      sold: z.number().optional(),
    })
    .optional(),
  promotions: z
    .array(
      z.looseObject({
        type: z.string().optional(),
        minQty: z.number().nullable().optional(),
        percent: z.number().nullable().optional(),
        bonusQty: z.number().nullable().optional(),
      }),
    )
    .optional(),
  purchaseRequirements: z
    .looseObject({
      customerEmail: z.boolean().optional(),
      slotMonths: z.boolean().optional(),
      quantityFixed: z.number().int().optional(),
      allowedMonths: z.array(z.number().int()).optional(),
    })
    .optional(),
});

const ProductsResponse = z.looseObject({
  success: z.boolean(),
  lang: z.string().optional(),
  walletCurrency: z.string().optional(),
  products: z.array(Product),
});

const BalanceResponse = z.looseObject({
  success: z.boolean(),
  walletCurrency: z.string().optional(),
  balance: z.number(),
  balanceText: z.string().optional(),
  usdtBalance: z.number().optional(),
  balanceVnd: z.number().nullable().optional(),
  balanceUsd: z.number().nullable().optional(),
});

const ErrorResponse = z.looseObject({
  success: z.boolean().optional(),
  lang: z.string().optional(),
  message: z.string().optional(),
  payment: z.unknown().optional(),
});

const PurchaseResponse = z.looseObject({
  success: z.boolean(),
  lang: z.string().optional(),
  order: z.looseObject({
    orderCode: z.string(),
    status: z.string(),
    productId: z.string().optional(),
    productName: z.string().optional(),
    productType: z.string().optional(),
    quantity: z.number().int().optional(),
    bonusQuantity: z.number().int().optional(),
    finalQuantity: z.number().int().optional(),
    slotMonths: z.number().int().optional(),
    customerEmail: z.string().optional(),
    fulfillmentStatus: z.string().optional(),
    autoCompleted: z.boolean().optional(),
  }),
  payment: z.looseObject({
    amount: z.number().optional(),
    currency: z.string().optional(),
    balance: z.number().optional(),
    discountPercent: z.number().optional(),
    discountAmount: z.number().optional(),
    originalAmount: z.number().optional(),
  }),
  delivery: z
    .looseObject({
      accounts: z
        .array(
          z.looseObject({
            user: z.string().optional(),
            password: z.string().optional(),
            verifyEmail: z.string().nullable().optional(),
            expiryText: z.string().nullable().optional(),
            otherInfo: z.string().nullable().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

type ProductT = z.output<typeof Product>;

/* -------------------------------------------------------------- error mapper */

function mapCanbosoError(ctx: ProviderErrorContext): NormalizedError {
  const err = ErrorResponse.safeParse(ctx.body);
  const rateLimitScope = ctx.headers.get("x-ratelimit-scope") ?? undefined;
  const penaltyRaw = ctx.headers.get("x-ratelimit-penalty-level");
  const rateLimitPenaltyLevel =
    penaltyRaw !== null && /^\d+$/.test(penaltyRaw) ? Number(penaltyRaw) : undefined;

  return {
    kind: ctx.kind,
    retryable: ctx.status === 409 ? false : defaultRetryable(ctx.status),
    retryAfterMs: ctx.retryAfterMs,
    status: ctx.status,
    rateLimitScope,
    rateLimitPenaltyLevel,
    message: err.success && err.data.message
      ? err.data.message
      : `Canboso returned HTTP ${ctx.status}`,
  };
}

function defaultRetryable(status: number): boolean {
  // 503 = "purchase protection temporarily unavailable" -> retryable.
  return status === 429 || status === 503 || (status >= 500 && status < 600);
}

/* ------------------------------------------------------------------ mapping */

function toOffer(
  p: ProductT,
  walletCurrency: string | undefined,
): NormalizedProviderOffer {
  const currency = p.price.currency || walletCurrency || "VND";
  const reqs = p.purchaseRequirements;

  let input: CustomerInputType = "NONE";
  if (reqs?.customerEmail && reqs?.slotMonths) input = "EMAIL_AND_SLOT_MONTHS";
  else if (reqs?.customerEmail) input = "EMAIL";
  else if (reqs?.slotMonths) input = "SLOT_MONTHS";

  const available = p.availability?.available;
  const availability =
    available === undefined || available === null
      ? "unknown"
      : available > 0
        ? "available"
        : "unavailable";

  return {
    providerCode: "CANBOSO",
    providerSku: p.productId,
    rawName: p.name,
    rawNameEn: null,
    rawDescription: p.description ?? null,
    rawDescriptionEn: null,
    rawWarranty: null,
    customerInputType: input,
    customerPrompt: null,
    fulfillmentMode: p.productType ?? null,
    availability,
    stockType: p.productType === "account" ? "STOCK" : null,
    stockQuantity: available ?? null,
    minQuantity: null,
    maxQuantity: null,
    // price.amount is major units in the price's own currency (VND has
    // exponent 0 so "major" == minor; USD rounds half-up to cents).
    costMinor: majorToMinor(p.price.amount, currency),
    currency,
    pricingSource: null,
    fixedQuantity: reqs?.quantityFixed ?? null,
    allowedMonths: reqs?.allowedMonths ?? null,
    priceTiers: null,
    promotions:
      p.promotions?.map((promo) => ({
        type: promo.type ?? null,
        minQty: promo.minQty ?? null,
        percent: promo.percent ?? null,
        bonusQty: promo.bonusQty ?? null,
      })) ?? null,
    rawJson: p,
  };
}

function purchaseStatus(o: z.output<typeof PurchaseResponse>["order"]): {
  status: NormalizedOrderStatus;
  rawStatus: string;
} {
  const raw = o.fulfillmentStatus ?? o.status;
  switch (raw) {
    case "completed":
      return { status: "COMPLETED", rawStatus: raw };
    case "waiting_seller":
      return { status: "AWAITING_SELLER", rawStatus: raw };
    case "failed":
      return { status: "FAILED", rawStatus: raw };
    default:
      return { status: "UNKNOWN", rawStatus: raw };
  }
}

/* ------------------------------------------------------------------ adapter */

const capabilities: ProviderCapabilities = {
  polling: false, // synchronous purchase, no status endpoint
  cancel: false, // no cancel endpoint
  quote: false, // no quote endpoint; price comes from the product listing
  synchronousDelivery: true,
  getProductById: false, // catalog-only; filtered client-side
  catalogEtag: false,
  idempotency: "header+body",
};

function authQuery(): Result<URLSearchParams> {
  const key = requireEnvKey(ENV_KEY);
  if (!key.ok) return key;
  return ok(new URLSearchParams({ key: key.value }));
}

export const canbosoAdapter: ProviderAdapter = {
  code: "CANBOSO",
  capabilities,

  async listProducts(
    _opts?: ListProductsOptions,
  ): Promise<AdapterResult<ProductListResult>> {
    const query = authQuery();
    if (!query.ok) return query;

    const res = await request({
      url: `${BASE_URL}/api/v2/telegram-buyer/products?${query.value.toString()}`,
      mapError: mapCanbosoError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(ProductsResponse, res.value.body, "Canboso products");
    if (!parsed.ok) return parsed;

    return ok({
      notModified: false,
      offers: parsed.value.products.map((p) => toOffer(p, parsed.value.walletCurrency)),
      etag: res.value.headers.get("etag"),
    });
  },

  async getProduct(id: string): Promise<AdapterResult<NormalizedProviderOffer>> {
    const list = await this.listProducts();
    if (!list.ok) return list;
    if (list.value.notModified) {
      return notSupported(
        "getProduct",
        "Canboso catalog not modified; cannot filter a single product. Use listProducts.",
      );
    }
    const hit = list.value.offers.find((o) => o.providerSku === id.trim());
    if (!hit) {
      return {
        ok: false,
        error: {
          kind: "not_found",
          retryable: false,
          message: `Canboso product ${id} not found in catalog`,
        },
      };
    }
    return ok(hit);
  },

  async getBalance(): Promise<AdapterResult<NormalizedBalance>> {
    const query = authQuery();
    if (!query.ok) return query;

    const res = await request({
      url: `${BASE_URL}/api/v2/telegram-buyer/balance?${query.value.toString()}`,
      mapError: mapCanbosoError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(BalanceResponse, res.value.body, "Canboso balance");
    if (!parsed.ok) return parsed;

    const currency = parsed.value.walletCurrency ?? "VND";
    return ok({
      providerCode: "CANBOSO",
      availableMinor: majorToMinor(parsed.value.balance, currency),
      currency,
      rawJson: parsed.value,
    });
  },

  async createOrder(input: CreateOrderInput): Promise<AdapterResult<NormalizedOrder>> {
    const key = requireEnvKey(ENV_KEY);
    if (!key.ok) return key;

    const idempotencyKey = input.idempotencyKey ?? input.clientOrderId;
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return {
        ok: false,
        error: {
          kind: "validation",
          retryable: false,
          message: "Canboso Idempotency-Key header must be 8-128 characters",
        },
      };
    }

    const res = await request({
      method: "POST",
      url: `${BASE_URL}/api/v2/telegram-buyer/purchase`,
      headers: {
        // Required header per the spec, 8-128 chars.
        "Idempotency-Key": idempotencyKey,
      },
      json: {
        // Auth key goes in the BODY here, unlike the GET endpoints.
        key: key.value,
        product_id: input.providerSku,
        quantity: input.quantity,
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        ...(input.slotMonths !== undefined ? { slot_months: input.slotMonths } : {}),
      },
      // Same body replays the original purchase server-side, so a transient
      // retry is safe. 409 (inventory/idempotency conflict) is never retried.
      maxRetries: 1,
      mapError: mapCanbosoError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(PurchaseResponse, res.value.body, "Canboso purchase");
    if (!parsed.ok) return parsed;
    const pr = parsed.value;

    const { status, rawStatus } = purchaseStatus(pr.order);
    const currency = pr.payment?.currency ?? "VND";
    const accounts = pr.delivery?.accounts ?? [];
    const delivery: NormalizedDelivery | null =
      status === "COMPLETED" || accounts.length > 0
        ? {
            available: accounts.length > 0,
            accounts: accounts.map((a) => ({
              user: a.user ?? null,
              password: a.password ?? null,
              verifyEmail: a.verifyEmail ?? null,
              expiryText: a.expiryText ?? null,
              otherInfo: a.otherInfo ?? null,
              credentialBlob: null,
              raw: a,
            })),
            raw: pr.delivery ?? null,
          }
        : null;

    // waiting_seller orders cannot be re-polled later; log enough (redacted)
    // context that an operator can chase the seller in Telegram.
    if (status === "AWAITING_SELLER") {
      safeLog("warn", "Canboso purchase awaiting seller", {
        orderCode: pr.order.orderCode,
        fulfillmentStatus: rawStatus,
      });
    }

    return ok({
      providerCode: "CANBOSO",
      providerOrderId: pr.order.orderCode,
      // Canboso echoes no client order id; reconciliation happens via the
      // Idempotency-Key we sent, which the caller chose.
      clientOrderId: input.clientOrderId,
      status,
      rawStatus,
      quantity: pr.order.quantity ?? null,
      costMinor:
        pr.payment?.amount !== undefined
          ? majorToMinor(pr.payment.amount, currency)
          : null,
      currency,
      cancellable: false,
      delivery,
      deliveryExpiresAt: null,
      createdAt: null,
      updatedAt: null,
      providerError: null,
      idempotencyReplayed: false,
      rawJson: pr,
    });
  },

  async getOrder(_id: string) {
    return notSupported(
      "getOrder",
      "Canboso purchase is synchronous and exposes no order-status endpoint. " +
        "Persist the createOrder response; waiting_seller orders are AWAITING_SELLER.",
    );
  },

  async cancelOrder(_id: string) {
    return notSupported("cancel", "Canboso Buyer API 2.1.0 has no cancel endpoint.");
  },

  async quote(_input: QuoteInput) {
    return notSupported(
      "quote",
      "Canboso has no quote endpoint; use the product price from listProducts.",
    );
  },
};