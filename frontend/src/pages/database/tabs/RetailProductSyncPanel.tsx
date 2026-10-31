/**
 * OpenFoodFacts 数据同步状态面板
 *
 * 挂载时调用 getOpenFoodFactsSyncStats() 与 getOpenFoodFactsReport()：
 * - 总产品数 / 含嵌入数 / 平均数据质量 / 品牌数 / 分类数 / 最近同步时间
 * - 数据质量分布（high/medium/low）
 * - Top 分类（report.categories）
 *
 * 提供「手动触发同步」按钮（POST /databases/openfoodfacts/sync，需管理员/配方师权限）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  StatCard,
  Progress,
  Skeleton,
} from '@/components/ui'
import {
  Database,
  HardDrive,
  Gauge,
  Layers,
  Tags,
  RefreshCw,
  Clock,
  CalendarClock,
  BarChart3,
  ListTree,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import {
  getOpenFoodFactsSyncStats,
  getOpenFoodFactsReport,
} from '../../../api/searchNew'
import { databaseApi } from '@/api/database'
import { cn } from '@/lib/utils'
import { logger } from '@/utils/safeLogger'

export interface RetailProductSyncPanelProps {
  className?: string
}

/** 同步状态接口（对应后端 SyncStatusResponse） */
interface OffSyncStats {
  total_products: number
  with_embedding: number
  avg_quality: number
  unique_brands: number
  kb_categories: number
  last_sync: { date: string | null; status: string } | null
}

/** 导入报告接口（对应后端 ImportReportResponse） */
interface OffReport {
  overall: Record<string, unknown>
  categories: { category: string; count: number }[]
  quality_distribution: { high: number; medium: number; low: number }
}

/** 同步状态 → 状态标签键 + Badge variant */
function getSyncStatusBadgeKey(status?: string | null): { labelKey: string; variant: 'success' | 'info' | 'destructive' | 'default' } {
  switch ((status ?? '').toLowerCase()) {
    case 'success':
    case 'completed':
    case 'done':
      return { labelKey: 'syncSuccess', variant: 'success' }
    case 'running':
    case 'in_progress':
    case 'syncing':
    case 'pending':
      return { labelKey: 'syncRunning', variant: 'info' }
    case 'failed':
    case 'error':
      return { labelKey: 'syncFailed', variant: 'destructive' }
    default:
      return { labelKey: 'syncUnknown', variant: 'default' }
  }
}

/** 格式化 ISO 时间为可读时间 */
function formatDate(date?: string | null, locale?: string): string {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleString(locale || 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RetailProductSyncPanel: React.FC<RetailProductSyncPanelProps> = ({ className }) => {
  const { t, i18n } = useTranslation()
  const rp = useCallback(
    (key: string) => t(`pages.database.retailProduct.syncPanel.${key}`),
    [t],
  )
  const { success, error: toastError, warning } = useToast()
  const toast = useMemo(
    () => ({ success, error: toastError, warning }),
    [success, toastError, warning],
  )

  const [stats, setStats] = useState<OffSyncStats | null>(null)
  const [report, setReport] = useState<OffReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [statsRes, reportRes] = await Promise.all([
        getOpenFoodFactsSyncStats(),
        getOpenFoodFactsReport(),
      ])
      setStats(statsRes as unknown as OffSyncStats)
      setReport(reportRes as unknown as OffReport)
    } catch (err) {
      logger.error('[OFFSyncPanel] 加载同步状态失败:', err)
      setLoadError(err instanceof Error ? err.message : rp('loadErrorGeneric'))
    } finally {
      setLoading(false)
    }
  }, [rp])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  /** 手动触发同步（需管理员/配方师权限） */
  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await databaseApi.post('/databases/openfoodfacts/sync')
      toast.success(rp('syncTriggered'))
      // 触发后刷新统计
      await loadData()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.warning(rp('permissionDenied'))
      } else {
        logger.error('[OFFSyncPanel] 触发同步失败:', err)
        toast.error(rp('syncTriggerFailed'))
      }
    } finally {
      setSyncing(false)
    }
  }, [loadData, toast, rp])

  // ── 数据质量分布 ──
  const qualityDist = report?.quality_distribution
  const qualityTotal = qualityDist
    ? qualityDist.high + qualityDist.medium + qualityDist.low
    : 0
  const qualityRows = qualityDist
    ? [
        { key: 'high', label: rp('qualityHigh'), count: qualityDist.high, variant: 'success' as const },
        { key: 'medium', label: rp('qualityMedium'), count: qualityDist.medium, variant: 'warning' as const },
        { key: 'low', label: rp('qualityLow'), count: qualityDist.low, variant: 'danger' as const },
      ]
    : []

  const lastSync = stats?.last_sync
  const syncBadge = getSyncStatusBadgeKey(lastSync?.status)

  // ── 加载骨架屏 ──
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{rp('title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-20 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 加载失败 ──
  if (loadError) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>{rp('loadFailed')}</AlertTitle>
              <AlertDescription className="mt-1">{loadError}</AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void loadData()}>
                {rp('reload')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 概览统计 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            {rp('title')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            loading={syncing}
            onClick={() => void handleSync()}
            title={rp('permissionDenied')}
          >
            {syncing ? rp('syncing') : rp('manualSync')}
          </Button>
        </CardHeader>
        <CardContent>
          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard
                  label={rp('totalProducts')}
                  value={stats.total_products}
                  icon={Database}
                  variant="primary"
                  subtitle={rp('totalProductsSubtitle')}
                />
                <StatCard
                  label={rp('withEmbedding')}
                  value={stats.with_embedding}
                  icon={HardDrive}
                  variant="info"
                  subtitle={rp('withEmbeddingSubtitle')}
                />
                <StatCard
                  label={rp('avgQuality')}
                  value={stats.avg_quality ? `${(stats.avg_quality * 100).toFixed(0)}%` : '-'}
                  icon={Gauge}
                  variant="success"
                  subtitle={rp('avgQualitySubtitle')}
                />
                <StatCard
                  label={rp('brands')}
                  value={stats.unique_brands}
                  icon={Layers}
                  variant="warning"
                  subtitle={rp('brandsSubtitle')}
                />
                <StatCard
                  label={rp('categories')}
                  value={stats.kb_categories}
                  icon={Tags}
                  variant="secondary"
                  subtitle={rp('categoriesSubtitle')}
                />
              </div>

              {/* 最近同步时间 */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-secondary/60 px-4 py-3 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {rp('lastSync')}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {lastSync?.date ? formatDate(lastSync.date, i18n.language) : rp('noRecord')}
                </span>
                {lastSync?.status && (
                  <Badge variant={syncBadge.variant} dot>
                    {rp(syncBadge.labelKey)}
                  </Badge>
                )}
                {!lastSync && (
                  <span className="text-muted-foreground">{rp('neverSynced')}</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 数据质量分布 + Top 分类 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
              {rp('qualityDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report && qualityRows.length > 0 ? (
              <div className="space-y-4">
                {qualityRows.map((row) => {
                  const percent = qualityTotal > 0 ? Math.round((row.count / qualityTotal) * 100) : 0
                  return (
                    <div key={row.key}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium tabular-nums">
                          {row.count}
                          <span className="ml-1 text-xs text-muted-foreground">({percent}%)</span>
                        </span>
                      </div>
                      <Progress value={percent} variant={row.variant} size="md" aria-label={`${row.label} ${percent}%`} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{rp('noQualityData')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ListTree className="h-4 w-4 text-primary" aria-hidden="true" />
              {rp('topCategories')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report && report.categories.length > 0 ? (
              <ul className="divide-y divide-border">
                {report.categories.map((cat, index) => (
                  <li key={`${cat.category}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium">{cat.category}</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {cat.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{rp('noCategoryData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default RetailProductSyncPanel