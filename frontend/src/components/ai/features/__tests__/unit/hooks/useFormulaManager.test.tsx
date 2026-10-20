import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFormulaManager } from '../../../hooks/useFormulaManager'

// 当前 useFormulaManager 以模块单例方式依赖 eventBus / formulaStorage / formulaExporter
vi.mock('@/components/ai/features/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

vi.mock('@/utils/formulaStorage', () => ({
  saveFormulaIndex: vi.fn(),
  loadFormulaIndex: vi.fn(() => new Map()),
  clearFormulaStorage: vi.fn(),
  isStorageAvailable: vi.fn(() => false),
  importFormulaData: vi.fn((data: unknown[]) => data),
}))

vi.mock('@/utils/formulaExporter', () => ({
  exportFormulas: vi.fn().mockResolvedValue(true),
}))

function makeFormula(id: string, name: string): { id: string; name: string; value: number; unit: string; confidence: number } {
  return {
    id,
    name,
    value: 10,
    unit: 'g',
    confidence: 0.9,
  }
}

/** addFormulas 有 500ms 防抖批量添加，等待防抖结束 */
async function flushUpdateDebounce(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600))
}

describe('useFormulaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应初始化为空状态', () => {
    const { result } = renderHook(() => useFormulaManager())

    expect(result.current.formulas).toEqual([])
    expect(result.current.formulaCount).toBe(0)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.searchQuery).toBe('')
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('addFormula 应添加配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    const formula = makeFormula('f1', '补气配方')

    act(() => {
      result.current.addFormula(formula)
    })

    expect(result.current.formulaCount).toBe(1)
    expect(result.current.getFormulaById('f1')?.name).toBe('补气配方')
  })

  it('addFormulas 应批量添加配方', async () => {
    const { result } = renderHook(() => useFormulaManager())

    await act(async () => {
      result.current.addFormulas([makeFormula('f1', '配方A'), makeFormula('f2', '配方B')])
      await flushUpdateDebounce()
    })

    expect(result.current.formulaCount).toBe(2)
  })

  it('removeFormula 应删除指定配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    act(() => {
      result.current.removeFormula('f1')
    })

    expect(result.current.formulaCount).toBe(0)
  })

  it('updateFormula 应更新配方字段', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '旧名称'))
    })
    act(() => {
      result.current.updateFormula('f1', { name: '新名称' })
    })

    expect(result.current.getFormulaById('f1')?.name).toBe('新名称')
  })

  it('clearAllFormulas 应清空全部配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    act(() => {
      result.current.clearAllFormulas()
    })

    expect(result.current.formulaCount).toBe(0)
  })

  it('toggleExpand / isExpanded 应切换展开状态', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.toggleExpand('f1')
    })
    expect(result.current.isExpanded('f1')).toBe(true)

    act(() => {
      result.current.toggleExpand('f1')
    })
    expect(result.current.isExpanded('f1')).toBe(false)
  })

  it('searchFormulas 应按名称关键词过滤', async () => {
    const { result } = renderHook(() => useFormulaManager())

    await act(async () => {
      result.current.addFormulas([
        makeFormula('f1', '胶原蛋白肽'),
        makeFormula('f2', '乳清蛋白肽'),
      ])
      await flushUpdateDebounce()
    })

    const filtered = result.current.searchFormulas('胶原')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('f1')
  })

  it('filterFormulas 应支持自定义谓词过滤', async () => {
    const { result } = renderHook(() => useFormulaManager())

    await act(async () => {
      result.current.addFormulas([makeFormula('f1', '配方A'), makeFormula('f2', '配方B')])
      await flushUpdateDebounce()
    })

    const filtered = result.current.filterFormulas((f) => f.name === '配方A')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('f1')
  })

  it('选择/全选/清空选择应正确维护选中集合', async () => {
    const { result } = renderHook(() => useFormulaManager())

    await act(async () => {
      result.current.addFormulas([makeFormula('f1', '配方A'), makeFormula('f2', '配方B')])
      await flushUpdateDebounce()
    })

    act(() => {
      result.current.selectFormula('f1', true)
    })
    expect(result.current.getSelectedCount()).toBe(1)

    act(() => {
      result.current.selectAll()
    })
    expect(result.current.getSelectedCount()).toBe(2)

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.getSelectedCount()).toBe(0)
  })

  it('getStats 应返回配方统计', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })

    const stats = result.current.getStats()
    expect(stats.totalCount).toBe(1)
    expect(stats.expandedCount).toBe(0)
  })
})