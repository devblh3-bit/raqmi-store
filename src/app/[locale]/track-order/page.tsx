import { setRequestLocale, getTranslations } from "next-intl/server";
export default async function CekPesananPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "track" });
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">Enter your order code and email to view delivery (mock).</p>
      <form className="mt-6 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--elev-1)]">
        <label className="block text-sm font-semibold">{t("code")}</label>
        <input name="code" placeholder="RQM-XXXX-XXXX-XXXX" className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--ring)]" />
        <label className="mt-4 block text-sm font-semibold">{t("email")}</label>
        <input name="email" type="email" placeholder="you@example.com" className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--ring)]" />
        <button className="mt-6 h-11 w-full rounded-full bg-[var(--fg)] text-sm font-bold text-white hover:bg-black">{t("check")}</button>
        <p className="mt-3 text-center text-xs text-[var(--fg-faint)]">High-entropy codes + rate limit will be enforced with real orders.</p>
      </form>
    </div>
  );
}
