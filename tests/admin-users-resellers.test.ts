import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-users-tester",
    email: "admin-users@test.com",
    role: "ADMIN",
  })),
}));

import { prisma } from "../src/lib/db";
import {
  adjustUserBalance,
  updateUserRoleAndTier,
} from "../src/app/[locale]/admin/users/actions";
import {
  reviewResellerApplication,
  createResellerTier,
  updateResellerTier,
  deleteResellerTier,
  setTierPriceOverride,
  deleteTierPriceOverride,
} from "../src/app/[locale]/admin/resellers/actions";
import { priceForOffer } from "../src/lib/pricing";

const TEST_TAG = "test-users-resellers";

describe("Admin Users & Reseller Program Management", () => {
  const adminUserId = "admin-users-tester";
  const customerUserId = "cust-user-tester";
  const applicant1Id = "applicant1-tester";
  const applicant2Id = "applicant2-tester";

  let tierId: string;
  let offerId: string;

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: adminUserId },
    });
    await prisma.offerTierPriceOverride.deleteMany({
      where: { offer: { product: { slug: TEST_TAG } } },
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
    await prisma.walletTransaction.deleteMany({
      where: { userId: { in: [customerUserId, applicant1Id, applicant2Id] } },
    });
    await prisma.wallet.deleteMany({
      where: { userId: { in: [customerUserId, applicant1Id, applicant2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, customerUserId, applicant1Id, applicant2Id] } },
    });
    await prisma.resellerTier.deleteMany({
      where: { name: { startsWith: "Test Tier" } },
    });
  }

  beforeAll(async () => {
    await cleanup();

    // 1. Create users
    await prisma.user.createMany({
      data: [
        {
          id: adminUserId,
          email: "admin-users@test.com",
          role: "ADMIN",
        },
        {
          id: customerUserId,
          email: "cust-user@test.com",
          role: "CUSTOMER",
        },
        {
          id: applicant1Id,
          email: "applicant1@test.com",
          role: "RESELLER_APPLICANT",
        },
        {
          id: applicant2Id,
          email: "applicant2@test.com",
          role: "RESELLER_APPLICANT",
        },
      ],
    });

    // 2. Create customer wallet with $50.00
    await prisma.wallet.create({
      data: {
        userId: customerUserId,
        balanceMinor: 5000n,
        currency: "USD",
      },
    });

    // 3. Create initial tier
    const t = await prisma.resellerTier.create({
      data: {
        name: "Test Tier Silver",
        discountPercent: 10.0,
        minDepositMinor: 10000n,
      },
    });
    tierId = t.id;

    // 4. Create product, provider, provider offer, offer and link for matrix tests
    const cat = await prisma.category.create({
      data: {
        slug: TEST_TAG,
        nameEn: "Test Reseller Category",
        nameAr: "تصنيف تجريبي",
        nameFr: "Catégorie Test",
      },
    });

    const prod = await prisma.product.create({
      data: {
        slug: TEST_TAG,
        nameEn: "Test Reseller Product",
        nameAr: "منتج تجريبي",
        nameFr: "Produit Test",
        categoryId: cat.id,
      },
    });

    const prov = await prisma.provider.create({
      data: {
        code: TEST_TAG,
        displayName: "Test Reseller Provider",
        baseUrl: "https://api.testreseller.com",
        isActive: true,
      },
    });

    const po = await prisma.providerOffer.create({
      data: {
        providerId: prov.id,
        providerSku: `${TEST_TAG}-SKU-1`,
        rawName: "Wholesale SKU",
        costMinor: 500n, // $5.00
        currency: "USD",
        availability: "AVAILABLE",
      },
    });

    const off = await prisma.offer.create({
      data: {
        productId: prod.id,
        dedupeKey: `${TEST_TAG}-off`,
        labelEn: "1 Month Pro",
        labelAr: "1 شهر برو",
        labelFr: "1 Mois Pro",
        markupPercent: 100, // $5 cost + 100% markup = $10.00 retail
      },
    });
    offerId = off.id;

    await prisma.offerProviderLink.create({
      data: {
        offerId,
        providerOfferId: po.id,
        priority: 1,
        isEnabled: true,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("credits a user's wallet with mandatory audit reason and records WalletTransaction", async () => {
    const fd = new FormData();
    fd.append("userId", customerUserId);
    fd.append("direction", "credit");
    fd.append("amountMinor", "2000"); // $20.00
    fd.append("reason", "In-person CCP deposit #12345");

    const res = await adjustUserBalance(fd);
    expect("ok" in res && res.ok).toBe(true);

    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    expect(wallet.balanceMinor).toBe(7000n); // 5000 + 2000

    const txn = await prisma.walletTransaction.findFirst({
      where: { userId: customerUserId, type: "ADJUSTMENT", amountMinor: 2000n },
    });
    expect(txn).not.toBeNull();
    expect(txn?.note).toBe("In-person CCP deposit #12345");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "USER_BALANCE_ADJUSTED", entityId: customerUserId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);
  });

  it("debits a user's wallet and rejects when debit exceeds balance", async () => {
    // 1. Valid debit of $10.00
    const fd1 = new FormData();
    fd1.append("userId", customerUserId);
    fd1.append("direction", "debit");
    fd1.append("amountMinor", "1000"); // $10.00
    fd1.append("reason", "Administrative correction");

    const res1 = await adjustUserBalance(fd1);
    expect("ok" in res1 && res1.ok).toBe(true);

    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    expect(walletAfter.balanceMinor).toBe(6000n); // 7000 - 1000

    // 2. Excessive debit of $10,000.00 (exceeds balance)
    const fd2 = new FormData();
    fd2.append("userId", customerUserId);
    fd2.append("direction", "debit");
    fd2.append("amountMinor", "1000000");
    fd2.append("reason", "Bad deduction");

    const res2 = await adjustUserBalance(fd2);
    expect(res2).toEqual({ error: "INSUFFICIENT_FUNDS" });

    // Balance remains unchanged
    const walletUnchanged = await prisma.wallet.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    expect(walletUnchanged.balanceMinor).toBe(6000n);
  });

  it("updates user role and tier", async () => {
    const fd = new FormData();
    fd.append("userId", customerUserId);
    fd.append("role", "RESELLER");
    fd.append("tierId", tierId);

    const res = await updateUserRoleAndTier(fd);
    expect("ok" in res && res.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: customerUserId },
    });
    expect(user.role).toBe("RESELLER");
    expect(user.tierId).toBe(tierId);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "USER_ROLE_UPDATED", entityId: customerUserId },
    });
    expect(audit).not.toBeNull();
  });

  it("approves a reseller applicant and assigns a tier", async () => {
    const fd = new FormData();
    fd.append("userId", applicant1Id);
    fd.append("action", "approve");
    fd.append("tierId", tierId);

    const res = await reviewResellerApplication(fd);
    expect("ok" in res && res.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: applicant1Id },
    });
    expect(user.role).toBe("RESELLER");
    expect(user.tierId).toBe(tierId);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "RESELLER_APPLICATION_APPROVED", entityId: applicant1Id },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a reseller applicant and resets role to CUSTOMER", async () => {
    const fd = new FormData();
    fd.append("userId", applicant2Id);
    fd.append("action", "reject");
    fd.append("note", "Insufficient trade volume");

    const res = await reviewResellerApplication(fd);
    expect("ok" in res && res.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: applicant2Id },
    });
    expect(user.role).toBe("CUSTOMER");
    expect(user.tierId).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "RESELLER_APPLICATION_REJECTED", entityId: applicant2Id },
    });
    expect(audit).not.toBeNull();
  });

  it("creates, updates, and deletes reseller tiers", async () => {
    // 1. Create Tier
    const fdCreate = new FormData();
    fdCreate.append("name", "Test Tier Gold");
    fdCreate.append("discountPercent", "15.0");
    fdCreate.append("minDepositMinor", "20000");

    const resCreate = await createResellerTier(fdCreate);
    expect("ok" in resCreate && resCreate.ok).toBe(true);
    if (!("ok" in resCreate)) throw new Error("create failed");
    const newTierId = resCreate.tierId;

    // 2. Update Tier
    const fdUpdate = new FormData();
    fdUpdate.append("tierId", newTierId);
    fdUpdate.append("name", "Test Tier Platinum");
    fdUpdate.append("discountPercent", "20.0");
    fdUpdate.append("minDepositMinor", "25000");

    const resUpdate = await updateResellerTier(fdUpdate);
    expect("ok" in resUpdate && resUpdate.ok).toBe(true);

    const updated = await prisma.resellerTier.findUniqueOrThrow({
      where: { id: newTierId },
    });
    expect(updated.name).toBe("Test Tier Platinum");
    expect(Number(updated.discountPercent)).toBe(20.0);

    // 3. Delete Tier (no members attached)
    const fdDelete = new FormData();
    fdDelete.append("tierId", newTierId);

    const resDelete = await deleteResellerTier(fdDelete);
    expect("ok" in resDelete && resDelete.ok).toBe(true);

    const deleted = await prisma.resellerTier.findUnique({
      where: { id: newTierId },
    });
    expect(deleted).toBeNull();
  });

  it("sets a fixed wholesale price override and pricing engine respects it", async () => {
    // 1. Verify standard tier formula price:
    // Retail is $10.00, Test Tier Silver has 10% discount => $9.00 (900 minor)
    const standardQuote = await priceForOffer(offerId, tierId);
    expect(standardQuote.available).toBe(true);
    if (!standardQuote.available) throw new Error("quote unavailable");
    expect(standardQuote.priceMinor).toBe(900);
    expect(standardQuote.breakdown.overrideApplied).toBe(false);

    // 2. Set fixed wholesale price override: $7.50 (750 minor)
    const fdSet = new FormData();
    fdSet.append("offerId", offerId);
    fdSet.append("tierId", tierId);
    fdSet.append("priceMinor", "750");

    const resSet = await setTierPriceOverride(fdSet);
    expect("ok" in resSet && resSet.ok).toBe(true);

    // 3. Verify pricing engine now yields exactly $7.50 (750 minor) with overrideApplied
    const overrideQuote = await priceForOffer(offerId, tierId);
    expect(overrideQuote.available).toBe(true);
    if (!overrideQuote.available) throw new Error("quote unavailable");
    expect(overrideQuote.priceMinor).toBe(750);
    expect(overrideQuote.breakdown.overrideApplied).toBe(true);

    // 4. Delete override
    const fdDel = new FormData();
    fdDel.append("offerId", offerId);
    fdDel.append("tierId", tierId);

    const resDel = await deleteTierPriceOverride(fdDel);
    expect("ok" in resDel && resDel.ok).toBe(true);

    // 5. Verify price reverts back to formula price ($9.00)
    const restoredQuote = await priceForOffer(offerId, tierId);
    expect(restoredQuote.available).toBe(true);
    if (!restoredQuote.available) throw new Error("quote unavailable");
    expect(restoredQuote.priceMinor).toBe(900);
    expect(restoredQuote.breakdown.overrideApplied).toBe(false);
  });
});

