import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Search, Trash2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP, categorizeBookmark } from '../../../core/categorizer';
import { findDuplicateBookmarkIds } from '../../../core/chromeBookmarks';
import type { CategoryId, FlatBookmark, ScanMetadata } from '../../../core/types';

interface BrowseTabProps {
  bookmarks: FlatBookmark[];
  scanCache: Record<string, ScanMetadata>;
  onDeleteBookmark: (id: string) => Promise<void>;
}

type SpecialFilter = 'all' | 'duplicates' | 'broken' | CategoryId;

export function BrowseTab({ bookmarks, scanCache, onDeleteBookmark }: BrowseTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SpecialFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const duplicateIds = useMemo(() => findDuplicateBookmarkIds(bookmarks), [bookmarks]);

  const categorized = useMemo(
    () =>
      bookmarks.map((bm) => ({
        item: categorizeBookmark(bm, scanCache[bm.url]),
        isDuplicate: duplicateIds.has(bm.id),
      })),
    [bookmarks, scanCache, duplicateIds]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: categorized.length,
      duplicates: 0,
    };
    for (const c of CATEGORIES) map[c.id] = 0;

    for (const entry of categorized) {
      map[entry.item.category] = (map[entry.item.category] ?? 0) + 1;
      if (entry.isDuplicate) map.duplicates += 1;
    }
    return map;
  }, [categorized]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categorized.filter(({ item, isDuplicate }) => {
      if (filter === 'duplicates' && !isDuplicate) return false;
      if (filter !== 'all' && filter !== 'duplicates' && item.category !== filter) return false;

      if (!q) return true;
      return (
        item.bookmark.title.toLowerCase().includes(q) ||
        item.bookmark.url.toLowerCase().includes(q) ||
        item.bookmark.domain.toLowerCase().includes(q) ||
        item.bookmark.folderPath.toLowerCase().includes(q) ||
        (item.scan?.pageTitle?.toLowerCase().includes(q) ?? false) ||
        (item.scan?.description?.toLowerCase().includes(q) ?? false) ||
        (item.scan?.keywords?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [categorized, filter, query]);

  async function handleCopy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, URL, domain, folder, or scanned website description..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg outline-none transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({counts.all})
          </button>

          {counts.duplicates > 0 && (
            <button
              onClick={() => setFilter('duplicates')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer ${
                filter === 'duplicates'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Duplicates ({counts.duplicates})
            </button>
          )}

          {CATEGORIES.filter((c) => counts[c.id] > 0).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer ${
                filter === cat.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name} ({counts[cat.id]})
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filtered.length}</strong> of{' '}
            {bookmarks.length} bookmarks
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-600">No bookmarks found</p>
            <p className="text-xs mt-1">Try adjusting your search query or category filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(({ item, isDuplicate }) => {
              const catDef = CATEGORY_MAP[item.category];
              return (
                <div
                  key={item.bookmark.id}
                  className="flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                        item.bookmark.domain
                      )}&sz=32`}
                      alt=""
                      className="w-5 h-5 mt-0.5 rounded bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={item.bookmark.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-slate-900 hover:text-indigo-600 truncate max-w-xl"
                        >
                          {item.bookmark.title}
                        </a>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${catDef.color}`}
                        >
                          {catDef.name}
                        </span>
                        {isDuplicate && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 font-medium">
                            Duplicate
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate mt-0.5">{item.bookmark.url}</p>

                      {item.scan?.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                          {item.scan.description}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 mt-1">
                        Folder: <span className="text-slate-600">{item.bookmark.folderPath}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={item.bookmark.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open URL"
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleCopy(item.bookmark.id, item.bookmark.url)}
                      title="Copy URL"
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    >
                      {copiedId === item.bookmark.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onDeleteBookmark(item.bookmark.id)}
                      title="Delete bookmark"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

