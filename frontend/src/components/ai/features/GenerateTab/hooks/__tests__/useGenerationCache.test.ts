/**
 * useGenerationCache / generateCacheKey 单测
 *
 * 覆盖：
 * - 缓存键包含算法参数
 * - TTL 过期后返回 undefined（触发重新请求）
 * - 命中缓存时重复读取不重新请求
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGenerationCache, generateCacheKey } from '../useGenerationCache'

describe('useGenerationCache', () => {
  let unmounts: Array<() => void> = []

  beforeEach(() => {
    vi.useFakeTimers()
    unmounts = []
  })

  afterEach(() => {
    unmounts.forEach((fn) => fn())
    unmounts = []
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderCache = () => {
    const rendered = renderHook(() => useGenerationCache())
    unmounts.push(rendered.unmount)
    act(() => {
      rendered.result.current.clearCache()
    })
    return rendered.result
  }

  it('缓存键包含算法参数', () => {
    const key = generateCacheKey(['免疫调节'], {
      strategy: 'ga',
      generations: 40,
      population_size: 50,
    })
    expect(key).toContain('免疫调节')
    expect(key).toContain('ga')
    expect(key).toContain('40')
    expect(key).toContain('50')

    // 不同算法参数生成不同缓存键
    const key2 = generateCacheKey(['免疫调节'], { strategy: 'ga', generations: 60 })
    expect(key).not.toBe(key2)

    // 相同参数生成相同缓存键
    const key3 = generateCacheKey(['免疫调节'], {
      strategy: 'ga',
      generations: 40,
      population_size: 50,
    })
    expect(key).toBe(key3)
  })

  it('命中缓存返回数据，重复读取不重新请求', () => {
    const result = renderCache()
    const key = generateCacheKey(['免疫调节'], { strategy: 'ga' })
    const data = { candidates: [{ id: 'c1', name: '配方A' }] }

    act(() => {
      result.current.setCachedResult(key, data)
    })

    expect(result.current.getCachedResult(key)).toBe(data)
    // 重复读取仍命中同一份缓存数据
    expect(result.current.getCachedResult(key)).toBe(data)
    expect(result.current.stats.size).toBe(1)
  })

  it('TTL 过期后返回 undefined（需重新请求）', () => {
    const result = renderCache()
    const key = generateCacheKey(['免疫调节'], { strategy: 'ga' })
    const data = { candidates: [{ id: 'c1', name: '配方A' }] }

    act(() => {
      result.current.setCachedResult(key, data)
    })
    expect(result.current.getCachedResult(key)).toBe(data)

    // 5 分钟 TTL 过期
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    })

    expect(result.current.getCachedResult(key)).toBeUndefined()
  })

  it('clearCache 清空所有缓存', () => {
    const result = renderCache()
    const key = generateCacheKey(['免疫调节'])

    act(() => {
      result.current.setCachedResult(key, { candidates: [] })
    })
    expect(result.current.stats.size).toBe(1)

    act(() => {
      result.current.clearCache()
    })
    expect(result.current.stats.size).toBe(0)
    expect(result.current.getCachedResult(key)).toBeUndefined()
  })
})