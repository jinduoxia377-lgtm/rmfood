/**
 * 配方成分可视化组件
 * 饼图展示君臣佐使角色分布 + 柱状图展示用量分布
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { CHART_TYPOGRAPHY } from '../../../utils/typography'
import { getChartThemeColors, getRoleColor } from '../../../utils/chartTheme'
import { useIsDarkMode } from '@/theme'

interface Ingredient {
  name: string
  category?: string
  is_food_homology?: boolean
  dosage?: string
  role?: string
}

interface CompositionChartProps {
  ingredients: Ingredient[]
  compact?: boolean
}

function parseDosage(dosage: string): number {
  if (!dosage) return 0
  const match = /^([\d.]+)/.exec(dosage)
  if (match) return parseFloat(match[1])
  return 0
}

function getDosageUnit(dosage: string): string {
  if (!dosage) return ''
  return dosage.replace(/^[\d.]+/, '').trim() || 'g'
}

export function CompositionChart({ ingredients, compact = false }: CompositionChartProps) {
  // D-43 修复：原为 useMemo(..., []) 空依赖 —— 切主题后图表颜色不会更新
  const isDark = useIsDarkMode()
  const colors = useMemo(() => getChartThemeColors(), [isDark])
  const tooltipBg = colors.tooltipBg || 'var(--card-bg-solid, #FFFFFF)'
  const tooltipBorder = colors.tooltipBorder || 'var(--border-subtle, rgba(0,0,0,0.06))'
  const tooltipText = colors.tooltipText || 'var(--text-secondary, #6E6E73)'
  const axisColor = colors.axisColor || 'var(--text-muted, #9A9A9F)'
  const barFill = colors.barFill || 'var(--color-secondary, #0A84FF)'

  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: '8px',
    color: tooltipText,
    fontSize: '12px',
  }

  const roleData = useMemo(() => {
    const roleMap: Record<string, number> = {}
    ingredients.forEach(ing => {
      const role = ing.role || '未分类'
      roleMap[role] = (roleMap[role] || 0) + 1
    })
    return Object.entries(roleMap).map(([name, value]) => ({
      name,
      value,
      fill: getRoleColor(name),
    }))
  }, [ingredients])

  const dosageData = useMemo(() => {
    return ingredients
      .map(ing => ({
        name: ing.name.length > 6 ? ing.name.slice(0, 6) + '...' : ing.name,
        dosage: parseDosage(ing.dosage || '0'),
        unit: getDosageUnit(ing.dosage || '0'),
      }))
      .filter(item => item.dosage > 0)
      .sort((a, b) => b.dosage - a.dosage)
      .slice(0, compact ? 5 : 10)
  }, [ingredients, compact])

  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {}
    ingredients.forEach(ing => {
      const cat = ing.category || '未分类'
      catMap[cat] = (catMap[cat] || 0) + 1
    })
    return Object.entries(catMap)
      .map(([name, value], i) => ({
        name: name.length > 8 ? name.slice(0, 8) + '...' : name,
        value,
        fill: colors.pie[i % colors.pie.length],
      }))
      .sort((a, b) => b.value - a.value)
  }, [ingredients, colors])

  const totalIngredients = ingredients.length

  if (totalIngredients === 0) {
    return (
      <div className="py-8 text-center text-neutral-400 dark:text-neutral-400">
        <p className="text-sm">暂无成分数据</p>
        <p className="text-xs mt-1">请先添加成分后查看分布图</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={roleData}
                cx="50%"
                cy="50%"
                innerRadius={16}
                outerRadius={32}
                paddingAngle={2}
                dataKey="value"
              >
                {roleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {roleData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {roleData.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">君臣佐使分布</h5>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={24}
                    outerRadius={44}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name}${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value} 种 (${((value / totalIngredients) * 100).toFixed(0)}%)`, '数量']}
                    />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {roleData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800/50">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{entry.name}</span>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{entry.value} 种</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {dosageData.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">用量分布 (Top {dosageData.length})</h5>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dosageData} layout="vertical" margin={{ left: 50, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: axisColor }} width={50} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, _: any, props: any) => [`${value} ${props.payload.unit || 'g'}`, '用量']}
                />
                <Bar dataKey="dosage" fill={barFill} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {categoryData.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">药材分类分布</h5>
          <div className="flex flex-wrap gap-1.5">
            {categoryData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${entry.fill}15`, color: entry.fill }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                <span>{entry.name}</span>
                <span className="opacity-70">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
