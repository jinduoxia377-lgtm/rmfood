/**
 * RMFOOD 设计系统 — Card 卡片
 * 基础卡片容器，支持 hoverable / glass / outlined 三种变体，
 * 以及 Header / Title / Description / Content / Footer 子组件组合。
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ── Card 主容器 ── */

type CardVariant = 'default' | 'outlined';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
  glass?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable = false, glass = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          glass && 'glass-card',
          !glass && 'card',
          !glass && variant === 'outlined' && 'shadow-none border border-border-color',
          hoverable && 'card-hover cursor-pointer',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

/* ── CardHeader ── */

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 pb-0', className)} {...props}>
      {children}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

/* ── CardTitle ── */

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4';
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = 'h3', children, ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-lg font-semibold leading-snug tracking-tight text-text-primary', className)}
      {...props}
    >
      {children}
    </Tag>
  ),
);
CardTitle.displayName = 'CardTitle';

/* ── CardDescription ── */

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm leading-relaxed text-text-secondary', className)}
      {...props}
    >
      {children}
    </p>
  ),
);
CardDescription.displayName = 'CardDescription';

/* ── CardContent ── */

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-3', className)} {...props}>
      {children}
    </div>
  ),
);
CardContent.displayName = 'CardContent';

/* ── CardFooter ── */

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props}>
      {children}
    </div>
  ),
);
CardFooter.displayName = 'CardFooter';

/* ── 导出 ── */

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardProps, CardVariant, CardTitleProps };
