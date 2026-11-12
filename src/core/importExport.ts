import { createBackupSnapshot } from './backup';
import { serializeTree, type BookmarksAPI, type StorageAPI } from './chromeBookmarks';
import type { PortableBookmarkNode, SerializedBookmarkNode } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportToNetscapeHtml(tree: SerializedBookmarkNode[]): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  function renderNodes(nodes: SerializedBookmarkNode[], indent: string): void {
    for (const node of nodes) {
      const addDate = node.dateAdded ? Math.floor(node.dateAdded / 1000) : Math.floor(Date.now() / 1000);
      if (node.url) {
        lines.push(
          `${indent}<DT><A HREF="${escapeHtml(node.url)}" ADD_DATE="${addDate}">${escapeHtml(
            node.title || node.url
          )}</A>`
        );
      } else {
        lines.push(`${indent}<DT><H3 ADD_DATE="${addDate}">${escapeHtml(node.title || 'Folder')}</H3>`);
        lines.push(`${indent}<DL><p>`);
        if (node.children) {
          renderNodes(node.children, `${indent}    `);
        }
        lines.push(`${indent}</DL><p>`);
      }
    }
  }

  const rootChildren = tree[0]?.children ?? tree;
  renderNodes(rootChildren, '    ');
  lines.push('</DL><p>');

  return lines.join('\n');
}

export function parseNetscapeHtml(html: string): PortableBookmarkNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!rootDl) {
    throw new Error('Invalid Netscape Bookmark HTML: no <DL> list found.');
  }

  function parseDl(dl: Element): PortableBookmarkNode[] {
    const items: PortableBookmarkNode[] = [];
    const children = Array.from(dl.children);

    for (let i = 0; i < children.length; i += 1) {
      const el = children[i];
      if (el.tagName !== 'DT') continue;

      const anchor = el.querySelector(':scope > a');
      if (anchor) {
        const href = anchor.getAttribute('href')?.trim();
        if (href) {
          const addDateAttr = anchor.getAttribute('add_date');
          items.push({
            title: anchor.textContent?.trim() || href,
            url: href,
            addDate: addDateAttr ? Number(addDateAttr) * 1000 : undefined,
          });
        }
        continue;
      }

      const heading = el.querySelector(':scope > h3');
      if (heading) {
        // In Netscape HTML, <DL> can be a child of <DT> or the immediate next sibling of <DT>
        let nestedDl = el.querySelector(':scope > dl');
        if (!nestedDl && children[i + 1]?.tagName === 'DL') {
          nestedDl = children[i + 1];
        }
        items.push({
          title: heading.textContent?.trim() || 'Imported Folder',
          children: nestedDl ? parseDl(nestedDl) : [],
        });
      }
    }

    return items;
  }

  return parseDl(rootDl);
}

export interface JsonExportPayload {
  version: 1;
  exportedAt: string;
  bookmarks: PortableBookmarkNode[];
}

function toPortable(nodes: SerializedBookmarkNode[]): PortableBookmarkNode[] {
  return nodes.map((n) =>
    n.url
      ? { title: n.title, url: n.url, addDate: n.dateAdded }
      : { title: n.title, children: n.children ? toPortable(n.children) : [] }
  );
}

export function exportToJson(tree: SerializedBookmarkNode[]): string {
  const rootChildren = tree[0]?.children ?? tree;
  const payload: JsonExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: toPortable(rootChildren),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseJsonBookmarks(jsonText: string): PortableBookmarkNode[] {
  const parsed = JSON.parse(jsonText) as unknown;

  if (Array.isArray(parsed)) {
    return parsed as PortableBookmarkNode[];
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    'bookmarks' in parsed &&
    Array.isArray((parsed as { bookmarks: unknown }).bookmarks)
  ) {
    return (parsed as { bookmarks: PortableBookmarkNode[] }).bookmarks;
  }

  throw new Error('Invalid JSON bookmark format: expected an array or { bookmarks: [...] }.');
}

export function countPortableNodes(nodes: PortableBookmarkNode[]): {
  bookmarks: number;
  folders: number;
} {
  let bookmarks = 0;
  let folders = 0;

  function walk(list: PortableBookmarkNode[]): void {
    for (const node of list) {
      if (node.url) {
        bookmarks += 1;
      } else {
        folders += 1;
        if (node.children) walk(node.children);
      }
    }
  }

  walk(nodes);
  return { bookmarks, folders };
}

export async function importBookmarksIntoChrome(
  nodes: PortableBookmarkNode[],
  options: { targetRootId: string; folderName?: string },
  bookmarksApi: BookmarksAPI,
  storageApi: StorageAPI
): Promise<{ backupId: string; importedCount: number }> {
  const backup = await createBackupSnapshot('Before Import', bookmarksApi, storageApi);

  let parentId = options.targetRootId;
  if (options.folderName?.trim()) {
    const created = await bookmarksApi.create({
      parentId: options.targetRootId,
      title: options.folderName.trim(),
    });
    parentId = created.id;
  }

  let importedCount = 0;

  async function insertNodes(targetParentId: string, list: PortableBookmarkNode[]): Promise<void> {
    for (const node of list) {
      if (node.url) {
        await bookmarksApi.create({
          parentId: targetParentId,
          title: node.title || node.url,
          url: node.url,
        });
        importedCount += 1;
      } else {
        const folder = await bookmarksApi.create({
          parentId: targetParentId,
          title: node.title || 'Folder',
        });
        if (node.children && node.children.length > 0) {
          await insertNodes(folder.id, node.children);
        }
      }
    }
  }

  await insertNodes(parentId, nodes);

  return { backupId: backup.id, importedCount };
}

export async function buildCurrentExportTree(bookmarksApi: BookmarksAPI): Promise<SerializedBookmarkNode[]> {
  const tree = await bookmarksApi.getTree();
  return serializeTree(tree);
}

