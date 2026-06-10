/**
 * Material Design 3 Card 组件
 *
 * 基于 Material Design 3 规范，支持多种变体和交互状态
 */

import React from 'react';
import clsx from 'clsx';

export type CardVariant = 'elevated' | 'filled' | 'outlined';
export type CardSize = 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  size?: CardSize;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  size = 'md',
  interactive = false,
  className,
  children,
  ...props
}) => {
  const baseStyles = clsx(
    'rounded-lg',
    'transition-all duration-200',
  );

  const variantStyles = {
    elevated: clsx(
      'bg-surface',
      'shadow-[var(--elevation-1)]',
      'hover:shadow-[var(--elevation-2)]',
    ),
    filled: clsx(
      'bg-surface-variant',
    ),
    outlined: clsx(
      'bg-surface',
      'border border-border',
    ),
  };

  const sizeStyles = {
    sm: clsx(
      'p-4',
    ),
    md: clsx(
      'p-6',
    ),
    lg: clsx(
      'p-8',
    ),
  };

  const interactiveStyles = clsx(
    interactive && 'cursor-pointer',
    interactive && 'hover:scale-[1.01]',
    interactive && 'active:scale-[0.99]',
    interactive && 'focus:outline-none',
    interactive && 'focus:ring-2',
    interactive && 'focus:ring-primary/50',
    interactive && 'focus:ring-offset-2',
    interactive && 'focus:ring-offset-surface',
  );

  return (
    <div
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        interactiveStyles,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
