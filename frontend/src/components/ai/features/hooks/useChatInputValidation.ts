/**
 * useChatInputValidation - 输入校验 Hook (v1.0)
 *
 * 职责：
 * - 字符计数与长度限制
 * - 发送按钮可用性判断
 * - 空内容/流式输出中禁止发送
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useMemo } from 'react'

export interface UseChatInputValidationOptions {
  maxLength?: number
  value: string
  isStreaming: boolean
  isDisabled: boolean
  showFormatError: boolean
}

export interface UseChatInputValidationReturn {
  charCount: number
  isOverLimit: boolean
  isExceeded: boolean
  canSend: boolean
  errorMessage: string
}

export function useChatInputValidation(opts: UseChatInputValidationOptions): UseChatInputValidationReturn {
  const { maxLength, value, isStreaming, isDisabled, showFormatError } = opts

  const charCount = useMemo(() => value.length, [value])
  const isOverLimit = useMemo(
    () => !!(maxLength && charCount > maxLength * 0.9),
    [maxLength, charCount],
  )
  const isExceeded = useMemo(
    () => !!(maxLength && charCount > maxLength),
    [maxLength, charCount],
  )

  const canSend = useMemo(() => {
    return !isDisabled && !isStreaming && value.trim().length > 0 && !showFormatError
  }, [isDisabled, isStreaming, value, showFormatError])

  return { charCount, isOverLimit, isExceeded, canSend, errorMessage: '' }
}
