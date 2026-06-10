/**
 * 历史记录侧边栏类型定义
 * 参考 VS Code 侧边栏设计规范
 */

// ── 对话类型 ──
export interface Conversation {
  id: string
  title: string
  content: string
  category: Category
  tags: string[]
  createdAt: Date
  updatedAt: Date
  unreadCount: number
  status: ConversationStatus
  type: ConversationType
}

export type ConversationStatus = 'active' | 'archived' | 'pinned'
export type ConversationType = 'chat' | 'formula' | 'report' | 'search'

// ── 分类类型 ──
export interface Category {
  id: string
  name: string
  icon: string
  count: number
  color?: string
}

// ── 标签类型 ──
export interface Tag {
  id: string
  name: string
  color: string
  count: number
}

// ── 筛选状态 ──
export interface FilterState {
  searchQuery: string
  selectedCategory: string | null
  selectedTags: string[]
  statusFilter: ConversationStatus | 'all'
  sortBy: 'date' | 'title' | 'unread'
  sortOrder: 'asc' | 'desc'
}

// ── 侧边栏配置 ──
export interface SidebarConfig {
  /** 是否可折叠 */
  collapsible: boolean
  /** 默认折叠状态（移动端） */
  defaultCollapsed: boolean
  /** 侧边栏宽度 */
  width: number
  /** 折叠后的宽度 */
  collapsedWidth: number
  /** 是否显示标签筛选 */
  showTagFilter: boolean
  /** 是否显示分类筛选 */
  showCategoryFilter: boolean
  /** 是否显示搜索 */
  showSearch: boolean
}

// ── 侧边栏动作 ──
export interface SidebarActions {
  onSelectConversation: (conversation: Conversation) => void
  onDeleteConversation: (id: string) => void
  onArchiveConversation: (id: string) => void
  onPinConversation: (id: string) => void
  onClearFilters: () => void
}

// ── 虚拟列表项 ──
export interface VirtualListItem {
  id: string
  type: 'header' | 'item' | 'divider'
  data?: Conversation | { title: string }
}
