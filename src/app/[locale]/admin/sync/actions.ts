"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdapter } from "@/lib/providers";

const thresholdSchema = z.object({
  providerId: z.string().min(1),
  threshold: z.string().trim().max(20),
});

export async function updateLowBalanceThreshold(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const parsed = thresholdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  const raw = parsed.data.threshold.trim();
  const value = raw === "" ? null : BigInt(raw);
  if (value !== null && value < 0n) return;

  await prisma.provider.update({
    where: { id: parsed.data.providerId },
    data: { lowBalanceThresholdMinor: value },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PROVIDER_THRESHOLD_UPDATED",
      entity: "Provider",
      entityId: parsed.data.providerId,
      detail: { lowBalanceThresholdMinor: value?.toString() ?? null } as never,
    },
  });

  revalidatePath("/admin/sync");
}

export async function toggleProviderActive(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const providerId = String(formData.get("providerId") ?? "");
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return;

  const next = !provider.isActive;
  await prisma.provider.update({ where: { id: providerId }, data: { isActive: next } });
  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: next ? "PROVIDER_ENABLED" : "PROVIDER_DISABLED",
      entity: "Provider",
      entityId: providerId,
      detail: { code: provider.code } as never,
    },
  });
  revalidatePath("/admin/sync");
}

export async function refreshProviderBalance(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const providerId = String(formData.get("providerId") ?? "");
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return;

  const adapter = getAdapter(provider.code);
  if (!adapter) return;

  const result = await adapter.getBalance();
  if (!result.ok) {
    const msg = "notSupported" in result ? (result as { message: string }).message : (result as { error: { message: string } }).error.message;
    await prisma.notification.create({
      data: {
        type: "LOW_BALANCE",
        severity: "warning",
        titleEn: `Balance check failed for ${provider.displayName}`,
        bodyEn: msg.slice(0, 500),
        link: "/admin/sync",
      },
    });
    return;
  }

  await prisma.provider.update({
    where: { id: providerId },
    data: {
      balanceMinor: BigInt(result.value.availableMinor),
      balanceCurrency: result.value.currency,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PROVIDER_BALANCE_REFRESHED",
      entity: "Provider",
      entityId: providerId,
      detail: { availableMinor: result.value.availableMinor, currency: result.value.currency } as never,
    },
  });

  revalidatePath("/admin/sync");
}
