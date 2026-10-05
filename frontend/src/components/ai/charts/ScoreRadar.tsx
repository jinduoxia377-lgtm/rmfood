import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

export interface ScoreRadarProps {
  scores: {
    synergy_score: number | null
    taste_score: number | null
    stability_score: number | null
    overall_score: number | null
  }
  size?: number
  theme?: 'light' | 'dark'
}

export function ScoreRadar({ scores, size = 160, theme = 'light' }: ScoreRadarProps) {
  const radarData = useMemo(() => [
    { dimension: '协同', value: scores.synergy_score ?? 0, fullMark: 1 },
    { dimension: '口感', value: scores.taste_score ?? 0, fullMark: 1 },
    { dimension: '稳定性', value: scores.stability_score ?? 0, fullMark: 1 },
    { dimension: '综合', value: scores.overall_score ?? 0, fullMark: 1 },
  ], [scores])

  const colors = useMemo(() => {
    const isDark = theme === 'dark' || document.documentElement.classList.contains('dark')
    return {
      grid: isDark ? '#4B5563' : 'var(--border-subtle, rgba(0,0,0,0.06))',
      axis: isDark ? '#9CA3AF' : 'var(--text-secondary, #6E6E73)',
      fill: isDark ? 'var(--color-secondary-500)' : 'var(--color-primary, var(--color-primary-400))',
      stroke: isDark ? '#6ECAFF' : 'var(--color-primary, var(--color-primary-400))',
      opacity: isDark ? 0.4 : 0.2,
    }
  }, [theme])

  return (
    <ResponsiveContainer width={size} height={size}>
      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke={colors.grid} />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: colors.axis }} />
        <PolarRadiusAxis angle={90} domain={[0, 1]} tick={false} axisLine={false} />
        <Radar
          name="评分"
          dataKey="value"
          stroke={colors.stroke}
          fill={colors.fill}
          fillOpacity={colors.opacity}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
