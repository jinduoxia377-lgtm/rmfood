/**
 * 工作流管理页面
 * 工作流列表 | 状态筛选 | 任务管线可视化
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GitBranch, CheckCircle, XCircle, Clock, Loader2, Play,
  CircleDot, AlertTriangle, ChevronRight, RotateCcw, Ban,
} from 'lucide-react'
import { workflowApi, type Workflow } from '@/api/workflow'
import {
  PageHeader, Badge, EmptyState, Skeleton, Pagination, Card, CardContent, Button,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useToast } from '@/components/ui/Toast'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: '等待中', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: CircleDot },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', icon: XCircle },
  failed: { label: '已失败', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: XCircle },
}

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: '等待', color: 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800', icon: CircleDot },
  in_progress: { label: '执行中', color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800', icon: Play },
  completed: { label: '完成', color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle },
  failed: { label: '失败', color: 'border-rose-400 bg-rose-50 dark:bg-rose-900/20', icon: XCircle },
  skipped: { label: '跳过', color: 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 opacity-50', icon: CircleDot },
}

const TYPE_LABELS: Record<string, string> = {
  ai_generation: 'AI 配方生成',
  data_sync: '数据同步',
  review: '审核流程',
  analysis: '数据分析',
}

export default function WorkflowPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', page, statusFilter],
    queryFn: () => workflowApi.list({ page, page_size: 10, status: statusFilter || undefined }),
  })

  const { data: stats } = useQuery({
    queryKey: ['workflow-statistics'],
    queryFn: workflowApi.statistics,
    staleTime: 60_000,
  })

  const workflows: Workflow[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 10)

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="工作流管理"
        description="查看 AI 配方生成、数据同步和审核流程的执行状态"
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '总工作流', value: stats.total, icon: GitBranch, gradient: 'from-slate-500 to-slate-600' },
            { label: '进行中', value: stats.by_status?.in_progress ?? 0, icon: Play, gradient: 'from-blue-500 to-blue-600' },
            { label: '已完成', value: stats.by_status?.completed ?? 0, icon: CheckCircle, gradient: 'from-emerald-500 to-green-600' },
            { label: '等待中', value: stats.by_status?.pending ?? 0, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} hoverable className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm`}>
                    <Icon size={16} className="text-white" />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
              </Card>
            )
          })}
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !statusFilter ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            全部
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* 工作流列表 */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/3 mb-3" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          ))
        ) : workflows.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
            title="暂无工作流"
            description="当创建配方或运行AI分析时，工作流会自动创建"
          />
        ) : (
          workflows.map((wf) => {
            const isExpanded = expandedId === wf.id
            return (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                isExpanded={isExpanded}
                onToggle={() => toggleExpand(wf.id)}
                onAction={() => qc.invalidateQueries({ queryKey: ['workflows'] })}
                addToast={addToast}
              />
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}

/**
 * 单个工作流卡片（含展开的任务管线）
 */
function WorkflowCard({
  workflow, isExpanded, onToggle, onAction, addToast,
}: {
  workflow: Workflow
  isExpanded: boolean
  onToggle: () => void
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

  const statusCfg = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-center gap-4 p-5">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            statusCfg.color,
          )}>
            <StatusIcon size={18} className={workflow.status === 'in_progress' ? 'animate-spin' : ''} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{workflow.name}</h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {TYPE_LABELS[workflow.workflow_type] || workflow.workflow_type}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {workflow.description || '无描述'}
              {workflow.task_count !== undefined && ` · ${workflow.task_count} 个任务`}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              {workflow.created_at && format(new Date(workflow.created_at), 'MM-dd HH:mm', { locale: zhCN })}
            </span>
            <Badge variant={workflow.status === 'completed' ? 'success' : workflow.status === 'in_progress' ? 'info' : workflow.status === 'failed' ? 'danger' : 'neutral'} size="sm">
              {statusCfg.label}
            </Badge>
            <ChevronRight size={16} className={cn(
              'text-slate-400 transition-transform',
              isExpanded && 'rotate-90',
            )} />
          </div>
        </div>
      </button>

      {/* 展开的任务管线 */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-800/20 p-5">
          {detailLoading ? (
            <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : detail?.tasks && detail.tasks.length > 0 ? (
            <div className="space-y-0">
              {detail.tasks.map((task, idx) => {
                const taskCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending
                const TaskIcon = taskCfg.icon
                const isLast = idx === detail.tasks.length - 1

                return (
                  <div key={task.id} className="flex items-stretch gap-3">
                    {/* 连接线 + 节点 */}
                    <div className="flex flex-col items-center w-6 shrink-0">
                      <div className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                        taskCfg.color,
                      )}>
                        <TaskIcon size={12} />
                      </div>
                      {!isLast && (
                        <div className="flex-1 w-0.5 min-h-[24px] bg-slate-200 dark:bg-slate-700 my-1" />
                      )}
                    </div>

                    {/* 任务信息 */}
                    <div className={cn(
                      'flex-1 py-1 pb-3',
                      isLast && 'pb-0',
                    )}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          Step {task.step_order}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {task.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {task.task_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <span className={cn('text-xs font-medium', taskCfg.color.replace('border-', 'text-').split(' ')[0])}>
                          {TASK_STATUS_CONFIG[task.status]?.label || task.status}
                        </span>
                        {task.duration_ms != null && task.duration_ms > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {(task.duration_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                        {task.error_message && (
                          <span className="text-[10px] text-rose-500 flex items-center gap-1">
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
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">暂无任务节点</p>
          )}

          {/* 操作按钮 */}
          {(workflow.status === 'in_progress' || workflow.status === 'pending') && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/40 flex justify-end">
              <Button
                variant="danger"
                size="sm"
                icon={<Ban className="w-3.5 h-3.5" />}
                loading={cancelMut.isPending}
                onClick={(e) => { e.stopPropagation(); cancelMut.mutate() }}
              >
                取消工作流
              </Button>
            </div>
          )}
          {workflow.status === 'failed' && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/40 flex justify-end">
              <Button
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                loading={retryMut.isPending}
                onClick={(e) => { e.stopPropagation(); retryMut.mutate() }}
              >
                重新执行
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
