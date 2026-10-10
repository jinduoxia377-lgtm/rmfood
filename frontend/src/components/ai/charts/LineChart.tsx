
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
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            label={{ value: '月份', position: 'bottom', offset: 0, fill: 'var(--text-secondary, #6E6E73)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--text-secondary, #6E6E73)', fontSize: 12 }}
            label={{ value: '稳定性 (%)', angle: -90, position: 'left', fill: 'var(--text-secondary, #6E6E73)' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, '稳定性']}
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <ReferenceLine
            y={stableThreshold}
            stroke="var(--color-primary, var(--color-primary-400))"
            strokeDasharray="3 3"
            label={{ value: '稳定阈值', position: 'right', fill: 'var(--color-primary, var(--color-primary-400))' }}
          />
          <ReferenceLine
            y={warningThreshold}
            stroke="var(--color-warning, #FF9F0A)"
            strokeDasharray="3 3"
            label={{ value: '警告阈值', position: 'right', fill: 'var(--color-warning, #FF9F0A)' }}
          />
          <Line
            name="实际稳定性"
            type="monotone"
            dataKey="stability"
            stroke="var(--color-secondary, #0A84FF)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          {data.some(d => d.prediction !== undefined) && (
            <Line
              name="预测趋势"
              type="monotone"
              dataKey="prediction"
              stroke="var(--color-tertiary, var(--color-accent-500))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, stroke: 'var(--color-tertiary, var(--color-accent-500))' }}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
