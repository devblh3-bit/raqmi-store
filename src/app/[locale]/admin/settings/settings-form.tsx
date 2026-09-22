"use client";

import { useState, useTransition } from "react";
import {
  updateSystemSettings,
  sendTelegramTestAlert,
  type TelegramDiagnostics,
} from "./actions";

interface SettingsFormProps {
  initialSettings: {
    dzdRate: number;
    maintenanceMode: boolean;
    maintenanceBannerEn: string;
    maintenanceBannerAr: string;
    maintenanceBannerFr: string;
    supportEmail: string;
  };
  diagnostics: TelegramDiagnostics;
}

export function SettingsForm({ initialSettings, diagnostics }: SettingsFormProps) {
  const [isSaving, startTransition] = useTransition();
  const [isSendingAlert, startAlertTransition] = useTransition();

  const [dzdRate, setDzdRate] = useState(initialSettings.dzdRate.toString());
  const [maintenanceMode, setMaintenanceMode] = useState(initialSettings.maintenanceMode);
  const [bannerEn, setBannerEn] = useState(initialSettings.maintenanceBannerEn);
  const [bannerAr, setBannerAr] = useState(initialSettings.maintenanceBannerAr);
  const [bannerFr, setBannerFr] = useState(initialSettings.maintenanceBannerFr);
  const [supportEmail, setSupportEmail] = useState(initialSettings.supportEmail);

  const [previewLocale, setPreviewLocale] = useState<"en" | "ar" | "fr">("en");
  const [saveStatus, setSaveStatus] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [alertStatus, setAlertStatus] = useState<{ ok?: boolean; message?: string } | null>(null);

  const numericRate = parseFloat(dzdRate) || 0;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus(null);

    const fd = new FormData();
    fd.append("dzdRate", dzdRate);
    fd.append("maintenanceMode", maintenanceMode ? "true" : "false");
    fd.append("maintenanceBannerEn", bannerEn);
    fd.append("maintenanceBannerAr", bannerAr);
    fd.append("maintenanceBannerFr", bannerFr);
    fd.append("supportEmail", supportEmail);

    startTransition(async () => {
      const res = await updateSystemSettings(fd);
      if ("error" in res) {
        setSaveStatus({ ok: false, message: `Failed to save settings: ${res.error}` });
      } else {
        setSaveStatus({ ok: true, message: "System settings saved and published successfully." });
      }
    });
  }

  function handleSendTestAlert() {
    setAlertStatus(null);
    startAlertTransition(async () => {
      const res = await sendTelegramTestAlert();
      if (res.ok) {
        setAlertStatus({ ok: true, message: "Test alert delivered to Telegram admin chat!" });
      } else {
        setAlertStatus({ ok: false, message: `Delivery failed: ${res.error}` });
      }
    });
  }

  const activePreviewBanner =
    previewLocale === "ar" ? bannerAr : previewLocale === "fr" ? bannerFr : bannerEn;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-8">
        {/* Status Toast / Alert */}
        {saveStatus && (
          <div
            role="alert"
            className={`rounded-2xl p-4 border text-sm font-medium flex items-center justify-between ${
              saveStatus.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{saveStatus.ok ? "✅" : "⚠️"}</span>
              <span>{saveStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveStatus(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: Currency Engine */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Currency Engine & Exchange Rates</h2>
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Configure the indicative USD to Algerian Dinar (DZD) multiplier used for storefront customer price conversions.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-semibold">
              Live Indicative
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <label htmlFor="dzdRate" className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                1 USD Multiplier (DZD)
              </label>
              <div className="relative">
                <input
                  id="dzdRate"
                  name="dzdRate"
                  type="number"
                  step="0.1"
                  min="1"
                  max="1000"
                  required
                  value={dzdRate}
                  onChange={(e) => setDzdRate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-base font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--fg-muted)]">
                  DZD / $
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-[var(--fg-muted)]">Presets:</span>
                {[230, 235, 240, 245, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDzdRate(preset.toString())}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                      dzdRate === preset.toString()
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {preset} DZD
                  </button>
                ))}
              </div>
            </div>

            {/* Live Conversion Preview Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Sample Conversions Preview
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-1">
                  <span className="text-[var(--fg-muted)]">$5.00 USD:</span>
                  <span className="font-bold">≈ {Math.round(5 * numericRate).toLocaleString()} DZD</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-1">
                  <span className="text-[var(--fg-muted)]">$15.00 USD:</span>
                  <span className="font-bold">≈ {Math.round(15 * numericRate).toLocaleString()} DZD</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-1">
                  <span className="text-[var(--fg-muted)]">$50.00 USD:</span>
                  <span className="font-bold">≈ {Math.round(50 * numericRate).toLocaleString()} DZD</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-1">
                  <span className="text-[var(--fg-muted)]">$100.00 USD:</span>
                  <span className="font-bold">≈ {Math.round(100 * numericRate).toLocaleString()} DZD</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--fg-muted)] pt-1">
                Prices across the storefront display in USD with this indicative conversion. Checkout settlements are strictly processed in USD.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Storefront Operational Mode (Maintenance Mode) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Storefront Operational Mode</h2>
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Emergency switch to halt customer order placement during major catalog updates or system maintenance.
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                maintenanceMode
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              }`}
            >
              {maintenanceMode ? "Maintenance Active" : "Storefront Live"}
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <input
              id="maintenanceMode"
              name="maintenanceMode"
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="h-5 w-5 rounded border-[var(--border)] text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="maintenanceMode" className="text-sm font-bold cursor-pointer select-none">
              Activate Storefront Maintenance Mode
            </label>
            <span className="text-xs text-[var(--fg-muted)] ml-auto">
              {maintenanceMode
                ? "Disables purchasing & displays notice"
                : "Normal operations enabled"}
            </span>
          </div>

          {/* Multi-language Banners */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Storefront Notice Messages
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg-muted)]">
                  English Notice (en)
                </label>
                <textarea
                  rows={3}
                  value={bannerEn}
                  onChange={(e) => setBannerEn(e.target.value)}
                  placeholder="Store maintenance in progress..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg-muted)]">
                  Arabic Notice (ar)
                </label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={bannerAr}
                  onChange={(e) => setBannerAr(e.target.value)}
                  placeholder="أعمال صيانة جارية في المتجر..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg-muted)]">
                  French Notice (fr)
                </label>
                <textarea
                  rows={3}
                  value={bannerFr}
                  onChange={(e) => setBannerFr(e.target.value)}
                  placeholder="Maintenance de la boutique en cours..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Live Banner Preview */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <span>👀</span>
                  <span>Storefront Banner Preview</span>
                </div>
                <div className="flex gap-1">
                  {(["en", "ar", "fr"] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setPreviewLocale(loc)}
                      className={`px-2 py-0.5 rounded text-[11px] uppercase font-bold ${
                        previewLocale === loc
                          ? "bg-amber-600 text-white"
                          : "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div
                dir={previewLocale === "ar" ? "rtl" : "ltr"}
                className="rounded-lg bg-amber-500/20 border border-amber-500/40 p-3 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center justify-center gap-2 text-center"
              >
                <span>⚠️</span>
                <span>{activePreviewBanner || "(No message provided)"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Platform Information */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold">Support & Communications</h2>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Storefront customer support contact information and transactional communication details.
            </p>
          </div>

          <div className="max-w-md space-y-2">
            <label htmlFor="supportEmail" className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              Support Email Address
            </label>
            <input
              id="supportEmail"
              name="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@raqmi.dz"
              className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Save Changes Button */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? "Saving Settings..." : "Save System Settings"}
          </button>
        </div>
      </form>

      {/* Section 4: Telegram Bot Health & Diagnostics Cockpit */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Telegram Bot Health & Alerts</h2>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Live telemetry on webhook status, Bot API responsiveness, and admin emergency alert channel.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
              diagnostics.isConfigured
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            {diagnostics.isConfigured ? "Bot Configured" : "Unconfigured in .env"}
          </span>
        </div>

        {/* Diagnostics Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Bot Identity</div>
            <div className="text-sm font-bold truncate">
              {diagnostics.bot?.username ? `@${diagnostics.bot.username}` : "—"}
            </div>
            <div className="text-[11px] text-[var(--fg-muted)]">
              {diagnostics.bot ? diagnostics.bot.first_name : "Not connected"}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Bot API Latency</div>
            <div className="text-sm font-bold">
              {diagnostics.latencyMs !== null ? `${diagnostics.latencyMs} ms` : "—"}
            </div>
            <div className="text-[11px] text-[var(--fg-muted)]">
              {diagnostics.latencyMs !== null && diagnostics.latencyMs < 500
                ? "Fast connection"
                : "Round-trip time"}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Pending Updates</div>
            <div className="text-sm font-bold">
              {diagnostics.webhook ? diagnostics.webhook.pending_update_count : 0}
            </div>
            <div className="text-[11px] text-[var(--fg-muted)]">In Telegram queue</div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-1">
            <div className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase">Webhook State</div>
            <div className="text-sm font-bold truncate">
              {diagnostics.webhook?.url ? "Active Webhook" : "Polling / None"}
            </div>
            <div className="text-[11px] text-[var(--fg-muted)] truncate">
              {diagnostics.webhook?.url || "No webhook URL set"}
            </div>
          </div>
        </div>

        {diagnostics.error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <strong>Bot Notice:</strong> {diagnostics.error}
          </div>
        )}

        {/* Test Alert Banner / Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--fg-muted)]">
            Send a sample alert to verify that the configured Telegram Admin chat receives real-time transaction notifications.
          </div>
          <button
            type="button"
            onClick={handleSendTestAlert}
            disabled={isSendingAlert || !diagnostics.isConfigured}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/30 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
          >
            {isSendingAlert ? "Dispatching Alert..." : "🔔 Send Test Notification"}
          </button>
        </div>

        {alertStatus && (
          <div
            role="alert"
            className={`rounded-xl p-3 border text-xs font-medium ${
              alertStatus.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            {alertStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
