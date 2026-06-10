/**
 * 搜索结果组件
 * 展示搜索结果列表，支持快速选择和复用
 */

import React, { useState, useCallback } from 'react';
import { FileText, FlaskConical, Leaf, Dna, Lightbulb, Clock, Tag, ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import type { SearchResultItem, SearchResultType } from '@/types/search.types';
import { clsx } from 'clsx';

// 类型图标配置
const TYPE_ICON_CONFIG: Record<SearchResultType, { icon: React.ReactNode; color: string }> = {
  formula: { icon: <FileText className="w-5 h-5" />, color: 'bg-blue-100 text-blue-600' },
  experiment: { icon: <FlaskConical className="w-5 h-5" />, color: 'bg-purple-100 text-purple-600' },
  herb: { icon: <Leaf className="w-5 h-5" />, color: 'bg-green-100 text-green-600' },
  peptide: { icon: <Dna className="w-5 h-5" />, color: 'bg-orange-100 text-orange-600' },
  knowledge: { icon: <Lightbulb className="w-5 h-5" />, color: 'bg-pink-100 text-pink-600' },
};

// 类型标签配置
const TYPE_LABEL_CONFIG: Record<SearchResultType, { label: string; color: string }> = {
  formula: { label: '配方', color: 'bg-blue-500' },
  experiment: { label: '实验', color: 'bg-purple-500' },
  herb: { label: '中药', color: 'bg-green-500' },
  peptide: { label: '肽', color: 'bg-orange-500' },
  knowledge: { label: '知识', color: 'bg-pink-500' },
};

interface SearchResultsProps {
  results: SearchResultItem[];
  loading?: boolean;
  error?: string;
  query?: string;
  total?: number;
  onSelect: (item: SearchResultItem) => void;
  onQuickReuse?: (item: SearchResultItem) => void;
  onCopy?: (item: SearchResultItem) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  error,
  query,
  total,
  onSelect,
  onQuickReuse,
  onCopy,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string | number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  // 切换选择状态
  const toggleSelect = useCallback(
    (item: SearchResultItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    },
    [],
  );

  // 选择全部
  const selectAll = useCallback(() => {
    if (selectedItems.size === results.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(results.map((r) => r.id)));
    }
  }, [selectedItems.size, results]);

  // 处理复制
  const handleCopy = useCallback(
    (item: SearchResultItem, e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.title);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
      if (onCopy) {
        onCopy(item);
      }
    },
    [onCopy],
  );

  // 处理快速复用
  const handleQuickReuse = useCallback(
    (item: SearchResultItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onQuickReuse) {
        onQuickReuse(item);
      }
    },
    [onQuickReuse],
  );

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 渲染空状态
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-500">
        <div className="text-4xl mb-4">Error</div>
        <p>{error}</p>
      </div>
    );
  }

  // 渲染无结果状态
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="text-4xl mb-4">No results</div>
        <p>未找到与"{query}"相关的内容</p>
        <p className="text-sm mt-2">请尝试其他关键词或调整筛选条件</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 结果统计和选择控制 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          找到 <span className="font-semibold text-gray-800">{total || results.length}</span> 个结果
          {query && <span className="ml-2">关于 "{query}"</span>}
        </div>
        {results.length > 1 && (
          <button
            onClick={selectAll}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            {selectedItems.size === results.length ? '取消全选' : '全选'}
          </button>
        )}
      </div>

      {/* 结果列表 */}
      <div className="space-y-3">
        {results.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={clsx(
              'group relative flex items-start gap-4 p-4 bg-white border rounded-xl cursor-pointer transition-all duration-200',
              'hover:shadow-md hover:border-blue-200',
              selectedItems.has(item.id) && 'ring-2 ring-blue-500 border-blue-500',
            )}
          >
            {/* 选择复选框 */}
            {results.length > 1 && (
              <button
                onClick={(e) => toggleSelect(item, e)}
                className={clsx(
                  'mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  selectedItems.has(item.id)
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-300 hover:border-blue-400',
                )}
              >
                {selectedItems.has(item.id) && <Check className="w-3 h-3" />}
              </button>
            )}

            {/* 类型图标 */}
            <div className={clsx('flex-shrink-0 p-2 rounded-lg', TYPE_ICON_CONFIG[item.type].color)}>
              {TYPE_ICON_CONFIG[item.type].icon}
            </div>

            {/* 内容区域 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                  {item.title}
                </h3>
                <span className={clsx('flex-shrink-0 px-2 py-0.5 text-xs text-white rounded-full', TYPE_LABEL_CONFIG[item.type].color)}>
                  {TYPE_LABEL_CONFIG[item.type].label}
                </span>
              </div>

              {item.subtitle && (
                <p className="text-sm text-gray-500 mb-2 truncate">{item.subtitle}</p>
              )}

              {item.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>
              )}

              {/* 标签和日期 */}
              <div className="flex flex-wrap items-center gap-2">
                {item.tags.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Tag className="w-3 h-3" />
                    </div>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-xs text-gray-400">+{item.tags.length - 3}</span>
                    )}
                  </>
                )}

                <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                  <Clock className="w-3 h-3" />
                  {formatDate(item.createdAt)}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {onQuickReuse && (
                <button
                  onClick={(e) => handleQuickReuse(item, e)}
                  className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="快速复用"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              {onCopy && (
                <button
                  onClick={(e) => handleCopy(item, e)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    copiedId === item.id
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50',
                  )}
                  title={copiedId === item.id ? '已复制' : '复制标题'}
                >
                  {copiedId === item.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="查看详情"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* 相关性指示器 */}
            {item.relevance !== undefined && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(item.relevance || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{Math.round((item.relevance || 0) * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 批量操作提示 */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <span className="text-sm text-gray-600">
            已选择 <span className="font-semibold">{selectedItems.size}</span> 项
          </span>
          {onQuickReuse && (
            <button
              onClick={() => {
                const selected = results.filter((r) => selectedItems.has(r.id));
                selected.forEach((item) => onQuickReuse(item));
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              批量复用
            </button>
          )}
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消选择
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
