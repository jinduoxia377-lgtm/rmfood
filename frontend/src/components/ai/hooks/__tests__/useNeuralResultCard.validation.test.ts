/**
 * useNeuralResultCard 保存前 AI 校验测试（GenerateTab 保存路径）
 *
 * 覆盖：
 * - CRITICAL 阻断保存并打开成分级校验报告弹窗
 * - warnings 未阻断 → 继续保存并把建议追加到 notes（【AI校验】前缀）
 * - 校验接口异常 → 诚实降级（不阻断保存并提示）
 */
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNeuralResultCard } from '../useNeuralResultCard'
import { validateAiFormula } from '@/api/ai'
import { formulaApi } from '@/api/formula'
import type { AICandidate } from '@/api/ai'

vi.mock('@/api/ai', () => ({
  validateAiFormula: vi.fn(),
}))

vi.mock('@/api/formula', () => ({
  formulaApi: {
    create: vi.fn(),
  },
}))

const candidate = {
  id: 'c1',
  formula_name: '补气方',
  description: '测试配方',
  herb_combination: [
    { name: '黄芪', dosage: '15g', role: '君' },
    { name: '当归', dosage: '10g', role: '臣' },
  ],
  safety_details: {},
  synergy_score: 0.8,
} as unknown as AICandidate

describe('useNeuralResultCard 保存前 AI 校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(formulaApi.create as Mock).mockResolvedValue({ id: 1 })
  })

  it('校验被调用且携带成分 name + dosage_g 与目标功效', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: true,
      blocked_by_critical: false,
      alerts: [],
    })

    const { result } = renderHook(() => useNeuralResultCard({ candidate, index: 0, selectedEffects: ['补气'] }))

    await act(async () => {
      await result.current.saveToFormulaManager()
    })

    expect(validateAiFormula).toHaveBeenCalledWith({
      formula_name: '补气方',
      ingredients: [
        { name: '黄芪', dosage_g: 15 },
        { name: '当归', dosage_g: 10 },
      ],
      target_effects: ['补气'],
    })
    expect(formulaApi.create).toHaveBeenCalledTimes(1)
  })

  it('CRITICAL 阻断保存并打开成分级校验报告弹窗', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: false,
      blocked_by_critical: true,
      risk_score: 88,
      alerts: [
        {
          level: 'critical',
          ingredient: '人参',
          message: '人参用量超限',
          recommendation: '减量',
          blocking: true,
        },
      ],
    })

    const { result } = renderHook(() => useNeuralResultCard({ candidate, index: 0, selectedEffects: ['补气'] }))

    await act(async () => {
      await result.current.saveToFormulaManager()
    })

    expect(formulaApi.create).not.toHaveBeenCalled()
    expect(result.current.validationModalOpen).toBe(true)
    expect(result.current.validationResult?.blocked_by_critical).toBe(true)
  })

  it('warnings 未阻断时继续保存，并把校验建议追加到 notes（【AI校验】前缀）', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: true,
      blocked_by_critical: false,
      alerts: [{ level: 'warning', message: '甘草用量接近限量', blocking: false }],
      warnings: ['甘草用量接近限量'],
      suggestions: ['甘草用量建议控制在 6g 以内'],
    })

    const { result } = renderHook(() => useNeuralResultCard({ candidate, index: 0, selectedEffects: ['补气'] }))

    await act(async () => {
      await result.current.saveToFormulaManager()
    })

    expect(formulaApi.create).toHaveBeenCalledTimes(1)
    const payload = (formulaApi.create as Mock).mock.calls[0][0]
    expect(payload.notes).toContain('【AI校验】')
    expect(payload.notes).toContain('甘草用量建议控制在 6g 以内')
    expect(result.current.validationModalOpen).toBe(false)
  })

  it('校验接口异常时诚实降级：不阻断保存并提示', async () => {
    ;(validateAiFormula as Mock).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useNeuralResultCard({ candidate, index: 0, selectedEffects: ['补气'] }))

    await act(async () => {
      await result.current.saveToFormulaManager()
    })

    expect(formulaApi.create).toHaveBeenCalledTimes(1)
    expect(result.current.validationNotice).toContain('校验服务暂不可用')
    expect(result.current.validationModalOpen).toBe(false)
  })
})