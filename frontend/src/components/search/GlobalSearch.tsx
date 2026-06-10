/**
 * 全局搜索组件 (Global Search Bar)
 *
 * 功能:
 * - Command+K 快捷键唤起
 * - 实时搜索建议
 * - 最近搜索历史
 * - 跨类型结果展示
 * - 键盘导航
 * - 高亮匹配文本
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, X, Clock, Star, ArrowRight,
  FileText, FlaskConical, GitBranch, Users,
  TrendingUp, Filter, SlidersHorizontal,
  ChevronDown, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { Input, Button, Badge, Modal } from '@/components/ui'
import { logger } from '@/utils/safeLogger';


interface SearchResultItem {
  id: number
  type: string
  title: string
  description?: string
  url: string
  score?: number
}

interface SearchHistoryItem {
  keyword: string
  timestamp: Date
  count?: number
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, SearchResultItem[]>>({})
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeType, setActiveType] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // 快捷键: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 搜索逻辑
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({})
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        // 并行请求：建议 + 搜索结果
        const [suggestionsRes, searchRes] = await Promise.all([
          api.get(`/api/v1/search/suggestions?prefix=${encodeURIComponent(query)}&type=formula`).catch(() => ({ data: { suggestions: [] } })),
          api.get(`/api/v1/search/global?q=${encodeURIComponent(query)}&types=formula,experiment&page_size=5`).catch(() => ({ data: {} })),
        ])

        setSuggestions(suggestionsRes.data?.suggestions || [])

        if (searchRes.data?.types) {
          setResults(searchRes.data.types)
        }
      } catch (error) {
        logger.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // 加载搜索历史
  useEffect(() => {
    const saved = localStorage.getItem('rmfood_search_history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setHistory(parsed.slice(0, 10))
      } catch {}
    }
  }, [])

  // 保存搜索历史
  const saveToHistory = useCallback((keyword: string) => {
    const newHistory = [
      { keyword, timestamp: new Date() },
      ...history.filter(h => h.keyword !== keyword).slice(0, 19),
    ]
    setHistory(newHistory)
    localStorage.setItem('rmfood_search_history', JSON.stringify(newHistory))
  }, [history])

  const handleSelect = (item: SearchResultItem) => {
    saveToHistory(query)
    navigate(item.url)
    setIsOpen(false)
    setQuery('')
  }

  const handleHistoryClick = (keyword: string) => {
    setQuery(keyword)
    inputRef.current?.focus()
  }

  const totalResults = Object.values(results).reduce((sum, items) => sum + items.length, 0)

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg",
          "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700",
          "text-slate-500 dark:text-slate-400 text-sm transition-colors",
          "border border-slate-200 dark:border-slate-700",
        )}
      >
        <Search size={16} />
        <span className="hidden sm:inline">搜索...</span>
        <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-[10px] font-mono text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* 搜索弹窗 */}
      {isOpen && (
        <Modal open={isOpen} onClose={() => setIsOpen(false)} className="p-0 max-w-2xl" showClose={false}>
          <div className="flex flex-col h-[600px]">
            {/* 搜索输入框 */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
              <Search size={20} className="text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索配方、实验、原料..."
                className="flex-1 bg-transparent outline-none text-lg text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {(query || isSearching) && (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              <button onClick={() => { setIsOpen(false); setQuery('') }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto">
              {/* 无查询时显示历史和建议 */}
              {!query && (
                <div className="p-4 space-y-6">
                  {/* 最近搜索 */}
                  {history.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Clock size={12} /> 最近搜索
                      </h3>
                      <div className="space-y-1">
                        {history.slice(0, 8).map((item, i) => (
                          <button
                            key={i}
                            onClick={() => handleHistoryClick(item.keyword)}
                            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
                          >
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{item.keyword}</span>
                            <span className="ml-auto text-xs text-slate-400">{formatTimeAgo(item.timestamp)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 热门搜索 */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingUp size={12} /> 热门搜索
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {['降血糖配方', '抗氧化', '免疫调节', 'AI生成', 'TCMSP', '活性肽'].map((kw) => (
                        <button
                          key={kw}
                          onClick={() => handleHistoryClick(kw)}
                          className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 快捷键提示 */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400 text-center">
                      按 <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">↑↓</kbd> 导航 ·
                      <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">↵</kbd> 选择 ·
                      <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">Esc</kbd> 关闭
                    </p>
                  </div>
                </div>
              )}

              {/* 搜索结果 */}
              {query && (
                <div>
                  {/* 类型标签切换 */}
                  {totalResults > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                      <button
                        onClick={() => setActiveType(null)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                          !activeType ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        全部 ({totalResults})
                      </button>

                      {Object.entries(results).map(([type, items]) => (
                        <button
                          key={type}
                          onClick={() => setActiveType(activeType === type ? null : type)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                            activeType === type ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-500 hover:text-slate-700",
                          )}
                        >
                          {getTypeLabel(type)} ({items.length})
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 结果列表 */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Object.entries(results)
                      .filter(([type]) => !activeType || activeType === type)
                      .map(([type, items]) => (
                        <div key={type}>
                          {items.map((item) => (
                            <button
                              key={`${type}-${item.id}`}
                              onClick={() => handleSelect(item)}
                              className="flex items-start gap-3 w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors group"
                            >
                              <div className={cn(
                                "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                getTypeColor(type),
                              )}>
                                {getTypeIcon(type, 16)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                    {highlightText(item.title, query)}
                                  </h4>
                                  <Badge size="sm" variant="secondary">{getTypeLabel(type)}</Badge>
                                </div>

                                {item.description && (
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                    {highlightText(item.description.substring(0, 120), query)}
                                  </p>
                                )}
                              </div>

                              <ArrowRight size={16} className="mt-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      ))}

                    {/* 无结果 */}
                    {totalResults === 0 && !isSearching && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Search size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          未找到 "{query}" 的相关结果
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                          尝试使用不同的关键词或检查拼写
                        </p>

                        {suggestions.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-400 mb-2">建议搜索:</p>
                            {suggestions.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => setQuery(s)}
                                className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            {query && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                    <SlidersHorizontal size={14} /> 高级筛选
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                    <Filter size={14} /> 保存筛选
                  </button>
                </div>

                <div className="text-xs text-slate-400">
                  {isSearching ? '搜索中...' : `找到 ${totalResults} 条结果`}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

// ── 辅助函数 ──

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    formula: '配方',
    experiment: '实验',
    ingredient: '原料',
    workflow: '工作流',
    user: '用户',
  }
  return labels[type] || type
}

function getTypeIcon(type: string, size = 16) {
  const icons: Record<string, any> = {
    formula: <FileText size={size} />,
    experiment: <FlaskConical size={size} />,
    workflow: <GitBranch size={size} />,
    ingredient: <Zap size={size} />,
    user: <Users size={size} />,
  }
  return icons[type] || <FileText size={size} />
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    formula: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    experiment: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    workflow: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    ingredient: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    user: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  return colors[type] || 'bg-slate-100 text-slate-600'
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/40 text-inherit rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

export default GlobalSearch
