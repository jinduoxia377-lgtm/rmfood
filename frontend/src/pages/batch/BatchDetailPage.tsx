/**
 * 批记录详情页
 * Phase 2: 健壮错误处理 + 状态机式操作 + 空态引导
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, ArrowRight, Printer, Download,
  ChevronRight, TestTube, Tag, AlertCircle,
  Play, CheckCircle, Lock,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { batchApi, sampleApi } from '@/api/batch'
import { StatusBadge, EmptyState, Skeleton } from '@/components/ui/Common'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

export default function BatchDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const batchId = Number(id)
  const [showStatusAction, setShowStatusAction] = useState(false)

  // 使用 null 安全获取；503/404 → null
  const { data: batch, isLoading: batchLoading, error: batchError } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => batchApi.get(batchId),
    enabled: !!batchId,
    retry: false,
  })

  const { data: samples, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', { batch_id: batchId }],
    queryFn: () => sampleApi.list({ batch_id: batchId }),
    enabled: !!batchId && !!batch,
  })

  const { data: backwardTrace, isLoading: traceLoading } = useQuery({
    queryKey: ['batch-trace-backward', batchId],
    queryFn: () => batchApi.backwardTrace(batchId),
    enabled: !!batchId && !!batch,
  })

  const updateStatus = useMutation({
    mutationFn: ({ batchId, status, actualWeight }: { batchId: number; status: string; actualWeight?: number }) =>
      batchApi.updateStatus(batchId, status, actualWeight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['samples', { batch_id: batchId }] })
      queryClient.invalidateQueries({ queryKey: ['batch-trace-backward', batchId] })
      addToast({ type: 'success', message: t('pages.batch.statusUpdated') })
      setShowStatusAction(false)
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: t('pages.batch.statusUpdateFailed', { message: e?.response?.data?.detail ?? e?.message }) })
    },
  })

  // ── 加载中 ──
  if (batchLoading || samplesLoading || traceLoading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)] px-4 sm:px-5 lg:px-[var(--space-apple-lg)]">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  // ── 错误 / 不存在 ──
  if (!batch) {
    const errorMsg = batchError instanceof Error
      ? batchError.message
      : t('pages.batch.notAvailable')
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-[var(--space-apple-lg)]">
        <button
          onClick={() => navigate('/batches')}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-[var(--space-apple-md)]"
        >
          <ArrowLeft size={16} /> {t('pages.batch.backToList')}
        </button>
        <EmptyState
          icon={<AlertCircle size={48} className="text-[var(--color-warning-text)]0" strokeWidth={1.5} />}
          title={t('pages.batch.notAvailable')}
          description={errorMsg}
          action={
            <div className="flex gap-2 mt-[var(--space-apple-md)]">
              <button
                onClick={() => navigate('/batches')}
                className="px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] bg-primary-surface text-white text-sm hover:bg-primary-surface-hover transition-colors"
              >
                {t('pages.batch.backToBatches')}
              </button>
              <button
                onClick={() => navigate('/batches/new')}
                className="px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] text-sm hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {t('pages.batch.newBatch')}
              </button>
            </div>
          }
        />
      </div>
    )
  }

  // ── 正常渲染 ──
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)] px-4 sm:px-5 lg:px-[var(--space-apple-lg)]">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/batches')}
            className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors mt-1"
          >
            <ArrowLeft size={16} /> {t('pages.batch.back')}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-[var(--space-apple-sm)] flex-wrap">
              <h1 className="text-xl font-semibold leading-snug tracking-tight">
                {batch.batch_code}
              </h1>
              <StatusBadge status={batch.status} />
            </div>
            <p className="text-white/80 text-sm mt-1">
              {t('pages.batch.formulaLabel')}{' '}
              <Link to={`/formulas/${batch.formula_id}`} className="text-white underline font-medium">
                {batch.formula_name || batch.formula_code}
              </Link>
              {batch.preparation_date && (
                <span className="ml-4">{t('pages.batch.created', { date: new Date(batch.created_at).toLocaleString(i18n.language) })}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 text-sm text-[var(--color-primary-text)] dark:text-white transition-colors flex items-center gap-1">
              <Printer size={14} /> {t('pages.batch.print')}
            </button>
            <button className="px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 text-sm text-[var(--color-primary-text)] dark:text-white transition-colors flex items-center gap-1">
              <Download size={14} /> {t('pages.batch.export')}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('pages.batch.targetYield')} value={`${batch.target_weight_kg?.toFixed(3)} kg`} />
        <StatCard
          label={t('pages.batch.actualYield')}
          value={batch.actual_weight_kg ? `${batch.actual_weight_kg.toFixed(3)} kg` : '—'}
          sub={batch.actual_weight_kg ? t('pages.batch.achievementRate', { rate: ((batch.actual_weight_kg / batch.target_weight_kg) * 100).toFixed(1) }) : undefined}
        />
        <StatCard label={t('pages.batch.yieldRate')} value={batch.yield_rate ? `${batch.yield_rate.toFixed(1)}%` : '—'} />
        <StatCard label={t('pages.batch.sampleCount')} value={String(batch.sample_count ?? 0)} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {batch.status === 'planned' && (
          <Button
            size="sm"
            onClick={() => { setShowStatusAction(true); updateStatus.mutate({ batchId, status: 'in_progress' }) }}
          >
            <Play size={14} /> {t('pages.batch.startProduction')}
          </Button>
        )}
        {batch.status === 'in_progress' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus.mutate({ batchId, status: 'completed' })}
          >
            <CheckCircle size={14} /> {t('pages.batch.complete')}
          </Button>
        )}
        {batch.status === 'completed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm(t('pages.batch.confirmClose'))) {
                updateStatus.mutate({ batchId, status: 'closed' })
              }
            }}
          >
            <Lock size={14} /> {t('pages.batch.close')}
          </Button>
        )}
        <Link to="/batches/new">
          <Button size="sm" variant="outline">
            <Plus size={14} /> {t('pages.batch.newBatchShort')}
          </Button>
        </Link>
        <Link to={`/trace/backward?batch=${batchId}`}>
          <Button size="sm" variant="outline">
            <ArrowRight size={14} /> {t('pages.batch.backwardTrace')}
          </Button>
        </Link>
      </div>

      {/* Samples Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube size={16} className="text-primary" />
            {t('pages.batch.sampleList', { count: samples?.total ?? 0 })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {samples?.items && samples.items.length > 0 ? (
            <div className="space-y-2">
              {samples.items.map(sample => (
                <div
                  key={sample.id}
                  className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <span className="font-mono text-xs text-primary">{sample.sample_code}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{sample.sample_type}</span>
                    {sample.storage_condition && (
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{sample.storage_condition}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-[var(--space-apple-sm)] text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <span>{t('pages.batch.testCount', { count: sample.test_count ?? 0 })}</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TestTube size={40} strokeWidth={1.5} />}
              title={t('pages.batch.noSamples')}
              description={t('pages.batch.noSamplesDesc')}
            />
          )}
        </CardContent>
      </Card>

      {/* Traceability Preview */}
      {backwardTrace && backwardTrace.ingredient_lots && backwardTrace.ingredient_lots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag size={16} className="text-primary" />
              {t('pages.batch.ingredientTrace', { count: backwardTrace.ingredient_lots.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backwardTrace.ingredient_lots.map((lot: any) => (
                <div
                  key={lot.id}
                  className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)]/50"
                >
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-success-container)] flex items-center justify-center">
                      <Tag size={14} className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]" />
                    </div>
                    <div>
                      <div className="font-mono text-xs text-primary">{lot.internal_lot_code}</div>
                      <div className="text-sm text-[var(--text-secondary)]">{lot.ingredient_name}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <div>{t('pages.batch.supplier', { name: lot.supplier_lot_number || '—' })}</div>
                    <div className="font-mono text-[var(--text-primary)]">
                      {t('pages.batch.usageQty', { weight: lot.used_qty_kg?.toFixed(3) })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}

/* ── 辅助组件 ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-[var(--space-apple-md)]">
        <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}
