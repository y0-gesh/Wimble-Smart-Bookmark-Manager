import { useState } from 'react';
import { Archive, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { BackupSnapshot } from '../../../core/types';

interface BackupsTabProps {
  backups: BackupSnapshot[];
  lastBackupId: string | null;
  onCreateBackup: () => Promise<void>;
  onRevert: (backupId: string) => Promise<void>;
  onDeleteBackup: (backupId: string) => Promise<void>;
}

export function BackupsTab({
  backups,
  lastBackupId,
  onCreateBackup,
  onRevert,
  onDeleteBackup,
}: BackupsTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreateBackup();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevert(id: string) {
    if (!window.confirm('Restore your bookmarks to this backup? Current bookmark layout will be replaced.')) {
      return;
    }
    setBusyId(id);
    try {
      await onRevert(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Backup Snapshots</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic backups are created before every organization or import. Restore any snapshot
            in one click.
          </p>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {creating ? 'Saving...' : 'Create Backup Now'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {backups.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Archive className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-600">No backups yet</p>
            <p className="text-xs mt-1">
              Backups are created automatically when you organize or import bookmarks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((bak) => (
              <div
                key={bak.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/70"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{bak.label}</span>
                    {bak.id === lastBackupId && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                        Latest Pre-Organize
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(bak.createdAt).toLocaleString()} · {bak.bookmarkCount} bookmarks ·{' '}
                    {bak.folderCount} folders
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRevert(bak.id)}
                    disabled={busyId === bak.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {busyId === bak.id ? 'Restoring...' : 'Revert to This'}
                  </button>
                  <button
                    onClick={() => onDeleteBackup(bak.id)}
                    title="Delete backup"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

