/**
 * DSH 风格的消息操作行
 *
 * 设计原则（参考 DeepSeek Harness MessageIconActions）：
 * 1. 时间在前，操作在后（用户侧）；时间在后，操作在前（AI 侧）
 * 2. 仅保留核心操作：复制 + 分支 + 辅助操作
 * 3. 移除噪音操作：点赞/点踩/删除（合并到更多菜单）
 * 4. Hover 才显示，默认完全不可见
 *
 * @version 2.1.0
 */
import React from 'react'
import { Copy, Check, Pencil, Undo2, RefreshCw, MoreHorizontal } from 'lucide-react'

export interface DSActionsProps {
  time: string
  role: 'user' | 'assistant'
  isStreaming?: boolean
  onCopy: () => void
  copied?: boolean
  onEdit?: () => void
  onRetract?: () => void
  onRegenerate?: () => void
  /** 子菜单回调 */
  onMore?: () => void
}

export default function DSActions({
  time,
  role,
  onCopy,
  copied,
  onEdit,
  onRetract,
  onRegenerate,
  onMore,
}: DSActionsProps) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {/* 时间戳 — DSH 风格：小字 muted */}
      <span className="text-xs text-neutral-400 dark:text-neutral-400 mr-1 font-mono select-none">
        {time}
      </span>

      {/* 复制按钮 */}
      <button
        onClick={onCopy}
        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        title={copied ? '已复制' : '复制'}
        aria-label="复制消息"
      >
        {copied
          ? <Check className="w-3 h-3 text-success-500" />
          : <Copy className="w-3 h-3" />
        }
      </button>

      {/* 用户专属操作 */}
      {role === 'user' && onEdit && (
        <button
          onClick={onEdit}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          title="编辑"
          aria-label="编辑消息"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      {role === 'user' && onRetract && (
        <button
          onClick={onRetract}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          title="撤回"
          aria-label="撤回消息"
        >
          <Undo2 className="w-3 h-3" />
        </button>
      )}

      {/* AI 专属操作 */}
      {role === 'assistant' && onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          title="重新生成"
          aria-label="重新生成"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}

      {/* 更多操作 */}
      {onMore && (
        <button
          onClick={onMore}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
          title="更多"
          aria-label="更多操作"
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
