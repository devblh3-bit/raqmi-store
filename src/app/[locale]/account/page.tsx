import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Price } from "@/components/Price";
import { ResellerApplicationCard } from "@/components/ResellerApplicationCard";
import { ProductArt } from "@/lib/product-images";
import type { Locale } from "@/i18n";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "account" });
  const to = await getTranslations({ locale, namespace: "order" });
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account`);

  // Admins redirect to /admin
  if (session.role === "ADMIN") {
    redirect(`/${locale}/admin`);
  }

  // Resellers redirect to /reseller
  if (session.role === "RESELLER") {
    redirect(`/${locale}/reseller`);
  }

  // Load customer profile, wallet, and orders
  const [user, wallet, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    }),
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    prisma.order.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            productNameEn: true,
            offerLabelEn: true,
            offer: {
              select: {
                product: { select: { slug: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "PAID":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "REFUNDED":
      case "FAILED":
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "AWAITING_FULFILLMENT":
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]";
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            Welcome back! Here is your account overview, wallet balance, and order history.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Wallet summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{t("balance")}</p>
            <div className="mt-1 text-2xl font-black tracking-tight text-[var(--fg)] sm:text-3xl">
              <Price cents={Number(wallet?.balanceMinor ?? 0n)} locale={loc} size="lg" />
            </div>
            <p className="mt-1 text-[11px] text-[var(--fg-faint)]">
              Pre-funded balance used for instant 1-click checkout.
            </p>
          </div>
          <Link
            href={`/${locale}/account/wallet`}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold tracking-tight text-white shadow-xs transition hover:bg-[var(--accent-hover)] active:scale-95"
          >
            + {t("addFunds")}
          </Link>
        </div>

        {/* Wholesale Reseller Application Card */}
        <div id="reseller">
          <ResellerApplicationCard
            status={user?.role === "RESELLER_APPLICANT" ? "PENDING" : "NONE"}
          />
        </div>

        {/* Order history */}
        <div id="orders" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs sm:p-7">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-[var(--fg)]">{t("orders")}</h2>
              <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                Track status and retrieve keys for your recent digital orders.
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--fg-faint)]">
              {orders.length} Orders
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-2xl">
                🛍️
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--fg)]">{t("noOrders")}</p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Explore our catalog for instant digital products, subscriptions, and gaming gift cards.
              </p>
              <Link
                href={`/${locale}/products`}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--accent-hover)] active:scale-95"
              >
                {t("browseProducts")}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {orders.map((o) => {
                const totalItems = o.items.reduce((n, i) => n + i.quantity, 0);
                const firstItem = o.items[0];
                const slug = firstItem?.offer?.product?.slug;
                const productName = firstItem?.productNameEn || "Digital Product";

                return (
                  <li key={o.id}>
                    <Link
                      href={`/${locale}/orders/${o.code}`}
                      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      {/* Left: Product Icon & Order Details */}
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          {slug ? (
                            <ProductArt id={slug} size={36} />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-3,var(--surface-2))] text-lg">
                              📦
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--fg)]" dir="ltr">
                              {o.code}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${getOrderStatusBadge(
                                o.status,
                              )}`}
                            >
                              {to(`status${o.status}`) || o.status}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--fg-muted)]">
                            <span className="font-medium text-[var(--fg)]">{productName}</span>
                            {totalItems > 1 && ` +${totalItems - 1} more`} ·{" "}
                            <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Price & View CTA */}
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-2 sm:border-0 sm:pt-0 sm:justify-end">
                        <div className="text-right">
                          <span className="text-sm font-bold text-[var(--fg)]">
                            <Price cents={Number(o.totalMinor)} locale={loc} size="sm" />
                          </span>
                          <span className="block text-[10px] text-[var(--fg-faint)]">
                            {totalItems} {t("items")}
                          </span>
                        </div>
                        <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--fg)] transition group-hover:bg-[var(--accent)] group-hover:text-white">
                          <span>Details</span>
                          <span aria-hidden="true">→</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
