/**
 * 追溯查询页面
 * Phase 2: 双向追溯 + 真实批次数据选择 + 完整错误处理
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Search, Package, TestTube, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { batchApi } from '@/api/batch'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

type TraceMode = 'forward' | 'backward'

export default function TracePage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { mode } = useParams<{ mode: string }>()
  const [lotCode, setLotCode] = useState('')
  const [batchId, setBatchId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [traceMode, setTraceMode] = useState<TraceMode>(mode === 'forward' ? 'forward' : 'backward')
  const [traceError, setTraceError] = useState<string | null>(null)

  // 加载可用批次列表（反向追溯时下拉选择）
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches', { page: 1, page_size: 50 }],
    queryFn: () => batchApi.list({ page: 1, page_size: 50 }),
    enabled: traceMode === 'backward',
  })

  // 加载原料批号列表（正向追溯时使用，从 ingredient_lots 提取）
  useQuery({
    queryKey: ['ingredients', 'lots'],
    queryFn: async () => {
      const res = await fetch('/api/v1/ingredients')
      if (!res.ok) return []
      const d = await res.json()
      return (d?.data?.items ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        lot_code: item.lot_code || item.internal_lot_code || `LOT-${item.id}`,
      }))
    },
    enabled: traceMode === 'forward',
    staleTime: 60_000,
  })

  // 当 URL 参数提供了 batchId 时自动填充
  useEffect(() => {
    if (mode === 'backward' && (batchesData?.items ?? []).length > 0) {
      // 从 URL 读取?batch=X 参数
      const params = new URLSearchParams(window.location.search)
      const urlBatch = params.get('batch')
      if (urlBatch && !batchId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBatchId(urlBatch)
      }
    }
  }, [mode, batchesData, batchId])

  const handleForwardTrace = async () => {
    if (!lotCode.trim()) {
      addToast({ type: 'warning', message: '请输入原料批号 ID' })
      return
    }
    setLoading(true)
    setTraceError(null)
    setResult(null)
    try {
      const lotId = parseInt(lotCode)
      if (isNaN(lotId)) throw new Error('请输入有效的数字批号')
      const data = await batchApi.forwardTrace(lotId)
      setResult(data)
      addToast({ type: 'success', message: `正向追溯完成：找到 ${data?.batch_count ?? 0} 个关联批次` })
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? '追溯请求失败'
      setTraceError(msg)
      setResult({ error: msg })
      addToast({ type: 'error', message: `正向追溯失败：${msg}` })
    } finally {
      setLoading(false)
    }
  }

  const handleBackwardTrace = async () => {
    if (!batchId.trim()) {
      addToast({ type: 'warning', message: '请选择或输入批次 ID' })
      return
    }
    setLoading(true)
    setTraceError(null)
    setResult(null)
    try {
      const id = parseInt(batchId)
      if (isNaN(id)) throw new Error('请输入有效的批次 ID')
      const data = await batchApi.backwardTrace(id)
      setResult(data)
      addToast({ type: 'success', message: `反向追溯完成：找到 ${data?.ingredient_lot_count ?? 0} 个原料批号` })
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? '追溯请求失败'
      setTraceError(msg)
      setResult({ error: msg })
      addToast({ type: 'error', message: `反向追溯失败：${msg}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)] px-4 sm:px-5 lg:px-[var(--space-apple-lg)]">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
          <Search size={20} className="text-white/80 shrink-0" />
          双向追溯
        </h1>
        <p className="mt-1 text-white/80 text-sm">追踪原料批号与成品批次之间的完整链路</p>
      </div>

      {/* 模式切换标签 */}
      <div className="flex gap-2 p-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-md)] w-fit">
        <button
          onClick={() => { setTraceMode('backward'); setResult(null); setTraceError(null) }}
          className={cn(
            'px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all',
            traceMode === 'backward'
              ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-primary shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          )}
        >
          <span className="flex items-center gap-2">
            <Package size={14} />
            反向追溯（批次→原料）
          </span>
        </button>
        <button
          onClick={() => { setTraceMode('forward'); setResult(null); setTraceError(null) }}
          className={cn(
            'px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all',
            traceMode === 'forward'
              ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-primary shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          )}
        >
          <span className="flex items-center gap-2">
            <TestTube size={14} />
            正向追溯（原料→批次）
          </span>
        </button>
      </div>

      {/* 反向追溯：批次选择 */}
      {traceMode === 'backward' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package size={16} className="text-primary" /> 反向追溯 — 选择批次
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-apple-md)]">
            {batchesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : batchesData?.items?.length === 0 ? (
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center py-4">
                当前无批记录，请先{' '}
                <Link to="/batches/new" className="text-primary hover:underline font-medium">创建批记录</Link>
              </div>
            ) : (
              <>
                <select
                  value={batchId}
                  onChange={e => setBatchId(e.target.value)}
                  className="w-full h-10 px-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-transparent text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">— 选择批次 —</option>
                  {batchesData?.items?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} · {b.formula_name || b.formula_code} · {b.status}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <span>共 {batchesData?.total ?? 0} 条批记录</span>
                  <Link to="/batches" className="text-primary hover:underline">查看全部</Link>
                </div>
                <Button onClick={handleBackwardTrace} disabled={loading || !batchId} className="w-full sm:w-auto">
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-[var(--radius-pill)] animate-spin" />查询中...</span>
                  ) : (
                    <><Search size={14} /> 开始追溯</>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 正向追溯：批号输入 */}
      {traceMode === 'forward' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TestTube size={16} className="text-primary" /> 正向追溯 — 输入原料批号
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-[var(--space-apple-md)]">
            <div className="flex gap-[var(--space-apple-sm)]">
              <Input
                placeholder="输入原料批号 ID..."
                value={lotCode}
                onChange={e => setLotCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForwardTrace()}
                className="flex-1 max-w-xs"
              />
              <Button onClick={handleForwardTrace} disabled={loading || !lotCode.trim()}>
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-[var(--radius-pill)] animate-spin" />查询中...</span>
                ) : (
                  <><Search size={14} /> 追溯</>
                )}
              </Button>
            </div>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">输入原料入库批号，查找所有使用该批号的成品批次</p>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {traceError && (
        <Card className="border-danger-200 dark:border-danger-900/50">
          <CardContent className="pt-[var(--space-apple-md)] flex items-start gap-[var(--space-apple-sm)] text-danger-600 dark:text-danger-600">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">追溯失败</div>
              <div className="text-xs mt-1 opacity-80">{traceError}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 追溯结果 */}
      {result && !result.error && (
        <div className="space-y-[var(--space-apple-md)]">
          {traceMode === 'backward' ? (
            <ResultCard result={result} type="backward" onGoToBatch={(id: number) => navigate(`/batches/${id}`)} />
          ) : (
            <ResultCard result={result} type="forward" />
          )}
        </div>
      )}
      </div>
    </div>
  )
}

/* ── 结果卡片 ─────────────────────────────────────────────────── */

function ResultCard({
  result,
  type,
  onGoToBatch,
}: {
  result: any
  type: 'forward' | 'backward'
  onGoToBatch?: (id: number) => void
}) {
  if (type === 'backward') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 size={16} className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]" />
            反向追溯结果
            {result.batch_code && (
              <span className="font-mono text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-normal ml-auto">
                {result.batch_code}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-md)]">
          {/* 批次摘要 */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-sm)]">
            <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">配方</div>
              <div className="text-sm font-medium truncate" title={result.formula_name || result.formula_code}>
                {result.formula_name || result.formula_code || '—'}
              </div>
            </div>
            <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">目标产量</div>
              <div className="text-sm font-medium">
                {result.target_weight_kg?.toFixed(3)} kg
              </div>
            </div>
            <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">原料批号数</div>
              <div className="text-sm font-medium">{result.ingredient_lot_count ?? 0}</div>
            </div>
            <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">样品数</div>
              <div className="text-sm font-medium">{result.samples?.length ?? 0}</div>
            </div>
          </div>

          {/* 原料批号列表 */}
          {result.ingredient_lots?.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                使用的原料批号 ({result.ingredient_lots.length})
              </h2>
              <div className="space-y-2">
                {result.ingredient_lots.map((lot: any) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)]/50"
                  >
                    <div className="flex items-center gap-[var(--space-apple-sm)]">
                      <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-primary/10 flex items-center justify-center">
                        <Package size={14} className="text-primary" />
                      </div>
                      <div>
                        <div className="font-mono text-xs text-[var(--text-primary)]">{lot.internal_lot_code}</div>
                        <div className="text-sm text-[var(--text-secondary)]">{lot.ingredient_name}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <div>供应商: {lot.supplier_lot_number || '—'}</div>
                      <div className="font-mono">用量: {lot.used_qty_kg?.toFixed(3)} kg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center py-4">暂无原料批号记录</div>
          )}

          {/* 样品列表 */}
          {result.samples?.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <TestTube size={14} /> 关联样品 ({result.samples.length})
              </h2>
              <div className="space-y-2">
                {result.samples.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)]/50"
                  >
                    <div className="flex items-center gap-[var(--space-apple-sm)]">
                      <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-accent-container)] flex items-center justify-center">
                        <TestTube size={14} className="text-[var(--color-accent-text)]0" />
                      </div>
                      <div>
                        <div className="font-mono text-xs text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{s.sample_code}</div>
                        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{s.sample_type}</div>
                      </div>
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">测试项: {s.test_count ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // 正向追溯
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 size={16} className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]" />
          正向追溯结果
          {result.ingredient_name && (
            <span className="font-mono text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-normal ml-auto">
              {result.ingredient_name} · Lot #{result.ingredient_lot_id ?? result.ingredient_lot_code ?? '—'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-[var(--space-apple-md)]">
        {/* 原料摘要 */}
        {(result.ingredient_name || result.received_qty_kg) && (
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-sm)]">
            {result.ingredient_name && (
              <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">原料</div>
                <div className="text-sm font-medium">{result.ingredient_name}</div>
              </div>
            )}
            {result.received_qty_kg != null && (
              <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">入库量</div>
                <div className="text-sm font-medium">{result.received_qty_kg.toFixed(3)} kg</div>
              </div>
            )}
            {result.remaining_qty_kg != null && (
              <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">剩余量</div>
                <div className="text-sm font-medium">{result.remaining_qty_kg.toFixed(3)} kg</div>
              </div>
            )}
            <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">使用批次</div>
              <div className="text-sm font-medium">{result.batch_count ?? 0}</div>
            </div>
          </div>
        )}

        {/* 关联批次 */}
        {result.batches?.length > 0 ? (
          <div>
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-2">
              使用的批次 ({result.batches.length})
            </h2>
            <div className="space-y-2">
              {result.batches.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)]/50"
                >
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)] flex items-center justify-center">
                      <Package size={14} className="text-[var(--color-warning-text)]0" />
                    </div>
                    <div>
                      <div className="font-mono text-xs text-[var(--text-primary)]">{b.batch_code}</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {b.formula_name || b.formula_code}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <StatusBadge status={b.status} />
                    {onGoToBatch && (
                      <button
                        onClick={() => onGoToBatch(b.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        查看详情
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center py-4">未找到关联批次</div>
        )}

        {/* 关联样品统计 */}
        {result.samples?.length > 0 && (
          <div className="pt-2 border-t border-[var(--border-color)]">
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              共关联 <span className="font-medium text-[var(--text-primary)]">{result.samples.length}</span> 个样品
              {(() => {
                const flat = (result.samples as unknown as unknown[][]).flat()
                return flat?.length ? `，${flat.length} 条测试记录` : ''
              })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
