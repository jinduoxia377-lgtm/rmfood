/**
 * RMFOOD 设计系统 — Button 按钮
 * 统一尺寸 / 变体 / 加载态 / 图标支持
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  ai: 'btn-ai',
  outline: 'border border-border-color hover:border-border-color-hover hover:bg-hover-bg dark:hover:bg-hover-bg',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, iconRight, children, disabled, fullWidth, ...props }, ref) => {
    const isDisabled = disabled || loading
    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          variantClasses[variant],
          sizeClasses[size],
          loading && 'pointer-events-none',
          fullWidth && 'w-full',
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : icon}
        {children && <span>{children}</span>}
        {!loading && iconRight}
      </button>
    )
  },
)

Button.displayName = 'Button'
export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
