import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionUser: { userId: string; role: string; exp: number } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(async () => mockSessionUser),
}));

const mockNotifyReseller = vi.fn();
vi.mock("@/lib/telegram/notify", () => ({
  notifyResellerApplication: vi.fn(async (input) => mockNotifyReseller(input)),
}));

process.env.ENCRYPTION_KEY ||= "a".repeat(64);
process.env.SESSION_SECRET ||= "s".repeat(48);

import { prisma } from "../src/lib/db";
import { submitResellerApplication } from "../src/app/actions/reseller";
import { getResellerRateSheet, getResellerOrdersWithKeys } from "../src/lib/reseller";
import { encryptField } from "../src/lib/crypto";

const TAG = "reseller-exp-test";

describe("Wholesale Partner Experience & Reseller Flow", () => {
  const customerId = "test-cust-reseller-exp";
  const resellerId = "test-reseller-user-exp";
  let tierId: string;
  let offerId: string;
  let orderItemId: string;

  beforeAll(async () => {
    // 1. Cleanup
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [customerId, resellerId] } } });
    await prisma.orderItem.deleteMany({ where: { order: { code: `RQ-${TAG}` } } });
    await prisma.order.deleteMany({ where: { code: `RQ-${TAG}` } });
    await prisma.offerTierPriceOverride.deleteMany({ where: { offer: { product: { slug: TAG } } } });
    await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: TAG } } } });
    await prisma.offer.deleteMany({ where: { product: { slug: TAG } } });
    await prisma.product.deleteMany({ where: { slug: TAG } });
    await prisma.category.deleteMany({ where: { slug: TAG } });
    await prisma.providerOffer.deleteMany({ where: { provider: { code: TAG } } });
    await prisma.provider.deleteMany({ where: { code: TAG } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, resellerId] } } });
    await prisma.resellerTier.deleteMany({ where: { name: "Exp Gold Tier" } });

    // 2. Create Reseller Tier
    const tier = await prisma.resellerTier.create({
      data: {
        name: "Exp Gold Tier",
        discountPercent: 15.0,
        minDepositMinor: 5000n,
      },
    });
    tierId = tier.id;

    // 3. Create Users
    await prisma.user.create({
      data: {
        id: customerId,
        email: "customer-exp@test.com",
        role: "CUSTOMER",
      },
    });

    await prisma.user.create({
      data: {
        id: resellerId,
        email: "reseller-exp@test.com",
        role: "RESELLER",
        tierId,
      },
    });

    // 4. Create Catalog with active offer and provider link
    const cat = await prisma.category.create({
      data: {
        slug: TAG,
        nameEn: "Wholesale Test Category",
        nameAr: "قسم اختبار الجملة",
        nameFr: "Catégorie Test Grossiste",
      },
    });

    const prod = await prisma.product.create({
      data: {
        slug: TAG,
        nameEn: "Free Fire 1080 Diamonds",
        nameAr: "فري فاير 1080 جوهرة",
        nameFr: "Free Fire 1080 Diamants",
        categoryId: cat.id,
        images: ["/test.png"],
      },
    });
    await prisma.offer.create({
      data: {
        productId: prod.id,
        labelEn: "1080 Diamonds Instant",
        labelAr: "1080 جوهرة فوري",
        labelFr: "1080 Diamants Instantané",
        markupPercent: 20,
      },
    }).then((o) => {
      offerId = o.id;
    });

    const prov = await prisma.provider.create({
      data: {
        code: TAG,
        displayName: "Exp Provider",
        baseUrl: "https://api.exp-provider.com",
        isActive: true,
      },
    });

    const po = await prisma.providerOffer.create({
      data: {
        providerId: prov.id,
        providerSku: "FF1080",
        rawName: "FF 1080 Diamonds",
        currency: "USD",
        costMinor: 1000n, // $10.00 cost
        availability: "AVAILABLE",
      },
    });

    await prisma.offerProviderLink.create({
      data: {
        offerId,
        providerOfferId: po.id,
        priority: 1,
        isEnabled: true,
      },
    });

    // 5. Create a completed order with encrypted delivery payload
    const order = await prisma.order.create({
      data: {
        code: `RQ-${TAG}`,
        userId: resellerId,
        totalMinor: 1020n,
        status: "COMPLETED",
      },
    });

    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        offerId,
        quantity: 1,
        unitPriceMinor: 1020n,
        unitCostMinor: 1000n,
        status: "COMPLETED",
      },
    });
    orderItemId = item.id;

    const encKey = encryptField({
      recordId: item.id,
      fieldName: "deliveryPayloadEnc",
      plaintext: "FF-REDEEM-KEY-9988-7766",
    });

    await prisma.orderItem.update({
      where: { id: item.id },
      data: { deliveryPayloadEnc: encKey },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [customerId, resellerId] } } });
    await prisma.orderItem.deleteMany({ where: { order: { code: `RQ-${TAG}` } } });
    await prisma.order.deleteMany({ where: { code: `RQ-${TAG}` } });
    await prisma.offerTierPriceOverride.deleteMany({ where: { offer: { product: { slug: TAG } } } });
    await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: TAG } } } });
    await prisma.offer.deleteMany({ where: { product: { slug: TAG } } });
    await prisma.product.deleteMany({ where: { slug: TAG } });
    await prisma.category.deleteMany({ where: { slug: TAG } });
    await prisma.providerOffer.deleteMany({ where: { provider: { code: TAG } } });
    await prisma.provider.deleteMany({ where: { code: TAG } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, resellerId] } } });
    await prisma.resellerTier.deleteMany({ where: { id: tierId } });
    await prisma.$disconnect();
  });

  describe("Customer Reseller Application Action", () => {
    it("refuses unauthenticated application attempts", async () => {
      mockSessionUser = null;
      const fd = new FormData();
      fd.append("businessName", "Karim Gaming");
      fd.append("contact", "@karim_dz");

      const res = await submitResellerApplication(null, fd);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("UNAUTHORIZED");
      }
    });

    it("validates required form fields", async () => {
      mockSessionUser = { userId: customerId, role: "CUSTOMER", exp: Date.now() + 10000 };
      const fd = new FormData();
      fd.append("businessName", "");
      fd.append("contact", "");

      const res = await submitResellerApplication(null, fd);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Business name is required");
      }
    });

    it("successfully submits application, updates role to RESELLER_APPLICANT, and dispatches Telegram alert", async () => {
      mockSessionUser = { userId: customerId, role: "CUSTOMER", exp: Date.now() + 10000 };
      const fd = new FormData();
      fd.append("businessName", "Algiers Top-up Studio");
      fd.append("contact", "Telegram @algiers_topup / 0555123456");
      fd.append("note", "We sell 200 Free Fire cards weekly");

      const res = await submitResellerApplication(null, fd);
      expect(res.ok).toBe(true);

      const updatedUser = await prisma.user.findUnique({ where: { id: customerId } });
      expect(updatedUser?.role).toBe("RESELLER_APPLICANT");

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: customerId, action: "RESELLER_APPLICATION_SUBMITTED" },
      });
      expect(audit).not.toBeNull();

      expect(mockNotifyReseller).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: customerId,
          businessName: "Algiers Top-up Studio",
          contact: "Telegram @algiers_topup / 0555123456",
        }),
      );
    });

    it("prevents already verified resellers from re-applying", async () => {
      mockSessionUser = { userId: resellerId, role: "RESELLER", exp: Date.now() + 10000 };
      const fd = new FormData();
      fd.append("businessName", "Another Store");
      fd.append("contact", "0555000111");

      const res = await submitResellerApplication(null, fd);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("ALREADY_RESELLER");
      }
    });
  });

  describe("Reseller Rate Sheet Generator", () => {
    it("computes retail price, wholesale price with 15% discount, and profit margin", async () => {
      const rateSheet = await getResellerRateSheet(tierId);
      expect(rateSheet.length).toBeGreaterThan(0);

      const item = rateSheet.find((r) => r.offerId === offerId);
      expect(item).toBeDefined();

      // Base cost: 1000 ($10.00). Markup 20% -> Retail: 1200 ($12.00).
      expect(item!.retailPriceMinor).toBe(1200);

      // Gold Tier: 15% discount -> 1200 - 180 = 1020 ($10.20).
      expect(item!.wholesalePriceMinor).toBe(1020);

      // Margin: 1200 - 1020 = 180 ($1.80 margin)
      expect(item!.marginMinor).toBe(180);
      expect(item!.marginPercent).toBeCloseTo(15.0, 1);
    });
  });

  describe("Reseller Order Key Decryption Center", () => {
    it("decrypts delivered credentials and prepares 1-click clipboard payload", async () => {
      const orders = await getResellerOrdersWithKeys(resellerId);
      expect(orders.length).toBeGreaterThan(0);

      const orderItem = orders.find((o) => o.id === orderItemId);
      expect(orderItem).toBeDefined();
      expect(orderItem!.deliveredPayload).toBe("FF-REDEEM-KEY-9988-7766");
      expect(orderItem!.status).toBe("COMPLETED");
      expect(orderItem!.productName).toBe("Free Fire 1080 Diamonds");
    });
  });
});
