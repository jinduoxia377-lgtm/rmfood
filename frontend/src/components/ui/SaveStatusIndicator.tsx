/**
 * 保存状态指示器组件
 * 显示表单的保存状态：未保存 / 保存中 / 已保存
 */
import { cn } from '@/lib/utils'
import { CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react'

export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'error'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  /** 最后保存时间 */
  savedAt?: Date | null
  /** 错误消息 */
  errorMessage?: string
  className?: string
}

const STATUS_CONFIG: Record<SaveStatus, {
  icon: typeof CheckCircle2
  label: string
  className: string
}> = {
  unsaved: {
    icon: CloudOff,
    label: '未保存',
    className: 'text-slate-500 dark:text-slate-400',
  },
  saving: {
    icon: Loader2,
    label: '保存中...',
    className: 'text-blue-500 dark:text-blue-400',
  },
  saved: {
    icon: CheckCircle2,
    label: '已保存',
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: CloudOff,
    label: '保存失败',
    className: 'text-danger-500 dark:text-danger-400',
  },
}

export function SaveStatusIndicator({
  status,
  savedAt,
  errorMessage,
  className,
}: SaveStatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        config.className,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        size={12}
        className={cn(
          'shrink-0',
          status === 'saving' && 'animate-spin',
        )}
      />
      <span>
        {status === 'saved' && savedAt
          ? `已保存 ${formatTime(savedAt)}`
          : status === 'error' && errorMessage
            ? errorMessage
            : config.label
        }
      </span>
    </span>
  )
}
