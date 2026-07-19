/**
 * useSafeTranslation - 安全的 i18n 翻译 Hook (v1.0)
 *
 * 职责：
 * - 提供带 fallback 的翻译函数，防止缺失 key 时显示原始 key
 * - 开发环境下记录缺失的翻译 key
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18nInstance from 'i18next'
import { logger } from '@/utils/safeLogger'

/**
 * 创建带 fallback 的安全翻译函数
 */
export function useSafeTranslation() {
  const { t } = useTranslation()
  const reportedKeysRef = useRef<Set<string>>(new Set())

  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = t(key)
      if (result === key || !result) {
        const nativeResult = i18nInstance.t(key)
        if (nativeResult && nativeResult !== key) {
          return nativeResult
        }
        if (process.env.NODE_ENV === 'development' && !reportedKeysRef.current.has(key)) {
          reportedKeysRef.current.add(key)
          logger.warn(`[useSafeTranslation] i18n key not translated: "${key}", fallback: "${fallback || key}"`)
        }
        return fallback || key
      }
      return result
    },
    [t],
  )

  return safeT
}
