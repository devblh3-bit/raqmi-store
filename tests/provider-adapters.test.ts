import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { qcstAdapter } from "../src/lib/providers/qcst";
import { vbrAdapter } from "../src/lib/providers/vbr";
import { canbosoAdapter } from "../src/lib/providers/canboso";
import { request } from "../src/lib/providers/http";
import {
  isNotSupported,
  majorToMinor,
  type AdapterResult,
} from "../src/lib/providers/types";

/* ------------------------------------------------------------------ helpers */

const fetchMock = vi.fn();

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function unwrap<T>(r: AdapterResult<T>): T {
  if (r.ok) return r.value;
  throw new Error(`expected ok result, got: ${JSON.stringify(r)}`);
}

function unwrapFail<T>(r: AdapterResult<T>) {
  if (r.ok || isNotSupported(r)) {
    throw new Error(`expected failure, got: ${JSON.stringify(r)}`);
  }
  return r.error;
}

/** fetch init of the nth call (0-based). */
function callInit(n: number): { headers: Record<string, string>; body?: string } {
  return fetchMock.mock.calls[n][1];
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("QCST_API_KEY", "qcst_live_FAKE_TEST_KEY");
  vi.stubEnv("VBR_API_KEY", "vbr_live_FAKE_TEST_KEY");
  vi.stubEnv("CANBOSO_API_KEY", "tgb_FAKE_TEST_KEY_1234567890");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/* ----------------------------------------------------------------- fixtures */

const qcstProduct = {
  id: "prod_abc123",
  name: "Tài khoản ChatGPT",
  name_en: "ChatGPT account",
  description: "Mô tả tiếng Việt",
  description_en: "English description",
  warranty: "Bảo hành 30 ngày",
  warranty_en: "30-day warranty",
  customer_input_type: "EMAIL",
  customer_prompt: "Nhập email",
  customer_prompt_en: "Enter your email",
  fulfillment_mode: "AUTO",
  availability: "AVAILABLE",
  stock_type: "STOCK",
  stock_quantity: 10,
  min_quantity: 1,
  max_quantity: 5,
  fixed_quantity: null,
  price: 50000, // integer minor units, VND
  pricing_source: "BASE",
  currency: "VND",
  updated_at: "2026-01-01T00:00:00Z",
};

const qcstOrder = {
  id: "ord_1",
  client_order_id: "co-0001",
  product_id: "prod_abc123",
  quantity: 1,
  unit_price: 50000,
  total_amount: 50000,
  currency: "VND",
  status: "PENDING",
  payment_status: "PAID",
  cancellable: true,
  delivery_available: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const vbrProduct = {
  id: 12,
  name: "Grok 1 month",
  description: "Manual activation",
  price_usd: 4.99, // float USD major units
  pricing_type: "reseller_special",
  warranty_days: 30,
  delivery_type: "activation",
  stock: null,
  price_tiers: [{ min_qty: 5, max_qty: null, price_usd: 4.5 }],
};

const canbosoProductVnd = {
  productId: "64f0c0f2b90c2b4c5a123456",
  name: "ChatGPT Plus",
  productType: "account",
  price: { amount: 50000, currency: "VND", text: "50.000 ₫" },
  availability: { available: 8, sold: 100 },
  promotions: [{ type: "bulk_discount", minQty: 5, percent: null, bonusQty: 1 }],
};

const canbosoProductUsd = {
  productId: "slot_chatgpt_business",
  name: "ChatGPT Business Slot",
  productType: "slot",
  price: { amount: 12.5, currency: "USD", text: "$12.50" },
  purchaseRequirements: {
    customerEmail: true,
    slotMonths: true,
    quantityFixed: 1,
    allowedMonths: [1, 3, 6, 12],
  },
};

/* ------------------------------------------------------------ money helpers */

describe("majorToMinor currency exponents", () => {
  it("VND is zero-decimal: 50000 major == 50000 minor (no 100x bug)", () => {
    expect(majorToMinor(50000, "VND")).toBe(50000);
  });

  it("USD has 2 decimals and rounds half-up through float noise", () => {
    expect(majorToMinor(4.99, "USD")).toBe(499);
    expect(majorToMinor(5.0, "USD")).toBe(500);
    expect(majorToMinor(1.005, "USD")).toBe(101); // not truncated to 100
    expect(majorToMinor(0.1 + 0.2, "USD")).toBe(30);
  });
});

/* --------------------------------------------------------------------- QCST */

describe("QCST adapter", () => {
  it("normalizes a product: integer minor VND price passed through untouched", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: [qcstProduct] }));

    const list = unwrap(await qcstAdapter.listProducts());
    if (list.notModified) throw new Error("unexpected 304");
    const offer = list.offers[0];

    expect(offer.providerCode).toBe("QCST");
    expect(offer.providerSku).toBe("prod_abc123");
    expect(offer.costMinor).toBe(50000);
    expect(offer.currency).toBe("VND");
    expect(offer.customerInputType).toBe("EMAIL");
    expect(offer.rawNameEn).toBe("ChatGPT account");
  });

  it("sends BOTH client_order_id in the body and the Idempotency-Key header", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: qcstOrder }, 201));

    unwrap(
      await qcstAdapter.createOrder({
        providerSku: "prod_abc123",
        quantity: 1,
        clientOrderId: "co-0001",
        customerEmail: "buyer@example.com",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = callInit(0);
    expect(init.headers["Idempotency-Key"]).toBe("co-0001");
    expect(init.headers["X-API-Key"]).toBe("qcst_live_FAKE_TEST_KEY");
    const body = JSON.parse(init.body!);
    expect(body.client_order_id).toBe("co-0001");
    expect(body.customer_inputs).toEqual(["buyer@example.com"]);
  });

  it("retries a 429 only after Retry-After has elapsed (fake timers)", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        json({ detail: "slow down", error_code: "RATE_LIMITED", retryable: true }, 429, {
          "retry-after": "2",
        }),
      )
      .mockResolvedValueOnce(
        json({ success: true, data: { available: 1000000, currency: "VND" } }),
      );

    const pending = qcstAdapter.getBalance();

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting out Retry-After

    await vi.advanceTimersByTimeAsync(1);
    const res = unwrap(await pending);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.availableMinor).toBe(1000000);
    expect(res.currency).toBe("VND");
  });
});

/* ---------------------------------------------------------------------- VBR */

describe("VBR adapter", () => {
  it("normalizes float price_usd to integer cents with USD currency", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ success: true, products: [vbrProduct] }, 200, { etag: '"v1"' }),
    );

    const list = unwrap(await vbrAdapter.listProducts());
    if (list.notModified) throw new Error("unexpected 304");
    const offer = list.offers[0];

    expect(offer.providerSku).toBe("12");
    expect(offer.costMinor).toBe(499); // 4.99 USD -> 499 cents
    expect(offer.currency).toBe("USD");
    expect(offer.customerInputType).toBe("ACTIVATION_IDENTIFIER");
    expect(offer.priceTiers?.[0].priceMinor).toBe(450);
    expect(list.etag).toBe('"v1"');
  });

  it("sends If-None-Match and surfaces a 304 as notModified", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 304, headers: { etag: '"v1"' } }),
    );

    const list = unwrap(await vbrAdapter.listProducts({ etag: '"v1"' }));
    expect(list.notModified).toBe(true);
    expect(list.etag).toBe('"v1"');
    expect(callInit(0).headers["If-None-Match"]).toBe('"v1"');
  });

  it("surfaces a 409 idempotency mismatch as a non-retryable conflict, no new key minted", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          success: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key reused with a different payload",
        },
        409,
      ),
    );

    const err = unwrapFail(
      await vbrAdapter.createOrder({
        providerSku: "12",
        quantity: 1,
        clientOrderId: "order-555-001",
      }),
    );

    expect(err.kind).toBe("conflict");
    expect(err.retryable).toBe(false);
    expect(err.providerCode).toBe("IDEMPOTENCY_CONFLICT");
    // Exactly one attempt: never retried, never re-sent with a fresh key.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(callInit(0).body!).idempotency_key).toBe("order-555-001");
  });

  it("puts idempotency_key in the BODY (not a header) on createOrder", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        success: true,
        idempotent: false,
        order: { id: 124, status: "AWAITING_ACTIVATION", product_id: 12, quantity: 1, amount_usd: 4.99, idempotency_key: "k-1234" },
      }),
    );

    const order = unwrap(
      await vbrAdapter.createOrder({
        providerSku: "12",
        quantity: 1,
        clientOrderId: "k-1234",
        activationIdentifier: "@client",
      }),
    );

    const init = callInit(0);
    expect(JSON.parse(init.body!).idempotency_key).toBe("k-1234");
    expect(init.headers["Idempotency-Key"]).toBeUndefined();
    expect(order.providerOrderId).toBe("124");
    expect(order.status).toBe("AWAITING_ACTIVATION");
    expect(order.costMinor).toBe(499);
    expect(order.currency).toBe("USD");
  });
});

/* ------------------------------------------------------------------ Canboso */

describe("Canboso adapter", () => {
  it("normalizes VND (exponent 0) and USD (exponent 2) prices from the nested shape", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        success: true,
        walletCurrency: "VND",
        products: [canbosoProductVnd, canbosoProductUsd],
      }),
    );

    const list = unwrap(await canbosoAdapter.listProducts());
    if (list.notModified) throw new Error("unexpected 304");
    const [vnd, usd] = list.offers;

    expect(vnd.costMinor).toBe(50000); // NOT 5_000_000
    expect(vnd.currency).toBe("VND");
    expect(vnd.promotions?.[0]).toEqual({
      type: "bulk_discount",
      minQty: 5,
      percent: null,
      bonusQty: 1,
    });

    expect(usd.costMinor).toBe(1250); // 12.5 USD -> 1250 cents
    expect(usd.currency).toBe("USD");
    expect(usd.customerInputType).toBe("EMAIL_AND_SLOT_MONTHS");
    expect(usd.fixedQuantity).toBe(1);
    expect(usd.allowedMonths).toEqual([1, 3, 6, 12]);

    // key travels as ?key= query auth on GETs
    expect(String(fetchMock.mock.calls[0][0])).toContain("key=tgb_FAKE_TEST_KEY");
  });

  it("returns synchronous delivery accounts on a completed purchase, with bonus quantity kept in raw", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        success: true,
        lang: "en",
        order: {
          orderCode: "OC-1",
          status: "completed",
          productName: "ChatGPT Plus",
          productType: "account",
          quantity: 2,
          bonusQuantity: 1,
          finalQuantity: 3,
        },
        payment: { amount: 90000, currency: "VND", balance: 120000 },
        delivery: {
          accounts: [
            { user: "u1", password: "p1", verifyEmail: null, expiryText: null, otherInfo: null },
            { user: "u2", password: "p2", verifyEmail: null, expiryText: null, otherInfo: null },
            { user: "u3", password: "p3", verifyEmail: null, expiryText: null, otherInfo: null },
          ],
        },
      }),
    );

    const order = unwrap(
      await canbosoAdapter.createOrder({
        providerSku: "64f0c0f2b90c2b4c5a123456",
        quantity: 2,
        clientOrderId: "purchase-20260917-0001",
      }),
    );

    expect(order.status).toBe("COMPLETED");
    expect(order.costMinor).toBe(90000);
    expect(order.currency).toBe("VND");
    // finalQuantity (3) can exceed the ordered quantity (2) via bonusQty
    expect(order.delivery?.accounts).toHaveLength(3);
    expect(order.delivery?.accounts[0].user).toBe("u1");

    const init = callInit(0);
    expect(init.headers["Idempotency-Key"]).toBe("purchase-20260917-0001");
    const body = JSON.parse(init.body!);
    expect(body.key).toBe("tgb_FAKE_TEST_KEY_1234567890"); // body auth on purchase
    expect(body.product_id).toBe("64f0c0f2b90c2b4c5a123456");
  });

  it("normalizes waiting_seller to AWAITING_SELLER", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        success: true,
        lang: "en",
        order: {
          orderCode: "OC-2",
          status: "pending",
          fulfillmentStatus: "waiting_seller",
          productName: "Slot",
          productType: "slot",
          quantity: 1,
          bonusQuantity: 0,
          finalQuantity: 1,
        },
        payment: { amount: 12.5, currency: "USD", balance: 100 },
      }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const order = unwrap(
      await canbosoAdapter.createOrder({
        providerSku: "slot_chatgpt_business",
        quantity: 1,
        clientOrderId: "purchase-20260917-0002",
        customerEmail: "buyer@example.com",
        slotMonths: 3,
      }),
    );

    expect(order.status).toBe("AWAITING_SELLER");
    expect(order.rawStatus).toBe("waiting_seller");
    expect(order.delivery).toBeNull();
    expect(order.costMinor).toBe(1250);
    expect(order.currency).toBe("USD");
    // the warn log about the pending seller must not leak the API key
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("tgb_FAKE_TEST_KEY");
    warnSpy.mockRestore();
  });

  it("rejects an Idempotency-Key shorter than 8 chars before any network call", async () => {
    const err = unwrapFail(
      await canbosoAdapter.createOrder({
        providerSku: "x",
        quantity: 1,
        clientOrderId: "short",
      }),
    );
    expect(err.kind).toBe("validation");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getOrder is notSupported (no order-status endpoint)", async () => {
    const res = await canbosoAdapter.getOrder("OC-1");
    expect(isNotSupported(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an escalating 429 penalty instead of sleeping through it", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ success: false, message: "Too many requests" }, 429, {
        "retry-after": "3600",
        "x-ratelimit-scope": "buyer_key_products",
        "x-ratelimit-penalty-level": "4",
      }),
    );

    const err = unwrapFail(await canbosoAdapter.listProducts());
    expect(err.kind).toBe("rate_limited");
    expect(err.retryAfterMs).toBe(3_600_000);
    expect(err.rateLimitScope).toBe("buyer_key_products");
    expect(err.rateLimitPenaltyLevel).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no tight loop
  });
});

/* --------------------------------------------------------------- SSRF guard */

describe("SSRF allowlist", () => {
  const mapError = () => ({
    kind: "provider" as const,
    retryable: false,
    message: "unused",
  });

  it.each([
    "https://evil.example.com/api",
    "https://api.qcst.tech.evil.com/v1/products",
    "http://api.qcst.tech/v1/products", // https only
    "https://127.0.0.1/",
    "https://169.254.169.254/latest/meta-data/",
  ])("refuses %s without opening a socket", async (url) => {
    const res = await request({ url, mapError });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("non-allowlisted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the pinned hosts", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    for (const url of [
      "https://api.qcst.tech/v1/products",
      "https://ventetelegrambotrailway-production.up.railway.app/api/reseller/me",
      "https://canboso.com/api/v2/telegram-buyer/balance",
    ]) {
      const res = await request({ url, mapError });
      expect(res.ok).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
