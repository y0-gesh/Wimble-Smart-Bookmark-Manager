import { useState, type ChangeEvent } from 'react';
import { CheckCircle2, Download, FileCode2, FileJson, Upload } from 'lucide-react';
import { getChromeBookmarksApi, getChromeStorageApi } from '../../../core/chromeBookmarks';
import {
  buildCurrentExportTree,
  countPortableNodes,
  exportToJson,
  exportToNetscapeHtml,
  importBookmarksIntoChrome,
  parseJsonBookmarks,
  parseNetscapeHtml,
} from '../../../core/importExport';
import type { PortableBookmarkNode } from '../../../core/types';

interface ImportExportTabProps {
  rootFolders: Array<{ id: string; title: string }>;
  onImportComplete: () => Promise<void>;
}

const bookmarksApi = getChromeBookmarksApi();
const storageApi = getChromeStorageApi();

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportTab({ rootFolders, onImportComplete }: ImportExportTabProps) {
  const [parsedNodes, setParsedNodes] = useState<PortableBookmarkNode[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [targetRootId, setTargetRootId] = useState(rootFolders[0]?.id ?? '1');
  const [folderName, setFolderName] = useState(
    `Imported (${new Date().toISOString().slice(0, 10)})`
  );
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExportHtml() {
    const tree = await buildCurrentExportTree(bookmarksApi);
    const html = exportToNetscapeHtml(tree);
    triggerDownload(
      `bookmarks-${new Date().toISOString().slice(0, 10)}.html`,
      html,
      'text/html;charset=utf-8'
    );
  }

  async function handleExportJson() {
    const tree = await buildCurrentExportTree(bookmarksApi);
    const json = exportToJson(tree);
    triggerDownload(
      `bookmarks-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json;charset=utf-8'
    );
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const nodes = file.name.toLowerCase().endsWith('.json')
        ? parseJsonBookmarks(text)
        : parseNetscapeHtml(text);
      setParsedNodes(nodes);
      setFileName(file.name);
    } catch (err) {
      setParsedNodes(null);
      setError(err instanceof Error ? err.message : 'Failed to parse bookmark file.');
    }
  }

  async function handleImport() {
    if (!parsedNodes) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importBookmarksIntoChrome(
        parsedNodes,
        { targetRootId, folderName: folderName.trim() || undefined },
        bookmarksApi,
        storageApi
      );
      setMessage(
        `Imported ${res.importedCount} bookmarks! A pre-import backup was saved automatically.`
      );
      setParsedNodes(null);
      setFileName('');
      await onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  const previewCounts = parsedNodes ? countPortableNodes(parsedNodes) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Export Card */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-600" />
            Export Bookmarks
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Download your entire bookmark library in browser-standard HTML or structured JSON.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={handleExportHtml}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                <FileCode2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Netscape HTML (.html)</p>
                <p className="text-xs text-slate-500">
                  Compatible with Chrome, Firefox, Safari, and Edge
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={handleExportJson}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">JSON Backup (.json)</p>
                <p className="text-xs text-slate-500">
                  Clean structured tree for backups & tooling
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </section>

      {/* Import Card */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600" />
            Import Bookmarks
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Import from a Netscape HTML or JSON file. A backup is saved automatically first.
          </p>
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl bg-slate-50/60 cursor-pointer transition">
          <Upload className="w-6 h-6 text-slate-400 mb-2" />
          <span className="text-xs font-medium text-slate-700">
            {fileName ? `Selected: ${fileName}` : 'Click to choose .html or .json file'}
          </span>
          <input
            type="file"
            accept=".html,.htm,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {message && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {parsedNodes && previewCounts && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs text-slate-700">
              Ready to import <strong>{previewCounts.bookmarks}</strong> bookmarks across{' '}
              <strong>{previewCounts.folders}</strong> folders.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Destination Root
                </label>
                <select
                  value={targetRootId}
                  onChange={(e) => setTargetRootId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  {rootFolders.map((rf) => (
                    <option key={rf.id} value={rf.id}>
                      {rf.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Import Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {importing ? 'Backing up & Importing...' : 'Backup & Import Bookmarks'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

