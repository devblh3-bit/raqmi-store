import { setRequestLocale, getTranslations } from "next-intl/server";
import CartContents from "@/components/CartContents";
export default async function KeranjangPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <CartContents locale={locale as import("@/i18n").Locale} />
    </div>
  );
}
