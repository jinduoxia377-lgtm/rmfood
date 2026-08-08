
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface RadarChartProps {
  data: {
    synergy: number
    taste: number
    stability: number
    safety: number
  }
}

export function RadarChart({ data }: RadarChartProps) {
  const chartData = [
    {
      dimension: '协同作用',
      value: Math.round(data.synergy * 100),
      fullMark: 100,
    },
    {
      dimension: '口感风味',
      value: Math.round(data.taste * 100),
      fullMark: 100,
    },
    {
      dimension: '稳定性',
      value: Math.round(data.stability * 100),
      fullMark: 100,
    },
    {
      dimension: '安全性',
      value: Math.round(data.safety * 100),
      fullMark: 100,
    },
  ]

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={chartData}>
          <PolarGrid stroke="var(--border-subtle, rgba(0,0,0,0.06))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'var(--text-muted, #9A9A9F)', fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}分`, '评分']}
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <Radar
            name="评分"
            dataKey="value"
            stroke="var(--color-secondary, #0A84FF)"
            fill="var(--color-secondary, #0A84FF)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
