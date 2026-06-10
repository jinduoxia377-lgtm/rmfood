/**
 * 实验详情页 - Phase 3 增强版
 * 完整实验数据管理：数据录入表格 + 图表可视化 + 状态流转 + 时间线
 * 全面使用公共组件：Card/CardHeader/CardTitle/CardContent + Button/Input/Badge
 */
import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Play, CheckCircle, Edit3, Plus, Trash2, TrendingUp,
  FileText, Target, FlaskConical, Calendar, BarChart3, XCircle,
  Download, Paperclip, Upload, Save, X, Clock, Table, ClipboardPaste,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { experimentApi } from '@/api/experiment'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { attachmentApi, type Attachment } from '@/api/attachment'

// ── 便捷 hooks ──
function useExperiment(id: number) {
  return useQuery({
    queryKey: ['experiment', id],
    queryFn: () => experimentApi.get(id),
    enabled: !!id,
  })
}

// ── 数据录入表单 ──
function DataEntryForm({
  experimentId,
  onClose,
}: {
  experimentId: number
  onClose: () => void
}) {
  const [parameter, setParameter] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const addMut = useMutation({
    mutationFn: () => experimentApi.addData(experimentId, parameter, value || null, unit || undefined, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiment-data', experimentId] })
      onClose()
    },
  })

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 animate-slide-down">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">录入数据点</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <XCircle size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">参数名 *</label>
          <Input
            value={parameter}
            onChange={(e) => setParameter(e.target.value)}
            placeholder="如: pH值"
            size="sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">数值</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="如: 7.2"
            size="sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">单位</label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="如: mg/L"
            size="sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">备注</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="可选备注"
          size="sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
        <Button
          size="sm"
          onClick={() => addMut.mutate()}
          loading={addMut.isPending}
          disabled={!parameter.trim()}
        >
          添加数据
        </Button>
      </div>
    </div>
  )
}

// ── 数据表格 ──
function DataTable({
  data,
  experimentId,
}: {
  data: { id: number; parameter: string; value: string | number | null; unit: string | null; notes: string | null; recorded_at: string }[]
  experimentId: number
}) {
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (dataPointId: number) => experimentApi.deleteData(dataPointId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment-data', experimentId] }),
  })

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">暂无实验数据</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击「录入数据」开始记录实验数据</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">参数</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">数值</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">单位</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">备注</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">时间</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{d.parameter}</td>
              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-mono">{d.value ?? '-'}</td>
              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{d.unit ?? '-'}</td>
              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{d.notes ?? '-'}</td>
              <td className="py-2.5 px-3 text-xs text-slate-400">
                {format(new Date(d.recorded_at), 'MM-dd HH:mm', { locale: zhCN })}
              </td>
              <td className="py-2.5 px-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMut.mutate(d.id)}
                  disabled={deleteMut.isPending}
                  className="!p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 数据可视化 ──
function DataView({
  data,
}: {
  data: { parameter: string; value: string | number | null; recorded_at: string }[]
}) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  const { chartData, parameters } = useMemo(() => {
    const paramValues: Record<string, { value: number; time: string }[]> = {}
    for (const d of data) {
      const numVal = Number(d.value)
      if (isNaN(numVal) || d.value === null) continue
      if (!paramValues[d.parameter]) paramValues[d.parameter] = []
      paramValues[d.parameter].push({
        value: numVal,
        time: format(new Date(d.recorded_at), 'MM-dd HH:mm'),
      })
    }
    const params = Object.keys(paramValues)
    const maxLength = Math.max(...params.map((p) => paramValues[p].length), 0)
    const cd = []
    for (let i = 0; i < maxLength; i++) {
      const point: Record<string, string | number> = {}
      for (const p of params) {
        if (paramValues[p][i]) {
          point.time = paramValues[p][i].time
          point[p] = paramValues[p][i].value
        }
      }
      if (point.time) cd.push(point)
    }
    return { chartData: cd, parameters: params }
  }, [data])

  const numericData = data.filter((d) => d.value !== null && !isNaN(Number(d.value)))
  const hasNumericData = numericData.length > 0

  if (!hasNumericData) {
    return (
      <div className="text-center py-8">
        <TrendingUp size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">暂无可视化数据</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">录入数值型数据后将自动生成图表</p>
      </div>
    )
  }

  const COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{parameters.length} 个参数</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">|</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{numericData.length} 个数据点</span>
        </div>
        <div className="flex gap-1">
          {(['line', 'bar'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                chartType === type
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              {type === 'line' ? '折线图' : '柱状图'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card-bg-solid)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: 12,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {parameters.map((p, i) => (
                <Line key={p} type="monotone" dataKey={p} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card-bg-solid)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: 12,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {parameters.map((p, i) => (
                <Bar key={p} dataKey={p} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── 实验进度时间线 ──
function ExperimentTimeline({ experiment }: { experiment: any }) {
  const statusFlow = [
    { key: 'planned', label: '计划中', icon: Clock },
    { key: 'in_progress', label: '进行中', icon: Play },
    { key: 'completed', label: '已完成', icon: CheckCircle },
  ]
  const statusOrder = ['planned', 'in_progress', 'completed']
  const currentIndex = statusOrder.indexOf(experiment.status)
  const isFailed = experiment.status === 'failed'
  const isCancelled = experiment.status === 'cancelled'

  if (isFailed || isCancelled) {
    const Icon = experiment.status === 'failed' ? XCircle : Clock
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <Icon size={20} className={experiment.status === 'failed' ? 'text-red-500' : 'text-slate-400'} />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {experiment.status === 'failed' ? '实验已失败' : '实验已取消'}
          </p>
          {experiment.actual_start && (
            <p className="text-xs text-slate-500 mt-0.5">
              开始于 {format(new Date(experiment.actual_start), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
              {experiment.actual_end && ` · 结束于 ${format(new Date(experiment.actual_end), 'yyyy-MM-dd HH:mm', { locale: zhCN })}`}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {statusFlow.map((step, i) => {
        const isActive = i === currentIndex
        const isDone = i < currentIndex
        const Icon = step.icon
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
              isActive && 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800',
              isDone && 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50',
              !isActive && !isDone && 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700',
            )}>
              <Icon size={14} className={cn(
                isDone ? 'text-green-500' : isActive ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600',
              )} />
              <span className={cn(
                'text-xs font-medium',
                isDone ? 'text-green-700 dark:text-green-400' : isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-400',
              )}>{step.label}</span>
            </div>
            {i < statusFlow.length - 1 && (
              <div className={cn('w-6 h-0.5 rounded', isDone ? 'bg-green-300 dark:bg-green-700' : 'bg-slate-200 dark:bg-slate-700')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 批量数据导入 ──
function BatchImportForm({
  experimentId,
  onClose,
}: {
  experimentId: number
  onClose: () => void
}) {
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null)
  const qc = useQueryClient()

  const handleImport = async () => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return
    setImporting(true)
    let success = 0
    let errors = 0
    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
      if (cols.length >= 2) {
        try {
          await experimentApi.addData(experimentId, cols[0], cols[1] || null, cols[2] || undefined, cols[3] || undefined)
          success++
        } catch {
          errors++
        }
      } else {
        errors++
      }
    }
    setResult({ success, errors })
    qc.invalidateQueries({ queryKey: ['experiment-data', experimentId] })
    setImporting(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 animate-slide-down">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardPaste size={14} className="text-primary-500" />
          批量导入数据
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-slate-500">粘贴 CSV 数据，格式：参数名,数值,单位,备注（首行为标题）</p>
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={"参数,数值,单位,备注\npH值,7.2,,\n温度,25,°C,水浴\n浓度,0.5,mg/mL,"}
        rows={5}
        className="w-full text-xs font-mono p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {result && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600">{result.success} 条成功</span>
          {result.errors > 0 && <span className="text-red-500">{result.errors} 条失败</span>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={handleImport} loading={importing} disabled={!csvText.trim()} icon={<Table size={12} />}>
          导入
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const experimentId = Number(id)
  const [showForm, setShowForm] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [dataView, setDataView] = useState<'table' | 'chart'>('table')
  const [editingConclusions, setEditingConclusions] = useState(false)
  const [conclusionText, setConclusionText] = useState('')
  const [recommendText, setRecommendText] = useState('')

  const { data: experiment, isLoading } = useExperiment(experimentId)

  // 附件
  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', 'experiment', experimentId],
    queryFn: () => attachmentApi.list({ experiment_id: experimentId }),
    enabled: !!experimentId,
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => attachmentApi.upload(file, { experiment_id: experimentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', 'experiment', experimentId] }),
  })

  const deleteAttachMut = useMutation({
    mutationFn: (id: number) => attachmentApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', 'experiment', experimentId] }),
  })

  const { data: dataPoints = [] } = useQuery({
    queryKey: ['experiment-data', experimentId],
    queryFn: () => experimentApi.getData(experimentId),
    enabled: !!experimentId,
  })

  const startMut = useMutation({
    mutationFn: () => experimentApi.start(experimentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  const completeMut = useMutation({
    mutationFn: () => experimentApi.complete(experimentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  // ── CSV 导出 ──
  const handleExportCSV = () => {
    if (!dataPoints || dataPoints.length === 0) return
    const headers = ['参数', '数值', '单位', '备注', '记录时间']
    const rows = dataPoints.map((d) => [
      d.parameter,
      String(d.value ?? ''),
      d.unit ?? '',
      d.notes ?? '',
      format(new Date(d.recorded_at), 'yyyy-MM-dd HH:mm', { locale: zhCN }),
    ])
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${experiment?.code ?? '实验'}_数据导出.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── 结论/建议编辑 ──
  const saveConclusionsMut = useMutation({
    mutationFn: (data: { conclusions?: string; recommendations?: string }) =>
      experimentApi.update(experimentId, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiment', experimentId] })
      setEditingConclusions(false)
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-slate-500">实验不存在</p>
        <Link to="/experiments" className="text-primary-600 text-sm mt-2 inline-block">返回列表</Link>
      </div>
    )
  }

  const isEditable = experiment.status === 'planned' || experiment.status === 'in_progress'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 头部导航 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate('/experiments')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>
        <div className="flex items-center gap-2">
          {experiment.status === 'planned' && (
            <Button
              size="sm"
              onClick={() => startMut.mutate()}
              loading={startMut.isPending}
              icon={<Play size={14} />}
            >
              开始实验
            </Button>
          )}
          {experiment.status === 'in_progress' && (
            <Button
              size="sm"
              onClick={() => completeMut.mutate()}
              loading={completeMut.isPending}
              icon={<CheckCircle size={14} />}
            >
              完成实验
            </Button>
          )}
          {isEditable && (
            <Link to={`/experiments/${experiment.id}/edit`}>
              <Button variant="secondary" size="sm" icon={<Edit3 size={14} />}>
                编辑
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 基本信息卡片 */}
      <Card>
        <CardContent>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{experiment.title}</h1>
                <StatusBadge status={experiment.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {experiment.code} · 创建于 {format(new Date(experiment.created_at), 'yyyy-MM-dd', { locale: zhCN })}
              </p>
            </div>
            {experiment.formula_id && (
              <Link
                to={`/formulas/${experiment.formula_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
              >
                <FlaskConical size={12} />
                关联配方
              </Link>
            )}
          </div>

          {experiment.description && (
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4 text-sm">{experiment.description}</p>
          )}

          {/* 进度时间线 */}
          <div className="py-3 border-t border-slate-200 dark:border-slate-700">
            <ExperimentTimeline experiment={experiment} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {[
              { icon: Calendar, label: '计划开始', value: experiment.start_date ? format(new Date(experiment.start_date), 'MM-dd', { locale: zhCN }) : '-' },
              { icon: Calendar, label: '计划结束', value: experiment.end_date ? format(new Date(experiment.end_date), 'MM-dd', { locale: zhCN }) : '-' },
              { icon: Play, label: '实际开始', value: experiment.actual_start ? format(new Date(experiment.actual_start), 'MM-dd HH:mm', { locale: zhCN }) : '-' },
              { icon: CheckCircle, label: '实际结束', value: experiment.actual_end ? format(new Date(experiment.actual_end), 'MM-dd HH:mm', { locale: zhCN }) : '-' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 目标和方法 */}
      {(experiment.objectives?.length || experiment.methodology) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {experiment.objectives && experiment.objectives.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <Target size={16} className="text-primary-500" />
                  </div>
                  <CardTitle as="h2">实验目标</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {experiment.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {experiment.methodology && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <FileText size={16} className="text-primary-500" />
                  </div>
                  <CardTitle as="h2">实验方法</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{experiment.methodology}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 实验数据 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <BarChart3 size={16} className="text-primary-500" />
              </div>
              <div>
                <CardTitle as="h2">实验数据</CardTitle>
                <CardDescription>{dataPoints.length} 条数据</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 视图切换 */}
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setDataView('table')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    dataView === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500',
                  )}
                >
                  数据表
                </button>
                <button
                  onClick={() => setDataView('chart')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    dataView === 'chart' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500',
                  )}
                >
                  图表
                </button>
              </div>
              {isEditable && (
                <Button
                  size="sm"
                  onClick={() => setShowForm(true)}
                  icon={<Plus size={12} />}
                >
                  录入数据
                </Button>
              )}
              {isEditable && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowBatchImport(true)}
                  icon={<ClipboardPaste size={12} />}
                >
                  批量导入
                </Button>
              )}
              {dataPoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download size={12} />}
                  onClick={handleExportCSV}
                >
                  导出 CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {showForm && (
            <div className="mb-4">
              <DataEntryForm experimentId={experimentId} onClose={() => setShowForm(false)} />
            </div>
          )}

          {showBatchImport && (
            <div className="mb-4">
              <BatchImportForm experimentId={experimentId} onClose={() => setShowBatchImport(false)} />
            </div>
          )}

          {dataView === 'table' ? (
            <DataTable data={dataPoints} experimentId={experimentId} />
          ) : (
            <DataView data={dataPoints} />
          )}
        </CardContent>
      </Card>

      {/* 结论和建议 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle as="h2">结论与建议</CardTitle>
            {isEditable && !editingConclusions && (
              <Button variant="ghost" size="sm" icon={<Edit3 size={12} />} onClick={() => {
                setConclusionText(experiment?.conclusions ?? '')
                setRecommendText(experiment?.recommendations ?? '')
                setEditingConclusions(true)
              }}>
                编辑
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingConclusions ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">实验结论</label>
                <Textarea
                  value={conclusionText}
                  onChange={(e) => setConclusionText(e.target.value)}
                  placeholder="输入实验结论..."
                  rows={4}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">改进建议</label>
                <Textarea
                  value={recommendText}
                  onChange={(e) => setRecommendText(e.target.value)}
                  placeholder="输入改进建议..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingConclusions(false)}>取消</Button>
                <Button
                  size="sm"
                  icon={<Save size={14} />}
                  loading={saveConclusionsMut.isPending}
                  onClick={() => saveConclusionsMut.mutate({ conclusions: conclusionText, recommendations: recommendText })}
                >
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {experiment.conclusions && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">实验结论</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{experiment.conclusions}</p>
                </div>
              )}
              {experiment.recommendations && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">改进建议</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{experiment.recommendations}</p>
                </div>
              )}
              {!experiment.conclusions && !experiment.recommendations && (
                <div className="col-span-2 py-4 text-center text-sm text-slate-400">暂无结论和建议</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 附件管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Paperclip size={16} className="text-slate-400" />
              </div>
              <CardTitle as="h2">附件</CardTitle>
              <Badge variant="neutral" size="sm">{attachments.length}</Badge>
            </div>
            {isEditable && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadMut.mutate(file)
                    e.target.value = ''
                  }}
                />
                <Button variant="ghost" size="sm" icon={<Upload size={12} />}>
                  上传
                </Button>
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att: Attachment) => (
                <div key={att.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{att.file_name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {(att.file_size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => deleteAttachMut.mutate(att.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400">暂无附件</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
