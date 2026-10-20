import { logger } from '@/utils/safeLogger'
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pause,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Copy,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
} from 'lucide-react'

export type ProgressStage = 'idle' | 'preparing' | 'generating' | 'scoring' | 'optimizing' | 'sorting' | 'finalizing' | 'completed' | 'failed' | 'cancelled' | 'paused'

export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SubTask {
  id: string
  name: string
  status: SubTaskStatus
  progress: number
  current?: number
  total?: number
}

export interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export interface GenerationProgressState {
  stage: ProgressStage
  overallProgress: number
  currentStageName: string
  subTasks: SubTask[]
  logs: LogEntry[]
  startTime: number | null
  estimatedRemainingTime: number | null
  canPause: boolean
  canCancel: boolean
}

interface GenerationProgressProps {
  progress: Partial<GenerationProgressState>
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: () => void
  className?: string
  compact?: boolean
}

const STAGE_CONFIG: Record<ProgressStage, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: '就绪', color: 'gray', icon: <Clock className="w-4 h-4" /> },
  preparing: { label: '准备中', color: 'blue', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  generating: { label: '候选生成', color: 'purple', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  scoring: { label: '评分计算', color: 'cyan', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  optimizing: { label: '排序优化', color: 'amber', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  sorting: { label: '结果整理', color: 'emerald', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  finalizing: { label: '最终处理', color: 'teal', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  completed: { label: '完成', color: 'green', icon: <CheckCircle2 className="w-4 h-4" /> },
  failed: { label: '失败', color: 'red', icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: '已取消', color: 'gray', icon: <XCircle className="w-4 h-4" /> },
  paused: { label: '已暂停', color: 'amber', icon: <Pause className="w-4 h-4" /> },
}

const STATUS_ICONS: Record<SubTaskStatus, React.ReactNode> = {
  pending: <div className="w-3 h-3 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />,
  running: <Loader2 className="w-3 h-3 text-secondary-500 animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-success-500" />,
  failed: <XCircle className="w-3 h-3 text-error-500" />,
}

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-neutral-400',
  blue: 'bg-secondary-500',
  purple: 'bg-accent-500',
  cyan: 'bg-info-500',
  amber: 'bg-warning-500',
  emerald: 'bg-primary-500',
  teal: 'bg-success-500',
  green: 'bg-success-500',
  red: 'bg-error-500',
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function GenerationProgress({
  progress,
  onPause,
  onResume,
  onCancel,
  onRetry,
  className = '',
  compact = false,
}: GenerationProgressProps) {
  const [showLogs, setShowLogs] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const stageInfo = STAGE_CONFIG[progress.stage || 'idle']

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [progress.logs, showLogs])

  const elapsedTime = useMemo(() => {
    if (!progress.startTime) return 0
    // eslint-disable-next-line react-hooks/purity
    return (Date.now() - progress.startTime) / 1000
  }, [progress.startTime, progress.stage])

  const handleCopyLogs = useCallback(() => {
    if (!progress.logs?.length) return

    const logText = progress.logs
      .map(log => `[${log.timestamp}] [${log.level}] ${log.message}`)
      .join('\n')

    navigator.clipboard.writeText(logText).then(() => {
      logger.log('日志已复制到剪贴板')
    })
  }, [progress.logs])

  if (compact && (progress.stage === 'idle' || !progress.stage)) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden ${className}`}
      style={{ borderColor: `var(--tw-${stageInfo.color}-200, rgb(229, 231, 235))` }}
    >
      {/* 主进度条区域 */}
      <div className="p-5 space-y-4">
        {/* 进度头部信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`${COLOR_MAP[stageInfo.color] || 'bg-neutral-400'} text-white p-1.5 rounded-lg`}>
              {stageInfo.icon}
            </span>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {progress.currentStageName || stageInfo.label}
              </h4>
              {(progress.stage !== 'idle' && progress.stage !== 'completed' && progress.stage !== 'failed' && progress.stage !== 'cancelled') && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  已用时 {formatTime(elapsedTime)}
                  {progress.estimatedRemainingTime != null && (
                    <span className="ml-2">预计剩余 ~{formatTime(progress.estimatedRemainingTime)}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* 百分比显示 */}
          <motion.div
            key={progress.overallProgress || 0}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-right"
          >
            <span className="text-2xl font-bold text-neutral-900 dark:text-white">
              {Math.round(progress.overallProgress || 0)}%
            </span>
          </motion.div>
        </div>

        {/* 总进度条 */}
        <div className="relative h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              backgroundColor:
                progress.stage === 'failed'
                  ? 'rgb(239, 68, 68)'
                  : progress.stage === 'cancelled'
                  ? 'rgb(156, 163, 175)'
                  : `linear-gradient(90deg, rgb(16, 185, 129), rgb(20, 184, 166))`,
              width: `${Math.max(0, Math.min(100, progress.overallProgress || 0))}%`,
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          {/* 动画光效 */}
          {(progress.stage !== 'idle' &&
            progress.stage !== 'completed' &&
            progress.stage !== 'failed' &&
            progress.stage !== 'cancelled') && (
            <motion.div
              className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ left: ['-20%', '120%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* 子任务列表 */}
        {!compact && progress.subTasks && progress.subTasks.length > 0 && (
          <div className="space-y-2">
            {progress.subTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <span>{STATUS_ICONS[task.status]}</span>
                <span className={`flex-1 ${task.status === 'failed' ? 'text-error-600 dark:text-error-600' : task.status === 'completed' ? 'text-neutral-500 dark:text-neutral-400 line-through' : 'text-neutral-700 dark:text-neutral-300'}`}>
                  {task.name}
                </span>
                {task.status === 'running' && task.total != null && (
                  <span className="text-xs text-secondary-600 dark:text-secondary-700 font-medium">
                    ({task.current || 0}/{task.total})
                  </span>
                )}
                {task.status === 'running' && (
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{task.progress}%</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 控制按钮组 */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex gap-2">
            {progress.canPause && progress.stage !== 'paused' && onPause && (
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-warning-700 bg-warning-50 dark:bg-warning-300/20 hover:bg-warning-100 dark:hover:bg-warning-900/30 rounded-lg transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                暂停
              </button>
            )}

            {progress.stage === 'paused' && onResume && (
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 dark:bg-primary-300/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                继续
              </button>
            )}

            {progress.canCancel && onCancel && (
              <button
                onClick={() => {
                  if (window.confirm('确定要取消生成吗？当前中间结果将被保留。')) {
                    onCancel()
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-error-700 bg-error-50 dark:bg-error-300/20 hover:bg-error-100 dark:hover:bg-error-900/30 rounded-lg transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                取消
              </button>
            )}

            {progress.stage === 'failed' && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-secondary-700 bg-secondary-50 dark:bg-secondary-300/20 hover:bg-secondary-100 dark:hover:bg-secondary-900/30 rounded-lg transition-colors"
              >
                <Loader2 className="w-3.5 h-3.5" />
                重试
              </button>
            )}
          </div>

          {/* 日志面板切换 */}
          {!compact && progress.logs && progress.logs.length > 0 && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              日志 ({progress.logs.length})
            </button>
          )}
        </div>

        {/* 日志面板 */}
        <AnimatePresence>
          {showLogs && progress.logs && progress.logs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-neutral-900 dark:bg-black rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-700">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">实时日志</span>
                  <button
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-white transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    复制
                  </button>
                </div>
                <div className="space-y-1">
                  {progress.logs.map((log, index) => (
                    <div
                      key={index}
                      className={`${
                        log.level === 'ERROR'
                          ? 'text-error-400'
                          : log.level === 'WARN'
                          ? 'text-warning-400'
                          : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                      }`}
                    >
                      <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">[{log.timestamp}]</span>{' '}
                      <span
                        className={
                          log.level === 'ERROR'
                            ? 'text-error-500'
                            : log.level === 'WARN'
                            ? 'text-warning-500'
                            : 'text-info-400'
                        }
                      >
                        [{log.level}]
                      </span>{' '}
                      {log.message}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function useGenerationProgressState() {
  const [state, setState] = useState<GenerationProgressState>({
    stage: 'idle',
    overallProgress: 0,
    currentStageName: '',
    subTasks: [],
    logs: [],
    startTime: null,
    estimatedRemainingTime: null,
    canPause: true,
    canCancel: true,
  })

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setState(prev => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          timestamp: formatTimestamp(new Date()),
          level,
          message,
        },
      ],
    }))
  }, [])

  const updateSubTask = useCallback((taskId: string, updates: Partial<SubTask>) => {
    setState(prev => ({
      ...prev,
      subTasks: prev.subTasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task,
      ),
    }))
  }, [])

  const startGeneration = useCallback(() => {
    const now = Date.now()
    setState({
      stage: 'preparing',
      overallProgress: 0,
      currentStageName: '正在准备...',
      subTasks: [
        { id: 'generate', name: '候选生成', status: 'pending', progress: 0, total: 50 },
        { id: 'score', name: '评分计算', status: 'pending', progress: 0, total: 50 },
        { id: 'optimize', name: '排序优化', status: 'pending', progress: 0 },
        { id: 'finalize', name: '结果整理', status: 'pending', progress: 0 },
      ],
      logs: [],
      startTime: now,
      estimatedRemainingTime: null,
      canPause: true,
      canCancel: true,
    })
    addLog('INFO', '配方生成任务启动')
  }, [addLog])

  const completeGeneration = useCallback((success = true) => {
    setState(prev => ({
      ...prev,
      stage: success ? 'completed' : 'failed',
      overallProgress: 100,
      canPause: false,
      canCancel: false,
    }))
    addLog(success ? 'INFO' : 'ERROR', success ? '配方生成完成' : '配方生成失败')
  }, [addLog])

  const pauseGeneration = useCallback(() => {
    setState(prev => ({ ...prev, stage: 'paused', canPause: false }))
    addLog('WARN', '生成任务已暂停')
  }, [addLog])

  const resumeGeneration = useCallback(() => {
    setState(prev => ({ ...prev, stage: prev.subTasks.some(t => t.status === 'running') ? 'generating' : 'preparing', canPause: true }))
    addLog('INFO', '生成任务已恢复')
  }, [addLog])

  const cancelGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      stage: 'cancelled',
      canPause: false,
      canCancel: false,
    }))
    addLog('WARN', '生成任务已取消，保留中间结果')
  }, [addLog])

  return {
    state,
    setState,
    addLog,
    updateSubTask,
    startGeneration,
    completeGeneration,
    pauseGeneration,
    resumeGeneration,
    cancelGeneration,
  }
}

export default GenerationProgress
