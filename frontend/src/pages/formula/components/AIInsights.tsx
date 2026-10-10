/**
 * AI智能洞察组件
 * 基于真实统计数据的智能分析、趋势预测、异常检测
 */
import { useState, useMemo } from 'react'
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, CardSkeleton } from '@/components/ui'
import { ErrorCard } from '@/components/dashboard/cards/ErrorCard'
import { cn } from '@/lib/utils'
import { useAIInsights, useAIPredictions, useKPIProgress } from '@/hooks/useAIInsights'
import { aiInsightsApi, type InsightEngine } from '@/api/aiInsights'
import { Skeleton } from '@/components/ui/Skeleton'

interface Insight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence?: number
  timestamp: string
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
}

interface AIInsightsProps {
  className?: string
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
}

export function AIInsights({ className, loading, error, onRetry }: AIInsightsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'trends' | 'anomalies' | 'recommendations' | 'achievements'>('all')

  const { data: insights, isLoading: insightsLoading } = useAIInsights()
  const { data: predictions, isLoading: predictionsLoading } = useAIPredictions()
  const { data: kpiProgress, isLoading: kpiLoading } = useKPIProgress()

  // A-07：洞察引擎版本标识（规则版 / 模型版）
  const engine: InsightEngine = useMemo(() => aiInsightsApi.getEngine(), [])
  const engineLabel = engine === 'model' ? '模型版' : '规则版'

  // 父级 loading 优先：数据请求期间显示卡片骨架
  if (loading) {
    return <CardSkeleton count={1} className={className} />
  }

  // 父级 error：显示错误状态
  if (error) {
    return <ErrorCard title="AI洞察加载失败" message="数据获取异常，请稍后重试" onRetry={onRetry} className={className} />
  }

  // A-06：按 confidence 降序排列（tab 切换时同样保持排序稳定）
  const filteredInsights = useMemo(() => {
    if (!insights) return []
    const base = activeTab === 'all'
      ? insights
      : (() => {
          const typeMap: Record<string, Insight['type']> = {
            trends: 'trend',
            anomalies: 'anomaly',
            recommendations: 'recommendation',
            achievements: 'achievement',
          }
          const insightType = typeMap[activeTab]
          return insights.filter(i => i.type === insightType)
        })()
    return [...base].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  }, [activeTab, insights])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-600'
      case 'medium': return 'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700'
      case 'low': return 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-600'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend': return <TrendingUp size={18} />
      case 'anomaly': return <AlertTriangle size={18} />
      case 'recommendation': return <Lightbulb size={18} />
      case 'achievement': return <Target size={18} />
      default: return <Sparkles size={18} />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'trend': return 'text-secondary-600 bg-secondary-100 dark:text-secondary-700 dark:bg-secondary-300/25'
      case 'anomaly': return 'text-error-600 bg-error-100 dark:text-error-600 dark:bg-error-300/25'
      case 'recommendation': return 'text-accent-600 bg-accent-100 dark:text-accent-700 dark:bg-accent-300/25'
      case 'achievement': return 'text-success-600 bg-success-100 dark:text-success-600 dark:bg-success-300/25'
      default: return 'text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpRight size={14} className="text-success-600" />
      case 'down': return <ArrowDownRight size={14} className="text-error-600" />
      default: return <Minus size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-300/25 flex items-center justify-center">
            <Brain size={20} className="text-accent-600 dark:text-accent-700" />
          </div>
          <div>
            <CardTitle as="h3" className="text-sm font-semibold">AI智能洞察</CardTitle>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">基于数据的智能分析与建议</p>
          </div>
        </div>
        <Badge variant="primary" size="sm" title={`洞察引擎：${engineLabel}版`}>
          {engineLabel}
        </Badge>
      </CardHeader>

      <CardContent>
        {/* 分类标签 */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'trends', label: '趋势分析' },
            { key: 'anomalies', label: '异常检测' },
            { key: 'recommendations', label: '智能建议' },
            { key: 'achievements', label: '成就里程碑' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "all" | "recommendations" | "trends" | "anomalies" | "achievements")}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls="insights-panel"
              id={`insight-tab-${tab.key}`}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                activeTab === tab.key
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 洞察列表 */}
        <ul
          id="insights-panel"
          role="tabpanel"
          aria-labelledby={`insight-tab-${activeTab}`}
          className="space-y-3"
          aria-label="AI洞察列表"
        >
          {insightsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredInsights.length === 0 ? (
            <li className="p-6 text-center text-neutral-500 dark:text-neutral-400 text-sm">暂无洞察数据</li>
          ) : (
            filteredInsights.map((insight) => (
            <li
              key={insight.id}
              role="listitem"
            >
              <div
                className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-primary-200 dark:hover:border-primary-800/50 transition-colors group"
              >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  getInsightColor(insight.type),
                )}>
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {insight.title}
                    </h4>
                    <Badge className={getImpactColor(insight.impact)} size="sm">
                      {insight.impact === 'high' ? '高影响' : insight.impact === 'medium' ? '中等影响' : '低影响'}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                    {insight.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">置信度:</span>
                        <div
                          className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={Math.round(insight.confidence * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`置信度: ${Math.round(insight.confidence * 100)}%`}
                        >
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${insight.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{Math.round(insight.confidence * 100)}%</span>
                      </div>
                    </div>
                    {insight.actionUrl && (
                      <a href={insight.actionUrl}>
                        <Button variant="secondary" size="sm">
                          {insight.actionLabel || '查看详情'}
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </li>
          ))
          )}
        </ul>

        {/* 预测趋势 */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            趋势预测
          </h4>
          {predictionsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : predictions && predictions.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {predictions.map((prediction, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {prediction.metric}
                    </span>
                    {getTrendIcon(prediction.trend)}
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-lg font-bold text-neutral-900 dark:text-white">
                      {prediction.current}
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">→</span>
                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-700">
                      {prediction.predicted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{prediction.timeframe}</span>
                    <span className={cn(
                      'text-xs font-medium',
                      prediction.trend === 'up' ? 'text-success-600' : prediction.trend === 'down' ? 'text-error-600' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
                    )}>
                      {prediction.trend === 'up' ? '+' : ''}{prediction.changePercent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function KPIDashboard({ className }: { className?: string }) {
  const { data: kpiProgress, isLoading } = useKPIProgress()

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning-100 dark:bg-warning-300/25 flex items-center justify-center">
            <Target size={20} className="text-warning-600 dark:text-warning-700" />
          </div>
          <div>
            <CardTitle as="h3" className="text-sm font-semibold">KPI进度监控</CardTitle>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">关键绩效指标实时追踪</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : kpiProgress && kpiProgress.length > 0 ? (
          <div className="space-y-4">
            {kpiProgress.map((kpi, idx) => {
              // KPI current/target 均为百分数（0-100），进度条宽度 = current/target
              const progress = kpi.target > 0 ? kpi.current / kpi.target : 0
              const percent = Math.min(100, Math.max(0, progress * 100))
              // 达标：达到目标值的 90% 及以上；需关注：低于 80%
              const isOnTrack = progress >= 0.9
              const isBehind = progress < 0.8

              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{kpi.name}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{kpi.current}%</span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">/ {kpi.target}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isOnTrack ? 'bg-success-500' : isBehind ? 'bg-error-500' : 'bg-warning-500',
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <Badge
                      variant={isOnTrack ? 'success' : isBehind ? 'danger' : 'neutral'}
                      size="sm"
                    >
                      {isOnTrack ? '达标' : isBehind ? '需关注' : '进行中'}
                    </Badge>
                  </div>
                  {kpi.description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {kpi.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
