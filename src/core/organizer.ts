import { createBackupSnapshot, setLastOrganizeBackupId } from './backup';
import { CATEGORY_MAP } from './categorizer';
import type { BookmarksAPI, StorageAPI } from './chromeBookmarks';
import type { CategorizedBookmark, CategoryId, OrganizeOptions, OrganizeResult } from './types';

async function findOrCreateFolder(
  parentId: string,
  title: string,
  bookmarksApi: BookmarksAPI
): Promise<{ id: string; created: boolean }> {
  const children = await bookmarksApi.getChildren(parentId);
  const existing = children.find((c) => !c.url && c.title === title);
  if (existing) {
    return { id: existing.id, created: false };
  }
  const created = await bookmarksApi.create({ parentId, title });
  return { id: created.id, created: true };
}

async function pruneEmptyFolders(
  rootIds: string[],
  protectedFolderIds: Set<string>,
  bookmarksApi: BookmarksAPI
): Promise<void> {
  async function walk(folderId: string, isRoot: boolean): Promise<boolean> {
    const children = await bookmarksApi.getChildren(folderId);
    let hasRemainingChild = false;

    for (const child of children) {
      if (child.url) {
        hasRemainingChild = true;
      } else {
        const childStillNonEmpty = await walk(child.id, false);
        if (childStillNonEmpty) {
          hasRemainingChild = true;
        }
      }
    }

    if (!isRoot && !hasRemainingChild && !protectedFolderIds.has(folderId)) {
      await bookmarksApi.removeTree(folderId);
      return false;
    }

    return hasRemainingChild;
  }

  for (const rootId of rootIds) {
    await walk(rootId, true);
  }
}

/**
 * Backs up the entire current bookmark tree, then organizes the provided
 * categorized bookmarks into category folders.
 */
export async function organizeBookmarks(
  items: CategorizedBookmark[],
  options: OrganizeOptions,
  bookmarksApi: BookmarksAPI,
  storageApi: StorageAPI
): Promise<OrganizeResult> {
  // 1. Always create a full backup snapshot before mutating Chrome bookmarks
  const backup = await createBackupSnapshot('Before Auto-Organize', bookmarksApi, storageApi);
  await setLastOrganizeBackupId(backup.id, storageApi);

  let destinationParentId = options.targetRootId;
  let foldersCreated = 0;
  const protectedFolderIds = new Set<string>();

  if (options.containerFolderName?.trim()) {
    const container = await findOrCreateFolder(
      options.targetRootId,
      options.containerFolderName.trim(),
      bookmarksApi
    );
    destinationParentId = container.id;
    protectedFolderIds.add(container.id);
    if (container.created) foldersCreated += 1;
  }

  // 2. Group items by category
  const grouped = new Map<CategoryId, CategorizedBookmark[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  let movedCount = 0;

  // 3. Create category folders and move bookmarks
  for (const [categoryId, groupItems] of grouped.entries()) {
    if (groupItems.length === 0) continue;

    const folderTitle = CATEGORY_MAP[categoryId]?.name ?? 'Uncategorized';
    const folder = await findOrCreateFolder(destinationParentId, folderTitle, bookmarksApi);
    protectedFolderIds.add(folder.id);
    if (folder.created) foldersCreated += 1;

    for (const item of groupItems) {
      if (item.bookmark.parentId !== folder.id) {
        await bookmarksApi.move(item.bookmark.id, { parentId: folder.id });
        movedCount += 1;
      }
    }
  }

  // 4. Optionally clean up empty folders left behind
  if (options.removeEmptyFolders) {
    const tree = await bookmarksApi.getTree();
    const rootIds = (tree[0]?.children ?? []).map((r) => r.id);
    await pruneEmptyFolders(rootIds, protectedFolderIds, bookmarksApi);
  }

  return {
    backupId: backup.id,
    movedCount,
    foldersCreated,
    completedAt: Date.now(),
  };
}

