/**
 * 历史记录侧边栏主组件
 * 参考 VS Code 侧边栏设计规范
 * 特性:
 * - 响应式适配（移动端可折叠）
 * - 虚拟列表高性能渲染
 * - 分类和标签筛选
 * - 搜索功能
 * - 平滑动画过渡
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  History, ChevronLeft, ChevronRight, Filter,
  SlidersHorizontal, X, RefreshCw, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/useMobile'
import { SearchInput } from './SearchInput'
import { CategoryFilter } from './CategoryFilter'
import { TagFilter } from './TagFilter'
import { ConversationList } from './ConversationList'
import type { Conversation, FilterState, SidebarConfig, SidebarActions } from './types'

interface HistorySidebarProps {
  conversations: Conversation[]
  config?: Partial<SidebarConfig>
  actions?: Partial<SidebarActions>
  selectedConversationId?: string | null
}

const defaultConfig: SidebarConfig = {
  collapsible: true,
  defaultCollapsed: false,
  width: 280,
  collapsedWidth: 48,
  showTagFilter: true,
  showCategoryFilter: true,
  showSearch: true,
}

export function HistorySidebar({
  conversations,
  config: customConfig,
  actions,
  selectedConversationId,
}: HistorySidebarProps) {
  const config = { ...defaultConfig, ...customConfig }
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  // 折叠状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return config.defaultCollapsed
    return false
  })

  // 移动端抽屉状态
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // 筛选状态
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    selectedCategory: null,
    selectedTags: [],
    statusFilter: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  })

  // 标签展开状态
  const [tagsExpanded, setTagsExpanded] = useState(false)

  // 处理折叠/展开
  const handleToggleCollapse = useCallback(() => {
    if (!config.collapsible) return
    setIsCollapsed((prev) => !prev)
  }, [config.collapsible])

  // 处理移动端抽屉
  const handleMobileToggle = useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  // 搜索变化
  const handleSearchChange = useCallback((value: string) => {
    setFilterState((prev) => ({ ...prev, searchQuery: value }))
  }, [])

  // 分类选择
  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setFilterState((prev) => ({ ...prev, selectedCategory: categoryId }))
  }, [])

  // 标签切换
  const handleTagToggle = useCallback((tagId: string) => {
    setFilterState((prev) => {
      const selectedTags = prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter((id) => id !== tagId)
        : [...prev.selectedTags, tagId]
      return { ...prev, selectedTags }
    })
  }, [])

  // 清除标签筛选
  const handleClearTags = useCallback(() => {
    setFilterState((prev) => ({ ...prev, selectedTags: [] }))
  }, [])

  // 清除所有筛选
  const handleClearFilters = useCallback(() => {
    setFilterState({
      searchQuery: '',
      selectedCategory: null,
      selectedTags: [],
      statusFilter: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
    })
    actions?.onClearFilters?.()
  }, [actions])

  // 选择对话
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    if (isMobile) {
      setIsMobileOpen(false)
    }
    actions?.onSelectConversation?.(conversation)
  }, [actions, isMobile])

  // 删除对话
  const handleDeleteConversation = useCallback((id: string) => {
    actions?.onDeleteConversation?.(id)
  }, [actions])

  // 归档对话
  const handleArchiveConversation = useCallback((id: string) => {
    actions?.onArchiveConversation?.(id)
  }, [actions])

  // 置顶对话
  const handlePinConversation = useCallback((id: string) => {
    actions?.onPinConversation?.(id)
  }, [actions])

  // 筛选和排序对话
  const filteredAndSortedConversations = useMemo(() => {
    let result = [...conversations]

    // 搜索过滤
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.content.toLowerCase().includes(query),
      )
    }

    // 分类过滤
    if (filterState.selectedCategory) {
      result = result.filter((c) => c.category.id === filterState.selectedCategory)
    }

    // 标签过滤（多选，必须包含所有选中的标签）
    if (filterState.selectedTags.length > 0) {
      result = result.filter((c) =>
        filterState.selectedTags.every((tagId) => c.tags.includes(tagId)),
      )
    }

    // 状态过滤
    if (filterState.statusFilter !== 'all') {
      result = result.filter((c) => c.status === filterState.statusFilter)
    }

    // 排序
    result.sort((a, b) => {
      let comparison = 0
      switch (filterState.sortBy) {
        case 'date':
          comparison = b.updatedAt.getTime() - a.updatedAt.getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title, 'zh-CN')
          break
        case 'unread':
          comparison = b.unreadCount - a.unreadCount
          break
      }
      return filterState.sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [conversations, filterState])

  // 是否有活跃筛选
  const hasActiveFilters = useMemo(() => {
    return (
      filterState.searchQuery !== '' ||
      filterState.selectedCategory !== null ||
      filterState.selectedTags.length > 0 ||
      filterState.statusFilter !== 'all'
    )
  }, [filterState])

  // 响应式：移动端自动切换
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true)
    } else {
      setIsCollapsed(false)
    }
  }, [isMobile])

  const sidebarWidth = isCollapsed ? config.collapsedWidth : config.width

  return (
    <>
      {/* 移动端遮罩 */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
           role="button" tabIndex={0} onClick={handleMobileToggle}
          aria-hidden={!isMobileOpen}
        />
      )}

      {/* 侧边栏主体 */}
      <aside
        className={cn(
          'flex flex-col transition-all duration-300 ease-out',
          'bg-surface-container border-r border-border',
          isMobile && isMobileOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : '',
          isDesktop && !isCollapsed ? 'h-full' : '',
        )}
        style={{
          width: isMobile && isMobileOpen ? 'calc(100% - 64px)' : sidebarWidth,
          maxWidth: isMobile && isMobileOpen ? '320px' : undefined,
          background: 'var(--bg-surface-container)',
          borderRight: '1px solid var(--border-color)',
          boxShadow: isMobile && isMobileOpen ? 'var(--shadow-xl)' : undefined,
          flexShrink: 0,
        }}
        aria-label="历史记录"
      >
        {/* 头部区域 */}
        <div
          className="flex items-center justify-between px-3 py-3 border-b"
          style={{
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {/* 移动端关闭按钮 */}
          {isMobile && isMobileOpen && (
            <button
              onClick={handleMobileToggle}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="关闭侧边栏"
            >
              <X size={18} />
            </button>
          )}

          {/* 标题 */}
          <div className="flex items-center gap-2">
            <History size={18} style={{ color: 'var(--color-primary)' }} />
            {!isCollapsed && (
              <h2
                className="font-semibold"
                style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--text-primary)',
                }}
              >
                历史记录
                <span
                  className="ml-2 text-xs font-normal"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ({conversations.length})
                </span>
              </h2>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            {/* 清除筛选 */}
            {!isCollapsed && hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label="清除所有筛选"
                title="清除筛选"
              >
                <Filter size={14} />
              </button>
            )}

            {/* 折叠按钮 */}
            {config.collapsible && (
              <button
                onClick={isMobile ? handleMobileToggle : handleToggleCollapse}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
                title={isCollapsed ? '展开' : '折叠'}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* 折叠状态 - 仅显示图标 */}
        {isCollapsed && (
          <div className="flex flex-col items-center py-4 gap-4">
            <button
              onClick={handleToggleCollapse}
              className="p-3 rounded-xl hover:bg-primary/10 transition-colors"
              style={{ color: 'var(--color-primary)' }}
              aria-label="历史记录"
              title="历史记录"
            >
              <History size={20} />
            </button>
            <button
              className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="新建对话"
              title="新建对话"
            >
              <Plus size={20} />
            </button>
            <button
              className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="刷新"
              title="刷新"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        )}

        {/* 展开状态 - 完整内容 */}
        {!isCollapsed && (
          <div className="flex flex-col h-[calc(100%-56px)]">
            {/* 筛选区域 */}
            <div className="p-3 space-y-3 border-b overflow-hidden">
              {/* 搜索 */}
              {config.showSearch && (
                <SearchInput
                  value={filterState.searchQuery}
                  onChange={handleSearchChange}
                  onClear={handleClearFilters}
                />
              )}

              {/* 分类筛选 */}
              {config.showCategoryFilter && (
                <CategoryFilter
                  categories={[
                    { id: 'all', name: '全部', icon: 'LayoutGrid', count: conversations.length, color: '#6B7280' },
                    { id: 'chat', name: 'AI 对话', icon: 'MessageSquare', count: conversations.filter((c) => c.type === 'chat').length, color: 'var(--color-primary-500)' },
                    { id: 'formula', name: '配方设计', icon: 'FlaskConical', count: conversations.filter((c) => c.type === 'formula').length, color: 'var(--color-secondary-500)' },
                    { id: 'report', name: '学术报告', icon: 'FileText', count: conversations.filter((c) => c.type === 'report').length, color: 'var(--color-accent-500)' },
                    { id: 'search', name: '检索记录', icon: 'Search', count: conversations.filter((c) => c.type === 'search').length, color: '#D97706' },
                  ]}
                  selectedCategory={filterState.selectedCategory}
                  onSelect={handleCategorySelect}
                />
              )}

              {/* 标签筛选 */}
              {config.showTagFilter && (
                <div className="space-y-2">
                  <button
                    onClick={() => setTagsExpanded((prev) => !prev)}
                    className="flex items-center justify-between w-full text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal size={14} />
                      标签筛选
                      {filterState.selectedTags.length > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: 'var(--color-primary-container)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          {filterState.selectedTags.length}
                        </span>
                      )}
                    </span>
                    <ChevronLeft
                      size={14}
                      className={`transition-transform duration-200 ${tagsExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {tagsExpanded && (
                    <div className="pl-6">
                      <TagFilter
                        tags={[
                          { id: 't1', name: '营养配方', color: 'var(--color-primary-500)', count: conversations.filter((c) => c.tags.includes('t1')).length },
                          { id: 't2', name: '护肤配方', color: 'var(--color-secondary-500)', count: conversations.filter((c) => c.tags.includes('t2')).length },
                          { id: 't3', name: 'AI生成', color: 'var(--color-accent-500)', count: conversations.filter((c) => c.tags.includes('t3')).length },
                          { id: 't4', name: '待审核', color: '#D97706', count: conversations.filter((c) => c.tags.includes('t4')).length },
                          { id: 't5', name: '已完成', color: 'var(--color-primary-400)', count: conversations.filter((c) => c.tags.includes('t5')).length },
                          { id: 't6', name: '研究中', color: '#D946EF', count: conversations.filter((c) => c.tags.includes('t6')).length },
                          { id: 't7', name: '紧急', color: '#FF3B30', count: conversations.filter((c) => c.tags.includes('t7')).length },
                          { id: 't8', name: '客户需求', color: 'var(--color-info-600)', count: conversations.filter((c) => c.tags.includes('t8')).length },
                        ]}
                        selectedTags={filterState.selectedTags}
                        onToggle={handleTagToggle}
                        onClearAll={handleClearTags}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 列表区域 */}
            <div className="flex-1 overflow-hidden">
              <ConversationList
                conversations={filteredAndSortedConversations}
                selectedId={selectedConversationId ?? null}
                onSelect={handleSelectConversation}
                onDelete={handleDeleteConversation}
                onArchive={handleArchiveConversation}
                onPin={handlePinConversation}
              />
            </div>

            {/* 底部操作栏 */}
            <div
              className="p-3 border-t flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(var(--color-primary-rgb), 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--color-primary-rgb), 0.3)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--color-primary-rgb), 0.2)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                aria-label="新建对话"
              >
                <Plus size={14} />
                新建对话
              </button>
              <button
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label="刷新列表"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 移动端触发按钮 */}
      {isMobile && !isMobileOpen && (
        <button
          onClick={handleMobileToggle}
          className="fixed bottom-6 right-6 z-30 p-3 rounded-full shadow-lg transition-all"
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(var(--color-primary-rgb), 0.4)',
          }}
          aria-label="打开历史记录"
        >
          <History size={20} />
        </button>
      )}
    </>
  )
}
