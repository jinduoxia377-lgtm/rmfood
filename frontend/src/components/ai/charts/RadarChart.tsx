
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
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}分`, '评分']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <Radar
            name="评分"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
