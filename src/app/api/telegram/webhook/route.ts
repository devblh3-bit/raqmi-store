import { handleTelegramWebhook, type DepositDecision } from "@/lib/telegram/webhook";
import { approveDeposit, rejectDeposit } from "@/lib/deposits";

/**
 * Telegram webhook. Registration is a one-time operator action —
 * see docs/telegram-setup.md — this only receives deliveries.
 *
 * The handler is Prisma-free by design, so the deposit review action is
 * injected here. Auth (the secret-token check) and the admin gate both live
 * inside handleTelegramWebhook, which fails closed.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const res = await handleTelegramWebhook(request.headers, body, {
    reviewDeposit: async (depositId: string, decision: DepositDecision) => {
      const outcome =
        decision === "approve"
          ? await approveDeposit({ depositId })
          : await rejectDeposit({ depositId });
      return { status: outcome.status, alreadyHandled: outcome.alreadyHandled };
    },
  });

  return new Response(res.body, { status: res.status });
}
