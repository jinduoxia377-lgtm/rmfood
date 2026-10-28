/**
 * 工作流管理页面
 * 参照 Dashboard 布局设计：全宽背景 + 欢迎横幅 + 统计卡片 + 卡片列表
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitBranch, CheckCircle, XCircle, Clock, Loader2, Play,
  CircleDot, AlertTriangle, ChevronRight, RotateCcw, Ban, Plus, Sparkles,
  RefreshCw, FileSearch, Search,
} from 'lucide-react'
import { workflowApi, type Workflow, type WorkflowDetail, type WorkflowTask } from '@/api/workflow'
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
const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle; variant: 'primary' | 'secondary' | 'info' | 'success' | 'warning' }> = {
  pending: { labelKey: 'common.statusLabels.pending', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]', icon: CircleDot, variant: 'secondary' },
  in_progress: { labelKey: 'common.statusLabels.in_progress', color: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]', icon: Loader2, variant: 'info' },
  completed: { labelKey: 'common.statusLabels.completed', color: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]', icon: CheckCircle, variant: 'success' },
  cancelled: { labelKey: 'common.statusLabels.cancelled', color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]', icon: XCircle, variant: 'secondary' },
  failed: { labelKey: 'common.statusLabels.failed', color: 'bg-danger-100 text-danger-700 dark:bg-danger-300/25 dark:text-danger-700', icon: XCircle, variant: 'warning' },
}

const TASK_STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle }> = {
  pending: { labelKey: 'pages.workflow.taskStatusPending', color: 'border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-tertiary)] dark:bg-[var(--bg-secondary)]', icon: CircleDot },
  in_progress: { labelKey: 'pages.workflow.taskStatusInProgress', color: 'border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 ring-2 ring-[var(--color-secondary-container)] dark:ring-[var(--color-secondary)]', icon: Play },
  completed: { labelKey: 'pages.workflow.taskStatusCompleted', color: 'border-[var(--color-success)] bg-[var(--color-success-container)]', icon: CheckCircle },
  failed: { labelKey: 'pages.workflow.taskStatusFailed', color: 'border-danger-400 bg-danger-50 dark:bg-danger-300/20', icon: XCircle },
  skipped: { labelKey: 'pages.workflow.taskStatusSkipped', color: 'border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-tertiary)] dark:bg-[var(--bg-secondary)] opacity-50', icon: CircleDot },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  user_input: 'pages.workflow.taskTypeLabels.user_input', agent_smart: 'pages.workflow.taskTypeLabels.agent_smart', formula_gpt: 'pages.workflow.taskTypeLabels.formula_gpt', llm: 'pages.workflow.taskTypeLabels.llm',
  safety_check: 'pages.workflow.taskTypeLabels.safety_check', herb_knowledge: 'pages.workflow.taskTypeLabels.herb_knowledge', compound_analysis: 'pages.workflow.taskTypeLabels.compound_analysis',
  target_analysis: 'pages.workflow.taskTypeLabels.target_analysis', peptide_analysis: 'pages.workflow.taskTypeLabels.peptide_analysis', data_sync: 'pages.workflow.taskTypeLabels.data_sync',
  batch_analysis: 'pages.workflow.taskTypeLabels.batch_analysis', auto_validate: 'pages.workflow.taskTypeLabels.auto_validate', expert_review: 'pages.workflow.taskTypeLabels.expert_review',
  approve: 'pages.workflow.taskTypeLabels.approve', request_revision: 'pages.workflow.taskTypeLabels.request_revision', notify: 'pages.workflow.taskTypeLabels.notify', llm_analysis: 'pages.workflow.taskTypeLabels.llm_analysis',
  neural_generate: 'pages.workflow.taskTypeLabels.neural_generate', multi_optimize: 'pages.workflow.taskTypeLabels.multi_optimize', save_result: 'pages.workflow.taskTypeLabels.save_result',
  regenerate: 'pages.workflow.taskTypeLabels.regenerate', tcmsp_sync: 'pages.workflow.taskTypeLabels.tcmsp_sync', dfbp_sync: 'pages.workflow.taskTypeLabels.dfbp_sync',
  merge_data: 'pages.workflow.taskTypeLabels.merge_data', validate: 'pages.workflow.taskTypeLabels.validate', update_graph: 'pages.workflow.taskTypeLabels.update_graph',
}

const TYPE_LABELS: Record<string, string> = {
  ai_generation: 'pages.workflow.typeLabels.ai_generation', data_sync: 'pages.workflow.typeLabels.data_sync', review: 'pages.workflow.typeLabels.review',
  analysis: 'pages.workflow.typeLabels.analysis', formula_validation: 'pages.workflow.typeLabels.formula_validation',
}

/** 快捷创建模板卡 */
const QUICK_CREATE_CARDS = [
  { type: 'ai_generation', labelKey: 'pages.workflow.cardAiGen', descKey: 'pages.workflow.cardAiGenDesc', icon: Sparkles, gradient: 'from-primary-500 to-primary-600', templateId: 'ai-formula-gen' },
  { type: 'review', labelKey: 'pages.workflow.cardReview', descKey: 'pages.workflow.cardReviewDesc', icon: CheckCircle, gradient: 'from-secondary-500 to-secondary-600', templateId: 'review-process' },
  { type: 'data_sync', labelKey: 'pages.workflow.cardDataSync', descKey: 'pages.workflow.cardDataSyncDesc', icon: RefreshCw, gradient: 'from-accent-500 to-accent-600', templateId: 'data-sync' },
  { type: 'analysis', labelKey: 'pages.workflow.cardBatchAnalysis', descKey: 'pages.workflow.cardBatchAnalysisDesc', icon: FileSearch, gradient: 'from-warning-500 to-warning-500', templateId: 'batch-analysis' },
] as const

/**
 * A-27: 实时进度 —— 后端执行时仅更新 WorkflowTask 状态，不回写 workflow.config
 * 节点状态。这里把轮询到的任务状态（按 task_type 匹配）合并到编辑器节点的
 * data.status，使流程图节点在只读视图中随执行实时变色。
 * 若无任何变化则返回原对象，避免无谓重渲染/编辑器重初始化。
 */
function mergeLiveTaskStatus(wf: WorkflowDetail, status: string, tasks: WorkflowTask[]): WorkflowDetail {
  const statusByType = new Map<string, string>()
  for (const t of tasks) {
    if (t.task_type) statusByType.set(t.task_type, t.status)
  }
  const config = (wf.config ?? {}) as Record<string, unknown>
  const rawNodes = Array.isArray(config.nodes) ? (config.nodes as Array<Record<string, unknown>>) : []
  let changed = wf.status !== status
  const nodes = rawNodes.map((n) => {
    const nodeData = (n?.data ?? {}) as Record<string, unknown>
    const tt = nodeData.taskType as string | undefined
    const st = tt ? statusByType.get(tt) : undefined
    if (st && st !== nodeData.status) {
      changed = true
      return { ...n, data: { ...nodeData, status: st } }
    }
    return n
  })
  if (!changed) return wf
  return { ...wf, status, config: { ...config, nodes } }
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function WorkflowPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { addToast } = useToast()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null)
  const [editorWorkflow, setEditorWorkflow] = useState<WorkflowDetail | null>(null)
  // A-27: 编辑模式——编辑器弹窗是否允许编辑（readOnly=false 时显示保存）
  const [editorEditMode, setEditorEditMode] = useState(false)

  // A-27: 保存编辑器配置（接通 updateConfig，此前为死代码）
  const saveConfigMut = useMutation({
    mutationFn: (cfg: Record<string, unknown>) =>
      editorWorkflow ? workflowApi.updateConfig(editorWorkflow.id, cfg) : Promise.reject(new Error('无编辑器工作流')),
    onSuccess: () => {
      // A-27 P3-1: 不在 onSuccess 重复 toast —— 编辑器 handleSave 已提示
      //           「工作流保存成功」，避免同一操作弹两个提示。
      setEditorEditMode(false)
      qc.invalidateQueries({ queryKey: ['workflows'] })
      qc.invalidateQueries({ queryKey: ['workflow-statistics'] })
    },
    onError: () => addToast({ type: 'error', message: '保存失败，请重试' }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', page, statusFilter, searchQuery],
    queryFn: () => workflowApi.list({ page, page_size: 10, status: statusFilter || undefined, search: searchQuery || undefined }),
  })
  const { data: stats } = useQuery({
    queryKey: ['workflow-statistics'],
    queryFn: workflowApi.statistics,
    staleTime: 5 * 60_000,
  })

  // A-27: 实时进度 —— 流程图弹窗打开且工作流执行中时，每 2s 轮询最新任务状态，
  //       并合并到编辑器节点（readOnly 视图）实现执行进度实时显示。
  //       WebSocket 方案不可行：后端 WS 端点（workflow_exec_router.py workflow_ws）
  //       要求 ?token= 查询参数，而前端 access token 存于 HttpOnly Cookie
  //       （client.ts P0 修复），JS 无法读取，无法拼接到 WS URL。故采用轮询
  //       GET /workflows/{id}（复用 get，返回 tasks[].status + workflow.status）。
  const { data: liveDetail } = useQuery({
    queryKey: ['workflow-live', editorWorkflow?.id],
    queryFn: () => editorWorkflow ? workflowApi.get(editorWorkflow.id) : Promise.resolve(null),
    enabled: !!editorWorkflow && editorWorkflow.status === 'in_progress' && !editorEditMode,
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (!liveDetail) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 轮询结果同步到编辑器状态（项目既有约定）
    setEditorWorkflow(prev =>
      prev && prev.id === liveDetail.id
        ? mergeLiveTaskStatus(prev, liveDetail.status, liveDetail.tasks)
        : prev,
    )
    // 到达终态后停止轮询，并刷新列表让卡片状态同步
    if (['completed', 'failed', 'cancelled'].includes(liveDetail.status)) {
      qc.invalidateQueries({ queryKey: ['workflows'] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅随轮询结果触发
  }, [liveDetail])

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
    <div className="min-h-screen">
      <div className="space-y-[var(--space-apple-md)] max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)]">

        {/* ── 欢迎横幅 ── */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight">
                {t('pages.workflow.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm hidden sm:block">
                {t('pages.workflow.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* 搜索框 */}
              <div className="relative flex-1 sm:flex-initial">
                <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/15 rounded-[var(--radius-pill)] px-[var(--space-apple-md)] py-2">
                  <Search size={14} className="text-white/70 shrink-0" />
                  <input
                    type="text"
                    placeholder={t('pages.workflow.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                    className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-full sm:w-52"
                    aria-label={t('pages.workflow.searchAria')}
                  />
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={16} />}
                onClick={() => { setPreselectedTemplateId(null); setShowCreateModal(true) }}
                className="bg-[var(--bg-secondary)]/90 text-[var(--color-primary-text)] hover:bg-[var(--bg-secondary)]"
              >
                {t('pages.workflow.quickCreate')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={handleRefresh}
                title={t('pages.workflow.refreshData')}
                aria-label={t('pages.workflow.refreshAria')}
                className="bg-[var(--bg-secondary)]/15 text-[var(--color-primary-text)] dark:text-white hover:bg-[var(--bg-secondary)]/25"
              >
                {t('pages.workflow.refresh')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => { setPreselectedTemplateId(null); setShowCreateModal(true) }}
                className="bg-[var(--bg-secondary)] text-[var(--color-primary-text)] hover:bg-[var(--bg-secondary)]/90 shrink-0"
              >
                {t('pages.workflow.createWorkflow')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── 统计卡片 ── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
            <StatCard
              label={t('pages.workflow.totalWorkflows')}
              value={stats.total}
              icon={GitBranch}
              variant="primary"
            />
            <StatCard
              label={t('pages.workflow.completed')}
              value={completedCount}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              label={t('pages.workflow.failed')}
              value={failedCount}
              icon={XCircle}
              variant="warning"
            />
            <StatCard
              label={t('pages.workflow.pending')}
              value={pendingCount}
              icon={Clock}
              variant="info"
            />
          </div>
        )}

        {/* ── 快捷创建 ── */}
        <Card>
          <CardHeader className="px-6 pt-6 pb-[var(--space-apple-md)]">
            <CardTitle as="h3" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pages.workflow.quickCreateTitle')}</CardTitle>
            <p className="text-xs text-[var(--text-muted)]">{t('pages.workflow.quickCreateDesc')}</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
              {QUICK_CREATE_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.type}
                    onClick={() => handleQuickCreate(card.templateId)}
                    className={cn(
                      'group relative flex flex-col items-start p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)]',
                      'border border-[var(--border-color)]/60',
                      'bg-[var(--bg-secondary)]/50',
                      'hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)]',
                      'transition-all duration-200',
                      'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br', card.gradient,
                      'flex items-center justify-center shadow-sm',
                      'group-hover:scale-105 transition-transform duration-200',
                    )}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-[var(--space-apple-sm)] leading-tight">
                      {t(card.labelKey)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed line-clamp-2">
                      {t(card.descKey)}
                    </p>
                    <ChevronRight
                      size={14}
                      className="absolute top-[var(--space-apple-md)] right-3 text-[var(--text-muted)] dark:text-[var(--text-muted)] group-hover:text-[var(--color-primary-text)]0 transition-colors duration-200"
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
              'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-pill)] text-xs font-medium transition-all duration-200 min-h-[44px] inline-flex items-center',
              !statusFilter
                ? 'bg-neutral-900 dark:bg-[var(--bg-secondary)] text-white dark:text-neutral-900 shadow-sm'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] border border-[var(--border-color)]',
            )}
          >
            {t('pages.workflow.all')}
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-pill)] text-xs font-medium transition-all duration-200 border min-h-[44px]',
                statusFilter === key
                  ? 'bg-neutral-900 dark:bg-[var(--bg-secondary)] text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]',
              )}
            >
              <cfg.icon size={11} className="opacity-70" />
              {t(cfg.labelKey)}
            </button>
          ))}
        </div>

        {/* ── 工作流列表 ── */}
        <div className="space-y-[var(--space-apple-sm)]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex items-center gap-4 p-[var(--space-apple-md)]">
                  <div className="w-9 h-9 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] animate-pulse shrink-0" />
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
                  icon={<GitBranch className="w-10 h-10 text-[var(--text-muted)] dark:text-[var(--text-muted)]" />}
                  title={t('pages.workflow.noWorkflows')}
                  description={t('pages.workflow.noWorkflowsDesc')}
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
            onClose={() => { setEditorWorkflow(null); setEditorEditMode(false) }}
            maxWidth="85vw"
            maxHeight="85vh"
            title={editorWorkflow.name || t('pages.workflow.flowChart')}
          >
            <div className="flex items-center gap-[var(--space-apple-sm)] mb-[var(--space-apple-md)]">
              <StatusBadge status={editorWorkflow.status} size="sm" />
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {editorWorkflow.created_at && format(new Date(editorWorkflow.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                {editorWorkflow.task_count != null && ` · ${t('pages.workflow.tasks', { count: editorWorkflow.task_count })}`}
              </span>
              {editorWorkflow.status === 'in_progress' && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-secondary-text)]">
                  <Loader2 size={12} className="animate-spin" />
                  实时刷新中
                </span>
              )}
              <div className="flex-1" />
              {/* A-27: 编辑入口——编辑器此前恒 readOnly 且无 onSave，无法编辑/保存。
                  进入编辑模式后，编辑器自带工具栏的「保存」按钮会调用 onSave。 */}
              {!editorEditMode ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Play className="w-3.5 h-3.5" />}
                  disabled={editorWorkflow.status === 'in_progress'}
                  onClick={() => setEditorEditMode(true)}
                >
                  {t('pages.workflow.edit')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditorEditMode(false)}
                >
                  {t('pages.workflow.cancelEdit')}
                </Button>
              )}
            </div>
            <div className="h-[calc(85vh-12rem)] min-h-[400px]">
              <WorkflowVisualEditor
                workflow={editorWorkflow}
                readOnly={!editorEditMode}
                onSave={async (cfg) => {
                  await saveConfigMut.mutateAsync({
                    nodes: cfg.nodes,
                    edges: cfg.edges,
                    ...(cfg.metadata?.name ? { name: cfg.metadata.name } : {}),
                  })
                  // A-27 P3-2: 保存成功后回写 editorWorkflow.config，使弹窗停留
                  //           期间持有的 detail 为最新（否则仅 invalidate，弹窗内
                  //           仍是旧 config 引用；重开时经 onViewDetail→get 才刷新）。
                  setEditorWorkflow(prev =>
                    prev ? { ...prev, config: { nodes: cfg.nodes, edges: cfg.edges, ...(prev.config || {}) } } : prev
                  )
                }}
              />
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
  const { t } = useTranslation()
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['workflow-detail', workflow.id],
    queryFn: () => workflowApi.get(workflow.id),
    enabled: isExpanded,
  })

  const cancelMut = useMutation({
    mutationFn: () => workflowApi.cancel(workflow.id),
    onSuccess: (res) => { addToast({ type: 'success', message: res.message }); onAction() },
    onError: () => { addToast({ type: 'error', message: t('pages.workflow.cancelFailed') }) },
  })

  const retryMut = useMutation({
    mutationFn: () => workflowApi.retry(workflow.id),
    onSuccess: (res) => { addToast({ type: 'success', message: res.message }); onAction() },
    onError: () => { addToast({ type: 'error', message: t('pages.workflow.retryFailed') }) },
  })

  const executeMut = useMutation({
    mutationFn: () => workflowApi.execute(workflow.id),
    onSuccess: (res) => {
      const execId = res?.data?.execution_id || ''
      addToast({ type: 'success', message: execId ? t('pages.workflow.workflowStartedId', { id: execId }) : t('pages.workflow.workflowStarted') })
      onAction()
    },
    onError: () => { addToast({ type: 'error', message: t('pages.workflow.startFailed') }) },
  })

  const statusCfg = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.pending

  return (
    <>
      <Card className={cn(
        'overflow-hidden transition-all duration-200 border-[var(--border-color)] bg-[var(--bg-secondary)]',
        isExpanded && 'ring-1 ring-[var(--color-primary-container)] dark:ring-[var(--color-primary)] shadow-md',
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
          className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
        >
          <CardHeader className="px-5 py-4">
            <div className="flex items-center gap-4">
              {/* 状态图标 */}
              <div className={cn(
                'w-9 h-9 rounded-[var(--radius-Apple-sm)] flex items-center justify-center shrink-0',
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
                  <CardTitle as="h3" className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {workflow.name}
                  </CardTitle>
                  <span className="shrink-0 px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                    {t(TYPE_LABELS[workflow.workflow_type] || workflow.workflow_type) || workflow.workflow_type}
                  </span>
                  <StatusBadge status={workflow.status} size="sm" />
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                  {workflow.description || t('pages.workflow.noDescription')}
                  {typeof workflow.task_count === 'number' && (
                    <span className="ml-1.5 text-[var(--text-muted)]">
                      · {workflow.task_count > 0 ? t('pages.workflow.tasks', { count: workflow.task_count }) : t('pages.workflow.noTasks')}
                    </span>
                  )}
                </p>
              </div>

              {/* 右侧操作 */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                  {workflow.created_at && format(new Date(workflow.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); onViewDetail() }}
                >
                  <GitBranch size={12} className="mr-1" />
                  {t('pages.workflow.flowChart')}
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
          <div className="border-t border-[var(--border-color)]/40">
            {/* 任务列表 */}
            <div className="max-h-[320px] overflow-y-auto">
              {detailLoading ? (
                <div className="p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : detail?.tasks && detail.tasks.length > 0 ? (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
                  {detail.tasks.map((task, idx) => {
                    const taskCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending
                    const isLast = idx === detail.tasks.length - 1
                    return (
                      <div key={task.id} className="flex items-start gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-[var(--space-apple-md)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/20 transition-colors">
                        {/* 节点指示器 */}
                        <div className="flex flex-col items-center w-6 shrink-0 pt-1">
                          <div className={cn(
                            'w-5 h-5 rounded-[var(--radius-pill)] border-2 flex items-center justify-center shrink-0',
                            taskCfg.color,
                          )}>
                            <taskCfg.icon size={10} />
                          </div>
                          {!isLast && (
                            <div className="flex-1 w-px bg-[var(--border-color)] my-0.5" />
                          )}
                        </div>

                        {/* 任务信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-xs text-[var(--text-muted)] font-mono">
                              {t('pages.workflow.stepN', { n: task.step_order + 1 })}
                            </span>
                            <span className="text-xs font-medium text-[var(--text-primary)]">
                              {task.name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                              {t(TASK_TYPE_LABELS[task.task_type] || task.task_type) || task.task_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-[var(--space-apple-sm)] mt-0.5">
                            <span className={cn(
                              'text-xs font-medium',
                              taskCfg.color.replace('border-', 'text-').split(' ')[0],
                            )}>
                              {t(taskCfg.labelKey)}
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
                  <p className="text-xs text-[var(--text-muted)]">{t('pages.workflow.noTasks')}</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="border-t border-[var(--border-color)]/40 p-[var(--space-apple-sm)] flex items-center gap-2 flex-wrap bg-[var(--bg-tertiary)]/20">
              {(workflow.status === 'in_progress' || workflow.status === 'pending') && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Ban className="w-3.5 h-3.5" />}
                  loading={cancelMut.isPending}
                  onClick={(e) => { e.stopPropagation(); cancelMut.mutate() }}
                >
                  {t('pages.workflow.cancel')}
                </Button>
              )}
              {workflow.status === 'pending' && (
                <Button
                  size="sm"
                  icon={<Play className="w-3.5 h-3.5" />}
                  loading={executeMut.isPending}
                  onClick={(e) => { e.stopPropagation(); executeMut.mutate() }}
                >
                  {t('pages.workflow.start')}
                </Button>
              )}
              {workflow.status === 'failed' && (
                <Button
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  loading={retryMut.isPending}
                  onClick={(e) => { e.stopPropagation(); retryMut.mutate() }}
                >
                  {t('pages.workflow.retry')}
                </Button>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                icon={<ChevronRight className="w-3.5 h-3.5" />}
                onClick={(e) => { e.stopPropagation(); onViewDetail() }}
              >
                {t('pages.workflow.viewFlowchart')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
