import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Price } from "@/components/Price";
import { ResellerApplicationCard } from "@/components/ResellerApplicationCard";
import type { Locale } from "@/i18n";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "account" });
  const to = await getTranslations({ locale, namespace: "order" });
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account`);

  // Admins only have the admin role: clicking profile or hitting /account redirects directly to /admin
  if (session.role === "ADMIN") {
    redirect(`/${locale}/admin`);
  }

  // Resellers have the dedicated reseller portal: clicking profile or hitting /account redirects directly to /reseller
  if (session.role === "RESELLER") {
    redirect(`/${locale}/reseller`);
  }

  // Load user profile and wallet
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
      include: { items: { select: { id: true, quantity: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          {user?.email && (
            <p className="mt-1 text-sm text-[var(--fg-muted)]" dir="ltr">
              {user.email}
            </p>
          )}
        </div>

        {/* Sign Out Button in header */}
        <form action="/api/auth/logout" method="post" className="shrink-0">
          <button className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold shadow-xs transition-all hover:bg-[var(--surface-2)]">
            {t("signOut")}
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {/* Wallet summary */}
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)]">
          <div>
            <p className="text-sm text-[var(--fg-muted)]">{t("balance")}</p>
            <div className="mt-1 text-2xl font-black tracking-tight">
              <Price cents={Number(wallet?.balanceMinor ?? 0n)} locale={loc} size="lg" />
            </div>
          </div>
          <Link
            href={`/${locale}/wallet`}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98]"
          >
            {t("addFunds")}
          </Link>
        </div>

        {/* Wholesale Reseller Application Card */}
        <ResellerApplicationCard
          status={user?.role === "RESELLER_APPLICANT" ? "PENDING" : "NONE"}
        />

        {/* Order history */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
          <h2 className="text-sm font-semibold">{t("orders")}</h2>
          {orders.length === 0 ? (
            <div className="mt-4 text-center">
              <p className="text-sm text-[var(--fg-muted)]">{t("noOrders")}</p>
              <Link
                href={`/${locale}/products`}
                className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-[var(--accent-fg)] shadow-sm transition-all hover:bg-[var(--accent-hover)]"
              >
                {t("browseProducts")}
              </Link>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/${locale}/orders/${o.code}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3 transition-colors hover:bg-[var(--surface-3,var(--surface-2))]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm font-semibold" dir="ltr">
                        {o.code}
                      </span>
                      <span className="text-xs text-[var(--fg-muted)]">
                        {o.items.reduce((n, i) => n + i.quantity, 0)} {t("items")} · {to(`status${o.status}`)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold">
                      <Price cents={Number(o.totalMinor)} locale={loc} size="sm" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
