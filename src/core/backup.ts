import {
  countTreeItems,
  serializeTree,
  type BookmarksAPI,
  type StorageAPI,
} from './chromeBookmarks';
import type { BackupSnapshot, SerializedBookmarkNode } from './types';

const BACKUPS_STORAGE_KEY = 'bookmark_backups';
const LAST_ORGANIZE_BACKUP_KEY = 'last_organize_backup_id';
const MAX_BACKUPS = 20;

export async function listBackups(storageApi: StorageAPI): Promise<BackupSnapshot[]> {
  const data = await storageApi.get<{ [BACKUPS_STORAGE_KEY]?: BackupSnapshot[] }>(
    BACKUPS_STORAGE_KEY
  );
  const list = data[BACKUPS_STORAGE_KEY] ?? [];
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLastOrganizeBackupId(storageApi: StorageAPI): Promise<string | null> {
  const data = await storageApi.get<{ [LAST_ORGANIZE_BACKUP_KEY]?: string | null }>(
    LAST_ORGANIZE_BACKUP_KEY
  );
  return data[LAST_ORGANIZE_BACKUP_KEY] ?? null;
}

export async function setLastOrganizeBackupId(
  backupId: string | null,
  storageApi: StorageAPI
): Promise<void> {
  await storageApi.set({ [LAST_ORGANIZE_BACKUP_KEY]: backupId });
}

export async function createBackupSnapshot(
  label: string,
  bookmarksApi: BookmarksAPI,
  storageApi: StorageAPI
): Promise<BackupSnapshot> {
  const rawTree = await bookmarksApi.getTree();
  const tree = serializeTree(rawTree);
  const counts = countTreeItems(tree);

  const snapshot: BackupSnapshot = {
    id: `bak_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    bookmarkCount: counts.bookmarks,
    folderCount: counts.folders,
    tree,
  };

  const existing = await listBackups(storageApi);
  const updated = [snapshot, ...existing].slice(0, MAX_BACKUPS);
  await storageApi.set({ [BACKUPS_STORAGE_KEY]: updated });

  return snapshot;
}

export async function deleteBackup(backupId: string, storageApi: StorageAPI): Promise<void> {
  const existing = await listBackups(storageApi);
  const filtered = existing.filter((b) => b.id !== backupId);
  await storageApi.set({ [BACKUPS_STORAGE_KEY]: filtered });

  const lastId = await getLastOrganizeBackupId(storageApi);
  if (lastId === backupId) {
    await setLastOrganizeBackupId(null, storageApi);
  }
}

async function clearFolderChildren(folderId: string, bookmarksApi: BookmarksAPI): Promise<void> {
  const children = await bookmarksApi.getChildren(folderId);
  for (const child of children) {
    if (child.url) {
      await bookmarksApi.remove(child.id);
    } else {
      await bookmarksApi.removeTree(child.id);
    }
  }
}

async function restoreChildren(
  parentId: string,
  nodes: SerializedBookmarkNode[],
  bookmarksApi: BookmarksAPI
): Promise<number> {
  let restoredCount = 0;
  const sorted = [...nodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const node of sorted) {
    if (node.url) {
      await bookmarksApi.create({
        parentId,
        title: node.title,
        url: node.url,
      });
      restoredCount += 1;
    } else {
      const createdFolder = await bookmarksApi.create({
        parentId,
        title: node.title,
      });
      if (node.children && node.children.length > 0) {
        restoredCount += await restoreChildren(createdFolder.id, node.children, bookmarksApi);
      }
    }
  }

  return restoredCount;
}

/**
 * Restores Chrome bookmarks to the exact hierarchy captured in a backup snapshot.
 * Root folders (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks) cannot be deleted
 * in Chrome, so their children are cleared and recreated in index order.
 */
export async function revertToBackup(
  backupId: string,
  bookmarksApi: BookmarksAPI,
  storageApi: StorageAPI
): Promise<{ restoredBookmarks: number }> {
  const backups = await listBackups(storageApi);
  const snapshot = backups.find((b) => b.id === backupId);
  if (!snapshot) {
    throw new Error(`Backup snapshot "${backupId}" not found.`);
  }

  const snapshotRoot = snapshot.tree[0];
  if (!snapshotRoot?.children) {
    throw new Error('Backup snapshot has an invalid bookmark tree structure.');
  }

  const currentTree = await bookmarksApi.getTree();
  const currentRoots = currentTree[0]?.children ?? [];
  const currentRootIds = new Set(currentRoots.map((r) => r.id));

  let restoredBookmarks = 0;

  for (const snapFolder of snapshotRoot.children) {
    // Match root folder by id (e.g. '1' Bookmarks Bar, '2' Other Bookmarks, '3' Mobile)
    // or fallback to matching by title if ids differ across profiles.
    const targetRoot = currentRootIds.has(snapFolder.id)
      ? currentRoots.find((r) => r.id === snapFolder.id)
      : currentRoots.find((r) => r.title === snapFolder.title);

    if (!targetRoot) continue;

    await clearFolderChildren(targetRoot.id, bookmarksApi);
    if (snapFolder.children && snapFolder.children.length > 0) {
      restoredBookmarks += await restoreChildren(targetRoot.id, snapFolder.children, bookmarksApi);
    }
  }

  const lastId = await getLastOrganizeBackupId(storageApi);
  if (lastId === backupId) {
    await setLastOrganizeBackupId(null, storageApi);
  }

  return { restoredBookmarks };
}

