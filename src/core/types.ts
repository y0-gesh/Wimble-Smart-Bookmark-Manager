export type CategoryId =
  | 'development'
  | 'ai-data'
  | 'design'
  | 'productivity'
  | 'news-reading'
  | 'learning'
  | 'shopping'
  | 'finance'
  | 'media'
  | 'social'
  | 'broken'
  | 'uncategorized';

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  color: string;
}

export interface FlatBookmark {
  id: string;
  parentId: string;
  index: number;
  title: string;
  url: string;
  domain: string;
  folderPath: string;
  dateAdded?: number;
}

export type ScanStatus = 'pending' | 'success' | 'http_error' | 'timeout' | 'network_error' | 'skipped';

export interface ScanMetadata {
  url: string;
  status: ScanStatus;
  httpStatus?: number;
  pageTitle?: string;
  description?: string;
  keywords?: string;
  siteName?: string;
  headings?: string;
  scannedAt: number;
  errorMessage?: string;
}

export interface CategorizedBookmark {
  bookmark: FlatBookmark;
  scan?: ScanMetadata;
  category: CategoryId;
  reason: string;
}

export interface SerializedBookmarkNode {
  id: string;
  title: string;
  url?: string;
  index?: number;
  dateAdded?: number;
  children?: SerializedBookmarkNode[];
}

export interface BackupSnapshot {
  id: string;
  label: string;
  createdAt: number;
  bookmarkCount: number;
  folderCount: number;
  tree: SerializedBookmarkNode[];
}

export interface OrganizeOptions {
  targetRootId: string;
  containerFolderName?: string;
  removeEmptyFolders?: boolean;
}

export interface OrganizeResult {
  backupId: string;
  movedCount: number;
  foldersCreated: number;
  completedAt: number;
}

export interface PortableBookmarkNode {
  title: string;
  url?: string;
  addDate?: number;
  children?: PortableBookmarkNode[];
}

