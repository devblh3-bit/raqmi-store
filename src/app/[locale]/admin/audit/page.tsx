import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  AuditExplorer,
  type SerializedAuditLog,
} from "./audit-explorer";

export default async function AuditLogsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { email: true, role: true } },
    },
  });

  const serializedLogs: SerializedAuditLog[] = logs.map((l) => ({
    id: l.id,
    actorEmail: l.actor?.email ?? null,
    actorRole: l.actor?.role ?? null,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    detail: l.detail,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log Explorer</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Complete, immutable operational trail of all administrative actions, balance adjustments, catalog edits, and fulfillment interventions.
        </p>
      </div>

      <AuditExplorer logs={serializedLogs} />
    </div>
  );
}

