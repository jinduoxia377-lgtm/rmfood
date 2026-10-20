/**
 * 实验详情页 - Phase 3 增强版
 * 完整实验数据管理：数据录入表格 + 图表可视化 + 状态流转 + 时间线
 * 全面使用公共组件：Card/CardHeader/CardTitle/CardContent + Button/Input/Badge
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Play, CheckCircle, Edit3, Plus, Trash2, TrendingUp,
  FileText, Target, FlaskConical, Calendar, BarChart3, XCircle,
  Download, Paperclip, Upload, Save, X, Clock, Table, ClipboardPaste,
  ChevronRight, BarChart3 as Chart3, Sparkles, Share2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { ExperimentData } from '@/types'
import { experimentApi } from '@/api/experiment'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { attachmentApi, type Attachment } from '@/api/attachment'
import { useToast } from '@/components/ui/Toast'
import { FormulaValidationPanel } from '@/components/experiment/FormulaValidationPanel'

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
  const { t } = useTranslation()
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
    <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)] animate-slide-down">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.experimentDetail.entryDataPoint')}</h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] transition-colors">
          <XCircle size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.paramName')} *</label>
          <Input
            value={parameter}
            onChange={(e) => setParameter(e.target.value)}
            placeholder={t('pages.experimentDetail.paramPlaceholder')}
            size="sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.value')}</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('pages.experimentDetail.valuePlaceholder')}
            size="sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.unit')}</label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('pages.experimentDetail.unitPlaceholder')}
            size="sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.notes')}</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('pages.experimentDetail.notesPlaceholder')}
          size="sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('pages.experimentDetail.cancel')}</Button>
        <Button
          size="sm"
          onClick={() => addMut.mutate()}
          loading={addMut.isPending}
          disabled={!parameter.trim()}
        >
          {t('pages.experimentDetail.addData')}
        </Button>
      </div>
    </div>
  )
}

// 数据点时间字段可能缺失/为 null/不可解析 → new Date 得 Invalid Date，
// date-fns format 会抛 RangeError 导致表格/页面崩溃。统一兜底：
// 依次取 recorded_at → timestamp → created_at → measurement_time，
// 校验可解析后再 format，全部无效则显示 '-'。
function formatDataTime(
  d: { recorded_at?: string | null; timestamp?: string | null; created_at?: string | null; measurement_time?: string | null },
  pattern = 'MM-dd HH:mm',
): string {
  const raw = d.recorded_at ?? d.timestamp ?? d.created_at ?? d.measurement_time
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return '-'
  return format(dt, pattern, { locale: zhCN })
}

/**
 * 安全的实验级日期格式化：
 * 用于 Experiment.start_date / end_date / actual_start / actual_end / created_at 等
 * 可能为 null/undefined/空串/非法字符串的字段，避免 `new Date(null)` / `new Date('')`
 * 导致 date-fns format 抛 RangeError: Invalid time value。
 */
function formatExpDate(
  raw: string | null | undefined,
  pattern = 'yyyy-MM-dd',
): string {
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return '-'
  return format(dt, pattern, { locale: zhCN })
}

// ── 数据表格 ──
function DataTable({
  data,
  experimentId,
  colors,
}: {
  data: ExperimentData[]
  experimentId: number
  colors: string[]
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (dataPointId: number) => experimentApi.deleteData(dataPointId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment-data', experimentId] }),
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ parameter: string; value: string; unit: string; notes: string }>({ parameter: '', value: '', unit: '', notes: '' })
  const updateMut = useMutation({
    mutationFn: (payload: { dataPointId: number; data: Record<string, string | number | null | undefined> }) =>
      experimentApi.updateData(payload.dataPointId, payload.data as Parameters<typeof experimentApi.updateData>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiment-data', experimentId] })
      setEditingId(null)
    },
  })

  const startEdit = (d: ExperimentData) => {
    setEditingId(d.id)
    setEditForm({
      parameter: String(d.parameter ?? d.measurementType ?? ''),
      value: String(d.value ?? ''),
      unit: d.unit ?? '',
      notes: d.notes ?? '',
    })
  }

  const saveEdit = () => {
    if (editingId === null) return
    // 规范化 value：数值字符串转 number，空串转 null，其余保持字符串
    const rawVal = editForm.value.trim()
    let value: number | string | null
    if (rawVal === '') {
      value = null
    } else if (!Number.isNaN(Number(rawVal))) {
      value = Number(rawVal)
    } else {
      value = rawVal
    }
    updateMut.mutate({
      dataPointId: editingId,
      data: {
        parameter: editForm.parameter,
        value,
        unit: editForm.unit,
        notes: editForm.notes,
      },
    })
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 size={32} className="mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[var(--text-muted)]">{t('pages.experimentDetail.noData')}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">{t('pages.experimentDetail.noDataHint')}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)]">
            <th className="text-left py-2.5 px-[var(--space-apple-sm)] text-xs font-semibold text-[var(--text-muted)]">{t('pages.experimentDetail.colParam')}</th>
            <th className="text-left py-2.5 px-[var(--space-apple-sm)] text-xs font-semibold text-[var(--text-muted)]">{t('pages.experimentDetail.colValue')}</th>
            <th className="text-left py-2.5 px-[var(--space-apple-sm)] text-xs font-semibold text-[var(--text-muted)]">{t('pages.experimentDetail.colUnit')}</th>
            <th className="text-left py-2.5 px-[var(--space-apple-sm)] text-xs font-semibold text-[var(--text-muted)]">{t('pages.experimentDetail.colNotes')}</th>
            <th className="text-left py-2.5 px-[var(--space-apple-sm)] text-xs font-semibold text-[var(--text-muted)]">{t('pages.experimentDetail.colTime')}</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const isEditing = editingId === d.id
            return (
              <tr key={d.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                {isEditing ? (
                  <>
                    <td className="py-2 px-[var(--space-apple-sm)]">
                      <input value={editForm.parameter} onChange={(e) => setEditForm({ ...editForm, parameter: e.target.value })} className="w-full h-7 px-2 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-secondary)]" placeholder={t('pages.experimentDetail.paramName')} />
                    </td>
                    <td className="py-2 px-[var(--space-apple-sm)]">
                      <input value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} className="w-full h-7 px-2 text-xs font-mono rounded border border-[var(--border-color)] bg-[var(--bg-secondary)]" placeholder={t('pages.experimentDetail.value')} />
                    </td>
                    <td className="py-2 px-[var(--space-apple-sm)]">
                      <input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-16 h-7 px-2 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-secondary)]" placeholder={t('pages.experimentDetail.unit')} />
                    </td>
                    <td className="py-2 px-[var(--space-apple-sm)]">
                      <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full h-7 px-2 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-secondary)]" placeholder={t('pages.experimentDetail.notes')} />
                    </td>
                    <td className="py-2 px-[var(--space-apple-sm)] text-xs text-[var(--text-muted)]">{formatDataTime(d)}</td>
                    <td className="py-2 px-[var(--space-apple-sm)] flex gap-1">
                      <Button variant="ghost" size="sm" onClick={saveEdit} disabled={updateMut.isPending} className="!p-1 text-[var(--color-success-text)] hover:bg-[var(--color-success-container)]">
                        <Save size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="!p-1 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]">
                        <X size={13} />
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-[var(--space-apple-sm)] font-medium text-[var(--text-primary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[var(--radius-pill)]" style={{ backgroundColor: colors[data.indexOf(d) % colors.length] }} />
                        {d.parameter ?? d.measurementType ?? '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-[var(--space-apple-sm)] text-[var(--text-primary)] font-mono">{d.value ?? '-'}</td>
                    <td className="py-2.5 px-[var(--space-apple-sm)] text-[var(--text-muted)]">{d.unit ?? '-'}</td>
                    <td className="py-2.5 px-[var(--space-apple-sm)] text-[var(--text-muted)] max-w-[200px] truncate">{d.notes ?? '-'}</td>
                    <td className="py-2.5 px-[var(--space-apple-sm)] text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      {formatDataTime(d)}
                    </td>
                    <td className="py-2.5 px-[var(--space-apple-sm)] flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(d)}
                        className="!p-1 text-[var(--text-muted)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20"
                        title={t('pages.experimentDetail.editTitle')}
                      >
                        <Edit3 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMut.mutate(d.id)}
                        disabled={deleteMut.isPending}
                        className="!p-1 text-[var(--text-muted)] hover:text-[var(--color-error-text)]0 hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── 数据可视化 ──
function DataView({
  data,
}: {
  data: ExperimentData[]
}) {
  const { t } = useTranslation()
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  const { chartData, parameters } = useMemo(() => {
    const paramValues: Record<string, { value: number; time: string }[]> = {}
    for (const d of data) {
      const numVal = Number(d.value)
      if (isNaN(numVal) || d.value === null) continue
      const paramKey = d.parameter ?? d.measurementType; if (!paramKey) continue; if (!paramValues[paramKey]) paramValues[paramKey] = []
      paramValues[paramKey].push({
        value: numVal,
        time: formatDataTime(d),
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
        <TrendingUp size={32} className="mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[var(--text-muted)]">{t('pages.experimentDetail.noChartData')}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">{t('pages.experimentDetail.noChartDataHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-[var(--space-apple-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{t('pages.experimentDetail.paramsLabel', { count: parameters.length })}</span>
          <span className="text-xs text-[var(--text-muted)]">|</span>
          <span className="text-xs text-[var(--text-muted)]">{t('pages.experimentDetail.dataPointsLabel', { count: numericData.length })}</span>
        </div>
        <div className="flex gap-1">
          {(['line', 'bar'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={cn(
                'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                chartType === type
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)]',
              )}
            >
              {type === 'line' ? t('pages.experimentDetail.lineChart') : t('pages.experimentDetail.barChart')}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {parameters.map((p, i) => (
                <Line key={p} type="monotone" dataKey={p} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
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
function ExperimentTimeline({ experiment, progress }: { experiment: any; progress: number }) {
  const { t } = useTranslation()
  const statusFlow = [
    { key: 'planned', labelKey: 'pages.experimentDetail.timelinePlanned', icon: Clock },
    { key: 'in_progress', labelKey: 'pages.experimentDetail.timelineInProgress', icon: Play },
    { key: 'completed', labelKey: 'pages.experimentDetail.timelineCompleted', icon: CheckCircle },
  ]
  const statusOrder = ['planned', 'in_progress', 'completed']
  const currentIndex = statusOrder.indexOf(experiment.status)
  const isFailed = experiment.status === 'failed'
  const isCancelled = experiment.status === 'cancelled'

  if (isFailed || isCancelled) {
    const Icon = experiment.status === 'failed' ? XCircle : Clock
    return (
      <div className="flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
        <Icon size={20} className={experiment.status === 'failed' ? 'text-[var(--color-error-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'} />
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {experiment.status === 'failed' ? t('pages.experimentDetail.experimentFailed') : t('pages.experimentDetail.experimentCancelled')}
          </p>
          {experiment.actual_start && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
              {t('pages.experimentDetail.startedAt', { date: formatExpDate(experiment.actual_start, 'yyyy-MM-dd HH:mm') })}
              {experiment.actual_end && ` · ${t('pages.experimentDetail.endedAt', { date: formatExpDate(experiment.actual_end, 'yyyy-MM-dd HH:mm') })}`}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">{t('pages.experimentDetail.progressLabel')}</span>
          <span className="text-xs font-bold text-[var(--color-primary-text)]">{progress}%</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-[var(--radius-pill)] transition-all duration-700',
              progress >= 100 ? 'bg-[var(--color-success-container)]0' : progress >= 50 ? 'bg-[var(--color-primary-container)]0' : 'bg-[var(--color-warning-container)]0',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {statusFlow.map((step, i) => {
        const isActive = i === currentIndex
        const isDone = i < currentIndex
        const Icon = step.icon
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-2 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] transition-colors',
              isActive && 'bg-[var(--color-primary-container)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]',
              isDone && 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/15 border border-[var(--color-success-border)] dark:border-[var(--color-success)]/50',
              !isActive && !isDone && 'bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]',
            )}>
              <Icon size={14} className={cn(
                isDone ? 'text-[var(--color-success-text)]0' : isActive ? 'text-[var(--color-primary-text)]0' : 'text-[var(--text-muted)] dark:text-[var(--text-muted)]',
              )} />
              <span className={cn(
                'text-xs font-medium',
                isDone ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' : isActive ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]',
              )}>{t(step.labelKey)}</span>
            </div>
            {i < statusFlow.length - 1 && (
              <div className={cn('w-6 h-0.5 rounded', isDone ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success)]' : 'bg-[var(--border-color)]')} />
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
  const { t } = useTranslation()
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
    <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)] animate-slide-down">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ClipboardPaste size={14} className="text-[var(--color-primary-text)]0" />
          {t('pages.experimentDetail.batchImportData')}
        </h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] transition-colors">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentDetail.csvFormatHint')}</p>
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={t('pages.experimentDetail.csvPlaceholder')}
        rows={5}
        className="w-full text-xs font-mono p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      {result && (
        <div className="flex items-center gap-[var(--space-apple-sm)] text-xs">
          <span className="text-[var(--color-success-text)]">{t('pages.experimentDetail.importSuccessCount', { count: result.success })}</span>
          {result.errors > 0 && <span className="text-[var(--color-error-text)]0">{t('pages.experimentDetail.importErrorCount', { count: result.errors })}</span>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('pages.experimentDetail.cancel')}</Button>
        <Button size="sm" onClick={handleImport} loading={importing} disabled={!csvText.trim()} icon={<Table size={12} />}>
          {t('pages.experimentDetail.importAction')}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 主页面
// ═══════════════════════════════════════

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1']

// ── 文件解析弹窗 ──
function DataParseModal({ experimentId, onClose }: { experimentId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [formatType, setFormatType] = useState<'auto' | 'animl' | 'jcamp' | 'csv'>('auto')
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setError(null)
    setResult(null)
    try {
      const res = await experimentApi.parseDataFile(file, formatType)
      if (res.success && res.data) {
        setResult(res.data)
        addToast({ type: 'success', message: t('pages.experimentDetail.parseSuccess', { count: formatPointCount(res.data) }) })
      } else {
        setError(res.data ? JSON.stringify(res.data) : t('pages.experimentDetail.parseReturnAbnormal'))
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? t('pages.experimentDetail.parseFailed'))
    } finally {
      setParsing(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    try {
      await experimentApi.addData(experimentId, '文件解析', null, '', JSON.stringify(result, null, 2))
      addToast({ type: 'success', message: t('pages.experimentDetail.saveResultSuccess') })
      onClose()
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.experimentForm.saveFailed') })
    }
  }

  const formatPointCount = (data: Record<string, unknown>): number => {
    const dataPoints = data?.data_points as unknown[] | undefined
    if (dataPoints) return dataPoints.length
    const xValues = data?.x_values
    if (Array.isArray(xValues)) return xValues.length
    return (data?.peak_count as number) ?? (data?.point_count as number) ?? 0
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-[var(--color-primary-text)]" />
            <h3 className="text-lg font-semibold">{t('pages.experimentDetail.parseFileTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]">
            <X size={18} className="text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-[var(--space-apple-md)]">
          <div className="flex gap-[var(--space-apple-sm)]">
            <label className="flex-1">
              <span className="text-sm font-medium mb-1 block">{t('pages.experimentDetail.selectFile')}</span>
              <input
                type="file"
                aria-label={t('pages.experimentDetail.selectFileAria')}
                accept=".csv,.txt,.dat,.dx,.jdx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[var(--text-primary)] file:mr-4 file:py-2 file:px-[var(--space-apple-md)] file:rounded-[var(--radius-Apple-sm)] file:border-0 file:text-xs file:font-medium file:bg-[var(--color-primary-container)] file:text-[var(--color-primary-text)] dark:file:bg-[var(--color-primary-container)]/40 dark:file:text-[var(--color-primary-text)] hover:file:bg-[var(--color-primary-container)] dark:hover:file:bg-[var(--color-primary-container)]/40"
              />
            </label>
            <label className="w-40">
              <span className="text-sm font-medium mb-1 block">{t('pages.experimentDetail.fileFormat')}</span>
              <select
                value={formatType}
                onChange={(e) => setFormatType(e.target.value as typeof formatType)}
                className="w-full px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm"
              >
                <option value="auto">{t('pages.experimentDetail.autoDetect')}</option>
                <option value="csv">CSV</option>
                <option value="animl">AnIML</option>
                <option value="jcamp">JCAMP</option>
              </select>
            </label>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm bg-[var(--bg-tertiary)]/50 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)]">
              <FileText size={14} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate text-[var(--text-primary)]">{file.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)]">
              <XCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-[var(--space-apple-sm)]">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)]">
                <CheckCircle size={14} className="shrink-0" />
                <span>{t('pages.experimentDetail.parseSuccessLabel')}</span>
              </div>
              {(() => {
                const fmt = result.format as string | undefined
                const pc = result.peak_count as number | undefined
                const pts = result.data_points as unknown[] | undefined
                const meta = result.metadata as Record<string, unknown> | undefined
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)] text-sm">
                    {fmt && <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2"><span className="text-[var(--text-muted)]">{t('pages.experimentDetail.formatLabel')}</span><span className="font-medium">{fmt}</span></div>}
                    {pts && <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2"><span className="text-[var(--text-muted)]">{t('pages.experimentDetail.parsedDataPointsLabel')}</span><span className="font-medium">{pts.length}</span></div>}
                    {pc !== undefined && <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2"><span className="text-[var(--text-muted)]">{t('pages.experimentDetail.peakCountLabel')}</span><span className="font-medium">{pc}</span></div>}
                    {meta && Object.entries(meta).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2"><span className="text-[var(--text-muted)]">{k}：</span><span className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span></div>
                    ))}
                  </div>
                )
              })()}
              <details className="text-xs text-[var(--text-muted)]">
                <summary className="cursor-pointer hover:text-[var(--text-primary)]">{t('pages.experimentDetail.viewFullJson')}</summary>
                <pre className="mt-2 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] overflow-auto max-h-48 text-xs">{JSON.stringify(result, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-[var(--space-apple-sm)] px-6 py-4 border-t border-[var(--border-color)]">
          <Button variant="outline" size="sm" onClick={onClose}>{t('pages.experimentDetail.close')}</Button>
          {result && (
            <Button size="sm" onClick={handleSaveResult}>
              <Save size={14} /> {t('pages.experimentDetail.saveAsData')}
            </Button>
          )}
          <Button size="sm" onClick={handleParse} disabled={parsing || !file}>
            {parsing ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-[var(--radius-pill)] mr-2" /> : <Upload size={14} />}
            {parsing ? t('pages.experimentDetail.parsing') : t('pages.experimentDetail.startParse')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ExperimentDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const experimentId = Number(id)
  const [showForm, setShowForm] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showParseModal, setShowParseModal] = useState(false)
  const [dataView, setDataView] = useState<'table' | 'chart'>('table')
  const [editingConclusions, setEditingConclusions] = useState(false)
  const [conclusionText, setConclusionText] = useState('')
  const [recommendText, setRecommendText] = useState('')

  const { data: experiment, isLoading } = useExperiment(experimentId)

  // ── 进度计算 ──
  const progress = useMemo(() => {
    if (!experiment) return 0
    if (experiment.status === 'completed') return 100
    if (experiment.status === 'cancelled') return 0
    if (experiment.status !== 'in_progress') return 0

    // 基于时间线的进度（安全解析，避免 Invalid Date 导致 NaN 进度）
    const now = new Date()
    const startDate = experiment.start_date ? new Date(experiment.start_date) : null
    const endDate = experiment.end_date ? new Date(experiment.end_date) : null
    const startDateValid = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null
    const endDateValid = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null

    if (!startDateValid || !endDateValid) return 50 // 无有效日期则给默认进度

    const totalMs = endDateValid.getTime() - startDateValid.getTime()
    if (totalMs <= 0) return 50
    const elapsedMs = now.getTime() - startDateValid.getTime()
    return Math.min(99, Math.max(5, Math.round((elapsedMs / totalMs) * 100)))
  }, [experiment])

  const { data: dataPoints = [] } = useQuery({
    queryKey: ['experiment-data', experimentId],
    queryFn: () => experimentApi.getData(experimentId),
    enabled: !!experimentId,
  })

  // ── 数据点统计 ──
  const dataStats = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return { total: 0, params: 0, numeric: 0 }
    const params = new Set(dataPoints.map((d) => d.parameter ?? d.measurementType))
    const numeric = dataPoints.filter((d) => d.value !== null && !isNaN(Number(d.value))).length
    return { total: dataPoints.length, params: params.size, numeric }
  }, [dataPoints])

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

  const startMut = useMutation({
    mutationFn: () => experimentApi.start(experimentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  const completeMut = useMutation({
    mutationFn: () => experimentApi.complete(experimentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiment', experimentId] }),
  })

  // ── 创建/获取分享链接 ──
  const shareMut = useMutation({
    mutationFn: () => experimentApi.createShare(experimentId),
    onSuccess: (res) => {
      const url = `${window.location.origin}${res.url}`
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
      }
      window.open(res.url, '_blank', 'noopener')
      qc.invalidateQueries({ queryKey: ['experiment', experimentId] })
    },
  })

  const handleShare = () => {
    if (experiment?.share_code) {
      // 已有分享码，直接打开
      window.open(`/experiments/share/${experiment.share_code}`, '_blank', 'noopener')
    } else {
      shareMut.mutate()
    }
  }

  // ── 回写配方 ──
  const writebackMut = useMutation({
    mutationFn: (payload: { safety_score?: number; synergy_score?: number }) =>
      experimentApi.writeback(experimentId, payload),
    onSuccess: (res) => {
      alert(`配方 ${res.code} 已回写：${res.updated_fields.join(', ') || '无更新字段'}`)
      qc.invalidateQueries({ queryKey: ['experiment', experimentId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '回写失败'
      alert(`回写失败：${msg}`)
    },
  })

  const handleWriteback = () => {
    const safetyScore = prompt('安全性评分（0-100，留空跳过）:')
    if (safetyScore === null) return
    const synergyScore = prompt('协同效应评分（0-100，留空跳过）:')
    if (synergyScore === null) return
    writebackMut.mutate({
      safety_score: safetyScore ? Number(safetyScore) : undefined,
      synergy_score: synergyScore ? Number(synergyScore) : undefined,
    })
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

  // ── 实验报告导出 ──
  const handleExportReport = () => {
    if (!experiment) return
    const rows = dataPoints.map((d) => [
      d.parameter,
      String(d.value ?? ''),
      d.unit ?? '',
      d.notes ?? '',
      formatDataTime(d, 'yyyy-MM-dd HH:mm'),
    ])
    const csv = [
      ['参数', '数值', '单位', '备注', '记录时间'],
      ...rows,
    ].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${experiment.code || '实验'}_数据报告_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-[var(--space-apple-md)]">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-[1600px] mx-auto text-center py-20">
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentDetail.notExist')}</p>
        <Link to="/experiments" className="text-[var(--color-primary-text)] text-sm mt-2 inline-block">{t('pages.experimentDetail.backToList')}</Link>
      </div>
    )
  }

  const isEditable = experiment.status === 'planned' || experiment.status === 'in_progress'

  return (
    <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 space-y-6">
      {/* 头部导航 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => navigate('/experiments')}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          {t('pages.experimentDetail.backToList')}
        </button>
        <div className="flex items-center gap-2">
          {experiment.status === 'planned' && (
            <Button
              size="sm"
              onClick={() => startMut.mutate()}
              loading={startMut.isPending}
              icon={<Play size={14} />}
            >
              {t('pages.experimentDetail.startExperiment')}
            </Button>
          )}
          {experiment.status === 'in_progress' && (
            <Button
              size="sm"
              onClick={() => completeMut.mutate()}
              loading={completeMut.isPending}
              icon={<CheckCircle size={14} />}
            >
              {t('pages.experimentDetail.completeExperiment')}
            </Button>
          )}
          {isEditable && (
            <Link to={`/experiments/${experiment.id}/edit`}>
              <Button variant="secondary" size="sm" icon={<Edit3 size={14} />}>
                {t('pages.experimentDetail.edit')}
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={handleShare}>
            {t('pages.experimentDetail.share')}
          </Button>
          <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setShowParseModal(true)}>
            {t('pages.experimentDetail.parseFile')}
          </Button>
          {experiment.status === 'completed' && experiment.formula_id && (
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleWriteback}>
              {t('pages.experimentDetail.writeBackFormula')}
            </Button>
          )}
        </div>
      </div>

      {/* 基本信息卡片 */}
      <Card>
        <CardContent>
          <div className="flex items-start justify-between mb-[var(--space-apple-md)]">
            <div>
              <div className="flex items-center gap-[var(--space-apple-sm)] mb-1">
                <h1 className="h1 text-[var(--text-primary)]">{experiment.title}</h1>
                <StatusBadge status={experiment.status} />
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {experiment.code} · {t('pages.experimentDetail.createdOn', { date: formatExpDate(experiment.created_at ?? experiment.createdAt, 'yyyy-MM-dd') })}
              </p>
            </div>
            {experiment.formula_id && (
              <Link
                to={`/formulas/${experiment.formula_id}`}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] text-[var(--color-primary-text)] text-xs font-medium hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/30 transition-colors"
              >
                <FlaskConical size={12} />
                {t('pages.experimentDetail.linkedFormula')}
              </Link>
            )}
          </div>

          {experiment.description && (
            <p className="text-[var(--text-secondary)] leading-relaxed mb-[var(--space-apple-md)] text-sm">{experiment.description}</p>
          )}

          {/* 进度时间线 */}
          <div className="py-[var(--space-apple-md)] border-t border-[var(--border-color)]">
            <ExperimentTimeline experiment={experiment} progress={progress} />
          </div>

          {/* 进度条 */}
          <div className="py-[var(--space-apple-md)] border-t border-[var(--border-color)]">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--text-muted)]">{t('pages.experimentDetail.experimentProgress')}</span>
                  <span className="text-xs font-bold text-[var(--color-primary-text)]">{progress}%</span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-[var(--radius-pill)] transition-all duration-700',
                      progress >= 100 ? 'bg-[var(--color-success-container)]0' : progress >= 50 ? 'bg-[var(--color-primary-container)]0' : 'bg-[var(--color-warning-container)]0',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 数据统计 */}
          <div className="py-[var(--space-apple-md)] border-t border-[var(--border-color)]">
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Table size={12} />
                {t('pages.experimentDetail.dataCount', { count: dataStats.total })}
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 size={12} />
                {t('pages.experimentDetail.paramsCount', { count: dataStats.params })}
              </span>
              <span className="flex items-center gap-1">
                <Chart3 size={12} />
                {t('pages.experimentDetail.numericCount', { count: dataStats.numeric })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4 pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
            {[
              { icon: Calendar, label: t('pages.experimentDetail.planStart'), value: experiment.start_date ? formatExpDate(experiment.start_date, 'MM-dd') : '-' },
              { icon: Calendar, label: t('pages.experimentDetail.planEnd'), value: experiment.end_date ? formatExpDate(experiment.end_date, 'MM-dd') : '-' },
              { icon: Play, label: t('pages.experimentDetail.actualStart'), value: experiment.actual_start ? formatExpDate(experiment.actual_start, 'MM-dd HH:mm') : '-' },
              { icon: CheckCircle, label: t('pages.experimentDetail.actualEnd'), value: experiment.actual_end ? formatExpDate(experiment.actual_end, 'MM-dd HH:mm') : '-' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
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
                  <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                    <Target size={16} className="text-[var(--color-primary-text)]0" />
                  </div>
                  <CardTitle as="h2">{t('pages.experimentDetail.objectives')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {experiment.objectives.map((obj: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)]0 shrink-0" />
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
                  <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                    <FileText size={16} className="text-[var(--color-primary-text)]0" />
                  </div>
                  <CardTitle as="h2">{t('pages.experimentDetail.methodology')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{experiment.methodology}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 实验数据 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                <BarChart3 size={16} className="text-[var(--color-primary-text)]0" />
              </div>
              <div>
                <CardTitle as="h2">{t('pages.experimentDetail.experimentData')}</CardTitle>
                <CardDescription>{t('pages.experimentDetail.dataCount', { count: dataPoints.length })}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 视图切换 */}
              <div className="flex bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-0.5">
                <button
                  onClick={() => setDataView('table')}
                  className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                    dataView === 'table' ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]',
                  )}
                >
                  {t('pages.experimentDetail.dataTable')}
                </button>
                <button
                  onClick={() => setDataView('chart')}
                  className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center',
                    dataView === 'chart' ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]',
                  )}
                >
                  {t('pages.experimentDetail.chart')}
                </button>
              </div>
              {isEditable && (
                <Button
                  size="sm"
                  onClick={() => setShowForm(true)}
                  icon={<Plus size={12} />}
                >
                  {t('pages.experimentDetail.recordData')}
                </Button>
              )}
              {isEditable && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowBatchImport(true)}
                  icon={<ClipboardPaste size={12} />}
                >
                  {t('pages.experimentDetail.batchImport')}
                </Button>
              )}
              {dataPoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download size={12} />}
                  onClick={handleExportReport}
                >
                  {t('pages.experimentDetail.exportData')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {showForm && (
            <div className="mb-[var(--space-apple-md)]">
              <DataEntryForm experimentId={experimentId} onClose={() => setShowForm(false)} />
            </div>
          )}

          {showBatchImport && (
            <div className="mb-[var(--space-apple-md)]">
              <BatchImportForm experimentId={experimentId} onClose={() => setShowBatchImport(false)} />
            </div>
          )}

          {dataView === 'table' ? (
            <DataTable data={dataPoints} experimentId={experimentId} colors={COLORS} />
          ) : (
            <DataView data={dataPoints} />
          )}
        </CardContent>
      </Card>

      {/* 结论和建议 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle as="h2">{t('pages.experimentDetail.conclusions')}</CardTitle>
            {isEditable && !editingConclusions && (
              <Button variant="ghost" size="sm" icon={<Edit3 size={12} />} onClick={() => {
                setConclusionText(experiment?.conclusions ?? '')
                setRecommendText(experiment?.recommendations ?? '')
                setEditingConclusions(true)
              }}>
                {t('pages.experimentDetail.edit')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingConclusions ? (
            <div className="space-y-[var(--space-apple-md)]">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.conclusionLabel')}</label>
                <Textarea
                  value={conclusionText}
                  onChange={(e) => setConclusionText(e.target.value)}
                  placeholder={t('pages.experimentDetail.conclusionPlaceholder')}
                  rows={4}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.experimentDetail.improvement')}</label>
                <Textarea
                  value={recommendText}
                  onChange={(e) => setRecommendText(e.target.value)}
                  placeholder={t('pages.experimentDetail.improvementPlaceholder')}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingConclusions(false)}>{t('pages.experimentDetail.cancel')}</Button>
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
                  <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('pages.experimentDetail.conclusionLabel')}</h2>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{experiment.conclusions}</p>
                </div>
              )}
              {experiment.recommendations && (
                <div>
                  <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('pages.experimentDetail.improvement')}</h2>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{experiment.recommendations}</p>
                </div>
              )}
              {!experiment.conclusions && !experiment.recommendations && (
                <div className="col-span-2 py-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentDetail.noConclusions')}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 附件管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] flex items-center justify-center">
                <Paperclip size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </div>
              <CardTitle as="h2">{t('pages.experimentDetail.attachments')}</CardTitle>
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
                  }} aria-hidden="true" tabIndex={-1} />
                <Button variant="ghost" size="sm" icon={<Upload size={12} />}>
                  {t('pages.experimentDetail.upload')}
                </Button>
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att: Attachment) => (
                <div key={att.id} className="flex items-center justify-between px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
                    <span className="text-sm text-[var(--text-primary)] truncate">{att.file_name}</span>
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">
                      {(att.file_size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={() => deleteAttachMut.mutate(att.id)}
                    className="p-1 rounded text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-[var(--space-apple-lg)] text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentDetail.noAttachments')}</div>
          )}
        </CardContent>
      </Card>

      {/* ── 配方在线验证面板 ── */}
      {experiment?.formula_id && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <CardTitle as="h2">{t('pages.experimentDetail.onlineValidation')}</CardTitle>
                <CardDescription>
                  {t('pages.experimentDetail.validationDesc')}
                </CardDescription>
              </div>
              <Link
                to={`/formulas/${experiment.formula_id}`}
                className="ml-auto text-xs text-[var(--color-primary-text)] hover:underline flex items-center gap-1"
              >
                {t('pages.experimentDetail.viewFormula')} <ChevronRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <FormulaValidationPanel
              formulaId={experiment.formula_id}
              formulaName={`配方 #${experiment.formula_id}`}
              experimentId={experiment.id}
            />
          </CardContent>
        </Card>
      )}

      {/* ── 文件解析弹窗 ── */}
      {showParseModal && <DataParseModal experimentId={experimentId} onClose={() => setShowParseModal(false)} />}
    </div>
  )
}
