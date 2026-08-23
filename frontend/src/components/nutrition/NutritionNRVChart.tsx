/**
 * NRV% 环形图可视化
 *
 * 将每个强制营养素的 NRV% 展示为环形进度条
 */
import { cn } from '@/lib/utils'

interface NRVItem {
  nutrient: string
  nrv_percent: number | null
  unit: string
}

interface NutritionNRVChartProps {
  items: NRVItem[]
  size?: number
  className?: string
}

const NUTRIENT_COLORS: Record<string, string> = {
  energy: '#6366f1',
  protein: '#22c55e',
  fat: '#f59e0b',
  carbohydrate: '#3b82f6',
  sodium: '#ef4444',
  saturated_fat: '#a855f7',
  sugar: '#ec4899',
  dietary_fiber: '#14b8a6',
}

const NUTRIENT_NAMES_CN: Record<string, string> = {
  energy: '能量',
  protein: '蛋白质',
  fat: '脂肪',
  carbohydrate: '碳水化合物',
  sodium: '钠',
  saturated_fat: '饱和脂肪',
  sugar: '糖',
  dietary_fiber: '膳食纤维',
}

export function NutritionNRVChart({ items, size = 120, className }: NutritionNRVChartProps) {
  const validItems = items.filter((item) => item.nrv_percent != null && item.nrv_percent > 0)
  if (validItems.length === 0) return null

  return (
    <div className={cn('nutrition-nrv-chart', className)}>
      <div className="nutrition-nrv-chart-title">NRV% 概览</div>
      <div className="nutrition-nrv-chart-grid">
        {validItems.map((item) => (
          <NRVRing key={item.nutrient} item={item} size={size} />
        ))}
      </div>
    </div>
  )
}

// ── 单环组件 ───────────────────────────────────────────────

interface NRVRingProps {
  item: NRVItem
  size: number
}

function NRVRing({ item, size }: NRVRingProps) {
  const pct = item.nrv_percent ?? 0
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const clampedPct = Math.min(pct, 100)
  const offset = circumference - (clampedPct / 100) * circumference
  const color = NUTRIENT_COLORS[item.nutrient] || '#6366f1'
  const label = NUTRIENT_NAMES_CN[item.nutrient] || item.nutrient

  return (
    <div className="nrv-ring-item">
      <div className="nrv-ring-container" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="nrv-ring-svg">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-700"
            strokeWidth={8}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="nrv-ring-progress"
          />
          {/* Center text */}
          <text
            x={size / 2}
            y={size / 2 - 4}
            textAnchor="middle"
            className="fill-current text-neutral-800 dark:text-neutral-200"
            style={{ fontSize: size * 0.2, fontWeight: 700 }}
          >
            {Math.round(pct)}%
          </text>
          <text
            x={size / 2}
            y={size / 2 + size * 0.15}
            textAnchor="middle"
            className="fill-current text-neutral-500 dark:text-neutral-400"
            style={{ fontSize: size * 0.11 }}
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  )
}
