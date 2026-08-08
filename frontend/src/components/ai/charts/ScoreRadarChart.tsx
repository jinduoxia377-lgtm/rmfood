import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { CHART_TYPOGRAPHY } from '../../../utils/typography'

interface ScoreRadarChartProps {
  synergyScore: number | null | undefined
  tasteScore: number | null | undefined
  stabilityScore: number | null | undefined
  overallScore: number | null | undefined
}

const getScoreColor = (score: number) => {
  if (score >= 0.8) return 'var(--color-success-600)'
  if (score >= 0.6) return 'var(--color-warning-600)'
  return 'var(--color-danger-600)'
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { dimension: string; value: number; label?: string }[] }) => {
  if (active && payload?.length) {
    const data = payload[0]
    if (data) {
      return (
        <div className="px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 shadow-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{data.dimension}</p>
          <p className="text-sm font-bold" style={{ color: getScoreColor(data.value) }}>
            {(data.value * 100).toFixed(0)}分
          </p>
        </div>
      )
    }
  }
  return null
}

export function ScoreRadarChart({ synergyScore, tasteScore, stabilityScore, overallScore }: ScoreRadarChartProps) {
  const radarData = [
    { dimension: '协同', value: synergyScore ?? 0, fullMark: 1, label: '协同性评分' },
    { dimension: '口感', value: tasteScore ?? 0, fullMark: 1, label: '口感评分' },
    { dimension: '稳定性', value: stabilityScore ?? 0, fullMark: 1, label: '稳定性评分' },
    { dimension: '综合', value: overallScore ?? 0, fullMark: 1, label: '综合评分' },
  ]

  const scoreColor = getScoreColor(overallScore ?? 0)

  return (
    <div className="relative">
      <div className="flex items-center justify-center mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>评分雷达图</span>
      </div>
      <div className="flex justify-center py-2">
        <div className="relative w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-primary-400)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <PolarGrid
                stroke="var(--border-color)"
                strokeWidth={1}
                className="transition-colors duration-200"
              />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{
                  fontSize: CHART_TYPOGRAPHY.axisLabel.fontSize,
                  fill: 'var(--color-text-muted)',
                  fontWeight: CHART_TYPOGRAPHY.dataLabel.fontWeight,
                }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 1]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="评分"
                dataKey="value"
                stroke="var(--color-primary-500)"
                strokeWidth={2.5}
                fill="url(#radarGradient)"
                fillOpacity={0.35}
                strokeLinecap="round"
              />
              <RechartsTooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          {/* 中心数值标注 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold" style={{ color: scoreColor }}>
              {((overallScore ?? 0) * 100).toFixed(0)}
            </span>
            <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>综合</span>
          </div>
        </div>
      </div>
    </div>
  )
}
