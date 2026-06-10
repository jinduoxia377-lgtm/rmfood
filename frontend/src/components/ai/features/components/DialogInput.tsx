import React, { memo, useRef, useEffect, useState, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom'
  value?: number | string | RegExp
  message: string
  validator?: (value: string) => boolean
}

export interface DialogInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  placeholder?: string
  maxLength?: number
  minLength?: number
  validationRules?: ValidationRule[]
  disabled?: boolean
  isLoading?: boolean
  autoResize?: boolean
  showCharCount?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  className?: string
}

const DialogInput = memo(
  forwardRef<HTMLTextAreaElement, DialogInputProps>(
    (
      {
        value,
        onChange,
        onSend,
        placeholder = '输入您的消息...',
        maxLength = 2000,
        minLength = 0,
        validationRules = [],
        disabled = false,
        isLoading = false,
        autoResize = true,
        showCharCount = true,
        onFocus,
        onBlur,
        onKeyDown,
        className,
        ...props
      },
      ref,
    ) => {
      const inputRef = useRef<HTMLTextAreaElement>(null)
      const [inputHeight, setInputHeight] = useState(44)
      const [isFocused, setIsFocused] = useState(false)
      const [errors, setErrors] = useState<string[]>([])
      const [charCount, setCharCount] = useState(0)

      useEffect(() => {
        setCharCount(value.length)
      }, [value])

      useEffect(() => {
        if (autoResize && inputRef.current) {
          const scrollHeight = inputRef.current.scrollHeight
          const newHeight = Math.max(44, Math.min(scrollHeight, 180))
          setInputHeight(newHeight)
          inputRef.current.style.height = `${newHeight}px`
        }
      }, [value, autoResize])

      const validateInput = useCallback((value: string): string[] => {
        const validationErrors: string[] = []

        const defaultRules: ValidationRule[] = [
          { type: 'minLength', value: minLength, message: `至少输入 ${minLength} 个字符` },
          { type: 'maxLength', value: maxLength, message: `最多输入 ${maxLength} 个字符` },
        ]

        const allRules = [...defaultRules, ...validationRules]

        for (const rule of allRules) {
          switch (rule.type) {
            case 'required':
              if (!value.trim()) {
                validationErrors.push(rule.message)
              }
              break
            case 'minLength':
              if (value.length < (rule.value as number)) {
                validationErrors.push(rule.message)
              }
              break
            case 'maxLength':
              if (value.length > (rule.value as number)) {
                validationErrors.push(rule.message)
              }
              break
            case 'pattern':
              const pattern = rule.value instanceof RegExp
                ? rule.value
                : new RegExp(rule.value as string)
              if (!pattern.test(value)) {
                validationErrors.push(rule.message)
              }
              break
            case 'email':
              const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              if (!emailPattern.test(value)) {
                validationErrors.push(rule.message)
              }
              break
            case 'url':
              const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
              if (!urlPattern.test(value)) {
                validationErrors.push(rule.message)
              }
              break
            case 'custom':
              if (rule.validator && !rule.validator(value)) {
                validationErrors.push(rule.message)
              }
              break
          }
        }

        return validationErrors
      }, [minLength, maxLength, validationRules])

      useEffect(() => {
        const validationErrors = validateInput(value)
        setErrors(validationErrors)
      }, [value, validateInput])

      const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange(e.target.value)
        },
        [onChange],
      )

      const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
          if (onKeyDown) {
            onKeyDown(e)
          }

          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!disabled && !isLoading && value.trim()) {
              const validationErrors = validateInput(value)
              if (validationErrors.length === 0) {
                onSend?.()
              }
            }
          }

          if (e.key === 'Escape') {
            inputRef.current?.blur()
          }
        },
        [disabled, isLoading, value, onSend, validateInput, onKeyDown],
      )

      const handleFocus = useCallback(() => {
        setIsFocused(true)
        onFocus?.()
      }, [onFocus])

      const handleBlur = useCallback(() => {
        setIsFocused(false)
        onBlur?.()
      }, [onBlur])

      const hasError = errors.length > 0
      const isOverLimit = maxLength && charCount > maxLength * 0.9
      const isExceeded = maxLength && charCount > maxLength

      return (
        <div className="flex flex-col w-full">
          <div
            className={cn(
              'flex items-center bg-gray-50 dark:bg-gray-800 rounded-full border-2 transition-all duration-300 overflow-hidden shadow-sm',
              isFocused
                ? 'border-primary-500 dark:border-primary-500 shadow-lg shadow-primary-500/15'
                : 'border-gray-200 dark:border-gray-700',
              hasError
                ? 'border-red-500 dark:border-red-500 shadow-lg shadow-red-500/15'
                : '',
              disabled || isLoading ? 'opacity-60' : '',
              className,
            )}
          >
            <textarea
              ref={(el) => {
                inputRef.current = el
                if (typeof ref === 'function') ref(el)
                else if (ref) (ref).current = el
              }}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled || isLoading}
              placeholder={placeholder}
              maxLength={maxLength}
              className="flex-1 resize-none text-base sm:text-sm leading-[1.6] tracking-[0.01em] px-4 py-3 bg-transparent border-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-0 transition-all duration-200 min-h-[44px]"
              style={{ height: `${inputHeight}px`, maxHeight: '180px' }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              {...props}
            />
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            {showCharCount && (
              <div
                className={cn(
                  'text-xs transition-colors',
                  isExceeded
                    ? 'text-red-500 dark:text-red-400 font-semibold'
                    : isOverLimit
                    ? 'text-orange-500'
                    : 'text-gray-400',
                )}
              >
                {charCount}/{maxLength}
                {isOverLimit && !isExceeded && (
                  <span className="ml-1 text-gray-400">即将达到限制</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="hidden sm:inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">
                  Shift
                </kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">
                  Enter
                </kbd>
                <span className="ml-1">换行</span>
              </span>
              <span className="hidden sm:inline text-gray-300">·</span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono border border-gray-200 dark:border-gray-700">
                  Enter
                </kbd>
                <span className="ml-1">发送</span>
              </span>
            </div>
          </div>

          {hasError && (
            <div className="mt-2 space-y-1">
              {errors.map((error, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
  ),
)

DialogInput.displayName = 'DialogInput'

export { DialogInput }
