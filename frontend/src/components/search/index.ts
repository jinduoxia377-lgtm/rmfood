/**
 * 搜索组件索引文件
 *
 * 导出搜索相关的组件和服务
 */

export { SearchBar } from './SearchBar';
export { SearchResults } from './SearchResults';
export { searchService, SearchService } from '@/services/searchService';

// 类型导出
export type {
  SearchResultType,
  SearchResultItem,
  SearchFilters,
  SearchContext,
  SearchHistoryItem,
  SearchSuggestion,
  SearchConfig,
  SearchIndexConfig,
} from '@/types/search.types';
