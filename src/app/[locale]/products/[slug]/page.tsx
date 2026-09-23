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
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";

  if (!p) {
    const rawProduct = await prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!rawProduct || !rawProduct.isActive) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
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

        {isAdmin && (
          <div className="mt-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <p className="font-bold">Admin Notice: No Active Variants</p>
                <p className="text-[11px] text-[var(--fg-muted)]">
                  All variants for this product are currently archived, deleted, or unlinked. Customers see an Out of Stock notice.
                </p>
              </div>
            </div>
            <Link
              href={`/${locale}/admin/catalog/${rawProduct.id}`}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 text-xs shadow-xs"
            >
              🛠️ Open in Product Studio
            </Link>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-2xl">
            📦
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--fg)]">
            {loc === "ar"
              ? rawProduct.nameAr
              : loc === "fr"
                ? rawProduct.nameFr
                : rawProduct.nameEn}
          </h1>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300 dark:border-amber-800 px-3 py-1 text-xs font-bold">
            <span>⏳</span>
            <span>
              {locale === "ar"
                ? "نفد من المخزون مؤقتاً"
                : locale === "fr"
                  ? "Rupture de stock temporaire"
                  : "Temporarily Out of Stock"}
            </span>
          </div>
          <p className="mx-auto max-w-md text-sm text-[var(--fg-muted)] leading-relaxed">
            {locale === "ar"
              ? "هذا المنتج غير متوفر للشراء حالياً. سيتم توفيره مجدداً فور تجديد المخزون لدى الموردين."
              : locale === "fr"
                ? "Ce produit n'est pas disponible à l'achat pour le moment. Il sera de retour dès réapprovisionnement."
                : "This product is currently unavailable for purchase. It will be back in stock as soon as supplier capacity is renewed."}
          </p>
          <div className="pt-2">
            <Link
              href={`/${locale}/products`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] px-6 text-sm font-bold shadow-sm transition hover:bg-[var(--accent-hover)]"
            >
              {locale === "ar"
                ? "استعراض باقي المنتجات"
                : locale === "fr"
                  ? "Voir les autres produits"
                  : "Browse Other Products"}
            </Link>
          </div>
        </div>
      </div>
    );
  }
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
