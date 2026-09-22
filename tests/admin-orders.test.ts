import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-orders-tester",
    email: "admin-orders@test.com",
    role: "ADMIN",
  })),
}));

import { prisma } from "../src/lib/db";
import {
  manualFulfillItem,
  refundOrderItem,
  refundOrder,
  retryOrderItem,
} from "../src/app/[locale]/admin/orders/actions";
import { decryptField } from "../src/lib/crypto";

const TEST_TAG = "test-admin-orders";

describe("Admin Orders & Recovery Actions", () => {
  const adminUserId = "admin-orders-tester";
  const customerUserId = "customer-orders-tester";
  let productId: string;
  let offerId1: string;
  let offerId2: string;

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: adminUserId },
    });
    await prisma.walletTransaction.deleteMany({
      where: { userId: customerUserId },
    });
    await prisma.wallet.deleteMany({
      where: { userId: customerUserId },
    });
    await prisma.fulfillmentAttempt.deleteMany({
      where: { orderItem: { order: { code: { startsWith: "RQM-TEST-" } } } },
    });
    await prisma.providerOrder.deleteMany({
      where: { orderItem: { order: { code: { startsWith: "RQM-TEST-" } } } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { code: { startsWith: "RQM-TEST-" } } },
    });
    await prisma.order.deleteMany({
      where: { code: { startsWith: "RQM-TEST-" } },
    });
    await prisma.offerProviderLink.deleteMany({
      where: { offer: { product: { slug: TEST_TAG } } },
    });
    await prisma.offer.deleteMany({
      where: { product: { slug: TEST_TAG } },
    });
    await prisma.product.deleteMany({
      where: { slug: TEST_TAG },
    });
    await prisma.category.deleteMany({
      where: { slug: TEST_TAG },
    });
    await prisma.providerOffer.deleteMany({
      where: { provider: { code: TEST_TAG } },
    });
    await prisma.provider.deleteMany({
      where: { code: TEST_TAG },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, customerUserId] } },
    });
  }

  beforeAll(async () => {
    await cleanup();

    // 1. Create admin and customer users
    await prisma.user.createMany({
      data: [
        {
          id: adminUserId,
          email: "admin-orders@test.com",
          role: "ADMIN",
        },
        {
          id: customerUserId,
          email: "customer-orders@test.com",
          role: "CUSTOMER",
        },
      ],
    });

    // 2. Initialize customer wallet with $50.00
    await prisma.wallet.create({
      data: {
        userId: customerUserId,
        balanceMinor: 5000n,
        currency: "USD",
      },
    });

    // 3. Create category, product, provider, provider offer, and offers
    const cat = await prisma.category.create({
      data: {
        slug: TEST_TAG,
        nameEn: "Test Category",
        nameAr: "تصنيف تجريبي",
        nameFr: "Catégorie Test",
      },
    });

    const prod = await prisma.product.create({
      data: {
        slug: TEST_TAG,
        nameEn: "Test Admin Orders Product",
        nameAr: "منتج طلبات تجريبي",
        nameFr: "Produit Test Commandes",
        categoryId: cat.id,
      },
    });
    productId = prod.id;

    const prov = await prisma.provider.create({
      data: {
        code: TEST_TAG,
        displayName: "Test Orders Provider",
        baseUrl: "https://api.testprovider.com",
        isActive: true,
      },
    });

    const po = await prisma.providerOffer.create({
      data: {
        providerId: prov.id,
        providerSku: `${TEST_TAG}-SKU-1`,
        rawName: "Provider SKU 1",
        costMinor: 500n,
        currency: "USD",
      },
    });

    const o1 = await prisma.offer.create({
      data: {
        productId,
        dedupeKey: `${TEST_TAG}-offer-1`,
        labelEn: "1 Month VIP",
        labelAr: "شهر واحد مميز",
        labelFr: "1 Mois VIP",
        markupPercent: 50,
      },
    });
    offerId1 = o1.id;

    const o2 = await prisma.offer.create({
      data: {
        productId,
        dedupeKey: `${TEST_TAG}-offer-2`,
        labelEn: "3 Months VIP",
        labelAr: "3 أشهر مميز",
        labelFr: "3 Mois VIP",
        markupPercent: 40,
      },
    });
    offerId2 = o2.id;

    await prisma.offerProviderLink.create({
      data: {
        offerId: offerId1,
        providerOfferId: po.id,
        priority: 1,
        isEnabled: true,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("manually fulfills an order item, encrypts credentials with AES-256-GCM, and marks order COMPLETED", async () => {
    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-001",
        userId: customerUserId,
        status: "PAID",
        paymentStatus: "PAID",
        totalMinor: 1000n,
        items: {
          create: [
            {
              offerId: offerId1,
              quantity: 1,
              unitPriceMinor: 1000n,
              unitCostMinor: 500n,
              status: "AWAITING_SELLER",
            },
          ],
        },
      },
      include: { items: true },
    });

    const itemId = order.items[0].id;
    const testSecretPayload = "USER: vip_buyer | PASS: SuperSecret123! | PROFILE: #4";

    const fd = new FormData();
    fd.append("orderItemId", itemId);
    fd.append("payload", testSecretPayload);

    const res = await manualFulfillItem(fd);
    expect(res).toEqual({ ok: true });

    // Verify item updated
    const updatedItem = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(updatedItem.status).toBe("COMPLETED");
    expect(updatedItem.deliveryPayloadEnc).toBeDefined();

    // Verify payload is encrypted and can be decrypted to exact text
    const decrypted = decryptField({
      recordId: itemId,
      fieldName: "deliveryPayloadEnc",
      payload: updatedItem.deliveryPayloadEnc!,
    });
    expect(decrypted).toBe(testSecretPayload);

    // Verify parent order transitioned to COMPLETED
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updatedOrder.status).toBe("COMPLETED");

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "ORDER_ITEM_MANUAL_FULFILL",
        entityId: itemId,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(adminUserId);
  });

  it("updates order status to PARTIALLY_DELIVERED when only one of multiple items is fulfilled", async () => {
    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-002",
        userId: customerUserId,
        status: "PAID",
        paymentStatus: "PAID",
        totalMinor: 2500n,
        items: {
          create: [
            {
              offerId: offerId1,
              quantity: 1,
              unitPriceMinor: 1000n,
              unitCostMinor: 500n,
              status: "AWAITING_SELLER",
            },
            {
              offerId: offerId2,
              quantity: 1,
              unitPriceMinor: 1500n,
              unitCostMinor: 800n,
              status: "AWAITING_SELLER",
            },
          ],
        },
      },
      include: { items: true },
    });

    const item1Id = order.items[0].id;
    const fd = new FormData();
    fd.append("orderItemId", item1Id);
    fd.append("payload", "Key-12345");

    const res = await manualFulfillItem(fd);
    expect(res).toEqual({ ok: true });

    // Check parent order is PARTIALLY_DELIVERED
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updatedOrder.status).toBe("PARTIALLY_DELIVERED");
  });

  it("1-click refunds an individual item to customer wallet and writes audit log", async () => {
    const walletBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });

    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-003",
        userId: customerUserId,
        status: "PAID",
        paymentStatus: "PAID",
        totalMinor: 1000n,
        items: {
          create: [
            {
              offerId: offerId1,
              quantity: 1,
              unitPriceMinor: 1000n,
              unitCostMinor: 500n,
              status: "FAILED",
            },
          ],
        },
      },
      include: { items: true },
    });

    const itemId = order.items[0].id;
    const fd = new FormData();
    fd.append("orderItemId", itemId);
    fd.append("reason", "Supplier out of stock");

    const res = await refundOrderItem(fd);
    expect(res).toEqual({ ok: true, amountMinor: "1000" });

    // Check wallet balance incremented by exactly $10.00 (1000 minor)
    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    expect(walletAfter.balanceMinor).toBe(walletBefore.balanceMinor + 1000n);

    // Check wallet transaction
    const txn = await prisma.walletTransaction.findFirst({
      where: {
        userId: customerUserId,
        type: "REFUND",
        reference: "RQM-TEST-003",
      },
    });
    expect(txn).toBeDefined();
    expect(txn?.amountMinor).toBe(1000n);

    // Check item and order status
    const updatedItem = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(updatedItem.status).toBe("REFUNDED");

    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updatedOrder.status).toBe("REFUNDED");
    expect(updatedOrder.paymentStatus).toBe("REFUNDED");

    // Check second refund attempt fails idempotently
    const secondRes = await refundOrderItem(fd);
    expect(secondRes).toEqual({ error: "ALREADY_REFUNDED" });
  });

  it("1-click refunds entire order to customer wallet", async () => {
    const walletBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });

    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-004",
        userId: customerUserId,
        status: "PAID",
        paymentStatus: "PAID",
        totalMinor: 2500n,
        items: {
          create: [
            {
              offerId: offerId1,
              quantity: 1,
              unitPriceMinor: 1000n,
              unitCostMinor: 500n,
              status: "FAILED",
            },
            {
              offerId: offerId2,
              quantity: 1,
              unitPriceMinor: 1500n,
              unitCostMinor: 800n,
              status: "AWAITING_SELLER",
            },
          ],
        },
      },
      include: { items: true },
    });

    const fd = new FormData();
    fd.append("orderId", order.id);
    fd.append("reason", "Customer cancelled entire order");

    const res = await refundOrder(fd);
    expect(res).toEqual({ ok: true, amountMinor: "2500" });

    // Wallet balance incremented by $25.00
    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    expect(walletAfter.balanceMinor).toBe(walletBefore.balanceMinor + 2500n);

    // Check order and all items are REFUNDED
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(updatedOrder.status).toBe("REFUNDED");
    expect(updatedOrder.paymentStatus).toBe("REFUNDED");
    expect(updatedOrder.items.every((i) => i.status === "REFUNDED")).toBe(true);

    // Check AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "ORDER_REFUNDED",
        entityId: order.id,
      },
    });
    expect(audit).toBeDefined();
  });

  it("retries dispatch on a failed order item by resetting status and triggering fulfillment", async () => {
    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-005",
        userId: customerUserId,
        status: "FAILED",
        paymentStatus: "PAID",
        totalMinor: 1000n,
        items: {
          create: [
            {
              offerId: offerId1,
              quantity: 1,
              unitPriceMinor: 1000n,
              unitCostMinor: 500n,
              status: "FAILED",
              attemptCount: 5,
            },
          ],
        },
      },
      include: { items: true },
    });

    const itemId = order.items[0].id;
    const fd = new FormData();
    fd.append("orderItemId", itemId);

    const res = await retryOrderItem(fd);
    expect("ok" in res && res.ok).toBe(true);

    // Check audit log recorded
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "ORDER_ITEM_RETRY_DISPATCH",
        entityId: itemId,
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(adminUserId);
  });
});
