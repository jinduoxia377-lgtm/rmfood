/**
 * useChatInputBehavior - 输入行为管理 Hook (v1.0)
 *
 * 职责：
 * - 输入框聚焦/失焦
 * - 自动高度调整（textarea auto-expand）
 * - 字符计数与限制校验
 * - 语言检测
 * - 用户偏好行为配置（autoResize, minHeight, maxHeight）
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { languageService, type LanguageCode } from '../services/languageService'
import {
  userPreferencesService,
  type InputBehaviorConfig,
} from '../services/userPreferencesService'

export interface UseChatInputBehaviorOptions {
  maxLength?: number
  initialValue?: string
  onChange?: (value: string) => void
}

export interface UseChatInputBehaviorReturn {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  isFocused: boolean
  onFocus: () => void
  onBlur: () => void
  inputHeight: number
  charCount: number
  detectedLanguage: LanguageCode
  inputBehavior: InputBehaviorConfig
  isOverLimit: boolean
  isExceeded: boolean
  showFormatError: boolean
  errorMessage: string
}

const MIN_HEIGHT = 44
const MAX_HEIGHT = 200

export function useChatInputBehavior(
  options: UseChatInputBehaviorOptions = {},
): UseChatInputBehaviorReturn {
  const { maxLength, initialValue = '', onChange: propsOnChange } = options

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState(initialValue)
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT)
  const [isFocused, setIsFocused] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode>('zh-CN')
  const [inputBehavior, setInputBehavior] = useState<InputBehaviorConfig>(
    userPreferencesService.getInputBehavior(),
  )
  const [showFormatError, setShowFormatError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 监听外部 initialValue 变化
  useEffect(() => {
    if (initialValue !== value) setValue(initialValue)
  }, [initialValue, value])

  // 监听用户偏好
  useEffect(() => {
    const subscription = userPreferencesService.subscribe((prefs) => {
      setInputBehavior(prefs.inputBehavior)
    })
    return subscription
  }, [])

  // 语言检测
  useEffect(() => {
    const detected = languageService.detectLanguage(value)
    setDetectedLanguage(detected.language)
  }, [value])

  // 字符计数与限制校验
  useEffect(() => {
    setCharCount(value.length)
    if (maxLength && value.length > maxLength) {
      setShowFormatError(true)
      setErrorMessage(`输入超过 ${maxLength} 字符限制`)
    } else {
      setShowFormatError(false)
      setErrorMessage('')
    }
  }, [value, maxLength])

  // 自动高度调整
  useEffect(() => {
    if (inputBehavior.autoResize && inputRef.current) {
      const scrollHeight = inputRef.current.scrollHeight
      const newHeight = Math.max(
        inputBehavior.minHeight ?? MIN_HEIGHT,
        Math.min(scrollHeight, inputBehavior.maxHeight ?? MAX_HEIGHT),
      )
      setInputHeight(newHeight)
      inputRef.current.style.height = `${newHeight}px`
    }
  }, [value, inputBehavior])

  const onChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      propsOnChange?.(newValue)
    },
    [propsOnChange],
  )

  const onFocus = useCallback(() => setIsFocused(true), [])
  const onBlur = useCallback(() => setIsFocused(false), [])

  const isOverLimit = useMemo(
    () => !!(maxLength && charCount > maxLength * 0.9),
    [maxLength, charCount],
  )
  const isExceeded = useMemo(
    () => !!(maxLength && charCount > maxLength),
    [maxLength, charCount],
  )

  return {
    inputRef, fileInputRef, value, onChange,
    isFocused, onFocus, onBlur, inputHeight, charCount,
    detectedLanguage, inputBehavior,
    isOverLimit, isExceeded,
    showFormatError, errorMessage,
  }
}
