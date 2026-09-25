import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAdapter } from "../src/lib/providers";
import { qcstAdapter } from "../src/lib/providers/qcst";
import { vbrAdapter } from "../src/lib/providers/vbr";
import { canbosoAdapter } from "../src/lib/providers/canboso";
import { prisma } from "../src/lib/db";
import { requestDeposit, approveDeposit } from "../src/lib/deposits";
import { placeOrder } from "../src/lib/checkout";
import { notifyPendingDeposit } from "../src/lib/telegram/notify";

const DRYRUN_TAG = "staging-dryrun";
const DRYRUN_EMAIL = "staging-dryrun-buyer@internal.test";

describe("Pre-Launch Provider Key Diagnostics & Staging Dry-Run (Option 3)", () => {
  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:TEST-TOKEN-STAGING");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "777001");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
  });

  describe("Provider Adapter Integrity & Key Diagnostics", () => {
    it("locates and registers all three upstream adapters: QCST, VBR, CANBOSO", () => {
      const qcst = getAdapter("qcst");
      const vbr = getAdapter("vbr");
      const canboso = getAdapter("canboso");

      expect(qcst).not.toBeNull();
      expect(vbr).not.toBeNull();
      expect(canboso).not.toBeNull();

      expect(qcst?.code).toBe("QCST");
      expect(vbr?.code).toBe("VBR");
      expect(canboso?.code).toBe("CANBOSO");
    });

    it("QCST adapter returns structured error when QCST_API_KEY is not configured", async () => {
      vi.stubEnv("QCST_API_KEY", "");
      const res = await qcstAdapter.getBalance();
      expect(res.ok).toBe(false);
      if (!res.ok && "error" in res) {
        expect(res.error.kind).toBe("auth");
        expect(res.error.retryable).toBe(false);
      }
    });

    it("VBR adapter returns structured error when VBR_API_KEY is not configured", async () => {
      vi.stubEnv("VBR_API_KEY", "");
      const res = await vbrAdapter.getBalance();
      expect(res.ok).toBe(false);
      if (!res.ok && "error" in res) {
        expect(res.error.kind).toBe("auth");
        expect(res.error.retryable).toBe(false);
      }
    });

    it("Canboso adapter returns structured error when CANBOSO_API_KEY is not configured", async () => {
      vi.stubEnv("CANBOSO_API_KEY", "");
      const res = await canbosoAdapter.getBalance();
      expect(res.ok).toBe(false);
      if (!res.ok && "error" in res) {
        expect(res.error.kind).toBe("auth");
        expect(res.error.retryable).toBe(false);
      }
    });

    it("verifies provider delivery capabilities for automated dispatch", () => {
      // Canboso delivers credentials synchronously on createOrder
      expect(canbosoAdapter.capabilities.polling).toBe(false);
      expect(canbosoAdapter.capabilities.synchronousDelivery).toBe(true);

      // VBR & QCST support asynchronous fulfillment polling and status checks
      expect(vbrAdapter.capabilities.polling).toBe(true);
      expect(qcstAdapter.capabilities.polling).toBe(true);
    });
  });

  describe("End-to-End Staging Customer & Operational Flow Dry-Run", () => {
    let testUserId: string;
    let testOfferId: string;

    beforeEach(async () => {
      // Clean up previous runs
      await prisma.orderItem.deleteMany({ where: { order: { user: { email: DRYRUN_EMAIL } } } });
      await prisma.order.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.deposit.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.walletTransaction.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.wallet.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: DRYRUN_TAG } } } });
      await prisma.offerComputedPrice.deleteMany({ where: { offer: { product: { slug: DRYRUN_TAG } } } });
      await prisma.offer.deleteMany({ where: { product: { slug: DRYRUN_TAG } } });
      await prisma.product.deleteMany({ where: { slug: DRYRUN_TAG } });
      await prisma.category.deleteMany({ where: { slug: DRYRUN_TAG } });
      await prisma.providerOffer.deleteMany({ where: { provider: { code: DRYRUN_TAG } } });
      await prisma.provider.deleteMany({ where: { code: DRYRUN_TAG } });
      await prisma.user.deleteMany({ where: { email: DRYRUN_EMAIL } });

      // Create test staging entities
      const user = await prisma.user.create({
        data: { email: DRYRUN_EMAIL },
      });
      testUserId = user.id;

      const category = await prisma.category.create({
        data: { slug: DRYRUN_TAG, nameEn: "Dryrun Category", nameAr: "تصنيف تجريبي", nameFr: "Catégorie Test" },
      });

      const product = await prisma.product.create({
        data: {
          slug: DRYRUN_TAG,
          categoryId: category.id,
          nameEn: "ChatGPT Pro Agency",
          nameAr: "شات جي بي تي برو",
          nameFr: "ChatGPT Pro",
        },
      });

      const provider = await prisma.provider.create({
        data: {
          code: DRYRUN_TAG,
          displayName: "Staging Provider",
          baseUrl: "https://staging.provider.invalid",
          balanceMinor: 5000n, // $50.00
          balanceCurrency: "USD",
          lowBalanceThresholdMinor: 2000n, // $20.00
        },
      });

      const providerOffer = await prisma.providerOffer.create({
        data: {
          providerId: provider.id,
          providerSku: "sku-dryrun-gpt",
          rawName: "ChatGPT Pro 1 Month",
          availability: "AVAILABLE",
          costMinor: 2000n, // $20.00 wholesale
          currency: "USD",
          customerInputType: "EMAIL",
          customerPrompt: "activation@example.com",
        },
      });

      const offer = await prisma.offer.create({
        data: {
          productId: product.id,
          labelEn: "1 Month Direct Agency",
          labelAr: "شهر واحد وكالة مباشرة",
          labelFr: "1 Mois Mandat Direct",
          markupPercent: 25.0,
        },
      });
      testOfferId = offer.id;

      await prisma.offerComputedPrice.create({
        data: {
          offerId: offer.id,
          priceMinor: 2500n, // $25.00 total authorized ($20 wholesale + $5 agency fee)
          costMinor: 2000n,
          providerOfferId: providerOffer.id,
        },
      });

      await prisma.offerProviderLink.create({
        data: {
          offerId: offer.id,
          providerOfferId: providerOffer.id,
          priority: 0,
          isEnabled: true,
        },
      });
    });

    afterEach(async () => {
      await prisma.orderItem.deleteMany({ where: { order: { user: { email: DRYRUN_EMAIL } } } });
      await prisma.order.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.deposit.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.walletTransaction.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.wallet.deleteMany({ where: { user: { email: DRYRUN_EMAIL } } });
      await prisma.offerProviderLink.deleteMany({ where: { offer: { product: { slug: DRYRUN_TAG } } } });
      await prisma.offerComputedPrice.deleteMany({ where: { offer: { product: { slug: DRYRUN_TAG } } } });
      await prisma.offer.deleteMany({ where: { product: { slug: DRYRUN_TAG } } });
      await prisma.product.deleteMany({ where: { slug: DRYRUN_TAG } });
      await prisma.category.deleteMany({ where: { slug: DRYRUN_TAG } });
      await prisma.providerOffer.deleteMany({ where: { provider: { code: DRYRUN_TAG } } });
      await prisma.provider.deleteMany({ where: { code: DRYRUN_TAG } });
      await prisma.user.deleteMany({ where: { email: DRYRUN_EMAIL } });
    });

    it("simulates full deposit request, receipt proof, and wallet approval", async () => {
      // 1. Customer initiates a manual deposit request
      const deposit = await requestDeposit({
        userId: testUserId,
        amountMinor: 5000n, // $50.00
        method: "MANUAL_BANK",
        txHash: "BARIDIMOB-REC-98213",
        proofImageUrl: "https://shop.example/receipts/proof-baridimob.jpg",
      });

      expect(deposit.status).toBe("PENDING");
      expect(deposit.amountMinor).toBe(5000n);

      // 2. Alert emitted to admin Telegram stream with receipt proof
      const alert = await notifyPendingDeposit(
        {
          depositId: deposit.id,
          customerLabel: DRYRUN_EMAIL,
          amount: "50.00",
          currency: "USD",
          method: "MANUAL_BANK",
          reference: "BARIDIMOB-REC-98213",
          proofUrl: "https://shop.example/receipts/proof-baridimob.jpg",
          withActions: true,
        },
        { telegram: false },
      );
      expect(alert.type).toBe("pending_deposit");

      // 3. Admin verifies receipt and approves deposit
      const approval = await approveDeposit({
        depositId: deposit.id,
        reviewedById: testUserId,
        reviewNote: "Receipt verified on BaridiMob ledger",
      });

      expect(approval.ok).toBe(true);

      // Verify wallet balance is credited
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: testUserId } });
      expect(wallet.balanceMinor).toBe(5000n);
    });

    it("simulates order placement with transparent agency fee and wallet settlement", async () => {
      // Pre-fund customer wallet with $50.00
      const deposit = await requestDeposit({
        userId: testUserId,
        amountMinor: 5000n,
        method: "MANUAL_BANK",
      });
      await approveDeposit({ depositId: deposit.id });

      // Place order with customer delivery input for activation
      const result = await placeOrder({
        userId: testUserId,
        lines: [
          {
            offerId: testOfferId,
            quantity: 1,
            customerInput: "customer-openai@example.com",
          },
        ],
      });

      expect(result.id).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.totalMinor).toBe(2500n); // $25.00 total authorized

      // Verify wallet deducted by total authorized capital
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: testUserId } });
      expect(wallet.balanceMinor).toBe(2500n); // $50.00 - $25.00 = $25.00 remaining

      // Verify order and item status in database
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: result.id },
        include: { items: true },
      });

      expect(order.status).toBe("PAID");
      expect(order.items.length).toBe(1);
      expect(order.items[0].status).toBe("AWAITING_FULFILLMENT");
      expect(order.items[0].unitPriceMinor).toBe(2500n);
      expect(order.items[0].procurementCostUsdMinor).toBe(2000n); // Stored wholesale procurement cost (Amanah)
      expect(order.items[0].agencyFeeMinor).toBe(500n); // Transparent agency fee (Ujrah)
    });
  });
});
