/**
 * ShareButton - 消息底部工具栏分享按钮 (v1.0)
 *
 * 功能定位：
 * - 作为 ChatSharePanel 的触发器，位于消息内容底部
 * - 提供悬浮/点击两种交互模式
 * - 支持键盘快捷键（Ctrl+Shift+S）
 * - 集成点赞/反馈功能
 *
 * 设计原则：
 * ✅ 极简设计（仅显示图标 + 轻量提示）
 * ✅ 悬浮时展开完整工具栏
 * ✅ 响应式适配（移动端优化）
 * ✅ 无障碍访问（ARIA 标签）
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-29
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'

import { logger } from '@/utils/safeLogger';
import {
  Share2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  ChevronLeft,
  Check,
} from 'lucide-react'

// ===== 类型定义 =====

export interface ShareButtonProps {
  /** 消息 ID */
  messageId: string
  /** 消息内容 */
  content: string
  /** 消息角色 */
  role: 'user' | 'assistant'
  /** 点击分享回调 */
  onShare?: () => void
  /** 点赞回调 */
  onLike?: () => void
  /** 点踩回调 */
  onDislike?: () => void
  /** 复制回调 */
  onCopy?: () => void
  /** 是否已点赞 */
  isLiked?: boolean
  /** 是否已点踩 */
  isDisliked?: boolean
  /** 自定义样式类名 */
  className?: string
}

// ===== 子组件：工具栏图标按钮 =====

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isActive?: boolean
  variant?: 'default' | 'success' | 'danger'
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  isActive,
  variant = 'default',
}) => {
  const baseClasses =
    'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-neutral-800'

  const variantClasses = {
    default:
      'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
    success: isActive
      ? 'text-success-600 bg-success-50 dark:bg-success-300/20'
      : 'text-neutral-500 hover:text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20',
    danger: isActive
      ? 'text-error-600 bg-error-50 dark:bg-error-300/20'
      : 'text-neutral-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  )
}

// ===== 主组件实现 =====

/**
 * ShareButton - 消息底部分享工具栏
 *
 * 使用示例：
 * ```tsx
 * <ShareButton
 *   messageId={message.id}
 *   content={message.content}
 *   role={message.role}
 *   onShare={() => setShowSharePanel(true)}
 *   onCopy={() => copyToClipboard(message.content)}
 * />
 * ```
 */
export function ShareButton({
  messageId,
  content,
  role,
  onShare,
  onLike,
  onDislike,
  onCopy,
  isLiked = false,
  isDisliked = false,
  className = '',
}: ShareButtonProps) {
  // ===== 状态管理 =====

  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // ===== 事件处理 =====

  /**
   * 切换工具栏展开状态
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  /**
   * 处理复制操作
   */
  const handleCopy = useCallback(async () => {
    try {
      if (onCopy) {
        onCopy()
      } else {
        await navigator.clipboard.writeText(content)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      // 2秒后自动收起
      setTimeout(() => setIsExpanded(false), 1500)
    } catch (err) {
      logger.error('[ShareButton] 复制失败:', err)
    }
  }, [content, onCopy])

  /**
   * 处理点赞操作
   */
  const handleLike = useCallback(() => {
    onLike?.()
  }, [onLike])

  /**
   * 处理点踩操作
   */
  const handleDislike = useCallback(() => {
    onDislike?.()
  }, [onDislike])

  /**
   * 处理分享操作
   */
  const handleShare = useCallback(() => {
    onShare?.()
    // 点击分享后自动收起工具栏
    setIsExpanded(false)
  }, [onShare])

  // ===== 点击外部关闭 =====

  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // ===== 键盘快捷键 =====

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + S 快捷键打开分享面板
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 's') {
        event.preventDefault()
        handleShare()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleShare])

  // ===== 渲染 =====

  return (
    <div
      ref={toolbarRef}
      className={`inline-flex items-center gap-1 ${className}`}
      role="toolbar"
      aria-label={`消息 ${messageId} 操作工具栏`}
    >
      {/* 收起状态：只显示核心图标 */}
      {!isExpanded ? (
        <div className="flex items-center gap-0.5 animate-fade-in">
          {/* 复制按钮 */}
          <ToolbarButton
            icon={<Copy className="w-4 h-4" />}
            label={`复制消息内容 (${content.length > 100 ? '长文本' : '短文本'})`}
            onClick={handleCopy}
          />

          {/* 返回/回复按钮（可选） */}
          {/* <ToolbarButton
            icon={<ChevronLeft className="w-4 h-4" />}
            label="回复此消息"
            onClick={() => {}}
          /> */}

          {/* 点赞按钮 */}
          {role === 'assistant' && (
            <ToolbarButton
              icon={
                isLiked ? (
                  <ThumbsUp className="w-4 h-4 fill-current" />
                ) : (
                  <ThumbsUp className="w-4 h-4" />
                )
              }
              label={isLiked ? '取消点赞' : '点赞'}
              onClick={handleLike}
              isActive={isLiked}
              variant="success"
            />
          )}

          {/* 分享按钮（主入口） */}
          <ToolbarButton
            icon={<Share2 className="w-4 h-4" />}
            label="更多选项"
            onClick={toggleExpanded}
          />

          {/* 更多按钮（展开入口） */}
          <ToolbarButton
            icon={<MoreHorizontal className="w-4 h-4" />}
            label="展开工具栏"
            onClick={toggleExpanded}
          />
        </div>
      ) : (
        /* 展开状态：显示完整工具栏 */
        <div className="relative flex items-center gap-1 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 animate-scale-in">
          {/* 左侧指示箭头 */}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-white dark:bg-neutral-800 border-l border-t border-neutral-200 dark:border-neutral-700 rotate-[-45deg]" />

          {/* 工具栏按钮组 */}
          <div className="flex items-center gap-0.5">
            {/* 复制 */}
            <ToolbarButton
              icon={copied ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
              label={copied ? '已复制' : '复制文本'}
              onClick={handleCopy}
              variant={copied ? 'success' : 'default'}
            />

            {/* 分隔线 */}
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

            {/* 点赞 */}
            {role === 'assistant' && (
              <>
                <ToolbarButton
                  icon={isLiked ? <ThumbsUp className="w-4 h-4 fill-current" /> : <ThumbsUp className="w-4 h-4" />}
                  label={isLiked ? '取消点赞' : '有帮助'}
                  onClick={handleLike}
                  isActive={isLiked}
                  variant="success"
                />

                <ToolbarButton
                  icon={isDisliked ? <ThumbsDown className="w-4 h-4 fill-current" /> : <ThumbsDown className="w-4 h-4" />}
                  label={isDisliked ? '取消点踩' : '无帮助'}
                  onClick={handleDislike}
                  isActive={isDisliked}
                  variant="danger"
                />
              </>
            )}

            {/* 分隔线 */}
            {(role === 'assistant') && <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />}

            {/* 主分享按钮 */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-container text-primary-main transition-all shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
              title="打开完整分享面板 (快捷键: Ctrl+Shift+S)"
              aria-label="打开分享面板"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>分享</span>
            </button>

            {/* 关闭按钮 */}
            <ToolbarButton
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
              label="收起工具栏"
              onClick={toggleExpanded}
            />
          </div>

          {/* 快捷键提示 */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Ctrl+Shift+S 快速分享
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 默认导出 =====

export default ShareButton
