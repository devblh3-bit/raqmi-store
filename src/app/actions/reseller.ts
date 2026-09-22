"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { notifyResellerApplication } from "@/lib/telegram/notify";

const applySchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required (min 2 characters)"),
  contact: z.string().trim().min(3, "Contact info is required (Telegram / WhatsApp / Phone)"),
  note: z.string().trim().max(500).optional(),
});

export type ResellerApplyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Submit an application for wholesale / reseller pricing.
 * Transitions user to RESELLER_APPLICANT and dispatches a Telegram notification to admins.
 */
export async function submitResellerApplication(
  prevState: ResellerApplyResult | null,
  formData: FormData,
): Promise<ResellerApplyResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  const raw = {
    businessName: formData.get("businessName")?.toString() ?? "",
    contact: formData.get("contact")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? "",
  };

  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid form data";
    return { ok: false, error: msg };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return { ok: false, error: "USER_NOT_FOUND" };
  }

  if (user.role === "RESELLER") {
    return { ok: false, error: "ALREADY_RESELLER" };
  }

  if (user.role === "ADMIN") {
    return { ok: false, error: "ADMIN_ACCOUNT" };
  }

  // Update user role to RESELLER_APPLICANT
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "RESELLER_APPLICANT" },
  });

  // Log in AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "RESELLER_APPLICATION_SUBMITTED",
      entity: "User",
      entityId: user.id,
      detail: {
        email: user.email,
        businessName: parsed.data.businessName,
        contact: parsed.data.contact,
        note: parsed.data.note ?? "",
      } as never,
    },
  });

  // Dispatch Telegram notification to administrators (best-effort)
  try {
    await notifyResellerApplication({
      applicationId: user.id,
      businessName: parsed.data.businessName,
      contact: parsed.data.contact,
      note: parsed.data.note,
    });
  } catch (err) {
    console.error("[reseller-apply] telegram alert failed:", err);
  }

  revalidatePath("/[locale]/account", "layout");
  revalidatePath("/[locale]/admin/resellers", "layout");
  revalidatePath("/[locale]/admin/users", "layout");

  return { ok: true };
}
