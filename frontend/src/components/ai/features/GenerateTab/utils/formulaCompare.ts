/**
 * formulaCompare - 配方对比引擎（纯逻辑，无副作用，易单测）
 *
 * @description 对 2-N 个候选配方做并排对比：药材组成差异、共享药材剂量差异、
 *              安全评分、君臣佐使角色结构。供 FormulaComparePanel 消费。
 * @version 1.0.0
 */
import type { AICandidate } from '@/api/ai'

export interface HerbDose {
  name: string
  dosage_g: number
  role?: string
}

export interface FormulaSummary {
  id: string
  name: string
  /** 药味数 */
  herbCount: number
  /** 总剂量（克，按 dosage_g 求和，缺失按 0） */
  totalG: number
  /** 安全分（0-1，缺失 undefined） */
  safetyScore?: number
  /** 安全三态状态 */
  safetyStatus?: string
  /** 综合分 */
  overallScore?: number
  /** 君臣佐使结构：{ 君: 1, 臣: 2, ... } */
  roleStructure: Record<string, number>
  /** 药材剂量映射（归一化名 → 剂量） */
  herbMap: Map<string, HerbDose>
}

export interface ComparisonResult {
  formulas: FormulaSummary[]
  /** 所有配方出现过的药材（并集，排序） */
  allHerbs: string[]
  /** 每味药材在各配方中的剂量（缺失=undefined 表示该配方无此药材） */
  dosageMatrix: Array<{ herb: string; doses: Array<number | undefined> }>
  /** 仅在单个配方中出现的独有药材 */
  uniqueHerbs: Array<{ formulaIndex: number; herbs: string[] }>
  /** 共享药材（≥2 个配方都有）的剂量差异 */
  sharedHerbs: Array<{ herb: string; doses: Array<number>; maxDiffG: number }>
}

/** 从候选提取归一化药材剂量列表 */
function extractHerbs(candidate: AICandidate): HerbDose[] {
  const herbs = candidate.herb_combination || []
  return herbs.map((h) => {
    const name = (h.name_cn || h.name || '').trim()
    const dosageG =
      typeof h.dosage_g === 'number'
        ? h.dosage_g
        : typeof h.dosage === 'number'
          ? h.dosage
          : typeof h.dosage === 'string'
            ? parseFloat(h.dosage) || 0
            : 0
    return { name, dosage_g: dosageG, role: h.role }
  })
}

/** 汇总单个候选的结构信息 */
export function summarizeFormula(candidate: AICandidate): FormulaSummary {
  const herbs = extractHerbs(candidate)
  const herbMap = new Map<string, HerbDose>()
  const roleStructure: Record<string, number> = {}
  let totalG = 0

  for (const h of herbs) {
    if (!h.name) continue
    // 同名药材取首次（防御重复）
    if (!herbMap.has(h.name)) herbMap.set(h.name, h)
    totalG += h.dosage_g
    const role = (h.role || '未标注').trim()
    roleStructure[role] = (roleStructure[role] || 0) + 1
  }

  return {
    id: candidate.id,
    name: candidate.name || candidate.formula_name || '未命名配方',
    herbCount: herbMap.size,
    totalG: Math.round(totalG * 10) / 10,
    safetyScore: typeof candidate.safety_score === 'number' ? candidate.safety_score : undefined,
    safetyStatus: candidate.safety_verdict?.status,
    overallScore: candidate.overall_score,
    roleStructure,
    herbMap,
  }
}

/** 构建多个配方的对比结果 */
export function buildFormulaComparison(candidates: AICandidate[]): ComparisonResult {
  const formulas = candidates.map(summarizeFormula)
  const n = formulas.length

  // 药材并集
  const herbSet = new Set<string>()
  for (const f of formulas) {
    for (const herb of f.herbMap.keys()) herbSet.add(herb)
  }
  const allHerbs = Array.from(herbSet).sort((a, b) => a.localeCompare(b, 'zh'))

  // 剂量矩阵（行=药材，列=配方）
  const dosageMatrix = allHerbs.map((herb) => ({
    herb,
    doses: formulas.map((f) => f.herbMap.get(herb)?.dosage_g),
  }))

  // 独有药材（仅 1 个配方有）
  const uniqueHerbs: Array<{ formulaIndex: number; herbs: string[] }> = []
  for (let i = 0; i < n; i++) {
    const unique = allHerbs.filter((herb) => {
      const present = formulas.filter((f) => f.herbMap.has(herb)).length
      return present === 1 && formulas[i].herbMap.has(herb)
    })
    if (unique.length > 0) uniqueHerbs.push({ formulaIndex: i, herbs: unique })
  }

  // 共享药材（≥2 配方都有）+ 剂量极差
  const sharedHerbs: Array<{ herb: string; doses: Array<number>; maxDiffG: number }> = []
  for (const herb of allHerbs) {
    const present = formulas.filter((f) => f.herbMap.has(herb))
    if (present.length >= 2) {
      const doses = present.map((f) => f.herbMap.get(herb)!.dosage_g)
      const maxDiffG = Math.round((Math.max(...doses) - Math.min(...doses)) * 10) / 10
      sharedHerbs.push({ herb, doses, maxDiffG })
    }
  }
  sharedHerbs.sort((a, b) => b.maxDiffG - a.maxDiffG)

  return { formulas, allHerbs, dosageMatrix, uniqueHerbs, sharedHerbs }
}
