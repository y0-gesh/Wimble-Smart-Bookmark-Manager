import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderTree,
  Loader2,
  Radar,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP, categorizeAllBookmarks } from '../../../core/categorizer';
import { getChromeBookmarksApi, getChromeStorageApi } from '../../../core/chromeBookmarks';
import { organizeBookmarks } from '../../../core/organizer';
import { scanBookmarks } from '../../../core/scanner';
import type {
  CategorizedBookmark,
  CategoryId,
  FlatBookmark,
  OrganizeResult,
  ScanMetadata,
} from '../../../core/types';

interface OrganizeTabProps {
  bookmarks: FlatBookmark[];
  scanCache: Record<string, ScanMetadata>;
  rootFolders: Array<{ id: string; title: string }>;
  lastBackupId: string | null;
  onScanComplete: (updatedCache: Record<string, ScanMetadata>) => void;
  onOrganizeComplete: () => Promise<void>;
  onRevert: (backupId: string) => Promise<void>;
}

const bookmarksApi = getChromeBookmarksApi();
const storageApi = getChromeStorageApi();

export function OrganizeTab({
  bookmarks,
  scanCache,
  rootFolders,
  lastBackupId,
  onScanComplete,
  onOrganizeComplete,
  onRevert,
}: OrganizeTabProps) {
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ completed: 0, total: 0 });
  const [forceRescan, setForceRescan] = useState(false);
  const [groupBrokenLinks, setGroupBrokenLinks] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, CategoryId>>({});

  const [targetRootId, setTargetRootId] = useState(rootFolders[0]?.id ?? '1');
  const [containerFolderName, setContainerFolderName] = useState('Organized Bookmarks');
  const [removeEmptyFolders, setRemoveEmptyFolders] = useState(true);

  const [organizing, setOrganizing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [organizeResult, setOrganizeResult] = useState<OrganizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (rootFolders.length > 0 && !rootFolders.some((r) => r.id === targetRootId)) {
      setTargetRootId(rootFolders[0].id);
    }
  }, [rootFolders, targetRootId]);

  const previewItems: CategorizedBookmark[] = useMemo(() => {
    const base = categorizeAllBookmarks(bookmarks, scanCache, { groupBrokenLinks });
    return base.map((item) =>
      overrides[item.bookmark.id]
        ? { ...item, category: overrides[item.bookmark.id], reason: 'Manual override' }
        : item
    );
  }, [bookmarks, scanCache, groupBrokenLinks, overrides]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of previewItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [previewItems]);

  async function handleStartScan() {
    setError(null);
    setScanning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    setScanProgress({ completed: 0, total: new Set(bookmarks.map((b) => b.url)).size });

    try {
      const updated = await scanBookmarks(bookmarks, {
        forceRescan,
        storageApi,
        signal: controller.signal,
        onProgress: (completed, total) => {
          setScanProgress({ completed, total });
        },
      });
      onScanComplete(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanning(false);
      abortRef.current = null;
    }
  }

  function handleStopScan() {
    abortRef.current?.abort();
  }

  async function handleOrganize() {
    setError(null);
    setOrganizing(true);
    try {
      const result = await organizeBookmarks(
        previewItems,
        {
          targetRootId,
          containerFolderName: containerFolderName.trim() || undefined,
          removeEmptyFolders,
        },
        bookmarksApi,
        storageApi
      );
      setOrganizeResult(result);
      await onOrganizeComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to organize bookmarks.');
    } finally {
      setOrganizing(false);
    }
  }

  async function handleRevertClick() {
    const idToRevert = organizeResult?.backupId ?? lastBackupId;
    if (!idToRevert) return;
    setReverting(true);
    setError(null);
    try {
      await onRevert(idToRevert);
      setOrganizeResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert bookmarks.');
    } finally {
      setReverting(false);
    }
  }

  const pct =
    scanProgress.total > 0
      ? Math.round((scanProgress.completed / scanProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Completion / Revert Banner */}
      {(organizeResult || lastBackupId) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-950">
                {organizeResult
                  ? `Organized ${organizeResult.movedCount} bookmarks across ${organizeResult.foldersCreated} new folders!`
                  : 'Your bookmarks were recently organized.'}
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                A full backup was saved automatically before organizing. You can revert anytime.
              </p>
            </div>
          </div>
          <button
            onClick={handleRevertClick}
            disabled={reverting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-950 bg-amber-300 hover:bg-amber-400 rounded-lg transition shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {reverting ? 'Reverting...' : 'Revert Changes'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Website Scanner */}
      <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Radar className="w-4 h-4 text-indigo-600" />
              Step 1: Scan Bookmarked Websites
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fetches page titles, descriptions, and keywords from your {bookmarks.length} bookmarks
              to categorize them accurately.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRescan}
                onChange={(e) => setForceRescan(e.target.checked)}
                disabled={scanning}
                className="rounded border-slate-300 text-indigo-600"
              />
              Force re-scan
            </label>

            {scanning ? (
              <button
                onClick={handleStopScan}
                className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
              >
                Stop Scan
              </button>
            ) : (
              <button
                onClick={handleStartScan}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer"
              >
                <Radar className="w-3.5 h-3.5" />
                Scan Websites
              </button>
            )}
          </div>
        </div>

        {scanning && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                Scanning websites...
              </span>
              <span>
                {scanProgress.completed} / {scanProgress.total} ({pct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Organization Options & Apply */}
      <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              Step 2: Configure & Organize
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              A full backup snapshot is automatically created before any bookmark is moved.
            </p>
          </div>

          <button
            onClick={handleOrganize}
            disabled={organizing || scanning || bookmarks.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {organizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {organizing ? 'Backing up & Organizing...' : 'Backup & Organize Now'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Root Folder
            </label>
            <select
              value={targetRootId}
              onChange={(e) => setTargetRootId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
            >
              {rootFolders.map((rf) => (
                <option key={rf.id} value={rf.id}>
                  {rf.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Parent Folder Name (optional)
            </label>
            <input
              type="text"
              value={containerFolderName}
              onChange={(e) => setContainerFolderName(e.target.value)}
              placeholder="e.g. Organized Bookmarks"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={groupBrokenLinks}
                onChange={(e) => setGroupBrokenLinks(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Group unreachable links separately
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={removeEmptyFolders}
                onChange={(e) => setRemoveEmptyFolders(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Remove empty folders afterward
            </label>
          </div>
        </div>
      </section>

      {/* Step 3: Category Preview */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Category Preview ({previewItems.length} bookmarks)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => categoryCounts[c.id] > 0).map((cat) => (
              <span
                key={cat.id}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cat.color}`}
              >
                {cat.name}: {categoryCounts[cat.id]}
              </span>
            ))}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {previewItems.map((item) => {
            const catDef = CATEGORY_MAP[item.category];
            return (
              <div
                key={item.bookmark.id}
                className="flex items-center justify-between gap-4 px-5 py-2.5 hover:bg-slate-50/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {item.bookmark.title}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.bookmark.domain} · {item.reason}
                  </p>
                </div>

                <select
                  value={item.category}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [item.bookmark.id]: e.target.value as CategoryId,
                    }))
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium outline-none cursor-pointer ${catDef.color}`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white text-slate-800">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

