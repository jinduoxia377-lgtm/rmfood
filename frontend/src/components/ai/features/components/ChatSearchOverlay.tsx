/**
 * ChatSearchOverlay — 聊天消息搜索浮层
 *
 * 功能：
 * - 在消息列表中实时搜索关键词
 * - 高亮匹配文本
 * - 跳转到匹配位置
 * - 显示匹配数量
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'

export interface SearchHighlight {
  text: string
  matchIndex: number
  matchLength: number
}

interface ChatSearchOverlayProps {
  messages: Array<{ id: string; content: string; role: string }>
  onGoToMessage?: (messageId: string) => void
  onClose?: () => void
}

/**
 * 在文本中找到所有匹配项
 */
function findAllMatches(text: string, query: string): Array<{ start: number; end: number }> {
  if (!query || text.length === 0) return []
  const results: Array<{ start: number; end: number }> = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let idx = 0
  while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
    results.push({ start: idx, end: idx + query.length })
    idx += query.length
  }
  return results
}

/**
 * 将文本按匹配位置分割为片段
 */
function splitByText(text: string, matches: Array<{ start: number; end: number }>): Array<{
  text: string
  isMatch: boolean
  matchIndex?: number
}> {
  if (matches.length === 0) return [{ text, isMatch: false }]

  const segments: Array<{ text: string; isMatch: boolean; matchIndex?: number }> = []
  let lastEnd = 0

  for (let i = 0; i < matches.length; i++) {
    const { start, end } = matches[i]
    if (start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, start), isMatch: false })
    }
    segments.push({ text: text.slice(start, end), isMatch: true, matchIndex: i })
    lastEnd = end
  }

  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), isMatch: false })
  }

  return segments
}

/** 高亮匹配的文本片段 */
function HighlightedText({ text, matches }: { text: string; matches: Array<{ start: number; end: number }> }) {
  const segments = splitByText(text, matches)
  return (
    <span>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit rounded px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}

export function ChatSearchOverlay({ messages, onGoToMessage, onClose }: ChatSearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ messageId: string; text: string; matchCount: number; snippet: string }>>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // 搜索
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setCurrentResultIndex(-1)
      return
    }

    const matches: Array<{ messageId: string; text: string; matchCount: number; snippet: string }> = []
    for (const msg of messages) {
      const found = findAllMatches(msg.content, query)
      if (found.length > 0) {
        // 取包含匹配点的片段（前后各50字符）
        const firstMatch = found[0]
        const snippetStart = Math.max(0, firstMatch.start - 50)
        const snippetEnd = Math.min(msg.content.length, firstMatch.end + 50)
        let snippet = msg.content.slice(snippetStart, snippetEnd)
        if (snippetStart > 0) snippet = '...' + snippet
        if (snippetEnd < msg.content.length) snippet += '...'

        matches.push({
          messageId: msg.id,
          text: msg.content,
          matchCount: found.length,
          snippet,
        })
      }
    }

    setResults(matches)
    setCurrentResultIndex(-1)
  }, [query, messages])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCurrentResultIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCurrentResultIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && currentResultIndex >= 0) {
      e.preventDefault()
      onGoToMessage?.(results[currentResultIndex].messageId)
    }
  }, [results, currentResultIndex, onGoToMessage])

  if (!onClose) return null

  return (
    <div className="fixed top-16 right-4 z-40 w-80 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl
      border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-fade-in">

      {/* 搜索栏 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
        <Search className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索消息内容..."
          className="flex-1 text-xs bg-transparent text-neutral-700 dark:text-neutral-300
            placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:outline-none"
          autoFocus
        />
        <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>

      {/* 结果列表 */}
      <div className="max-h-72 overflow-y-auto">
        {query.trim() && results.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
            未找到匹配消息
          </div>
        ) : query.trim() && results.length > 0 ? (
          <div>
            <div className="px-3 py-1.5 text-[10px] text-neutral-400 dark:text-neutral-500
              bg-neutral-50 dark:bg-neutral-800/50 sticky top-0">
              找到 {results.length} 条消息 · 共 {results.reduce((s, r) => s + r.matchCount, 0)} 处匹配
              <span className="ml-2">(↑↓ 导航，Enter 跳转)</span>
            </div>
            {results.map((result, i) => (
              <button
                key={result.messageId}
                onClick={() => onGoToMessage?.(result.messageId)}
                onMouseEnter={() => setCurrentResultIndex(i)}
                className={`w-full text-left px-3 py-2.5 border-b border-neutral-50 dark:border-neutral-800/50
                  hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors ${
                    currentResultIndex === i ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                  }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    result.matchCount > 3
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : result.matchCount > 1
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}>
                    {result.matchCount} 次匹配
                  </span>
                  {currentResultIndex === i && (
                    <ChevronDown className="w-3 h-3 text-primary-500" />
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                  <HighlightedText text={result.snippet} matches={[{ start: 0, end: result.snippet.length }]} />
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-neutral-300 dark:text-neutral-600">
            输入关键词开始搜索
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatSearchOverlay
