import type { FlatBookmark, SerializedBookmarkNode } from './types';

export interface BookmarksAPI {
  getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  create(bookmark: Parameters<typeof chrome.bookmarks.create>[0]): Promise<chrome.bookmarks.BookmarkTreeNode>;
  move(id: string, destination: { parentId?: string; index?: number }): Promise<chrome.bookmarks.BookmarkTreeNode>;
  removeTree(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface StorageAPI {
  get<T = Record<string, unknown>>(keys: string | string[]): Promise<T>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function getChromeBookmarksApi(): BookmarksAPI {
  return {
    getTree: () => chrome.bookmarks.getTree(),
    getChildren: (id) => chrome.bookmarks.getChildren(id),
    create: (details) => chrome.bookmarks.create(details),
    move: (id, dest) => chrome.bookmarks.move(id, dest),
    removeTree: (id) => chrome.bookmarks.removeTree(id),
    remove: (id) => chrome.bookmarks.remove(id),
  };
}

export function getChromeStorageApi(): StorageAPI {
  return {
    get: async <T = Record<string, unknown>>(keys: string | string[]) =>
      (await chrome.storage.local.get<Record<string, unknown>>(keys)) as T,
    set: (items) => chrome.storage.local.set(items),
  };
}

export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function flattenBookmarkTree(tree: chrome.bookmarks.BookmarkTreeNode[]): FlatBookmark[] {
  const result: FlatBookmark[] = [];

  function walk(node: chrome.bookmarks.BookmarkTreeNode, pathParts: string[]): void {
    if (node.url) {
      result.push({
        id: node.id,
        parentId: node.parentId ?? '0',
        index: node.index ?? 0,
        title: node.title || node.url,
        url: node.url,
        domain: extractDomain(node.url),
        folderPath: pathParts.join(' / ') || 'Root',
        dateAdded: node.dateAdded,
      });
      return;
    }

    const nextPath = node.id === '0' || !node.title ? pathParts : [...pathParts, node.title];
    for (const child of node.children ?? []) {
      walk(child, nextPath);
    }
  }

  for (const root of tree) {
    walk(root, []);
  }
  return result;
}

export function serializeTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): SerializedBookmarkNode[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    url: node.url,
    index: node.index,
    dateAdded: node.dateAdded,
    children: node.children ? serializeTree(node.children) : undefined,
  }));
}

export function countTreeItems(nodes: SerializedBookmarkNode[]): { bookmarks: number; folders: number } {
  let bookmarks = 0;
  let folders = 0;

  function walk(list: SerializedBookmarkNode[]): void {
    for (const node of list) {
      if (node.url) {
        bookmarks += 1;
      } else {
        if (node.id !== '0') folders += 1;
        if (node.children) walk(node.children);
      }
    }
  }

  walk(nodes);
  return { bookmarks, folders };
}

export function findDuplicateBookmarkIds(bookmarks: FlatBookmark[]): Set<string> {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const bm of bookmarks) {
    const normalized = bm.url.trim().replace(/\/+$/, '').toLowerCase();
    if (seen.has(normalized)) {
      duplicates.add(bm.id);
      duplicates.add(seen.get(normalized)!);
    } else {
      seen.set(normalized, bm.id);
    }
  }
  return duplicates;
}
