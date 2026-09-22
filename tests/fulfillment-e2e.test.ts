import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.ENCRYPTION_KEY ||= "a".repeat(64);

// The seeded catalog's links point at a placeholder supplier that has no real
// API, so the outward call is stubbed. Everything on our side — checkout,
// pricing, the dispatcher, the DB writes — runs for real.
vi.mock("../src/lib/providers", async () => {
  const { ok } = await vi.importActual<typeof import("../src/lib/providers/types")>(
    "../src/lib/providers/types",
  );
  return {
    getAdapter: () => ({
      code: "SEED",
      capabilities: {},
      createOrder: async (input: { clientOrderId: string; providerSku: string }) =>
        ok({
          providerCode: "QCST",
          providerOrderId: `e2e-${input.providerSku}`,
          clientOrderId: input.clientOrderId,
          status: "COMPLETED",
          rawStatus: "completed",
          quantity: 1,
          costMinor: 1,
          currency: "USD",
          cancellable: false,
          delivery: {
            available: true,
            accounts: [
              {
                user: "e2e@example.com",
                password: "e2e-password",
                verifyEmail: null,
                expiryText: "1 month",
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
        }),
    }),
  };
});
vi.mock("../src/lib/telegram/notify", () => ({
  notifyProviderFailure: async () => ({ sentToTelegram: false }),
}));

import { prisma } from "../src/lib/db";
import { placeOrder } from "../src/lib/checkout";
import { creditWallet } from "../src/lib/wallet";
import { getProducts } from "../src/lib/catalog";
import { priceForOffer } from "../src/lib/pricing";
import { dispatchPendingOrders } from "../src/lib/fulfillment";

/**
 * End-to-end through the real stack: a genuine order placed by checkout from
 * the seeded catalog, then picked up by the dispatcher. This is the test that
 * proves the two halves of the system actually meet — the unit-level dispatcher
 * tests use synthetic fixtures and would not catch a mismatch between what
 * checkout writes and what fulfillment expects to read.
 */
const EMAIL = "e2e-fulfillment@internal.test";
let userId: string;

async function cleanup() {
  await prisma.fulfillmentAttempt.deleteMany({
    where: { orderItem: { order: { user: { email: EMAIL } } } },
  });
  await prisma.providerOrder.deleteMany({
    where: { orderItem: { order: { user: { email: EMAIL } } } },
  });
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: EMAIL } } } });
  await prisma.order.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.walletTransaction.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.wallet.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.provider.updateMany({ data: { isActive: true } });
  await prisma.product.updateMany({ data: { isActive: true } });
  userId = (await prisma.user.create({ data: { email: EMAIL } })).id;
  await creditWallet({ userId, amountMinor: 500000, type: "DEPOSIT", reference: "e2e" });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("purchase to delivery", () => {
  it("carries a real catalog offer from checkout through to a delivered order", async () => {
    const products = await getProducts("en");
    let targetOffer: { id: string; price: number } | null = null;
    for (const p of products) {
      for (const o of p.offers) {
        const pr = await priceForOffer(o.id);
        if (pr.available) {
          targetOffer = { id: o.id, price: pr.priceMinor };
          break;
        }
      }
      if (targetOffer) break;
    }
    expect(targetOffer).not.toBeNull();
    const offer = targetOffer!;

    const order = await placeOrder({
      userId,
      lines: [{ offerId: offer.id, customerInput: "customer@example.com" }],
      locale: "en",
    });

    expect(order.status).toBe("PAID");
    expect(order.totalMinor).toBe(BigInt(offer.price));
    expect(order.items[0].status).toBe("AWAITING_FULFILLMENT");

    // The wallet was debited by exactly the listed price.
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(500000n - BigInt(offer.price));

    // Now hand it to fulfillment, scoped to this order's item. The unscoped
    // sweep is correct in production, but here it would also drain rows owned
    // by other test files running against the same database in parallel.
    const outcomes = await dispatchPendingOrders(25, { onlyItemIds: [order.items[0].id] });
    expect(outcomes.some((o) => o.itemId === order.items[0].id)).toBe(true);

    const item = await prisma.orderItem.findUniqueOrThrow({
      where: { id: order.items[0].id },
    });
    expect(item.status).toBe("COMPLETED");

    const po = await prisma.providerOrder.findFirstOrThrow({
      where: { orderItemId: item.id },
    });
    expect(po.status).toBe("COMPLETED");
    expect(po.deliveryAvailable).toBe(true);
    expect(po.deliveryEnc).toBeTruthy();
    expect(po.deliveryEnc).not.toContain("e2e-password");
    // Derivable id, so a retry replays instead of double-buying.
    expect(po.clientOrderId).toMatch(/^oi_/);

    const attempts = await prisma.fulfillmentAttempt.findMany({
      where: { orderItemId: item.id },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("SUCCEEDED");
  });

  it("does not dispatch the same item twice on a re-run", async () => {
    const before = await prisma.providerOrder.count({
      where: { orderItem: { order: { user: { email: EMAIL } } } },
    });
    // Nothing is left awaiting fulfillment for this item, so a second tick is
    // a no-op for it.
    const itemId = await prisma.orderItem
      .findFirstOrThrow({ where: { order: { user: { email: EMAIL } } } })
      .then((i) => i.id);
    expect(await dispatchPendingOrders(25, { onlyItemIds: [itemId] })).toEqual([]);
    const after = await prisma.providerOrder.count({
      where: { orderItem: { order: { user: { email: EMAIL } } } },
    });
    expect(after).toBe(before);
  });
});
