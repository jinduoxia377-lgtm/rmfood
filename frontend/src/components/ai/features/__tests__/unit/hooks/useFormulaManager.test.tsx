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
  saveFormulaIndexWithReason: vi.fn(() => null),
  loadFormulaIndex: vi.fn(() => new Map()),
  loadFormulaVersionHistory: vi.fn(() => []),
  clearFormulaStorage: vi.fn(),
  isStorageAvailable: vi.fn(() => false),
  importFormulaData: vi.fn((data: unknown[]) => data),
}))

import * as formulaStorage from '@/utils/formulaStorage'

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

  // ===== v8.2 新增能力（运行时验证）=====

  it('toggleFavorite 应回写 formula.isFavorite（v8.2 修复）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    expect(result.current.getFormulaById('f1')?.isFavorite).toBeFalsy()

    act(() => {
      result.current.toggleFavorite('f1')
    })
    expect(result.current.getFormulaById('f1')?.isFavorite).toBe(true)

    act(() => {
      result.current.toggleFavorite('f1')
    })
    expect(result.current.getFormulaById('f1')?.isFavorite).toBe(false)
  })

  it('setPriority 应回写 formula.priority（v8.2 修复）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })

    act(() => {
      result.current.setPriority('f1', 'high')
    })
    expect(result.current.getFormulaById('f1')?.priority).toBe('high')

    act(() => {
      result.current.setPriority('f1', 'low')
    })
    expect(result.current.getFormulaById('f1')?.priority).toBe('low')
  })

  it('compareFormulas 应返回相似度与成分差异', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula({
        ...makeFormula('f1', '配方A'),
        ingredients: [{ name: '黄芪', dosage: '10' }, { name: '枸杞', dosage: '8' }],
      })
      result.current.addFormula({
        ...makeFormula('f2', '配方B'),
        ingredients: [{ name: '黄芪', dosage: '12' }, { name: '当归', dosage: '6' }],
      })
    })

    const cmp = result.current.compareFormulas('f1', 'f2')
    expect(cmp).not.toBeNull()
    expect(cmp!.commonIngredients).toContain('黄芪')
    expect(cmp!.uniqueToFormula1).toContain('枸杞')
    expect(cmp!.uniqueToFormula2).toContain('当归')
    expect(cmp!.similarityScore).toBeGreaterThan(0)
  })

  it('createVersion / getVersionHistory / rollbackToVersion 应工作', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '原名'))
    })

    act(() => {
      result.current.createVersion('f1', { name: '新名' }, '改名')
    })

    const history = result.current.getVersionHistory('f1')
    expect(history).toHaveLength(1)
    expect(history[0].version).toBe(1)
    expect(history[0].changeReason).toBe('改名')

    act(() => {
      result.current.updateFormula('f1', { name: '新名' })
    })
    expect(result.current.getFormulaById('f1')?.name).toBe('新名')

    act(() => {
      const ok = result.current.rollbackToVersion('f1', 1)
      expect(ok).toBe(true)
    })
    expect(result.current.getFormulaById('f1')?.name).toBe('新名')
  })

  // ===== v8.3 持久化 / 标签真源修复（运行时验证）=====

  it('挂载时应从持久化数据恢复 favorites / priorities（刷新后状态一致）', () => {
    const indexed = new Map<string, ReturnType<typeof makeFormula>>()
    indexed.set('f1', {
      ...makeFormula('f1', '配方A'),
      isFavorite: true,
      priority: 'high',
    } as ReturnType<typeof makeFormula>)
    indexed.set('f2', { ...makeFormula('f2', '配方B') } as ReturnType<typeof makeFormula>)

    vi.mocked(formulaStorage.isStorageAvailable).mockReturnValue(true)
    vi.mocked(formulaStorage.loadFormulaIndex).mockReturnValue(
      indexed as unknown as Map<string, never>,
    )

    const { result } = renderHook(() => useFormulaManager())

    expect(result.current.formulaCount).toBe(2)
    // 收藏状态从 formula.isFavorite 恢复
    expect(result.current.isFavorite('f1')).toBe(true)
    expect(result.current.isFavorite('f2')).toBe(false)
    expect(result.current.getFavorites().map((f) => f.id)).toEqual(['f1'])
    // 优先级恢复
    expect(result.current.getByPriority('high').map((f) => f.id)).toEqual(['f1'])

    // 清理 mock，避免影响后续测试
    vi.mocked(formulaStorage.isStorageAvailable).mockReturnValue(false)
    vi.mocked(formulaStorage.loadFormulaIndex).mockReturnValue(null)
  })

  it('挂载时应从持久化数据恢复版本历史（刷新后不丢）', () => {
    const indexed = new Map<string, ReturnType<typeof makeFormula>>()
    indexed.set('f1', { ...makeFormula('f1', '配方A') } as ReturnType<typeof makeFormula>)

    vi.mocked(formulaStorage.isStorageAvailable).mockReturnValue(true)
    vi.mocked(formulaStorage.loadFormulaIndex).mockReturnValue(
      indexed as unknown as Map<string, never>,
    )
    vi.mocked(formulaStorage.loadFormulaVersionHistory).mockReturnValue([
      {
        id: 'f1',
        versions: [
          { version: 1, timestamp: Date.now(), changes: { name: '旧名' }, changeReason: '初次' },
        ],
      },
    ])

    const { result } = renderHook(() => useFormulaManager())

    const history = result.current.getVersionHistory('f1')
    expect(history).toHaveLength(1)
    expect(history[0].version).toBe(1)
    expect(history[0].changeReason).toBe('初次')
    expect(history[0].timestamp).toBeInstanceOf(Date)

    vi.mocked(formulaStorage.isStorageAvailable).mockReturnValue(false)
    vi.mocked(formulaStorage.loadFormulaIndex).mockReturnValue(null)
    vi.mocked(formulaStorage.loadFormulaVersionHistory).mockReturnValue([])
  })

  it('addTag / removeTag 应回写 formula.tags（卡片可见）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    expect(result.current.getFormulaById('f1')?.tags ?? []).toEqual([])

    act(() => {
      result.current.addTag('f1', '补气')
    })
    expect(result.current.getFormulaById('f1')?.tags).toEqual(['补气'])
    expect(result.current.getTags('f1')).toEqual(['补气'])
    expect(result.current.getAllTags()).toContain('补气')
    expect(result.current.getFormulasByTag('补气').map((f) => f.id)).toEqual(['f1'])

    act(() => {
      result.current.removeTag('f1', '补气')
    })
    expect(result.current.getFormulaById('f1')?.tags).toEqual([])
  })

  it('batchTag 应让所有选中配方的 formula.tags 生效（批量标签可见）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
      result.current.addFormula(makeFormula('f2', '配方B'))
    })
    act(() => {
      result.current.batchTag(['f1', 'f2'], ['免疫'])
    })

    expect(result.current.getFormulaById('f1')?.tags).toEqual(['免疫'])
    expect(result.current.getFormulaById('f2')?.tags).toEqual(['免疫'])
  })

  // ===== v8.5 批量删除撤销（运行时验证）=====

  it('batchDelete 后 canUndoBatchDelete 为 true，undoBatchDelete 恢复配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
      result.current.addFormula(makeFormula('f2', '配方B'))
    })
    expect(result.current.formulaCount).toBe(2)

    act(() => {
      result.current.batchDelete(['f1'])
    })
    expect(result.current.formulaCount).toBe(1)
    expect(result.current.getFormulaById('f1')).toBeUndefined()
    expect(result.current.canUndoBatchDelete).toBe(true)

    let restored = -99
    act(() => {
      restored = result.current.undoBatchDelete()
    })
    expect(restored).toBe(1)
    expect(result.current.formulaCount).toBe(2)
    expect(result.current.getFormulaById('f1')?.name).toBe('配方A')
    // 撤销后无可撤销记录
    expect(result.current.canUndoBatchDelete).toBe(false)
  })

  it('undoBatchDelete 恢复的配方保留收藏状态', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    act(() => {
      result.current.toggleFavorite('f1')
    })
    expect(result.current.getFormulaById('f1')?.isFavorite).toBe(true)

    act(() => {
      result.current.batchDelete(['f1'])
    })
    expect(result.current.formulaCount).toBe(0)

    act(() => {
      result.current.undoBatchDelete()
    })
    expect(result.current.formulaCount).toBe(1)
    expect(result.current.getFormulaById('f1')?.isFavorite).toBe(true)
  })

  it('没有任何删除记录时 undoBatchDelete 返回 -1', () => {
    const { result } = renderHook(() => useFormulaManager())

    expect(result.current.canUndoBatchDelete).toBe(false)
    let restored = 0
    act(() => {
      restored = result.current.undoBatchDelete()
    })
    expect(restored).toBe(-1)
  })

  it('批量删除超过上限时被拒绝并记录 batchLimitExceeded', () => {
    // 默认 maxFormulas=50 会触发 LRU 淘汰，这里调高上限以便真正堆到 201 条
    const { result } = renderHook(() => useFormulaManager({ maxFormulas: 500 }))

    // 构造 201 条（上限 200）
    act(() => {
      for (let i = 0; i < 201; i++) {
        result.current.addFormula(makeFormula(`f${i}`, `配方${i}`))
      }
    })
    expect(result.current.formulaCount).toBe(201)

    const tooMany = Array.from({ length: 201 }, (_, i) => `f${i}`)
    act(() => {
      result.current.batchDelete(tooMany)
    })

    // 超限被拒：一条都没删，记录了被拒条数
    expect(result.current.formulaCount).toBe(201)
    expect(result.current.batchLimitExceeded).toBe(201)
    expect(result.current.canUndoBatchDelete).toBe(false)

    act(() => {
      result.current.clearBatchLimitExceeded()
    })
    expect(result.current.batchLimitExceeded).toBeNull()
  })

  // ===== v8.3 内存清理 / 批量导出（运行时验证）=====

  it('clearMemoryCache 只清内存，不调用 clearFormulaStorage（不删本地存储）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
    })
    act(() => {
      result.current.addTag('f1', '补气')
    })
    expect(result.current.formulaCount).toBe(1)

    vi.mocked(formulaStorage.clearFormulaStorage).mockClear()

    act(() => {
      result.current.clearMemoryCache()
    })

    expect(result.current.formulaCount).toBe(0)
    // 关键：内存清空但未清除本地存储（避免误删持久化数据）
    expect(formulaStorage.clearFormulaStorage).not.toHaveBeenCalled()
  })

  it('batchExport 应按选中 id 导出（非整表）', async () => {
    const exporter = await import('@/utils/formulaExporter')
    const exportMock = vi.mocked(exporter.exportFormulas)
    exportMock.mockClear()

    const { result } = renderHook(() => useFormulaManager())
    act(() => {
      result.current.addFormula(makeFormula('f1', '配方A'))
      result.current.addFormula(makeFormula('f2', '配方B'))
    })

    await act(async () => {
      await result.current.batchExport(['f1'], 'json')
    })

    expect(exportMock).toHaveBeenCalledTimes(1)
    const firstArg = exportMock.mock.calls[0][0] as Map<string, unknown>
    expect(firstArg.size).toBe(1)
    expect(firstArg.has('f1')).toBe(true)
    expect(firstArg.has('f2')).toBe(false)
  })

  it('renameFormula 应自动创建版本快照，且回滚能还原旧名称（v8.3）', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(makeFormula('f1', '旧名称'))
    })
    expect(result.current.getVersionHistory('f1')).toHaveLength(0)

    act(() => {
      result.current.renameFormula('f1', '新名称')
    })

    // 版本历史有记录（此前恒为空）
    const history = result.current.getVersionHistory('f1')
    expect(history).toHaveLength(1)
    expect(history[0].changeReason).toBe('手动重命名')
    expect(result.current.getFormulaById('f1')?.autoName).toBe('新名称')

    // 回滚应还原旧名称（显示名 = autoName || name）
    act(() => {
      result.current.rollbackToVersion('f1', 1)
    })
    const restored = result.current.getFormulaById('f1')
    expect(restored?.autoName || restored?.name).toBe('旧名称')
  })
})