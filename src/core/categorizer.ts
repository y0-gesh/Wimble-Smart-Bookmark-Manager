import type {
  CategorizedBookmark,
  CategoryDefinition,
  CategoryId,
  FlatBookmark,
  ScanMetadata,
} from './types';

export const CATEGORIES: CategoryDefinition[] = [
  { id: 'development', name: 'Development & Engineering', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'ai-data', name: 'AI & Data Science', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'design', name: 'Design & Creative', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'productivity', name: 'Productivity & Tools', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'learning', name: 'Learning & Reference', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'news-reading', name: 'News, Blogs & Reading', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'shopping', name: 'Shopping & Deals', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'finance', name: 'Finance & Business', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'media', name: 'Media & Entertainment', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'social', name: 'Social & Communities', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'broken', name: 'Broken / Unreachable', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'uncategorized', name: 'Uncategorized', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryDefinition> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, CategoryDefinition>;

const DOMAIN_RULES: Array<{ match: string[]; category: CategoryId }> = [
  {
    category: 'development',
    match: [
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
      'npmjs.com', 'pypi.org', 'crates.io', 'developer.mozilla.org', 'mdn.dev',
      'reactjs.org', 'react.dev', 'vuejs.org', 'typescriptlang.org', 'tailwindcss.com',
      'vite.dev', 'vitejs.dev', 'nextjs.org', 'vercel.com', 'netlify.com',
      'docker.com', 'kubernetes.io', 'aws.amazon.com', 'cloud.google.com', 'localhost',
    ],
  },
  {
    category: 'ai-data',
    match: [
      'huggingface.co', 'openai.com', 'anthropic.com', 'deepmind.google', 'kaggle.com',
      'arxiv.org', 'pytorch.org', 'tensorflow.org', 'langchain.com', 'perplexity.ai',
      'claude.ai', 'chatgpt.com', 'gemini.google.com',
    ],
  },
  {
    category: 'design',
    match: [
      'figma.com', 'dribbble.com', 'behance.net', 'canva.com', 'awwwards.com',
      'unsplash.com', 'pexels.com', 'lucide.dev', 'heroicons.com', 'fonts.google.com',
      'coolors.co', 'adobe.com',
    ],
  },
  {
    category: 'productivity',
    match: [
      'notion.so', 'notion.site', 'trello.com', 'asana.com', 'linear.app', 'jira.atlassian.com',
      'slack.com', 'zoom.us', 'calendar.google.com', 'drive.google.com', 'docs.google.com',
      'dropbox.com', 'airtable.com', 'miro.com', 'obsidian.md', 'todoist.com',
    ],
  },
  {
    category: 'learning',
    match: [
      'wikipedia.org', 'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
      'freecodecamp.org', 'codecademy.com', 'leetcode.com', 'hackerrank.com',
      'brilliant.org', 'w3schools.com', 'geeksforgeeks.org',
    ],
  },
  {
    category: 'news-reading',
    match: [
      'medium.com', 'substack.com', 'dev.to', 'hashnode.com', 'news.ycombinator.com',
      'nytimes.com', 'bbc.com', 'bbc.co.uk', 'theverge.com', 'techcrunch.com',
      'arstechnica.com', 'wired.com', 'reuters.com', 'bloomberg.com', 'smashingmagazine.com',
    ],
  },
  {
    category: 'shopping',
    match: [
      'amazon.com', 'amazon.in', 'amazon.co.uk', 'ebay.com', 'etsy.com', 'aliexpress.com',
      'flipkart.com', 'walmart.com', 'target.com', 'bestbuy.com', 'shopify.com',
    ],
  },
  {
    category: 'finance',
    match: [
      'stripe.com', 'paypal.com', 'wise.com', 'coinbase.com', 'binance.com',
      'yahoo.com/finance', 'finance.yahoo.com', 'investing.com', 'mint.intuit.com',
      'robinhood.com', 'zerodha.com', 'groww.in',
    ],
  },
  {
    category: 'media',
    match: [
      'youtube.com', 'youtu.be', 'netflix.com', 'spotify.com', 'twitch.tv',
      'vimeo.com', 'soundcloud.com', 'imdb.com', 'primevideo.com', 'disneyplus.com',
    ],
  },
  {
    category: 'social',
    match: [
      'x.com', 'twitter.com', 'reddit.com', 'linkedin.com', 'instagram.com',
      'facebook.com', 'threads.net', 'discord.com', 'mastodon.social', 'bsky.app',
    ],
  },
];

const KEYWORD_RULES: Record<Exclude<CategoryId, 'broken' | 'uncategorized'>, string[]> = {
  development: [
    'api', 'sdk', 'documentation', 'docs', 'repository', 'git', 'code', 'programming',
    'typescript', 'javascript', 'python', 'rust', 'golang', 'react', 'frontend', 'backend',
    'database', 'sql', 'devops', 'kubernetes', 'docker', 'cli', 'framework', 'library',
    'compiler', 'open source', 'software', 'developer', 'debugging', 'tutorial',
  ],
  'ai-data': [
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'llm', 'large language model', 'generative ai', 'transformer', 'dataset', 'nlp',
    'computer vision', 'pytorch', 'tensorflow', 'embeddings', 'rag', 'prompt', 'model',
  ],
  design: [
    'ui', 'ux', 'design system', 'wireframe', 'prototype', 'typography', 'color palette',
    'illustration', 'vector', 'svg', 'icons', 'branding', 'mockup', 'figma', 'css',
    'animation', 'layout', 'graphic design',
  ],
  productivity: [
    'workspace', 'task', 'project management', 'notes', 'calendar', 'workflow', 'automation',
    'kanban', 'checklist', 'spreadsheet', 'collaboration', 'meeting', 'schedule', 'crm',
  ],
  learning: [
    'course', 'learn', 'university', 'lecture', 'encyclopedia', 'study', 'certification',
    'curriculum', 'bootcamp', 'quiz', 'textbook', 'research paper', 'wiki', 'guide',
  ],
  'news-reading': [
    'news', 'article', 'blog', 'newsletter', 'opinion', 'journalism', 'magazine',
    'breaking', 'report', 'editorial', 'essay', 'podcast', 'release notes',
  ],
  shopping: [
    'buy', 'price', 'cart', 'checkout', 'shop', 'store', 'discount', 'deal', 'coupon',
    'shipping', 'product', 'wishlist', 'sale', 'order', 'marketplace',
  ],
  finance: [
    'bank', 'banking', 'invest', 'stock', 'portfolio', 'crypto', 'tax', 'accounting',
    'invoice', 'payment', 'budget', 'mortgage', 'loan', 'trading', 'market cap',
  ],
  media: [
    'video', 'watch', 'stream', 'movie', 'music', 'playlist', 'episode', 'trailer',
    'album', 'song', 'gaming', 'live stream', 'cinema', 'series',
  ],
  social: [
    'community', 'forum', 'thread', 'profile', 'followers', 'post', 'discussion',
    'network', 'chat', 'group', 'subreddit', 'social',
  ],
};

function matchesDomain(domain: string, pattern: string): boolean {
  return domain === pattern || domain.endsWith(`.${pattern}`);
}

export function categorizeBookmark(
  bookmark: FlatBookmark,
  scan?: ScanMetadata,
  options: { groupBrokenLinks?: boolean } = {}
): CategorizedBookmark {
  const { groupBrokenLinks = true } = options;

  if (
    groupBrokenLinks &&
    scan &&
    (scan.status === 'http_error' || scan.status === 'network_error')
  ) {
    return {
      bookmark,
      scan,
      category: 'broken',
      reason: scan.errorMessage || `Status: ${scan.status}`,
    };
  }

  // 1. Check high-confidence domain rules
  for (const rule of DOMAIN_RULES) {
    if (rule.match.some((pattern) => matchesDomain(bookmark.domain, pattern))) {
      return {
        bookmark,
        scan,
        category: rule.category,
        reason: `Domain match (${bookmark.domain})`,
      };
    }
  }

  // 2. Score based on scanned metadata + bookmark title + URL
  const corpus = [
    bookmark.title,
    bookmark.url,
    scan?.pageTitle ?? '',
    scan?.description ?? '',
    scan?.keywords ?? '',
    scan?.headings ?? '',
  ]
    .join(' ')
    .toLowerCase();

  let bestCategory: CategoryId = 'uncategorized';
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(KEYWORD_RULES) as Array<
    [Exclude<CategoryId, 'broken' | 'uncategorized'>, string[]]
  >) {
    let score = 0;
    const hits: string[] = [];

    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(corpus)) {
        score += kw.includes(' ') ? 2 : 1;
        hits.push(kw);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
      matchedKeywords = hits;
    }
  }

  if (bestCategory !== 'uncategorized' && bestScore >= 1) {
    return {
      bookmark,
      scan,
      category: bestCategory,
      reason: `Matched keywords: ${matchedKeywords.slice(0, 3).join(', ')}`,
    };
  }

  return {
    bookmark,
    scan,
    category: 'uncategorized',
    reason: 'No strong category signals found',
  };
}

export function categorizeAllBookmarks(
  bookmarks: FlatBookmark[],
  scanCache: Record<string, ScanMetadata>,
  options: { groupBrokenLinks?: boolean } = {}
): CategorizedBookmark[] {
  return bookmarks.map((bm) => categorizeBookmark(bm, scanCache[bm.url], options));
}

