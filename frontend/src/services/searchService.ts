/**
 * 搜索服务 - 使用Fuse.js实现全文搜索
 *
 * 支持：
 * 1. 按时间检索
 * 2. 按主题筛选
 * 3. 按标签筛选
 * 4. 全文搜索（模糊匹配）
 * 5. 快速选择和复用
 */

import Fuse, { type IFuseOptions as FuseOptions } from 'fuse.js';
import type { SearchResultItem, SearchFilters, SearchHistoryItem, SearchSuggestion, SearchConfig } from '@/types/search.types';
import type { Formula, Experiment, TCMHerb, BioactivePeptide, KnowledgeNode } from '@/types';

// 默认搜索配置
const DEFAULT_CONFIG: SearchConfig = {
  enabledTypes: ['formula', 'experiment', 'herb', 'peptide', 'knowledge'],
  defaultSortBy: 'relevance',
  defaultSortOrder: 'desc',
  maxResults: 50,
  minSearchLength: 2,
  debounceDelay: 300,
  fuzzyMatch: true,
};

// Fuse.js 配置
const FUSE_OPTIONS: FuseOptions<SearchResultItem> = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  keys: ['title', 'subtitle', 'description', 'tags', 'category'],
};

// 存储搜索历史的键
const SEARCH_HISTORY_KEY = 'rmfood_search_history';
const MAX_HISTORY_SIZE = 20;

// 搜索索引缓存
let fuseIndex: Fuse<SearchResultItem> | null = null;
let indexedData: SearchResultItem[] = [];

export class SearchService {
  private config: SearchConfig;

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化搜索索引
   */
  initializeIndex(data: SearchResultItem[]): void {
    indexedData = data;
    fuseIndex = new Fuse(data, FUSE_OPTIONS);
  }

  /**
   * 从多种数据源构建搜索索引
   */
  buildIndexFromSources({
    formulas = [],
    experiments = [],
    herbs = [],
    peptides = [],
    knowledgeNodes = [],
  }: {
    formulas?: Formula[];
    experiments?: Experiment[];
    herbs?: TCMHerb[];
    peptides?: BioactivePeptide[];
    knowledgeNodes?: KnowledgeNode[];
  }): void {
    const items: SearchResultItem[] = [];

    // 配方
    formulas.forEach((f) => {
      items.push({
        id: f.id,
        type: 'formula',
        title: f.name,
        subtitle: f.description,
        description: f.description,
        tags: f.tags ?? [],
        category: f.category?.toString() || '',
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      });
    });

    // 实验
    experiments.forEach((e) => {
      items.push({
        id: e.id,
        type: 'experiment',
        title: e.title,
        subtitle: e.description,
        description: e.description,
        tags: [],
        category: e.type.toString(),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
    });

    // 中药
    herbs.forEach((h) => {
      items.push({
        id: h.id,
        type: 'herb',
        title: h.name,
        subtitle: h.latinName || h.pinyinName,
        description: h.efficacy,
        tags: [h.nature || '', h.meridian || ''].filter(Boolean),
        category: h.category || '',
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      });
    });

    // 肽
    peptides.forEach((p) => {
      items.push({
        id: p.id,
        type: 'peptide',
        title: p.sequence,
        subtitle: p.name || p.source,
        description: p.mechanismOfAction,
        tags: p.activityTypes || [],
        category: '',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    });

    // 知识节点
    knowledgeNodes.forEach((k) => {
      items.push({
        id: k.id,
        type: 'knowledge',
        title: k.title,
        subtitle: k.type,
        description: k.content,
        tags: k.tags || [],
        category: k.type,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      });
    });

    this.initializeIndex(items);
  }

  /**
   * 执行搜索
   */
  search(filters: SearchFilters): SearchResultItem[] {
    if (!fuseIndex) {
      return [];
    }

    let results: SearchResultItem[] = [];
    const { keyword, types, tags, category, dateRange, sortBy, sortOrder } = filters;

    // 如果有关键词，执行全文搜索
    if (keyword && keyword.length >= this.config.minSearchLength) {
      const fuseResults = fuseIndex.search(keyword);
      results = fuseResults.map((r) => ({
        ...r.item,
        relevance: r.score ? 1 - r.score : 1,
      }));
    } else if (!keyword) {
      // 没有关键词，返回所有数据
      results = [...indexedData];
    }

    // 按类型筛选
    if (types && types.length > 0) {
      results = results.filter((item) => types.includes(item.type));
    }

    // 按分类筛选
    if (category) {
      results = results.filter((item) => item.category === category);
    }

    // 按标签筛选
    if (tags && tags.length > 0) {
      results = results.filter((item) =>
        tags.some((tag) => item.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))),
      );
    }

    // 按时间范围筛选
    if (dateRange) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      results = results.filter((item) => {
        const createdAt = new Date(item.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }

    // 排序
    results = this.sortResults(results, sortBy || this.config.defaultSortBy, sortOrder || this.config.defaultSortOrder);

    // 限制数量
    return results.slice(0, this.config.maxResults);
  }

  /**
   * 排序结果
   */
  private sortResults(
    results: SearchResultItem[],
    sortBy: 'relevance' | 'createdAt' | 'updatedAt',
    sortOrder: 'asc' | 'desc',
  ): SearchResultItem[] {
    return [...results].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = (b.relevance || 0) - (a.relevance || 0);
          break;
        case 'createdAt':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'updatedAt': {
          const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = bUpdated - aUpdated;
          break;
        }
      }

      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }

  /**
   * 获取搜索建议
   */
  getSuggestions(query: string, limit = 8): SearchSuggestion[] {
    if (!fuseIndex || !query || query.length < 2) {
      return [];
    }

    const results = fuseIndex.search(query, { limit });
    const seen = new Set<string>();

    return results
      .filter((r) => {
        const key = `${r.item.type}-${r.item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        id: r.item.id,
        text: r.item.title,
        hint: r.item.subtitle,
        type: r.item.type,
        category: r.item.category,
      }))
      .slice(0, limit);
  }

  /**
   * 保存搜索历史
   */
  saveSearchHistory(query: string, filters?: Partial<SearchFilters>, resultCount?: number): void {
    const history = this.getSearchHistory();
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query,
      timestamp: new Date().toISOString(),
      filters,
      resultCount,
    };

    // 移除重复的查询
    const filtered = history.filter((h) => h.query !== query);
    filtered.unshift(newItem);

    // 限制历史记录数量
    const trimmed = filtered.slice(0, MAX_HISTORY_SIZE);

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
  }

  /**
   * 获取搜索历史
   */
  getSearchHistory(): SearchHistoryItem[] {
    try {
      const data = localStorage.getItem(SEARCH_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * 清除搜索历史
   */
  clearSearchHistory(): void {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }

  /**
   * 删除单条搜索历史
   */
  removeSearchHistory(id: string): void {
    const history = this.getSearchHistory();
    const filtered = history.filter((h) => h.id !== id);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  }

  /**
   * 获取热门搜索词
   */
  getPopularSearches(limit = 10): SearchHistoryItem[] {
    const history = this.getSearchHistory();

    // 统计搜索词频率
    const frequency: Record<string, { count: number; lastUsed: string; filters?: Partial<SearchFilters> }> = {};

    history.forEach((item) => {
      if (!frequency[item.query]) {
        frequency[item.query] = { count: 0, lastUsed: item.timestamp, filters: item.filters };
      }
      frequency[item.query].count++;
      if (item.timestamp > frequency[item.query].lastUsed) {
        frequency[item.query].lastUsed = item.timestamp;
      }
    });

    // 按频率和时间排序
    return Object.entries(frequency)
      .map(([query, data]) => ({
        id: data.lastUsed,
        query,
        timestamp: data.lastUsed,
        filters: data.filters,
        count: data.count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .map(({ count: _count, ...rest }) => { void _count; return rest; }) // 移除临时 count
      .slice(0, limit);
  }

  /**
   * 检查索引是否已初始化
   */
  isIndexReady(): boolean {
    return fuseIndex !== null;
  }

  /**
   * 获取索引数据统计
   */
  getIndexStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    indexedData.forEach((item) => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });

    return {
      total: indexedData.length,
      byType,
    };
  }
}

// 创建单例实例
export const searchService = new SearchService();

export default SearchService;
