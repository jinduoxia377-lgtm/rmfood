/**
 * 术语管理页面
 * 覆盖后端 18 个 API 端点：
 * - 术语分类 CRUD (5 个端点)
 * - 术语 CRUD (5 个端点)
 * - 术语验证 (2 个端点)
 * - 术语搜索 (2 个端点)
 * - 术语建议 (1 个端点)
 * - 术语变体 CRUD (3 个端点)
 * - 标准化规则 CRUD (4 个端点)
 * - 统计 (1 个端点)
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Modal, Pagination, Card, CardHeader, CardTitle, CardContent, Tabs, TabsList, TabsTrigger, TabsContent,
  StatCard, Alert,
} from '@/components/ui'
import * as terminologyApi from '@/api/terminology'
import type { Term, TermCategory, TermCategoryCreate, TermStatistics, TermValidationResponse, TermVariant } from '@/api/terminology'
import { activityApi, type TimelineEvent } from '@/api/activity'
import {
  BookOpen, Search, Tag, Settings, BarChart3, Plus, Trash2, Edit2, X, Check,
  FileText, List, Database, RefreshCw, Clock, ShieldCheck, ChevronDown, ChevronRight,
  Eye, Type, Activity,
} from 'lucide-react'
import { TableSkeleton, EmptyState } from '@/components/ui'

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

function buildCategoryTree(flat: TermCategory[]): TermCategory[] {
  const map = new Map<number, TermCategory>()
  const roots: TermCategory[] = []
  flat?.forEach((c) => map.set(c.id, { ...c, children: [] }))
  flat?.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      (map.get(c.parent_id)?.children || []).push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} 天前`
}

// ═══════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════

export default function TerminologyPage() {
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 顶部横幅 */}
      <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">术语库管理</h1>
            <p className="mt-1 text-white/90 text-sm">管理药食同源专业术语库，支持分类、验证、搜索和标准化</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={() => {
                useQueryClient().invalidateQueries({ queryKey: ['terminology-statistics'] })
                useQueryClient().invalidateQueries({ queryKey: ['terminology-categories'] })
                useQueryClient().invalidateQueries({ queryKey: ['terminology-terms'] })
              }}
            >
              刷新数据
            </Button>
          </div>
        </div>
      </div>

      {/* 统计卡片行 */}
      <StatCardsRow />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="categories" className="gap-2">
            <Database className="w-4 h-4" />
            术语分类
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-2">
            <BookOpen className="w-4 h-4" />
            术语管理
          </TabsTrigger>
          <TabsTrigger value="variants" className="gap-2">
            <Type className="w-4 h-4" />
            术语变体
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-2">
            <Check className="w-4 h-4" />
            术语验证
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="w-4 h-4" />
            标准化规则
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoryManagementTab />
        </TabsContent>
        <TabsContent value="terms">
          <TermManagementTab />
        </TabsContent>
        <TabsContent value="variants">
          <VariantManagementTab />
        </TabsContent>
        <TabsContent value="validation">
          <ValidationTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
      </Tabs>

      {/* 最近活动 */}
      <RecentActivitySection />
    </div>
  )
}

// ═══════════════════════════════════════════════
// 统计卡片行
// ═══════════════════════════════════════════════

function StatCardsRow() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['terminology-statistics'],
    queryFn: terminologyApi.getStatistics,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      label: '术语总数',
      value: stats.total_terms,
      icon: BookOpen,
      variant: 'primary' as const,
    },
    {
      label: '分类数量',
      value: stats.total_categories,
      icon: Database,
      variant: 'secondary' as const,
    },
    {
      label: '标准术语',
      value: stats.category_stats?.reduce((sum, c) => sum + c.term_count, 0) ?? 0,
      icon: ShieldCheck,
      variant: 'success' as const,
    },
    {
      label: '验证次数',
      value: stats.total_validations,
      icon: Check,
      variant: 'info' as const,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          variant={card.variant}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// 最近活动
// ═══════════════════════════════════════════════

function RecentActivitySection() {
  const { data: timelineData, isLoading } = useQuery({
    queryKey: ['terminology-activity'],
    queryFn: ({ signal }) => activityApi.timeline(7, signal),
    staleTime: 5 * 60_000,
  })

  const terminologyEvents = useMemo(() => {
    if (!timelineData?.items) return []
    const termRelatedTypes = ['term', 'category']
    return timelineData.items.filter((e) => termRelatedTypes.includes(e.type)).slice(0, 5)
  }, [timelineData])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h3" className="text-sm font-bold">最近术语活动</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (terminologyEvents.length === 0) return null

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle as="h3" className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Clock size={14} />
          最近术语活动
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="space-y-3">
          {terminologyEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{event.title}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">{formatRelativeTime(event.created_at)}</span>
              </div>
              {event.status && (
                <Badge variant={event.status === 'success' ? 'success' : 'info'} size="sm">
                  {event.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════
// 分类树节点（递归）
// ═══════════════════════════════════════════════

function CategoryTreeNode({
  category,
  allCategories,
  onEdit,
  onDelete,
  depth,
}: {
  category: TermCategory
  allCategories: TermCategory[]
  onEdit: (c: TermCategory) => void
  onDelete: (id: number) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const children = allCategories.filter((c) => c.parent_id === category.id)
  const hasChildren = children.length > 0

  return (
    <>
      <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
        <td className="px-4 py-3" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
          <div className="flex items-center gap-1">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {!hasChildren && <span className="w-5" />}
            <span className="font-medium">{category.name}</span>
            {category.level > 1 && (
              <Badge variant="info" size="sm" className="ml-1 text-xs">L{category.level}</Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{category.name_en || '-'}</td>
        <td className="px-4 py-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs max-w-[200px] truncate" title={category.description || ''}>
          {category.description || '-'}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => onEdit(category)}
            className="text-secondary-600 hover:text-secondary-800 mr-3"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="text-error-600 hover:text-error-800"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
      {expanded &&
        children.map((child) => (
          <CategoryTreeNode
            key={child.id}
            category={child}
            allCategories={allCategories}
            onEdit={onEdit}
            onDelete={onDelete}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

// ═══════════════════════════════════════════════
// 分类管理 Tab
// ═══════════════════════════════════════════════

function CategoryManagementTab() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TermCategory | null>(null)
  const [formData, setFormData] = useState({ name: '', name_en: '', description: '', sort_order: 0, parent_id: null as number | null })

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['terminology-categories'],
    queryFn: terminologyApi.getCategories,
  })

  const createMutation = useMutation({
    mutationFn: terminologyApi.createCategory,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-categories'] })
      setShowCreateModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      terminologyApi.updateCategory(id, data),
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-categories'] })
      setEditingCategory(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteCategory,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-categories'] })
    },
  })

  const tree = useMemo(() => buildCategoryTree(categories), [categories])

  const handleEdit = (cat: TermCategory) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name,
      name_en: cat.name_en || '',
      description: cat.description || '',
      sort_order: cat.sort_order,
      parent_id: cat.parent_id ?? null,
    })
  }

  const handleDelete = (id: number) => {
    if (window.confirm('确定要删除此分类吗？')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">术语分类管理</h2>
        <Button variant="primary" size="sm" onClick={() => {
          setEditingCategory(null)
          setFormData({ name: '', name_en: '', description: '', sort_order: 0, parent_id: null })
          setShowCreateModal(true)
        }}>
          <Plus className="w-4 h-4 mr-1" />
          新建分类
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={4} />
          </CardContent>
        </Card>
      ) : tree.length === 0 && categories.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Database size={48} />}
              title="暂无分类"
              description="添加第一个术语分类，开始构建术语库"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold">名称</th>
                <th className="px-4 py-3 text-left font-semibold">英文名</th>
                <th className="px-4 py-3 text-left font-semibold">描述</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((cat) => (
                <CategoryTreeNode
                  key={cat.id}
                  category={cat}
                  allCategories={categories}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  depth={0}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 新建/编辑弹窗 */}
      {(showCreateModal || editingCategory) && (
        <Modal
          open={showCreateModal || !!editingCategory}
          onClose={() => {
            setShowCreateModal(false)
            setEditingCategory(null)
          }}
          title={editingCategory ? '编辑分类' : '新建分类'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">中文名 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入分类名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">英文名</label>
              <Input
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="请输入英文名称（可选）"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">上级分类</label>
              <select
                value={formData.parent_id ?? ''}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : null })}
                className="input w-full"
              >
                <option value="">无（顶级分类）</option>
                {categories
                  .filter((c) => c.id !== editingCategory?.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="分类描述"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                setShowCreateModal(false)
                setEditingCategory(null)
              }}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (editingCategory) {
                    updateMutation.mutate({ id: editingCategory.id, data: formData })
                  } else {
                    createMutation.mutate(formData as unknown as TermCategoryCreate)
                  }
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// 术语管理 Tab
// ═══════════════════════════════════════════════

function TermManagementTab() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    term: '', term_en: '', pinyin: '', definition: '', category_id: 1,
  })

  const { data: categories = [] as TermCategory[] } = useQuery({
    queryKey: ['terminology-categories'],
    queryFn: terminologyApi.getCategories,
  })

  const { data: termsData, isLoading } = useQuery({
    queryKey: ['terminology-terms', searchQuery, categoryId, page],
    queryFn: () =>
      terminologyApi.getTerms({
        category_id: categoryId,
        page,
        page_size: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
      }),
  })

  // 搜索建议（debounce）
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    setShowSuggestions(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await terminologyApi.getSuggestions({ input: q, limit: 8 })
        setSuggestions(result.suggestions.map((s) => s.term))
        setShowSuggestions(true)
      } catch {
        // ignore
      }
    }, 300)
  }, [])

  const selectSuggestion = (term: string) => {
    setSearchQuery(term)
    setShowSuggestions(false)
    setSuggestions([])
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const createMutation = useMutation({
    mutationFn: terminologyApi.createTerm,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-terms'] })
      setShowCreateModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      terminologyApi.updateTerm(id, data),
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-terms'] })
      setEditingTerm(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteTerm,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-terms'] })
    },
  })

  const terms = termsData?.items || []
  const total = termsData?.total || 0

  const openEdit = (term: Term) => {
    setEditingTerm(term)
    setFormData({
      term: term.term,
      term_en: term.term_en || '',
      pinyin: term.pinyin || '',
      definition: term.definition || '',
      category_id: term.category_id,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">术语列表</h2>
        <Button variant="primary" size="sm" onClick={() => {
          setEditingTerm(null)
          setFormData({ term: '', term_en: '', pinyin: '', definition: '', category_id: 1 })
          setShowCreateModal(true)
        }}>
          <Plus className="w-4 h-4 mr-1" />
          新建术语
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => showSuggestions && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="搜索术语..."
            className="pl-9"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg"
                  onClick={() => selectSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={categoryId || ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="input w-40"
        >
          <option value="">全部分类</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => {
          setSearchQuery('')
          setCategoryId(undefined)
          setPage(1)
          useQueryClient().invalidateQueries({ queryKey: ['terminology-terms'] })
        }}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* 术语表格 */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      ) : terms.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<BookOpen size={48} />}
              title="暂无术语"
              description="添加第一个术语，或调整筛选条件"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left font-semibold">术语</th>
                <th className="px-4 py-3 text-left font-semibold">英文名</th>
                <th className="px-4 py-3 text-left font-semibold">拼音</th>
                <th className="px-4 py-3 text-left font-semibold">分类</th>
                <th className="px-4 py-3 text-left font-semibold">标准</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => {
                const isExpanded = expandedTermId === term.id
                return (
                  <>
                    <tr key={term.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedTermId(isExpanded ? null : term.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">{term.term}</td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{term.term_en || '-'}</td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{term.pinyin || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">
                          {categories.find((c) => c.id === term.category_id)?.name || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {term.is_standard ? (
                          <Badge variant="success">标准</Badge>
                        ) : (
                          <Badge variant="info">非标准</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(term)}
                          className="text-secondary-600 hover:text-secondary-800 mr-3"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(term.id)}
                          className="text-error-600 hover:text-error-800"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${term.id}-detail`}>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">定义：</span>
                              <span className="ml-1">{term.definition || '暂无'}</span>
                            </div>
                            <div>
                              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">英文名：</span>
                              <span className="ml-1">{term.term_en || '暂无'}</span>
                            </div>
                            {term.synonyms && term.synonyms.length > 0 && (
                              <div className="col-span-2">
                                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">同义词：</span>
                                <span className="ml-1">{term.synonyms.join('、')}</span>
                              </div>
                            )}
                            {term.examples && term.examples.length > 0 && (
                              <div className="col-span-2">
                                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">示例：</span>
                                <span className="ml-1">{term.examples.join('、')}</span>
                              </div>
                            )}
                            {term.source && (
                              <div>
                                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">来源：</span>
                                <span className="ml-1">{term.source}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">置信度：</span>
                              <span className="ml-1">{(term.confidence ?? 1).toFixed(2)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
          {total > 20 && (
            <div className="px-4 py-3 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={termsData?.total_pages || 1}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      )}

      {/* 新建/编辑术语弹窗 */}
      {(showCreateModal || editingTerm) && (
        <Modal
          open={showCreateModal || !!editingTerm}
          onClose={() => {
            setShowCreateModal(false)
            setEditingTerm(null)
          }}
          title={editingTerm ? '编辑术语' : '新建术语'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">术语 *</label>
              <Input
                value={formData.term}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                placeholder="如：黄芪"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">英文名</label>
              <Input
                value={formData.term_en}
                onChange={(e) => setFormData({ ...formData, term_en: e.target.value })}
                placeholder="Astragalus membranaceus"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">拼音</label>
              <Input
                value={formData.pinyin}
                onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
                placeholder="huáng qí"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">定义</label>
              <Input
                value={formData.definition}
                onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                placeholder="术语定义"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">分类 *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                className="input w-full"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                setShowCreateModal(false)
                setEditingTerm(null)
              }}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (editingTerm) {
                    updateMutation.mutate({ id: editingTerm.id, data: formData })
                  } else {
                    createMutation.mutate(formData)
                  }
                }}
                disabled={!formData.term}
              >
                保存
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// 术语变体管理 Tab（新增）
// ═══════════════════════════════════════════════

function VariantManagementTab() {
  const queryClient = useQueryClient()
  const [selectedTermId, setSelectedTermId] = useState<number | undefined>()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({ variant: '', term_id: 1 as number | undefined, similarity: 0.8, variant_type: 'synonym' })

  const { data: terms = [] as Term[] } = useQuery({
    queryKey: ['terminology-terms-all'],
    queryFn: () => terminologyApi.getTerms({ page_size: 200 }).then((r) => r.items),
  })

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['terminology-variants', selectedTermId],
    queryFn: () => terminologyApi.getVariants(selectedTermId),
    enabled: true,
  })

  const createMutation = useMutation({
    mutationFn: terminologyApi.createVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-variants'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-variants'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">术语变体管理</h2>
        <Button variant="primary" size="sm" onClick={() => {
          setFormData({ variant: '', term_id: selectedTermId, similarity: 0.8, variant_type: 'synonym' })
          setShowCreateModal(true)
        }}>
          <Plus className="w-4 h-4 mr-1" />
          新建变体
        </Button>
      </div>

      {/* 按术语筛选 */}
      <div className="flex gap-3 items-center">
        <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">按术语筛选：</span>
        <select
          value={selectedTermId ?? ''}
          onChange={(e) => setSelectedTermId(e.target.value ? Number(e.target.value) : undefined)}
          className="input w-48"
        >
          <option value="">全部变体</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.term}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { setSelectedTermId(undefined); queryClient.invalidateQueries({ queryKey: ['terminology-variants'] }) }}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={5} />
          </CardContent>
        </Card>
      ) : variants.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Type size={48} />}
              title="暂无变体"
              description="为术语添加别名、拼写变体等，辅助搜索和纠错"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold">变体</th>
                <th className="px-4 py-3 text-left font-semibold">归属术语</th>
                <th className="px-4 py-3 text-left font-semibold">类型</th>
                <th className="px-4 py-3 text-left font-semibold">相似度</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium">{v.variant}</td>
                  <td className="px-4 py-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{v.term || `ID:${v.term_id}`}</td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">{v.variant_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${(v.similarity ?? 0.8) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{(v.similarity ?? 0.8).toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(v.id)}
                      className="text-error-600 hover:text-error-800"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 新建变体弹窗 */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="新建术语变体"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">变体名称 *</label>
              <Input
                value={formData.variant}
                onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                placeholder="如：黄其、黄芪片"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">归属术语 *</label>
              <select
                value={formData.term_id ?? ''}
                onChange={(e) => setFormData({ ...formData, term_id: e.target.value ? Number(e.target.value) : undefined })}
                className="input w-full"
              >
                <option value="">请选择术语</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.term}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">类型</label>
                <select
                  value={formData.variant_type}
                  onChange={(e) => setFormData({ ...formData, variant_type: e.target.value })}
                  className="input w-full"
                >
                  <option value="synonym">同义词</option>
                  <option value="typo">拼写错误</option>
                  <option value="abbreviation">缩写</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">相似度</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.similarity}
                  onChange={(e) => setFormData({ ...formData, similarity: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button
                variant="primary"
                onClick={() => createMutation.mutate(formData as any)}
                disabled={!formData.variant || !formData.term_id}
              >
                保存
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// 术语验证 Tab
// ═══════════════════════════════════════════════

function ValidationTab() {
  const [validationInput, setValidationInput] = useState('')
  const [validationResult, setValidationResult] = useState<TermValidationResponse | null>(null)
  const [batchInput, setBatchInput] = useState('')
  const [batchResult, setBatchResult] = useState<TermValidationResponse[]>([])

  const validateMutation = useMutation({
    mutationFn: terminologyApi.validateTerm,
    onSuccess: (data) => setValidationResult(data),
  })

  const batchValidateMutation = useMutation({
    mutationFn: terminologyApi.batchValidateTerms,
    onSuccess: (data) => setBatchResult(data),
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 单个验证 */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Check className="w-4 h-4" />
              单个术语验证
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-3">
              <Input
                value={validationInput}
                onChange={(e) => setValidationInput(e.target.value)}
                placeholder="输入术语进行验证"
              />
              <Button
                variant="primary"
                onClick={() => validateMutation.mutate({ term: validationInput })}
                disabled={!validationInput}
              >
                验证
              </Button>
            </div>
            {validationResult && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                <div className="flex items-center gap-2 mb-2">
                  {validationResult.is_valid ? (
                    <Badge variant="success">有效</Badge>
                  ) : (
                    <Badge variant="danger">无效</Badge>
                  )}
                  <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    置信度: {(validationResult.confidence || 0).toFixed(2)}
                  </span>
                </div>
                {validationResult.corrected_term && (
                  <p className="text-sm">修正: <span className="font-medium">{validationResult.corrected_term}</span></p>
                )}
                {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">建议:</p>
                    {validationResult.suggestions.map((s: string, i: number) => (
                      <p key={i} className="text-sm">• {s}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 批量验证 */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <List className="w-4 h-4" />
              批量验证
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-3">
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder="每行一个术语"
                className="input w-full h-32 resize-none"
              />
              <Button
                variant="primary"
                onClick={() => {
                  const terms = batchInput.split('\n').filter(Boolean)
                  batchValidateMutation.mutate({ terms })
                }}
                disabled={!batchInput.trim()}
              >
                批量验证
              </Button>
            </div>
            {batchResult.length > 0 && (
              <div className="mt-4 space-y-2">
                {batchResult.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {r.is_valid ? (
                      <Badge variant="success">有效</Badge>
                    ) : (
                      <Badge variant="danger">无效</Badge>
                    )}
                    <span>{r.term || `条目 ${i + 1}`}</span>
                    {r.corrected_term && (
                      <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">→ {r.corrected_term}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// 标准化规则 Tab
// ═══════════════════════════════════════════════

function RulesTab() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    pattern: '', replacement: '', rule_type: 'regex', priority: 0, enabled: true,
  })

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['terminology-rules'],
    queryFn: terminologyApi.getNormalizationRules,
  })

  const createMutation = useMutation({
    mutationFn: terminologyApi.createNormalizationRule,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-rules'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteNormalizationRule,
    onSuccess: () => {
      useQueryClient().invalidateQueries({ queryKey: ['terminology-rules'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">标准化规则</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          新建规则
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Settings size={48} />}
              title="暂无规则"
              description="添加标准化规则，自动处理术语变体"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold">模式</th>
                <th className="px-4 py-3 text-left font-semibold">替换</th>
                <th className="px-4 py-3 text-left font-semibold">类型</th>
                <th className="px-4 py-3 text-left font-semibold">优先级</th>
                <th className="px-4 py-3 text-left font-semibold">启用</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-mono text-xs">{rule.pattern}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rule.replacement}</td>
                  <td className="px-4 py-3"><Badge variant="info">{rule.rule_type}</Badge></td>
                  <td className="px-4 py-3">{rule.priority}</td>
                  <td className="px-4 py-3">
                    {rule.enabled ? (
                      <Badge variant="success">启用</Badge>
                    ) : (
                      <Badge variant="info">禁用</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="text-error-600 hover:text-error-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 新建规则弹窗 */}
      {showCreateModal && (
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="新建标准化规则">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">匹配模式 *</label>
              <Input
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                placeholder="正则表达式或文本模式"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">替换值 *</label>
              <Input
                value={formData.replacement}
                onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                placeholder="替换后的文本"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">规则类型</label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                  className="input w-full"
                >
                  <option value="regex">正则 (regex)</option>
                  <option value="exact">精确 (exact)</option>
                  <option value="fuzzy">模糊 (fuzzy)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">优先级</label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ruleEnabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="ruleEnabled" className="text-sm font-medium">启用此规则</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button
                variant="primary"
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.pattern || !formData.replacement}
              >
                保存
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
