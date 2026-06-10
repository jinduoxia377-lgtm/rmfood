/**
 * 对话列表组件
 * 使用虚拟列表实现高性能渲染（支持1000+条数据）
 * 参考 VS Code 文件树设计
 */

import React, { useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  MessageSquare, FlaskConical, FileText, Search,
  Pin, PinOff, Archive, Trash2, MoreVertical, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conversation } from './types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conversation: Conversation) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onPin: (id: string) => void
}

const iconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  chat: MessageSquare,
  formula: FlaskConical,
  report: FileText,
  search: Search,
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  onArchive,
  onPin,
  style,
}: {
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onArchive: () => void
  onPin: () => void
  style?: React.CSSProperties
}) {
  const Icon = iconMap[conversation.type] || MessageSquare

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // 小于1分钟
    if (diff < 60000) return '刚刚'
    // 小于1小时
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    // 小于24小时
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    // 今年
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'M月d日', { locale: zhCN })
    }
    // 其他
    return format(date, 'yyyy年M月d日', { locale: zhCN })
  }

  return (
    <div
      style={style}
      className={cn(
        'relative flex items-start gap-3 p-2 rounded-lg cursor-pointer',
        'transition-all duration-150 select-none',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800',
        isSelected && 'bg-primary/5 dark:bg-primary/10',
      )}
      onClick={onSelect}
      aria-selected={isSelected}
      aria-label={conversation.title}
    >
      {/* 状态指示 */}
      {isSelected && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
          style={{ background: 'var(--color-primary)' }}
        />
      )}

      {/* 图标 */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center rounded-md',
          isSelected ? 'bg-primary text-white' : 'bg-neutral-100 dark:bg-neutral-700',
        )}
        style={{ width: '32px', height: '32px' }}
      >
        <Icon size={16} strokeWidth={isSelected ? 2 : 1.5} />
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              'font-medium truncate',
              isSelected ? 'text-primary' : 'text-primary dark:text-white',
            )}
            style={{ fontSize: 'var(--text-body-sm)' }}
          >
            {conversation.title}
          </h3>
          {conversation.unreadCount > 0 && (
            <span
              className="flex-shrink-0 flex items-center justify-center min-w-[20px] h-[20px] rounded-full text-xs font-semibold px-1.5"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
              }}
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>

        <p
          className="truncate text-xs mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          {conversation.content}
        </p>

        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex items-center gap-1.5">
            {/* 置顶标签 */}
            {conversation.status === 'pinned' && (
              <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--color-warning)' }}>
                <Pin size={10} />
                置顶
              </span>
            )}
            {/* 归档标签 */}
            {conversation.status === 'archived' && (
              <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Archive size={10} />
                已归档
              </span>
            )}
            {/* 分类标签 */}
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: `${conversation.category.color}20`,
                color: conversation.category.color,
              }}
            >
              {conversation.category.name}
            </span>
          </div>

          {/* 更新时间 */}
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={10} />
            {formatDate(conversation.updatedAt)}
          </span>
        </div>
      </div>

      {/* 操作菜单 */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
          }}
          className={cn(
            'p-1.5 rounded-md opacity-0 group-hover:opacity-100',
            'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all',
          )}
          style={{ opacity: isSelected ? 1 : 0 }}
          aria-label="更多操作"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  )
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onDelete,
  onArchive,
  onPin,
}: ConversationListProps) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 88, []),
    overscan: 5,
  })

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.status === 'pinned'),
    [conversations],
  )

  const activeConversations = useMemo(
    () => conversations.filter((c) => c.status === 'active'),
    [conversations],
  )

  const archivedConversations = useMemo(
    () => conversations.filter((c) => c.status === 'archived'),
    [conversations],
  )

  const renderSection = (
    title: string,
    items: Conversation[],
    showHeader: boolean,
  ) => {
    if (items.length === 0) return null

    const startIndex = conversations.indexOf(items[0])
    const endIndex = startIndex + items.length

    return (
      <div key={title}>
        {showHeader && (
          <div className="px-3 py-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {title} ({items.length})
            </span>
          </div>
        )}
        {virtualizer.getVirtualItems().map((virtualItem) => {
          if (virtualItem.index >= startIndex && virtualItem.index < endIndex) {
            const conversation = conversations[virtualItem.index]
            return (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onSelect={() => onSelect(conversation)}
                onDelete={() => onDelete(conversation.id)}
                onArchive={() => onArchive(conversation.id)}
                onPin={() => onPin(conversation.id)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              />
            )
          }
          return null
        })}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: 'var(--bg-surface-container-low)' }}
        >
          <MessageSquare size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)' }}>
          暂无对话记录
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-caption)' }}>
          开始新对话后会在这里显示
        </p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="relative overflow-y-auto"
      style={{
        height: '100%',
        minHeight: '200px',
      }}
    >
      {/* 虚拟列表容器 */}
      <div
        className="relative"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {renderSection('置顶', pinnedConversations, pinnedConversations.length > 0)}
        {renderSection('对话', activeConversations, pinnedConversations.length > 0 || activeConversations.length > 0)}
        {renderSection('归档', archivedConversations, archivedConversations.length > 0)}
      </div>
    </div>
  )
}
