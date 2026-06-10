
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface StabilityPoint {
  month: number
  stability: number
  prediction?: number
}

interface LineChartProps {
  data: StabilityPoint[]
  currentStability: number
}

export function LineChart({ data }: LineChartProps) {
  const stableThreshold = 70
  const warningThreshold = 50

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            label={{ value: '月份', position: 'bottom', offset: 0, fill: '#6b7280' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            label={{ value: '稳定性 (%)', angle: -90, position: 'left', fill: '#6b7280' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, '稳定性']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <ReferenceLine
            y={stableThreshold}
            stroke="#10b981"
            strokeDasharray="3 3"
            label={{ value: '稳定阈值', position: 'right', fill: '#10b981' }}
          />
          <ReferenceLine
            y={warningThreshold}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            label={{ value: '警告阈值', position: 'right', fill: '#f59e0b' }}
          />
          <Line
            name="实际稳定性"
            type="monotone"
            dataKey="stability"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          {data.some(d => d.prediction !== undefined) && (
            <Line
              name="预测趋势"
              type="monotone"
              dataKey="prediction"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, stroke: '#8b5cf6' }}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
