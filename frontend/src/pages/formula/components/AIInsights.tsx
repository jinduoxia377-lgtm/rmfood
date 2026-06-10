/**
 * AI智能洞察组件
 * 基于数据的智能分析、趋势预测、异常检测
 */
import { useState, useMemo } from 'react'
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number
  timestamp: string
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
}

const MOCK_INSIGHTS: Insight[] = [
  {
    id: '1',
    type: 'trend',
    title: '配方创建效率提升20%',
    description: '本月配方平均完成时间较上月缩短20%，主要得益于AI辅助功能的优化',
    impact: 'high',
    confidence: 0.92,
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'anomaly',
    title: '实验失败率异常升高',
    description: '近7天实验失败率上升15%，建议检查数据采集流程',
    impact: 'high',
    confidence: 0.87,
    timestamp: new Date().toISOString(),
    actionUrl: '/experiments',
    actionLabel: '查看实验',
  },
  {
    id: '3',
    type: 'recommendation',
    title: '建议添加新的功效标签',
    description: '根据用户搜索趋势，"抗衰老"相关配方搜索量增长30%',
    impact: 'medium',
    confidence: 0.78,
    timestamp: new Date().toISOString(),
    actionUrl: '/formulas/templates',
    actionLabel: '查看模板',
  },
  {
    id: '4',
    type: 'achievement',
    title: '月度目标提前完成',
    description: '本月配方审核数量已达目标的110%，继续保持高效工作',
    impact: 'low',
    confidence: 1.0,
    timestamp: new Date().toISOString(),
  },
  {
    id: '5',
    type: 'trend',
    title: 'AI分析需求增长',
    description: '过去30天内使用AI分析功能的用户数增长45%',
    impact: 'medium',
    confidence: 0.95,
    timestamp: new Date().toISOString(),
  },
]

interface TrendPrediction {
  metric: string
  current: number
  predicted: number
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  timeframe: string
}

const MOCK_PREDICTIONS: TrendPrediction[] = [
  { metric: '新增配方', current: 120, predicted: 145, trend: 'up', changePercent: 20.8, timeframe: '未来7天' },
  { metric: '实验成功率', current: 78, predicted: 82, trend: 'up', changePercent: 5.1, timeframe: '未来30天' },
  { metric: '审核周期', current: 2.5, predicted: 2.2, trend: 'down', changePercent: 12, timeframe: '未来7天' },
  { metric: 'API调用量', current: 15000, predicted: 18000, trend: 'up', changePercent: 20, timeframe: '未来30天' },
]

interface KPIProgress {
  name: string
  current: number
  target: number
  unit?: string
  description?: string
}

const MOCK_KPI_PROGRESS: KPIProgress[] = [
  { name: '配方完成率', current: 92, target: 85, description: '本月目标已超额完成' },
  { name: '实验成功率', current: 78, target: 80, description: '接近目标，建议优化实验设计' },
  { name: '审核及时率', current: 85, target: 90, description: '需加快审核流程' },
  { name: '数据完整性', current: 95, target: 95, description: '已达到目标' },
]

interface AIInsightsProps {
  className?: string
}

export function AIInsights({ className }: AIInsightsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'trends' | 'anomalies' | 'recommendations' | 'achievements'>('all')

  const filteredInsights = useMemo(() => {
    if (activeTab === 'all') return MOCK_INSIGHTS
    const typeMap: Record<string, Insight['type']> = {
      trends: 'trend',
      anomalies: 'anomaly',
      recommendations: 'recommendation',
      achievements: 'achievement',
    }
    const insightType = typeMap[activeTab]
    return MOCK_INSIGHTS.filter(i => i.type === insightType)
  }, [activeTab])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
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
      case 'trend': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
      case 'anomaly': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      case 'recommendation': return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30'
      case 'achievement': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpRight size={14} className="text-green-600" />
      case 'down': return <ArrowDownRight size={14} className="text-red-600" />
      default: return <Minus size={14} className="text-slate-400" />
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <CardTitle as="h3" className="text-sm font-bold">AI智能洞察</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">基于数据的智能分析与建议</p>
          </div>
        </div>
        <Badge variant="primary" size="sm">Beta</Badge>
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
              onClick={() => setActiveTab(tab.key as any)}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls="insights-panel"
              id={`insight-tab-${tab.key}`}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                activeTab === tab.key
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
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
          {filteredInsights.map((insight) => (
            <li
              key={insight.id}
              role="listitem"
            >
              <div
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800/50 transition-colors group"
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
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {insight.title}
                    </h4>
                    <Badge className={getImpactColor(insight.impact)} size="sm">
                      {insight.impact === 'high' ? '高影响' : insight.impact === 'medium' ? '中等影响' : '低影响'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {insight.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">置信度:</span>
                        <div
                          className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
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
                        <span className="text-xs text-slate-500">{Math.round(insight.confidence * 100)}%</span>
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
          ))}
        </ul>

        {/* 预测趋势 */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            趋势预测
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_PREDICTIONS.map((prediction, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {prediction.metric}
                  </span>
                  {getTrendIcon(prediction.trend)}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {prediction.current}
                  </span>
                  <span className="text-xs text-slate-500">→</span>
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {prediction.predicted}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{prediction.timeframe}</span>
                  <span className={cn(
                    'text-xs font-medium',
                    prediction.trend === 'up' ? 'text-green-600' : prediction.trend === 'down' ? 'text-red-600' : 'text-slate-500',
                  )}>
                    {prediction.trend === 'up' ? '+' : ''}{prediction.changePercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KPIDashboard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Target size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle as="h3" className="text-sm font-bold">KPI进度监控</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">关键绩效指标实时追踪</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {MOCK_KPI_PROGRESS.map((kpi, idx) => {
            const percent = Math.min(100, Math.max(0, (kpi.current / kpi.target) * 100))
            const isOnTrack = percent >= 90
            const isBehind = percent < 80

            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{kpi.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{kpi.current}%</span>
                    <span className="text-xs text-slate-500">/ {kpi.target}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isOnTrack ? 'bg-green-500' : isBehind ? 'bg-red-500' : 'bg-amber-500',
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {kpi.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
