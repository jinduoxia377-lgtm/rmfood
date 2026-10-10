
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface IngredientItem {
  name: string
  value: number
  role: string
}

interface PieChartProps {
  data: IngredientItem[]
}

export function PieChart({ data }: PieChartProps) {
  const COLORS = ['var(--color-secondary, #0A84FF)', 'var(--color-tertiary, var(--color-accent-500))', 'var(--color-primary, var(--color-primary-400))', 'var(--color-warning, #FF9F0A)', 'var(--color-error, #FF3B30)', 'var(--color-danger-500, #D946EF)']

  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie rootTabIndex={-1}
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            innerRadius={40}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${((value / total) * 100).toFixed(1)}%`, '比例']}
            contentStyle={{
              backgroundColor: 'var(--card-bg-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}
