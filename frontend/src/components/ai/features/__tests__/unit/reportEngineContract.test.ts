/**
 * reportEngine 契约测试
 *
 * 锚定一次严重回归：reportEngine.ts 产出的 section.content key 曾与渲染组件
 * ProfessionalReport.tsx 读取的 key 完全错配，导致 7 章报告里 5 章
 * （执行摘要/配方详情/成分分析/协同评估/建议）渲染空白或假数据
 * （推荐指数恒显组件兜底的 85%、配方详情/协同评估落入空态、成分分析整节空白）。
 *
 * 本测试断言：引擎为每个 section 产出的 content，包含对应 render 函数实际读取的
 * 必需 key（真实值而非 undefined）。修改任一侧 key 时此测试会失败，防止再断裂。
 */
import { describe, it, expect } from 'vitest'
import {
  generateSingleFormulaReport,
  generateComprehensiveReport,
} from '../../utils/reportEngine'
import type { AIRecognizedFormula, ReportSection } from '@/types/ai.types'

/** 构造一个字段齐全的样例配方 */
function makeFormula(overrides: Partial<AIRecognizedFormula> = {}): AIRecognizedFormula {
  return {
    id: 'formula-001',
    name: '气血双补配方',
    autoName: '气血双补配方',
    ingredientCount: 3,
    confidence: 0.85,
    sourceMessageId: 'msg-001',
    parsedAt: new Date('2026-05-20'),
    rawData: { title: '气血双补配方', ingredients: [], totalAmount: 100, confidence: 0.85 },
    ingredients: [
      { name: '人参', dosage: '10', unit: 'g', efficacy: '补气' },
      { name: '黄芪', dosage: '15', unit: 'g', efficacy: '补气' },
      { name: '当归', dosage: '8', unit: 'g', efficacy: '补血', notes: '孕妇慎用' },
    ],
    qualityGrade: 'A',
    tags: ['补气', '补血'],
    efficacy: '适用于气血两虚的人群',
    targetAudience: ['气血两虚者'],
    recommendedDosage: '每日2次',
    contraindications: '孕妇慎用',
    isFavorite: false,
    ...overrides,
  } as AIRecognizedFormula
}

/** 按 type 取 section */
function getSection(sections: ReportSection[], type: string): ReportSection {
  const s = sections.find((x) => x.type === type)
  expect(s, `缺少 ${type} 章节`).toBeDefined()
  return s!
}

describe('reportEngine 产出 content 与 ProfessionalReport 读取 key 的契约', () => {
  const report = generateSingleFormulaReport(makeFormula())

  it('执行摘要：含 formulaName/keyFindings/recommendationScore/ingredientCount/sources/totalDosage/summary', () => {
    const c = getSection(report.sections, 'executive-summary').content ?? {}
    expect(typeof c.formulaName).toBe('string')
    expect(c.formulaName).toBe('气血双补配方')
    expect(Array.isArray(c.keyFindings)).toBe(true)
    expect(c.keyFindings.length).toBeGreaterThan(0)
    // 关键：recommendationScore 必须是真实置信度换算，而非组件兜底的 85
    expect(typeof c.recommendationScore).toBe('number')
    expect(c.recommendationScore).toBe(85) // confidence 0.85 -> 85
    expect(c.ingredientCount).toBe(3)
    expect(Array.isArray(c.sources)).toBe(true)
    expect(typeof c.totalDosage).toBe('number')
    expect(typeof c.summary).toBe('string')
    expect(c.summary.length).toBeGreaterThan(0)
  })

  it('配方详情：含 formulaData(FormulaTableData) 与 statistics，供 FormulaTable 渲染', () => {
    const c = getSection(report.sections, 'formula-details').content ?? {}
    const fd = c.formulaData
    expect(fd, 'formulaData 缺失会让组件落入 noFormulaData 空态').toBeDefined()
    expect(fd.title).toBe('气血双补配方')
    expect(Array.isArray(fd.ingredients)).toBe(true)
    expect(fd.ingredients.length).toBe(3)
    // FormulaTableData.ingredient.source 必填（IngredientSource）
    fd.ingredients.forEach((ing: { name: string; source?: unknown }) => {
      expect(ing.source, `成分 ${ing.name} 缺 source`).toBeDefined()
    })
    expect(typeof fd.totalAmount).toBe('number')
    expect(c.statistics && typeof c.statistics === 'object').toBe(true)
  })

  it('成分分析：含 ingredients 数组（组件按 name/amount/unit 渲染 details）', () => {
    const c = getSection(report.sections, 'ingredient-analysis').content ?? {}
    expect(Array.isArray(c.ingredients)).toBe(true)
    expect(c.ingredients.length).toBe(3)
    c.ingredients.forEach((ing: { name?: string }) => {
      expect(typeof ing.name).toBe('string')
    })
  })

  it('协同评估：含 radarData(非空数组，6 维齐全) + mechanismDescription + warnings，避免空态', () => {
    const c = getSection(report.sections, 'synergy-assessment').content ?? {}
    expect(Array.isArray(c.radarData), 'radarData 缺失会让组件落入 noSynergyData 空态').toBe(true)
    expect(c.radarData.length).toBeGreaterThan(0)
    const series = c.radarData[0]
    expect(Array.isArray(series.scores)).toBe(true)
    expect(series.scores.length).toBe(6) // 6 个协同维度齐全，否则雷达图不渲染
    expect(typeof c.mechanismDescription).toBe('string')
    expect(Array.isArray(c.warnings)).toBe(true)
  })

  it('建议：含 targetAudience/usageInstructions/precautions，避免整节空白', () => {
    const c = getSection(report.sections, 'recommendations').content ?? {}
    expect(Array.isArray(c.targetAudience)).toBe(true)
    expect(c.targetAudience.length).toBeGreaterThan(0)
    expect(Array.isArray(c.usageInstructions)).toBe(true)
    expect(c.usageInstructions.length).toBeGreaterThan(0)
    expect(Array.isArray(c.precautions)).toBe(true)
  })

  it('附录：含 references/dataSource，避免整节空白', () => {
    const c = getSection(report.sections, 'appendix').content ?? {}
    expect(Array.isArray(c.references)).toBe(true)
    expect(c.references.length).toBeGreaterThan(0)
    expect(typeof c.dataSource).toBe('string')
  })

  it('generateComprehensiveReport 不原地变异入参 formulas 数组', () => {
    const formulas = [makeFormula({ id: 'f2', name: 'B', confidence: 0.6 }), makeFormula({ id: 'f1', name: 'A', confidence: 0.9 })]
    const original = formulas.map((f) => f.id)
    generateComprehensiveReport(formulas)
    // 修复前 formulas.sort() 会原地重排调用方数组
    expect(formulas.map((f) => f.id)).toEqual(original)
  })
})
