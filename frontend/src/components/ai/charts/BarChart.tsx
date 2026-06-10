
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface IngredientContribution {
  name: string
  contribution: number
  category: 'synergy' | 'safety' | 'taste' | 'stability'
}

interface BarChartProps {
  data: IngredientContribution[]
}

export function BarChart({ data }: BarChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fill: '#374151', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, '贡献度']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
          <Bar
            name="贡献度"
            dataKey="contribution"
            fill="#8b5cf6"
            radius={[0, 4, 4, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
