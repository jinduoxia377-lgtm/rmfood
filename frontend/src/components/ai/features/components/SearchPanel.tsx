import React, { memo, useCallback, useRef, useEffect } from 'react'
import { Search, Loader2, X, Clock } from 'lucide-react'

export type SearchResultType = 'article' | 'research' | 'case' | 'faq'

export interface SearchResult {
  id: string
  title: string
  snippet: string
  type: SearchResultType
  relevance: number
}

interface SearchPanelProps {
  results: SearchResult[]
  isVisible: boolean
  isSearching: boolean
  onSelectResult: (result: SearchResult) => void
  onClose: () => void
}

const TYPE_CONFIG: Record<SearchResultType, { label: string; className: string }> = {
  article: {
    label: '文章',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  research: {
    label: '研究',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  case: {
    label: '案例',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  faq: {
    label: 'FAQ',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
}

function getRelevanceColor(relevance: number): string {
  const percentage = relevance * 100
  if (percentage > 90) return 'text-green-600 dark:text-green-400'
  if (percentage > 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getRelevanceLabel(relevance: number): string {
  return `相关度 ${Math.round(relevance * 100)}%`
}

const VIRTUALIZATION_THRESHOLD = 10

interface SearchResultItemProps {
  result: SearchResult
  index: number
  onSelect: (result: SearchResult) => void
  isSelected: boolean
}

const SearchResultItem = memo<SearchResultItemProps>(({ result, index: _index, onSelect, isSelected }) => {
  const handleClick = useCallback(() => {
    onSelect(result)
  }, [onSelect, result])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(result)
      }
    },
    [onSelect, result],
  )

  const typeConfig = TYPE_CONFIG[result.type] || TYPE_CONFIG.faq

  return (
    <button
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`w-full px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-0 
        hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150
        ${isSelected ? 'bg-primary-50 dark:bg-primary-900/10 border-l-4 border-l-primary-500' : 'border-l-4 border-l-transparent hover:border-l-primary-300'}
        focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-inset`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {result.title}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${typeConfig.className}`}>
              {typeConfig.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {result.snippet}
          </p>
        </div>
        <div className="flex-shrink-0 self-start pt-0.5">
          <div className={`flex items-center gap-1 text-xs font-medium ${getRelevanceColor(result.relevance)}`}>
            <Clock className="w-3 h-3" />
            <span>{getRelevanceLabel(result.relevance)}</span>
          </div>
        </div>
      </div>
    </button>
  )
})

SearchResultItem.displayName = 'SearchResultItem'

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <Search className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">未找到相关结果</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px]">
      请尝试修改搜索关键词，或使用更具体的描述来获取更好的搜索结果
    </p>
  </div>
))

EmptyState.displayName = 'EmptyState'

export const SearchPanel = memo<SearchPanelProps>(({
  results,
  isVisible,
  isSearching,
  onSelectResult,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible) {
      setSelectedIndex(-1)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < results.length - 1 ? prev + 1 : prev,
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            onSelectResult(results[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, results, selectedIndex, onSelectResult, onClose])

  useEffect(() => {
    if (selectedIndex >= 0 && containerRef.current) {
      const selectedElement = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!isVisible) return null

  const shouldVirtualize = results.length > VIRTUALIZATION_THRESHOLD
  const displayResults = shouldVirtualize ? results.slice(0, VIRTUALIZATION_THRESHOLD) : results

  return (
    <div
      ref={containerRef}
      id="smart-search-panel"
      role="listbox"
      aria-label="智能搜索结果"
      className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 mb-2
        bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200/80 dark:border-gray-700/80
        overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-150 max-h-96"
    >
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">智能搜索</span>
          {isSearching && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">搜索中...</span>
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </>
          )}
          {!isSearching && results.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              找到{results.length}个结果
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="关闭搜索"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {!isSearching && results.length === 0 ? (
          <EmptyState />
        ) : (
          displayResults.map((result, index) => (
            <SearchResultItem
              key={result.id}
              result={result}
              index={index}
              onSelect={onSelectResult}
              isSelected={index === selectedIndex}
            />
          ))
        )}

        {shouldVirtualize && (
          <div className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
            显示前 {VIRTUALIZATION_THRESHOLD} 条结果，共 {results.length} 条
          </div>
        )}
      </div>
    </div>
  )
})

SearchPanel.displayName = 'SearchPanel'
