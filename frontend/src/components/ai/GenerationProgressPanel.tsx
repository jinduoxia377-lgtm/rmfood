import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { GenerationProgress } from '@/hooks/useGenerationProgress'
import { Loader2, X, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface GenerationProgressPanelProps {
  progress: GenerationProgress
  onCancel?: () => void
  showCancelButton?: boolean
  className?: string
}

const STAGE_CONFIG = {
  idle: {
    label: '等待中',
    color: 'bg-neutral-400',
    gradient: 'from-neutral-400 to-neutral-500',
    icon: null,
  },
  preparing: {
    label: '准备中',
    color: 'bg-secondary-500',
    gradient: 'from-secondary-400 to-secondary-600',
    icon: Loader2,
  },
  generating: {
    label: '生成配方',
    color: 'bg-info-500',
    gradient: 'from-info-400 to-info-600',
    icon: Loader2,
  },
  optimizing: {
    label: '优化方案',
    color: 'bg-warning-500',
    gradient: 'from-warning-400 to-warning-600',
    icon: Loader2,
  },
  validating: {
    label: '验证安全',
    color: 'bg-accent-500',
    gradient: 'from-accent-400 to-accent-600',
    icon: Loader2,
  },
  complete: {
    label: '生成完成',
    color: 'bg-success-500',
    gradient: 'from-success-400 to-success-600',
    icon: CheckCircle2,
  },
  error: {
    label: '生成失败',
    color: 'bg-error-500',
    gradient: 'from-error-400 to-error-600',
    icon: AlertCircle,
  },
}

function formatTime(seconds?: number): string {
  if (!seconds) return ''
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}分${secs}秒`
}

export function GenerationProgressPanel({
  progress,
  onCancel,
  showCancelButton = true,
  className,
}: GenerationProgressPanelProps) {
  const config = STAGE_CONFIG[progress.stage]
  const isActive = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error'
  const [announcement, setAnnouncement] = useState('')
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const previousStage = useRef(progress.stage)

  useEffect(() => {
    if (previousStage.current !== progress.stage) {
      if (progress.stage === 'complete') {
        setAnnouncement('配方生成完成')
      } else if (progress.stage === 'error') {
        setAnnouncement('配方生成失败')
      } else if (progress.stage === 'generating') {
        setAnnouncement('正在生成配方')
      }
      previousStage.current = progress.stage
    }
  }, [progress.stage])

  useEffect(() => {
    if (isActive && cancelButtonRef.current) {
      cancelButtonRef.current.focus()
    }
  }, [isActive])

  const handleCancelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCancel?.()
    }
  }

  if (progress.stage === 'idle') {
    return null
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white dark:bg-neutral-800 shadow-lg',
        'border-neutral-200 dark:border-neutral-700',
        className,
      )}
      role="region"
      aria-labelledby="progress-panel-title"
    >
      <span id="progress-panel-title" className="sr-only">配方生成进度面板</span>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="relative p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.icon && (
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-gradient-to-br ' + config.gradient,
                isActive && 'animate-pulse',
              )}>
                <config.icon className="w-4 h-4 text-white" />
              </div>
            )}
            {!config.icon && progress.stage === 'complete' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-success-400 to-success-600">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            )}
            {!config.icon && progress.stage === 'error' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-error-400 to-error-600">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {config.label}
              </span>
              {progress.message && (
                <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {progress.message}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {progress.estimatedTimeRemaining && isActive && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Clock className="w-3.5 h-3.5" />
                <span>约剩余 {formatTime(progress.estimatedTimeRemaining)}</span>
              </div>
            )}

            {progress.canCancel && showCancelButton && onCancel && (
              <button
                ref={cancelButtonRef}
                onClick={onCancel}
                onKeyDown={handleCancelKeyDown}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300',
                  'hover:bg-danger-100 dark:hover:bg-danger-900/30 hover:text-danger-600 dark:hover:text-danger-400',
                  'transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                )}
                aria-label="取消配方生成"
              >
                <X className="w-3.5 h-3.5" />
                取消
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <div
            className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`配方生成进度: ${progress.progress}%`}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                'bg-gradient-to-r ' + config.gradient,
                isActive && 'animate-pulse',
              )}
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>{progress.message}</span>
            <span className="font-medium text-primary-700 dark:text-primary-700">{progress.progress}%</span>
          </div>

          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {progress.progress < 100 ? `${progress.progress}%` : '100%'}
            </span>
            <div className="flex gap-1">
              {['preparing', 'generating', 'optimizing', 'validating'].map((stage) => {
                const stageProgress = {
                  preparing: 10,
                  generating: 40,
                  optimizing: 70,
                  validating: 90,
                }[stage]!
                const isComplete = progress.progress >= stageProgress
                const isCurrent = progress.stage === stage
                const dotColorClass = isComplete
                  ? isCurrent
                    ? config.color
                    : 'bg-neutral-400'
                  : 'bg-neutral-300 dark:bg-neutral-600'
                return (
                  <div
                    key={stage}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all duration-300',
                      dotColorClass,
                    )}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {progress.stage === 'complete' && (
          <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>{progress.message || '配方生成成功'}</span>
          </div>
        )}

        {progress.stage === 'error' && (
          <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-600">
            <AlertCircle className="w-4 h-4" />
            <span>{progress.message || '生成失败，请重试'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
