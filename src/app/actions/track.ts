"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeOrderCode } from "@/lib/order-code";
import { createSession } from "@/lib/auth/session";

export type TrackState = {
  error?: string;
};

export async function trackOrderAction(
  _prev: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const rawCode = formData.get("code")?.toString() ?? "";
  const rawEmail = formData.get("email")?.toString() ?? "";
  const locale = formData.get("locale")?.toString() ?? "en";

  const code = normalizeOrderCode(rawCode);
  const email = rawEmail.toLowerCase().trim();

  if (!code || !email) {
    return { error: "INVALID_INPUT" };
  }

  const order = await prisma.order.findFirst({
    where: {
      code,
      OR: [
        { guestEmail: email },
        { user: { email } },
      ],
    },
    include: { user: true },
  });

  if (!order) {
    return { error: "NOT_FOUND" };
  }

  // Authenticate session for this user so they can view the order securely
  if (order.user) {
    await createSession(order.user.id, order.user.role);
  } else if (order.userId) {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (user) {
      await createSession(user.id, user.role);
    }
  } else {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, preferredLocale: locale },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { userId: user.id },
    });
    await createSession(user.id, user.role);
  }

  redirect(`/${locale}/orders/${code}`);
}
