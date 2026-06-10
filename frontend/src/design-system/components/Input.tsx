/**
 * Material Design 3 Input 组件
 *
 * 基于 Material Design 3 规范，支持多种状态和变体
 */

import React from 'react';
import clsx from 'clsx';

export type InputVariant = 'outlined' | 'filled';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  size?: InputSize;
  label?: string;
  error?: boolean;
  helperText?: string;
  className?: string;
}

const Input: React.FC<InputProps> = ({
  variant = 'outlined',
  size = 'md',
  label,
  error = false,
  helperText,
  className,
  ...props
}) => {
  const baseStyles = clsx(
    'w-full',
    'font-medium',
    'transition-all',
    'focus:outline-none',
    'disabled:opacity-38',
    'disabled:cursor-not-allowed',
  );

  const variantStyles = {
    outlined: clsx(
      'bg-transparent',
      'border-2',
      'border-border',
      'focus:border-primary',
      'focus:ring-2',
      'focus:ring-primary/20',
      error && 'border-error',
      error && 'focus:border-error',
      error && 'focus:ring-error/20',
    ),
    filled: clsx(
      'bg-surface-variant',
      'border-none',
      'focus:bg-surface-variant/80',
      error && 'bg-error-container/50',
    ),
  };

  const sizeStyles = {
    sm: clsx(
      'h-9',
      'px-3',
      'text-sm',
      'rounded-md',
      label && 'pt-4',
    ),
    md: clsx(
      'h-10',
      'px-4',
      'text-sm',
      'rounded-lg',
      label && 'pt-5',
    ),
    lg: clsx(
      'h-12',
      'px-4',
      'text-base',
      'rounded-xl',
      label && 'pt-6',
    ),
  };

  return (
    <div className="relative">
      {label && (
        <label
          className={clsx(
            'absolute',
            'pointer-events-none',
            'transition-all',
            'duration-200',
            size === 'sm' && 'top-2 left-3 text-xs',
            size === 'md' && 'top-2.5 left-4 text-sm',
            size === 'lg' && 'top-3 left-4 text-base',
            props.value ? (
              size === 'sm' ? 'top-0.5 text-xs' :
              size === 'md' ? 'top-0.5 text-xs' : 'top-1 text-sm'
            ) : '',
            'text-text-tertiary',
            error && 'text-error',
          )}
        >
          {label}
        </label>
      )}
      <input
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
      {helperText && (
        <p className={clsx(
          'mt-1',
          'text-xs',
          error ? 'text-error' : 'text-text-tertiary',
        )}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
