/**
 * formulaQuality.ts — 配方质量评估工具函数
 *
 * 独立于 React Hooks 的纯函数，可被多个模块复用。
 *
 * @version 1.0.0
 */

import type { AIRecognizedFormula, FormulaQualityScore } from '@/types/ai.types'

export function calculateQualityScore(formula: AIRecognizedFormula): FormulaQualityScore {
  if (!formula) {
    return {
      overallScore: 0, confidenceScore: 0, completenessScore: 0,
      diversityScore: 0, qualityGrade: 'F', recommendations: ['配方数据无效'],
    }
  }

  // 1. 置信度得分 (0-100)
  const confidenceScore = Math.round((formula.confidence || 0) * 100)

  // 2. 完整性得分 (0-100)
  let completenessScore = 0
  if (formula.name?.trim()) completenessScore += 15
  if (formula.ingredients && formula.ingredients.length > 0) completenessScore += 20
  if (formula.rawData && Object.keys(formula.rawData).length > 2) completenessScore += 15
  if (formula.sourceMessageId) completenessScore += 10
  if (formula.autoName) completenessScore += 10
  if (formula.tags && formula.tags.length > 0) completenessScore += 10
  if (formula.efficacy) completenessScore += 10
  if (formula.targetAudience && formula.targetAudience.length > 0) completenessScore += 10

  // 3. 成分多样性得分 (0-100)
  const ingredientCount = formula.ingredients?.length || 0
  const diversityScore = Math.round(Math.min(ingredientCount * 4 + (formula.tags?.length || 0) * 5, 100))

  // 4. 综合评分（加权平均）
  const overallScore = Math.round(
    confidenceScore * 0.3 +
    completenessScore * 0.35 +
    diversityScore * 0.35,
  )

  // 5. 质量等级评定
  let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F'
  if (overallScore >= 90) qualityGrade = 'A'
  else if (overallScore >= 75) qualityGrade = 'B'
  else if (overallScore >= 60) qualityGrade = 'C'
  else if (overallScore >= 40) qualityGrade = 'D'

  // 6. 改进建议
  const recommendations: string[] = []
  if (confidenceScore < 70) recommendations.push('建议提高识别置信度（当前: ' + confidenceScore + '）')
  if (ingredientCount < 3) recommendations.push('成分数量偏少（当前: ' + ingredientCount + '），建议补充完整')
  if (!formula.efficacy) recommendations.push('缺少功效描述，影响配方可理解性')
  if (!formula.tags || formula.tags.length === 0) recommendations.push('建议添加功效标签，便于分类检索')
  if (completenessScore < 50) recommendations.push('配方信息不完整，建议补充元数据')

  return {
    overallScore, confidenceScore, completenessScore,
    diversityScore, qualityGrade, recommendations,
  }
}
