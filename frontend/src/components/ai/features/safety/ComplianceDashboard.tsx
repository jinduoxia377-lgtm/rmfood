import { useState, useEffect, useMemo } from 'react'
import { Card, Badge } from '@/components/ui'

interface ComplianceMetric {
  id: string
  region: string
  flag: string
  label: string
  rate: number
  trend: 'up' | 'down' | 'stable'
  changeValue: number
  onClick?: () => void
}

interface ComplianceDashboardProps {
  overallComplianceRate: number
  metrics?: ComplianceMetric[]
  animated?: boolean
  size?: 'small' | 'medium' | 'large'
  onClickMetric?: (metricId: string) => void
  className?: string
}

const DEFAULT_METRICS: Omit<ComplianceMetric, 'rate' | 'trend' | 'changeValue'>[] = [
  { id: 'gb', region: '中国', flag: '🇨🇳', label: 'GB标准' },
  { id: 'fda', region: '美国', flag: '🇺🇸', label: 'FDA GRAS' },
  { id: 'efsa', region: '欧盟', flag: '🇪🇺', label: 'EFSA' },
  { id: 'japan', region: '日本', flag: '🇯🇵', label: '厚生省' },
  { id: 'internal', region: '内部', flag: '🏢', label: '企业标准' },
]

const SIZE_CONFIG = {
  small: { ringSize: 120, strokeWidth: 10, metricCards: 3, fontSize: 24 },
  medium: { ringSize: 180, strokeWidth: 14, metricCards: 5, fontSize: 32 },
  large: { ringSize: 240, strokeWidth: 18, metricCards: 6, fontSize: 40 },
}

export function ComplianceDashboard({
  overallComplianceRate,
  metrics = DEFAULT_METRICS as ComplianceMetric[],
  animated = true,
  size = 'medium',
  onClickMetric,
  className = '',
}: ComplianceDashboardProps) {
  const [animatedRate, setAnimatedRate] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const config = SIZE_CONFIG[size]

  useEffect(() => {
    if (!animated) {
      setAnimatedRate(overallComplianceRate)
      setIsLoaded(true)
      return
    }

    const duration = 1000
    const startTime = Date.now()
    const startValue = 0
    let animationId: number

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      setAnimatedRate(Math.round(startValue + (overallComplianceRate - startValue) * easedProgress))

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        setIsLoaded(true)
      }
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [overallComplianceRate, animated])

  const getColorByRate = (rate: number) => {
    if (rate >= 80) return { stroke: '#34C759', text: 'text-success-600', bg: 'bg-success-500' }
    if (rate >= 50) return { stroke: '#D97706', text: 'text-yellow-600', bg: 'bg-yellow-500' }
    return { stroke: '#FF3B30', text: 'text-error-600', bg: 'bg-error-500' }
  }

  const mainColor = getColorByRate(animatedRate)
  const radius = (config.ringSize - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedRate / 100) * circumference

  const displayedMetrics = metrics.slice(0, config.metricCards)

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="relative flex-shrink-0">
          <svg width={config.ringSize} height={config.ringSize} className="transform -rotate-90">
            <circle
              cx={config.ringSize / 2}
              cy={config.ringSize / 2}
              r={radius}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={config.strokeWidth}
            />
            <circle
              cx={config.ringSize / 2}
              cy={config.ringSize / 2}
              r={radius}
              fill="none"
              stroke={mainColor.stroke}
              strokeWidth={config.strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: animated && isLoaded ? 'stroke-dashoffset 0.3s ease' : 'none',
                filter: `drop-shadow(0 0 8px ${mainColor.stroke}40)`,
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-bold ${mainColor.text}`} style={{ fontSize: config.fontSize }}>
              {animatedRate}%
            </span>
            <span className="text-xs text-neutral-500 mt-1">合规率</span>
          </div>

          {!isLoaded && animated && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-neutral-900/50 rounded-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-white" />
            </div>
          )}
        </div>

        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${displayedMetrics.length <= 3 ? displayedMetrics.length : 3} gap-3">
          {displayedMetrics.map((metric) => {
            const metricColor = getColorByRate(metric.rate)
            return (
              <div
                key={metric.id}
                className={`p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all cursor-pointer ${onClickMetric ? 'cursor-pointer' : ''}`}
                onClick={() => onClickMetric?.(metric.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{metric.flag}</span>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {metric.label}
                    </span>
                  </div>
                  <Badge variant={
                    metric.rate >= 80 ? 'success' :
                    metric.rate >= 50 ? 'warning' : 'danger'
                  }>
                    {metric.rate}%
                  </Badge>
                </div>

                <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${metricColor.bg}`}
                    style={{ width: `${metric.rate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{metric.region}</span>
                  <span className={`flex items-center gap-1 ${
                    metric.trend === 'up' ? 'text-success-600' :
                    metric.trend === 'down' ? 'text-error-600' : 'text-neutral-600'
                  }`}>
                    {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '='}
                    {Math.abs(metric.changeValue)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export type { ComplianceDashboardProps, ComplianceMetric }
