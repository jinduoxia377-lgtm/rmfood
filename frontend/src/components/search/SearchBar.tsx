/**
 * 搜索栏组件
 * 支持：按时间检索、按主题筛选、按标签筛选、全文搜索
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Search, X, Filter, Clock, Tag, FolderOpen, ChevronDown, History, TrendingUp, ArrowRight } from 'lucide-react';
import type { SearchFilters, SearchResultType, SearchSuggestion, SearchHistoryItem } from '@/types/search.types';
import { searchService } from '@/services/searchService';
import { clsx } from 'clsx';

// 搜索类型配置
const TYPE_CONFIG: Record<SearchResultType, { label: string; color: string }> = {
  formula: { label: '配方', color: 'bg-secondary-100 text-secondary-700' },
  experiment: { label: '实验', color: 'bg-accent-100 text-accent-700' },
  herb: { label: '中药', color: 'bg-success-100 text-success-700' },
  peptide: { label: '肽', color: 'bg-warning-100 text-warning-700' },
  knowledge: { label: '知识', color: 'bg-danger-100 text-danger-700' },
};

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onSelectResult?: (item: any) => void;
  className?: string;
  showFilters?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onSelectResult, className, showFilters = true }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [popularSearches, setPopularSearches] = useState<SearchHistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 筛选状态
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    tags: [],
    category: '',
    dateRange: undefined,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });

  // 日期范围选项
  const dateRangeOptions = [
    { label: '全部时间', value: 'all' },
    { label: '今天', value: 'today' },
    { label: '本周', value: 'week' },
    { label: '本月', value: 'month' },
    { label: '本季度', value: 'quarter' },
    { label: '本年', value: 'year' },
  ];

  const [selectedDateRange, setSelectedDateRange] = useState('all');

  // 加载历史记录和热门搜索
  useEffect(() => {
    setSearchHistory(searchService.getSearchHistory());
    setPopularSearches(searchService.getPopularSearches(5));
  }, []);

  // 防抖搜索建议
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        const results = searchService.getSuggestions(query, 8);
        setSuggestions(results);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      return;
    }
  }, [query]);

  // 执行搜索
  const handleSearch = useCallback(() => {
    if (!query.trim() && (filters.types ?? []).length === 0 && (filters.tags ?? []).length === 0 && !filters.dateRange) {
      return;
    }

    const searchFilters: SearchFilters = {
      keyword: query.trim() || undefined,
      types: (filters.types ?? []).length > 0 ? filters.types : undefined,
      tags: (filters.tags ?? []).length > 0 ? filters.tags : undefined,
      category: filters.category || undefined,
      dateRange: filters.dateRange,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    onSearch(searchFilters);
    searchService.saveSearchHistory(query, searchFilters);
    setShowSuggestions(false);
  }, [query, filters, onSearch]);

  // 点击建议项
  const handleSelectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);

    const searchFilters: SearchFilters = {
      keyword: suggestion.text,
      types: [suggestion.type],
    };

    onSearch(searchFilters);
    searchService.saveSearchHistory(suggestion.text, searchFilters);

    if (onSelectResult) {
      onSelectResult(suggestion);
    }
  }, [onSearch, onSelectResult]);

  // 点击历史记录
  const handleSelectHistory = useCallback((history: SearchHistoryItem) => {
    setQuery(history.query);
    setShowSuggestions(false);

    const searchFilters: SearchFilters = {
      keyword: history.query,
      ...history.filters,
    };

    onSearch(searchFilters);
  }, [onSearch]);

  // 清除输入
  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  }, []);

  // 切换类型筛选
  const toggleTypeFilter = useCallback((type: SearchResultType) => {
    setFilters((prev) => {
      const types = (prev.types ?? []).includes(type)
        ? (prev.types ?? []).filter((t) => t !== type)
        : [...(prev.types ?? []), type];
      return { ...prev, types };
    });
  }, []);

  // 添加标签
  const addTag = useCallback((tag: string) => {
    if (!(filters.tags ?? []).includes(tag)) {
      setFilters((prev) => ({ ...prev, tags: [...(prev.tags ?? []), tag] }));
    }
  }, [filters.tags]);

  // 移除标签
  const removeTag = useCallback((tag: string) => {
    setFilters((prev) => ({ ...prev, tags: (prev.tags ?? []).filter((t) => t !== tag) }));
  }, []);

  // 设置日期范围
  const handleDateRangeChange = useCallback((value: string) => {
    setSelectedDateRange(value);

    if (value === 'all') {
      setFilters((prev) => ({ ...prev, dateRange: undefined }));
      return;
    }

    const now = new Date();
    let startDate: Date;

    switch (value) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = now;
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      },
    }));
  }, []);

  // 清除所有筛选
  const clearFilters = useCallback(() => {
    setFilters({
      types: [],
      tags: [],
      category: '',
      dateRange: undefined,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
    setSelectedDateRange('all');
  }, []);

  // 是否有激活的筛选条件
  const hasActiveFilters = useMemo(() => {
    return (filters.types ?? []).length > 0 || (filters.tags ?? []).length > 0 || filters.dateRange || filters.category;
  }, [filters]);

  return (
    <div className={clsx('relative w-full', className)}>
      {/* 搜索输入框 */}
      <div
        className={clsx(
          'relative flex items-center gap-3 bg-white dark:bg-neutral-900 border rounded-lg shadow-sm transition-all duration-200',
          'focus-within:border-secondary-500 focus-within:ring-2 focus-within:ring-secondary-200',
          isFocused && 'shadow-md',
        )}
      >
        <div className="pl-4">
          <Search className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder="搜索配方、实验、中药、肽..."
          className="flex-1 py-3 bg-transparent border-none outline-none text-neutral-700 placeholder-neutral-400"
        />

        {query && (
          <button
            onClick={handleClear}
            className="p-1 mr-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={clsx(
              'px-4 py-2 mr-1 rounded-lg transition-colors',
              hasActiveFilters
                ? 'bg-secondary-container text-secondary-main'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            <Filter className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handleSearch}
          className="px-6 py-2 mr-1 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors"
        >
          搜索
        </button>
      </div>

      {/* 下拉面板 */}
      {isFocused && (showSuggestions || searchHistory.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* 搜索建议 */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">搜索建议</div>
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.type}-${suggestion.id}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:bg-neutral-800 transition-colors text-left"
                >
                  <span className={clsx('px-2 py-0.5 text-xs rounded-full', TYPE_CONFIG[suggestion.type].color)}>
                    {TYPE_CONFIG[suggestion.type].label}
                  </span>
                  <span className="flex-1 text-neutral-700">{suggestion.text}</span>
                  {suggestion.hint && (
                    <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{suggestion.hint}</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                </button>
              ))}
            </div>
          )}

          {/* 搜索历史 */}
          {(!query || suggestions.length === 0) && searchHistory.length > 0 && (
            <div className="p-2 border-t border-neutral-100">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <History className="w-3 h-3" />
                  搜索历史
                </div>
                <button
                  onClick={() => {
                    searchService.clearSearchHistory();
                    setSearchHistory([]);
                  }}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500"
                >
                  清除
                </button>
              </div>
              {searchHistory.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectHistory(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:bg-neutral-800 transition-colors text-left"
                >
                  <Search className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <span className="flex-1 text-neutral-700">{item.query}</span>
                </button>
              ))}
            </div>
          )}

          {/* 热门搜索 */}
          {(!query || suggestions.length === 0) && popularSearches.length > 0 && (
            <div className="p-2 border-t border-neutral-100">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <TrendingUp className="w-3 h-3" />
                热门搜索
              </div>
              {popularSearches.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectHistory(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:bg-neutral-800 transition-colors text-left"
                >
                  <TrendingUp className="w-4 h-4 text-warning-400" />
                  <span className="flex-1 text-neutral-700">{item.query}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 筛选面板 */}
      {showFilterPanel && (
        <div className="mt-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-neutral-700">筛选条件</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors"
              >
                清除全部筛选
              </button>
            )}
          </div>

          {/* 类型筛选 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-neutral-600">
              <FolderOpen className="w-4 h-4" />
              内容类型
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_CONFIG) as SearchResultType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    (filters.types ?? []).includes(type)
                      ? 'border-secondary-500 bg-secondary-container text-secondary-main'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700',
                  )}
                >
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-neutral-600">
              <Clock className="w-4 h-4" />
              时间范围
            </div>
            <div className="flex flex-wrap gap-2">
              {dateRangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDateRangeChange(option.value)}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    selectedDateRange === option.value
                      ? 'border-secondary-500 bg-secondary-container text-secondary-main'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标签筛选 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-neutral-600">
              <Tag className="w-4 h-4" />
              标签
            </div>
            {(filters.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(filters.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 bg-warning-100 text-warning-700 rounded-full text-sm"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-warning-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无标签筛选</div>
            )}
          </div>

          {/* 排序选项 */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-neutral-600">
              排序方式
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sortBy: e.target.value as SearchFilters['sortBy'] }))
                }
                className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-secondary-500"
              >
                <option value="relevance">相关性</option>
                <option value="createdAt">创建时间</option>
                <option value="updatedAt">更新时间</option>
              </select>
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc',
                  }))
                }
                className={clsx(
                  'px-3 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 transition-colors',
                )}
              >
                <ChevronDown className={clsx('w-4 h-4', filters.sortOrder === 'asc' && 'rotate-180')} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
