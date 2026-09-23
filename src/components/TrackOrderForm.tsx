"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n";

export function TrackOrderForm({ locale }: { locale: Locale }) {
  const t = useTranslations("track");
  const router = useRouter();

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setIsPending(true);
    setError(null);

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmedCode,
          email: email.trim(),
          locale,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        setError(data.error || "NOT_FOUND");
        setIsPending(false);
      }
    } catch {
      setError("INTERNAL_ERROR");
      setIsPending(false);
    }
  };

  const getErrorMessage = () => {
    if (!error) return null;
    if (error === "INVALID_CODE") {
      return locale === "ar"
        ? "رمز الطلب غير صالح. الرمز يبدأ عادة بـ RQM- ومتبوع بـ 20 حرفاً."
        : locale === "fr"
          ? "Code de commande invalide. Le code commence généralement par RQM-."
          : "Invalid order code format. Codes typically start with RQM- followed by alphanumeric characters.";
    }
    if (error === "EMAIL_MISMATCH") {
      return locale === "ar"
        ? "البريد الإلكتروني المدخل لا يتطابق مع هذا الطلب. اترك حقل البريد فارغاً إذا كنت لا تتذكره."
        : locale === "fr"
          ? "L'adresse e-mail saisie ne correspond pas à cette commande. Laissez ce champ vide si vous l'avez oublié."
          : "The email entered does not match this order. Leave the email field blank if you don't recall it.";
    }
    if (error === "NOT_FOUND") {
      return locale === "ar"
        ? "لم نتمكن من العثور على هذا الطلب. يُرجى التأكد من كتابة رمز الطلب بشكل صحيح."
        : locale === "fr"
          ? "Aucune commande trouvée. Veuillez vérifier votre code de commande."
          : "Order not found. Please double-check your order code.";
    }
    return locale === "ar"
      ? "حدث خطأ أثناء البحث. يُرجى المحاولة مرة أخرى."
      : locale === "fr"
        ? "Une erreur est survenue. Veuillez réessayer."
        : "An error occurred while tracking. Please try again.";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8"
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {getErrorMessage()}
        </div>
      )}

      <div>
        <label htmlFor="track-code" className="block text-xs font-bold text-[var(--fg)]">
          {t("code")}
        </label>
        <input
          id="track-code"
          name="code"
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="RQM-XXXX-XXXX-XXXX"
          className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 font-mono text-sm uppercase outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
          {locale === "ar"
            ? "💡 أدخل الرمز الخاص بطلبك (تجده في صفحة التأكيد أو إشعار الشراء)."
            : locale === "fr"
              ? "💡 Entrez le code de votre commande (trouvé sur la page de confirmation ou reçu)."
              : "💡 Enter your unique order code (found on your order confirmation page)."}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="track-email" className="block text-xs font-bold text-[var(--fg)]">
            {t("email")}
          </label>
          <span className="text-[11px] text-[var(--fg-muted)]">
            {locale === "ar" ? "(اختياري)" : locale === "fr" ? "(Optionnel)" : "(Optional)"}
          </span>
        </div>
        <input
          id="track-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !code.trim()}
        className="btn-shine group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md disabled:opacity-60 active:scale-[0.98] cursor-pointer"
      >
        <span>
          {isPending
            ? locale === "ar"
              ? "جاري التحقق..."
              : locale === "fr"
                ? "Vérification..."
                : "Checking..."
            : t("check")}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">
          {isPending ? "⏳" : "→"}
        </span>
      </button>

      <p className="mt-4 text-center text-[11px] text-[var(--fg-muted)]">
        {locale === "ar"
          ? "🔒 يمكنك التحقق من طلباتك المسجلة واستعراض بيانات التفعيل والمفاتيح في أي وقت."
          : locale === "fr"
            ? "🔒 Suivez vos commandes et accédez à vos identifiants à tout moment."
            : "🔒 Track your orders and access your digital credentials anytime."}
      </p>
    </form>
  );
}

