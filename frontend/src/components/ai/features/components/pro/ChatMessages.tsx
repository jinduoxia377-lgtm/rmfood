/**
 * ChatMessages v2 — 专业版消息列表（增强UI/UX）
 *
 * 功能：
 * - 日期分组分隔线
 * - 消息时间戳
 * - AI 回复反应（👍/👎）
 * - 跳到底部按钮
 * - 拷贝/引用/重试/删除
 * - Markdown + 打字机 + 思考过程
 * - 搜索高亮
 * - 配方报告
 * - 消息类型差异化渲染（文本/链接/代码/图片/文件）
 * - 发送状态指示器（sending/sent/failed）+ 失败重试
 */
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { logger } from '@/utils/safeLogger'
import { userProfileManager } from '../../services/userProfileService'
import {
  Bot, Copy, Check, RefreshCw, Trash2, FileText,
  ThumbsUp, ThumbsDown, ChevronDown, Clock,
  Pencil, Undo2, X, AlertTriangle,
  Link, Code, Image as ImageIcon, FileText as FileIcon,
  Loader2, ExternalLink, WifiOff, RotateCcw,
  Sparkles, MessageSquare, Leaf, Handshake, Dna, Shield,
} from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import TypewriterText from './TypewriterText'
import ThinkingProcess from './ThinkingProcess'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import { detectStructuredContent } from '../structured/utils'
import { ScoreCards } from '@/components/ai/charts/ScoreCards'
import EnhancedContentRenderer from './EnhancedContentRenderer'

// ════════════════════════════════════════
// 消息类型定义与自动检测
// ════════════════════════════════════════

/** 支持的消息内容类型 */
export type MessageType = 'text' | 'link' | 'code' | 'image' | 'file'

/**
 * 自动检测消息内容类型
 *
 * 检测优先级：图片 > 链接 > 文件 > 代码 > 文本
 */
export function detectMessageType(content: string): MessageType {
  if (!content || !content.trim()) return 'text'

  const trimmed = content.trim()

  // 图片检测：base64 数据或常见图片 URL 后缀
  if (
    /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed) ||
    /\.(png|jpeg|jpg|gif|webp|svg|bmp)(\?|$)/i.test(trimmed)
  ) {
    return 'image'
  }

  // 链接检测：独立的 http(s) URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return 'link'
  }

  // 文件检测：含文件名+扩展名模式（非代码类扩展名）
  const filePattern = /\S+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|csv|txt|md|json|xml|yaml|yml)(\s|$)/i
  if (filePattern.test(trimmed) && !trimmed.includes('```')) {
    return 'file'
  }

  // 代码块检测：被 ``` 包裹，或超过3行且每行都有缩进
  const lines = trimmed.split('\n')
  const isCodeBlock = trimmed.startsWith('```') && trimmed.endsWith('```')
  const isIndentedCode = lines.length >= 3 && lines.every(line => line.trim() === '' || /^\s{2,}/.test(line))
  if (isCodeBlock || isIndentedCode) {
    return 'code'
  }

  return 'text'
}

// ════════════════════════════════════════
// 消息类型差异化渲染组件
// ════════════════════════════════════════

/** 链接卡片渲染 */
function LinkMessageCard({ url }: { url: string }) {
  const domain = tryExtractDomain(url)
  // 使用域名首字母作为图标，避免外部网络请求（Google Favicon 在国内不可达）
  const domainInitial = domain ? domain.charAt(0).toUpperCase() : '?'

  return (
    <div className="chat-link-card">
      <div className="chat-link-card-header">
        <Link className="w-4 h-4 text-primary-500 flex-shrink-0" />
        {domain && (
          <span
            className="w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            title={domain}
          >
            {domainInitial}
          </span>
        )}
      </div>
      <div className="chat-link-card-body">
        <div className="chat-link-card-title">{tryExtractTitle(url)}</div>
        <div className="chat-link-card-url text-xs opacity-60 truncate">{url}</div>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="chat-link-card-action"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        打开链接
      </a>
    </div>
  )
}

/** 代码块渲染 */
function CodeMessageBlock({ code }: { code: string }) {
  // 剥离 ``` 包裹标记
  const cleanCode = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')

  return (
    <div className="chat-code-block">
      <div className="chat-code-block-header">
        <Code className="w-3.5 h-3.5" />
        <span className="text-xs">代码</span>
      </div>
      <pre className="chat-code-block-content"><code>{cleanCode || code}</code></pre>
    </div>
  )
}

/** 图片预览卡片 */
function ImageMessageCard({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className="chat-image-card">
      {!loaded && !error && (
        <div className="chat-image-placeholder">
          <ImageIcon className="w-8 h-8 animate-pulse" />
          <span className="text-xs mt-1">加载中...</span>
        </div>
      )}
      {error && (
        <div className="chat-image-error">
          <ImageIcon className="w-8 h-8" />
          <span className="text-xs">图片加载失败</span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="消息图片"
        className={`chat-image-content ${loaded ? 'opacity-100' : 'opacity-0 absolute'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}

/** 文件图标卡片 */
function FileMessageCard({ filename }: { filename: string }) {
  const ext = extractExtension(filename)

  return (
    <div className="chat-file-card">
      <FileIcon className="w-10 h-10 text-primary-500 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{filename}</div>
        <div className="text-xs opacity-50 uppercase">{ext} 文件</div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════

function tryExtractDomain(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function tryExtractTitle(url: string): string {
  // 尝试从 URL 路径中提取可读标题
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const last = segments[segments.length - 1]
      // 去掉扩展名
      return last.replace(/\.[^.]+$/, '') || '链接预览'
    }
  } catch { /* ignore */ }
  return '链接预览'
}

function extractExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/)
  return match ? match[1].toUpperCase() : 'FILE'
}

/**
 * 根据消息类型渲染差异化内容
 * 在 ChatMessages 组件内部调用，可访问组件闭包变量
 *
 * v2.1: 结构化JSON检测优先于所有类型分发
 */
/**
 * 解析内容中的图表数据分隔符
 * 格式: ...Markdown文本...
 *       <!--DATA-->
 *       {"chart_type":"score-cards","items":[...]}
 */
function parseChartData(content: string): { textContent: string; chartJson: any } | null {
  const marker = '<!--DATA-->'
  const idx = content.indexOf(marker)
  if (idx === -1) return null
  const textContent = content.substring(0, idx).trim()
  const jsonStr = content.substring(idx + marker.length).trim()
  try {
    return { textContent, chartJson: JSON.parse(jsonStr) }
  } catch {
    return null
  }
}

function renderMessageContent(
  msg: ChatMessage,
  index: number,
  allMessages: ChatMessage[],
  streaming: boolean,
) {
  // v2.1: AI消息优先检测结构化JSON内容（无论消息类型如何）
  if (msg.role === 'assistant') {
    const structured = detectStructuredContent(msg.content)
    if (structured) {
      return <StructuredMessageRenderer content={structured} />
    }
  }

  const type = msg.messageType || detectMessageType(msg.content)

  switch (type) {
    case 'link':
      return <LinkMessageCard url={msg.content.trim()} />
    case 'code':
      return <CodeMessageBlock code={msg.content} />
    case 'image':
      return <ImageMessageCard src={msg.content.trim()} />
    case 'file':
      return <FileMessageCard filename={msg.content.trim()} />
    case 'text':
    default:
      if (msg.role === 'assistant') {
        // 检测分隔符: Markdown文本 + 图表数据
        const parsed = parseChartData(msg.content)
        if (parsed) {
          const textEl = <MarkdownRenderer content={parsed.textContent} />
          // 渲染图表的组件
          let chartEl: React.ReactNode = null
          if (parsed.chartJson.chart_type === 'score-cards' && parsed.chartJson.items?.length) {
            const sc: Record<string, number | null> = {}
            parsed.chartJson.items.forEach((item: any, i: number) => {
              sc[`score${i+1}`] = item.value ?? null
            })
            chartEl = (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {parsed.chartJson.title || '评分概览'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {parsed.chartJson.items.map((item: any, i: number) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center
                      border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {item.value}{item.unit || ''}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          return (
            <EnhancedContentRenderer content={parsed.textContent}>
              <div>
                {textEl}
                {chartEl}
              </div>
            </EnhancedContentRenderer>
          )
        }

        return index === allMessages.length - 1 && !streaming
          ? <EnhancedContentRenderer content={msg.content}>
              <TypewriterText content={msg.content} speed={20} chunkSize={5} />
            </EnhancedContentRenderer>
          : <EnhancedContentRenderer content={msg.content}>
              <MarkdownRenderer content={msg.content} />
            </EnhancedContentRenderer>
      }
      return <div className="whitespace-pre-wrap break-words">{msg.content}</div>
  }
}

export interface ChatMessagesProps {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoading?: boolean
  chatError: Error | null
  onRetry?: () => void
  /** 对指定失败消息重新发送 */
  onRetryMessage?: (messageId: string) => void
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

const QUICK_ACTIONS = [
  { Icon: Leaf, title: '补气药材', desc: '药食同源目录里有哪些常用的补气药材？', color: 'text-emerald-500' },
  { Icon: Handshake, title: '配伍协同', desc: '黄芪和党参配伍有什么协同作用？', color: 'text-blue-500' },
  { Icon: Dna, title: '活性肽', desc: '功能性食品中常用的活性肽有哪些来源？', color: 'text-purple-500' },
  { Icon: Shield, title: '抗氧化', desc: '设计一款抗氧化保健食品需要注意什么？', color: 'text-rose-500' },
]

const MAX_RETRY_DISPLAY = 3

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
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return d1.toDateString() !== d2.toDateString()
}

type Reaction = 'like' | 'dislike' | null

export default function ChatMessages(props: ChatMessagesProps) {
  const {
    messages, isStreaming, isLoading, chatError, onRetry, onRetryMessage, onCopyMessage,
    onRegenerate, onDeleteMessage, onGenerateReport, showReportButton,
    highlightedMessageId, selectedMessageIds, onSelectMessage,
    onReferenceMessage, searchQuery, thinkingSteps,
    onEditMessage, onRetractMessage,
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // ===== 网络状态感知（任务4）=====
  const networkStatus = useNetworkStatus()
  const { isOnline, isSlowConnection } = networkStatus

  // "稍后重试"队列：离线或慢速时暂存失败消息
  const [retryQueue, setRetryQueue] = useState<Array<{ id: string; content: string; timestamp: number }>>([])

  /** 将失败消息加入重试队列 */
  const enqueueRetry = useCallback((msg: ChatMessage) => {
    if (msg.role !== 'user') return
    setRetryQueue(prev => {
      if (prev.some(item => item.id === msg.id)) return prev
      return [...prev, { id: msg.id, content: msg.content, timestamp: Date.now() }]
    })
  }, [])

  /** 处理队列中待重试的消息（网络恢复时自动触发） */
  useEffect(() => {
    if (!isOnline || retryQueue.length === 0 || !onRetryMessage) return
    const timer = setTimeout(() => {
      retryQueue.forEach(item => {
        onRetryMessage(item.id)
      })
      setRetryQueue([])
      logger.info(`[ChatMessages] 网络恢复，自动重试 ${retryQueue.length} 条消息`)
    }, 1000)
    return () => clearTimeout(timer)
  }, [isOnline, retryQueue, onRetryMessage])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // Track scroll position for "jump to bottom" button
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    setShowScrollBtn(!isNearBottom)
  }, [])

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
    // Phase 4 Step 4: 反馈事件记录到用户画像（用于偏好学习和共情策略调优）
    try {
      userProfileManager.recordBehavior({
        type: type === 'like' ? 'response_liked' : 'response_disliked',
        timestamp: Date.now(),
        metadata: { messageId: msgId },
      })
    } catch (e) {
      logger.warn('[ChatMessages] Behavior recording failed:', e)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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

  // 骨架屏加载态
  if (messages.length === 0 && isLoading && !chatError) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 chat-custom-scrollbar">
        <div className="chat-skeleton space-y-5 max-w-lg mx-auto">
          {/* 头像 + 气泡骨架：用户 */}
          <div className="flex items-end gap-3 justify-end">
            <div className="flex flex-col items-end gap-2 flex-1 max-w-[75%]">
              <div className="skeleton-bubble skeleton-user h-10 w-[70%] rounded-2xl rounded-br-sm" />
            </div>
            <div className="skeleton-avatar w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          {/* 头像 + 气泡骨架：AI */}
          <div className="flex items-start gap-3">
            <div className="skeleton-avatar w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex flex-col gap-2 flex-1 max-w-[80%]">
              <div className="skeleton-bubble skeleton-ai h-16 w-full rounded-2xl rounded-tl-sm" />
              <div className="skeleton-bubble skeleton-ai h-8 w-[60%] rounded-2xl rounded-tl-sm" />
            </div>
          </div>
          {/* 头像 + 气泡骨架：用户（第2条） */}
          <div className="flex items-end gap-3 justify-end">
            <div className="flex flex-col items-end gap-2 flex-1 max-w-[65%]">
              <div className="skeleton-bubble skeleton-user h-7 w-[90%] rounded-2xl rounded-br-sm" />
            </div>
            <div className="skeleton-avatar w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // 空状态
  if (messages.length === 0 && !chatError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 space-y-6">
        {/* 主图标 — 渐变背景圆形容器内 Sparkles 图标 */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600
            shadow-lg shadow-primary-300/40 dark:shadow-primary-900/30
            flex items-center justify-center animate-pulse-slow">
            <Sparkles className="w-10 h-10 text-white drop-shadow-sm" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">开始新对话</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">输入您的问题或需求，AI 将为您提供专业的配方建议和分析。</p>
        </div>
        {/* 快捷操作卡片 — SVG 图标 + 悬停微交互 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {QUICK_ACTIONS.map((action, i) => (
            <button key={i}
              className="group relative flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700
                hover:border-primary-300 dark:hover:border-primary-600
                hover:bg-gradient-to-br hover:from-primary-50/60 hover:to-transparent
                dark:hover:from-primary-900/15 dark:hover:to-transparent
                transition-all duration-200 ease-out text-left
                hover:scale-[1.02] hover:shadow-md hover:shadow-primary-100/50 dark:hover:shadow-primary-900/20
                active:scale-[0.98]"
            >
              <div className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center
                bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-750
                transition-colors duration-200`}>
                <action.Icon className={`w-5 h-5 ${action.color} transition-transform duration-200 group-hover:scale-110`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">{action.title}</div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">{action.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin relative chat-custom-scrollbar${isSlowConnection ? ' chat-slow-network' : ''}`}
    >
      {/* 离线状态横幅（任务4） */}
      {!isOnline && (
        <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 mb-2 rounded-lg
          bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800
          text-amber-800 dark:text-amber-200 text-xs font-medium animate-fade-in"
          role="status" aria-live="polite"
        >
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>当前离线 — 消息将在网络恢复后自动发送</span>
          {retryQueue.length > 0 && (
            <span className="ml-auto text-amber-600 dark:text-amber-400">
              {retryQueue.length} 条待发送
            </span>
          )}
        </div>
      )}

      {/* 慢速网络提示 */}
      {isOnline && isSlowConnection && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded-md
          bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px]"
          role="status"
        >
          <RotateCcw className="w-3 h-3 animate-spin" style={{ animationDuration: '2s' }} />
          <span>网络较慢，已优化加载</span>
        </div>
      )}

      {/* 报告按钮 */}
      {(showReportButton || (selectedMessageIds && selectedMessageIds.length > 0)) && (
        <div className="flex items-center justify-between px-1 py-1.5 mb-2">
          {selectedMessageIds && selectedMessageIds.length > 0 && (
            <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
              已选 {selectedMessageIds.length} 条
            </span>
          )}
          {showReportButton && onGenerateReport && (
            <button onClick={onGenerateReport}
              className="ml-auto text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300
                hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors font-medium"
            >
              <FileText className="w-3.5 h-3.5" /> 生成报告
            </button>
          )}
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((msg, i) => {
        const showDateSep = i === 0 || isNewDay(messages[i-1].timestamp, msg.timestamp)
        const reaction = reactions[msg.id]
        const hl = isHL(msg.id)
        const sel = isSel(msg.id)

        return (
          <div key={msg.id}>
            {/* 日期分隔线 */}
            {showDateSep && (
              <div className="chat-date-separator">
                <span>{formatDate(msg.timestamp)}</span>
              </div>
            )}

            {/* 消息行 */}
            <div className={`chat-message-row${msg.role === 'user' ? ' user-row' : ''}${hl ? ' chat-highlighted' : ''}`}>
              {/* 头像 */}
              <div className={msg.role === 'user' ? 'avatar-user' : 'avatar-ai'}>
                {msg.role === 'user' ? 'U' : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span className={`avatar-status-indicator ${isStreaming && i === messages.length - 1 ? 'avatar-status-thinking' : 'avatar-status-online'}`} />
                  </>
                )}
              </div>

              {/* 消息内容组 */}
              <div className="chat-message-group">
                {/* 时间戳 */}
                <div className="chat-timestamp">{formatTime(msg.timestamp)}</div>

                {/* 气泡 */}
                {msg.isRetracted ? (
                  <div className="chat-bubble-retracted">
                    <span>消息已撤回</span>
                    {msg.retractedAt && (
                      <span className="ml-2">{formatTime(msg.retractedAt)}</span>
                    )}
                  </div>
                ) : editingId === msg.id && msg.role === 'user' ? (
                  <div className="chat-edit-overlay">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[60px] max-h-[200px] px-3 py-2 rounded-lg bg-white dark:bg-gray-900
                        border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-sm
                        resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          confirmEdit()
                        }
                        if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                    />
                    <div className="chat-edit-actions">
                      <button onClick={cancelEdit} className="cancel"><X className="w-3 h-3" /> 取消</button>
                      <button onClick={confirmEdit} className="confirm"><Check className="w-3 h-3" /> 确认</button>
                    </div>
                  </div>
                ) : (
                  <div className={`${msg.error ? 'chat-bubble-error' : msg.sendStatus === 'failed' && msg.role === 'user' ? 'chat-bubble-user chat-bubble-failed' : msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                    {/* 发送状态：sending — 气泡内微型 spinner + 半透明文字 */}
                    {msg.sendStatus === 'sending' && msg.role === 'user' && !msg.error ? (
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white/70" />
                        <span className="text-xs text-white/60">发送中...</span>
                      </div>
                    ) : /* 发送状态：failed — 红色边框 + 警告图标 + 重试按钮（在气泡内部） */ msg.sendStatus === 'failed' && msg.role === 'user' && !msg.error ? (
                      <div className="space-y-2.5 py-0.5">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-red-100">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>发送失败</span>
                          <span className="text-[11px] font-normal opacity-70 ml-auto">
                            ({msg.retryCount ?? 0}/{MAX_RETRY_DISPLAY}次重试)
                          </span>
                        </div>
                        {(msg.retryCount ?? 0) < MAX_RETRY_DISPLAY && onRetryMessage && (
                          <button
                            onClick={() => onRetryMessage(msg.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg
                              bg-red-400/20 hover:bg-red-400/30 text-red-100 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> 重新发送
                          </button>
                        )}
                      </div>
                    ) : /* 错误消息（原有逻辑） */ msg.error ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          <span>发送失败</span>
                        </div>
                        <p className="text-xs opacity-80">{msg.error}</p>
                        {onRetry && (
                          <button onClick={onRetry} className="text-xs flex items-center gap-1 hover:underline">
                            <RefreshCw className="w-3 h-3" /> 重新发送
                          </button>
                        )}
                      </div>
                    ) : /* AI 加载中 */ msg.role === 'assistant' && msg.isLoading ? (
                      <div className="chat-typing-indicator">
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                      </div>
                    ) : /* 发送中不渲染内容 */ msg.sendStatus === 'sending' ? null : (
                      <>
                        {msg.role === 'assistant' && thinkingSteps && thinkingSteps.length > 0 && (
                          <div className="mb-2">
                            <ThinkingProcess steps={thinkingSteps} isThinking={false} />
                          </div>
                        )}
                        {/* 消息类型差异化渲染 */}
                        {renderMessageContent(msg, i, messages, isStreaming)}
                      </>
                    )}
                  </div>
                )}

                {/* 操作栏 */}
                {!msg.error && !msg.isLoading && msg.content && !msg.isRetracted && (
                  <div className="chat-action-bar">
                    {msg.role === 'user' && onEditMessage && (
                      <button onClick={() => startEdit(msg)} className="chat-action-btn" title="编辑">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleCopy(msg.id, msg.content)} className="chat-action-btn" title="复制">
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {onReferenceMessage && (
                      <button onClick={() => onReferenceMessage(msg)} className="chat-action-btn" title="引用">
                        <span className="text-xs font-bold">↑</span>
                      </button>
                    )}
                    {msg.role === 'assistant' && (
                      <>
                        <button onClick={() => handleReaction(msg.id, 'like')} className={`chat-action-btn ${reaction === 'like' ? 'text-blue-500' : ''}`} title="有用">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleReaction(msg.id, 'dislike')} className={`chat-action-btn ${reaction === 'dislike' ? 'text-red-500' : ''}`} title="没用">
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
          </div>
        )
      })}

      {/* 流式加载指示器 */}
      {isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isLoading && (
        <div className="chat-message-row">
          <div className="avatar-ai">
            <Bot className="w-4 h-4" />
            <span className="avatar-status-indicator avatar-status-thinking" />
          </div>
          <div className="chat-typing-indicator">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* 跳到底部按钮 — 毛玻璃渐变 + 大触控区 */}
      {showScrollBtn && (
        <button onClick={scrollToBottom}
          className="sticky bottom-3 left-1/2 -translate-x-1/2
            min-h-[36px] px-4 py-2 rounded-full
            bg-white/80 dark:bg-gray-800/80 backdrop-blur-md
            border border-gray-200/60 dark:border-gray-700/60
            shadow-lg shadow-gray-200/50 dark:shadow-black/20
            text-xs font-medium text-gray-600 dark:text-gray-300
            flex items-center gap-2
            transition-all duration-200 ease-out
            hover:-translate-y-0.5 hover:shadow-xl hover:bg-white dark:hover:bg-gray-800
            hover:border-primary-300/60 dark:hover:border-primary-600/40
            active:translate-y-0 animate-fade-in"
        >
          <ChevronDown className="w-4 h-4" />
          <span>回到最新</span>
        </button>
      )}
    </div>
  )
}
