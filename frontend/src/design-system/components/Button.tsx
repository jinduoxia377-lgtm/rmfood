/**
 * Material Design 3 Button 组件
 *
 * 基于 Material Design 3 规范，支持多种变体和状态
 */

import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'filled' | 'filledTonal' | 'outlined' | 'text';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonIconPosition = 'left' | 'right';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: ButtonIconPosition;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) => {
  const baseStyles = clsx(
    'inline-flex items-center justify-center font-medium transition-all',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
    'disabled:opacity-38 disabled:cursor-not-allowed',
    'active:scale-[0.98]',
    // 触摸目标最小尺寸
    'min-h-[40px] min-w-[40px]',
  );

  const variantStyles = {
    filled: clsx(
      'bg-primary text-primary-on',
      'hover:bg-primary-hover',
      'active:bg-primary-pressed',
      'focus:ring-primary',
    ),
    filledTonal: clsx(
      'bg-secondary-container text-on-secondary-container',
      'hover:bg-secondary-container/80',
      'focus:ring-secondary',
    ),
    outlined: clsx(
      'border-2 border-outline text-primary',
      'hover:bg-primary/8',
      'focus:ring-primary',
      'border-primary/30',
    ),
    text: clsx(
      'text-primary',
      'hover:bg-primary/8',
      'focus:ring-primary',
    ),
  };

  const sizeStyles = {
    xs: clsx(
      'h-7 px-2 text-xs',
      icon && 'gap-1',
      icon && !children && 'p-1.5',
    ),
    sm: clsx(
      'h-9 px-3 text-sm',
      icon && 'gap-1.5',
      icon && !children && 'p-2',
    ),
    md: clsx(
      'h-10 px-4 text-sm',
      icon && 'gap-2',
      icon && !children && 'p-2.5',
    ),
    lg: clsx(
      'h-12 px-6 text-base',
      icon && 'gap-2.5',
      icon && !children && 'p-3',
    ),
  };

  const iconStyles = clsx(
    'shrink-0',
    size === 'xs' && 'w-3.5 h-3.5',
    size === 'sm' && 'w-4 h-4',
    size === 'md' && 'w-4 h-4',
    size === 'lg' && 'w-5 h-5',
  );

  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={clsx('animate-spin', iconStyles)}>
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </span>
      ) : icon && iconPosition === 'left' ? (
        <span className={iconStyles}>{icon}</span>
      ) : null}

      {children && (
        <span className="not-sr-only">{children}</span>
      )}

      {!loading && icon && iconPosition === 'right' ? (
        <span className={iconStyles}>{icon}</span>
      ) : null}
    </button>
  );
};

export default Button;
