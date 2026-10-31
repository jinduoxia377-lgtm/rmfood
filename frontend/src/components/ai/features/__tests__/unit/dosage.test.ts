/**
 * 剂量单位校验与克归一化测试（P2-10）
 *
 * 覆盖：
 * - g/克 直接保留
 * - mg/毫克 → ÷1000
 * - kg → ×1000
 * - ml/毫升 → 按 1g/ml 折算
 * - 无单位数字默认按克
 * - 区间取上限
 * - 非法单位/空输入/负数 → null（调用方可降级为 0）
 */
import { describe, it, expect } from 'vitest'
import { parseDosageToGrams, parseDosageToGramsOrZero } from '@/components/ai/features/utils/dosage'

describe('parseDosageToGrams 剂量单位归一化', () => {
  it('g/克 直接保留为克', () => {
    expect(parseDosageToGrams('10g')).toBe(10)
    expect(parseDosageToGrams('10克')).toBe(10)
    expect(parseDosageToGrams('10 克')).toBe(10)
    expect(parseDosageToGrams('12.5g')).toBe(12.5)
  })

  it('mg/毫克 除以 1000 换算为克', () => {
    expect(parseDosageToGrams('500mg')).toBe(0.5)
    expect(parseDosageToGrams('250毫克')).toBe(0.25)
    expect(parseDosageToGrams('1000mg')).toBe(1)
  })

  it('kg 乘以 1000 换算为克', () => {
    expect(parseDosageToGrams('2kg')).toBe(2000)
    expect(parseDosageToGrams('0.5kg')).toBe(500)
  })

  it('ml/毫升 按 1g/ml 折算为克', () => {
    expect(parseDosageToGrams('10ml')).toBe(10)
    expect(parseDosageToGrams('10毫升')).toBe(10)
  })

  it('无单位数字默认按克处理', () => {
    expect(parseDosageToGrams('10')).toBe(10)
    expect(parseDosageToGrams('15')).toBe(15)
  })

  it('市制单位 斤/两 换算为克', () => {
    expect(parseDosageToGrams('1斤')).toBe(500)
    expect(parseDosageToGrams('2两')).toBe(100)
  })

  it('区间字符串取上限值', () => {
    expect(parseDosageToGrams('10-15g')).toBe(15)
    expect(parseDosageToGrams('10~15克')).toBe(15)
    expect(parseDosageToGrams('10至15克')).toBe(15)
  })

  it('中文口头修饰词被忽略（约/左右）', () => {
    expect(parseDosageToGrams('约15克')).toBe(15)
    expect(parseDosageToGrams('10g左右')).toBe(10)
  })

  it('非法单位/无法识别时返回 null', () => {
    expect(parseDosageToGrams('10oz')).toBeNull()
    expect(parseDosageToGrams('10升')).toBeNull()
    expect(parseDosageToGrams('abc')).toBeNull()
    expect(parseDosageToGrams('')).toBeNull()
    expect(parseDosageToGrams(null)).toBeNull()
    expect(parseDosageToGrams(undefined)).toBeNull()
  })

  it('负数或非数值返回 null', () => {
    expect(parseDosageToGrams('-5g')).toBeNull()
    expect(parseDosageToGrams('十克')).toBeNull()
  })

  it('parseDosageToGramsOrZero 非法输入降级为 0', () => {
    expect(parseDosageToGramsOrZero('10oz')).toBe(0)
    expect(parseDosageToGramsOrZero('')).toBe(0)
    expect(parseDosageToGramsOrZero(undefined)).toBe(0)
    expect(parseDosageToGramsOrZero('500mg')).toBe(0.5)
  })
})