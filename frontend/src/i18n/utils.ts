/**
 * i18n 工具函数
 */

/** 深合并多个对象（用于把模块化翻译文件合并进主语言包） */
export function deepMerge(
  ...objects: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const obj of objects) {
    if (!obj) continue
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      const existing = result[key]
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        result[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>)
      } else {
        result[key] = value
      }
    }
  }
  return result
}