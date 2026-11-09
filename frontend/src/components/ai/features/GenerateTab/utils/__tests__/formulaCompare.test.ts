/**
 * formulaCompare 单元测试 - 配方对比引擎
 */
import type { AICandidate } from '@/api/ai'
import { summarizeFormula, buildFormulaComparison } from '../formulaCompare'

function makeCandidate(overrides: Partial<AICandidate> & { id: string; name: string }): AICandidate {
  return {
    id: overrides.id,
    name: overrides.name,
    effects: [],
    herb_combination: overrides.herb_combination,
    safety_score: overrides.safety_score,
    safety_verdict: overrides.safety_verdict,
    overall_score: overrides.overall_score,
  } as AICandidate
}

describe('summarizeFormula', () => {
  it('提取药材数、总剂量、角色结构、安全分', () => {
    const c = makeCandidate({
      id: 'a',
      name: '配方A',
      overall_score: 0.9,
      safety_score: 0.95,
      safety_verdict: { status: 'passed', label: '安全合规' } as any,
      herb_combination: [
        { name: '黄芪', dosage: '10g', dosage_g: 10, role: '君' },
        { name: '党参', dosage: '8g', dosage_g: 8, role: '臣' },
        { name: '茯苓', dosage: '6g', dosage_g: 6, role: '臣' },
        { name: '甘草', dosage: '3g', dosage_g: 3, role: '使' },
      ],
    })
    const s = summarizeFormula(c)
    expect(s.herbCount).toBe(4)
    expect(s.totalG).toBe(27)
    expect(s.roleStructure['君']).toBe(1)
    expect(s.roleStructure['臣']).toBe(2)
    expect(s.roleStructure['使']).toBe(1)
    expect(s.safetyScore).toBe(0.95)
    expect(s.safetyStatus).toBe('passed')
    expect(s.overallScore).toBe(0.9)
  })

  it('缺失安全分时为 undefined（不补 0）', () => {
    const c = makeCandidate({
      id: 'b',
      name: '配方B',
      herb_combination: [{ name: '黄芪', dosage_g: 10, role: '君' }],
    })
    const s = summarizeFormula(c)
    expect(s.safetyScore).toBeUndefined()
    expect(s.safetyStatus).toBeUndefined()
  })

  it('重复药材只计一次（herbCount 按去重）', () => {
    const c = makeCandidate({
      id: 'c',
      name: '配方C',
      herb_combination: [
        { name: '黄芪', dosage_g: 10, role: '君' },
        { name: '黄芪', dosage_g: 5, role: '佐' },
      ],
    })
    const s = summarizeFormula(c)
    expect(s.herbCount).toBe(1)
  })
})

describe('buildFormulaComparison', () => {
  const a = makeCandidate({
    id: 'a',
    name: '配方A',
    safety_score: 0.95,
    overall_score: 0.9,
    herb_combination: [
      { name: '黄芪', dosage_g: 10, role: '君' },
      { name: '党参', dosage_g: 8, role: '臣' },
      { name: '枸杞', dosage_g: 5, role: '佐' },
    ],
  })
  const b = makeCandidate({
    id: 'b',
    name: '配方B',
    safety_score: 0.8,
    overall_score: 0.85,
    herb_combination: [
      { name: '黄芪', dosage_g: 6, role: '君' },
      { name: '当归', dosage_g: 9, role: '臣' },
    ],
  })

  it('药材并集按拼音排序正确', () => {
    const r = buildFormulaComparison([a, b])
    // localeCompare(…,'zh') 按拼音：当归(danggui) < 党参(dangshen) < 枸杞(gouqi) < 黄芪(huangqi)
    expect(r.allHerbs).toEqual(['当归', '党参', '枸杞', '黄芪'])
  })

  it('剂量矩阵：共享药材各配方剂量、独有药材缺失为 undefined', () => {
    const r = buildFormulaComparison([a, b])
    const huangqi = r.dosageMatrix.find((row) => row.herb === '黄芪')
    expect(huangqi?.doses).toEqual([10, 6])
    const dangshen = r.dosageMatrix.find((row) => row.herb === '党参')
    expect(dangshen?.doses).toEqual([8, undefined])
  })

  it('独有药材按配方归集', () => {
    const r = buildFormulaComparison([a, b])
    const uniqueMap = new Map(r.uniqueHerbs.map((u) => [u.formulaIndex, u.herbs]))
    expect(uniqueMap.get(0)).toEqual(expect.arrayContaining(['党参', '枸杞']))
    expect(uniqueMap.get(1)).toEqual(['当归'])
  })

  it('共享药材剂量极差排序（差异大的在前）', () => {
    const r = buildFormulaComparison([a, b])
    expect(r.sharedHerbs.length).toBe(1)
    expect(r.sharedHerbs[0].herb).toBe('黄芪')
    expect(r.sharedHerbs[0].maxDiffG).toBe(4)
  })

  it('单配方对比不产生共享药材', () => {
    const r = buildFormulaComparison([a])
    expect(r.sharedHerbs).toEqual([])
    expect(r.allHerbs.length).toBe(3)
  })
})
