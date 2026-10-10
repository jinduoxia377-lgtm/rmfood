/**
 * 工作流管理页面
 * 参照 Dashboard 布局设计：全宽背景 + 欢迎横幅 + 统计卡片 + 卡片列表
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitBranch, CheckCircle, XCircle, Clock, Loader2, Play,
  CircleDot, AlertTriangle, ChevronRight, RotateCcw, Ban, Plus, Sparkles,
  RefreshCw, FileSearch, Search,
} from 'lucide-react'
import { workflowApi, type Workflow, type WorkflowDetail } from '@/api/workflow'
import {
  EmptyState, Skeleton, Pagination, Card, CardHeader, CardTitle, CardContent,
  Button, Modal, StatCard, StatusBadge,
} from '@/components/ui'
import WorkflowCreateModal from '@/pages/workflow/WorkflowCreateModal'
import { WorkflowVisualEditor } from '@/components/workflow/WorkflowVisualEditor'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useToast } from '@/components/ui/Toast'

// ─── 状态配置 ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle; variant: 'primary' | 'secondary' | 'info' | 'success' | 'warning' }> = {
  pending: { label: '等待中', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300', icon: CircleDot, variant: 'secondary' },
  in_progress: { label: '进行中', color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700', icon: Loader2, variant: 'info' },
  completed: { label: '已完成', color: 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-700', icon: CheckCircle, variant: 'success' },
  cancelled: { label: '已取消', color: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400', icon: XCircle, variant: 'secondary' },
  failed: { label: '已失败', color: 'bg-danger-100 text-danger-700 dark:bg-danger-300/25 dark:text-danger-700', icon: XCircle, variant: 'warning' },
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: '等待', color: 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900', icon: CircleDot },
  in_progress: { label: '执行中', color: 'border-secondary-400 bg-secondary-50 dark:bg-secondary-300/20 ring-2 ring-secondary-200 dark:ring-secondary-800', icon: Play },
  completed: { label: '完成', color: 'border-success-400 bg-success-50 dark:bg-success-300/20', icon: CheckCircle },
  failed: { label: '失败', color: 'border-danger-400 bg-danger-50 dark:bg-danger-300/20', icon: XCircle },
  skipped: { label: '跳过', color: 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 opacity-50', icon: CircleDot },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  user_input: '用户输入', agent_smart: '智能分析', formula_gpt: '配方生成', llm: 'LLM 处理',
  safety_check: '安全检查', herb_knowledge: '草本知识', compound_analysis: '化合物分析',
  target_analysis: '靶点分析', peptide_analysis: '肽链分析', data_sync: '数据同步',
  batch_analysis: '批量分析', auto_validate: '自动校验', expert_review: '专家审核',
  approve: '批准', request_revision: '退回修改', notify: '通知', llm_analysis: 'LLM 分析',
  neural_generate: 'AI 生成', multi_optimize: '多目标优化', save_result: '保存结果',
  regenerate: '重新生成', tcmsp_sync: 'TCMSP 同步', dfbp_sync: 'DFBP 同步',
  merge_data: '数据合并', validate: '质量验证', update_graph: '图谱更新',
}

const TYPE_LABELS: Record<string, string> = {
  ai_generation: 'AI 配方生成', data_sync: '数据同步', review: '审核流程',
  analysis: '数据分析', formula_validation: '配方校验',
}

/** 快捷创建模板卡 */
const QUICK_CREATE_CARDS = [
  { type: 'ai_generation', label: 'AI 配方生成', desc: '从零到配方，AI 全流程驱动', icon: Sparkles, gradient: 'from-primary-500 to-primary-600', templateId: 'ai-formula-gen' },
  { type: 'review', label: '配方审核流程', desc: '标准化审批与合规校验', icon: CheckCircle, gradient: 'from-secondary-500 to-secondary-600', templateId: 'review-process' },
  { type: 'data_sync', label: '数据同步流水线', desc: '多源数据自动同步与更新', icon: RefreshCw, gradient: 'from-accent-500 to-accent-600', templateId: 'data-sync' },
  { type: 'analysis', label: '批量数据分析', desc: '实验数据批量处理与统计', icon: FileSearch, gradient: 'from-warning-500 to-warning-500', templateId: 'batch-analysis' },
] as const

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function WorkflowPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null)
  const [editorWorkflow, setEditorWorkflow] = useState<WorkflowDetail | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', page, statusFilter, searchQuery],
    queryFn: () => workflowApi.list({ page, page_size: 10, status: statusFilter || undefined, search: searchQuery || undefined }),
  })
  const { data: stats } = useQuery({
    queryKey: ['workflow-statistics'],
    queryFn: workflowApi.statistics,
    staleTime: 5 * 60_000,
  })

  const workflows: Workflow[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 10)

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id)
    if (expandedId !== id) setEditorWorkflow(null)
  }

  const handleQuickCreate = (templateId: string) => {
    setPreselectedTemplateId(templateId)
    setShowCreateModal(true)
  }

  const handleCreateSuccess = (id: number) => {
    setShowCreateModal(false)
    setPreselectedTemplateId(null)
    workflowApi.get(id).then((detail) => setEditorWorkflow(detail))
    qc.invalidateQueries({ queryKey: ['workflows'] })
    qc.invalidateQueries({ queryKey: ['workflow-statistics'] })
  }

  /** 刷新统计与列表 */
  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['workflows'] })
    qc.invalidateQueries({ queryKey: ['workflow-statistics'] })
  }

  const pendingCount = stats?.by_status?.pending ?? 0
  const completedCount = stats?.by_status?.completed ?? 0
  const failedCount = stats?.by_status?.failed ?? 0

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── 欢迎横幅 ── */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight">
                工作流管理
              </h1>
              <p className="mt-1 text-white/80 text-sm">
                查看 AI 配方生成、数据同步和审核流程的执行状态
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* 搜索框 */}
              <div className="relative flex-1 sm:flex-initial">
                <div className="flex items-center gap-2 bg-white dark:bg-neutral-900/15 rounded-full px-4 py-2">
                  <Search size={14} className="text-white/70 shrink-0" />
                  <input
                    type="text"
                    placeholder="搜索工作流…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                    className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-40 sm:w-52"
                    aria-label="搜索工作流"
                  />
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={16} />}
                onClick={() => { setPreselectedTemplateId(null); setShowCreateModal(true) }}
                className="bg-white dark:bg-neutral-900/90 text-primary-700 hover:bg-white dark:bg-neutral-900"
              >
                快速创建
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={handleRefresh}
                title="刷新数据"
                aria-label="刷新工作流数据"
                className="bg-white dark:bg-neutral-900/15 text-primary-700 dark:text-white hover:bg-white dark:bg-neutral-900/25"
              >
                刷新
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => { setPreselectedTemplateId(null); setShowCreateModal(true) }}
                className="bg-white dark:bg-neutral-900 text-primary-700 hover:bg-white dark:bg-neutral-900/90 shrink-0"
              >
                创建工作流
              </Button>
            </div>
          </div>
        </div>

        {/* ── 统计卡片 ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="总工作流"
              value={stats.total}
              icon={GitBranch}
              variant="primary"
            />
            <StatCard
              label="已完成"
              value={completedCount}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              label="失败"
              value={failedCount}
              icon={XCircle}
              variant="warning"
            />
            <StatCard
              label="等待中"
              value={pendingCount}
              icon={Clock}
              variant="info"
            />
          </div>
        )}

        {/* ── 快捷创建 ── */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>快捷创建</CardTitle>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">从模板快速启动一条工作流，无需手动配置</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_CREATE_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.type}
                    onClick={() => handleQuickCreate(card.templateId)}
                    className={cn(
                      'group relative flex flex-col items-start p-4 rounded-xl',
                      'border border-neutral-200 dark:border-neutral-700/60',
                      'bg-white dark:bg-neutral-800/50',
                      'hover:border-primary-300 dark:hover:border-primary-600',
                      'transition-all duration-200',
                      'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg bg-gradient-to-br', card.gradient,
                      'flex items-center justify-center shadow-sm',
                      'group-hover:scale-105 transition-transform duration-200',
                    )}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-3 leading-tight">
                      {card.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed line-clamp-2">
                      {card.desc}
                    </p>
                    <ChevronRight
                      size={14}
                      className="absolute top-4 right-3 text-neutral-300 dark:text-neutral-400 group-hover:text-primary-500 transition-colors duration-200"
                    />
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── 筛选栏 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
              !statusFilter
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700',
            )}
          >
            全部
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                statusFilter === key
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700',
              )}
            >
              <cfg.icon size={11} className="opacity-70" />
              {cfg.label}
            </button>
          ))}
        </div>

        {/* ── 工作流列表 ── */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </Card>
            ))
          ) : workflows.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <EmptyState
                  icon={<GitBranch className="w-10 h-10 text-neutral-300 dark:text-neutral-400" />}
                  title="暂无工作流"
                  description="点击上方「创建工作流」按钮开始，或选择快捷模板快速创建"
                />
              </CardContent>
            </Card>
          ) : (
            workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                isExpanded={expandedId === wf.id}
                onToggle={() => toggleExpand(wf.id)}
                onViewDetail={() => {
                  setExpandedId(null)
                  workflowApi.get(wf.id).then((detail) => setEditorWorkflow(detail))
                }}
                onAction={() => qc.invalidateQueries({ queryKey: ['workflows'] })}
                addToast={addToast}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}

        {/* 创建弹窗 */}
        <WorkflowCreateModal
          open={showCreateModal}
          onClose={() => { setShowCreateModal(false); setPreselectedTemplateId(null) }}
          onSuccess={handleCreateSuccess}
          preselectedTemplateId={preselectedTemplateId}
        />

        {/* 流程图详情弹窗 */}
        {editorWorkflow && (
          <Modal
            open={!!editorWorkflow}
            onClose={() => setEditorWorkflow(null)}
            maxWidth="85vw"
            maxHeight="85vh"
            title={editorWorkflow.name || '工作流详情'}
          >
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={editorWorkflow.status} size="sm" />
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {editorWorkflow.created_at && format(new Date(editorWorkflow.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                {editorWorkflow.task_count != null && ` · ${editorWorkflow.task_count} 个任务节点`}
              </span>
            </div>
            <div className="h-[calc(85vh-12rem)] min-h-[400px]">
              <WorkflowVisualEditor workflow={editorWorkflow} readOnly={true} />
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

// ─── 工作流卡片 ────────────────────────────────────────────────────────────────
function WorkflowCard({
  workflow, isExpanded, onToggle, onViewDetail, onAction, addToast,
}: {
  workflow: Workflow
  isExpanded: boolean
  onToggle: () => void
  onViewDetail: () => void
  onAction: () => void
  addToast: (opts: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void
}) {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['workflow-detail', workflow.id],
    queryFn: () => workflowApi.get(workflow.id),
    enabled: isExpanded,
  })

  const cancelMut = useMutation({
    mutationFn: () => workflowApi.cancel(workflow.id),
    onSuccess: (res) => { addToast({ type: 'success', message: res.message }); onAction() },
    onError: () => { addToast({ type: 'error', message: '取消失败' }) },
  })

  const retryMut = useMutation({
    mutationFn: () => workflowApi.retry(workflow.id),
    onSuccess: (res) => { addToast({ type: 'success', message: res.message }); onAction() },
    onError: () => { addToast({ type: 'error', message: '重试失败' }) },
  })

  const executeMut = useMutation({
    mutationFn: () => workflowApi.execute(workflow.id),
    onSuccess: (res) => {
      const execId = res?.data?.execution_id || ''
      addToast({ type: 'success', message: execId ? `工作流已启动，执行 ID: ${execId}` : '工作流已启动' })
      onAction()
    },
    onError: () => { addToast({ type: 'error', message: '启动失败，请稍后重试' }) },
  })

  const statusCfg = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.pending

  return (
    <>
      <Card className={cn(
        'overflow-hidden transition-all duration-200 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900',
        isExpanded && 'ring-1 ring-primary-200 dark:ring-primary-700 shadow-md',
      )}>
        {/* 折叠行 — 修复: 原实现是 <button> 包裹 <Button>（嵌套按钮），
            违反 HTML 嵌套规范，React SSR 会报 hydration 错误；且点击内层
            按钮会冒泡触发外层 onToggle。改为 <div role="button">，保留键盘
            可达性（Enter / Space）与 focus ring。 */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle()
            }
          }}
          aria-expanded={isExpanded}
          className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
        >
          <CardHeader className="px-5 py-4">
            <div className="flex items-center gap-4">
              {/* 状态图标 */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                statusCfg.color,
              )}>
                <statusCfg.icon
                  size={16}
                  className={workflow.status === 'in_progress' ? 'animate-spin' : ''}
                />
              </div>

              {/* 名称 + 类型 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle as="h3" className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {workflow.name}
                  </CardTitle>
                  <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    {TYPE_LABELS[workflow.workflow_type] || workflow.workflow_type}
                  </span>
                  <StatusBadge status={workflow.status} size="sm" />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {workflow.description || '无描述'}
                  {typeof workflow.task_count === 'number' && (
                    <span className="ml-1.5 text-neutral-400 dark:text-neutral-400">
                      · {workflow.task_count > 0 ? `${workflow.task_count} 个任务` : '暂无任务'}
                    </span>
                  )}
                </p>
              </div>

              {/* 右侧操作 */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-neutral-400 dark:text-neutral-400 hidden sm:block">
                  {workflow.created_at && format(new Date(workflow.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); onViewDetail() }}
                >
                  <GitBranch size={12} className="mr-1" />
                  流程图
                </Button>
                <ChevronRight
                  size={14}
                  className={cn(
                    'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] transition-transform duration-200',
                    isExpanded && 'rotate-90',
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </div>

        {/* 展开的任务管线 */}
        {isExpanded && (
          <div className="border-t border-neutral-100 dark:border-neutral-800/40">
            {/* 任务列表 */}
            <div className="max-h-[320px] overflow-y-auto">
              {detailLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : detail?.tasks && detail.tasks.length > 0 ? (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
                  {detail.tasks.map((task, idx) => {
                    const taskCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending
                    const isLast = idx === detail.tasks.length - 1
                    return (
                      <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/20 transition-colors">
                        {/* 节点指示器 */}
                        <div className="flex flex-col items-center w-6 shrink-0 pt-1">
                          <div className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                            taskCfg.color,
                          )}>
                            <taskCfg.icon size={10} />
                          </div>
                          {!isLast && (
                            <div className="flex-1 w-px bg-neutral-200 dark:bg-neutral-700 my-0.5" />
                          )}
                        </div>

                        {/* 任务信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-xs text-neutral-400 dark:text-neutral-400 font-mono">
                              第 {task.step_order + 1} 步
                            </span>
                            <span className="text-xs font-medium text-neutral-900 dark:text-white">
                              {task.name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                              {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={cn(
                              'text-xs font-medium',
                              taskCfg.color.replace('border-', 'text-').split(' ')[0],
                            )}>
                              {taskCfg.label}
                            </span>
                            {task.duration_ms != null && task.duration_ms > 0 && (
                              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                                {(task.duration_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                            {task.error_message && (
                              <span className="text-xs text-danger-500 flex items-center gap-0.5">
                                <AlertTriangle size={10} /> {task.error_message}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs text-neutral-400 dark:text-neutral-400">暂无任务节点</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="border-t border-neutral-100 dark:border-neutral-800/40 p-3 flex items-center gap-2 flex-wrap bg-neutral-50 dark:bg-neutral-800/20">
              {(workflow.status === 'in_progress' || workflow.status === 'pending') && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Ban className="w-3.5 h-3.5" />}
                  loading={cancelMut.isPending}
                  onClick={(e) => { e.stopPropagation(); cancelMut.mutate() }}
                >
                  取消
                </Button>
              )}
              {workflow.status === 'pending' && (
                <Button
                  size="sm"
                  icon={<Play className="w-3.5 h-3.5" />}
                  loading={executeMut.isPending}
                  onClick={(e) => { e.stopPropagation(); executeMut.mutate() }}
                >
                  启动
                </Button>
              )}
              {workflow.status === 'failed' && (
                <Button
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  loading={retryMut.isPending}
                  onClick={(e) => { e.stopPropagation(); retryMut.mutate() }}
                >
                  重试
                </Button>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                icon={<ChevronRight className="w-3.5 h-3.5" />}
                onClick={(e) => { e.stopPropagation(); onViewDetail() }}
              >
                查看流程图
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
