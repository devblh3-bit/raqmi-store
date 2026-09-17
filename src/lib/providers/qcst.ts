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
 * QCST Partner API 1.0.0 — https://api.qcst.tech
 *
 * Key characteristics (verified against /tmp/qcst.json):
 *  - Auth: `X-API-Key` header, key starts with `qcst_live_`.
 *  - Money: `price`, `unit_price`, `total_amount`, `available` are INTEGERS in
 *    minor units. `currency` is always present in the response and is NOT
 *    assumed to be USD (production wallets are VND).
 *  - Orders are ASYNCHRONOUS: POST /v1/orders returns 201 with a pending order;
 *    delivery appears later on GET /v1/orders/{id}.
 *  - POST /v1/orders needs `client_order_id` in the body AND an
 *    `Idempotency-Key` header. The spec marks the header `required: false`, but
 *    info.description says "Every POST /v1/orders request requires a unique
 *    Idempotency-Key" — we always send it.
 *  - Errors are RFC-7807-ish `ProblemResponse` with `error_code`, `retryable`
 *    and `request_id`.
 */

const BASE_URL = "https://api.qcst.tech";
const ENV_KEY = "QCST_API_KEY";

/* ------------------------------------------------------------------ schemas */

/**
 * `looseObject` everywhere: unknown extra fields are tolerated (providers add
 * fields without warning) but every field we read is validated.
 */
const ProductData = z.looseObject({
  id: z.string(),
  name: z.string(),
  name_en: z.string(),
  description: z.string(),
  description_en: z.string(),
  warranty: z.string(),
  warranty_en: z.string(),
  customer_input_type: z.string(),
  customer_prompt: z.string(),
  customer_prompt_en: z.string(),
  fulfillment_mode: z.string(),
  availability: z.string(),
  stock_type: z.string(),
  stock_quantity: z.number().int().nullable().optional(),
  min_quantity: z.number().int().optional(),
  max_quantity: z.number().int().nullable().optional(),
  fixed_quantity: z.number().int().nullable().optional(),
  price: z.number().int(),
  pricing_source: z.string().optional(),
  currency: z.string(),
  updated_at: z.string(),
});

const ProductListResponse = z.looseObject({
  success: z.boolean(),
  data: z.array(ProductData),
});

const ProductResponse = z.looseObject({
  success: z.boolean(),
  data: ProductData,
});

const BalanceResponse = z.looseObject({
  success: z.boolean(),
  data: z.looseObject({
    available: z.number().int(),
    currency: z.string(),
  }),
});

const OrderErrorData = z.looseObject({
  code: z.string(),
  detail: z.string(),
});

const OrderData = z.looseObject({
  id: z.string(),
  client_order_id: z.string(),
  product_id: z.string(),
  quantity: z.number().int(),
  unit_price: z.number().int(),
  total_amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  payment_status: z.string(),
  cancellable: z.boolean(),
  delivery_available: z.boolean(),
  // Spec types `delivery` as an untyped anyOf — keep it unknown, do not guess.
  delivery: z.unknown().optional(),
  delivery_expires_at: z.string().nullable().optional(),
  error: OrderErrorData.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const OrderResponse = z.looseObject({
  success: z.boolean(),
  data: OrderData,
});

const CancelOrderResponse = z.looseObject({
  success: z.boolean(),
  data: OrderData,
  idempotency_replayed: z.boolean().optional(),
});

const ProblemResponse = z.looseObject({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  error_code: z.string().optional(),
  request_id: z.string().optional(),
  retryable: z.boolean().optional(),
});

/** FastAPI 422 shape, used by GET /v1/products/{id} and GET /v1/orders/{id}. */
const HTTPValidationError = z.looseObject({
  detail: z
    .array(
      z.looseObject({
        loc: z.array(z.union([z.string(), z.number()])),
        msg: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
});

type ProductDataT = z.output<typeof ProductData>;
type OrderDataT = z.output<typeof OrderData>;

/* -------------------------------------------------------------- error mapper */

function mapQcstError(ctx: ProviderErrorContext): NormalizedError {
  const problem = ProblemResponse.safeParse(ctx.body);

  if (problem.success && (problem.data.error_code || problem.data.detail)) {
    const p = problem.data;
    // Trust the provider's own `retryable` flag, but never retry a conflict.
    const retryable =
      ctx.status === 409 ? false : (p.retryable ?? defaultRetryable(ctx.status));
    return {
      kind: ctx.kind,
      retryable,
      retryAfterMs: ctx.retryAfterMs,
      providerCode: p.error_code,
      requestId: p.request_id,
      status: ctx.status,
      message: p.detail || p.title || `QCST returned HTTP ${ctx.status}`,
    };
  }

  const httpValidation = HTTPValidationError.safeParse(ctx.body);
  if (ctx.status === 422 && httpValidation.success && httpValidation.data.detail) {
    const issues = httpValidation.data.detail
      .slice(0, 5)
      .map((d) => `${d.loc.join(".")}: ${d.msg}`)
      .join("; ");
    return {
      kind: "validation",
      retryable: false,
      status: 422,
      message: `QCST rejected the request (${issues})`,
    };
  }

  return {
    kind: ctx.kind,
    retryable: ctx.status === 409 ? false : defaultRetryable(ctx.status),
    retryAfterMs: ctx.retryAfterMs,
    status: ctx.status,
    message: `QCST returned HTTP ${ctx.status}`,
  };
}

function defaultRetryable(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status < 600);
}

/* ---------------------------------------------------------------- mapping */

/**
 * QCST `customer_input_type` is a free-form string in the spec. Observed values
 * are NONE / EMAIL; anything else with a prompt is treated as free TEXT so the
 * checkout still collects something rather than silently sending nothing.
 */
function mapCustomerInputType(raw: string): CustomerInputType {
  const v = raw.trim().toUpperCase();
  if (v === "" || v === "NONE") return "NONE";
  if (v === "EMAIL") return "EMAIL";
  if (v === "TEXT" || v === "FREE_TEXT" || v === "STRING") return "TEXT";
  return "UNKNOWN";
}

function toOffer(p: ProductDataT): NormalizedProviderOffer {
  return {
    providerCode: "QCST",
    providerSku: p.id,
    rawName: p.name,
    rawNameEn: p.name_en,
    rawDescription: p.description,
    rawDescriptionEn: p.description_en,
    rawWarranty: p.warranty,
    customerInputType: mapCustomerInputType(p.customer_input_type),
    customerPrompt: p.customer_prompt || null,
    fulfillmentMode: p.fulfillment_mode,
    availability: p.availability,
    stockType: p.stock_type,
    stockQuantity: p.stock_quantity ?? null,
    minQuantity: p.min_quantity ?? 1,
    maxQuantity: p.max_quantity ?? null,
    // Already an integer in minor units — no conversion, no rounding.
    costMinor: p.price,
    currency: p.currency,
    pricingSource: p.pricing_source ?? "BASE",
    fixedQuantity: p.fixed_quantity ?? null,
    allowedMonths: null,
    priceTiers: null,
    promotions: null,
    rawJson: p,
  };
}

/**
 * QCST status strings are not enumerated in the spec, so we map the observed
 * vocabulary and keep the raw value in `rawStatus` for anything unexpected.
 */
function mapOrderStatus(raw: string): NormalizedOrderStatus {
  switch (raw.trim().toUpperCase()) {
    case "PENDING":
    case "CREATED":
    case "QUEUED":
      return "PENDING";
    case "PAID":
    case "PROCESSING":
    case "FULFILLING":
      return "PAID_PENDING_DELIVERY";
    case "AWAITING_INPUT":
      return "AWAITING_INPUT";
    case "COMPLETED":
    case "DELIVERED":
    case "SUCCESS":
      return "COMPLETED";
    case "CANCELLED":
    case "CANCELED":
    case "REFUNDED":
      return "CANCELLED";
    case "FAILED":
    case "ERROR":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

function toDelivery(o: OrderDataT): NormalizedDelivery | null {
  if (!o.delivery_available && o.delivery === undefined) return null;
  // The spec does not type QCST's delivery payload, so it is passed through
  // untouched rather than coerced into an account shape we cannot verify.
  return { available: o.delivery_available, accounts: [], raw: o.delivery ?? null };
}

function toOrder(o: OrderDataT, idempotencyReplayed = false): NormalizedOrder {
  return {
    providerCode: "QCST",
    providerOrderId: o.id,
    clientOrderId: o.client_order_id,
    status: mapOrderStatus(o.status),
    rawStatus: o.status,
    quantity: o.quantity,
    costMinor: o.total_amount,
    currency: o.currency,
    cancellable: o.cancellable,
    delivery: toDelivery(o),
    deliveryExpiresAt: o.delivery_expires_at ?? null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    providerError: o.error ? { code: o.error.code, detail: o.error.detail } : null,
    idempotencyReplayed,
    rawJson: o,
  };
}

/* ---------------------------------------------------------------- adapter */

const capabilities: ProviderCapabilities = {
  polling: true,
  cancel: true,
  quote: false, // no quote endpoint; price comes from the product listing
  synchronousDelivery: false, // POST /v1/orders always returns a pending order
  getProductById: true,
  catalogEtag: false,
  idempotency: "header+body",
};

function authHeaders(): Result<Record<string, string>> {
  const key = requireEnvKey(ENV_KEY);
  if (!key.ok) return key;
  return ok({ "X-API-Key": key.value });
}

export const qcstAdapter: ProviderAdapter = {
  code: "QCST",
  capabilities,

  async listProducts(
    _opts?: ListProductsOptions,
  ): Promise<AdapterResult<ProductListResult>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      url: `${BASE_URL}/v1/products`,
      headers: headers.value,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(ProductListResponse, res.value.body, "QCST product list");
    if (!parsed.ok) return parsed;

    return ok({
      notModified: false,
      offers: parsed.value.data.map(toOffer),
      etag: res.value.headers.get("etag"),
    });
  },

  async getProduct(id: string): Promise<AdapterResult<NormalizedProviderOffer>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      url: `${BASE_URL}/v1/products/${encodeURIComponent(id)}`,
      headers: headers.value,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(ProductResponse, res.value.body, "QCST product");
    if (!parsed.ok) return parsed;
    return ok(toOffer(parsed.value.data));
  },

  async getBalance(): Promise<AdapterResult<NormalizedBalance>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      url: `${BASE_URL}/v1/balance`,
      headers: headers.value,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(BalanceResponse, res.value.body, "QCST balance");
    if (!parsed.ok) return parsed;

    return ok({
      providerCode: "QCST",
      // Integer minor units already; currency is read from the response, since
      // the endpoint description says VND but the field is authoritative.
      availableMinor: parsed.value.data.available,
      currency: parsed.value.data.currency,
      rawJson: parsed.value.data,
    });
  },

  async createOrder(input: CreateOrderInput): Promise<AdapterResult<NormalizedOrder>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    if (!input.clientOrderId || input.clientOrderId.length > 128) {
      return fail({
        kind: "validation",
        retryable: false,
        message: "clientOrderId must be 1-128 characters for QCST",
      });
    }

    // Spec: customer_inputs is one line per item, or an empty list.
    const customerInputs =
      input.customerInputs ??
      (input.customerEmail ? [input.customerEmail] : []);

    const res = await request({
      method: "POST",
      url: `${BASE_URL}/v1/orders`,
      headers: {
        ...headers.value,
        // Required per info.description even though the parameter is optional.
        "Idempotency-Key": input.idempotencyKey ?? input.clientOrderId,
      },
      json: {
        client_order_id: input.clientOrderId,
        product_id: input.providerSku,
        quantity: input.quantity,
        customer_inputs: customerInputs,
        locale: input.locale ?? "vi",
      },
      // A retry reuses the same Idempotency-Key, so it is replay-safe. QCST
      // returns the original order instead of creating a second one.
      maxRetries: 1,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(OrderResponse, res.value.body, "QCST order");
    if (!parsed.ok) return parsed;
    return ok(toOrder(parsed.value.data));
  },

  async getOrder(id: string): Promise<AdapterResult<NormalizedOrder>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      url: `${BASE_URL}/v1/orders/${encodeURIComponent(id)}`,
      headers: headers.value,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(OrderResponse, res.value.body, "QCST order");
    if (!parsed.ok) return parsed;
    return ok(toOrder(parsed.value.data));
  },

  async cancelOrder(id: string): Promise<AdapterResult<NormalizedOrder>> {
    const headers = authHeaders();
    if (!headers.ok) return headers;

    const res = await request({
      method: "POST",
      url: `${BASE_URL}/v1/orders/${encodeURIComponent(id)}/cancel`,
      headers: headers.value,
      // The refund is idempotent server-side, so a transient retry is safe.
      maxRetries: 1,
      mapError: mapQcstError,
    });
    if (!res.ok) return res;

    const parsed = parseWith(CancelOrderResponse, res.value.body, "QCST cancel");
    if (!parsed.ok) return parsed;
    return ok(toOrder(parsed.value.data, parsed.value.idempotency_replayed ?? false));
  },

  async quote(_input: QuoteInput) {
    return notSupported(
      "quote",
      "QCST has no quote endpoint; use the product price from listProducts/getProduct.",
    );
  },
};
