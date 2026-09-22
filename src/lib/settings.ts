import "server-only";

import { prisma } from "@/lib/db";

export interface SystemSettings {
  dzdRate: number;
  minOfferPriceDzd: number;
  defaultProfitMargin: number;
  baridimobRip: string;
  baridimobHolder: string;
  ccpAccount: string;
  usdtBep20Address: string;
  usdtTrc20Address: string;
  maintenanceMode: boolean;
  maintenanceBannerEn: string;
  maintenanceBannerAr: string;
  maintenanceBannerFr: string;
  supportEmail: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  dzdRate: 240,
  minOfferPriceDzd: 300,
  defaultProfitMargin: 15,
  baridimobRip: "",
  baridimobHolder: "",
  ccpAccount: "",
  usdtBep20Address: "",
  usdtTrc20Address: "",
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
    let rows: Array<{ key: string; value: string }> = [];
    if (prisma?.systemSetting) {
      rows = await prisma.systemSetting.findMany();
    } else if (typeof prisma?.$queryRaw === "function") {
      rows = await prisma.$queryRaw<Array<{ key: string; value: string }>>`SELECT "key", "value" FROM "SystemSetting"`;
    } else {
      return DEFAULT_SETTINGS;
    }
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));

    const dzdRateRaw = map.get("dzd_rate");
    const dzdRate = dzdRateRaw ? parseFloat(dzdRateRaw) : DEFAULT_SETTINGS.dzdRate;

    const minPriceRaw = map.get("min_offer_price_dzd");
    const minOfferPriceDzd = minPriceRaw ? parseFloat(minPriceRaw) : DEFAULT_SETTINGS.minOfferPriceDzd;

    const marginRaw = map.get("default_profit_margin");
    const defaultProfitMargin = marginRaw ? parseFloat(marginRaw) : DEFAULT_SETTINGS.defaultProfitMargin;

    return {
      dzdRate: Number.isFinite(dzdRate) && dzdRate > 0 ? dzdRate : DEFAULT_SETTINGS.dzdRate,
      minOfferPriceDzd:
        Number.isFinite(minOfferPriceDzd) && minOfferPriceDzd >= 0
          ? minOfferPriceDzd
          : DEFAULT_SETTINGS.minOfferPriceDzd,
      defaultProfitMargin:
        Number.isFinite(defaultProfitMargin) && defaultProfitMargin >= 0
          ? defaultProfitMargin
          : DEFAULT_SETTINGS.defaultProfitMargin,
      baridimobRip: map.get("baridimob_rip") ?? DEFAULT_SETTINGS.baridimobRip,
      baridimobHolder: map.get("baridimob_holder") ?? DEFAULT_SETTINGS.baridimobHolder,
      ccpAccount: map.get("ccp_account") ?? DEFAULT_SETTINGS.ccpAccount,
      usdtBep20Address: map.get("usdt_bep20_address") ?? DEFAULT_SETTINGS.usdtBep20Address,
      usdtTrc20Address: map.get("usdt_trc20_address") ?? DEFAULT_SETTINGS.usdtTrc20Address,
      maintenanceMode: map.get("maintenance_mode") === "true",
      maintenanceBannerEn: map.get("maintenance_banner_en") ?? DEFAULT_SETTINGS.maintenanceBannerEn,
      maintenanceBannerAr: map.get("maintenance_banner_ar") ?? DEFAULT_SETTINGS.maintenanceBannerAr,
      maintenanceBannerFr: map.get("maintenance_banner_fr") ?? DEFAULT_SETTINGS.maintenanceBannerFr,
      supportEmail: map.get("support_email") ?? DEFAULT_SETTINGS.supportEmail,
    };
  } catch (err) {
    console.warn("[settings] failed to read system settings, falling back to defaults", err);
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

