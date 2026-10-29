/**
 * useAlgorithmConfig Hook 单测
 *
 * 验证 toApiParams 返回单层 constraints（无 constraints.constraints 嵌套），
 * 包含 population_size / generations / max_candidates / total_dosage_g。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlgorithmConfig } from '../useAlgorithmConfig'

describe('useAlgorithmConfig', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('toApiParams 返回单层扁平对象，无 constraints.constraints 嵌套', () => {
    const { result } = renderHook(() => useAlgorithmConfig())
    const params = result.current.toApiParams

    // 关键算法参数
    expect(params.population_size).toBe(50)
    expect(params.generations).toBe(40)
    expect(params.mutation_rate).toBe(0.15)
    expect(params.crossover_rate).toBe(0.85)
    expect(params.elite_ratio).toBe(0.15)
    expect(params.tournament_size).toBe(5)
    expect(params.strategy).toBe('auto')

    // 后端实际消费的约束键
    expect(params.max_candidates).toBe(5)
    expect(params.total_dosage_g).toBe(100.0)

    // 单层结构：对象自身不得再带 constraints 键
    expect(params.constraints).toBeUndefined()
    expect('constraints' in params).toBe(false)

    // 个人约束与算法参数在同一层
    expect(params.age_group).toBe('adult')
    expect(params.allergies).toEqual([])
    expect(params.cooking_method).toBe('decoction')
    expect(params.taste_preference).toBe('balanced')
  })

  it('toApiParams 随算法配置更新而变化', () => {
    const { result } = renderHook(() => useAlgorithmConfig())

    act(() => {
      result.current.updateConfig({ populationSize: 80, generations: 60 })
    })

    expect(result.current.toApiParams.population_size).toBe(80)
    expect(result.current.toApiParams.generations).toBe(60)
    // 更新配置后仍是单层结构
    expect(result.current.toApiParams.constraints).toBeUndefined()
    expect(result.current.toApiParams.max_candidates).toBe(5)
    expect(result.current.toApiParams.total_dosage_g).toBe(100.0)
  })

  it('应用预设场景会更新对应参数', () => {
    const { result } = renderHook(() => useAlgorithmConfig())

    act(() => {
      result.current.applyPreset('efficacy_first')
    })

    expect(result.current.config.populationSize).toBe(80)
    expect(result.current.config.generations).toBe(60)
    expect(result.current.toApiParams.population_size).toBe(80)
    expect(result.current.toApiParams.generations).toBe(60)
  })
})