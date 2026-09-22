"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { systemSettingsSchema } from "@/lib/admin/validation";
import {
  isTelegramConfigured,
  sendMessageToAdmin,
  getMe,
  getWebhookInfo,
  type WebhookInfo,
  type BotUser,
} from "@/lib/telegram/client";

function adminError(msg: string) {
  return { error: msg } as const;
}

export interface TelegramDiagnostics {
  isConfigured: boolean;
  bot: BotUser | null;
  webhook: WebhookInfo | null;
  latencyMs: number | null;
  error?: string;
}

/**
 * Update global system settings (FX rates, maintenance mode, banners, support contact).
 */
export async function updateSystemSettings(formData: FormData) {
  const session = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = systemSettingsSchema.safeParse({
    dzdRate: raw.dzdRate,
    defaultProfitMargin: raw.defaultProfitMargin,
    baridimobRip: raw.baridimobRip || undefined,
    baridimobHolder: raw.baridimobHolder || undefined,
    ccpAccount: raw.ccpAccount || undefined,
    usdtBep20Address: raw.usdtBep20Address || undefined,
    usdtTrc20Address: raw.usdtTrc20Address || undefined,
    maintenanceMode: raw.maintenanceMode === "true" || raw.maintenanceMode === "on",
    maintenanceBannerEn: raw.maintenanceBannerEn || undefined,
    maintenanceBannerAr: raw.maintenanceBannerAr || undefined,
    maintenanceBannerFr: raw.maintenanceBannerFr || undefined,
    supportEmail: raw.supportEmail || undefined,
  });

  if (!parsed.success) {
    return adminError("BAD_REQUEST");
  }

  const {
    dzdRate,
    defaultProfitMargin,
    baridimobRip,
    baridimobHolder,
    ccpAccount,
    usdtBep20Address,
    usdtTrc20Address,
    maintenanceMode,
    maintenanceBannerEn,
    maintenanceBannerAr,
    maintenanceBannerFr,
    supportEmail,
  } = parsed.data;

  const updates = [
    { key: "dzd_rate", value: dzdRate.toString() },
    { key: "default_profit_margin", value: defaultProfitMargin.toString() },
    { key: "baridimob_rip", value: baridimobRip },
    { key: "baridimob_holder", value: baridimobHolder },
    { key: "ccp_account", value: ccpAccount },
    { key: "usdt_bep20_address", value: usdtBep20Address },
    { key: "usdt_trc20_address", value: usdtTrc20Address },
    { key: "maintenance_mode", value: maintenanceMode ? "true" : "false" },
    { key: "maintenance_banner_en", value: maintenanceBannerEn },
    { key: "maintenance_banner_ar", value: maintenanceBannerAr },
    { key: "maintenance_banner_fr", value: maintenanceBannerFr },
    { key: "support_email", value: supportEmail },
  ];

  await prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as {
      systemSetting?: {
        upsert: (args: {
          where: { key: string };
          create: { key: string; value: string };
          update: { value: string };
        }) => Promise<unknown>;
      };
    };

    for (const item of updates) {
      if (txAny.systemSetting) {
        await txAny.systemSetting.upsert({
          where: { key: item.key },
          create: item,
          update: { value: item.value },
        });
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO "SystemSetting" ("key", "value", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()`,
          item.key,
          item.value,
        );
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "SETTINGS_UPDATED",
        entity: "SystemSetting",
        entityId: "global",
        detail: {
          dzdRate,
          defaultProfitMargin,
          maintenanceMode,
          supportEmail,
        } as never,
      },
    });
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/resellers");
  revalidatePath("/account/wallet");
  revalidatePath("/reseller/wallet");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/products");

  return { ok: true as const };
}

/**
 * Send a high-priority diagnostic test ping to the configured Telegram admin chat.
 */
export async function sendTelegramTestAlert() {
  const session = await requireAdmin();

  if (!isTelegramConfigured()) {
    return { ok: false as const, error: "TELEGRAM_NOT_CONFIGURED" };
  }

  const now = new Date().toISOString();
  const text =
    `🔔 *Raqmi Store — Telegram Bot Alert Test*\n\n` +
    `This is a verified test notification sent from the System Settings panel.\n\n` +
    `• Operator: ${session.userId}\n` +
    `• Timestamp: ${now}\n` +
    `• Health Check: Nominal ✅`;

  const res = await sendMessageToAdmin(text);
  if (!res.ok) {
    return { ok: false as const, error: res.error };
  }

  return { ok: true as const };
}

/**
 * Retrieve real-time Telegram Bot API health and webhook status.
 */
export async function getTelegramDiagnostics(): Promise<TelegramDiagnostics> {
  await requireAdmin();

  if (!isTelegramConfigured()) {
    return {
      isConfigured: false,
      bot: null,
      webhook: null,
      latencyMs: null,
      error: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is missing or incomplete.",
    };
  }

  try {
    const start = Date.now();
    const [meRes, webhookRes] = await Promise.all([getMe(), getWebhookInfo()]);
    const latencyMs = Date.now() - start;

    return {
      isConfigured: true,
      bot: meRes.ok ? meRes.result : null,
      webhook: webhookRes.ok ? webhookRes.result : null,
      latencyMs,
      error: !meRes.ok ? meRes.error : !webhookRes.ok ? webhookRes.error : undefined,
    };
  } catch (err) {
    return {
      isConfigured: true,
      bot: null,
      webhook: null,
      latencyMs: null,
      error: err instanceof Error ? err.message : "Unknown error querying Telegram Bot API",
    };
  }
}

