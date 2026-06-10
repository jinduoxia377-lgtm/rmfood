/**
 * EnhancedMessage - 增强消息组件 (v7.0)
 *
 * 职责：
 * - 渲染单条消息，支持多种操作
 * - 消息编辑功能（双击或菜单触发）
 * - 消息撤回功能（带时间限制）
 * - 引用回复功能
 * - 消息评价功能（点赞/点踩）
 * - 消息书签功能
 * - 支持流式输出时的骨架屏加载动画
 * - Markdown 内容渲染
 * - 高性能渲染优化（React.memo）
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-16
 */

import React, { useState, useCallback, useMemo } from 'react'
import { SimpleMarkdown } from '@/components/ai/renderers'
import { sanitizeHtml, isSafeHtml } from '../utils/sanitize'
import { FileText, Edit2, Undo2, Reply, ThumbsUp, ThumbsDown, Bookmark, CheckCircle, Loader2, X, Send, MoreHorizontal } from 'lucide-react'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isEdited?: boolean
  rating?: 'up' | 'down'
  bookmarked?: boolean
  replyToId?: string
  replyToContent?: string
}

export interface MessageActions {
  onEdit?: (messageId: string, newContent: string) => void
  onWithdraw?: (messageId: string, reason?: string) => void
  onReply?: (messageId: string) => void
  onRate?: (messageId: string, rating: 'up' | 'down', feedback?: string) => void
  onBookmark?: (messageId: string, note?: string) => void
  onCopy?: (content: string) => void
  onGenerateReport?: () => void
}

export interface EnhancedMessageProps {
  msg: ChatMessage
  highlightedMessageId: string | null
  isStreaming: boolean
  showReportButton?: boolean
  actions?: MessageActions
  canWithdraw?: boolean
  withdrawTimeLimit?: number
}

// ===== 常量定义 =====

const WITHDRAW_TIME_LIMIT_MS = 60000
const ACTION_BUTTON_ICON_SIZE = 'w-4 h-4 sm:w-5 sm:h-5'

// ===== 主组件 =====

export const EnhancedMessage = React.memo(({
  msg,
  highlightedMessageId,
  isStreaming,
  showReportButton = false,
  actions,
  canWithdraw = true,
  withdrawTimeLimit = WITHDRAW_TIME_LIMIT_MS,
}: EnhancedMessageProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(msg.content)
  const [showMenu, setShowMenu] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const isEmptyAssistantMsg = msg.role === 'assistant' && (!msg.content || msg.content.trim() === '')

  const sanitizedContent = useMemo(() => {
    if (!msg.content) return ''

    if (!isSafeHtml(msg.content)) {
      logger.warn('[EnhancedMessage] Potentially unsafe content detected, sanitizing...')
    }

    return sanitizeHtml(msg.content)
  }, [msg.content])

  const canWithdrawMessage = useMemo(() => {
    if (!canWithdraw || msg.role !== 'user') return false
    const elapsed = Date.now() - msg.timestamp
    return elapsed < withdrawTimeLimit
  }, [canWithdraw, msg.role, msg.timestamp, withdrawTimeLimit])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sanitizedContent || '')
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      actions?.onCopy?.(sanitizedContent || '')
    } catch (e) {
      logger.error('[EnhancedMessage] 复制失败:', e)
    }
  }, [sanitizedContent, actions])

  const handleEdit = useCallback(() => {
    setEditContent(msg.content)
    setIsEditing(true)
    setShowMenu(false)
  }, [msg.content])

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && editContent !== msg.content) {
      actions?.onEdit?.(msg.id, editContent)
    }
    setIsEditing(false)
  }, [editContent, msg.id, msg.content, actions])

  const handleCancelEdit = useCallback(() => {
    setEditContent(msg.content)
    setIsEditing(false)
  }, [msg.content])

  const handleWithdraw = useCallback(() => {
    actions?.onWithdraw?.(msg.id, '用户撤回')
    setShowMenu(false)
  }, [msg.id, actions])

  const handleReply = useCallback(() => {
    actions?.onReply?.(msg.id)
    setShowMenu(false)
  }, [msg.id, actions])

  const handleRate = useCallback((rating: 'up' | 'down') => {
    if (msg.rating === rating) {
      actions?.onRate?.(msg.id, rating, '取消评价')
    } else {
      actions?.onRate?.(msg.id, rating)
    }
    setShowMenu(false)
  }, [msg.id, msg.rating, actions])

  const handleBookmark = useCallback(() => {
    actions?.onBookmark?.(msg.id)
    setShowMenu(false)
  }, [msg.id, actions])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [handleSaveEdit, handleCancelEdit])

  return (
    <div
      data-message-id={msg.id}
      className={`group flex items-start gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${highlightedMessageId === msg.id ? 'highlight-formula-message' : ''} animate-fade-in-up`}
      style={{ animationDuration: '200ms', animationFillMode: 'both' }}
      onDoubleClick={() => msg.role === 'user' && !isEditing && setIsEditing(true)}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 shadow-md transition-transform duration-200 group-hover:scale-105 ${
          msg.role === 'user'
            ? 'bg-gradient-to-br from-primary-500 to-primary-600'
            : 'bg-gradient-to-br from-teal-500 to-teal-600'
        }`}
        aria-hidden="true"
      >
        {msg.role === 'user' ? 'U' : 'AI'}
      </div>

      {/* Message Content Area */}
      <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'sm:max-w-[75%] max-w-[85%]' : 'sm:max-w-[80%] max-w-[90%]'} ${msg.role === 'user' ? 'text-right' : ''}`}>
        {/* Reply Preview */}
        {msg.replyToId && msg.replyToContent && (
          <div
            className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 ${msg.role === 'user' ? 'sm:ml-auto' : ''}`}
            style={{ maxWidth: '80%' }}
          >
            <Reply className="w-3 h-3 flex-shrink-0" />
            <span className="truncate" title={msg.replyToContent}>
              {msg.replyToContent.length > 50 ? msg.replyToContent.slice(0, 50) + '...' : msg.replyToContent}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`relative group/bubble inline-block p-3 sm:p-4 rounded-2xl shadow-sm transition-all duration-200 ease-out active:scale-[0.98] hover:shadow-md ${
            msg.role === 'user'
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-tr-none'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700'
          }`}
        >
          {/* Edit Mode */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full min-h-[80px] p-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
                autoFocus
                placeholder="编辑消息内容..."
              />
              <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <button
                  onClick={handleCancelEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    msg.role === 'user'
                      ? 'bg-white/20 hover:bg-white/30 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <X className="w-3 h-3 inline mr-1" />
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    msg.role === 'user'
                      ? 'bg-white text-primary-600 hover:bg-white/90'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                >
                  <Send className="w-3 h-3 inline mr-1" />
                  保存
                </button>
              </div>
            </div>
          ) : isEmptyAssistantMsg && isStreaming ? (
            <div className="space-y-3 py-2" aria-label="AI正在生成回复" role="status">
              <div className="skeleton-shimmer h-4 rounded-lg w-full max-w-[90%]" />
              <div className="skeleton-shimmer h-4 rounded-lg w-[85%] max-w-[80%]" />
              <div className="skeleton-shimmer h-4 rounded-lg w-[70%] max-w-[65%]" />
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                <div className="skeleton-shimmer h-24 rounded-xl w-full" />
              </div>
              <div className="flex items-center gap-2 pt-2 text-xs text-gray-400 dark:text-gray-500 font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>AI 正在思考...</span>
              </div>
            </div>
          ) : (
            <div className="text-sm sm:text-base leading-relaxed relative">
              <SimpleMarkdown content={sanitizedContent} />
              {msg.isEdited && (
                <span className={`ml-1 text-xs opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  (已编辑)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className={`absolute ${
            msg.role === 'user'
              ? 'left-0 -translate-x-full pr-2 sm:pr-3'
              : 'right-0 translate-x-full pl-2 sm:pl-3'
          } top-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 flex gap-1`}
        >
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-150"
            title={isCopied ? '已复制' : '复制消息'}
            aria-label={isCopied ? '已复制' : '复制此条消息内容'}
          >
            <CheckCircle className={isCopied ? `${ACTION_BUTTON_ICON_SIZE} text-green-500` : `${ACTION_BUTTON_ICON_SIZE} text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors`} />
          </button>

          {/* Report Button */}
          {showReportButton && actions?.onGenerateReport && (
            <button
              onClick={actions.onGenerateReport}
              className="p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-150"
              title="基于此对话生成专业学术报告"
              aria-label="生成专业报告"
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" />
            </button>
          )}

          {/* More Options Button */}
          {msg.role === 'user' && (canWithdrawMessage || actions?.onEdit) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-150"
                title="更多操作"
                aria-label="更多操作"
              >
                <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 min-w-[120px]">
                  {canWithdrawMessage && (
                    <button
                      onClick={handleWithdraw}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      撤回
                    </button>
                  )}
                  {actions?.onEdit && (
                    <button
                      onClick={handleEdit}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      编辑
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Message Actions (Rating & Bookmark) */}
        {msg.role === 'assistant' && msg.content && (
          <div className="flex items-center gap-2 mt-2 justify-start">
            <button
              onClick={() => handleRate('up')}
              className={`p-2 rounded-lg transition-colors ${
                msg.rating === 'up'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 dark:hover:text-green-400'
              }`}
              title="有用"
              aria-label="点赞"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleRate('down')}
              className={`p-2 rounded-lg transition-colors ${
                msg.rating === 'down'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400'
              }`}
              title="无用"
              aria-label="点踩"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleBookmark}
              className={`p-2 rounded-lg transition-colors ${
                msg.bookmarked
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400'
              }`}
              title={msg.bookmarked ? '取消书签' : '添加书签'}
              aria-label={msg.bookmarked ? '取消书签' : '添加书签'}
            >
              <Bookmark className="w-4 h-4" />
            </button>
            <button
              onClick={handleReply}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="回复此消息"
              aria-label="回复"
            >
              <Reply className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Timestamp & Status */}
      <div className={`flex flex-col items-center gap-1 mt-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
        <time
          dateTime={new Date(msg.timestamp).toISOString()}
          className="text-[11px] sm:text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums"
        >
          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>

        {msg.role === 'user' && !msg.content && (
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-amber-500 dark:text-amber-400 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>发送中</span>
          </span>
        )}
        {msg.role === 'user' && msg.content && !isStreaming && (
          <CheckCircle
            className="w-4 h-4 text-green-500 dark:text-green-400"
            aria-label="已发送成功"
          />
        )}
        {msg.role === 'assistant' && isEmptyAssistantMsg && isStreaming && (
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-blue-500 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>思考中</span>
          </span>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.msg.id === nextProps.msg.id &&
    prevProps.msg.content === nextProps.msg.content &&
    prevProps.msg.isEdited === nextProps.msg.isEdited &&
    prevProps.msg.rating === nextProps.msg.rating &&
    prevProps.msg.bookmarked === nextProps.msg.bookmarked &&
    prevProps.msg.replyToId === nextProps.msg.replyToId &&
    prevProps.highlightedMessageId === nextProps.highlightedMessageId &&
    prevProps.isStreaming === nextProps.isStreaming
  )
})

export default EnhancedMessage
