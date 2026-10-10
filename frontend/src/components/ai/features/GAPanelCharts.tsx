/**
 * GA Panel Charts — 遗传算法面板图表组件
 *
 * 从 GeneticAlgorithmPanel.tsx 中提取的图表渲染逻辑，
 * 包含进化曲线图和种群多样性变化图。
 */
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Zap } from 'lucide-react'

export interface GenerationRecord {
  generation: number
  best_fitness: number
  avg_fitness: number
  min_fitness: number
  diversity: number
}

interface GAPanelChartsProps {
  chartData: GenerationRecord[]
}

/** 进化曲线图：最佳/平均/最低适应度 */
export function GAFitnessChart({ chartData }: GAPanelChartsProps) {
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" role="status">
        暂无进化曲线数据
      </div>
    )
  }

  return (
    <div className="w-full" style={{ aspectRatio: '16/9' }} role="img" aria-label="遗传算法进化曲线图">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="generation"
            label={{ value: '代数', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            label={{ value: '适应度', angle: -90, position: 'insideLeft', fontSize: 12 }}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            domain={['dataMin - 0.02', 'dataMax + 0.02']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
            formatter={(value: number) => [value.toFixed(4), undefined]}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line
            type="monotone"
            dataKey="best_fitness"
            name="最佳适应度"
            stroke="var(--color-primary-400)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-primary-400)' }}
          />
          <Line
            type="monotone"
            dataKey="avg_fitness"
            name="平均适应度"
            stroke="var(--color-secondary-500)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="min_fitness"
            name="最低适应度"
            stroke="#FF3B30"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="3 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 种群多样性变化曲线 */
export function GADiversityChart({ chartData }: GAPanelChartsProps) {
  return (
    <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
      <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" />
        种群多样性变化
      </h4>
      <div style={{ aspectRatio: '16/5' }} role="img" aria-label="种群多样性变化曲线">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="generation" tick={{ fontSize: 12 }} stroke="#d1d5db" />
            <YAxis tick={{ fontSize: 12 }} stroke="#d1d5db" domain={[0, 1]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [value.toFixed(4), '多样性']}
            />
            <Line
              type="monotone"
              dataKey="diversity"
              name="多样性"
              stroke="var(--color-primary-500, #10b981)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
