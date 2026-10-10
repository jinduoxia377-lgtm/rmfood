
import { Save, Check, AlertCircle, Loader2, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '@/stores/academicReportStore';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: string | null;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  error,
  onRetry,
  className,
}: SaveStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          icon: <Save className="w-4 h-4" />,
          text: '未保存',
          color: 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
          bgColor: 'bg-neutral-100 dark:bg-neutral-800',
        };
      case 'saving':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: '保存中...',
          color: 'text-secondary-500',
          bgColor: 'bg-secondary-100 dark:bg-secondary-300/25',
        };
      case 'saved':
        return {
          icon: <Check className="w-4 h-4" />,
          text: '已保存',
          color: 'text-success-600',
          bgColor: 'bg-success-100 dark:bg-success-300/25',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: '保存失败',
          color: 'text-error-600',
          bgColor: 'bg-error-100 dark:bg-error-300/25',
        };
      case 'conflict':
        return {
          icon: <CloudOff className="w-4 h-4" />,
          text: '存在冲突',
          color: 'text-warning-600',
          bgColor: 'bg-warning-100 dark:bg-warning-300/25',
        };
    }
  };

  const config = getStatusConfig();

  const formatLastSavedTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', config.bgColor)}>
        <span className={config.color}>{config.icon}</span>
        <span className={cn('text-sm font-medium', config.color)}>{config.text}</span>
        {status === 'saved' && lastSavedAt && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatLastSavedTime(lastSavedAt)}
          </span>
        )}
      </div>

      {status === 'error' && error && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-error-600 dark:text-error-600">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 text-sm bg-error-100 dark:bg-error-300/25 text-error-600 dark:text-error-600 rounded-full hover:bg-error-200 dark:hover:bg-error-900/50 transition-colors"
            >
              重试
            </button>
          )}
        </div>
      )}

      {status === 'conflict' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-warning-600 dark:text-warning-700">
            检测到文档冲突，请先解决冲突
          </span>
          <button
            onClick={() => {}}
            className="px-3 py-1 text-sm bg-warning-100 dark:bg-warning-300/25 text-warning-600 dark:text-warning-700 rounded-full hover:bg-warning-200 dark:hover:bg-warning-900/50 transition-colors"
          >
            查看冲突
          </button>
        </div>
      )}
    </div>
  );
}

interface AutoSaveIndicatorProps {
  enabled: boolean;
  interval: number;
  onToggle: () => void;
  className?: string;
}

export function AutoSaveIndicator({
  enabled,
  interval,
  onToggle,
  className,
}: AutoSaveIndicatorProps) {
  const formatInterval = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    return `${Math.floor(seconds / 60)} 分钟`;
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          enabled
            ? 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-600'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
        )}
      >
        <div className={cn(
          'w-2 h-2 rounded-full',
          enabled ? 'bg-success-500 animate-pulse' : 'bg-neutral-400',
        )} />
        自动保存 {enabled ? '已开启' : '已关闭'}
      </button>

      {enabled && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          每 {formatInterval(interval)} 自动保存
        </span>
      )}
    </div>
  );
}
