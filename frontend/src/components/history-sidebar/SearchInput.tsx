/**
 * 搜索输入组件
 * 参考 VS Code 搜索框设计
 */

import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClear?: () => void
}

export function SearchInput({ value, onChange, placeholder = '搜索对话...', onClear }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        if (value && onClear) {
          onClear()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [value, onClear])

  const handleClear = () => {
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border transition-all duration-200',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        'dark:border-neutral-700 dark:focus-within:border-primary',
      )}
      style={{
        background: 'var(--bg-surface-container-low)',
        borderColor: isFocused ? 'var(--color-primary)' : 'var(--border-color)',
        boxShadow: isFocused ? '0 0 0 3px var(--color-primary-container)' : 'none',
      }}
    >
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
        size={16}
        style={{ color: isFocused ? 'var(--color-primary)' : 'var(--text-muted)' }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full bg-transparent pl-9 pr-9 py-2 text-sm outline-none"
        style={{
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-body-sm)',
        }}
        aria-label="搜索对话"
      />
      {value && (
        <button
          onClick={handleClear}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md',
            'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors',
          )}
          style={{ color: 'var(--text-muted)' }}
          aria-label="清除搜索"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
