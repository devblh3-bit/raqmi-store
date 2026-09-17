import { setRequestLocale, getTranslations } from "next-intl/server";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });
  // Widget needs the bot's public username (not the token).
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      {error && (
        <p className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {t(error === "telegram" ? "errorTelegram" : "errorInvalid")}
        </p>
      )}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)]">
        <LoginForm />
        {botUsername && (
          <>
            <div className="mt-6 flex items-center gap-3 text-xs text-[var(--fg-faint)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              {t("or")}
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <div className="mt-4 flex justify-center">
              {/* Official Telegram Login Widget; redirects to /api/auth/telegram with signed params. */}
              <script
                async
                src="https://telegram.org/js/telegram-widget.js?22"
                data-telegram-login={botUsername}
                data-size="large"
                data-auth-url="/api/auth/telegram"
                data-request-access="write"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
