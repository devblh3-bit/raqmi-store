import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.ENCRYPTION_KEY ||= "a".repeat(64);
process.env.SESSION_SECRET ||= "s".repeat(48);

// The action's job is to gate placeOrder behind a session and translate thrown
// errors into UI state. Stub the two boundaries it owns (session, redirect) and
// let the real checkout + wallet run against the DB.
const session = vi.hoisted(() => ({ current: null as { userId: string; role: "CUSTOMER" } | null }));
const redirects = vi.hoisted(() => ({ to: [] as string[] }));

vi.mock("../src/lib/auth/session", () => ({
  getSession: async () => session.current,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirects.to.push(url);
    // next/navigation's redirect throws to halt rendering; mirror that.
    const e = new Error("NEXT_REDIRECT");
    (e as Error & { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

import { prisma } from "../src/lib/db";
import { buyNow } from "../src/app/actions/buy";
import { creditWallet } from "../src/lib/wallet";

const TAG = "buy-action-test";
const EMAIL = "buy-action-test@internal.test";
let userId: string;
let offerId: string;
let inputOfferId: string;

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

/** buyNow redirects on success, which our mock turns into a throw. */
async function call(fd: FormData) {
  try {
    return { state: await buyNow({}, fd), redirected: null as string | null };
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") {
      return { state: null, redirected: redirects.to.at(-1)! };
    }
    throw e;
  }
}

async function cleanup() {
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: EMAIL } } } });
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
    data: { code: TAG, displayName: "T", baseUrl: "https://example.invalid" },
  });
  const po = await prisma.providerOffer.create({
    data: {
      providerId: provider.id, providerSku: "plain", rawName: "plain",
      availability: "AVAILABLE", costMinor: 1000n, currency: "USD",
    },
  });
  const poInput = await prisma.providerOffer.create({
    data: {
      providerId: provider.id, providerSku: "needs-input", rawName: "needs input",
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
  await prisma.offerProviderLink.create({ data: { offerId: offer.id, providerOfferId: po.id } });
  await prisma.offerProviderLink.create({
    data: { offerId: inputOffer.id, providerOfferId: poInput.id },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  redirects.to = [];
  session.current = { userId, role: "CUSTOMER" };
  await prisma.orderItem.deleteMany({ where: { order: { userId } } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.walletTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
});

describe("buyNow action", () => {
  it("places the order and redirects to its code", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const { state, redirected } = await call(form({ offerId, locale: "en" }));
    expect(state).toBeNull();
    expect(redirected).toMatch(/^\/en\/orders\/RQM-[0-9A-Z]+$/);

    const order = await prisma.order.findFirstOrThrow({ where: { userId } });
    expect(redirected).toBe(`/en/orders/${order.code}`);
    expect(order.totalMinor).toBe(1000n);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(4000n);
  });

  it("sends anonymous buyers to login and places no order", async () => {
    session.current = null;
    const { redirected } = await call(form({ offerId, locale: "fr" }));
    // Falls back to the product list when the form supplied no returnTo.
    expect(redirected).toBe("/fr/login?next=%2Ffr%2Fproducts");
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it("returns the buyer to the product page after login", async () => {
    session.current = null;
    const { redirected } = await call(
      form({ offerId, locale: "en", returnTo: "/en/products/chatgpt-plus" }),
    );
    expect(redirected).toBe("/en/login?next=%2Fen%2Fproducts%2Fchatgpt-plus");
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it("drops an off-site returnTo instead of building an open redirect", async () => {
    session.current = null;

    for (const hostile of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      redirects.to = [];
      const { redirected } = await call(form({ offerId, locale: "en", returnTo: hostile }));
      expect(redirected).toBe("/en/login?next=%2Fen%2Fproducts");
      expect(redirected).not.toContain("evil.com");
    }
  });

  it("surfaces insufficient funds without creating an order", async () => {
    await creditWallet({ userId, amountMinor: 100, type: "DEPOSIT", reference: "seed" });

    const { state } = await call(form({ offerId, locale: "en" }));
    expect(state).toEqual({ error: "INSUFFICIENT_FUNDS" });
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(100n); // untouched
  });

  it("requires customer input when the provider asks for it", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    const missing = await call(form({ offerId: inputOfferId, locale: "en" }));
    expect(missing.state).toEqual({ error: "INPUT_REQUIRED" });
    expect(await prisma.order.count({ where: { userId } })).toBe(0);

    const ok = await call(
      form({ offerId: inputOfferId, locale: "en", customerInput: "buyer@example.com" }),
    );
    expect(ok.redirected).toMatch(/^\/en\/orders\/RQM-/);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { order: { userId } } });
    expect(item.customerInputEnc).toBeTruthy();
    expect(item.customerInputEnc).not.toContain("buyer@example.com");
  });

  it("rejects malformed input before reaching the wallet", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });

    for (const fd of [
      form({ offerId: "short", locale: "en" }),        // not a cuid
      form({ offerId, locale: "klingon" }),            // not a supported locale
      form({ locale: "en" }),                          // no offer at all
    ]) {
      const { state } = await call(fd);
      expect(state).toEqual({ error: "BAD_REQUEST" });
    }
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it("reports an unknown offer id as unavailable, not a crash", async () => {
    await creditWallet({ userId, amountMinor: 5000, type: "DEPOSIT", reference: "seed" });
    const { state } = await call(form({ offerId: "c".repeat(25), locale: "en" }));
    expect(state).toEqual({ error: "OFFER_UNAVAILABLE" });
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });
});
