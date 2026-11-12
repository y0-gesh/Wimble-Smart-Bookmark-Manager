import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ExternalLink,
  FolderKanban,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  getLastOrganizeBackupId,
  revertToBackup,
} from '../../core/backup';
import { categorizeBookmark, CATEGORY_MAP } from '../../core/categorizer';
import {
  flattenBookmarkTree,
  getChromeBookmarksApi,
  getChromeStorageApi,
} from '../../core/chromeBookmarks';
import { loadScanCache } from '../../core/scanner';
import type { FlatBookmark, ScanMetadata } from '../../core/types';

const bookmarksApi = getChromeBookmarksApi();
const storageApi = getChromeStorageApi();

export function PopupApp() {
  const [bookmarks, setBookmarks] = useState<FlatBookmark[]>([]);
  const [scanCache, setScanCache] = useState<Record<string, ScanMetadata>>({});
  const [query, setQuery] = useState('');
  const [lastBackupId, setLastBackupId] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadData() {
    const [tree, cache, lastId] = await Promise.all([
      bookmarksApi.getTree(),
      loadScanCache(storageApi),
      getLastOrganizeBackupId(storageApi),
    ]);
    setBookmarks(flattenBookmarkTree(tree));
    setScanCache(cache);
    setLastBackupId(lastId);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookmarks.slice(0, 20);
    return bookmarks
      .filter((bm) => {
        const scan = scanCache[bm.url];
        return (
          bm.title.toLowerCase().includes(q) ||
          bm.url.toLowerCase().includes(q) ||
          bm.domain.toLowerCase().includes(q) ||
          bm.folderPath.toLowerCase().includes(q) ||
          (scan?.description?.toLowerCase().includes(q) ?? false) ||
          (scan?.pageTitle?.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 30);
  }, [bookmarks, scanCache, query]);

  function openManager(tab?: string) {
    const url = chrome.runtime.getURL(tab ? `manager.html#${tab}` : 'manager.html');
    chrome.tabs.create({ url });
  }

  async function handleRevert() {
    if (!lastBackupId || reverting) return;
    setReverting(true);
    try {
      const res = await revertToBackup(lastBackupId, bookmarksApi, storageApi);
      setStatusMessage(`Reverted ${res.restoredBookmarks} bookmarks to pre-organize state.`);
      await loadData();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to revert backup.');
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="flex flex-col h-[480px] w-[380px] bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Wimble</h1>
            <p className="text-[11px] text-slate-500">{bookmarks.length} bookmarks</p>
          </div>
        </div>
        <button
          onClick={() => openManager()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          Open Manager
        </button>
      </header>

      {/* Revert Banner if recent organize */}
      {lastBackupId && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
          <span className="text-xs text-amber-900 font-medium">
            Bookmarks were recently organized
          </span>
          <button
            onClick={handleRevert}
            disabled={reverting}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-md transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            {reverting ? 'Reverting...' : 'Revert'}
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="px-4 py-2 text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
          {statusMessage}
        </div>
      )}

      {/* Search */}
      <div className="p-3 bg-white border-b border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookmarks, domains, descriptions..."
            autoFocus
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 border border-transparent focus:border-indigo-400 focus:bg-white rounded-lg outline-none transition"
          />
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-400">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs font-medium text-slate-600">No bookmarks match "{query}"</p>
          </div>
        ) : (
          filtered.map((bm) => {
            const cat = categorizeBookmark(bm, scanCache[bm.url]);
            const catDef = CATEGORY_MAP[cat.category];
            return (
              <a
                key={bm.id}
                href={bm.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white transition group"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(bm.domain)}&sz=32`}
                  alt=""
                  className="w-4 h-4 mt-0.5 rounded-sm shrink-0 bg-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-700">
                      {bm.title}
                    </p>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-400 truncate">{bm.domain || bm.url}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${catDef.color}`}
                    >
                      {catDef.name.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </a>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <footer className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-t border-slate-200">
        <button
          onClick={() => openManager('organize')}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Scan & Organize
        </button>
        <button
          onClick={() => openManager('import-export')}
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
        >
          Import / Export
        </button>
      </footer>
    </div>
  );
}

