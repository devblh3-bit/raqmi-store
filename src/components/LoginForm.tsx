"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const email = new FormData(e.currentTarget).get("email");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return <p className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">{t("sent")}</p>;
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label className="block text-sm font-semibold" htmlFor="email">{t("email")}</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
      />
      {state === "error" && <p className="mt-2 text-sm text-red-600">{t("errorSend")}</p>}
      <button
        disabled={state === "sending"}
        className="btn-shine group mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-60"
      >
        {t("send")}
      </button>
    </form>
  );
}
