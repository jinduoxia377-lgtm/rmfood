/**
 * RMFOOD 设计系统 — PageState 页面状态组件
 * 统一处理 loading / empty / error / success 四种页面状态
 */
import { forwardRef, type ReactNode } from 'react';
import { Loader2, Inbox, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface PageStateProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  isSuccess?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loadingText?: string;
  errorTitle?: string;
  children?: ReactNode;
  className?: string;
}

export const PageState = forwardRef<HTMLDivElement, PageStateProps>(
  (
    {
      isLoading,
      isEmpty,
      error,
      isSuccess,
      onRetry,
      emptyTitle = '暂无数据',
      emptyDescription = '当前列表为空，添加新项开始吧',
      emptyAction,
      loadingText = '加载中...',
      errorTitle = '加载失败',
      children,
      className,
    },
    ref,
  ) => {
    // Loading 状态
    if (isLoading) {
      return (
        <div ref={ref} className={cn('flex flex-col items-center justify-center py-20', className)}>
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
          <p className="text-sm text-neutral-500">{loadingText}</p>
        </div>
      );
    }

    // Error 状态
    if (error) {
      return (
        <div ref={ref} className={cn('flex flex-col items-center justify-center py-20', className)}>
          <AlertCircle className="w-10 h-10 text-error-500 mb-4" />
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">{errorTitle}</h3>
          <p className="text-sm text-neutral-500 mb-4 max-w-sm text-center">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              重试
            </Button>
          )}
        </div>
      );
    }

    // Empty 状态
    if (isEmpty) {
      return (
        <div ref={ref} className={cn('flex flex-col items-center justify-center py-20', className)}>
          <Inbox className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-4" />
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">{emptyTitle}</h3>
          <p className="text-sm text-neutral-500 mb-4 max-w-sm text-center">{emptyDescription}</p>
          {emptyAction}
        </div>
      );
    }

    // Success 状态
    if (isSuccess) {
      return (
        <div ref={ref} className={cn('flex flex-col items-center justify-center py-20', className)}>
          <CheckCircle2 className="w-10 h-10 text-primary-500 mb-4" />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">操作成功</p>
        </div>
      );
    }

    // Normal 状态
    return <div ref={ref} className={className}>{children}</div>;
  },
);

PageState.displayName = 'PageState';
