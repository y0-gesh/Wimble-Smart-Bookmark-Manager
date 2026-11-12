import { describe, expect, it } from 'vitest';
import { categorizeBookmark } from '../src/core/categorizer';
import type { FlatBookmark, ScanMetadata } from '../src/core/types';

function makeBookmark(overrides: Partial<FlatBookmark> = {}): FlatBookmark {
  return {
    id: '10',
    parentId: '1',
    index: 0,
    title: 'Example',
    url: 'https://example.com',
    domain: 'example.com',
    folderPath: 'Bookmarks Bar',
    ...overrides,
  };
}

describe('categorizeBookmark', () => {
  it('categorizes known domains directly', () => {
    const bm = makeBookmark({
      title: 'My Repo',
      url: 'https://github.com/user/repo',
      domain: 'github.com',
    });
    const res = categorizeBookmark(bm);
    expect(res.category).toBe('development');
    expect(res.reason).toContain('github.com');
  });

  it('categorizes by scanned metadata keywords when domain is unknown', () => {
    const bm = makeBookmark({
      title: 'Cool Blog Post',
      url: 'https://somecustomsite.io/post',
      domain: 'somecustomsite.io',
    });
    const scan: ScanMetadata = {
      url: bm.url,
      status: 'success',
      pageTitle: 'Building a Neural Network with PyTorch',
      description: 'A deep learning tutorial on transformer embeddings and LLM fine-tuning.',
      scannedAt: Date.now(),
    };
    const res = categorizeBookmark(bm, scan);
    expect(res.category).toBe('ai-data');
  });

  it('marks http_error / network_error as broken when groupBrokenLinks is true', () => {
    const bm = makeBookmark({ url: 'https://deadsite.example', domain: 'deadsite.example' });
    const scan: ScanMetadata = {
      url: bm.url,
      status: 'http_error',
      httpStatus: 404,
      errorMessage: 'HTTP 404',
      scannedAt: Date.now(),
    };
    const res = categorizeBookmark(bm, scan, { groupBrokenLinks: true });
    expect(res.category).toBe('broken');
  });

  it('falls back to uncategorized when no signals match', () => {
    const bm = makeBookmark({
      title: 'Xyzzy',
      url: 'https://xyzzy-unknown-site.org',
      domain: 'xyzzy-unknown-site.org',
    });
    const res = categorizeBookmark(bm);
    expect(res.category).toBe('uncategorized');
  });
});

