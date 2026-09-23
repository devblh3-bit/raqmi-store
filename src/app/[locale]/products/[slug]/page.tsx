import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductBySlug } from "@/lib/catalog";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { priceForOffer } from "@/lib/pricing";
import type { Locale } from "@/i18n";
import Link from "next/link";
import { ProductInteractiveLayout } from "./product-interactive-layout";

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "product" });
  const loc = locale as Locale;
  const p = await getProductBySlug(slug, loc);
  if (!p) notFound();

  // Check if current user is an active reseller
  const session = await getSession();
  let resellerTier: { id: string; name: string; discountPercent: number } | null = null;
  const wholesalePrices: Record<string, { price: number; marginCents: number }> = {};

  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        role: true,
        tierId: true,
        tier: { select: { id: true, name: true, discountPercent: true } },
      },
    });

    if (user?.role === "RESELLER" && user.tier) {
      resellerTier = {
        id: user.tier.id,
        name: user.tier.name,
        discountPercent: Number(user.tier.discountPercent),
      };

      for (const o of p.offers) {
        const wp = await priceForOffer(o.id, user.tier.id);
        if (wp.available) {
          wholesalePrices[o.id] = {
            price: wp.priceMinor,
            marginCents: Math.max(0, o.price - wp.priceMinor),
          };
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href={`/${locale}/products`}
        className="text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        {locale === "ar"
          ? "→ العودة إلى المنتجات"
          : locale === "fr"
            ? "← Retour aux produits"
            : "← Back to products"}
      </Link>

      <ProductInteractiveLayout
        product={p}
        locale={loc}
        descriptionTitle={t("description")}
        resellerTier={resellerTier}
        wholesalePrices={wholesalePrices}
        isLoggedIn={Boolean(session?.userId)}
      />
    </div>
  );
}
