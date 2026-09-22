import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { locales, type Locale } from "@/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
    <div dir={isRtl ? "rtl" : "ltr"} className="flex min-h-full flex-col">
      <NextIntlClientProvider messages={messages} locale={locale}>
        <CartProvider>
          {settings.maintenanceMode && (
            <div
              role="alert"
              className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>⚠️</span>
              <span>{bannerText}</span>
            </div>
          )}
          <Header locale={locale as Locale} />
          <main className="flex-1">{children}</main>
          <Footer locale={locale as Locale} />
        </CartProvider>
      </NextIntlClientProvider>
    </div>
  );
}
