import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Card,
  Button,
  Badge,
  Progress,
} from '@/components/ui'
import {
  Dna,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Clock,
  Upload,
  Square,
  Download,
} from 'lucide-react'
import { peptideAnalysisApi, type PeptideAnalysisData } from '@/api/ai'
import { logger } from '@/utils/safeLogger'

// ─── 类型 ──────────────────────────────────────────────────────────────────────

type PeptideTaskStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'paused'

interface PeptideBatchTask {
  id: string
  sequence: string
  status: PeptideTaskStatus
  progress: number
  result?: PeptideAnalysisData
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}


/** 从 PeptideAnalysisData.details 中提取质量分数 */
function getQualityScore(data: PeptideAnalysisData | undefined): number | null {
  if (!data) return null
  const overall = data.details?.find(d => d.dimension_type === 'overall')
  if (!overall) return null
  const score = (overall.data as Record<string, unknown>)['quality_score']
  return typeof score === 'number' ? score : null
}

interface BatchPeptideAnalyzerProps {
  className?: string
  maxConcurrent?: number
}

const DEFAULT_MAX_CONCURRENT = 3

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function parseSequences(text: string): string[] {
  return text
    .split(/[\n,;，；\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2,30}$/.test(s))
    .filter((s, i, arr) => arr.indexOf(s) === i) // deduplicate
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export function BatchPeptideAnalyzer({
  className = '',
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: BatchPeptideAnalyzerProps) {
  const [tasks, setTasks] = useState<PeptideBatchTask[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const processingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // 统计
  const activeTasks = useMemo(() => tasks.filter((t) => t.status === 'processing'), [tasks])
  const queuedTasks = useMemo(() => tasks.filter((t) => t.status === 'queued'), [tasks])
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks])
  const failedTasks = useMemo(() => tasks.filter((t) => t.status === 'failed'), [tasks])
  const pausedTasks = useMemo(() => tasks.filter((t) => t.status === 'paused'), [tasks])

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: completedTasks.length,
      passed: completedTasks.filter((t) => { const s = getQualityScore(t.result); return s !== null && s >= 70; }).length,
      warning: completedTasks.filter((t) => { const s = getQualityScore(t.result); return s !== null && s < 70; }).length,
      failed: failedTasks.length,
      pending: queuedTasks.length + activeTasks.length + pausedTasks.length,
      rate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
    }),
    [tasks, completedTasks, failedTasks, queuedTasks, activeTasks, pausedTasks],
  )

  // 启动下一批任务
  const processNextBatch = useCallback(async () => {
    if (processingRef.current || isPaused) return
    if (activeTasks.length >= maxConcurrent) return

    const nextQueued = tasks.filter((t) => t.status === 'queued')
    if (nextQueued.length === 0) {
      processingRef.current = false
      setIsProcessing(false)
      return
    }

    processingRef.current = true
    const batchSize = Math.min(maxConcurrent - activeTasks.length, nextQueued.length)
    const batch = nextQueued.slice(0, batchSize)

    // 同时启动一批
    const promises = batch.map((task) => runTask(task.id, task.sequence))
    await Promise.all(promises)

    processingRef.current = false
    // 递归处理剩余
    setTimeout(() => processNextBatch(), 100)
  }, [tasks, activeTasks.length, maxConcurrent, isPaused])

  const runTask = useCallback(
    async (id: string, sequence: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'processing' as PeptideTaskStatus, progress: 10, startedAt: Date.now() } : t)),
      )

      const controller = new AbortController()
      abortRef.current = controller

      try {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress: 30 } : t)),
        )

        const result = (await peptideAnalysisApi.createAnalysis({
          sequence,
          analysis_mode: "deep",
        })).data

        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, status: 'completed' as PeptideTaskStatus, progress: 100, result, completedAt: Date.now() }
              : t,
          ),
        )
      } catch (err) {
        const message = (err as Error).message || '分析失败'
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, status: 'failed' as PeptideTaskStatus, progress: 0, error: message, completedAt: Date.now() }
              : t,
          ),
        )
        logger.error(`肽分析任务失败 [${sequence}]:`, err)
      }
    },
    [],
  )

  // 监听暂停状态变化
  useEffect(() => {
    if (!isPaused && isProcessing) {
      processNextBatch()
    }
  }, [isPaused, isProcessing, processNextBatch])

  const handleStart = useCallback(() => {
    const sequences = parseSequences(inputText)
    if (sequences.length === 0) return

    const newTasks: PeptideBatchTask[] = sequences.map((seq) => ({
      id: generateId(),
      sequence: seq,
      status: 'queued' as PeptideTaskStatus,
      progress: 0,
      createdAt: Date.now(),
    }))

    setTasks((prev) => [...prev, ...newTasks])
    setInputText('')
    setIsProcessing(true)
    setTimeout(() => processNextBatch(), 200)
  }, [inputText, processNextBatch])

  const handlePause = useCallback(() => {
    setIsPaused((v) => !v)
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setIsPaused(false)
    setIsProcessing(false)
    setTasks((prev) =>
      prev.map((t) =>
        t.status === 'processing' || t.status === 'queued'
          ? { ...t, status: 'failed' as PeptideTaskStatus, error: '已停止', completedAt: Date.now() }
          : t,
      ),
    )
  }, [])

  const handleClearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'failed'))
  }, [])

  const handleClearAll = useCallback(() => {
    abortRef.current?.abort()
    setTasks([])
    setIsProcessing(false)
    setIsPaused(false)
  }, [])

  const handleExport = useCallback(() => {
    const results = tasks.filter((t) => t.result)
    if (results.length === 0) return
    const blob = new Blob([JSON.stringify(results.map((t) => ({ sequence: t.sequence, ...t.result })), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `peptide-batch-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [tasks])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const text = e.dataTransfer.getData('text/plain')
    if (text) setInputText((prev) => (prev ? prev + '\n' + text : text))
  }, [])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 输入区 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Dna className="w-4 h-4 text-primary-500" />
            肽序列批量分析
          </h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">每行一条序列（如：ACEINL）</span>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          placeholder={`ACE inhibitor sequences:\nWPNY\nRPVK\nIER\n...`}
          className={`w-full h-28 px-3 py-2 text-sm font-mono border rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 transition-colors resize-none ${
            dragOver
              ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
              : 'border-neutral-300 dark:border-neutral-600'
          }`}
        />
        <div className="flex items-center gap-2 mt-3">
          <Button
            onClick={handleStart}
            disabled={!inputText.trim() || isProcessing}
            icon={<Play className="w-4 h-4" />}
            className="flex-1"
          >
            开始分析
          </Button>
          {isProcessing && (
            <>
              <Button onClick={handlePause} variant="outline" icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}>
                {isPaused ? '继续' : '暂停'}
              </Button>
              <Button onClick={handleStop} variant="ghost" icon={<Square className="w-4 h-4" />}>
                停止
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* 统计 */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: '总计', value: stats.total, color: 'text-neutral-700 dark:text-neutral-300' },
            { label: '完成', value: stats.completed, color: 'text-success-600 dark:text-success-600' },
            { label: '通过', value: stats.passed, color: 'text-primary-700 dark:text-primary-700' },
            { label: '警告', value: stats.warning, color: 'text-warning-600 dark:text-warning-700' },
            { label: '失败', value: stats.failed, color: 'text-error-600 dark:text-error-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{label}</div>
            </div>
          ))}
          <div className="col-span-5">
            <Progress value={stats.rate} className="h-1.5" />
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center mt-1">完成率 {stats.rate}%</div>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              任务队列
              <Badge variant="neutral" className="text-xs">{tasks.length}</Badge>
            </h3>
            <div className="flex items-center gap-1">
              {stats.completed > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleExport}>
                  <Download className="w-3 h-3 mr-1" />导出
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleClearCompleted}>
                <Trash2 className="w-3 h-3 mr-1" />清完成
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-error-500 hover:text-error-600" onClick={handleClearAll}>
                <XCircle className="w-3 h-3 mr-1" />清空
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs border transition-colors ${
                  task.status === 'processing'
                    ? 'bg-primary-50 dark:bg-primary-300/15 border-primary-200 dark:border-primary-800'
                    : task.status === 'completed'
                      ? 'bg-success-50 dark:bg-success-300/15 border-success-200 dark:border-success-800'
                      : task.status === 'failed'
                        ? 'bg-error-50 dark:bg-error-300/15 border-error-200 dark:border-error-800'
                        : task.status === 'paused'
                          ? 'bg-warning-50 dark:bg-warning-300/15 border-warning-200 dark:border-warning-800'
                          : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {/* 状态图标 */}
                {task.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin flex-shrink-0" />}
                {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success-500 flex-shrink-0" />}
                {task.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-error-500 flex-shrink-0" />}
                {task.status === 'paused' && <Pause className="w-3.5 h-3.5 text-warning-500 flex-shrink-0" />}
                {(task.status === 'queued') && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-300 dark:border-neutral-600 flex-shrink-0" />
                )}

                {/* 序列 */}
                <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 flex-1 truncate">
                  {task.sequence}
                </span>

                {/* 进度条 */}
                {task.status === 'processing' && (
                  <Progress value={task.progress} className="w-16 h-1" />
                )}

                {/* 结果指标 */}
                {task.result && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-bold tabular-nums ${
                      (getQualityScore(task.result) ?? 0) >= 70 ? 'text-success-600' : 'text-warning-600'
                    }`}>
                      {getQualityScore(task.result)?.toFixed(0)}
                    </span>
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">分</span>
                    <Badge
                      variant={(getQualityScore(task.result) ?? 0) >= 70 ? 'success' : 'warning'}
                      className="text-xs"
                    >
                      {(getQualityScore(task.result) ?? 0) >= 70 ? '通过' : '预警'}
                    </Badge>
                  </div>
                )}

                {/* 错误 */}
                {task.error && (
                  <span className="text-error-500 flex-shrink-0 max-w-24 truncate" title={task.error}>
                    {task.error}
                  </span>
                )}

                {/* 时间 */}
                {task.startedAt && task.completedAt && (
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0">
                    {formatTime(task.completedAt - task.startedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 空状态 */}
      {tasks.length === 0 && (
        <Card className="p-8 text-center">
          <Dna className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-400 mb-3" />
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            输入肽序列（如 ACEINL、RPVK）后点击「开始分析」
          </p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
            支持拖拽文件上传 · 每行一条 · 自动去重
          </p>
        </Card>
      )}
    </div>
  )
}
