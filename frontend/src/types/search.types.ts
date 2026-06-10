/**
 * 搜索系统类型定义
 */

// 搜索结果类型
export type SearchResultType = 'formula' | 'experiment' | 'herb' | 'peptide' | 'knowledge';

// 搜索结果项
export interface SearchResultItem {
  id: string | number;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  tags: string[];
  category?: string;
  createdAt: string;
  updatedAt?: string;
  relevance?: number;
  icon?: string;
  url?: string;
}

// 搜索筛选条件
export interface SearchFilters {
  keyword?: string;
  types?: SearchResultType[];
  tags?: string[];
  category?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: 'relevance' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// 搜索上下文
export interface SearchContext {
  query: string;
  filters: SearchFilters;
  results: SearchResultItem[];
  total: number;
  isLoading: boolean;
  error?: string;
}

// 搜索历史记录
export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  filters?: Partial<SearchFilters>;
  resultCount?: number;
}

// 快速搜索建议
export interface SearchSuggestion {
  id: string | number;
  text: string;
  hint?: string;
  type: SearchResultType;
  category?: string;
}

// 搜索配置
export interface SearchConfig {
  enabledTypes: SearchResultType[];
  defaultSortBy: 'relevance' | 'createdAt' | 'updatedAt';
  defaultSortOrder: 'asc' | 'desc';
  maxResults: number;
  minSearchLength: number;
  debounceDelay: number;
  fuzzyMatch: boolean;
}

// Fuse.js 搜索索引配置
export interface SearchIndexConfig {
  keys: string[];
  threshold?: number;
  distance?: number;
  includeScore?: boolean;
  includeMatches?: boolean;
  minMatchCharLength?: number;
}
