/**
 * RMFOOD 设计系统 — Textarea 文本域
 * 支持 auto-resize / error / disabled / 字符计数 状态
 */
import { forwardRef, type TextareaHTMLAttributes, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
  error?: string | boolean;
  /** 显示字符计数（需要配合 maxLength 使用） */
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, error, showCount, maxLength, value, defaultValue, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    // 合并外部 ref 和内部 ref
    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };

    // 自动调整高度
    useEffect(() => {
      if (autoResize && innerRef.current) {
        const el = innerRef.current;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
    }, [autoResize, value, defaultValue]);

    const currentLength = typeof value === 'string' ? value.length : 0;
    const isNearLimit = maxLength !== undefined && currentLength > maxLength * 0.8;
    const isOverLimit = maxLength !== undefined && currentLength > maxLength;

    return (
      <div className="relative w-full">
        <textarea
          ref={setRef}
          className={cn(
            'input w-full min-h-[80px] resize-y transition-all duration-200',
            showCount && maxLength && 'pb-7',
            error && 'input-error border-danger-500 focus:ring-danger-500/20 focus:border-danger-500',
            isOverLimit && 'border-danger-500 focus:ring-danger-500/20',
            className,
          )}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCount && maxLength !== undefined && (
          <span
            className={cn(
              'absolute bottom-2 right-3 text-xs tabular-nums pointer-events-none',
              isOverLimit
                ? 'text-danger-500 font-medium'
                : isNearLimit
                  ? 'text-warning-500'
                  : 'text-neutral-400 dark:text-neutral-500',
            )}
          >
            {currentLength}/{maxLength}
          </span>
        )}
        {typeof error === 'string' && error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
export { Textarea };
export type { TextareaProps };
