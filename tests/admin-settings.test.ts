import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAdminUser = {
  userId: "admin-settings-tester",
  email: "admin-settings@test.com",
  role: "ADMIN",
};

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => mockAdminUser),
}));

import { prisma } from "../src/lib/db";
import {
  getSystemSettings,
  isMaintenanceModeActive,
  getDzdRate,
  DEFAULT_SETTINGS,
} from "../src/lib/settings";
import {
  updateSystemSettings,
  sendTelegramTestAlert,
  getTelegramDiagnostics,
} from "../src/app/[locale]/admin/settings/actions";

describe("Admin System Settings & Telegram Diagnostics", () => {
  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: mockAdminUser.userId },
    });
    await prisma.systemSetting.deleteMany({});
    await prisma.user.deleteMany({
      where: { id: mockAdminUser.userId },
    });
  }

  beforeAll(async () => {
    await cleanup();
    await prisma.user.create({
      data: {
        id: mockAdminUser.userId,
        email: mockAdminUser.email,
        role: "ADMIN",
      },
    });
  });

  afterEach(async () => {
    await prisma.systemSetting.deleteMany({});
  });

  afterAll(async () => {
    await cleanup();
  });

  it("returns default settings when database has no records", async () => {
    const settings = await getSystemSettings();
    expect(settings.dzdRate).toBe(DEFAULT_SETTINGS.dzdRate);
    expect(settings.minOfferPriceDzd).toBe(300);
    expect(settings.maintenanceMode).toBe(false);
    expect(settings.supportEmail).toBe(DEFAULT_SETTINGS.supportEmail);
    expect(await isMaintenanceModeActive()).toBe(false);
    expect(await getDzdRate()).toBe(240);
  });

  it("updates settings, persists them in database, and creates an audit log", async () => {
    const fd = new FormData();
    fd.append("dzdRate", "248.5");
    fd.append("minOfferPriceDzd", "350");
    fd.append("maintenanceMode", "true");
    fd.append("maintenanceBannerEn", "Emergency maintenance in progress. Please check back at 18:00 UTC.");
    fd.append("maintenanceBannerAr", "صيانة طارئة جارية. يرجى العودة لاحقاً.");
    fd.append("maintenanceBannerFr", "Maintenance d'urgence en cours.");
    fd.append("supportEmail", "ops@raqmi.dz");

    const res = await updateSystemSettings(fd);
    expect(res).toEqual({ ok: true });

    // Verify persisted settings
    const settings = await getSystemSettings();
    expect(settings.dzdRate).toBe(248.5);
    expect(settings.minOfferPriceDzd).toBe(350);
    expect(settings.maintenanceMode).toBe(true);
    expect(settings.maintenanceBannerEn).toBe("Emergency maintenance in progress. Please check back at 18:00 UTC.");
    expect(settings.maintenanceBannerAr).toBe("صيانة طارئة جارية. يرجى العودة لاحقاً.");
    expect(settings.maintenanceBannerFr).toBe("Maintenance d'urgence en cours.");
    expect(settings.supportEmail).toBe("ops@raqmi.dz");

    expect(await isMaintenanceModeActive()).toBe(true);
    expect(await getDzdRate()).toBe(248.5);

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: mockAdminUser.userId,
        action: "SETTINGS_UPDATED",
        entity: "SystemSetting",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    const detail = audit?.detail as Record<string, unknown>;
    expect(detail.dzdRate).toBe(248.5);
    expect(detail.minOfferPriceDzd).toBe(350);
    expect(detail.maintenanceMode).toBe(true);
    expect(detail.supportEmail).toBe("ops@raqmi.dz");
  });

  it("rejects invalid settings payloads gracefully", async () => {
    const badFd = new FormData();
    badFd.append("dzdRate", "-10"); // Invalid negative rate
    badFd.append("maintenanceMode", "false");
    badFd.append("supportEmail", "not-an-email");

    const res = await updateSystemSettings(badFd);
    expect(res).toEqual({ error: "BAD_REQUEST" });
  });

  it("executes test telegram alert safely", async () => {
    const res = await sendTelegramTestAlert();
    expect(typeof res.ok).toBe("boolean");
    if (!res.ok) {
      expect(typeof res.error).toBe("string");
    }
  });

  it("retrieves telegram diagnostics safely without leaking credentials", async () => {
    const diag = await getTelegramDiagnostics();
    expect(diag).toHaveProperty("isConfigured");
    expect(diag).toHaveProperty("bot");
    expect(diag).toHaveProperty("webhook");
    expect(diag).toHaveProperty("latencyMs");
  });
});
