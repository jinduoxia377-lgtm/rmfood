/**
 * RMFOOD 设计系统 — Tooltip 提示框 v2.0
 *
 * 完整可访问的 Tooltip 组件，支持：
 * - ARIA 属性 (role="tooltip", aria-describedby)
 * - 键盘交互 (focus/blur 触发)
 * - 暗色模式
 * - 四个定位方向 (top/bottom/left/right)
 * - 延迟显示 (300ms)
 * - 鼠标悬停时不消失的智能行为
 */
import { useState, useRef, useCallback, useEffect, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
}

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 dark:border-t-slate-200',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 dark:border-b-slate-200',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 dark:border-l-slate-200',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 dark:border-r-slate-200',
};

export function Tooltip({ content, children, position = 'top', delay = 300, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const clearTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    showTimerRef.current = setTimeout(() => setIsVisible(true), delay);
  }, [delay, clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {/* Trigger element — described by the tooltip */}
      <div
        className="cursor-pointer inline-flex"
        tabIndex={0}
        role="button"
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </div>

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-3 py-2',
            'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900',
            'text-sm rounded-lg shadow-lg',
            'whitespace-nowrap pointer-events-none',
            'animate-[scale-in_0.15s_ease-out]',
            positionClasses[position],
            className,
          )}
        >
          {content}
          {/* Arrow */}
          <div className={cn('absolute border-4 border-transparent', arrowClasses[position])} />
        </div>
      )}
    </div>
  );
}

export type { TooltipProps, TooltipPosition };
