/**
 * PromptLibrary - 企业级提示词库UI组件
 *
 * 功能特性：
 * ✅ 多级分类导航（面包屑 + 树形结构）
 * ✅ 智能搜索与过滤
 * ✅ 模板卡片展示（含使用统计、收藏状态）
 * ✅ 一键插入与变量填充
 * ✅ 智能推荐区域
 * ✅ 响应式布局（桌面端/平板端/移动端）
 * ✅ 无障碍访问支持（ARIA、键盘导航）
 * ✅ 深色模式适配
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useCallback, useMemo } from 'react'
import { usePromptManager } from '../hooks/usePromptManager'
import {
  PromptTemplate,
  PromptCategory,
  PromptRecommendation,
} from '../hooks/types/prompt'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui'
import {
  Search,
  Star,
  Heart,
  Copy,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronDown,
  Filter,
  TrendingUp,
  Clock,
  Zap,
  X,
  Plus,
  Download,
  Upload,
  FileText,
  Tag,
  BookOpen,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

interface PromptLibraryProps {
  /** 选择提示词回调 */
  onSelectPrompt: (prompt: PromptTemplate, renderedContent?: string) => void
  /** 关闭回调 */
  onClose?: () => void
  /** 自定义类名 */
  className?: string
  /** 是否显示 */
  visible?: boolean
}

export const PromptLibrary: React.FC<PromptLibraryProps> = ({
  onSelectPrompt,
  onClose,
  className,
  visible = true,
}) => {
  const promptManager = usePromptManager()
  const { error: toastError, warning: toastWarning, success: toastSuccess } = useToast()

  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'library' | 'recommendations' | 'favorites'>('library')
  const [showImportExport, setShowImportExport] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['cat_formula', 'cat_nutrition']))

  if (!visible) return null

  // ===== 分类导航 =====

  const toggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }, [])

  const renderCategoryTree = useCallback(
    (categories: PromptCategory[], level = 0) => {
      return categories.map(category => {
        const hasChildren = category.children && category.children.length > 0
        const isExpanded = expandedCategories.has(category.id)
        const isSelected = promptManager.selectedCategory === category.id

        return (
          <div key={category.id}>
            <button
              onClick={() => {
                if (hasChildren) {
                  toggleCategoryExpand(category.id)
                }
                promptManager.selectCategory(category.id)
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-150',
                'hover:bg-neutral-100 dark:hover:bg-neutral-700/50',
                isSelected
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-neutral-700 dark:text-neutral-300',
              )}
              style={{ paddingLeft: `${level * 16 + 12}px` }}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                )
              ) : (
                <div className="w-4" />
              )}
              <BookOpen className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <span className="flex-1 text-left">{category.name}</span>
              {category.children && (
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{category.children.length}</span>
              )}
            </button>

            {hasChildren && isExpanded && (
              <div className="ml-2">
                {renderCategoryTree(category.children || [], level + 1)}
              </div>
            )}
          </div>
        )
      })
    },
    [promptManager.selectedCategory, expandedCategories, toggleCategoryExpand],
  )

  // ===== 模板操作 =====

  const handleSelectPrompt = useCallback(
    (template: PromptTemplate) => {
      if (template.variables.length > 0) {
        setEditingTemplate(template)
        setVariableValues({})
        setShowEditor(true)
      } else {
        const renderedContent = promptManager.renderTemplate(template.id, {})
        promptManager.incrementUsage(template.id)
        onSelectPrompt(template, renderedContent)
      }
    },
    [onSelectPrompt, promptManager],
  )

  const handleInsertWithVariables = useCallback(() => {
    if (!editingTemplate) return

    const validation = promptManager.validateVariables(editingTemplate.id, variableValues)

    if (!validation.isValid) {
      toastError('请填写所有必填项')
      return
    }

    const renderedContent = promptManager.renderTemplate(editingTemplate.id, variableValues)
    promptManager.incrementUsage(editingTemplate.id)
    onSelectPrompt(editingTemplate, renderedContent)
    setShowEditor(false)
    setEditingTemplate(null)
  }, [editingTemplate, variableValues, onSelectPrompt, promptManager])

  // ===== 推荐列表 =====

  const recommendations = useMemo(
    () => promptManager.getRecommendations(8),
    [promptManager],
  )

  // ===== 导入/导出处理 =====

  const handleExport = useCallback(() => {
    const data = promptManager.exportPrompts()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rmfood-prompts-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    setShowImportExport(false)
  }, [promptManager])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        const result = promptManager.importPrompts(content)

        if (result.success) {
          toastSuccess(`成功导入 ${result.count} 个模板`)
        } else {
          toastWarning(`导入完成：${result.count} 成功，${result.errors.length} 失败`)
        }

        setShowImportExport(false)
      }
      reader.readAsText(file)
    },
    [promptManager],
  )

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
        'animate-[fadeIn_0.2s_ease-out]',
      )}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      role="dialog"
      aria-modal="true"
      aria-label="提示词库"
    >
      <div
        className={cn(
          'relative w-full max-w-6xl max-h-[85vh] m-4',
          'bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl',
          'border border-neutral-200 dark:border-neutral-700',
          'flex overflow-hidden',
          className,
        )}
      >
        {/* ===== 头部栏 ===== */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">智能提示词库</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                共 {promptManager.templates.length} 个模板 · {promptManager.filteredTemplates.length} 个可见
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportExport(!showImportExport)}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="导入/导出"
            >
              <Download className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>

            <button
              onClick={() => {
                setEditingTemplate(null)
                setShowEditor(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container hover:bg-primary-container text-primary-main rounded-lg transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {/* ===== 主体内容区 ===== */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：分类导航 */}
          <aside className="w-64 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto p-4 bg-slate-50/50 dark:bg-neutral-800/30">
            <h3 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-3 px-3">
              分类导航
            </h3>

            <button
              onClick={() => promptManager.selectCategory(null)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg mb-1 transition-all duration-150',
                !promptManager.selectedCategory
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50',
              )}
            >
              <BookOpen className="w-4 h-4" />
              全部模板
            </button>

            <div className="mt-2 space-y-1">{renderCategoryTree(promptManager.getCategoryTree())}</div>

            {/* 统计信息 */}
            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="px-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <span>收藏</span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {promptManager.templates.filter(t => t.isFavorite).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <span>自定义</span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {promptManager.templates.filter(t => !t.isBuiltin).length}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* 中间：主内容区 */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Tab切换 */}
            <div className="flex items-center gap-1 px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <button
                onClick={() => setActiveTab('library')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeTab === 'library'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                提示词库
              </button>
              <button
                onClick={() => setActiveTab('recommendations')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors relative',
                  activeTab === 'recommendations'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                智能推荐
                {recommendations.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
                    {recommendations.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeTab === 'favorites'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                <Heart className="w-4 h-4 inline mr-2" />
                收藏夹
              </button>
            </div>

            {/* 搜索栏 */}
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="搜索提示词（标题、描述、标签）..."
                  value={promptManager.searchQuery}
                  onChange={(e) => promptManager.searchTemplates(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-400 transition-all"
                />
                {promptManager.searchQuery && (
                  <button
                    onClick={() => promptManager.searchTemplates('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
                  >
                    <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  </button>
                )}
              </div>
            </div>

            {/* 内容列表 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'library' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promptManager.filteredTemplates.map((template) => (
                    <PromptCard
                      key={template.id}
                      template={template}
                      onSelect={() => handleSelectPrompt(template)}
                      onToggleFavorite={() => promptManager.toggleFavorite(template.id)}
                      onEdit={() => {
                        setEditingTemplate(template)
                        setShowEditor(true)
                      }}
                      onDelete={() => {
                        if (confirm('确定要删除此模板吗？')) {
                          promptManager.deleteTemplate(template.id)
                        }
                      }}
                      onDuplicate={() => promptManager.duplicateTemplate(template.id)}
                    />
                  ))}

                  {promptManager.filteredTemplates.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">未找到匹配的提示词</p>
                      <p className="text-sm mt-2">尝试调整搜索条件或选择其他分类</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'recommendations' && (
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <RecommendationCard
                      key={rec.prompt.id}
                      recommendation={rec}
                      rank={index + 1}
                      onSelect={() => handleSelectPrompt(rec.prompt)}
                    />
                  ))}

                  {recommendations.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <Zap className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">暂无推荐</p>
                      <p className="text-sm mt-2">使用更多提示词后，系统将为您智能推荐</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'favorites' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promptManager.templates
                    .filter(t => t.isFavorite)
                    .map((template) => (
                      <PromptCard
                        key={template.id}
                        template={template}
                        onSelect={() => handleSelectPrompt(template)}
                        onToggleFavorite={() => promptManager.toggleFavorite(template.id)}
                        onEdit={() => {
                          setEditingTemplate(template)
                          setShowEditor(true)
                        }}
                        onDelete={() => {
                          if (confirm('确定要删除此模板吗？')) {
                            promptManager.deleteTemplate(template.id)
                          }
                        }}
                        onDuplicate={() => promptManager.duplicateTemplate(template.id)}
                      />
                    ))}

                  {promptManager.templates.filter(t => t.isFavorite).length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <Heart className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">暂无收藏</p>
                      <p className="text-sm mt-2">点击提示词卡片的星标图标即可收藏</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ===== 变量编辑器（模态框） ===== */}
        {showEditor && editingTemplate && (
          <VariableEditorModal
            template={editingTemplate}
            values={variableValues}
            onChange={setVariableValues}
            onConfirm={handleInsertWithVariables}
            onCancel={() => {
              setShowEditor(false)
              setEditingTemplate(null)
            }}
          />
        )}

        {!showEditor && !editingTemplate && showEditor && (
          <VariableEditorModal
            template={{
              id: '',
              title: '',
              content: '',
              categoryId: '',
              tags: [],
              variables: [],
              isBuiltin: false,
              isFavorite: false,
              visibility: 'public',
              version: '1.0.0',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              usageCount: 0,
            }}
            values={{}}
            onChange={setVariableValues}
            onConfirm={() => {}}
            onCancel={() => setShowEditor(false)}
          />
        )}

        {/* ===== 导入/导出面板 ===== */}
        {showImportExport && (
          <div className="absolute bottom-4 right-4 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                导出全部
              </button>

              <label className="flex items-center gap-2 px-4 py-2 bg-secondary-container hover:bg-secondary-container text-secondary-main rounded-lg text-sm font-medium cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                导入文件
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>

              <button
                onClick={() => setShowImportExport(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
              >
                <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// 子组件：提示词卡片
// ============================================

interface PromptCardProps {
  template: PromptTemplate
  onSelect: () => void
  onToggleFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}

const PromptCard: React.FC<PromptCardProps> = ({
  template,
  onSelect,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const [showActions, setShowActions] = useState(false)

  return (
    <article
      className={cn(
        'group relative p-5 rounded-xl border transition-all duration-200 cursor-pointer',
        'bg-white dark:bg-neutral-800/50',
        'border-neutral-200 dark:border-neutral-700',
        'hover:border-primary-300 dark:hover:border-primary-600',
        'hover:shadow-lg hover:shadow-primary-500/10',
        template.isFavorite && 'ring-2 ring-yellow-400/30 dark:ring-yellow-500/20',
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
    >
      {/* 头部：标题 + 收藏按钮 */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white line-clamp-1 flex-1 mr-2">
          {template.title}
        </h3>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title={template.isFavorite ? '取消收藏' : '收藏'}
          >
            <Heart
              className={cn(
                'w-4 h-4',
                template.isFavorite
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-yellow-400',
              )}
            />
          </button>
        </div>
      </div>

      {/* 描述 */}
      {template.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
          {template.description}
        </p>
      )}

      {/* 变量标签 */}
      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {template.variables.map(v => (
            <span
              key={v.name}
              className="inline-flex items-center px-2 py-0.5 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 text-xs font-mono rounded-md"
            >
              {'{{'}{v.label}{'}}'}
            </span>
          ))}
        </div>
      )}

      {/* 标签 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {template.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs rounded-full"
          >
            <Tag className="w-3 h-3 mr-1" />
            {tag}
          </span>
        ))}
        {template.tags.length > 3 && (
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+{template.tags.length - 3}</span>
        )}
      </div>

      {/* 底部：统计信息 + 操作按钮 */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
        <div className="flex items-center gap-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            使用 {template.usageCount} 次
          </span>
          {template.isBuiltin && (
            <span className="px-1.5 py-0.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded text-[11px] font-medium">
              内置
            </span>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 transition-opacity',
            showActions ? 'opacity-100' : 'opacity-0',
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title="编辑"
          >
            <Edit3 className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title="复制"
          >
            <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
          {!template.isBuiltin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4 text-error-400" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

// ============================================
// 子组件：推荐卡片
// ============================================

interface RecommendationCardProps {
  recommendation: PromptRecommendation
  rank: number
  onSelect: () => void
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  rank,
  onSelect,
}) => {
  const reasonLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    frequently_used: {
      label: '高频使用',
      color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    context_match: {
      label: '最近活跃',
      color: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    trending: {
      label: '上升趋势',
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    similar_to_history: {
      label: '上下文匹配',
      color: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    new_and_relevant: {
      label: '新模板',
      color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      icon: <Star className="w-3.5 h-3.5" />,
    },
  }

  const reasonInfo = reasonLabels[recommendation.reason] || reasonLabels.frequently_used

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left group"
    >
      {/* 排名 */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
          rank <= 3
            ? 'bg-gradient-to-br from-primary-500 to-violet-500 text-white shadow-lg'
            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
        )}
      >
        {rank}
      </div>

      {/* 信息区 */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-neutral-900 dark:text-white truncate">
          {recommendation.prompt.title}
        </h4>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
          {recommendation.prompt.description || recommendation.prompt.content.slice(0, 80)}...
        </p>
      </div>

      {/* 推荐原因标签 */}
      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0', reasonInfo.color)}>
        {reasonInfo.icon}
        {reasonInfo.label}
      </div>

      {/* 分数 */}
      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
          {recommendation.score}
        </div>
        <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">分</div>
      </div>
    </button>
  )
}

// ============================================
// 子组件：变量编辑器模态框
// ============================================

interface VariableEditorModalProps {
  template: PromptTemplate
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  onConfirm: () => void
  onCancel: () => void
}

const VariableEditorModal: React.FC<VariableEditorModalProps> = ({
  template,
  values,
  onChange,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-primary-50 to-white dark:from-primary-900/20 dark:to-slate-900">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
            填写模板变量
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            "{template.title}" 需要以下信息：
          </p>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {template.variables.map(variable => (
            <div key={variable.name}>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {variable.label}
                {variable.required && <span className="text-error-500 ml-1">*</span>}
              </label>

              {variable.type === 'select' ? (
                <select
                  value={values[variable.name] || ''}
                  onChange={e =>
                    onChange({ ...values, [variable.name]: e.target.value })
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="">请选择...</option>
                  {variable.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : variable.type === 'multiline' ? (
                <textarea
                  placeholder={variable.placeholder || `请输入${variable.label}`}
                  value={values[variable.name] || ''}
                  onChange={e =>
                    onChange({ ...values, [variable.name]: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              ) : (
                <input
                  type={variable.type === 'number' ? 'number' : 'text'}
                  placeholder={variable.placeholder || `请输入${variable.label}`}
                  value={values[variable.name] || ''}
                  onChange={e =>
                    onChange({ ...values, [variable.name]: e.target.value })
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              )}

              {variable.placeholder && variable.type !== 'multiline' && variable.type !== 'select' && (
                <p className="mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{variable.placeholder}</p>
              )}
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 text-sm font-medium text-primary-main bg-primary-container hover:bg-primary-container rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            确认插入
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromptLibrary
