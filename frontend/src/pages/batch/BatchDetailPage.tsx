/**
 * 批记录详情页
 * Phase 2: 健壮错误处理 + 状态机式操作 + 空态引导
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Eye, ArrowRight, Printer, Download,
  ChevronRight, TestTube, Package, Tag, AlertCircle, CheckCircle2,
  Play, CheckCircle, Lock,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { batchApi, sampleApi } from '@/api/batch'
import { StatusBadge, EmptyState, Skeleton } from '@/components/ui/Common'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

type Batch = ReturnType<typeof batchApi.get> extends Promise<infer T> ? T : never

export default function BatchDetailPage() {
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
      addToast({ type: 'success', message: '状态已更新' })
      setShowStatusAction(false)
    },
    onError: (e: any) => {
      addToast({ type: 'error', message: `状态更新失败：${e?.response?.data?.detail ?? e?.message}` })
    },
  })

  // ── 加载中 ──
  if (batchLoading || samplesLoading || traceLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      : '批记录不存在或数据服务不可用'
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/batches')}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> 返回列表
        </button>
        <EmptyState
          icon={<AlertCircle size={48} className="text-warning-500" strokeWidth={1.5} />}
          title="批记录暂不可用"
          description={errorMsg}
          action={
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => navigate('/batches')}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
              >
                返回批记录列表
              </button>
              <button
                onClick={() => navigate('/batches/new')}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                新建批记录
              </button>
            </div>
          }
        />
      </div>
    )
  }

  // ── 正常渲染 ──
  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/batches')}
            className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors mt-1"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold leading-snug tracking-tight">
                {batch.batch_code}
              </h2>
              <StatusBadge status={batch.status} />
            </div>
            <p className="text-white/80 text-sm mt-1">
              配方:{' '}
              <Link to={`/formulas/${batch.formula_id}`} className="text-white underline font-medium">
                {batch.formula_name || batch.formula_code}
              </Link>
              {batch.preparation_date && (
                <span className="ml-4">创建: {new Date(batch.created_at).toLocaleString('zh-CN')}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm text-white transition-colors flex items-center gap-1">
              <Printer size={14} /> 打印
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm text-white transition-colors flex items-center gap-1">
              <Download size={14} /> 导出
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="目标产量" value={`${batch.target_weight_kg?.toFixed(3)} kg`} />
        <StatCard
          label="实际产量"
          value={batch.actual_weight_kg ? `${batch.actual_weight_kg.toFixed(3)} kg` : '—'}
          sub={batch.actual_weight_kg ? `${((batch.actual_weight_kg / batch.target_weight_kg) * 100).toFixed(1)}% 达成率` : undefined}
        />
        <StatCard label="产率" value={batch.yield_rate ? `${batch.yield_rate.toFixed(1)}%` : '—'} />
        <StatCard label="样品数" value={String(batch.sample_count ?? 0)} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {batch.status === 'planned' && (
          <Button
            size="sm"
            onClick={() => { setShowStatusAction(true); updateStatus.mutate({ batchId, status: 'in_progress' }) }}
          >
            <Play size={14} /> 开始生产
          </Button>
        )}
        {batch.status === 'in_progress' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus.mutate({ batchId, status: 'completed' })}
          >
            <CheckCircle size={14} /> 完成
          </Button>
        )}
        {batch.status === 'completed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (confirm('确认关闭此批记录？关闭后不可恢复。')) {
                updateStatus.mutate({ batchId, status: 'closed' })
              }
            }}
          >
            <Lock size={14} /> 关闭
          </Button>
        )}
        <Link to="/batches/new">
          <Button size="sm" variant="outline">
            <Plus size={14} /> 新建批次
          </Button>
        </Link>
        <Link to={`/trace/backward?batch=${batchId}`}>
          <Button size="sm" variant="outline">
            <ArrowRight size={14} /> 反向追溯
          </Button>
        </Link>
      </div>

      {/* Samples Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube size={16} className="text-primary" />
            样品列表 ({samples?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {samples?.items && samples.items.length > 0 ? (
            <div className="space-y-2">
              {samples.items.map(sample => (
                <div
                  key={sample.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-primary">{sample.sample_code}</span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">{sample.sample_type}</span>
                    {sample.storage_condition && (
                      <span className="text-xs text-neutral-400">{sample.storage_condition}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-500">
                    <span>{sample.test_count ?? 0} 项测试</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TestTube size={40} strokeWidth={1.5} />}
              title="暂无样品"
              description="创建批记录后，可为该批次取样进行质量检测"
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
              原料追溯 ({backwardTrace.ingredient_lots.length} 个批号)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backwardTrace.ingredient_lots.map((lot: any) => (
                <div
                  key={lot.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-900/20 flex items-center justify-center">
                      <Tag size={14} className="text-success-500 dark:text-success-400" />
                    </div>
                    <div>
                      <div className="font-mono text-xs text-primary">{lot.internal_lot_code}</div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">{lot.ingredient_name}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    <div>供应商: {lot.supplier_lot_number || '—'}</div>
                    <div className="font-mono text-neutral-700 dark:text-neutral-300">
                      用量 {lot.used_qty_kg?.toFixed(3)} kg
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
      <CardContent className="pt-4">
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}
