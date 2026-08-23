/**
 * RMFOOD 设计系统 — Checkbox (Radix 兼容层)
 *
 * Phase 6: 使用 @radix-ui/react-checkbox 替代原生 input
 * 保留 id/checked/onCheckedChange/label/indeterminate API
 */
import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void
  label?: string
  indeterminate?: boolean
}

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  onChange,
  className,
  disabled = false,
  label,
  indeterminate = false,
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  const handleChange = (nextChecked: boolean) => {
    onCheckedChange?.(nextChecked)
  }

  return (
    <div className="flex items-center gap-2">
      <CheckboxPrimitive.Root
        ref={inputRef}
        id={id}
        checked={checked}
        onCheckedChange={handleChange}
        disabled={disabled}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-neutral-300 bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-600 data-[state=checked]:text-white transition-colors',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
          <Check className="h-3 w-3" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-text-secondary cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          )}
        >
          {label}
        </label>
      )}
    </div>
  )
}

export type { CheckboxProps }
