import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// crypto.ts reads the KEK at call time; .env has no ENCRYPTION_KEY.
process.env.ENCRYPTION_KEY = "a".repeat(64);

import { prisma } from "../src/lib/db";
import { placeOrder, CheckoutError } from "../src/lib/checkout";
import { creditWallet, InsufficientFundsError } from "../src/lib/wallet";
import { decryptField } from "../src/lib/crypto";

// Integration test — needs the raqmi-pg container (DATABASE_URL in .env).
const TAG = "checkout-test";
const EMAIL = "checkout-test@internal.test";

let userId: string;
let offerId: string;      // plain offer, no customer input
let inputOfferId: string; // offer whose provider demands an email

async function cleanup() {
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: EMAIL } } } });
  await prisma.orderItem.deleteMany({ where: { offer: { product: { slug: TAG } } } });
  await prisma.order.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.walletTransaction.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.wallet.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.offerComputedPrice.deleteMany({ where: { offer: { product: { slug: TAG } } } });
  await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: TAG } } } });
  await prisma.offer.deleteMany({ where: { product: { slug: TAG } } });
  await prisma.product.deleteMany({ where: { slug: TAG } });
  await prisma.category.deleteMany({ where: { slug: TAG } });
  await prisma.providerOffer.deleteMany({ where: { provider: { code: TAG } } });
  await prisma.provider.deleteMany({ where: { code: TAG } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}

beforeAll(async () => {
  await cleanup();

  const user = await prisma.user.create({ data: { email: EMAIL } });
  userId = user.id;

  const category = await prisma.category.create({
    data: { slug: TAG, nameEn: "T", nameAr: "T", nameFr: "T" },
  });
  const product = await prisma.product.create({
    data: { slug: TAG, categoryId: category.id, nameEn: "T", nameAr: "T", nameFr: "T" },
  });
  const provider = await prisma.provider.create({
    data: { code: TAG, displayName: "Test", baseUrl: "https://example.invalid" },
  });

  // cost 1000 USD minor, +0% markup => price 1000
  const po = await prisma.providerOffer.create({
    data: {
      providerId: provider.id, providerSku: "sku-plain", rawName: "plain",
      availability: "AVAILABLE", costMinor: 1000n, currency: "USD",
      customerInputType: "NONE",
    },
  });
  const poInput = await prisma.providerOffer.create({
    data: {
      providerId: provider.id, providerSku: "sku-input", rawName: "needs input",
      availability: "AVAILABLE", costMinor: 500n, currency: "USD",
      customerInputType: "email", customerPrompt: "Your email",
    },
  });

  const offer = await prisma.offer.create({
    data: { productId: product.id, labelEn: "P", labelAr: "P", labelFr: "P" },
  });
  const inputOffer = await prisma.offer.create({
    data: { productId: product.id, labelEn: "I", labelAr: "I", labelFr: "I" },
  });
  offerId = offer.id;
  inputOfferId = inputOffer.id;

  await prisma.offerProviderLink.create({
    data: { offerId: offer.id, providerOfferId: po.id },
  });
  await prisma.offerProviderLink.create({
    data: { offerId: inputOffer.id, providerOfferId: poInput.id },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { userId } } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.walletTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
});

describe("placeOrder", () => {
  it("debits the wallet and creates the order atomically", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const order = await placeOrder({ userId, lines: [{ offerId, quantity: 2 }] });

    expect(order.totalMinor).toBe(2000n);
    expect(order.status).toBe("PAID");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].unitPriceMinor).toBe(1000n);
    expect(order.items[0].unitCostMinor).toBe(1000n);
    expect(order.items[0].procurementCostUsdMinor).toBe(1000n);
    expect(order.items[0].agencyFeeMinor).toBe(0n);
    expect(order.items[0].status).toBe("AWAITING_FULFILLMENT");

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(3000n);

    // ledger reference ties the debit back to the order
    const txn = await prisma.walletTransaction.findFirstOrThrow({
      where: { userId, type: "PURCHASE" },
    });
    expect(txn.reference).toBe(order.code);
    expect(txn.amountMinor).toBe(-2000n);
  });

  it("writes no order when funds are short", async () => {
    await creditWallet({ userId, amountMinor: 500, type: "DEPOSIT", reference: "seed" });

    await expect(placeOrder({ userId, lines: [{ offerId }] })).rejects.toThrow(
      InsufficientFundsError,
    );

    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(500n); // untouched
  });

  it("encrypts customer input at rest, bound to the item id", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const order = await placeOrder({
      userId,
      lines: [{ offerId: inputOfferId, customerInput: "buyer@example.com" }],
    });
    const item = order.items[0];

    expect(item.requiresCustomerInput).toBe(true);
    expect(item.customerInputEnc).toBeTruthy();
    expect(item.customerInputEnc).not.toContain("buyer@example.com");
    expect(
      decryptField({
        recordId: item.id,
        fieldName: "customerInput",
        payload: item.customerInputEnc!,
      }),
    ).toBe("buyer@example.com");
  });

  it("rejects a missing required input before touching the wallet", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    await expect(placeOrder({ userId, lines: [{ offerId: inputOfferId }] })).rejects.toThrow(
      CheckoutError,
    );

    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(5000n);
  });

  it("allows instant orders when customerInputType is NONE without input", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const order = await placeOrder({ userId, lines: [{ offerId }] });
    expect(order.items[0].requiresCustomerInput).toBe(false);
    expect(order.items[0].customerInputEnc).toBeNull();
  });

  it("falls back to guestEmail when an email offer omits customerInput", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const order = await placeOrder({
      userId,
      guestEmail: "guest-fallback@example.com",
      lines: [{ offerId: inputOfferId }],
    });
    const item = order.items[0];
    expect(item.requiresCustomerInput).toBe(true);
    expect(
      decryptField({
        recordId: item.id,
        fieldName: "customerInput",
        payload: item.customerInputEnc!,
      }),
    ).toBe("guest-fallback@example.com");
  });

  it("rejects bad quantities and an empty cart", async () => {
    await expect(placeOrder({ userId, lines: [] })).rejects.toThrow(CheckoutError);
    await expect(placeOrder({ userId, lines: [{ offerId, quantity: 0 }] })).rejects.toThrow(
      CheckoutError,
    );
    await expect(placeOrder({ userId, lines: [{ offerId, quantity: 1.5 }] })).rejects.toThrow(
      CheckoutError,
    );
  });
});
