import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
export default async function KeranjangPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <div className="mt-6 rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-[var(--fg-muted)]">{t("empty")}</p>
        <Link href={`/${locale}/products`} className="mt-4 inline-flex rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">Browse products →</Link>
      </div>
    </div>
  );
}
