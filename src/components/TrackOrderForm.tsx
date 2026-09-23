"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { trackOrderAction, type TrackState } from "@/app/actions/track";
import type { Locale } from "@/i18n";

export function TrackOrderForm({ locale }: { locale: Locale }) {
  const t = useTranslations("track");
  const [state, formAction, isPending] = useActionState<TrackState, FormData>(
    trackOrderAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8"
    >
      <input type="hidden" name="locale" value={locale} />

      {state.error && (
        <div className="mb-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {state.error === "NOT_FOUND"
            ? locale === "ar"
              ? "لم نتمكن من العثور على هذا الطلب. يُرجى التحقق من رمز الطلب وعنوان البريد الإلكتروني."
              : locale === "fr"
                ? "Commande introuvable. Veuillez vérifier votre code et votre adresse e-mail."
                : "Order not found. Please double-check your order code and email address."
            : locale === "ar"
              ? "يُرجى إدخال رمز الطلب والبريد الإلكتروني بشكل صحيح."
              : locale === "fr"
                ? "Veuillez saisir un code et un e-mail valides."
                : "Please enter a valid order code and email address."}
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
          placeholder="RQM-XXXX-XXXX-XXXX"
          className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 font-mono text-sm uppercase outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="track-email" className="block text-xs font-bold text-[var(--fg)]">
          {t("email")}
        </label>
        <input
          id="track-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-shine group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md disabled:opacity-60 active:scale-[0.98]"
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
          →
        </span>
      </button>

      <p className="mt-4 text-center text-[11px] text-[var(--fg-muted)]">
        {locale === "ar"
          ? "🔒 يمكنك التحقق من طلباتك المسجلة كزائر أو كعضو واستعراض بيانات التفعيل والمفاتيح بأمان."
          : locale === "fr"
            ? "🔒 Suivez vos commandes en tant qu'invité ou membre et accédez à vos identifiants en toute sécurité."
            : "🔒 Track your guest or account orders securely and access your digital credentials anytime."}
      </p>
    </form>
  );
}
