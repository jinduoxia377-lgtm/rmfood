/**
 * 剂量单位换算与占比显示常量配置
 *
 * 提供配方成分的剂量换算映射、占比颜色阈值等常量定义。
 */

import type { DosageCalculationResult } from '@/types/ai.types'

// ==================== 单位换算映射 ====================

/**
 * 单位换算系数映射表
 * key: "源单位->目标单位" 格式
 * value: 换算系数（源单位 * 系数 = 目标单位）
 */
export const UNIT_CONVERSION_MAP: Record<string, number> = {
  // 质量单位
  'mg->g': 0.001,
  'g->kg': 0.001,
  'kg->g': 1000,
  'g->mg': 1000,
  // 体积单位
  'ml->l': 0.001,
  'l->ml': 1000,
  'ul->ml': 0.001,
  'ml->ul': 1000,
  // 常用中药单位
  '钱->g': 5,
  'g->钱': 0.2,
  '两->g': 50,
  'g->两': 0.02,
  '斤->g': 500,
  'g->斤': 0.002,
}

/**
 * 标准化单位列表
 * 用于统一不同来源的单位表示
 */
export const STANDARD_UNITS = {
  mass: ['mg', 'g', 'kg', '钱', '两', '斤'] as const,
  volume: ['ml', 'l', 'ul'] as const,
} as const

/**
 * 默认目标单位
 * 不同类别成分的默认显示单位
 */
export const DEFAULT_UNITS: Record<string, string> = {
  TCM: 'g',
  PEPTIDE: 'mg',
  EXCIPIENT: 'g',
}

// ==================== 占比颜色阈值 ====================

/**
 * 占比颜色阈值配置
 * 用于根据成分在配方中的占比显示不同的视觉标识
 */
export const PERCENTAGE_COLOR_THRESHOLDS = [
  { max: 5, color: '#52c41a', label: '微量 (<5%)', bgClass: 'bg-success-50', textClass: 'text-success-700' },
  { max: 15, color: '#1890ff', label: '少量 (5-15%)', bgClass: 'bg-secondary-50', textClass: 'text-secondary-700' },
  { max: 30, color: '#faad14', label: '中等 (15-30%)', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
  { max: 50, color: '#fa8c16', label: '主要 (30-50%)', bgClass: 'bg-orange-50', textClass: 'text-orange-700' },
  { max: 100, color: '#f5222d', label: '核心 (>50%)', bgClass: 'bg-error-50', textClass: 'text-error-700' },
] as const

/**
 * 根据占比获取颜色配置
 */
export function getPercentageColorConfig(percentage: number): typeof PERCENTAGE_COLOR_THRESHOLDS[number] {
  return (
    PERCENTAGE_COLOR_THRESHOLDS.find((threshold) => percentage <= threshold.max) ??
    PERCENTAGE_COLOR_THRESHOLDS[PERCENTAGE_COLOR_THRESHOLDS.length - 1]
  )
}

// ==================== 剂量计算工具函数 ====================

/**
 * 执行单位换算
 *
 * @param value - 原始值
 * @param fromUnit - 源单位
 * @param toUnit - 目标单位
 * @returns 换算结果，如果无法换算则返回 null
 */
export function convertDosage(
  value: number,
  fromUnit: string,
  toUnit: string,
): DosageCalculationResult | null {
  if (fromUnit === toUnit) {
    return {
      originalValue: value,
      originalUnit: fromUnit,
      convertedValue: value,
      convertedUnit: toUnit,
      conversionFactor: 1,
      calculatedAt: new Date(),
    }
  }

  const conversionKey = `${fromUnit}->${toUnit}`
  const factor = UNIT_CONVERSION_MAP[conversionKey]

  if (factor === undefined) {
    return null
  }

  return {
    originalValue: value,
    originalUnit: fromUnit,
    convertedValue: parseFloat((value * factor).toFixed(6)),
    convertedUnit: toUnit,
    conversionFactor: factor,
    calculatedAt: new Date(),
  }
}

/**
 * 计算成分在配方中的占比百分比
 *
 * @param amount - 成分用量
 * @param totalAmount - 配方总用量
 * @returns 百分比值 (0-100)
 */
export function calculatePercentage(amount: number, totalAmount: number): number {
  if (totalAmount <= 0) return 0
  return parseFloat(((amount / totalAmount) * 100).toFixed(2))
}

/**
 * 验证用量是否在安全范围内
 *
 * @param amount - 实际用量
 * @param min - 最小推荐值
 * @param max - 最大推荐值
 * @returns 验证结果
 */
export function validateDosageRange(
  amount: number,
  min?: number,
  max?: number,
): { valid: boolean; message: string } {
  if (min !== undefined && amount < min) {
    return { valid: false, message: `用量 ${amount} 低于最小推荐值 ${min}` }
  }
  if (max !== undefined && amount > max) {
    return { valid: false, message: `用量 ${amount} 超过最大推荐值 ${max}` }
  }
  return { valid: true, message: '用量在安全范围内' }
}
