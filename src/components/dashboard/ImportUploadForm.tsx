'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRef } from 'react';
import { uploadImportAction, type ImportActionState } from '@/lib/actions/importActions';
import { DATASET_LABELS } from '@/lib/importers/registry';

const initialState: ImportActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Importing…' : 'Upload & Import'}
    </button>
  );
}

export function ImportUploadForm() {
  const [state, formAction] = useFormState(uploadImportAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card p-4">
      <h2 className="section-title mb-3">Upload a File</h2>
      <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dataset</label>
          <select name="dataset" required className="input-field w-64">
            {Object.entries(DATASET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">File (.xlsx or .csv)</label>
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="text-sm" />
        </div>
        <SubmitButton />
      </form>

      {state.message && (
        <div className={`mt-4 rounded-md px-3 py-2 text-sm ${state.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {state.message}
        </div>
      )}

      {state.details && (
        <div className="mt-3 grid grid-cols-5 gap-3 text-center text-sm">
          <Stat label="Read" value={state.details.rowsRead} />
          <Stat label="Inserted" value={state.details.rowsInserted} />
          <Stat label="Updated" value={state.details.rowsUpdated} />
          <Stat label="Skipped" value={state.details.rowsSkipped} />
          <Stat label="Rejected" value={state.details.rowsRejected} highlight={state.details.rowsRejected > 0} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
