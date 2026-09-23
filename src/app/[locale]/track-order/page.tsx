import { setRequestLocale, getTranslations } from "next-intl/server";
import { TrackOrderForm } from "@/components/TrackOrderForm";
import type { Locale } from "@/i18n";

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "track" });
  const loc = locale as Locale;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          {loc === "ar"
            ? "أدخل رمز طلبك وبريدك الإلكتروني لعرض حالة الطلب واستلام بيانات التفعيل."
            : loc === "fr"
              ? "Entrez votre code de commande et votre e-mail pour afficher le statut et vos identifiants."
              : "Enter your order code and email address to check your order status and access your digital credentials."}
        </p>
      </div>

      <TrackOrderForm locale={loc} />
    </div>
  );
}
