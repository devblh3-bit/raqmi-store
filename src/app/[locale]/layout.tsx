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
              className="w-full bg-amber-500 text-zinc-950 border-b border-amber-600 px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50"
            >
              <span className="text-base leading-none">⚠️</span>
              <span className="tracking-wide">{bannerText}</span>
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
