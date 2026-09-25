import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  notifyProviderFailure,
  notifyPendingDeposit,
  notifyLowProviderBalance,
  ALERT_CLASSIFICATION,
  resetThrottle,
} from "../src/lib/telegram/notify";

const FAKE_TOKEN = "123456:TEST-FAKE-TOKEN-bbbbbbbbbbbbbbbbbbbbbbbbbb";
const ADMIN_ID = "777001";

describe("Unified Operational Telegram Stream (ADR 0002)", () => {
  let sentMessages: { text: string; disableNotification?: boolean; buttons?: unknown }[] = [];

  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", FAKE_TOKEN);
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", ADMIN_ID);
    resetThrottle();
    sentMessages = [];

    // Mock global fetch to capture Telegram Bot API sendMessage calls
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: unknown) => {
        const body = JSON.parse((init as RequestInit).body as string);
        sentMessages.push({
          text: body.text,
          disableNotification: body.disable_notification,
          buttons: body.reply_markup,
        });
        return {
          status: 200,
          headers: { get: () => null },
          text: async () => JSON.stringify({ ok: true, result: { message_id: 1001 } }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("verifies ADR 0002 high-contrast emoji classification mapping", () => {
    expect(ALERT_CLASSIFICATION.provider_failure).toEqual({ emoji: "🚨", badge: "URGENT" });
    expect(ALERT_CLASSIFICATION.margin_violation).toEqual({ emoji: "🚨", badge: "URGENT" });
    expect(ALERT_CLASSIFICATION.pending_deposit).toEqual({ emoji: "💰", badge: "FINANCIAL" });
    expect(ALERT_CLASSIFICATION.low_provider_balance).toEqual({ emoji: "⚠️", badge: "WARNING" });
    expect(ALERT_CLASSIFICATION.out_of_stock).toEqual({ emoji: "⚠️", badge: "WARNING" });
    expect(ALERT_CLASSIFICATION.cost_drift).toEqual({ emoji: "⚠️", badge: "WARNING" });
  });

  it("formats 🚨 [URGENT] Automated dispatch failed on order dispatch failure", async () => {
    const alert = await notifyProviderFailure(
      {
        providerId: "prov_qcst",
        providerName: "QCST Provider",
        operation: "createOrder",
        orderId: "ord_failed_123",
        message: "Wholesale API returned 422: Out of inventory",
      },
      { skipThrottle: true },
    );

    expect(alert.sentToTelegram).toBe(true);
    expect(alert.severity).toBe("critical");
    expect(sentMessages.length).toBe(1);

    const msg = sentMessages[0];
    expect(msg.disableNotification).toBe(false); // Audible alert on admin's phone
    expect(msg.text).toContain("🚨 [URGENT] Automated dispatch failed");
    expect(msg.text).toContain("Provider: QCST Provider");
    expect(msg.text).toContain("Operation: createOrder");
    expect(msg.text).toContain("Order ID: ord_failed_123");
    expect(msg.text).toContain("Admin: /admin/orders");
  });

  it("formats 💰 [FINANCIAL] Deposit awaiting confirmation with receipt proof", async () => {
    const alert = await notifyPendingDeposit(
      {
        depositId: "dep_baridimob_999",
        customerLabel: "customer@example.dz",
        amount: "50.00",
        currency: "USD",
        method: "BARIDIMOB",
        reference: "TX-CCP-847291",
        proofUrl: "https://shop.example/uploads/receipt-proof.jpg",
        withActions: true,
      },
      { skipThrottle: true },
    );

    expect(alert.sentToTelegram).toBe(true);
    expect(sentMessages.length).toBe(1);

    const msg = sentMessages[0];
    expect(msg.disableNotification).toBe(false); // Audible alert for manual financial review
    expect(msg.text).toContain("💰 [FINANCIAL] Deposit awaiting confirmation");
    expect(msg.text).toContain("Amount: 50.00 USD");
    expect(msg.text).toContain("Customer: customer@example.dz");
    expect(msg.text).toContain("Method: BARIDIMOB");
    expect(msg.text).toContain("Reference: TX-CCP-847291");
    expect(msg.text).toContain("Receipt Proof: https[:]//shop.example/uploads/receipt-proof.jpg");
    expect(msg.buttons).toHaveProperty("inline_keyboard");
  });

  it("formats ⚠️ [WARNING] Low provider balance below $20.00 safety buffer", async () => {
    const alert = await notifyLowProviderBalance(
      {
        providerId: "prov_vbr",
        providerName: "VBR Provider",
        balance: "12.50",
        threshold: "20.00",
        currency: "USD",
      },
      { skipThrottle: true },
    );

    expect(alert.sentToTelegram).toBe(true);
    expect(alert.severity).toBe("warning");
    expect(sentMessages.length).toBe(1);

    const msg = sentMessages[0];
    expect(msg.text).toContain("⚠️ [WARNING] Low provider balance");
    expect(msg.text).toContain("Provider: VBR Provider");
    expect(msg.text).toContain("Balance: 12.50 USD");
    expect(msg.text).toContain("Threshold: 20.00 USD");
    expect(msg.text).toContain("Admin: /admin/sync");
  });
});
