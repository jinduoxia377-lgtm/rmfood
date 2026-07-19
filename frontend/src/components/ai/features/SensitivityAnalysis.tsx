import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts'
import {
  Sliders,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  CheckCircle2,
  Zap,
  Info,
  RotateCcw,
  Copy,
} from 'lucide-react'

export interface SensitivityParameter {
  id: string
  name: string
  unit: string
  baseValue: number
  minValue: number
  maxValue: number
  step: number
  currentValue: number
}

export interface MetricResult {
  efficacy: number
  stability: number
  cost: number
  safety: number
  sensory: number
  overall: number
}

export interface ScenarioConfig {
  id: string
  name: string
  color: string
  parameters: Record<string, number>
  results: MetricResult | null
}

interface SensitivityAnalysisProps {
  baseParameters: SensitivityParameter[]
  onParameterChange?: (parameters: Record<string, number>) => void
  onScenarioApply?: (scenario: ScenarioConfig) => void
  className?: string
}

const DEFAULT_PARAMETERS: SensitivityParameter[] = [
  { id: 'ph', name: 'pH 值', unit: '', baseValue: 6.5, minValue: 3.5, maxValue: 9.0, step: 0.1, currentValue: 6.5 },
  { id: 'temperature', name: '温度', unit: '°C', baseValue: 25, minValue: 4, maxValue: 80, step: 1, currentValue: 25 },
  { id: 'concentration', name: '浓度', unit: '%', baseValue: 10, minValue: 1, maxValue: 50, step: 0.5, currentValue: 10 },
  { id: 'time', name: '时间', unit: 'min', baseValue: 30, minValue: 5, maxValue: 120, step: 5, currentValue: 30 },
]

const METRIC_LABELS: Record<keyof MetricResult, string> = {
  efficacy: '功效',
  stability: '稳定性',
  cost: '成本效益',
  safety: '安全性',
  sensory: '感官品质',
  overall: '综合评分',
}

const METRIC_COLORS: Record<keyof MetricResult, string> = {
  efficacy: 'var(--color-primary, #34C759)',
  stability: 'var(--color-secondary, #0A84FF)',
  cost: 'var(--color-warning, #FF9F0A)',
  safety: 'var(--color-error, #FF3B30)',
  sensory: 'var(--color-violet-500, #AF52DE)',
  overall: 'var(--color-pink-500, #D946EF)',
}

const SCENARIO_COLORS = ['var(--color-primary, #34C759)', 'var(--color-secondary, #0A84FF)', 'var(--color-warning, #FF9F0A)']

function calculateMockResults(parameters: Record<string, number>): MetricResult {
  const ph = parameters.ph || 6.5
  const temp = parameters.temperature || 25
  const conc = parameters.concentration || 10
  const time = parameters.time || 30

  const phEffect = Math.max(0, 100 - Math.abs(ph - 6.5) * 20)
  const tempEffect = temp <= 40 ? 90 - Math.abs(temp - 25) : Math.max(30, 70 - (temp - 40))
  const concEffect = Math.min(100, conc * 8)
  const timeEffect = Math.min(100, time * 2)

  return {
    efficacy: Math.round((phEffect * 0.3 + tempEffect * 0.25 + concEffect * 0.3 + timeEffect * 0.15) * 100) / 100,
    stability: Math.round((100 - Math.abs(ph - 7) * 15 - (temp > 50 ? (temp - 50) : 0)) * 100) / 100,
    cost: Math.round(Math.max(20, 100 - conc * 1.5) * 100) / 100,
    safety: Math.round((ph >= 4.5 && ph <= 8 ? 95 : 60) * 100) / 100,
    sensory: Math.round((80 + Math.sin(ph) * 10 + (temp < 35 ? 10 : -5)) * 100) / 100,
    overall: 0,
  }
}

calculateMockResults.overall = function(results: MetricResult): number {
  return Math.round(
    (results.efficacy * 0.3 +
      results.stability * 0.2 +
      results.cost * 0.15 +
      results.safety * 0.2 +
      results.sensory * 0.15) *
      100,
  ) / 100
}

export function SensitivityAnalysis({
  baseParameters = DEFAULT_PARAMETERS,
  onParameterChange,
  onScenarioApply,
  className = '',
}: SensitivityAnalysisProps) {
  const [parameters, setParameters] = useState<SensitivityParameter[]>(
    baseParameters.map(p => ({ ...p })),
  )
  const [activeParamId, setActiveParamId] = useState<string>(baseParameters[0]?.id || '')
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([
    { id: 'A', name: '基准场景', color: SCENARIO_COLORS[0], parameters: {}, results: null },
  ])
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0)
  const [showHeatmapDetail, setShowHeatmapDetail] = useState<{ param: string; metric: string } | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const currentParams = useMemo(
    () => Object.fromEntries(parameters.map(p => [p.id, p.currentValue])),
    [parameters],
  )

  const currentResults = useMemo(() => {
    const results = calculateMockResults(currentParams)
    results.overall = (calculateMockResults as any).overall(results)
    return results
  }, [currentParams])

  const baselineResults = useMemo(() => {
    const baseline = Object.fromEntries(baseParameters.map(p => [p.id, p.baseValue]))
    const results = calculateMockResults(baseline)
    results.overall = (calculateMockResults as any).overall(results)
    return results
  }, [baseParameters])

  const sensitivityData = useMemo(() => {
    const activeParam = parameters.find(p => p.id === activeParamId)
    if (!activeParam) return []

    const range = activeParam.baseValue * 0.2
    const minVal = Math.max(activeParam.minValue, activeParam.baseValue - range)
    const maxVal = Math.min(activeParam.maxValue, activeParam.baseValue + range)
    const steps = 20
    const stepSize = (maxVal - minVal) / steps

    const data = []
    for (let i = 0; i <= steps; i++) {
      const value = minVal + i * stepSize
      const testParams = { ...currentParams, [activeParam.id]: value }
      const results = calculateMockResults(testParams)
      results.overall = (calculateMockResults as any).overall(results)

      data.push({
        value: Number(value.toFixed(2)),
        ...results,
        isBaseline: Math.abs(value - activeParam.baseValue) < stepSize / 2,
      })
    }

    return data
  }, [parameters, activeParamId, currentParams])

  const heatmapData = useMemo(() => {
    return parameters.map(param => {
      const row: Record<string, any> = { parameter: param.name }

      ;(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).forEach(metric => {
        const highParams = { ...currentParams, [param.id]: param.baseValue * 1.2 }
        const lowParams = { ...currentParams, [param.id]: param.baseValue * 0.8 }

        const highResult = calculateMockResults(highParams)
        highResult.overall = (calculateMockResults as any).overall(highResult)
        const lowResult = calculateMockResults(lowParams)
        lowResult.overall = (calculateMockResults as any).overall(lowResult)

        const sensitivity = ((highResult[metric] - lowResult[metric]) / (param.baseValue * 0.4)) * 100
        row[metric] = Number(sensitivity.toFixed(2))
      })

      return row
    })
  }, [parameters, currentParams])

  const getHeatmapColor = useCallback((value: number): string => {
    if (Math.abs(value) < 0.5) return 'bg-neutral-200 dark:bg-neutral-700'
    if (value > 0) {
      const intensity = Math.min(1, value / 10)
      return `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`
    }
    const intensity = Math.min(1, Math.abs(value) / 10)
    return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`
  }, [])

  const handleParamChange = useCallback(
    (paramId: string, value: number) => {
      setParameters(prev =>
        prev.map(p => (p.id === paramId ? { ...p, currentValue: value } : p)),
      )

      if (debounceTimer) clearTimeout(debounceTimer)
      setDebounceTimer(
        setTimeout(() => {
          const newParams = Object.fromEntries(
            parameters.map(p => [p.id, p.id === paramId ? value : p.currentValue]),
          )
          onParameterChange?.(newParams)
        }, 200),
      )
    },
    [onParameterChange, parameters, debounceTimer],
  )

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [debounceTimer])

  const saveAsScenario = useCallback(
    (name: string) => {
      if (scenarios.length >= 3) return

      const newScenario: ScenarioConfig = {
        id: String.fromCharCode(65 + scenarios.length),
        name: name || `场景 ${String.fromCharCode(65 + scenarios.length)}`,
        color: SCENARIO_COLORS[scenarios.length],
        parameters: { ...currentParams },
        results: { ...currentResults },
      }

      setScenarios(prev => [...prev, newScenario])
      setActiveScenarioIndex(scenarios.length)
    },
    [scenarios.length, currentParams, currentResults],
  )

  const applyScenario = useCallback(
    (scenario: ScenarioConfig) => {
      setParameters(prev =>
        prev.map(p => ({
          ...p,
          currentValue: scenario.parameters[p.id] ?? p.currentValue,
        })),
      )
      onScenarioApply?.(scenario)
    },
    [onScenarioApply],
  )

  const resetToBaseline = useCallback(() => {
    setParameters(prev => prev.map(p => ({ ...p, currentValue: p.baseValue })))
  }, [])

  const getBestScenario = useCallback((): number => {
    let bestIdx = 0
    let bestScore = -1

    scenarios.forEach((scenario, idx) => {
      if (scenario.results && scenario.results.overall > bestScore) {
        bestScore = scenario.results.overall
        bestIdx = idx
      }
    })

    return bestIdx
  }, [scenarios])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-500" />
            What-if 敏感性分析
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            调整参数观察对配方指标的影响（±20% 变化范围）
          </p>
        </div>
        <button onClick={resetToBaseline} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
          <RotateCcw className="w-4 h-4" />
          重置基准
        </button>
      </div>

      {/* 单因素分析区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：参数滑动条组 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5"
        >
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">参数调整</h4>

          <div className="space-y-5">
            {parameters.map(param => {
              const deviation = ((param.currentValue - param.baseValue) / param.baseValue) * 100
              const isActive = param.id === activeParamId

              return (
                <div key={param.id} className={`space-y-2 rounded-xl p-3 transition-colors cursor-pointer ${isActive ? 'bg-accent-50 dark:bg-accent-900/20' : 'hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`} onClick={() => setActiveParamId(param.id)}>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{param.name}</label>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      Math.abs(deviation) < 1 ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600' :
                      deviation > 0 ? 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600' :
                      'bg-error-100 dark:bg-error-900/30 text-error-600'
                    }`}>
                      {param.currentValue}{param.unit}
                      {Math.abs(deviation) >= 1 && (
                        <span className="ml-1">
                          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={param.minValue}
                    max={param.maxValue}
                    step={param.step}
                    value={param.currentValue}
                    onChange={(e) => handleParamChange(param.id, Number(e.target.value))}
                    className={`w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500`}
                  />

                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>{param.minValue}{param.unit}</span>
                    <span className="font-medium text-accent-600">基准: {param.baseValue}{param.unit}</span>
                    <span>{param.maxValue}{param.unit}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 当前结果摘要 */}
          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">实时计算结果</h5>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).slice(0, 4).map(metric => {
                const diff = currentResults[metric] - baselineResults[metric]
                const Icon = diff > 0.5 ? TrendingUp : diff < -0.5 ? TrendingDown : Minus
                const color = diff > 0.5 ? 'text-success-600' : diff < -0.5 ? 'text-error-600' : 'text-neutral-600'

                return (
                  <div key={metric} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                    <span className="text-xs text-neutral-500">{METRIC_LABELS[metric]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {currentResults[metric]}
                      </span>
                      <Icon className={`w-3 h-3 ${color}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* 右侧：影响图表 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5"
        >
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
            参数影响曲线 - {parameters.find(p => p.id === activeParamId)?.name || ''}
          </h4>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sensitivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100, #F0F0F0)" />
                <XAxis
                  dataKey="value"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: `${parameters.find(p => p.id === activeParamId)?.name} (${parameters.find(p => p.id === activeParamId)?.unit})`,
                    position: 'insideBottomRight',
                    offset: -5,
                    fontSize: 11,
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid var(--color-slate-200, #E5E7EB)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />

                {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).slice(0, 5).map(metric => (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    stroke={METRIC_COLORS[metric]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}

                <ReferenceLine
                  x={parameters.find(p => p.id === activeParamId)?.baseValue}
                  stroke="var(--color-violet-500, #AF52DE)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: '基准', position: 'top', fontSize: 11 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 图例 */}
          <div className="flex flex-wrap justify-center gap-4 mt-3">
            {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).slice(0, 5).map(metric => (
              <div key={metric} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5" style={{ backgroundColor: METRIC_COLORS[metric] }} />
                <span className="text-xs text-neutral-500">{METRIC_LABELS[metric]}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 参数影响热力图 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5"
      >
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">参数影响热力图</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 px-3 text-left font-medium text-neutral-500">参数 \\ 指标</th>
                {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).map(metric => (
                  <th key={metric} className="py-2 px-3 text-center font-medium text-neutral-500">
                    {METRIC_LABELS[metric]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3 font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {row.parameter}
                  </td>
                  {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[]).map(metric => {
                    const value = row[metric] as number
                    return (
                      <td
                        key={metric}
                        className="py-2 px-3 text-center cursor-pointer hover:opacity-80 transition-opacity relative"
                        style={{ backgroundColor: getHeatmapColor(value) }}
                        onClick={() =>
                          setShowHeatmapDetail({ param: row.parameter, metric: METRIC_LABELS[metric] })
                        }
                      >
                        <span className={`font-mono text-xs ${Math.abs(value) >= 5 ? 'font-bold' : ''}`}>
                          {value > 0 ? '+' : ''}{value}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 热力图说明 */}
        <div className="mt-3 flex items-center justify-center gap-6 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-success-500/70 rounded" />
            <span>正向影响</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-neutral-300 dark:bg-neutral-600 rounded" />
            <span>无影响</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-error-500/70 rounded" />
            <span>负向影响</span>
          </div>
        </div>
      </motion.div>

      {/* 热力图详情弹窗 */}
      <AnimatePresence>
        {showHeatmapDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={() => setShowHeatmapDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <Info className="w-5 h-5 text-secondary-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-neutral-900 dark:text-white">
                    {showHeatmapDetail.param} → {showHeatmapDetail.metric}
                  </h4>
                  <p className="text-sm text-neutral-500 mt-1">
                    该参数的变化对目标指标的影响程度和方向
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <p>• 正值表示参数增加时，该指标上升</p>
                <p>• 负值表示参数增加时，该指标下降</p>
                <p>• 绝对值越大，敏感性越强</p>
                <p>• 建议关注绝对值 &gt; 5 的关键敏感点</p>
              </div>
              <button
                onClick={() => setShowHeatmapDetail(null)}
                className="mt-4 w-full py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                关闭
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 场景对比功能 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning-500" />
            场景对比（最多 3 个）
          </h4>
          {scenarios.length < 3 && (
            <button
              onClick={() => {
                const name = prompt('输入场景名称：')
                if (name) saveAsScenario(name)
              }}
              className="px-3 py-1.5 text-xs font-medium text-accent-600 bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded-lg transition-colors"
            >
              + 新增场景
            </button>
          )}
        </div>

        {scenarios.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">暂无对比场景</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((scenario, idx) => {
              const isBest = idx === getBestScenario()
              const isActive = idx === activeScenarioIndex

              return (
                <motion.div
                  key={scenario.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setActiveScenarioIndex(idx)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isActive
                      ? 'border-purple-500 shadow-lg'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  } ${isBest ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}
                >
                  {isBest && (
                    <div className="absolute -top-2 -right-2 bg-warning-400 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      推荐
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: scenario.color }}
                    />
                    <h5 className="font-semibold text-neutral-900 dark:text-white">{scenario.name}</h5>
                  </div>

                  {scenario.results ? (
                    <div className="space-y-2">
                      <div className="text-center pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                          {scenario.results.overall}
                        </span>
                        <span className="text-xs text-neutral-500 ml-1">分</span>
                      </div>

                      {(Object.keys(METRIC_LABELS) as (keyof MetricResult)[])
                        .filter(m => m !== 'overall')
                        .map(metric => (
                          <div key={metric} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-500">{METRIC_LABELS[metric]}</span>
                            <span className="font-medium text-neutral-900 dark:text-white">
                              {scenario.results?.[metric] || '-'}
                            </span>
                          </div>
                        ))}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          applyScenario(scenario)
                        }}
                        className="w-full mt-2 py-1.5 text-xs font-medium text-accent-600 bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        应用此场景
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-neutral-400 text-sm">
                      点击保存当前配置为场景
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* 场景对比柱状图 */}
        {scenarios.some(s => s.results) && (
          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(Object.keys(METRIC_LABELS) as (keyof MetricResult)[])
                  .filter(m => m !== 'overall')
                  .map(metric => {
                    const bar: any = { name: METRIC_LABELS[metric] }
                    scenarios.forEach(s => {
                      bar[s.name] = s.results?.[metric] || 0
                    })
                    return bar
                  })}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100, #F0F0F0)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {scenarios
                  .filter(s => s.results)
                  .map(scenario => (
                    <Bar
                      key={scenario.id}
                      dataKey={scenario.name}
                      fill={scenario.color}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default SensitivityAnalysis
