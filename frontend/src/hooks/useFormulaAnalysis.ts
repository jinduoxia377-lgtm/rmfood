/**
 * 配方分析Hook
 * 用于实时分析配方内容并获取AI评分
 */
import { useState, useCallback, useRef } from 'react'
import { aiApi } from '@/api/ai'
import { parseFormulaTable } from '@/utils/formulaParser'
import type { AICandidate, SafetyCheckResult, SynergyResult } from '@/types'
import type { StabilityPredictionResponse } from '@/types/ai.api'
import { logger } from '@/utils/safeLogger';


export interface FormulaAnalysisResult {
  candidate: AICandidate | null
  isLoading: boolean
  progress: number
  error: string | null
}

export interface AnalysisProgress {
  stage: 'idle' | 'parsing' | 'safety' | 'synergy' | 'taste' | 'stability' | 'complete' | 'error'
  message: string
  percent: number
}

export function useFormulaAnalysis() {
  const [result, setResult] = useState<FormulaAnalysisResult>({
    candidate: null,
    isLoading: false,
    progress: 0,
    error: null,
  })

  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    message: '',
    percent: 0,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const updateProgress = useCallback((stage: AnalysisProgress['stage'], message: string, percent: number) => {
    setProgress({ stage, message, percent })
    setResult(prev => ({ ...prev, progress: percent }))
  }, [])

  const analyzeFormula = useCallback(async (content: string): Promise<AICandidate | null> => {
    // 验证输入
    if (!content || content.trim().length === 0) {
      setResult({
        candidate: null,
        isLoading: false,
        progress: 0,
        error: '配方内容不能为空',
      })
      return null
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setResult({ candidate: null, isLoading: true, progress: 0, error: null })

    try {
      // 1. 解析配方内容
      updateProgress('parsing', '正在解析配方内容...', 10)
      const parsedFormula = parseFormulaTable(content)

      if (!parsedFormula || parsedFormula.ingredients.length === 0) {
        throw new Error('未能解析到配方成分，请确保包含有效的成分和用量信息')
      }

      // P1-5：任一分析接口失败时置 degraded=true，相关评分保持缺失（不伪造默认分），
      // 由 UI 明示「部分评估暂不可用」。移除历史 setTimeout(300) 人为延时。
      let degraded = false

      // 2. 安全检查
      updateProgress('safety', '正在进行安全性检查...', 25)
      const ingredientNames = parsedFormula.ingredients.map(i => i.name)
      let safetyResult: SafetyCheckResult | null = null
      try {
        safetyResult = await aiApi.safetyCheck(ingredientNames)
      } catch (error) {
        degraded = true
        logger.warn('安全检查API调用失败，安全评估暂不可用:', error)
      }

      // 3. 协同作用分析
      updateProgress('synergy', '正在分析成分协同作用...', 45)
      let synergyResult: SynergyResult | null = null
      try {
        synergyResult = await aiApi.synergyAnalysis(ingredientNames)
      } catch (error) {
        degraded = true
        logger.warn('协同分析API调用失败，协同评分暂不可用:', error)
      }

      // 4. 口感预测
      updateProgress('taste', '正在评估口感风味...', 65)
      let tasteResult: { sweetness: number; bitterness: number; astringency: number; overall_score: number; flavor_notes: string[] } | null = null
      try {
        tasteResult = await aiApi.tastePredict(
          parsedFormula.ingredients.map(i => ({ name: i.name })),
        )
      } catch (error) {
        degraded = true
        logger.warn('口感预测API调用失败，口感评分暂不可用:', error)
      }

      // 5. 稳定性预测
      updateProgress('stability', '正在评估稳定性...', 85)
      let stabilityResult: StabilityPredictionResponse | null = null
      try {
        stabilityResult = await aiApi.stabilityPredict(
          parsedFormula.ingredients.map(i => ({ name: i.name })),
        )
      } catch (error) {
        degraded = true
        logger.warn('稳定性预测API调用失败，稳定性评分暂不可用:', error)
      }

      // 6. 计算综合评分（仅基于真实返回的评分；全部缺失时保持 undefined）
      updateProgress('complete', '分析完成！', 100)

      const overallScore = calculateOverallScore({
        synergy: synergyResult?.score ?? synergyResult?.synergyScore,
        taste: tasteResult?.overall_score,
        stability: stabilityResult?.stability_score,
        // 安全检查失败时 safety 保持 undefined（不伪造 0.6/0.85 默认分）
        safety: safetyResult == null ? undefined : (safetyResult.passed ? 0.85 : 0.6),
      })

      // 构建AICandidate结果
      const candidate: AICandidate = {
        id: `manual_formula_${Date.now()}`,
        name: parsedFormula.name || '手动输入配方',
        effects: [],
        formula_name: parsedFormula.name || '手动输入配方',
        herb_combination: parsedFormula.ingredients.map(i => ({
          name: i.name,
          role: i.efficacyTags?.[0] || '主成分',
          dosage: `${i.amount}${i.unit}`,
        })),
        peptide_candidates: [],
        synergy_score: synergyResult?.score ?? synergyResult?.synergyScore,
        safety_passed: safetyResult?.passed,
        safety_details: safetyResult
          ? {
              warnings: (safetyResult.warnings || []).map(w => w.message || String(w)),
              contraindications: parsedFormula.ingredients
                .flatMap(i => i.precautions?.map(p => p.content) || [])
                .filter(Boolean),
              summary: safetyResult.summary || '安全检查完成',
            }
          : undefined,
        taste_score: tasteResult?.overall_score,
        stability_score: stabilityResult?.stability_score,
        overall_score: overallScore,
        degraded,
        description: `基于${parsedFormula.ingredients.length}种成分配制的配方`,
        target_population: '一般人群',
        contraindications: parsedFormula.ingredients
          .flatMap(i => i.precautions?.filter(p => p.type === 'contraindication').map(p => p.content) || [])
          .join('、') || '无特殊禁忌',
        generated_at: new Date().toISOString(),
      }

      setResult({
        candidate,
        isLoading: false,
        progress: 100,
        error: null,
      })

      return candidate
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '配方分析失败'
      updateProgress('error', errorMessage, 0)
      setResult({
        candidate: null,
        isLoading: false,
        progress: 0,
        error: errorMessage,
      })
      return null
    }
  }, [updateProgress])

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setResult({
      candidate: null,
      isLoading: false,
      progress: 0,
      error: null,
    })
    setProgress({
      stage: 'idle',
      message: '',
      percent: 0,
    })
  }, [])

  const resetResult = useCallback(() => {
    setResult({
      candidate: null,
      isLoading: false,
      progress: 0,
      error: null,
    })
    setProgress({
      stage: 'idle',
      message: '',
      percent: 0,
    })
  }, [])

  return {
    result,
    progress,
    analyzeFormula,
    cancelAnalysis,
    resetResult,
  }
}

/**
 * 计算综合评分（仅基于真实可用评分；任一维度缺失时按剩余维度加权平均，
 * 全部缺失时返回 undefined —— 不伪造分数）。
 */
function calculateOverallScore(scores: {
  synergy?: number
  taste?: number
  stability?: number
  safety?: number
}): number | undefined {
  const weights = {
    synergy: 0.35,
    taste: 0.25,
    stability: 0.25,
    safety: 0.15,
  }

  let total = 0
  let weightSum = 0

  if (scores.synergy != null && Number.isFinite(scores.synergy)) {
    total += scores.synergy * weights.synergy
    weightSum += weights.synergy
  }
  if (scores.taste != null && Number.isFinite(scores.taste)) {
    total += scores.taste * weights.taste
    weightSum += weights.taste
  }
  if (scores.stability != null && Number.isFinite(scores.stability)) {
    total += scores.stability * weights.stability
    weightSum += weights.stability
  }
  if (scores.safety != null && Number.isFinite(scores.safety)) {
    total += scores.safety * weights.safety
    weightSum += weights.safety
  }

  if (weightSum === 0) return undefined

  return Math.round((total / weightSum) * 100) / 100
}
