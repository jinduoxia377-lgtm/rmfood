/**
 * SessionSidebar - 多会话侧边栏组件 (v1.0)
 *
 * 职责：
 * - 左侧边栏布局展示所有聊天会话
 * - 会话列表渲染（置顶优先、时间排序）
 * - 会话操作菜单（重命名/删除/导出/置顶/标签）
 * - 实时搜索过滤
 * - 新建会话入口
 * - 底部统计信息展示
 *
 * 功能特性：
 * ✅ 可折叠侧边栏（280px 宽度）
 * ✅ 置顶会话 📌 图标标识
 * ✅ 最近修改时间排序
 * ✅ 右键/三点菜单操作
 * ✅ 内联编辑会话名称
 * ✅ 搜索框实时过滤
 * ✅ 响应式设计（移动端适配）
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Download,
  Tag,
  MessageSquare,
  Clock,
  LayoutGrid,
  PanelLeftClose,
  PanelLeft,
  X,
  Check,
} from 'lucide-react'
import { useChatSessions } from '../hooks/useChatSessions'
import type { ChatSession } from '../hooks/useChatSessions'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

interface SessionSidebarProps {
  /** 当前活跃的会话 ID */
  activeSessionId?: string | null
  /** 会话切换回调 */
  onSessionChange?: (sessionId: string) => void
  /** 新建会话回调 */
  onNewSession?: () => void
  /** 是否折叠 */
  collapsed?: boolean
  /** 折叠状态变更回调 */
  onToggleCollapse?: () => void
  /** 自定义类名 */
  className?: string
  /** 自定义宽度（默认 280px） */
  width?: number
}

// ===== 常量定义 =====

const SIDEBAR_WIDTH = 280
const COLLAPSED_WIDTH = 56
const MAX_SEARCH_RESULTS = 50

// ===== 子组件：会话项 =====

/**
 * SessionItem - 单个会话条目组件
 */
interface SessionItemProps {
  session: ChatSession
  isActive: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

const SessionItem: React.FC<SessionItemProps> = React.memo(({
  session,
  isActive,
  onClick,
  onContextMenu,
}) => {
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className={`group/session flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-150 ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-700/50 border border-transparent'
      }`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      aria-label={`会话: ${session.title}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {session.pinned && (
            <span className="text-xs" title="已置顶">📌</span>
          )}
          <span className={`text-sm font-medium truncate ${
            isActive
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-neutral-900 dark:text-neutral-100'
          }`}>
            {session.title || '新对话'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <MessageSquare className="w-3 h-3" />
          <span>{session.messageCount} 条消息</span>
          <Clock className="w-3 h-3 ml-1" />
          <span>{formatTime(session.updatedAt)}</span>
        </div>
      </div>

      {!isActive && (
        <div className="opacity-0 group-hover/session:opacity-100 transition-opacity">
          <button
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600"
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu?.(e)
            }}
            aria-label="更多操作"
          >
            <MoreVertical className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      )}
    </div>
  )
})

SessionItem.displayName = 'SessionItem'

// ===== 子组件：操作菜单 =====

/**
 * SessionActionMenu - 会话操作下拉菜单
 */
interface SessionActionMenuProps {
  session: ChatSession
  visible: boolean
  position: { x: number; y: number }
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onTogglePin: () => void
  onExport: (format: string) => void
  onManageTags: () => void
}

const SessionActionMenu: React.FC<SessionActionMenuProps> = ({
  session,
  visible,
  position,
  onClose,
  onRename,
  onDelete,
  onTogglePin,
  onExport,
  onManageTags,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-40 w-52 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-1.5 animate-in fade-in zoom-in-95 duration-100"
        style={{
          left: Math.min(position.x, window.innerWidth - 220),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
      >
        <button
          onClick={() => { onRename(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <Pencil className="w-4 h-4" />
          <span>重命名</span>
        </button>

        <button
          onClick={() => { onTogglePin(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          {session.pinned ? (
            <>
              <PinOff className="w-4 h-4" />
              <span>取消置顶</span>
            </>
          ) : (
            <>
              <Pin className="w-4 h-4" />
              <span>置顶会话</span>
            </>
          )}
        </button>

        <button
          onClick={() => { onManageTags(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          <Tag className="w-4 h-4" />
          <span>标签管理</span>
        </button>

        <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />

        <div className="px-3 py-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase">
          导出格式
        </div>
        {['json', 'markdown', 'text'].map(format => (
          <button
            key={format}
            onClick={() => { onExport(format); onClose() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors pl-6"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{format.toUpperCase()}</span>
          </button>
        ))}

        <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />

        <button
          onClick={() => { onDelete(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>删除会话</span>
        </button>
      </div>
    </>
  )
}

// ===== 主组件实现 =====

/**
 * SessionSidebar - 多会话侧边栏组件
 *
 * 布局结构：
 * ┌─────────────────────────┐
 * │  标题栏 + 折叠按钮      │
 * ├─────────────────────────┤
 * │  [+ 新建] 搜索框         │
 * ├─────────────────────────┤
 * │  📌 置顶会话区域        │
 * │  - 会话项 1             │
 * │  - 会话项 2             │
 * ├─────────────────────────┤
 * │  普通会话列表           │
 * │  - 会话项 3             │
 * │  - 会话项 4             │
 * │  - ...                  │
 * ├─────────────────────────┤
 * │  底部统计               │
 * │  总计: N 个会话 M 条消息│
 * └─────────────────────────┘
 */
const SessionSidebar: React.FC<SessionSidebarProps> = ({
  activeSessionId = null,
  onSessionChange,
  onNewSession,
  collapsed = false,
  onToggleCollapse,
  className = '',
  width = SIDEBAR_WIDTH,
}) => {
  // Hook 集成
  const {
    sessions,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    pinSession,
    searchSessions,
    setSessionTags,
    exportSession,
    getStats,
  } = useChatSessions()

  // UI 状态
  const [searchQuery, setSearchQuery] = useState('')
  const [menuVisible, setMenuVisible] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isManagingTags, setIsManagingTags] = useState(false)
  const [tagInputValue, setTagInputValue] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /**
   * 排序后的会话列表（置顶优先 + 时间排序）
   */
  const sortedSessions = useMemo(() => {
    let filtered = sessions

    if (searchQuery.trim()) {
      filtered = searchSessions(searchQuery).slice(0, MAX_SEARCH_RESULTS)
    }

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [sessions, searchQuery, searchSessions])

  const pinnedSessions = sortedSessions.filter(s => s.pinned)
  const normalSessions = sortedSessions.filter(s => !s.pinned)
  const stats = getStats()

  /**
   * 处理会话点击
   */
  const handleSessionClick = useCallback((sessionId: string) => {
    switchSession(sessionId)
    onSessionChange?.(sessionId)
    logger.info(`[SessionSidebar] 切换到会话: ${sessionId}`)
  }, [switchSession, onSessionChange])

  /**
   * 处理新建会话
   */
  const handleNewSession = useCallback(() => {
    const sessionId = createSession()
    onNewSession?.()
    logger.info(`[SessionSidebar] 创建新会话: ${sessionId}`)
  }, [createSession, onNewSession])

  /**
   * 处理右键菜单
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setSelectedSessionId(sessionId)
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setMenuVisible(true)
  }, [])

  /**
   * 处理重命名确认
   */
  const handleRenameConfirm = useCallback(() => {
    if (selectedSessionId && renameValue.trim()) {
      renameSession(selectedSessionId, renameValue.trim())
      logger.info(`[SessionSidebar] 重命名完成: ${selectedSessionId}`)
    }
    setIsRenaming(false)
    setRenameValue('')
  }, [selectedSessionId, renameValue, renameSession])

  /**
   * 处理删除确认
   */
  const handleDeleteConfirm = useCallback(() => {
    if (selectedSessionId) {
      deleteSession(selectedSessionId)
      logger.info(`[SessionSidebar] 删除完成: ${selectedSessionId}`)
    }
    setShowDeleteConfirm(false)
    setSelectedSessionId(null)
  }, [selectedSessionId, deleteSession])

  /**
   * 处理导出
   */
  const handleExport = useCallback(async (format: string) => {
    if (!selectedSessionId) return

    try {
      const blob = await exportSession(selectedSessionId, format
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session_${selectedSessionId}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      logger.info(`[SessionSidebar] 导出成功: ${selectedSessionId}.${format}`)
    } catch (error) {
      logger.error('[SessionSidebar] 导出失败:', error)
    }
  }, [selectedSessionId, exportSession])

  /**
   * 处理标签添加
   */
  const handleAddTag = useCallback(() => {
    if (!selectedSessionId || !tagInputValue.trim()) return

    const session = sessions.find(s => s.id === selectedSessionId)
    if (!session) return

    const newTag = tagInputValue.trim()
    const updatedTags = session.tags.includes(newTag)
      ? session.tags
      : [...session.tags, newTag]

    setSessionTags(selectedSessionId, updatedTags)
    setTagInputValue('')
    logger.info(`[SessionSidebar] 已添加标签: ${newTag}`)
  }, [selectedSessionId, tagInputValue, sessions, setSessionTags])

  if (collapsed) {
    return (
      <div
        className={`h-full bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col items-center py-4 transition-all duration-300 ${className}`}
        style={{ width: COLLAPSED_WIDTH }}
      >
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 mb-4"
          title="展开侧边栏"
        >
          <PanelLeft className="w-5 h-5 text-neutral-500" />
        </button>

        <button
          onClick={handleNewSession}
          className="p-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 mb-4 shadow-md"
          title="新建会话"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto w-full px-1">
          {sortedSessions.slice(0, 10).map(session => (
            <button
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`w-full p-2 mb-1 rounded-lg transition-colors ${
                session.id === activeSessionId
                  ? 'bg-primary-100 dark:bg-primary-900/30'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
              title={session.title}
            >
              <MessageSquare className={`w-5 h-5 mx-auto ${
                session.id === activeSessionId ? 'text-primary-600' : 'text-neutral-400'
              }`} />
              {session.pinned && (
                <span className="block text-[10px] mt-0.5">📌</span>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`h-full bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col transition-all duration-300 ${className}`}
      style={{ width }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary-600" />
          对话历史
        </h2>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          title="折叠侧边栏"
        >
          <PanelLeftClose className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* 工具栏：新建 + 搜索 */}
      <div className="p-3 space-y-2">
        <button
          onClick={handleNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>新建会话</span>
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-slate-50 dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          )}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {/* 置顶会话 */}
        {pinnedSessions.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1 px-2">
              置顶 ({pinnedSessions.length})
            </div>
            {pinnedSessions.map(session => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => handleSessionClick(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)}
              />
            ))}
          </div>
        )}

        {/* 普通会话 */}
        <div className="px-3 py-2">
          {normalSessions.length > 0 && pinnedSessions.length > 0 && (
            <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1 px-2">
              最近 ({normalSessions.length})
            </div>
          )}

          {normalSessions.length === 0 && pinnedSessions.length === 0 && !searchQuery && (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无会话记录</p>
              <p className="text-xs mt-1">点击上方按钮创建新会话</p>
            </div>
          )}

          {normalSessions.length === 0 && searchQuery && (
            <div className="text-center py-8 text-neutral-400 dark:text-neutral-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">未找到匹配的会话</p>
              <p className="text-xs mt-1">尝试其他关键词</p>
            </div>
          )}

          {normalSessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => handleSessionClick(session.id)}
              onContextMenu={(e) => handleContextMenu(e, session.id)}
            />
          ))}
        </div>
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900/50">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5" />
              {stats.totalSessions} 个会话
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {stats.totalMessages} 条消息
            </span>
          </div>
          {stats.pinnedCount > 0 && (
            <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400">
              📌 {stats.pinnedCount}
            </span>
          )}
        </div>
      </div>

      {/* 操作菜单 */}
      <SessionActionMenu
        session={sessions.find(s => s.id === selectedSessionId) || {} as ChatSession}
        visible={menuVisible}
        position={menuPosition}
        onClose={() => setMenuVisible(false)}
        onRename={() => {
          const session = sessions.find(s => s.id === selectedSessionId)
          if (session) {
            setRenameValue(session.title)
            setIsRenaming(true)
          }
        }}
        onDelete={() => setShowDeleteConfirm(true)}
        onTogglePin={() => selectedSessionId && pinSession(selectedSessionId)}
        onExport={handleExport}
        onManageTags={() => setIsManagingTags(true)}
      />

      {/* 重命名对话框 */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              重命名会话
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
              autoFocus
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="输入新名称..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsRenaming(false)}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRenameConfirm}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-error-600 dark:text-error-400 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              确定要删除此会话吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 标签管理对话框 */}
      {isManagingTags && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              标签管理
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInputValue}
                  onChange={(e) => setTagInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  placeholder="输入标签名..."
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {sessions.find(s => s.id === selectedSessionId)?.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 text-xs rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => {
                        const session = sessions.find(s => s.id === selectedSessionId)
                        if (session) {
                          setSessionTags(
                            selectedSessionId!,
                            session.tags.filter(t => t !== tag),
                          )
                        }
                      }}
                      className="ml-0.5 hover:text-error-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsManagingTags(false)}
                className="px-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

SessionSidebar.displayName = 'SessionSidebar'

export { SessionSidebar }
export default SessionSidebar
