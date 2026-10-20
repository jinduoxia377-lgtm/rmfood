/**
 * WorkflowCreateModal — 创建工作流弹窗
 *
 * 支持：从模板创建 / 空白创建 / 快速创建预设类型
 */
import { useState, useEffect, useRef } from 'react'
import {
  GitBranch, Plus, Search, CheckCircle, Loader2,
  FlaskConical, RefreshCw, FileSearch, Sparkles, BarChart3,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal, Button, Input, Badge, Card } from '@/components/ui'
import { workflowApi, type WorkflowTemplate, type WorkflowCreatePayload } from '@/api/workflow'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface WorkflowCreateModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (workflowId: number) => void
  preselectedTemplateId?: string | null
}

const WORKFLOW_TYPE_OPTIONS = [
  { value: 'ai_generation', label: 'AI 配方生成', icon: Sparkles, desc: '从需求到配方的完整AI驱动流程' },
  { value: 'review', label: '配方审核', icon: CheckCircle, desc: '标准化审核与批准流程' },
  { value: 'data_sync', label: '数据同步', icon: RefreshCw, desc: '外部数据库同步与知识图谱更新' },
  { value: 'analysis', label: '数据分析', icon: FileSearch, desc: '实验数据与统计分析流程' },
  { value: 'custom', label: '自定义', icon: GitBranch, desc: '自由搭建自定义工作流' },
] as const

/** 模板 category → lucide icon，替代渲染 emoji 字符串 */
const TEMPLATE_ICON_MAP: Record<string, typeof Sparkles> = {
  ai_generation: Sparkles,
  review: CheckCircle,
  data_sync: RefreshCw,
  analysis: BarChart3,
}

/** 模板 category → 中文标签 */
const CATEGORY_LABELS: Record<string, string> = {
  ai_generation: 'AI 配方生成',
  review: '审核流程',
  data_sync: '数据同步',
  analysis: '数据分析',
  custom: '自定义',
}

export default function WorkflowCreateModal({ open, onClose, onSuccess, preselectedTemplateId }: WorkflowCreateModalProps) {
  const { addToast } = useToast()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'template' | 'custom'>('template')
  const [selectedType, setSelectedType] = useState<string>('ai_generation')
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDesc, setWorkflowDesc] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const { data: templateData, isLoading: templatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: workflowApi.listTemplates,
    // 不设置 enabled: open —— 始终保留缓存，避免每次打开都重新请求
    staleTime: 60_000,
  })

  const templates: WorkflowTemplate[] = templateData?.items ?? []
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // 使用 ref 确保 preselectedTemplateId 只在首次加载时选中一次，
  // 避免 templates 每次 filter 产生新引用时重复触发
  const selectedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !preselectedTemplateId || templates.length === 0) return
    // 已选中过相同模板则跳过
    if (selectedRef.current === preselectedTemplateId) return
    const found = templates.find(t => t.template_id === preselectedTemplateId)
    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTemplate(found)
      // 同步类型：根据模板 category 自动选中对应的工作流类型
      if (found.category) {
         
        setSelectedType(found.category)
      }
      selectedRef.current = preselectedTemplateId
    }
  }, [open, preselectedTemplateId, templates.length]) // 只依赖长度，不依赖数组引用

  const createMut = useMutation({
    mutationFn: async (payload: {
      name: string
      workflow_type: string
      description?: string
      template_id?: string
    }) => workflowApi.create(payload),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.message || '工作流创建成功' })
      qc.invalidateQueries({ queryKey: ['workflows'] })
      qc.invalidateQueries({ queryKey: ['workflow-statistics'] })
      onSuccess(res.id)
      resetForm()
    },
    onError: () => addToast({ type: 'error', message: '创建失败，请重试' }),
  })

  function resetForm() {
    setWorkflowName('')
    setWorkflowDesc('')
    setSelectedTemplate(null)
    setSearchQuery('')
    setMode('template')
    setSelectedType('ai_generation')
    selectedRef.current = null // 允许下次打开时重新选中模板
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleCreate() {
    if (!workflowName.trim()) {
      addToast({ type: 'warning', message: '请输入工作流名称' })
      return
    }

    setIsCreating(true)
    // 模板模式：传 template_id，由后端从数据库加载节点
    // 空白模式：传 config（含空节点列表）
    const payload: WorkflowCreatePayload = {
      name: workflowName.trim(),
      workflow_type: selectedType,
      ...(workflowDesc.trim() ? { description: workflowDesc.trim() } : {}),
    }
    if (mode === 'template' && selectedTemplate) {
      payload.template_id = selectedTemplate.template_id
    } else {
      payload.config = { nodes: [], edges: [] }
    }
    createMut.mutateAsync(payload).finally(() => setIsCreating(false))
  }

  return (
    <Modal title="创建工作流" open={open} onClose={handleClose} size="lg">
      <div className="space-y-5 mt-2">
        {/* 模式切换 */}
        <div className="flex items-center gap-2 p-1 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)] w-fit">
          <button
            onClick={() => setMode('template')}
            className={cn(
              'px-[var(--space-apple-md)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all',
              mode === 'template'
                ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]',
            )}
          >
            从模板创建
          </button>
          <button
            onClick={() => setMode('custom')}
            className={cn(
              'px-[var(--space-apple-md)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all',
              mode === 'custom'
                ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]',
            )}
          >
            空白创建
          </button>
        </div>

        {/* 基本信息 */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              工作流名称 <span className="text-danger-500">*</span>
            </label>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="例如：AI 配方自动生成流程 v2"
              className="h-9"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              类型
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
              {WORKFLOW_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isActive = selectedType === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedType(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-1.5 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border-2 text-left transition-all',
                      isActive
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                        : 'border-[var(--border-color)] hover:border-[var(--border-color)] dark:hover:border-neutral-600',
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-[var(--radius-Apple-sm)] flex items-center justify-center',
                      isActive ? 'bg-primary-container text-[var(--color-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
                    )}>
                      <Icon size={14} />
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]',
                    )}>
                      {opt.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] leading-tight hidden sm:block">
                      {opt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              描述（可选）
            </label>
            <Input
              value={workflowDesc}
              onChange={(e) => setWorkflowDesc(e.target.value)}
              placeholder="简要描述此工作流的用途"
              className="h-9"
            />
          </div>
        </div>

        {/* 模板选择区 */}
        {mode === 'template' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              选择模板
            </label>
            <div className="relative mb-[var(--space-apple-sm)]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索模板..."
                className="pl-9 h-9"
              />
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">
                <Loader2 size={16} className="animate-spin mr-2" />
                加载模板中...
              </div>
            ) : filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)] max-h-48 overflow-y-auto pr-1">
                {filteredTemplates.map((template) => {
                  const isSelected = selectedTemplate?.template_id === template.template_id
                  return (
                    <Card
                      key={template.template_id}
                      hoverable
                      className={cn(
                        'p-[var(--space-apple-sm)] cursor-pointer transition-all',
                        isSelected && 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary-container)]',
                      )}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="flex items-start gap-2.5">
                        {(() => {
                          const TIcon = TEMPLATE_ICON_MAP[template.category] || Sparkles
                          return <TIcon size={18} className="shrink-0 text-[var(--color-primary-text)]0 dark:text-[var(--color-primary-text)] opacity-75" />
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {template.name}
                            </h4>
                            {isSelected && <CheckCircle size={12} className="text-[var(--color-primary-text)]0 shrink-0" />}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge size="sm" variant="neutral" className="text-xs">
                              {CATEGORY_LABELS[template.category] || template.category.replace('_', ' ')}
                            </Badge>
                            {template.node_count && (
                              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{template.node_count} 节点</span>
                            )}
                            {template.estimated_duration && (
                              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">· {template.estimated_duration}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-[var(--space-apple-lg)] text-[var(--text-muted)] text-sm bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
                {searchQuery ? '没有找到匹配的模板' : '暂无可用模板'}
              </div>
            )}
          </div>
        )}

        {/* 空白创建提示 */}
        {mode === 'custom' && (
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/15 border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/30 text-sm text-[var(--color-warning-text)]">
            <div className="flex items-start gap-2">
              <FlaskConical size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">空白创建工作流</p>
                <p className="text-xs mt-1 opacity-80">
                  创建后可以在工作流详情页使用可视化编辑器逐步添加节点和配置。
                  建议先从模板开始，更快速地搭建工作流框架。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-[var(--space-apple-sm)] pt-2 border-t border-[var(--border-color)]">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isCreating}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            loading={isCreating}
            disabled={!workflowName.trim()}
            icon={createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          >
            {createMut.isPending ? '创建中...' : '创建工作流'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
