/**
 * RecommendationPanel - 推荐参数调节面板 (v1.0)
 *
 * 提供算法选择、权重调节、推荐结果实时预览等功能。
 * 用于协同作用分析的参数调优和结果解释。
 *
 * 功能特性：
 * - 算法选择下拉框（至少 3 种算法）
 * - 权重滑块实时更新推荐结果（debounce 200ms）
 * - 推荐解释文本生成
 * - 参数预设保存/加载
 * - 响应式设计 + Dark Mode 支持
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Sliders,
  Sparkles,
  RefreshCw,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Target,
  Scale,
  Lightbulb,
} from 'lucide-react'
import { Button, Badge, Tooltip } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface AlgorithmOption {
  id: string
  name: string
  description: string
  icon?: React.ReactNode
  parameters?: AlgorithmParameter[]
}

export interface AlgorithmParameter {
  id: string
  name: string
  label: string
  type: 'slider' | 'toggle' | 'select'
  min?: number
  max?: number
  step?: number
  default: number | boolean | string
  options?: { value: string; label: string }[]
  unit?: string
  description?: string
}

export interface RecommendationResult {
  id: string
  score: number
  confidence: number
  explanation: string
  data: Record<string, unknown>
  timestamp: number
}

interface RecommendationPanelProps {
  algorithms: AlgorithmOption[]
  onRecommendationChange?: (result: RecommendationResult) => void
  onParameterChange?: (algorithmId: string, params: Record<string, unknown>) => void
  defaultAlgorithmId?: string
  showPresets?: boolean
  className?: string
}

// ===== 常量配置 =====

const DEBOUNCE_MS = 200

// ===== 主组件实现 =====

function RecommendationPanel({
  algorithms,
  onRecommendationChange,
  onParameterChange,
  defaultAlgorithmId,
  showPresets = true,
  className = '',
}: RecommendationPanelProps) {
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState(
    defaultAlgorithmId || algorithms[0]?.id || '',
  )
  const [parameters, setParameters] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [presets, setPresets] = useState<{
    name: string
    algorithmId: string
    parameters: Record<string, unknown>
  }[]>([])

  const selectedAlgorithm = useMemo(
    () => algorithms.find(a => a.id === selectedAlgorithmId),
    [algorithms, selectedAlgorithmId],
  )

  /**
   * 初始化默认参数
   */
  useEffect(() => {
    if (selectedAlgorithm?.parameters) {
      const defaults: Record<string, unknown> = {}
      selectedAlgorithm.parameters.forEach(param => {
        defaults[param.id] = param.default
      })
      setParameters(defaults)
    }
  }, [selectedAlgorithm])

  /**
   * 参数变更处理（带 debounce）
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateRecommendation()
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [parameters, selectedAlgorithmId])

  /**
   * 计算推荐结果（模拟）
   */
  const calculateRecommendation = useCallback(async () => {
    if (!selectedAlgorithm) return

    setIsCalculating(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 150))

      const score = Math.random() * 40 + 60
      const confidence = Math.random() * 20 + 80

      const explanation = generateExplanation(selectedAlgorithm.name, parameters, score)

      const newResult: RecommendationResult = {
        id: `rec_${Date.now()}`,
        score,
        confidence,
        explanation,
        data: {
          algorithm: selectedAlgorithm.name,
          parameters: { ...parameters },
          metrics: {
            precision: (Math.random() * 10 + 90).toFixed(1),
            recall: (Math.random() * 10 + 85).toFixed(1),
            f1Score: ((score + confidence) / 2).toFixed(1),
          },
        },
        timestamp: Date.now(),
      }

      setResult(newResult)
      onRecommendationChange?.(newResult)
      logger.info(`[RecommendationPanel] 推荐计算完成: score=${score.toFixed(1)}, algorithm=${selectedAlgorithm.name}`)
    } catch (error) {
      logger.error('[RecommendationPanel] 推荐计算失败:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [selectedAlgorithm, parameters, onRecommendationChange])

  /**
   * 生成推荐解释文本
   */
  const generateExplanation = useCallback((
    algorithmName: string,
    params: Record<string, unknown>,
    score: number,
  ): string => {
    const paramEntries = Object.entries(params)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `${k}=${Number(v).toFixed(2)}`)

    const templates = [
      `基于 ${algorithmName} 算法分析，当前参数组合 (${paramEntries.join(', ')}) 的综合评分为 ${score.toFixed(1)} 分。`,
      `通过调整关键参数权重，系统识别出最优协同作用模式。当前配置在${score >= 80 ? '高效' : score >= 60 ? '中等' : '待优化'}区间运行。`,
      `算法 ${algorithmName} 根据多维特征空间映射，给出置信度 ${(score * 0.9 + 10).toFixed(1)}% 的推荐方案。`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }, [])

  /**
   * 参数值更新
   */
  const handleParameterChange = useCallback((paramId: string, value: unknown) => {
    setParameters(prev => ({ ...prev, [paramId]: value }))
    onParameterChange?.(selectedAlgorithmId, { ...parameters, [paramId]: value })
  }, [selectedAlgorithmId, parameters, onParameterChange])

  /**
   * 保存预设
   */
  const handleSavePreset = useCallback(() => {
    const presetName = prompt('请输入预设名称：')
    if (!presetName) return

    const newPreset = {
      name: presetName,
      algorithmId: selectedAlgorithmId,
      parameters: { ...parameters },
    }

    setPresets(prev => [...prev, newPreset])
    logger.info(`[RecommendationPanel] 预设已保存: ${presetName}`)
  }, [selectedAlgorithmId, parameters])

  /**
   * 加载预设
   */
  const handleLoadPreset = useCallback((preset: typeof presets[0]) => {
    setSelectedAlgorithmId(preset.algorithmId)
    setParameters(preset.parameters)
    logger.info(`[RecommendationPanel] 预设已加载: ${preset.name}`)
  }, [])

  /**
   * 重置为默认参数
   */
  const handleReset = useCallback(() => {
    if (selectedAlgorithm?.parameters) {
      const defaults: Record<string, unknown> = {}
      selectedAlgorithm.parameters.forEach(param => {
        defaults[param.id] = param.default
      })
      setParameters(defaults)
    }
  }, [selectedAlgorithm])

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden ${className}`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-700/50 transition-colors"
         role="button" tabIndex={0} onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-300/25 rounded-lg">
            <Sliders className="w-5 h-5 text-primary-700 dark:text-primary-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              推荐参数调节
            </h3>
            {selectedAlgorithm && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                当前算法: {selectedAlgorithm.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result && (
            <Badge variant={result.score >= 80 ? 'success' : result.score >= 60 ? 'warning' : 'danger'}>
              {result.score.toFixed(1)} 分
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              选择算法
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {algorithms.map(algo => (
                <button
                  key={algo.id}
                  onClick={() => setSelectedAlgorithmId(algo.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedAlgorithmId === algo.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-300/20 ring-2 ring-primary-500/20'
                      : 'border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {algo.icon || <Zap className="w-4 h-4 text-primary-500" />}
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {algo.name}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {algo.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {selectedAlgorithm?.parameters && selectedAlgorithm.parameters.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                参数设置
              </label>
              {selectedAlgorithm.parameters.map(param => (
                <div key={param.id} className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {param.label}
                    </span>
                    {param.description && (
                      <Tooltip content={param.description}>
                        <Info className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                      </Tooltip>
                    )}
                  </div>

                  {param.type === 'slider' && (
                    <div className="space-y-1">
                      <input
                        type="range"
                        min={param.min ?? 0}
                        max={param.max ?? 100}
                        step={param.step ?? 1}
                        value={(parameters[param.id] as number) ?? param.default}
                        onChange={e => handleParameterChange(param.id, Number(e.target.value))}
                        className="w-full h-2 bg-neutral-200 dark:bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-primary-600" aria-label="滑块" />
                      <div className="flex justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        <span>{param.min ?? 0}{param.unit || ''}</span>
                        <span className="font-medium text-primary-700 dark:text-primary-700">
                          {(parameters[param.id] as number)?.toFixed(2) || param.default}{param.unit || ''}
                        </span>
                        <span>{param.max ?? 100}{param.unit || ''}</span>
                      </div>
                    </div>
                  )}

                  {param.type === 'toggle' && (
                    <button
                      onClick={() => handleParameterChange(param.id, !(parameters[param.id] as boolean))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        parameters[param.id] ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-900 transition-transform ${
                          parameters[param.id] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}

                  {param.type === 'select' && (
                    <select
                      value={(parameters[param.id] as string) ?? String(param.default)}
                      onChange={e => handleParameterChange(param.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    >
                      {param.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {result && (
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-warning-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      AI 推荐
                    </span>
                    <Badge variant={result.score >= 80 ? 'success' : result.score >= 60 ? 'warning' : 'danger'}>
                      置信度: {result.confidence.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex gap-2">
              {showPresets && (
                <React.Fragment>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Save className="w-4 h-4" />}
                    onClick={handleSavePreset}
                  >
                    保存预设
                  </Button>
                  {presets.length > 0 && (
                    <div className="relative group">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<FolderOpen className="w-4 h-4" />}
                      >
                        加载预设 ({presets.length})
                      </Button>
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        {presets.map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleLoadPreset(preset)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />}
              onClick={handleReset}
              disabled={isCalculating}
            >
              重置
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { RecommendationPanel }
export default RecommendationPanel
