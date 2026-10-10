/**
 * usePromptOptimizer - AI提示词优化系统集成Hook
 *
 * 核心功能：
 * ✅ 多维度专业分析（意图识别、完整性、清晰度、专业性）
 * ✅ 量化评估指标体系（6维度评分，A+到F等级）
 * ✅ 智能优化引擎（4种可配置策略）
 * ✅ AI大模型增强（可选，通过后端API）
 * ✅ 前后质量对比（量化改进幅度）
 * ✅ 实时状态管理（加载中、完成、错误）
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-29
 */

import { useState, useCallback, useRef } from 'react'
import { logger } from '@/utils/safeLogger'
import {
  PromptOptimizer,
  type PromptOptimizerConfig,
  type OptimizationResult,
  type PromptAnalysisResult,
  type OptimizationStrategy,
} from '../services/promptOptimizer'

let optimizerInstance: PromptOptimizer | null = null

function getOptimizer(config?: PromptOptimizerConfig): PromptOptimizer {
  if (!optimizerInstance || config) {
    optimizerInstance = new PromptOptimizer(config)
  }
  return optimizerInstance
}

export interface UsePromptOptimizerReturn {
  // ===== 状态 =====
  isAnalyzing: boolean
  isOptimizing: boolean
  analysis: PromptAnalysisResult | null
  result: OptimizationResult | null
  error: string | null

  // ===== 核心操作 =====
  analyze: (prompt: string) => Promise<PromptAnalysisResult | null>
  optimize: (prompt: string, config?: Partial<PromptOptimizerConfig>) => Promise<OptimizationResult | null>
  reset: () => void

  // ===== 策略控制 =====
  strategy: OptimizationStrategy
  setStrategy: (strategy: OptimizationStrategy) => void
  enableAIEnhancement: boolean
  toggleAIEnhancement: () => void

  // ===== 快捷方法 =====
  getGradeColor: (grade: string) => string
  getScoreLabel: (score: number) => string
  formatDelta: (delta: number) => string
}

export function usePromptOptimizer(initialConfig?: Partial<PromptOptimizerConfig>): UsePromptOptimizerReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [analysis, setAnalysis] = useState<PromptAnalysisResult | null>(null)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<OptimizationStrategy>(
    initialConfig?.strategy || 'balanced',
  )
  const [enableAIEnhancement, setEnableAIEnhancement] = useState(
    initialConfig?.enableAIEnhancement ?? true,
  )

  const configRef = useRef<PromptOptimizerConfig>({
    ...initialConfig,
    strategy,
    enableAIEnhancement,
  })

  const analyze = useCallback(async (prompt: string): Promise<PromptAnalysisResult | null> => {
    if (!prompt.trim()) {
      setError('提示词不能为空')
      return null
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const optimizer = getOptimizer(configRef.current)
      const analysisResult = await optimizer.analyzeOnly(prompt)

      setAnalysis(analysisResult)
      logger.info('[usePromptOptimizer] 分析完成:', {
        score: analysisResult.evaluation.overallScore,
        grade: analysisResult.evaluation.grade,
        issues: analysisResult.issues.length,
      })

      return analysisResult

    } catch (err) {
      const message = err instanceof Error ? err.message : '分析过程出错'
      setError(message)
      logger.error('[usePromptOptimizer] 分析失败:', err)
      return null

    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const optimize = useCallback(
    async (
      prompt: string,
      overrideConfig?: Partial<PromptOptimizerConfig>,
    ): Promise<OptimizationResult | null> => {
      if (!prompt.trim()) {
        setError('提示词不能为空')
        return null
      }

      setIsOptimizing(true)
      setError(null)

      const finalConfig: PromptOptimizerConfig = {
        ...configRef.current,
        strategy: overrideConfig?.strategy || strategy,
        enableAIEnhancement:
          overrideConfig?.enableAIEnhancement ?? enableAIEnhancement,
        ...overrideConfig,
      }

      try {
        const optimizer = new PromptOptimizer(finalConfig)
        const optimizationResult = await optimizer.optimize(prompt)

        setResult(optimizationResult)
        setAnalysis({
          originalPrompt: prompt,
          intent: optimizationResult.evaluationBefore.dimensions[0]?.issues.length
            ? { primary: 'unknown', confidence: 0, domain: '', actionVerbs: [] }
            : { primary: 'FORMULA_DESIGN', confidence: 0.8, domain: '配方设计', actionVerbs: ['设计'] },
          contextGap: { missingInformation: [], domainKnowledge: [], relevantStandards: [] },
          evaluation: optimizationResult.evaluationBefore,
          issues: [],
          wordCount: prompt.length,
          complexityLevel: 'moderate',
          domainRelevance: 0.8,
        })

        logger.info('[usePromptOptimizer] 优化完成:', {
          qualityDelta: optimizationResult.qualityDelta.overall,
          timeMs: optimizationResult.metadata.processingTimeMs.toFixed(0),
          strategies: optimizationResult.appliedStrategies,
        })

        return optimizationResult

      } catch (err) {
        const message = err instanceof Error ? err.message : '优化过程出错'
        setError(message)
        logger.error('[usePromptOptimizer] 优化失败:', err)
        return null

      } finally {
        setIsOptimizing(false)
      }
    },
    [strategy, enableAIEnhancement],
  )

  const reset = useCallback(() => {
    setAnalysis(null)
    setResult(null)
    setError(null)
  }, [])

  const toggleAIEnhancement = useCallback(() => {
    setEnableAIEnhancement(prev => !prev)
  }, [])

  const getGradeColor = useCallback((grade: string): string => {
    const colors: Record<string, string> = {
      'A+': 'text-primary-700 bg-primary-50 border-success-200',
      'A': 'text-success-600 bg-success-50 border-success-200',
      'B+': 'text-secondary-600 bg-secondary-50 border-secondary-200',
      'B': 'text-info-600 bg-info-50 border-info-200',
      'C': 'text-warning-600 bg-warning-50 border-warning-200',
      'D': 'text-warning-600 bg-warning-50 border-warning-200',
      'F': 'text-error-600 bg-error-50 border-error-200',
    }
    return colors[grade] || colors.C || 'text-warning-600 bg-warning-50 border-warning-200'
  }, [])

  const getScoreLabel = useCallback((score: number): string => {
    if (score >= 95) return '卓越'
    if (score >= 88) return '优秀'
    if (score >= 78) return '良好'
    if (score >= 68) return '中等'
    if (score >= 55) return '及格'
    return '需改进'
  }, [])

  const formatDelta = useCallback((delta: number): string => {
    const prefix = delta > 0 ? '+' : ''
    return `${prefix}${delta.toFixed(1)}`
  }, [])

  return {
    isAnalyzing,
    isOptimizing,
    analysis,
    result,
    error,

    analyze,
    optimize,
    reset,

    strategy,
    setStrategy,
    enableAIEnhancement,
    toggleAIEnhancement,

    getGradeColor,
    getScoreLabel,
    formatDelta,
  }
}

export default usePromptOptimizer
