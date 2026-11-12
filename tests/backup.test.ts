import { describe, expect, it } from 'vitest';
import {
  createBackupSnapshot,
  getLastOrganizeBackupId,
  listBackups,
  revertToBackup,
} from '../src/core/backup';
import { flattenBookmarkTree, type BookmarksAPI, type StorageAPI } from '../src/core/chromeBookmarks';
import { organizeBookmarks } from '../src/core/organizer';
import { categorizeAllBookmarks } from '../src/core/categorizer';

function createInMemoryApis() {
  let nextId = 100;
  const nodes = new Map<string, chrome.bookmarks.BookmarkTreeNode>();

  const root: chrome.bookmarks.BookmarkTreeNode = { id: '0', title: '', children: [] };
  const bar: chrome.bookmarks.BookmarkTreeNode = { id: '1', parentId: '0', index: 0, title: 'Bookmarks Bar', children: [] };
  const other: chrome.bookmarks.BookmarkTreeNode = { id: '2', parentId: '0', index: 1, title: 'Other Bookmarks', children: [] };
  root.children = [bar, other];
  nodes.set('0', root);
  nodes.set('1', bar);
  nodes.set('2', other);

  const seed = (parentId: string, title: string, url?: string): chrome.bookmarks.BookmarkTreeNode => {
    const parent = nodes.get(parentId)!;
    const id = String(nextId++);
    const node: chrome.bookmarks.BookmarkTreeNode = {
      id,
      parentId,
      index: parent.children!.length,
      title,
      url,
      children: url ? undefined : [],
    };
    parent.children!.push(node);
    nodes.set(id, node);
    return node;
  };

  seed('1', 'GitHub', 'https://github.com');
  const misc = seed('1', 'Misc');
  seed(misc.id, 'Figma', 'https://figma.com');
  seed('2', 'YouTube', 'https://youtube.com');

  const reindex = (parent: chrome.bookmarks.BookmarkTreeNode) => {
    parent.children?.forEach((c, idx) => {
      c.index = idx;
    });
  };

  const cloneNode = (n: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode => ({
    ...n,
    children: n.children ? n.children.map(cloneNode) : undefined,
  });

  const bookmarksApi: BookmarksAPI = {
    async getTree() {
      return [cloneNode(root)];
    },
    async getChildren(id) {
      return (nodes.get(id)?.children ?? []).map(cloneNode);
    },
    async create(details) {
      return cloneNode(seed(details.parentId ?? '1', details.title ?? '', details.url));
    },
    async move(id, dest) {
      const node = nodes.get(id)!;
      const oldParent = nodes.get(node.parentId!)!;
      oldParent.children = oldParent.children!.filter((c) => c.id !== id);
      reindex(oldParent);

      const newParent = nodes.get(dest.parentId ?? node.parentId!)!;
      node.parentId = newParent.id;
      newParent.children!.push(node);
      reindex(newParent);
      return cloneNode(node);
    },
    async remove(id) {
      const node = nodes.get(id)!;
      const parent = nodes.get(node.parentId!)!;
      parent.children = parent.children!.filter((c) => c.id !== id);
      reindex(parent);
      nodes.delete(id);
    },
    async removeTree(id) {
      const node = nodes.get(id);
      if (!node) return;
      const parent = nodes.get(node.parentId!)!;
      parent.children = parent.children!.filter((c) => c.id !== id);
      reindex(parent);
      const del = (n: chrome.bookmarks.BookmarkTreeNode) => {
        n.children?.forEach(del);
        nodes.delete(n.id);
      };
      del(node);
    },
  };

  const store: Record<string, unknown> = {};
  const storageApi: StorageAPI = {
    async get<T = Record<string, unknown>>(keys: string | string[]) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of keyList) {
        if (k in store) out[k] = structuredClone(store[k]);
      }
      return out as T;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) {
        store[k] = structuredClone(v);
      }
    },
  };

  return { bookmarksApi, storageApi };
}

describe('backup, organize, and revert', () => {
  it('backs up before organizing and reverts to exact original structure', async () => {
    const { bookmarksApi, storageApi } = createInMemoryApis();

    const initialTree = await bookmarksApi.getTree();
    const initialFlat = flattenBookmarkTree(initialTree);
    expect(initialFlat).toHaveLength(3);

    const categorized = categorizeAllBookmarks(initialFlat, {});
    const result = await organizeBookmarks(
      categorized,
      { targetRootId: '1', containerFolderName: 'Organized', removeEmptyFolders: true },
      bookmarksApi,
      storageApi
    );

    expect(result.movedCount).toBe(3);
    const lastBackupId = await getLastOrganizeBackupId(storageApi);
    expect(lastBackupId).toBe(result.backupId);

    const afterOrganizeTree = await bookmarksApi.getTree();
    const afterOrganizeFlat = flattenBookmarkTree(afterOrganizeTree);
    expect(afterOrganizeFlat.every((b) => b.folderPath.includes('Organized'))).toBe(true);

    // Now revert
    const revertResult = await revertToBackup(result.backupId, bookmarksApi, storageApi);
    expect(revertResult.restoredBookmarks).toBe(3);
    expect(await getLastOrganizeBackupId(storageApi)).toBeNull();

    const revertedTree = await bookmarksApi.getTree();
    const revertedFlat = flattenBookmarkTree(revertedTree);
    expect(revertedFlat.map((b) => [b.title, b.url, b.folderPath])).toEqual(
      initialFlat.map((b) => [b.title, b.url, b.folderPath])
    );

    const backups = await listBackups(storageApi);
    expect(backups).toHaveLength(1);

    // Verify manual backup creation also works
    await createBackupSnapshot('Manual Snapshot', bookmarksApi, storageApi);
    expect(await listBackups(storageApi)).toHaveLength(2);
  });
});

