"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { approveDeposit, rejectDeposit } from "@/lib/deposits";

const idSchema = z.string().min(1).max(50);

export async function approveDepositAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(formData.get("depositId"));
  if (!parsed.success) return { error: "BAD_REQUEST" as const };
  const depositId = parsed.data;
  const result = await approveDeposit({ depositId, reviewedById: session.userId });
  if (!result.ok && "code" in result) {
    // DepositError path — surface as typed error
    return { error: result.code as string } as const;
  }
  revalidatePath("/admin/deposits");
  return result;
}

export async function rejectDepositAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(formData.get("depositId"));
  if (!parsed.success) return { error: "BAD_REQUEST" as const };
  const depositId = parsed.data;
  const note = String(formData.get("note") ?? "").slice(0, 500) || undefined;
  const result = await rejectDeposit({ depositId, reviewedById: session.userId, reviewNote: note });
  revalidatePath("/admin/deposits");
  return result;
}
