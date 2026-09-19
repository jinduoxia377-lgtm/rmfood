// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useFormulaManager } from '../../../hooks/useFormulaManager'
import { createMockEventBus } from '../../helpers/mockServices'
import {
  createMockFormula,
  createMockFormulasArray
} from '../../helpers/testFactories'

describe('useFormulaManager', () => {
  let mockEventBus: ReturnType<typeof createMockEventBus>

  beforeEach(() => {
    mockEventBus = createMockEventBus()
  })

  describe('初始化状态', () => {
    it('应初始化为空配方列表', () => {
      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      expect(result.current.formulas).toEqual([])
      expect(result.current.selectedFormulas).toEqual([])
      expect(result.current.isSelectMode).toBe(false)
    })
  })

  describe('事件驱动的配方添加', () => {
    it('应在收到 FORMULA_RECOGNIZED 事件时添加配方', () => {
      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      const newFormula = createMockFormula({
        name: '新识别的配方',
        category: '功能性成分'
      })

      act(() => {
        const subscribers = mockEventBus.subscribe.mock.calls.find(
          call => call[0] === 'FORMULA_RECOGNIZED'
        )
        if (subscribers) {
          subscribers[1](newFormula)
        }
      })

      expect(result.current.formulas).toContainEqual(newFormula)
      expect(result.current.formulas).toHaveLength(1)
    })

    it('应避免重复添加相同配方的 ID', () => {
      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      const formula = createMockFormula({ id: 'duplicate-id' })

      act(() => {
        const subscriber = mockEventBus.subscribe.mock.calls.find(
          call => call[0] === 'FORMULA_RECOGNIZED'
        )?.[1]
        if (subscriber) {
          subscriber(formula)
          subscriber(formula)
        }
      })

      const duplicates = result.current.formulas.filter(
        f => f.id === 'duplicate-id'
      )
      expect(duplicates).toHaveLength(1)
    })
  })

  describe('批量操作', () => {
    it('应支持选择多个配方', () => {
      const formulas = createMockFormulasArray(5)

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
        result.current.toggleSelectMode()
        result.current.toggleFormulaSelection(formulas[0].id)
        result.current.toggleFormulaSelection(formulas[2].id)
        result.current.toggleFormulaSelection(formulas[4].id)
      })

      expect(result.current.selectedFormulas).toHaveLength(3)
      expect(result.current.selectedFormulas).toContainEqual(
        expect.objectContaining({ id: formulas[0].id })
      )
    })

    it('应支持全选/取消全选', () => {
      const formulas = createMockFormulasArray(5)

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
        result.current.toggleSelectMode()
        result.current.selectAllFormulas()
      })

      expect(result.current.selectedFormulas).toHaveLength(5)

      act(() => {
        result.current.deselectAllFormulas()
      })

      expect(result.current.selectedFormulas).toHaveLength(0)
    })

    it('应支持删除选中的配方', () => {
      const formulas = createMockFormulasArray(5)

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
        result.current.toggleSelectMode()
        result.current.selectAllFormulas()
        result.current.deleteSelectedFormulas()
      })

      expect(result.current.formulas).toHaveLength(0)
      expect(result.current.selectedFormulas).toHaveLength(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'FORMULAS_DELETED',
        expect.objectContaining({ deletedCount: 5 })
      )
    })
  })

  describe('选择模式切换', () => {
    it('应正确切换选择模式状态', () => {
      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      expect(result.current.isSelectMode).toBe(false)

      act(() => {
        result.current.toggleSelectMode()
      })

      expect(result.current.isSelectMode).toBe(true)

      act(() => {
        result.current.toggleSelectMode()
      })

      expect(result.current.isSelectMode).toBe(false)
    })

    it('退出选择模式时应清空选中列表', () => {
      const formulas = createMockFormulasArray(3)

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
        result.current.toggleSelectMode()
        result.current.selectAllFormulas()
        result.current.toggleSelectMode()
      })

      expect(result.current.selectedFormulas).toHaveLength(0)
    })
  })

  describe('配方搜索和过滤', () => {
    it('应根据关键词过滤配方', () => {
      const formulas = [
        createMockFormula({ name: '胶原蛋白肽' }),
        createMockFormula({ name: '乳清蛋白肽' }),
        createMockFormula({ name: '大豆肽' }),
        createMockFormula({ name: '鱼胶原蛋白' })
      ]

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
      })

      const filtered = result.current.filterFormulas('胶原')

      expect(filtered).toHaveLength(2)
      expect(filtered.every(f => f.name.includes('胶原'))).toBe(true)
    })

    it('应根据分类过滤配方', () => {
      const formulas = [
        createMockFormula({ category: '功能性成分' }),
        createMockFormula({ category: '营养强化' }),
        createMockFormula({ category: '功能性成分' }),
        createMockFormula({ category: '防腐剂' })
      ]

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
      })

      const functional = result.current.getFormulasByCategory('功能性成分')

      expect(functional).toHaveLength(2)
    })
  })

  describe('导出准备', () => {
    it('应返回选中配方的完整数据用于导出', () => {
      const formulas = createMockFormulasArray(5)

      const { result } = renderHook(() =>
        useFormulaManager(mockEventBus)
      )

      act(() => {
        result.current.setFormulas(formulas)
        result.current.toggleSelectMode()
        result.current.toggleFormulaSelection(formulas[1].id)
        result.current.toggleFormulaSelection(formulas[3].id)
      })

      const exportData = result.current.getSelectedFormulasForExport()

      expect(exportData).toHaveLength(2)
      expect(exportData).toContainEqual(
        expect.objectContaining({ id: formulas[1].id })
      )
    })
  })
})
