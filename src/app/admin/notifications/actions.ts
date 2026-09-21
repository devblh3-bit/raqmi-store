"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";

export async function markNotificationRead(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "BAD_REQUEST" as const };
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  revalidatePath("/admin/notifications");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  await requireAdmin();
  await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  revalidatePath("/admin/notifications");
  return { ok: true as const };
}
