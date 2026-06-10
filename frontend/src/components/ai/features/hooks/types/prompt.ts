/**
 * 企业级提示词管理系统 - 类型定义
 *
 * 核心特性：
 * ✅ 多级分类系统（3级层级结构）
 * ✅ 模板变量替换机制
 * ✅ 使用统计与智能推荐
 * ✅ 完整CRUD操作支持
 * ✅ 导入/导出功能
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

// ============================================
// 基础类型定义
// ============================================

/** 提示词ID类型 */
export type PromptId = string

/** 分类ID类型 */
export type CategoryId = string

/** 模板变量类型 */
export interface TemplateVariable {
  /** 变量名（如 {{ingredient}}） */
  name: string
  /** 显示标签 */
  label: string
  /** 变量类型 */
  type: 'text' | 'number' | 'select' | 'multiline'
  /** 默认值 */
  defaultValue?: string
  /** 选项列表（type=select时必填） */
  options?: { label: string; value: string }[]
  /** 是否必填 */
  required?: boolean
  /** 占位符文本 */
  placeholder?: string
  /** 验证正则 */
  validation?: RegExp
}

// ============================================
// 提示词分类系统（3级结构）
// ============================================

export interface PromptCategory {
  id: CategoryId
  /** 分类名称 */
  name: string
  /** 分类图标（Lucide图标名） */
  icon?: string
  /** 分类描述 */
  description?: string
  /** 父分类ID（一级分类为null） */
  parentId: CategoryId | null
  /** 排序权重 */
  sortOrder: number
  /** 子分类列表 */
  children?: PromptCategory[]
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================
// 提示词模板实体
// ============================================

export interface PromptTemplate {
  id: PromptId
  /** 提示词标题 */
  title: string
  /** 提示词内容（支持{{variable}}变量） */
  content: string
  /** 所属分类ID */
  categoryId: CategoryId
  /** 简短描述 */
  description?: string
  /** 标签列表（用于搜索和筛选） */
  tags: string[]
  /** 模板变量定义 */
  variables: TemplateVariable[]
  /** 使用次数统计 */
  usageCount: number
  /** 最后使用时间 */
  lastUsedAt?: number
  /** 是否为内置系统提示词 */
  isBuiltin: boolean
  /** 是否收藏/置顶 */
  isFavorite: boolean
  /** 可见性 */
  visibility: 'public' | 'private' | 'team'
  /** 作者信息 */
  author?: {
    name: string
    avatar?: string
  }
  /** 版本号 */
  version: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================
// 使用记录与统计
// ============================================

export interface PromptUsageRecord {
  id: string
  promptId: PromptId
  /** 使用时间戳 */
  usedAt: number
  /** 使用上下文（对话主题等） */
  context?: string
  /** 用户评分（1-5） */
  rating?: number
  /** 反馈信息 */
  feedback?: string
}

// ============================================
// 智能推荐相关
// ============================================

export interface PromptRecommendation {
  prompt: PromptTemplate
  /** 推荐分数（0-100） */
  score: number
  /** 推荐原因 */
  reason: 'frequently_used' | 'context_match' | 'trending' | 'similar_to_history' | 'new_and_relevant'
  /** 匹配的关键词 */
  matchedKeywords?: string[]
}

// ============================================
// 导入/导出格式
// ============================================

export interface PromptExportData {
  version: string
  exportTime: number
  totalCount: number
  categories: PromptCategory[]
  templates: PromptTemplate[]
  usageRecords: PromptUsageRecord[]
}

// ============================================
// Hook返回类型
// ============================================

export interface UsePromptManagerReturn {
  // ===== 状态 =====
  categories: PromptCategory[]
  templates: PromptTemplate[]
  filteredTemplates: PromptTemplate[]
  selectedCategory: CategoryId | null
  searchQuery: string
  isLoading: boolean
  error: string | null

  // ===== 分类操作 =====
  selectCategory: (categoryId: CategoryId | null) => void
  getCategoryTree: () => PromptCategory[]
  getBreadcrumbs: (categoryId: CategoryId) => PromptCategory[]

  // ===== CRUD操作 =====
  createTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => PromptId
  updateTemplate: (id: PromptId, updates: Partial<PromptTemplate>) => void
  deleteTemplate: (id: PromptId) => void
  duplicateTemplate: (id: PromptId) => PromptId

  // ===== 收藏与排序 =====
  toggleFavorite: (id: PromptId) => void
  incrementUsage: (id: PromptId, context?: string) => void

  // ===== 搜索与过滤 =====
  searchTemplates: (query: string) => void
  filterByTags: (tags: string[]) => void
  getRecommendations: (limit?: number) => PromptRecommendation[]

  // ===== 变量处理 =====
  renderTemplate: (templateId: PromptId, variableValues: Record<string, string>) => string
  validateVariables: (templateId: PromptId, values: Record<string, string>) => { isValid: boolean; errors: Record<string, string> }

  // ===== 导入/导出 =====
  exportPrompts: (format?: 'json') => string
  importPrompts: (data: string) => { success: boolean; count: number; errors: string[] }

  // ===== 批量操作 =====
  batchDelete: (ids: PromptId[]) => void
  batchExport: (ids: PromptId[]) => string

  // ===== 持久化 =====
  saveToStorage: () => void
  loadFromStorage: () => boolean
  clearAllData: () => void
}

// ============================================
// UI组件Props
// ============================================

export interface PromptLibraryProps {
  onSelectPrompt: (prompt: PromptTemplate) => void
  onClose?: () => void
  className?: string
}

export interface PromptTemplateEditorProps {
  template?: PromptTemplate
  onSave: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void
  onCancel?: () => void
  className?: string
}
