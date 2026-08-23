/**
 * RMFOOD 设计系统 — Select 下拉选择 (shadcn/ui 兼容层)
 *
 * Phase 5: 保留原生 <select> 实现以维持大小/error/placeholder API
 * 新增无障碍增强 (aria-invalid 等)，CSS 类保持兼容
 */
import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

type SelectSize = 'sm' | 'md' | 'lg'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize
  error?: string | boolean
  placeholder?: string
}

const sizeClasses: Record<SelectSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = 'md', error, placeholder, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'input w-full appearance-none pr-9 cursor-pointer transition-all duration-200',
          sizeClasses[size],
          error && 'input-error border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
          props.disabled && 'bg-neutral-700 text-text-disabled cursor-not-allowed',
          className,
        )}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        size={size === 'sm' ? 14 : 16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none"
      />
    </div>
  ),
)

Select.displayName = 'Select'
export { Select }
export type { SelectProps, SelectSize }
