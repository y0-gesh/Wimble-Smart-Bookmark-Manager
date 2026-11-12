import { describe, expect, it } from 'vitest';
import {
  countPortableNodes,
  exportToJson,
  exportToNetscapeHtml,
  parseJsonBookmarks,
  parseNetscapeHtml,
} from '../src/core/importExport';
import type { SerializedBookmarkNode } from '../src/core/types';

const sampleTree: SerializedBookmarkNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '10',
            title: 'Dev',
            children: [
              { id: '11', title: 'GitHub', url: 'https://github.com', dateAdded: 1700000000000 },
              { id: '12', title: 'MDN & Docs', url: 'https://developer.mozilla.org', dateAdded: 1700000000000 },
            ],
          },
          { id: '13', title: 'Example', url: 'https://example.com', dateAdded: 1700000000000 },
        ],
      },
    ],
  },
];

describe('importExport', () => {
  it('exports and re-parses Netscape Bookmark HTML accurately', () => {
    const html = exportToNetscapeHtml(sampleTree);
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('MDN &amp; Docs');

    const parsed = parseNetscapeHtml(html);
    const counts = countPortableNodes(parsed);
    expect(counts.bookmarks).toBe(3);
    expect(counts.folders).toBe(2); // Bookmarks Bar + Dev

    const devFolder = parsed[0].children?.[0];
    expect(devFolder?.title).toBe('Dev');
    expect(devFolder?.children?.[1].title).toBe('MDN & Docs');
  });

  it('exports and re-parses JSON bookmarks accurately', () => {
    const json = exportToJson(sampleTree);
    const parsed = parseJsonBookmarks(json);
    const counts = countPortableNodes(parsed);
    expect(counts.bookmarks).toBe(3);
    expect(counts.folders).toBe(2);
  });

  it('throws on invalid Netscape HTML', () => {
    expect(() => parseNetscapeHtml('<div>not bookmarks</div>')).toThrow();
  });
});

