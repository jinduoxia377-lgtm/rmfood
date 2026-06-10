/**
 * ChartBlock — 可视化图表区块
 *
 * 根据 chartType 分派到现有图表组件：
 * - radar → RadarChart
 * - bar → BarChart
 * - score-cards → ScoreCards
 *
 * 统一的卡片容器 + 标题栏
 */
import React from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { RadarChart } from '@/components/ai/charts/RadarChart'
import { BarChart } from '@/components/ai/charts/BarChart'
import { ScoreCards } from '@/components/ai/charts/ScoreCards'
import type { ChartData } from '../types'

interface ChartBlockProps {
  data: ChartData
}

function ChartBlock({ data }: ChartBlockProps) {
  const { chartType, title, data: chartData } = data

  if (!chartData || Object.keys(chartData).length === 0) {
    return null
  }

  const renderChart = () => {
    switch (chartType) {
      case 'radar':
        // RadarChart 接受 { synergy, taste, stability, safety }
        return <RadarChart data={chartData as { synergy: number; taste: number; stability: number; safety: number }} />

      case 'bar':
        // BarChart 接受 IngredientContribution[]
        return <BarChart data={chartData as unknown as Array<{ name: string; contribution: number; category: 'synergy' | 'safety' | 'taste' | 'stability' }>} />

      case 'score-cards':
        // ScoreCards 接受 { synergyScore, tasteScore, stabilityScore, overallScore }
        const sc = chartData as unknown as Record<string, number | null | undefined>
        return (
          <ScoreCards
            synergyScore={sc.synergyScore ?? null}
            tasteScore={sc.tasteScore ?? null}
            stabilityScore={sc.stabilityScore ?? null}
            overallScore={sc.overallScore ?? null}
          />
        )

      default:
        return (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">暂不支持的图表类型: {chartType}</p>
          </div>
        )
    }
  }

  return (
    <div className="mb-3 last:mb-0">
      {/* 卡片容器 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {/* 标题栏 */}
        {title && (
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800
            bg-gradient-to-r from-blue-50/60 to-transparent dark:from-blue-950/20 dark:to-transparent">
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</span>
          </div>
        )}

        {/* 图表内容 */}
        <div className="p-3">
          {renderChart()}
        </div>
      </div>
    </div>
  )
}

export default ChartBlock
