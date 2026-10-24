/**
 * GenerateTab「保存全部」批量校验与保存逻辑测试
 *
 * 覆盖：
 * - buildCandidateValidationPayload / buildCandidateSavePayload 组装
 * - saveAllCandidatesWithValidation：全安全保存 / CRITICAL 阻断停止 / warnings 追加【AI校验】备注 / 校验接口异常诚实降级
 */
import { describe, it, expect, vi } from 'vitest'
import type { AICandidate } from '@/api/ai'
import type { AiFormulaValidationResponse } from '@/api/ai'
import {
  buildCandidateValidationPayload,
  buildCandidateSavePayload,
  saveAllCandidatesWithValidation,
} from '@/components/ai/features/GenerateTab'

function makeCandidate(overrides: Partial<AICandidate> = {}): AICandidate {
  return {
    id: 'c1',
    name: '测试配方',
    formula_name: '测试配方',
    description: '测试描述',
    herb_combination: [
      { name: '黄芪', dosage: '10g', role: '君' },
      { name: '枸杞', dosage: '5g', role: '臣' },
    ],
    ...overrides,
  } as AICandidate
}

function makeSafeValidation(): AiFormulaValidationResponse {
  return {
    valid: true,
    blocked_by_critical: false,
    risk_score: 10,
    alerts: [],
    ingredients: [],
    compatibility_issues: [],
    recommendations: ['整体安全性良好'],
  }
}

describe('buildCandidateValidationPayload', () => {
  it('将 herb_combination 映射为 name + dosage_g 成分列表，并携带 formula_name/target_effects', () => {
    const payload = buildCandidateValidationPayload(makeCandidate(), ['增强免疫'])
    expect(payload.formula_name).toBe('测试配方')
    expect(payload.ingredients).toEqual([
      { name: '黄芪', dosage_g: 10 },
      { name: '枸杞', dosage_g: 5 },
    ])
    expect(payload.target_effects).toEqual(['增强免疫'])
  })

  it('过滤无名称成分，dosage 缺失视为 0', () => {
    const candidate = makeCandidate({
      herb_combination: [
        { name: '黄芪', dosage: '10g', role: '君' },
        { name: '', dosage: '5g', role: '臣' },
        { name: '甘草', dosage: undefined, role: '使' },
      ],
    } as unknown as Partial<AICandidate>)
    const payload = buildCandidateValidationPayload(candidate as AICandidate, [])
    expect(payload.ingredients).toEqual([
      { name: '黄芪', dosage_g: 10 },
      { name: '甘草', dosage_g: 0 },
    ])
  })
})

describe('buildCandidateSavePayload', () => {
  it('组装配方保存 payload，支持传入 notes', () => {
    const payload = buildCandidateSavePayload(makeCandidate(), ['增强免疫'], '【AI校验】测试建议')
    expect(payload.name).toBe('测试配方')
    expect(payload.target_effects).toEqual(['增强免疫'])
    expect(payload.notes).toBe('【AI校验】测试建议')
    expect(payload.composition?.ingredients).toHaveLength(2)
  })
})

describe('saveAllCandidatesWithValidation', () => {
  it('全部安全时保存所有候选，并逐个回调 onCandidateSaved', async () => {
    const candidates = [makeCandidate({ id: 'c1', name: '配方1' }), makeCandidate({ id: 'c2', name: '配方2' })]
    const validate = vi.fn().mockResolvedValue(makeSafeValidation())
    const create = vi.fn().mockResolvedValue({ id: 100 })
    const onCandidateSaved = vi.fn()
    const onBlocked = vi.fn()

    const result = await saveAllCandidatesWithValidation({
      candidates,
      targetEffects: ['增强免疫'],
      validate,
      create,
      getCandidateId: (c, i) => `${i}_${c.id}`,
      onCandidateSaved,
      onBlocked,
    })

    expect(result).toEqual({ savedCount: 2, blocked: false, degraded: false })
    expect(validate).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledTimes(2)
    expect(onCandidateSaved).toHaveBeenCalledTimes(2)
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('任一候选 blocked_by_critical 时停止批量保存并回调 onBlocked', async () => {
    const candidates = [
      makeCandidate({ id: 'c1', name: '安全配方' }),
      makeCandidate({ id: 'c2', name: '危险配方' }),
    ]
    const validate = vi.fn()
      .mockResolvedValueOnce(makeSafeValidation())
      .mockResolvedValueOnce({ ...makeSafeValidation(), valid: false, blocked_by_critical: true, risk_score: 90 })
    const create = vi.fn().mockResolvedValue({ id: 100 })
    const onCandidateSaved = vi.fn()
    const onBlocked = vi.fn()

    const result = await saveAllCandidatesWithValidation({
      candidates,
      targetEffects: [],
      validate,
      create,
      getCandidateId: (c, i) => `${i}_${c.id}`,
      onCandidateSaved,
      onBlocked,
    })

    expect(result).toEqual({ savedCount: 1, blocked: true, degraded: false })
    expect(create).toHaveBeenCalledTimes(1)
    expect(onBlocked).toHaveBeenCalledWith(expect.objectContaining({ blocked_by_critical: true }), candidates[1])
    expect(onCandidateSaved).toHaveBeenCalledTimes(1)
  })

  it('warnings 未阻断时保存，并把校验建议追加为【AI校验】备注', async () => {
    const candidate = makeCandidate({ id: 'c1', name: '警告配方' })
    const validate = vi.fn().mockResolvedValue({
      ...makeSafeValidation(),
      valid: true,
      blocked_by_critical: false,
      alerts: [{ level: 'warning', message: '枸杞用量偏高', blocking: false }],
      recommendations: ['建议减量'],
    })
    const create = vi.fn().mockResolvedValue({ id: 100 })
    const onCandidateSaved = vi.fn()
    const onBlocked = vi.fn()

    const result = await saveAllCandidatesWithValidation({
      candidates: [candidate],
      targetEffects: [],
      validate,
      create,
      getCandidateId: (c, i) => `${i}_${c.id}`,
      onCandidateSaved,
      onBlocked,
    })

    expect(result).toEqual({ savedCount: 1, blocked: false, degraded: false })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.stringContaining('【AI校验】') }))
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('校验接口异常时诚实降级：跳过校验继续保存，返回 degraded=true', async () => {
    const candidates = [makeCandidate({ id: 'c1', name: '配方1' })]
    const validate = vi.fn().mockRejectedValue(new Error('network down'))
    const create = vi.fn().mockResolvedValue({ id: 100 })
    const onCandidateSaved = vi.fn()
    const onBlocked = vi.fn()

    const result = await saveAllCandidatesWithValidation({
      candidates,
      targetEffects: [],
      validate,
      create,
      getCandidateId: (c, i) => `${i}_${c.id}`,
      onCandidateSaved,
      onBlocked,
    })

    expect(result).toEqual({ savedCount: 1, blocked: false, degraded: true })
    expect(create).toHaveBeenCalledTimes(1)
    expect(onBlocked).not.toHaveBeenCalled()
  })
})