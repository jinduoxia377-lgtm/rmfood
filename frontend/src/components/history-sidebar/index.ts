/**
 * 历史记录侧边栏组件导出
 * 参考 VS Code 侧边栏设计规范
 */

export { HistorySidebar } from './HistorySidebar'
export { SearchInput } from './SearchInput'
export { CategoryFilter } from './CategoryFilter'
export { TagFilter } from './TagFilter'
export { ConversationList } from './ConversationList'

export type {
  Conversation,
  Category,
  Tag,
  FilterState,
  SidebarConfig,
  SidebarActions,
  ConversationStatus,
  ConversationType,
} from './types'

export { mockConversations, categories, tags, generateLargeDataset } from './mockData'
