import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/providers";

/**
 * Low-balance poll. Point a cron at it every 5 minutes with the secret in
 * the `x-cron-secret` header (Vercel Cron schedule every 5 min):
 *
 *   curl -X POST https://shop.example/api/cron/poll-balances \
 *     -H "x-cron-secret: $CRON_SECRET"
 *
 * When availableMinor < lowBalanceThresholdMinor, the provider is auto-paused
 * (isActive=false) so new orders skip it; existing PLACED_WITH_PROVIDER rows
 * still poll. A Notification + Telegram DM is emitted.
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !expected.trim()) {
    return NextResponse.json({ error: "cron secret not configured" }, { status: 401 });
  }
  if (request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    select: { id: true, code: true, displayName: true, lowBalanceThresholdMinor: true },
  });

  const results: { code: string; ok: boolean; paused?: boolean; error?: string }[] = [];

  for (const p of providers) {
    const adapter = getAdapter(p.code);
    if (!adapter) {
      results.push({ code: p.code, ok: false, error: "no adapter" });
      continue;
    }

    const res = await adapter.getBalance();
    if (!res.ok) {
      const msg = "notSupported" in res ? (res as { message: string }).message : (res as { error: { message: string } }).error.message;
      results.push({ code: p.code, ok: false, error: msg });
      continue;
    }

    await prisma.provider.update({
      where: { id: p.id },
      data: {
        balanceMinor: BigInt(res.value.availableMinor),
        balanceCurrency: res.value.currency,
      },
    });

    const threshold = p.lowBalanceThresholdMinor;
    if (threshold != null && BigInt(res.value.availableMinor) < threshold) {
      await prisma.provider.update({ where: { id: p.id }, data: { isActive: false } });
      await prisma.notification.create({
        data: {
          type: "LOW_BALANCE",
          severity: "critical",
          titleEn: `${p.displayName} auto-paused: low balance`,
          bodyEn: `Available ${res.value.availableMinor} ${res.value.currency} < threshold ${threshold.toString()}. Provider disabled for new orders.`,
          link: "/admin/sync",
        },
      });
      results.push({ code: p.code, ok: true, paused: true });
    } else {
      results.push({ code: p.code, ok: true, paused: false });
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
