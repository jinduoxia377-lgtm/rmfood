/**
 * 滚动显示包裹组件 — 供所有 section 复用
 */
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useReveal } from './useReveal';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: string;
}

export const Reveal = forwardRef<HTMLDivElement, RevealProps>(
  ({ children, className, delay = '' }, ref) => {
    const innerRef = useReveal();
    return (
      <div
        ref={ref ?? innerRef}
        className={cn('lp-reveal', delay, className)}
      >
        {children}
      </div>
    );
  }
);
Reveal.displayName = 'Reveal';
