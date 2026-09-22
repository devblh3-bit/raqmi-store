import { requireAdmin } from "@/lib/auth/admin";
import { getSystemSettings } from "@/lib/settings";
import { getTelegramDiagnostics } from "./actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const [settings, diagnostics] = await Promise.all([
    getSystemSettings(),
    getTelegramDiagnostics(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Configure platform-wide exchange rates, toggle customer maintenance mode with localized alerts, and inspect Telegram bot health.
        </p>
      </div>

      <SettingsForm initialSettings={settings} diagnostics={diagnostics} />
    </div>
  );
}

