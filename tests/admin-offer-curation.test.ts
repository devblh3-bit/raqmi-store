import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-test-id",
    email: "admin@test.com",
    role: "ADMIN",
  })),
}));

import { prisma } from "../src/lib/db";
import {
  createOfferFromProvider,
  attachBackupProvider,
  updateOfferFull,
  toggleLink,
  reorderLink,
  deleteLink,
  deleteOffer,
  linkProviderOfferToExistingProduct,
} from "../src/app/[locale]/admin/catalog/actions";
import { priceForOffer } from "../src/lib/pricing";

const TEST_TAG = "test-offer-curation";

describe("Admin Offer Curation & Fallback Actions", () => {
  let productId: string;
  let providerOffer1Id: string;
  let providerOffer2Id: string;
  let createdOfferId: string;

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: "admin-test-id" },
    });
    await prisma.offerProviderLink.deleteMany({
      where: { offer: { product: { slug: TEST_TAG } } },
    });
    await prisma.offer.deleteMany({ where: { product: { slug: TEST_TAG } } });
    await prisma.product.deleteMany({ where: { slug: TEST_TAG } });
    await prisma.category.deleteMany({ where: { slug: TEST_TAG } });
    await prisma.providerOffer.deleteMany({
      where: { provider: { code: { in: [`${TEST_TAG}-1`, `${TEST_TAG}-2`] } } },
    });
    await prisma.provider.deleteMany({
      where: { code: { in: [`${TEST_TAG}-1`, `${TEST_TAG}-2`] } },
    });
    await prisma.user.deleteMany({
      where: { id: "admin-test-id" },
    });
  }

  beforeAll(async () => {
    await cleanup();

    await prisma.user.create({
      data: {
        id: "admin-test-id",
        email: "admin@test.com",
        role: "ADMIN",
      },
    });

    const category = await prisma.category.create({
      data: { slug: TEST_TAG, nameEn: "Cat", nameAr: "فئة", nameFr: "Cat" },
    });

    const product = await prisma.product.create({
      data: {
        slug: TEST_TAG,
        categoryId: category.id,
        nameEn: "Curated Product",
        nameAr: "منتج منسق",
        nameFr: "Produit",
      },
    });
    productId = product.id;

    const provider1 = await prisma.provider.create({
      data: { code: `${TEST_TAG}-1`, displayName: "Primary Supplier", baseUrl: "https://p1.invalid" },
    });
    const provider2 = await prisma.provider.create({
      data: { code: `${TEST_TAG}-2`, displayName: "Backup Supplier", baseUrl: "https://p2.invalid" },
    });

    const po1 = await prisma.providerOffer.create({
      data: {
        providerId: provider1.id,
        providerSku: "sku-primary",
        rawName: "Shared 1M 15d",
        costMinor: 1000n, // $10.00
        currency: "USD",
        availability: "AVAILABLE",
      },
    });
    providerOffer1Id = po1.id;

    const po2 = await prisma.providerOffer.create({
      data: {
        providerId: provider2.id,
        providerSku: "sku-backup",
        rawName: "Shared 1M 15d Backup",
        costMinor: 1200n, // $12.00
        currency: "USD",
        availability: "AVAILABLE",
      },
    });
    providerOffer2Id = po2.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates a variant from a provider offer with multi-language rules and markup", async () => {
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("providerOfferId", providerOffer1Id);
    fd.append("labelEn", "1 Month — Shared Profile");
    fd.append("labelAr", "شهر واحد — حساب مشترك");
    fd.append("labelFr", "1 Mois — Profil Partagé");
    fd.append("rulesEn", "15 days warranty. 1 device only.");
    fd.append("rulesAr", "ضمان 15 يوم. جهاز واحد فقط.");
    fd.append("rulesFr", "Garantie 15 jours. 1 appareil.");
    fd.append("markupPercent", "25");
    fd.append("badge", "BUDGET");
    fd.append("compareAtMinor", "1500"); // $15.00 crossed out

    const result = await createOfferFromProvider(fd);
    expect(result).toHaveProperty("ok", true);
    expect("offerId" in result).toBe(true);

    if ("offerId" in result && result.offerId) {
      createdOfferId = result.offerId;
    }

    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: createdOfferId },
      include: { links: true },
    });

    expect(offer.labelEn).toBe("1 Month — Shared Profile");
    expect(offer.labelAr).toBe("شهر واحد — حساب مشترك");
    expect(offer.labelFr).toBe("1 Mois — Profil Partagé");
    expect(offer.rulesEn).toBe("15 days warranty. 1 device only.");
    expect(offer.rulesAr).toBe("ضمان 15 يوم. جهاز واحد فقط.");
    expect(offer.rulesFr).toBe("Garantie 15 jours. 1 appareil.");
    expect(Number(offer.markupPercent)).toBe(25);
    expect(offer.badge).toBe("BUDGET");
    expect(offer.compareAtMinor).toBe(1500n);
    expect(offer.productPinned).toBe(true);
    expect(offer.links).toHaveLength(1);
    expect(offer.links[0].priority).toBe(1);
    expect(offer.links[0].providerOfferId).toBe(providerOffer1Id);

    // Audit log check
    const audit = await prisma.auditLog.findFirst({
      where: { action: "OFFER_CREATED_FROM_PROVIDER", entityId: createdOfferId },
    });
    expect(audit).not.toBeNull();

    // Verify pricing engine calculated cost ($10) + markup (25%) = $12.50 (1250 minor)
    const quote = await priceForOffer(createdOfferId);
    expect(quote.available).toBe(true);
    if (!quote.available) throw new Error("quote unavailable");
    expect(quote.priceMinor).toBe(1250);
  });

  it("attaches a secondary provider offer as Priority 2 backup fallback", async () => {
    const fd = new FormData();
    fd.append("offerId", createdOfferId);
    fd.append("providerOfferId", providerOffer2Id);

    const result = await attachBackupProvider(fd);
    expect(result).toHaveProperty("ok", true);

    const links = await prisma.offerProviderLink.findMany({
      where: { offerId: createdOfferId },
      orderBy: { priority: "asc" },
    });

    expect(links).toHaveLength(2);
    expect(links[0].providerOfferId).toBe(providerOffer1Id);
    expect(links[0].priority).toBe(1);
    expect(links[1].providerOfferId).toBe(providerOffer2Id);
    expect(links[1].priority).toBe(2);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "BACKUP_PROVIDER_ATTACHED", entityId: links[1].id },
    });
    expect(audit).not.toBeNull();
  });

  it("toggles and reorders links", async () => {
    const links = await prisma.offerProviderLink.findMany({
      where: { offerId: createdOfferId },
      orderBy: { priority: "asc" },
    });

    // Reorder: move link 2 up
    const reorderFd = new FormData();
    reorderFd.append("linkId", links[1].id);
    reorderFd.append("direction", "up");
    await reorderLink(reorderFd);

    const updatedLinks = await prisma.offerProviderLink.findMany({
      where: { offerId: createdOfferId },
      orderBy: { priority: "asc" },
    });

    // Now providerOffer2 is priority 1, and providerOffer1 is priority 2
    expect(updatedLinks[0].providerOfferId).toBe(providerOffer2Id);
    expect(updatedLinks[1].providerOfferId).toBe(providerOffer1Id);

    // Toggle link disabled
    const toggleFd = new FormData();
    toggleFd.append("linkId", updatedLinks[0].id);
    toggleFd.append("isEnabled", "false");
    await toggleLink(toggleFd);

    const toggled = await prisma.offerProviderLink.findUniqueOrThrow({
      where: { id: updatedLinks[0].id },
    });
    expect(toggled.isEnabled).toBe(false);
  });

  it("updates offer labels, rules, and markup", async () => {
    const fd = new FormData();
    fd.append("offerId", createdOfferId);
    fd.append("labelEn", "Updated EN");
    fd.append("labelAr", "تحديث عربي");
    fd.append("labelFr", "Mis à jour FR");
    fd.append("rulesEn", "New rules EN");
    fd.append("rulesAr", "تعليمات جديدة");
    fd.append("rulesFr", "Nouvelles règles");
    fd.append("markupPercent", "50");
    fd.append("badge", "POPULAR");

    const result = await updateOfferFull(fd);
    expect(result).toHaveProperty("ok", true);

    const updated = await prisma.offer.findUniqueOrThrow({
      where: { id: createdOfferId },
    });

    expect(updated.labelEn).toBe("Updated EN");
    expect(updated.labelAr).toBe("تحديث عربي");
    expect(updated.rulesEn).toBe("New rules EN");
    expect(Number(updated.markupPercent)).toBe(50);
    expect(updated.badge).toBe("POPULAR");
  });

  it("deletes link and deletes offer cleanly", async () => {
    expect(createdOfferId).toBeDefined();
    const links = await prisma.offerProviderLink.findMany({
      where: { offerId: createdOfferId },
    });
    expect(links.length).toBeGreaterThan(0);

    const delLinkFd = new FormData();
    delLinkFd.append("linkId", links[0].id);
    await deleteLink(delLinkFd);

    const remainingLinks = await prisma.offerProviderLink.findMany({
      where: { offerId: createdOfferId },
    });
    expect(remainingLinks).toHaveLength(1);

    const delOfferFd = new FormData();
    delOfferFd.append("offerId", createdOfferId);
    await deleteOffer(delOfferFd);

    const deleted = await prisma.offer.findUnique({
      where: { id: createdOfferId },
    });
    expect(deleted).toBeNull();
  });

  it("auto-fills rules & warranty instructions from provider offer description on variant creation and linking", async () => {
    // 1. Create a provider offer with rich description
    const richPo = await prisma.providerOffer.create({
      data: {
        providerId: (await prisma.provider.findFirstOrThrow({ where: { code: `${TEST_TAG}-1` } })).id,
        providerSku: "sku-rich-desc",
        rawName: "Premium License 30D",
        rawDescription: "30 days replacement warranty. Instant login credentials. Contact support for assistance.",
        rawWarranty: "30 days",
        costMinor: 800n,
        currency: "USD",
        availability: "AVAILABLE",
      },
    });

    // 2. Create variant via createOfferFromProvider with empty rules
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("providerOfferId", richPo.id);
    fd.append("labelEn", "Premium License 30D Auto Rules");
    fd.append("labelAr", "رخصة مميزة 30 يوم");
    fd.append("labelFr", "Licence Premium 30J");
    // omit rulesEn, rulesAr, rulesFr
    fd.append("markupPercent", "20");

    const res = await createOfferFromProvider(fd);
    expect(res).toHaveProperty("ok", true);
    if ("offerId" in res && res.offerId) {
      const created = await prisma.offer.findUniqueOrThrow({ where: { id: res.offerId } });
      expect(created.rulesEn).toContain("30 days replacement warranty");
      expect(created.rulesAr).toBeTruthy();
      expect(created.rulesFr).toBeTruthy();
      await prisma.offerProviderLink.deleteMany({ where: { offerId: res.offerId } });
      await prisma.offer.delete({ where: { id: res.offerId } });
    }

    // 3. Link via linkProviderOfferToExistingProduct with empty rules
    const linkRes = await linkProviderOfferToExistingProduct(productId, richPo.id, "Linked Auto Rules Variant", 20);
    expect(linkRes).toHaveProperty("ok", true);
    if ("offerId" in linkRes && linkRes.offerId) {
      const linked = await prisma.offer.findUniqueOrThrow({ where: { id: linkRes.offerId } });
      expect(linked.rulesEn).toContain("30 days replacement warranty");
      expect(linked.rulesAr).toBeTruthy();
      expect(linked.rulesFr).toBeTruthy();
      await prisma.offerProviderLink.deleteMany({ where: { offerId: linkRes.offerId } });
      await prisma.offer.delete({ where: { id: linkRes.offerId } });
    }

    await prisma.providerOffer.delete({ where: { id: richPo.id } });
  });

  it("safely archives an offer when customer order items exist instead of failing with foreign key violation", async () => {
    // 1. Create an offer
    const offer = await prisma.offer.create({
      data: {
        productId,
        labelEn: "Variant with Past Orders",
        labelAr: "متغير مع طلبات سابقة",
        labelFr: "Variante avec commandes",
        markupPercent: 10,
        isActive: true,
      },
    });

    // 2. Create an order and orderItem referencing this offer
    const order = await prisma.order.create({
      data: {
        code: "RQM-TEST-FK-SAFETY-01234",
        totalMinor: 500n,
      },
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        offerId: offer.id,
        quantity: 1,
        unitPriceMinor: 500n,
        unitCostMinor: 400n,
      },
    });

    // 3. Attempt deleteOffer
    const fd = new FormData();
    fd.append("offerId", offer.id);
    const res = await deleteOffer(fd);

    expect(res).toHaveProperty("ok", true);
    expect(res).toHaveProperty("archived", true);

    // 4. Verify the offer is deactivated & archived, NOT crashing
    const updatedOffer = await prisma.offer.findUniqueOrThrow({
      where: { id: offer.id },
    });
    expect(updatedOffer.isActive).toBe(false);
    expect(updatedOffer.labelEn).toContain("[Archived]");

    // Clean up test data
    await prisma.orderItem.delete({ where: { id: orderItem.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
  });
});

