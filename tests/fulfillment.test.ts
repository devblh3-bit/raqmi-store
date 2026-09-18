import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.ENCRYPTION_KEY ||= "a".repeat(64);

/**
 * Integration test for the dispatcher — needs the raqmi-pg container.
 *
 * The two properties that matter are idempotency (a re-run must not place a
 * second supplier order) and fallback (a failing supplier must hand off to the
 * next link). Both are asserted here, not eyeballed, because a double dispatch
 * costs real money and a silent fallback failure strands a paid order.
 */
const calls = vi.hoisted(() => ({
  createOrder: [] as {
    providerCode: string;
    clientOrderId: string;
    sku: string;
    customerInputs?: string[];
    customerEmail?: string;
    quantity: number;
  }[],
}));

// Scripted per-provider behaviour, keyed by provider code.
const behaviour = vi.hoisted(() => ({
  map: {} as Record<string, (input: { clientOrderId: string; sku: string }) => unknown>,
}));

vi.mock("../src/lib/providers", async () => {
  const { ok, fail } = await vi.importActual<typeof import("../src/lib/providers/types")>(
    "../src/lib/providers/types",
  );
  return {
    getAdapter: (code: string) => {
      if (!behaviour.map[code]) return null;
      return {
        code,
        capabilities: {},
        createOrder: async (input: {
          clientOrderId: string;
          providerSku: string;
          customerInputs?: string[];
          customerEmail?: string;
          quantity: number;
        }) => {
          calls.createOrder.push({
            providerCode: code,
            clientOrderId: input.clientOrderId,
            sku: input.providerSku,
            customerInputs: input.customerInputs,
            customerEmail: input.customerEmail,
            quantity: input.quantity,
          });
          return behaviour.map[code]!({ clientOrderId: input.clientOrderId, sku: input.providerSku });
        },
      };
    },
  };
});

// Alerting reaches Telegram; stub it so the suite stays offline.
vi.mock("../src/lib/telegram/notify", () => ({
  notifyProviderFailure: async () => ({ sentToTelegram: false }),
}));

import { prisma } from "../src/lib/db";
import { dispatchPendingOrders, clientOrderIdFor } from "../src/lib/fulfillment";
import { ok, fail } from "../src/lib/providers/types";
import { encryptField } from "../src/lib/crypto";

const TAG = "fulfillment-test";
const EMAIL = "fulfillment-test@internal.test";

let userId: string;
let orderId: string;
/** A working supplier, and one that always fails. */
let offerWithGoodLink: string;
let offerWithBadThenGoodLink: string;
let goodOfferId: string;
const providerIds: Record<string, string> = {};

function makeOrder(code: string, offerIds: string[]) {
  return prisma.order.create({
    data: {
      code,
      userId,
      status: "PAID",
      paymentStatus: "PAID",
      totalMinor: 1000n,
      items: {
        create: offerIds.map((offerId) => ({
          offerId,
          quantity: 1,
          unitPriceMinor: 1000n,
          unitCostMinor: 500n,
          costCurrency: "USD",
          status: "AWAITING_FULFILLMENT",
        })),
      },
    },
    include: { items: true },
  });
}

async function cleanup() {
  await prisma.fulfillmentAttempt.deleteMany({
    where: { orderItem: { order: { user: { email: EMAIL } } } },
  });
  await prisma.providerOrder.deleteMany({
    where: { orderItem: { order: { user: { email: EMAIL } } } },
  });
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: EMAIL } } } });
  await prisma.order.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.offerComputedPrice.deleteMany({ where: { offer: { product: { slug: TAG } } } });
  await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: TAG } } } });
  await prisma.offer.deleteMany({ where: { product: { slug: TAG } } });
  await prisma.product.deleteMany({ where: { slug: TAG } });
  await prisma.category.deleteMany({ where: { slug: TAG } });
  await prisma.providerOffer.deleteMany({ where: { provider: { code: { startsWith: TAG } } } });
  await prisma.provider.deleteMany({ where: { code: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

beforeAll(async () => {
  await cleanup();

  userId = (await prisma.user.create({ data: { email: EMAIL } })).id;

  const category = await prisma.category.create({
    data: { slug: TAG, nameEn: "T", nameAr: "T", nameFr: "T" },
  });
  const product = await prisma.product.create({
    data: { slug: TAG, categoryId: category.id, nameEn: "T", nameAr: "T", nameFr: "T" },
  });

  const good = await prisma.provider.create({
    data: { code: `${TAG}-good`, displayName: "Good", baseUrl: "https://example.invalid" },
  });
  const bad = await prisma.provider.create({
    data: { code: `${TAG}-bad`, displayName: "Bad", baseUrl: "https://example.invalid" },
  });
  providerIds.good = good.id;
  providerIds.bad = bad.id;

  const goodPo = await prisma.providerOffer.create({
    data: {
      providerId: good.id, providerSku: "good-sku", rawName: "good",
      availability: "AVAILABLE", costMinor: 500n, currency: "USD",
    },
  });
  const badPo = await prisma.providerOffer.create({
    data: {
      providerId: bad.id, providerSku: "bad-sku", rawName: "bad",
      availability: "AVAILABLE", costMinor: 400n, currency: "USD",
    },
  });

  const offerA = await prisma.offer.create({
    data: { productId: product.id, labelEn: "Good only", labelAr: "G", labelFr: "G" },
  });
  const offerB = await prisma.offer.create({
    data: { productId: product.id, labelEn: "Bad then good", labelAr: "B", labelFr: "B" },
  });
  offerWithGoodLink = offerA.id;
  offerWithBadThenGoodLink = offerB.id;
  goodOfferId = offerA.id;

  await prisma.offerProviderLink.create({
    data: { offerId: offerA.id, providerOfferId: goodPo.id, priority: 0 },
  });
  // Lower priority number wins, so `bad` is tried first here.
  await prisma.offerProviderLink.create({
    data: { offerId: offerB.id, providerOfferId: badPo.id, priority: 0 },
  });
  await prisma.offerProviderLink.create({
    data: { offerId: offerB.id, providerOfferId: goodPo.id, priority: 1 },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  calls.createOrder = [];
  behaviour.map = {};
  await prisma.fulfillmentAttempt.deleteMany({
    where: { orderItem: { order: { userId } } },
  });
  await prisma.providerOrder.deleteMany({ where: { orderItem: { order: { userId } } } });
  await prisma.orderItem.deleteMany({ where: { order: { userId } } });
  await prisma.order.deleteMany({ where: { userId } });
});

/**
 * Item ids for one order, so a dispatch run is scoped to the rows this test
 * just created. Vitest runs files in parallel against one database, and the
 * unscoped sweep would otherwise drain another file's items mid-test.
 */
const itemIdsOf = (order: { items: { id: string }[] }) => order.items.map((i) => i.id);

const GOOD = `${TAG}-good`;

describe("dispatchPendingOrders", () => {
  it("places the order and marks the item completed", async () => {
    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "QCST",
        providerOrderId: "p-1",
        clientOrderId: null,
        status: "COMPLETED",
        rawStatus: "completed",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: false,
        delivery: null,
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    const order = await makeOrder("RQM-FULFILL-1", [offerWithGoodLink]);
    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    expect(outcomes.some((o) => o.kind === "completed")).toBe(true);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.status).toBe("COMPLETED");

    const po = await prisma.providerOrder.findFirstOrThrow({ where: { orderItemId: item.id } });
    expect(po.providerOrderId).toBe("p-1");
    expect(po.status).toBe("COMPLETED");
  });

  it("is idempotent: a re-run reuses the same clientOrderId", async () => {
    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "QCST",
        providerOrderId: "p-2",
        clientOrderId: null,
        status: "COMPLETED",
        rawStatus: "completed",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: false,
        delivery: null,
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    const order = await makeOrder("RQM-FULFILL-2", [offerWithGoodLink]);
    await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    const first = calls.createOrder.map((c) => c.clientOrderId);
    const second = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    // The id a retry would reuse is derived, not random.
    expect(first[0]).toMatch(/^oi_/);
    expect(await prisma.providerOrder.count({ where: { orderItem: { order: { userId } } } })).toBe(1);
  });

  it("derives a stable clientOrderId per item and link", async () => {
    const order = await makeOrder("RQM-FULFILL-3", [offerWithGoodLink]);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const link = await prisma.offerProviderLink.findFirstOrThrow({
      where: { offerId: offerWithGoodLink },
    });

    const a = clientOrderIdFor(item.id, link.providerOfferId);
    const b = clientOrderIdFor(item.id, link.providerOfferId);
    expect(a).toBe(b);

    const other = await prisma.offerProviderLink.findFirstOrThrow({
      where: { offerId: offerWithBadThenGoodLink, priority: 0 },
    });
    expect(clientOrderIdFor(item.id, other.providerOfferId)).not.toBe(a);
  });

  it("falls back to the next link when the first supplier fails", async () => {
    const BAD = `${TAG}-bad`;
    behaviour.map[BAD] = () =>
      fail({ kind: "provider", retryable: false, providerCode: "OUT_OF_STOCK", message: "sold out" });
    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "QCST",
        providerOrderId: "p-4",
        clientOrderId: null,
        status: "COMPLETED",
        rawStatus: "completed",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: false,
        delivery: null,
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    const order = await makeOrder("RQM-FULFILL-4", [offerWithBadThenGoodLink]);
    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    // Tried the bad one first, then succeeded on the good one.
    expect(calls.createOrder.map((c) => c.providerCode)).toEqual([BAD, GOOD]);
    expect(outcomes.some((o) => o.kind === "completed")).toBe(true);

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.status).toBe("COMPLETED");

    // Both attempts are auditable.
    const attempts = await prisma.fulfillmentAttempt.findMany({ where: { orderItemId: item.id } });
    expect(attempts.map((a) => a.status).sort()).toEqual(["FAILED", "SUCCEEDED"]);
    expect(attempts.find((a) => a.status === "FAILED")?.errorCode).toBe("OUT_OF_STOCK");
  });

  it("marks the item FAILED when every link fails", async () => {
    const BAD = `${TAG}-bad`;
    behaviour.map[BAD] = () =>
      fail({ kind: "provider", retryable: false, providerCode: "NOPE", message: "nope" });
    behaviour.map[GOOD] = () =>
      fail({ kind: "provider", retryable: false, providerCode: "NOPE", message: "nope" });

    const order = await makeOrder("RQM-FULFILL-5", [offerWithBadThenGoodLink]);
    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    expect(outcomes.some((o) => o.kind === "failed")).toBe(true);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.status).toBe("FAILED");
    const attempts = await prisma.fulfillmentAttempt.findMany({ where: { orderItemId: item.id } });
    expect(attempts).toHaveLength(2); // one per link, both recorded
  });

  it("keeps a provisional order PLACED and schedules a poll", async () => {
    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "QCST",
        providerOrderId: "p-6",
        clientOrderId: null,
        status: "AWAITING_ACTIVATION",
        rawStatus: "awaiting_activation",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: true,
        delivery: null,
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    const order = await makeOrder("RQM-FULFILL-6", [offerWithGoodLink]);
    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    expect(outcomes.some((o) => o.kind === "pending")).toBe(true);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.status).toBe("PLACED"); // not COMPLETED: provider still owes goods

    const po = await prisma.providerOrder.findFirstOrThrow({ where: { orderItemId: item.id } });
    expect(po.nextPollAt).not.toBeNull(); // picked up by a later reconcile pass
    expect(po.deliveryAvailable).toBe(false);
  });

  it("stores a synchronous delivery encrypted, bound to the row", async () => {
    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "CANBOSO",
        providerOrderId: "p-7",
        clientOrderId: null,
        status: "COMPLETED",
        rawStatus: "completed",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: false,
        delivery: {
          available: true,
          accounts: [
            {
              user: "buyer@example.com",
              password: "s3cret-pw",
              verifyEmail: null,
              expiryText: "12 months",
              otherInfo: null,
              credentialBlob: null,
              raw: {},
            },
          ],
          raw: {},
        },
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    const order = await makeOrder("RQM-FULFILL-7", [offerWithGoodLink]);
    await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const po = await prisma.providerOrder.findFirstOrThrow({ where: { orderItemId: item.id } });

    expect(po.deliveryAvailable).toBe(true);
    expect(po.deliveryEnc).toBeTruthy();
    // The password must never sit in the column in the clear.
    expect(po.deliveryEnc).not.toContain("s3cret-pw");
    expect(item.status).toBe("COMPLETED");
  });

  it("skips an item whose offer has no enabled link", async () => {
    const order = await makeOrder("RQM-FULFILL-8", [offerWithGoodLink]);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.offerProviderLink.updateMany({
      where: { offerId: offerWithGoodLink },
      data: { isEnabled: false },
    });

    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });
    expect(outcomes.some((o) => o.kind === "skipped")).toBe(true);

    const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.status).toBe("AWAITING_FULFILLMENT"); // untouched, not failed
    expect(calls.createOrder).toHaveLength(0);

    await prisma.offerProviderLink.updateMany({
      where: { offerId: offerWithGoodLink },
      data: { isEnabled: true },
    });
  });

  it("sends the decrypted customer input to the provider", async () => {
    const order = await makeOrder("RQM-FULFILL-9", [offerWithGoodLink]);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        requiresCustomerInput: true,
        customerInputEnc: encryptField({
          recordId: item.id,
          fieldName: "customerInput",
          plaintext: "buyer@example.com",
        }),
      },
    });

    behaviour.map[GOOD] = () =>
      ok({
        providerCode: "QCST",
        providerOrderId: "p-9",
        clientOrderId: null,
        status: "COMPLETED",
        rawStatus: "completed",
        quantity: 1,
        costMinor: 500,
        currency: "USD",
        cancellable: false,
        delivery: null,
        deliveryExpiresAt: null,
        createdAt: null,
        updatedAt: null,
        providerError: null,
        idempotencyReplayed: false,
        rawJson: {},
      });

    await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    // The stored envelope is opaque; what matters is the plaintext that left
    // the building was the buyer's value, not ciphertext or a wrong field.
    expect(calls.createOrder).toHaveLength(1);
    expect(calls.createOrder[0].customerInputs).toEqual(["buyer@example.com"]);
    expect(calls.createOrder[0].customerEmail).toBe("buyer@example.com");
  });

  it("refuses to dispatch when required input cannot be decrypted", async () => {
    const order = await makeOrder("RQM-FULFILL-10", [offerWithGoodLink]);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        requiresCustomerInput: true,
        customerInputEnc: "v1.not-a-real-envelope",
      },
    });

    behaviour.map[GOOD] = () => {
      throw new Error("adapter must not be called with unreadable input");
    };

    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: itemIdsOf(order) });

    expect(outcomes.some((o) => o.kind === "failed")).toBe(true);
    expect(calls.createOrder).toHaveLength(0); // nothing sent upstream
    const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.status).toBe("FAILED");
    const attempt = await prisma.fulfillmentAttempt.findFirstOrThrow({
      where: { orderItemId: item.id },
    });
    expect(attempt.errorCode).toBe("MISSING_CUSTOMER_INPUT");
  });

  it("returns nothing when no items are awaiting fulfillment", async () => {
    expect(await dispatchPendingOrders()).toEqual([]);
  });
});
