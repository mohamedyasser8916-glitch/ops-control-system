import { prisma } from '@/lib/db';

export async function writeAuditLog(opts: {
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'LOGIN' | 'EXPORT';
  entity: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: opts.userId ?? null,
      action: opts.action,
      entity: opts.entity,
      recordId: opts.recordId,
      oldValue: opts.oldValue as any,
      newValue: opts.newValue as any
    }
  });
}
