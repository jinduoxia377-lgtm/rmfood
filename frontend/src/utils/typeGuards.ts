/**
 * 类型安全工具集
 *
 * @description 提供类型守卫、类型断言和类型转换的安全工具
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'
import type { AICandidate } from '@/api/ai'

export interface TypeGuardResult<T> {
  valid: boolean
  value?: T
  error?: string
}

export function isAICandidate(obj: unknown): obj is AICandidate {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  const candidate = obj as Record<string, unknown>

  // 检查必要字段
  const hasRequiredFields =
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.ingredients) &&
    typeof candidate.score === 'number'

  if (!hasRequiredFields) {
    return false
  }

  // 检查可选字段的类型
  if (candidate.effects !== undefined && !Array.isArray(candidate.effects)) {
    return false
  }
  if (candidate.formula_name !== undefined && typeof candidate.formula_name !== 'string') {
    return false
  }
  if (candidate.herb_combination !== undefined && !Array.isArray(candidate.herb_combination)) {
    return false
  }
  if (candidate.synergy_score !== undefined && typeof candidate.synergy_score !== 'number') {
    return false
  }
  if (candidate.patent_synergy_scores !== undefined && typeof candidate.patent_synergy_scores !== 'object') {
    return false
  }

  return true
}

export function safeAICandidate(obj: unknown): TypeGuardResult<AICandidate> {
  if (isAICandidate(obj)) {
    return { valid: true, value: obj }
  }

  logger.warn('Invalid AICandidate object', { obj })

  return {
    valid: false,
    error: 'Object is not a valid AICandidate',
  }
}

export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj
}

export function getSafeProperty<T, K extends keyof T, D = undefined>(
  obj: T,
  key: K,
  defaultValue?: D,
): T[K] | D {
  if (obj === null || obj === undefined) {
    return defaultValue as D
  }

  if (!hasProperty(obj, key)) {
    return defaultValue as D
  }

  return obj[key]
}

export function safeString(value: unknown, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || value === undefined) {
    return defaultValue
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  logger.warn('Converting non-string value to string', { value })
  return String(value)
}

export function safeNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed
    }
  }
  logger.warn('Converting to number', { value, defaultValue })
  return defaultValue
}

export function safeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (value === 1 || value === 0) {
    return !!value
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false
    }
  }
  logger.warn('Converting to boolean', { value, defaultValue })
  return defaultValue
}

export function safeArray<T = unknown>(value: unknown, defaultValue: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }
  logger.warn('Converting to array', { value, defaultValue })
  return defaultValue
}

export function safeObject<T extends Record<string, unknown>>(
  value: unknown,
  defaultValue: T = {} as T,
): T {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as T
  }
  logger.warn('Converting to object', { value, defaultValue })
  return defaultValue
}

export function safeParseJSON<T = unknown>(
  jsonString: string,
  defaultValue?: T,
): T | null {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    logger.warn('Failed to parse JSON', { jsonString, error })
    return defaultValue ?? null
  }
}

export function isNotEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined && value !== ''
}

export function isEmpty<T>(value: T | null | undefined): value is null | undefined {
  return !isNotEmpty(value)
}

export function isTruthy<T>(value: T | null | undefined | false | 0 | ''): value is T {
  return !!value
}

export function isFalsy(value: unknown): value is null | undefined | false | 0 | '' {
  return !value
}

export function safelyAccess<T, Path extends PropertyKey[]>(
  obj: T,
  path: Path,
  defaultValue?: unknown,
): unknown {
  let current: unknown = obj

  for (const key of path) {
    if (current === null || current === undefined) {
      return defaultValue
    }
    if (typeof current !== 'object') {
      return defaultValue
    }
    if (!hasProperty(current, key)) {
      return defaultValue
    }
    current = current[key]
  }

  return current
}

export function createTypeSafeGetter<T>(obj: T) {
  return <K extends keyof T>(key: K, defaultValue?: T[K]): T[K] => {
    return getSafeProperty(obj, key, defaultValue)
  }
}
