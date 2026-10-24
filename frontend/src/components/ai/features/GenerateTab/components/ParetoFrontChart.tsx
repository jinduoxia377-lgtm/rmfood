import React, { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import type { AICandidate } from '@/api/ai'

// ─── 类型定义 ───

interface ParetoFrontChartProps {
  candidates: AICandidate[]
  objectives?: Array<{
    key: string
    label: string
    color: string
  }>
  title?: string
  description?: string
  className?: string
  showLegend?: boolean
}

// ─── 常量定义 ───

const DEFAULT_OBJECTIVES = [
  { key: 'efficacy_score', label: '功效', color: '#10b981' },
  { key: 'safety_score', label: '安全', color: '#3b82f6' },
  { key: 'taste_score', label: '口感', color: '#f59e0b' },
  { key: 'cost_score', label: '成本', color: '#8b5cf6' },
  { key: 'synergy_score', label: '协同', color: '#ec4899' },
  { key: 'stability_score', label: '稳定', color: '#06b6d4' },
]

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444']

// ─── 子组件 ───

function CustomTooltip({
  active,
  payload,
  labels,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  labels: Record<string, string>
}) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-2">{t('ai.formula.ui.formulaDetails')}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{labels[entry.name] || entry.name}:</span>
          <span className="font-mono font-medium">{entry.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 主组件 ───

export function ParetoFrontChart({
  candidates,
  objectives = DEFAULT_OBJECTIVES,
  title,
  description,
  className,
  showLegend = true,
}: ParetoFrontChartProps) {
  const { t } = useTranslation()
  const chartTitle = title || t('ai.formula.ui.paretoFrontierTitle')

  // 默认目标轴的翻译标签（仅当使用内置 DEFAULT_OBJECTIVES 时生效）
  const defaultObjectives = useMemo(() => [
    { key: 'efficacy_score', label: t('ai.formula.ui.efficacyShort'), color: '#10b981' },
    { key: 'safety_score', label: t('ai.formula.ui.safetyShort'), color: '#3b82f6' },
    { key: 'taste_score', label: t('ai.formula.ui.taste'), color: '#f59e0b' },
    { key: 'cost_score', label: t('ai.formula.ui.cost'), color: '#8b5cf6' },
    { key: 'synergy_score', label: t('ai.formula.ui.synergy'), color: '#ec4899' },
    { key: 'stability_score', label: t('ai.formula.ui.stabilityShort'), color: '#06b6d4' },
  ], [t])
  const resolvedObjectives = objectives === DEFAULT_OBJECTIVES ? defaultObjectives : objectives

  // 准备图表数据
  const chartData = useMemo(() => {
    return candidates.map((c, i) => {
      const data: Record<string, unknown> = {
        name: c.name || t('ai.formula.ui.formulaNameFallback', { index: i + 1 }),
        rank: i + 1,
      }
      // 提取各目标值
      resolvedObjectives.forEach((obj) => {
        const value = c[obj.key as keyof AICandidate]
        if (typeof value === 'number') {
          data[obj.key] = value
        }
      })
      // 综合得分用于气泡大小
      data.composite = c.overall_score || 0
      return data
    })
  }, [candidates, resolvedObjectives, t])

  // 选择主要目标轴
  const xKey = resolvedObjectives[0]?.key || 'efficacy_score'
  const yKey = resolvedObjectives[1]?.key || 'safety_score'

  // 构建标签映射
  const labels = useMemo(
    () => Object.fromEntries(resolvedObjectives.map((o) => [o.key, o.label])),
    [resolvedObjectives],
  )

  if (!candidates.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm">{chartTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            {t('ai.formula.ui.noCandidateData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm">{chartTitle}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{t('ai.formula.ui.candidateCount', { count: candidates.length })}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <XAxis
              type="number"
              dataKey={xKey}
              name={labels[xKey]}
              unit=""
              domain={[0, 1]}
              label={{
                value: labels[xKey],
                position: 'bottom',
                offset: 0,
                fill: 'var(--text-muted)',
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              name={labels[yKey]}
              unit=""
              domain={[0, 1]}
              label={{
                value: labels[yKey],
                position: 'left',
                offset: 0,
                fill: 'var(--text-muted)',
                fontSize: 12,
                angle: -90,
              }}
            />
            <ZAxis
              type="number"
              dataKey="composite"
              range={[80, 400]}
              name={t('ai.formula.ui.compositeScore')}
              unit=""
            />
            <Tooltip content={<CustomTooltip labels={labels} />} />
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value: string) => labels[value] || value}
              />
            )}
            <Scatter
              name={t('ai.formula.ui.paretoFront')}
              data={chartData}
              line={{ strokeWidth: 1.5 }}
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.7}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* 目标说明 */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
          {resolvedObjectives.map((obj) => (
            <div key={obj.key} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: obj.color }}
              />
              <span className="text-muted-foreground">{obj.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── 多维评分雷达图 ───

interface RadarChartProps {
  candidate: AICandidate
  title?: string
  className?: string
}

export function ScoreRadarChart({ candidate, title, className }: RadarChartProps) {
  const { t } = useTranslation()
  const chartTitle = title || t('ai.formula.ui.formulaMultiScore')
  const dimensions = [
    { key: 'efficacy_score', label: t('ai.formula.ui.efficacyShort'), max: 1 },
    { key: 'safety_score', label: t('ai.formula.ui.safetyShort'), max: 1 },
    { key: 'taste_score', label: t('ai.formula.ui.taste'), max: 1 },
    { key: 'cost_score', label: t('ai.formula.ui.cost'), max: 1 },
    { key: 'synergy_score', label: t('ai.formula.ui.synergy'), max: 1 },
    { key: 'stability_score', label: t('ai.formula.ui.stabilityShort'), max: 1 },
  ]

  const data = dimensions.map((d) => ({
    subject: d.label,
    A: Math.round(((candidate[d.key as keyof AICandidate] as number) ?? 0) * 100),
    full: 100,
  }))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm">{chartTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{candidate.name}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          {/* 简化版雷达图 - 使用柱状图代替 */}
          <div className="flex items-end justify-around h-full pb-6">
            {data.map((d) => (
              <div key={d.subject} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs font-mono text-primary">
                  {d.A}%
                </span>
                <div
                  className="w-full max-w-[40px] bg-primary/20 rounded-t-sm relative overflow-hidden"
                  style={{ height: '150px' }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all"
                    style={{ height: `${d.A}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{d.subject}</span>
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export { DEFAULT_OBJECTIVES, COLORS }
export type { ParetoFrontChartProps, RadarChartProps }
