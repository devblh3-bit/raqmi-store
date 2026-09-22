import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { locales, type Locale } from "@/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoreMobileNav from "@/components/nav/StoreMobileNav";
import { CartProvider } from "@/components/CartProvider";
import { getSystemSettings } from "@/lib/settings";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const [messages, settings] = await Promise.all([
    getMessages(),
    getSystemSettings(),
  ]);
  const isRtl = locale === "ar";
  const bannerText =
    locale === "ar"
      ? settings.maintenanceBannerAr
      : locale === "fr"
      ? settings.maintenanceBannerFr
      : settings.maintenanceBannerEn;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="flex min-h-full min-h-screen flex-col ambient-bg">
      <NextIntlClientProvider messages={messages} locale={locale}>
        <CartProvider>
          <Header locale={locale as Locale} />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer locale={locale as Locale} />
          <StoreMobileNav locale={locale as Locale} />

          {settings.maintenanceMode && (
            <aside
              aria-label="Store Maintenance Notice"
              className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-2xl px-5 py-3 rounded-full bg-amber-500 text-zinc-950 border border-amber-600 shadow-2xl shadow-amber-950/20 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold text-center pointer-events-auto transition-all"
            >
              <span className="text-base leading-none shrink-0">⚠️</span>
              <span className="tracking-wide">{bannerText}</span>
            </aside>
          )}
        </CartProvider>
      </NextIntlClientProvider>
    </div>
  );
}
