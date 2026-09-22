import "server-only";

import { prisma } from "@/lib/db";

export interface SystemSettings {
  dzdRate: number;
  maintenanceMode: boolean;
  maintenanceBannerEn: string;
  maintenanceBannerAr: string;
  maintenanceBannerFr: string;
  supportEmail: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  dzdRate: 240,
  maintenanceMode: false,
  maintenanceBannerEn: "Store maintenance in progress. Purchasing is temporarily disabled.",
  maintenanceBannerAr: "أعمال صيانة جارية في المتجر. عمليات الشراء معطلة مؤقتًا.",
  maintenanceBannerFr: "Maintenance de la boutique en cours. Les achats sont temporairement désactivés.",
  supportEmail: "support@raqmi.dz",
};

/**
 * Fetch all platform system settings from the database.
 * Falls back to DEFAULT_SETTINGS if values are not set or during transient DB failures.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const rows = await prisma.systemSetting.findMany();
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));

    const dzdRateRaw = map.get("dzd_rate");
    const dzdRate = dzdRateRaw ? parseFloat(dzdRateRaw) : DEFAULT_SETTINGS.dzdRate;

    return {
      dzdRate: Number.isFinite(dzdRate) && dzdRate > 0 ? dzdRate : DEFAULT_SETTINGS.dzdRate,
      maintenanceMode: map.get("maintenance_mode") === "true",
      maintenanceBannerEn: map.get("maintenance_banner_en") ?? DEFAULT_SETTINGS.maintenanceBannerEn,
      maintenanceBannerAr: map.get("maintenance_banner_ar") ?? DEFAULT_SETTINGS.maintenanceBannerAr,
      maintenanceBannerFr: map.get("maintenance_banner_fr") ?? DEFAULT_SETTINGS.maintenanceBannerFr,
      supportEmail: map.get("support_email") ?? DEFAULT_SETTINGS.supportEmail,
    };
  } catch (err) {
    console.error("[settings] failed to read system settings, falling back to defaults", err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Indicative USD -> DZD exchange multiplier.
 */
export async function getDzdRate(): Promise<number> {
  const settings = await getSystemSettings();
  return settings.dzdRate;
}

/**
 * Check whether the storefront is in maintenance mode.
 */
export async function isMaintenanceModeActive(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.maintenanceMode;
}
