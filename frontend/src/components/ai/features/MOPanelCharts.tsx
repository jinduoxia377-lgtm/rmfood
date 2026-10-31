/**
 * MultiObjectivePanel chart sub-components
 */
import { useMemo } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { getParetoColor } from './MOPanelSubComponents'
import type { MultiObjectiveResponse } from '@/api/ai'

interface RadarChartProps {
  result: MultiObjectiveResponse
}

export function RadarChartSection({ result }: RadarChartProps) {
  const radarData = useMemo(() => {
    if (!result?.candidates?.length) return []
    const objectives = Object.keys(result.candidates[0].objective_scores || {})
    return objectives.map((key) => {
      const scores = result.candidates.slice(0, 10).map((c) => c.objective_scores[key] ?? 0)
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      return { subject: key, A: avg, fullMark: 1 }
    })
  }, [result])

  if (radarData.length === 0) return null

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10 }} />
          <Radar name="平均得分" dataKey="A" stroke="var(--color-primary-500, #10b981)" fill="var(--color-primary-500, #10b981)" fillOpacity={0.3} />
          <Tooltip formatter={(value: number) => value?.toFixed(3)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface ScatterChartProps {
  scatterData: Array<{
    x: number
    y: number
    pareto_rank: number
    crowding_distance: number
    idx: number
  }>
  axisX: string
  axisY: string
}

export function ScatterChartSection({ scatterData, axisX, axisY }: ScatterChartProps) {
  if (scatterData.length === 0) return null

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis
            type="number"
            dataKey="x"
            name={axisX}
            label={{ value: axisX, position: 'insideBottom', offset: -5, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={axisY}
            label={{ value: axisY, angle: -90, position: 'insideLeft', offset: -5, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value: number, name: string) => [value?.toFixed(4), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Scatter name="候选方案" data={scatterData} line>
            {scatterData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getParetoColor(entry.pareto_rank)}
                r={3 + entry.crowding_distance * 5}
                opacity={0.8}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div key={rank} className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getParetoColor(rank) }} />
            排名 {rank}
          </div>
        ))}
        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-2">· 大小 = 拥挤距离</span>
      </div>
    </div>
  )
}
