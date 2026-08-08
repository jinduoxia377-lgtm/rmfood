/**
 * RMFOOD 设计系统 — Button 按钮 (院士级版本)
 * 统一尺寸 / 变体 / 加载态 / 图标支持
 * 符合 WCAG 2.2 AA 标准
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'outline' | 'warning' | 'glass' | 'amber';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  'aria-label'?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  ai: 'btn-ai',
  outline: 'btn-outline',
  warning: 'btn-warning',
  glass: 'btn-glass',
  amber: 'btn-amber',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      icon,
      iconRight,
      children,
      disabled,
      fullWidth,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
          'transition-normal',
          'hover:scale-105 active:scale-95 btn-press',
          variantClasses[variant],
          sizeClasses[size],
          loading && 'pointer-events-none',
          fullWidth && 'w-full',
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" aria-hidden="true" />
        ) : icon ? (
          <span aria-hidden="true">{icon}</span>
        ) : null}
        {children && <span className="btn-content">{children}</span>}
        {!loading && iconRight && <span aria-hidden="true">{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
