import "server-only";

/**
 * Send the magic-link email. Smallest viable: Resend HTTP API via fetch when
 * RESEND_API_KEY is set; otherwise log the link (dev fallback).
 * ponytail: no SDK, no templates, no queue. Upgrade path: swap sendLoginEmail's
 * body for whatever provider/template we settle on — callers only pass (email, url).
 */
export async function sendLoginEmail(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[auth] magic link for ${email}: ${url}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "login@example.com",
      to: [email],
      subject: "Your sign-in link",
      text: `Sign in by opening this link (valid 15 minutes):\n\n${url}\n\nIf you didn't request this, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`email send failed: ${res.status} ${await res.text()}`);
}
