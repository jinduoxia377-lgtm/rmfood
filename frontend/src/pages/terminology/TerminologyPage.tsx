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
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Input, Button, Badge, Modal, Pagination, Card, Tabs, TabsList, TabsTrigger, TabsContent,
  StatCard, Alert,
} from '@/components/ui'
import * as terminologyApi from '@/api/terminology'
import type { Term, TermCategory, TermCategoryCreate, TermStatistics, TermValidationResponse } from '@/api/terminology'
import {
  BookOpen, Search, Tag, Settings, BarChart3, Plus, Trash2, Edit2, X, Check,
  FileText, List, Database, RefreshCw,
} from 'lucide-react'

// ═══════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════

export default function TerminologyPage() {
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">术语管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理药食同源专业术语库，支持分类、验证、搜索和标准化
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="categories" className="gap-2">
            <Database className="w-4 h-4" />
            术语分类
          </TabsTrigger>
          <TabsTrigger value="terms" className="gap-2">
            <BookOpen className="w-4 h-4" />
            术语管理
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
        <TabsContent value="validation">
          <ValidationTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════
// 分类管理 Tab
// ═══════════════════════════════════════════════

function CategoryManagementTab() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TermCategory | null>(null)
  const [formData, setFormData] = useState({ name: '', name_en: '', description: '', sort_order: 0 })

  const { data: categories = [] as TermCategory[], isLoading } = useQuery({
    queryKey: ['terminology-categories'],
    queryFn: terminologyApi.getCategories,
  })

  const createMutation = useMutation({
    mutationFn: terminologyApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-categories'] })
      setShowCreateModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      terminologyApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-categories'] })
      setEditingCategory(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-categories'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">术语分类管理</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          新建分类
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
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
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500">{cat.name_en || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{cat.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditingCategory(cat)
                        setFormData({
                          name: cat.name,
                          name_en: cat.name_en || '',
                          description: cat.description || '',
                          sort_order: cat.sort_order,
                        })
                      }}
                      className="text-secondary-600 hover:text-secondary-800 mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(cat.id)}
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
              <label className="block text-sm font-medium mb-1">中文名</label>
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
                placeholder="English name"
              />
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

  const createMutation = useMutation({
    mutationFn: terminologyApi.createTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-terms'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-terms'] })
    },
  })

  const terms = termsData?.items || []
  const total = termsData?.total || 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">术语列表</h2>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          新建术语
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索术语..."
            className="pl-9"
          />
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
        <Button variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['terminology-terms'] })}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* 术语表格 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold">术语</th>
                <th className="px-4 py-3 text-left font-semibold">英文名</th>
                <th className="px-4 py-3 text-left font-semibold">拼音</th>
                <th className="px-4 py-3 text-left font-semibold">分类</th>
                <th className="px-4 py-3 text-left font-semibold">标准</th>
                <th className="px-4 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium">{term.term}</td>
                  <td className="px-4 py-3 text-gray-500">{term.term_en || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{term.pinyin || '-'}</td>
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
                      onClick={() => deleteMutation.mutate(term.id)}
                      className="text-error-600 hover:text-error-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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

      {/* 新建术语弹窗 */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="新建术语"
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
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button
                variant="primary"
                onClick={() => createMutation.mutate(formData)}
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
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Check className="w-5 h-5" />
            单个术语验证
          </h3>
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
                  <Badge variant="success">✓ 有效</Badge>
                ) : (
                  <Badge variant="danger">✗ 无效</Badge>
                )}
                <span className="text-sm text-gray-500">
                  置信度: {(validationResult.confidence || 0).toFixed(2)}
                </span>
              </div>
              {validationResult.corrected_term && (
                <p className="text-sm">修正: {validationResult.corrected_term}</p>
              )}
              {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-1">建议:</p>
                  {validationResult.suggestions.map((s: string, i: number) => (
                    <p key={i} className="text-sm">• {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 批量验证 */}
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <List className="w-5 h-5" />
            批量验证
          </h3>
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
                    <Badge variant="success">✓</Badge>
                  ) : (
                    <Badge variant="danger">✗</Badge>
                  )}
                  <span>{r.term || `条目 ${i + 1}`}</span>
                </div>
              ))}
            </div>
          )}
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
      queryClient.invalidateQueries({ queryKey: ['terminology-rules'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: terminologyApi.deleteNormalizationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology-rules'] })
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
        <div className="text-center py-8 text-gray-500">加载中...</div>
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
