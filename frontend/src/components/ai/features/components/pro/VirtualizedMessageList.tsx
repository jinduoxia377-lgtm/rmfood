/**
 * VirtualizedMessageList — 虚拟滚动消息列表
 *
 * 当消息数量 > VIRTUAL_THRESHOLD 时自动启用虚拟滚动：
 * - 动态高度测量（每条消息根据内容计算预估高度）
 * - 窗口化渲染（可见区域 + 上下各 BUFFER_SIZE 条 buffer）
 * - absolute 定位 + transform translateY 实现精确定位
 * - 支持 scrollToIndex / scrollToBottom
 * - 与 ChatMessages 完全兼容的 props 接口
 */
import React, { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import {
  Bot, Copy, Check, RefreshCw, Trash2, FileText,
  ThumbsUp, ThumbsDown, ChevronDown, Clock,
  Pencil, Undo2, X, AlertTriangle,
} from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import TypewriterText from './TypewriterText'
import ThinkingProcess from './ThinkingProcess'
import { logger } from '@/utils/safeLogger'

// ===== 常量 =====
const VIRTUAL_THRESHOLD = 50
const BUFFER_SIZE = 2
const ESTIMATED_HEIGHT = 120 // 单条消息默认预估高度 px
const DATE_SEPARATOR_HEIGHT = 40
const SCROLL_DEBOUNCE_MS = 16

interface VirtualizedMessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  chatError: Error | null
  onRetry?: () => void
  onClear?: () => void
  onCopyMessage?: (content: string) => void
  onRegenerate?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onGenerateReport?: () => void
  showReportButton?: boolean
  highlightedMessageId?: string | null
  selectedMessageIds?: string[]
  onSelectMessage?: (id: string, multiSelect?: boolean) => void
  onReferenceMessage?: (msg: ChatMessage) => void
  searchQuery?: string
  thinkingSteps?: Array<{ step: string; content: string; status: string; detail?: string }>
  onEditMessage?: (id: string, newContent: string) => void
  onRetractMessage?: (id: string) => void
}

// ===== 辅助函数（与 ChatMessages 一致） =====
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return '今天'
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function isNewDay(ts1: number, ts2: number): boolean {
  return new Date(ts1).toDateString() !== new Date(ts2).toDateString()
}

type Reaction = 'like' | 'dislike' | null

/**
 * 根据消息内容估算高度（不含日期分隔线）
 */
function estimateMessageHeight(msg: ChatMessage): number {
  const baseHeight = 56 // 头像 + 基础间距
  const lineHeight = 22
  // 根据内容长度估算行数
  const contentLines = Math.ceil(msg.content.length / 50)
  const contentHeight = Math.min(contentLines * lineHeight, 600) // 上限 600px
  const actionBarHeight = msg.error || msg.isLoading || !msg.content || msg.isRetracted ? 0 : 28
  return baseHeight + contentHeight + actionBarHeight
}

// ===== Memoized 子组件：单条消息 =====
const MessageItem = memo(function MessageItem({
  msg,
  reaction,
  isHighlighted,
  isSelected,
  copiedId,
  editingId,
  editContent,
  thinkingSteps,
  isStreaming,
  isLastMsg,
  onCopy,
  onReaction,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onRetry,
  onRegenerate,
  onDeleteMessage,
  onReferenceMessage,
  onEditMessage,
  onRetractMessage,
  disableAnimations,
}: {
  msg: ChatMessage
  reaction: Reaction
  isHighlighted: boolean
  isSelected: boolean
  copiedId: string | null
  editingId: string | null
  editContent: string
  thinkingSteps?: Array<{ step: string; content: string; status: string; detail?: string }>
  isStreaming: boolean
  isLastMsg: boolean
  onCopy: (id: string, content: string) => void
  onReaction: (msgId: string, type: 'like' | 'dislike') => void
  onStartEdit: (msg: ChatMessage) => void
  onConfirmEdit: () => void
  onCancelEdit: () => void
  onRetry?: () => void
  onRegenerate?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onReferenceMessage?: (msg: ChatMessage) => void
  onEditMessage?: (id: string, newContent: string) => void
  onRetractMessage?: (id: string) => void
  disableAnimations: boolean
}) {
  return (
    <div className={`chat-message-row${msg.role === 'user' ? ' user-row' : ''}${isHighlighted ? ' chat-highlighted' : ''}`}>
      <div className={msg.role === 'user' ? 'avatar-user' : 'avatar-ai'}>
        {msg.role === 'user' ? 'U' : <Bot className="w-4 h-4" />}
      </div>
      <div className="chat-message-group">
        <div className="chat-timestamp">{formatTime(msg.timestamp)}</div>
        {msg.isRetracted ? (
          <div className="chat-bubble-retracted">
            <span>消息已撤回</span>
            {msg.retractedAt && <span className="ml-2">{formatTime(msg.retractedAt)}</span>}
          </div>
        ) : editingId === msg.id && msg.role === 'user' ? (
          <div className="chat-edit-overlay">
            <textarea
              value={editContent}
              onChange={(e) => {/* 由父组件控制 */}}
              className="w-full min-h-[60px] max-h-[200px] px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirmEdit() }
                if (e.key === 'Escape') onCancelEdit()
              }}
            />
            <div className="chat-edit-actions">
              <button onClick={onCancelEdit} className="cancel"><X className="w-3 h-3" /> 取消</button>
              <button onClick={onConfirmEdit} className="confirm"><Check className="w-3 h-3" /> 确认</button>
            </div>
          </div>
        ) : (
          <div className={`${msg.error ? 'chat-bubble-error' : msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
            {msg.error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" /><span>发送失败</span>
                </div>
                <p className="text-xs opacity-80">{msg.error}</p>
                {onRetry && (
                  <button onClick={onRetry} className="text-xs flex items-center gap-1 hover:underline">
                    <RefreshCw className="w-3 h-3" /> 重新发送
                  </button>
                )}
              </div>
            ) : msg.role === 'assistant' && msg.isLoading ? (
              <div className="chat-typing-indicator">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            ) : (
              <>
                {msg.role === 'assistant' && thinkingSteps && thinkingSteps.length > 0 && (
                  <div className="mb-2"><ThinkingProcess steps={thinkingSteps} isThinking={false} /></div>
                )}
                {msg.role === 'assistant' ? (
                  isLastMsg && !isStreaming ? (
                    <TypewriterText content={msg.content} speed={20} chunkSize={5} />
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )
                ) : (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                )}
              </>
            )}
          </div>
        )}
        {!msg.error && !msg.isLoading && msg.content && !msg.isRetracted && (
          <div className="chat-action-bar">
            {msg.role === 'user' && onEditMessage && (
              <button onClick={() => onStartEdit(msg)} className="chat-action-btn" title="编辑">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => onCopy(msg.id, msg.content)} className="chat-action-btn" title="复制">
              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onReferenceMessage && (
              <button onClick={() => onReferenceMessage(msg)} className="chat-action-btn" title="引用">
                <span className="text-xs font-bold">↑</span>
              </button>
            )}
            {msg.role === 'assistant' && (
              <>
                <button onClick={() => onReaction(msg.id, 'like')} className={`chat-action-btn ${reaction === 'like' ? 'text-blue-500' : ''}`} title="有用">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onReaction(msg.id, 'dislike')} className={`chat-action-btn ${reaction === 'dislike' ? 'text-red-500' : ''}`} title="没用">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {onRegenerate && (
                  <button onClick={() => onRegenerate(msg.id)} className="chat-action-btn" title="重新生成">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            {msg.role === 'user' && onRetractMessage && (
              <button onClick={() => onRetractMessage(msg.id)} className="chat-action-btn" title="撤回">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteMessage && !(msg.role === 'user' && onRetractMessage) && (
              <button onClick={() => onDeleteMessage(msg.id)} className="chat-action-btn" title="删除">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

// ===== 主组件 =====
export default function VirtualizedMessageList(props: VirtualizedMessageListProps) {
  const {
    messages, isStreaming, chatError, onRetry, onCopyMessage,
    onRegenerate, onDeleteMessage, onGenerateReport, showReportButton,
    highlightedMessageId, selectedMessageIds, onSelectMessage,
    onReferenceMessage, searchQuery, thinkingSteps,
    onEditMessage, onRetractMessage,
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const measuredHeightsRef = useRef<Map<string, number>>(new Map())
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  const useVirtual = messages.length > VIRTUAL_THRESHOLD

  // ===== 预估所有消息位置 =====
  const layoutData = useMemo(() => {
    let totalHeight = 0
    const items: Array<{
      index: number
      messageId: string
      offset: number
      height: number
      showDateSep: boolean
      dateLabel: string
    }> = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const showDateSep = i === 0 || isNewDay(messages[i - 1].timestamp, msg.timestamp)

      if (showDateSep) {
        totalHeight += DATE_SEPARATOR_HEIGHT
      }

      // 优先使用已测量的高度，否则使用预估
      const measured = measuredHeightsRef.current.get(msg.id)
      const height = measured ?? estimateMessageHeight(msg)

      items.push({
        index: i,
        messageId: msg.id,
        offset: totalHeight,
        height,
        showDateSep,
        dateLabel: showDateSep ? formatDate(msg.timestamp) : '',
      })

      totalHeight += height + 8 // 8px gap
    }

    return { items, totalHeight }
  }, [messages])

  // ===== 计算可见窗口范围 =====
  const visibleRange = useMemo(() => {
    if (!useVirtual) return { start: 0, end: messages.length }

    let start = 0
    let end = messages.length

    for (let i = 0; i < layoutData.items.length; i++) {
      const item = layoutData.items[i]
      if (item.offset + item.height < scrollTop - 200) {
        start = i + 1
      } else if (item.offset <= scrollTop + containerHeight + 200) {
        end = i + 1
      } else {
        break
      }
    }

    return {
      start: Math.max(0, start - BUFFER_SIZE),
      end: Math.min(messages.length, end + BUFFER_SIZE),
    }
  }, [useVirtual, layoutData, scrollTop, containerHeight, messages.length])

  // ===== 滚动事件处理（RAF 节流）=====
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      setScrollTop(el.scrollTop)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
      setShowScrollBtn(!isNearBottom)
    })
  }, [])

  // ===== ResizeObserver 监听容器高度 =====
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)

    setContainerHeight(el.clientHeight)

    return () => observer.disconnect()
  }, [])

  // ===== IntersectionObserver 测量实际高度 =====
  useEffect(() => {
    if (!useVirtual) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            const id = entry.target.dataset.msgId
            if (id) {
              const h = entry.target.offsetHeight
              if (h > 0) {
                const prev = measuredHeightsRef.current.get(id)
                if (prev !== h) {
                  measuredHeightsRef.current.set(id, h)
                }
              }
            }
          }
        }
      },
      { threshold: 0.01 },
    )

    itemRefsMap.current.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [useVirtual, visibleRange])

  // ===== 自动滚到底部 =====
  useEffect(() => {
    if (!isStreaming && messages.length > 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // ===== 回调函数 =====
  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {})
    onCopyMessage?.(content)
  }, [onCopyMessage])

  const handleReaction = useCallback((msgId: string, type: 'like' | 'dislike') => {
    setReactions(prev => {
      const current = prev[msgId]
      if (current === type) return { ...prev, [msgId]: null }
      return { ...prev, [msgId]: type }
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /**
   * 滚动到指定索引的消息
   */
  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current
    if (!el || index < 0 || index >= layoutData.items.length) return
    const targetOffset = layoutData.items[index].offset
    el.scrollTo({ top: targetOffset, behavior: 'smooth' })
  }, [layoutData])

  const isHL = useCallback((id: string) => highlightedMessageId === id, [highlightedMessageId])
  const isSel = useCallback((id: string) => selectedMessageIds?.includes(id) ?? false, [selectedMessageIds])

  const startEdit = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
  }, [])

  const confirmEdit = useCallback(() => {
    if (editingId && editContent.trim()) {
      onEditMessage?.(editingId, editContent.trim())
    }
    setEditingId(null)
    setEditContent('')
  }, [editingId, editContent, onEditMessage])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditContent('')
  }, [])

  // 暴露命令式方法
  React.useImperativeHandle(props as any, () => ({ scrollToIndex, scrollToBottom }), [scrollToIndex, scrollToBottom])

  // ===== 空状态 =====
  if (messages.length === 0 && !chatError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">开始新对话</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">输入您的问题或需求，AI 将为您提供专业的配方建议和分析。</p>
        </div>
      </div>
    )
  }

  // ===== 非虚拟模式：直接渲染全部（与原 ChatMessages 行为一致） =====
  if (!useVirtual) {
    return (
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin relative"
      >
        {(showReportButton || (selectedMessageIds && selectedMessageIds.length > 0)) && (
          <div className="flex items-center justify-between px-1 py-1.5 mb-2">
            {selectedMessageIds && selectedMessageIds.length > 0 && (
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">已选 {selectedMessageIds.length} 条</span>
            )}
            {showReportButton && onGenerateReport && (
              <button onClick={onGenerateReport}
                className="ml-auto text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors font-medium"
              >
                <FileText className="w-3.5 h-3.5" /> 生成报告
              </button>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          const showDateSep = i === 0 || isNewDay(messages[i - 1].timestamp, msg.timestamp)
          const reaction = reactions[msg.id]
          const hl = isHL(msg.id)
          const sel = isSel(msg.id)

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="chat-date-separator"><span>{formatDate(msg.timestamp)}</span></div>
              )}
              <MessageItem
                msg={msg}
                reaction={reaction}
                isHighlighted={hl}
                isSelected={sel}
                copiedId={copiedId}
                editingId={editingId}
                editContent={editContent}
                thinkingSteps={thinkingSteps}
                isStreaming={isStreaming}
                isLastMsg={i === messages.length - 1}
                onCopy={handleCopy}
                onReaction={handleReaction}
                onStartEdit={startEdit}
                onConfirmEdit={confirmEdit}
                onCancelEdit={cancelEdit}
                onRetry={onRetry}
                onRegenerate={onRegenerate}
                onDeleteMessage={onDeleteMessage}
                onReferenceMessage={onReferenceMessage}
                onEditMessage={onEditMessage}
                onRetractMessage={onRetractMessage}
                disableAnimations={false}
              />
            </div>
          )
        })}

        {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isLoading && (
          <div className="chat-message-row">
            <div className="avatar-ai"><Bot className="w-4 h-4" /></div>
            <div className="chat-typing-indicator">
              <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />

        {showScrollBtn && (
          <button onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5 transition-all hover:shadow-xl animate-fade-in"
          >
            <ChevronDown className="w-3.5 h-3.5" /> 跳至最新
          </button>
        )}
      </div>
    )
  }

  // ===== 虚拟滚动模式 =====
  const visibleItems = layoutData.items.slice(visibleRange.start, visibleRange.end)

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin relative"
      style={{ position: 'relative' }}
    >
      {/* 总占位容器 */}
      <div style={{ height: layoutData.totalHeight, position: 'relative' }}>
        {/* 报告按钮区域 */}
        {(showReportButton || (selectedMessageIds && selectedMessageIds.length > 0)) && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
            className="flex items-center justify-between px-1 py-1.5 mb-2"
          >
            {selectedMessageIds && selectedMessageIds.length > 0 && (
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">已选 {selectedMessageIds.length} 条</span>
            )}
            {showReportButton && onGenerateReport && (
              <button onClick={onGenerateReport}
                className="ml-auto text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors font-medium"
              >
                <FileText className="w-3.5 h-3.5" /> 生成报告
              </button>
            )}
          </div>
        )}

        {/* 可见消息项 */}
        {visibleItems.map((item) => {
          const msg = messages[item.index]
          const reaction = reactions[msg.id]
          const hl = isHL(msg.id)
          const sel = isSel(msg.id)

          return (
            <div
              key={msg.id}
              data-msg-id={msg.id}
              ref={(el) => { if (el) itemRefsMap.current.set(msg.id, el); }}
              style={{
                position: 'absolute',
                top: item.offset,
                left: 0,
                right: 0,
                willChange: 'transform',
              }}
            >
              {item.showDateSep && (
                <div className="chat-date-separator"><span>{item.dateLabel}</span></div>
              )}
              <MessageItem
                msg={msg}
                reaction={reaction}
                isHighlighted={hl}
                isSelected={sel}
                copiedId={copiedId}
                editingId={editingId}
                editContent={editContent}
                thinkingSteps={thinkingSteps}
                isStreaming={isStreaming}
                isLastMsg={item.index === messages.length - 1}
                onCopy={handleCopy}
                onReaction={handleReaction}
                onStartEdit={startEdit}
                onConfirmEdit={confirmEdit}
                onCancelEdit={cancelEdit}
                onRetry={onRetry}
                onRegenerate={onRegenerate}
                onDeleteMessage={onDeleteMessage}
                onReferenceMessage={onReferenceMessage}
                onEditMessage={onEditMessage}
                onRetractMessage={onRetractMessage}
                disableAnimations={true}
              />
            </div>
          )
        })}

        {/* 流式加载指示器 */}
        {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isLoading && (
          <div style={{ position: 'absolute', top: layoutData.totalHeight - 60, left: 0, right: 0 }} className="chat-message-row">
            <div className="avatar-ai"><Bot className="w-4 h-4" /></div>
            <div className="chat-typing-indicator">
              <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />

      {showScrollBtn && (
        <button onClick={scrollToBottom}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5 transition-all hover:shadow-xl animate-fade-in"
        >
          <ChevronDown className="w-3.5 h-3.5" /> 跳至最新
        </button>
      )}
    </div>
  )
}

// 导出类型供外部使用
export type { VirtualizedMessageListProps }
