import type { StorageAPI } from './chromeBookmarks';
import type { FlatBookmark, ScanMetadata } from './types';

const SCAN_CACHE_KEY = 'bookmark_scan_cache';
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function isScannableUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getMetaContent(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const content = el?.getAttribute('content')?.trim();
    if (content) return content;
  }
  return '';
}

export function extractMetadataFromHtml(
  html: string,
  url: string
): Omit<ScanMetadata, 'url' | 'status' | 'scannedAt'> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const pageTitle =
    getMetaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    doc.querySelector('title')?.textContent?.trim() ||
    '';

  const description = getMetaContent(doc, [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]);

  const keywords = getMetaContent(doc, ['meta[name="keywords"]']);
  const siteName = getMetaContent(doc, ['meta[property="og:site_name"]']);

  const headingTexts: string[] = [];
  doc.querySelectorAll('h1, h2').forEach((el) => {
    const text = el.textContent?.replace(/\s+/g, ' ').trim();
    if (text && headingTexts.length < 5) {
      headingTexts.push(text.slice(0, 120));
    }
  });

  return {
    pageTitle: pageTitle.slice(0, 300),
    description: description.slice(0, 600),
    keywords: keywords.slice(0, 300),
    siteName: siteName.slice(0, 120) || new URL(url).hostname,
    headings: headingTexts.join(' | ').slice(0, 500),
  };
}

export async function scanSingleUrl(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ScanMetadata> {
  if (!isScannableUrl(url)) {
    return {
      url,
      status: 'skipped',
      scannedAt: Date.now(),
      errorMessage: 'Non-HTTP(S) URL',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        url,
        status: 'http_error',
        httpStatus: response.status,
        scannedAt: Date.now(),
        errorMessage: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        url,
        status: 'success',
        httpStatus: response.status,
        pageTitle: url.split('/').pop() || url,
        description: `Resource (${contentType || 'binary'})`,
        scannedAt: Date.now(),
      };
    }

    // Read only up to ~200KB to keep memory/time bounded on huge pages
    const text = (await response.text()).slice(0, 200_000);
    const meta = extractMetadataFromHtml(text, url);

    return {
      url,
      status: 'success',
      httpStatus: response.status,
      ...meta,
      scannedAt: Date.now(),
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      url,
      status: isAbort ? 'timeout' : 'network_error',
      scannedAt: Date.now(),
      errorMessage: isAbort ? 'Request timed out' : err instanceof Error ? err.message : 'Fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadScanCache(storageApi: StorageAPI): Promise<Record<string, ScanMetadata>> {
  const data = await storageApi.get<{ [SCAN_CACHE_KEY]?: Record<string, ScanMetadata> }>(
    SCAN_CACHE_KEY
  );
  return data[SCAN_CACHE_KEY] ?? {};
}

export async function saveScanCache(
  cache: Record<string, ScanMetadata>,
  storageApi: StorageAPI
): Promise<void> {
  await storageApi.set({ [SCAN_CACHE_KEY]: cache });
}

export interface ScanBookmarksOptions {
  concurrency?: number;
  timeoutMs?: number;
  forceRescan?: boolean;
  storageApi?: StorageAPI;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number, latest: ScanMetadata) => void;
}

export async function scanBookmarks(
  bookmarks: FlatBookmark[],
  options: ScanBookmarksOptions = {}
): Promise<Record<string, ScanMetadata>> {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    forceRescan = false,
    storageApi,
    signal,
    onProgress,
  } = options;

  const cache: Record<string, ScanMetadata> = storageApi ? await loadScanCache(storageApi) : {};
  const uniqueUrls = Array.from(new Set(bookmarks.map((b) => b.url)));
  const now = Date.now();

  const toScan: string[] = [];
  for (const url of uniqueUrls) {
    const cached = cache[url];
    const isFresh = cached && now - cached.scannedAt < CACHE_TTL_MS && cached.status === 'success';
    if (!forceRescan && isFresh) {
      continue;
    }
    toScan.push(url);
  }

  let completed = uniqueUrls.length - toScan.length;
  const total = uniqueUrls.length;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < toScan.length) {
      if (signal?.aborted) return;
      const idx = cursor++;
      const url = toScan[idx];
      const result = await scanSingleUrl(url, timeoutMs);
      cache[url] = result;
      completed += 1;
      onProgress?.(completed, total, result);
    }
  }

  const workerCount = Math.min(concurrency, Math.max(1, toScan.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (storageApi) {
    await saveScanCache(cache, storageApi);
  }

  return cache;
}

