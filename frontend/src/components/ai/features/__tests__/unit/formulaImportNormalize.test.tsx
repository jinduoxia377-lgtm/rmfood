/**
 * formulaImportNormalize.test.tsx — 配方导入格式归一化单元测试 (v8.3)
 *
 * 背景 bug：exportFormulaData 导出的 JSON 是 { version, timestamp, formulas:[], metadata }
 * 包装对象，而 importFormulas 只接受裸数组 → 导出的文件无法再导回（静默导入 0 条）。
 * 本测试固定 normalizeImportedFormulas 同时支持两种格式的行为。
 */
import { describe, it, expect } from 'vitest'
import { normalizeImportedFormulas } from '../../hooks/useFormulaActions'

describe('normalizeImportedFormulas', () => {
  it('应接受裸数组格式', () => {
    const arr = [
      { id: 'f1', name: '配方A' },
      { id: 'f2', name: '配方B' },
    ]
    expect(normalizeImportedFormulas(arr)).toEqual(arr)
  })

  it('应接受本模块导出的包装对象格式（导出→导入闭环）', () => {
    const wrapper = {
      version: '1.1.0',
      timestamp: Date.now(),
      formulas: [
        { id: 'f1', name: '配方A' },
      ],
      metadata: { totalCount: 1, lastUpdated: '2026-11-15' },
    }
    const result = normalizeImportedFormulas(wrapper)
    expect(result).toHaveLength(1)
    expect(result?.[0].id).toBe('f1')
  })

  it('空数组应返回空数组（调用方据此提示无数据）', () => {
    expect(normalizeImportedFormulas([])).toEqual([])
    expect(normalizeImportedFormulas({ formulas: [] })).toEqual([])
  })

  it('无法识别的格式应返回 null', () => {
    expect(normalizeImportedFormulas(null)).toBeNull()
    expect(normalizeImportedFormulas(undefined)).toBeNull()
    expect(normalizeImportedFormulas(42)).toBeNull()
    expect(normalizeImportedFormulas('not json')).toBeNull()
    expect(normalizeImportedFormulas({ foo: 'bar' })).toBeNull()
    expect(normalizeImportedFormulas({ formulas: 'not-an-array' })).toBeNull()
  })
})
