import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowLeftRight, Search, Sparkles } from 'lucide-react';
import {
  createBackupSnapshot,
  deleteBackup,
  getLastOrganizeBackupId,
  listBackups,
  revertToBackup,
} from '../../core/backup';
import {
  flattenBookmarkTree,
  getChromeBookmarksApi,
  getChromeStorageApi,
} from '../../core/chromeBookmarks';
import { loadScanCache } from '../../core/scanner';
import type { BackupSnapshot, FlatBookmark, ScanMetadata } from '../../core/types';
import { BackupsTab } from './components/BackupsTab';
import { BrowseTab } from './components/BrowseTab';
import { ImportExportTab } from './components/ImportExportTab';
import { OrganizeTab } from './components/OrganizeTab';

type TabId = 'browse' | 'organize' | 'backups' | 'import-export';

const bookmarksApi = getChromeBookmarksApi();
const storageApi = getChromeStorageApi();

function getInitialTab(): TabId {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'organize' || hash === 'backups' || hash === 'import-export') {
    return hash;
  }
  return 'browse';
}

export function ManagerApp() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [bookmarks, setBookmarks] = useState<FlatBookmark[]>([]);
  const [rootFolders, setRootFolders] = useState<Array<{ id: string; title: string }>>([]);
  const [scanCache, setScanCache] = useState<Record<string, ScanMetadata>>({});
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [lastBackupId, setLastBackupId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [tree, cache, allBackups, lastId] = await Promise.all([
      bookmarksApi.getTree(),
      loadScanCache(storageApi),
      listBackups(storageApi),
      getLastOrganizeBackupId(storageApi),
    ]);

    setBookmarks(flattenBookmarkTree(tree));
    setRootFolders(
      (tree[0]?.children ?? []).map((r) => ({ id: r.id, title: r.title || `Root ${r.id}` }))
    );
    setScanCache(cache);
    setBackups(allBackups);
    setLastBackupId(lastId);
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDeleteBookmark(id: string) {
    await bookmarksApi.remove(id);
    await refreshAll();
    showToast('Bookmark deleted.');
  }

  async function handleCreateBackup() {
    await createBackupSnapshot('Manual Snapshot', bookmarksApi, storageApi);
    await refreshAll();
    showToast('Backup snapshot created.');
  }

  async function handleRevert(backupId: string) {
    const res = await revertToBackup(backupId, bookmarksApi, storageApi);
    await refreshAll();
    showToast(`Reverted ${res.restoredBookmarks} bookmarks from backup.`);
  }

  async function handleDeleteBackup(backupId: string) {
    await deleteBackup(backupId, storageApi);
    await refreshAll();
    showToast('Backup deleted.');
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Search }> = [
    { id: 'browse', label: 'Browse & Search', icon: Search },
    { id: 'organize', label: 'Scan & Organize', icon: Sparkles },
    { id: 'backups', label: `Backups (${backups.length})`, icon: Archive },
    { id: 'import-export', label: 'Import / Export', icon: ArrowLeftRight },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon128.png"
              alt="Wimble logo"
              className="w-9 h-9 rounded-xl shadow-xs"
            />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Wimble - Smart Bookmark Manager
              </h1>
              <p className="text-xs text-slate-500">{bookmarks.length} total bookmarks</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'browse' && (
          <BrowseTab
            bookmarks={bookmarks}
            scanCache={scanCache}
            onDeleteBookmark={handleDeleteBookmark}
          />
        )}

        {activeTab === 'organize' && (
          <OrganizeTab
            bookmarks={bookmarks}
            scanCache={scanCache}
            rootFolders={rootFolders}
            lastBackupId={lastBackupId}
            onScanComplete={(updated) => {
              setScanCache(updated);
              showToast('Website scan completed.');
            }}
            onOrganizeComplete={refreshAll}
            onRevert={handleRevert}
          />
        )}

        {activeTab === 'backups' && (
          <BackupsTab
            backups={backups}
            lastBackupId={lastBackupId}
            onCreateBackup={handleCreateBackup}
            onRevert={handleRevert}
            onDeleteBackup={handleDeleteBackup}
          />
        )}

        {activeTab === 'import-export' && (
          <ImportExportTab rootFolders={rootFolders} onImportComplete={refreshAll} />
        )}
      </main>
    </div>
  );
}

