'use server';

import { revalidatePath } from 'next/cache';
import { ImportDataset } from '@prisma/client';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { runImport } from '@/lib/importers/engine';
import { writeAuditLog } from '@/lib/audit';

export type ImportActionState = {
  success?: boolean;
  message?: string;
  details?: { rowsRead: number; rowsInserted: number; rowsUpdated: number; rowsSkipped: number; rowsRejected: number };
};

export async function uploadImportAction(_prevState: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const session = await getAppSession();
  if (!session || !hasPermission(session, PERMISSIONS.MANAGE_IMPORTS)) {
    return { success: false, message: 'You do not have permission to run imports.' };
  }

  const dataset = formData.get('dataset') as ImportDataset | null;
  const file = formData.get('file') as File | null;

  if (!dataset) return { success: false, message: 'Please choose a dataset.' };
  if (!file || file.size === 0) return { success: false, message: 'Please choose a file to upload.' };

  const maxMb = Number(process.env.MAX_IMPORT_FILE_MB ?? 25);
  if (file.size > maxMb * 1024 * 1024) {
    return { success: false, message: `File is too large. Maximum size is ${maxMb} MB.` };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { batchId, result } = await runImport({
      dataset,
      fileName: file.name,
      fileBuffer: buffer,
      sourceLabel: 'Manual Upload',
      triggeredById: session.user.id
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'IMPORT',
      entity: 'ImportBatch',
      recordId: batchId,
      newValue: result
    });

    revalidatePath('/data-management');

    return {
      success: true,
      message:
        result.rowsRejected > 0
          ? `Import finished with ${result.rowsRejected} rejected row(s) — see details below.`
          : 'Import completed successfully.',
      details: result
    };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Import failed.' };
  }
}
