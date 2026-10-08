import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import ExcelJS from 'exceljs'
import {
  Card,
  Button,
  Badge,
  Alert,
  Progress,
} from '@/components/ui'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import { logger } from '@/utils/safeLogger'
import type { SafetyCheckResult } from '@/types'

interface FileUploadData {
  file: File
  preview: string[][]
  columnMapping: {
    ingredientColumn: string
    concentrationColumn?: string
    metadataColumns: string[]
  }
}

interface BatchTask {
  id: string
  fileName: string
  ingredientCount: number
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'review_required'
  progress: number
  result?: SafetyCheckResult
  error?: string
  priority: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  reviewNotes?: string[]
  reviewer?: string
  reviewDeadline?: number
}

interface ReviewAction {
  taskId: string
  action: 'confirm' | 'reject' | 'reassign'
  notes?: string
  reviewer?: string
  deadline?: number
  timestamp: number
}

interface BatchSafetyCheckerProps {
  onBatchComplete?: (results: BatchTask[]) => void
  maxConcurrentTasks?: number
  maxFileSize?: number
  supportedFormats?: string[]
  className?: string
}

const DEFAULT_CONFIG = {
  maxConcurrentTasks: 3,
  maxFileSize: 10 * 1024 * 1024,
  supportedFormats: ['.csv', '.xlsx', '.xls'],
  riskThreshold: 70,
}

export function BatchSafetyChecker({
  onBatchComplete,
  maxConcurrentTasks = DEFAULT_CONFIG.maxConcurrentTasks,
  maxFileSize = DEFAULT_CONFIG.maxFileSize,
  supportedFormats = DEFAULT_CONFIG.supportedFormats,
  className = '',
}: BatchSafetyCheckerProps) {
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [uploadData, setUploadData] = useState<FileUploadData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [_reviewHistory, setReviewHistory] = useState<ReviewAction[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const feedback = useOperationFeedback()

  const activeTasks = useMemo(() => tasks.filter(t => t.status === 'processing'), [tasks])
  const queuedTasks = useMemo(() => tasks.filter(t => t.status === 'queued'), [tasks])
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'completed'), [tasks])
  const failedTasks = useMemo(() => tasks.filter(t => t.status === 'failed'), [tasks])
  const reviewRequiredTasks = useMemo(() => tasks.filter(t => t.status === 'review_required'), [tasks])

  const statistics = useMemo(() => ({
    total: tasks.length,
    completed: completedTasks.length,
    passed: completedTasks.filter(t => t.result?.passed).length,
    warning: reviewRequiredTasks.length,
    failed: failedTasks.length,
    pending: queuedTasks.length + activeTasks.length,
    completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
  }), [tasks, completedTasks, failedTasks, reviewRequiredTasks, queuedTasks, activeTasks])

  const estimatedTimeRemaining = useMemo(() => {
    if (activeTasks.length === 0 && queuedTasks.length === 0) return 0

    const completedWithTime = completedTasks.filter(t => t.startedAt && t.completedAt)
    if (completedWithTime.length === 0) return 0

    const avgTimePerTask = completedWithTime.reduce((sum, task) =>
      sum + ((task.completedAt! - task.startedAt!) / 1000), 0,
    ) / completedWithTime.length

    return Math.round((activeTasks.length + queuedTasks.length) * avgTimePerTask)
  }, [activeTasks, queuedTasks, completedTasks])

  const parseFile = useCallback(async (file: File): Promise<FileUploadData> => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    let data: string[][] = []

    if (extension === 'csv') {
      const text = await file.text()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(Buffer.from(text))
      const firstSheet = workbook.worksheets[0]
      if (!firstSheet) throw new Error('文件中没有工作表')
      data = sheetToArray(firstSheet)

      return {
        file,
        preview: data.slice(0, 6),
        columnMapping: {
          ingredientColumn: data[0]?.[0] || '',
          concentrationColumn: data[0]?.[1],
          metadataColumns: data[0]?.slice(2) || [],
        },
      }
    }

    if (extension === 'xlsx' || extension === 'xls') {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuffer)
      const firstSheet = workbook.worksheets[0]
      if (!firstSheet) throw new Error('文件中没有工作表')
      data = sheetToArray(firstSheet)

      return {
        file,
        preview: data.slice(0, 6),
        columnMapping: {
          ingredientColumn: data[0]?.[0] || '',
          concentrationColumn: data[0]?.[1],
          metadataColumns: data[0]?.slice(2) || [],
        },
      }
    }

    throw new Error(`不支持的文件格式: ${extension}`)
  }, [])

  /** 将 ExcelJS Worksheet 转换为二维字符串数组 */
  function sheetToArray(worksheet: ExcelJS.Worksheet): string[][] {
    const result: string[][] = []
    worksheet.eachRow((row) => {
      const rowData: string[] = []
      row.eachCell((cell) => {
        rowData.push(String(cell.value ?? ''))
      })
      result.push(rowData)
    })
    return result
  }

  const handleFileSelect = useCallback(async (file: File) => {
    if (!supportedFormats.some(ext => file.name.toLowerCase().endsWith(ext))) {
      feedback.showError('文件格式错误', `支持的格式: ${supportedFormats.join(', ')}`)
      return
    }

    if (file.size > maxFileSize) {
      feedback.showError('文件过大', `最大支持 ${maxFileSize / 1024 / 1024}MB`)
      return
    }

    try {
      const parsed = await parseFile(file)
      setUploadData(parsed)
      logger.info('文件解析成功', { fileName: file.name, rows: parsed.preview.length })
    } catch (error) {
      logger.error('文件解析失败', { error })
      feedback.showError('解析失败', error instanceof Error ? error.message : '未知错误')
    }
  }, [parseFile, supportedFormats, maxFileSize, feedback])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0 && files[0]) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const createTasksFromFile = useCallback(() => {
    if (!uploadData) return

    const ingredients = uploadData.preview.slice(1).filter(row => row[0]?.trim())

    const newTask: BatchTask = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      fileName: uploadData.file.name,
      ingredientCount: ingredients.length,
      status: 'queued',
      progress: 0,
      priority: tasks.length,
      createdAt: Date.now(),
    }

    setTasks(prev => [...prev, newTask])
    setUploadData(null)

    logger.info('创建批量检测任务', {
      taskId: newTask.id,
      fileName: newTask.fileName,
      ingredientCount: newTask.ingredientCount,
    })

    feedback.showSuccess('任务已添加', `${ingredients.length} 个成分待检测`)
  }, [uploadData, tasks.length, feedback])

  const processTask = useCallback(async (task: BatchTask) => {
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: 'processing' as const, startedAt: Date.now() } : t,
    ))

    try {
      for (let i = 0; i <= 100; i += 10) {
        if (isPaused) {
          await new Promise(resolve => {
            const checkPause = setInterval(() => {
              if (!isPaused) {
                clearInterval(checkPause)
                resolve(undefined)
              }
            }, 100)
          })
        }

        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, progress: i } : t,
        ))

        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const mockResult: SafetyCheckResult = {
        passed: Math.random() > 0.3,
        summary: `完成对 ${task.ingredientCount} 个成分的安全检查`,
        errors: [],
        warnings: Math.random() > 0.5 ? [{ code: 'POTENTIAL_RISK', message: '发现潜在风险，建议人工复核', severity: 'warning', category: 'other' }] : [],
        checks: {},
        riskLevel: 'low' as const,
        checkedAt: new Date().toISOString(),
        checkedBy: 'system',
      }

      const needsReview = !mockResult.passed || Math.random() > 0.7

      setTasks(prev => prev.map(t =>
        t.id === task.id ? {
          ...t,
          status: needsReview ? 'review_required' as const : 'completed' as const,
          progress: 100,
          result: mockResult,
          completedAt: Date.now(),
        } : t,
      ))

      logger.info('任务处理完成', {
        taskId: task.id,
        status: needsReview ? 'review_required' : 'completed',
        passed: mockResult.passed,
      })
    } catch (error) {
      setTasks(prev => prev.map(t =>
        t.id === task.id ? {
          ...t,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : '处理失败',
          completedAt: Date.now(),
        } : t,
      ))

      logger.error('任务处理失败', { taskId: task.id, error })
    }
  }, [isPaused])

  useEffect(() => {
    if (isPaused || isProcessing) return

    const availableSlots = maxConcurrentTasks - activeTasks.length
    if (availableSlots <= 0 || queuedTasks.length === 0) return

    setIsProcessing(true)
    const tasksToProcess = queuedTasks.slice(0, availableSlots)

    Promise.all(tasksToProcess.map(processTask)).finally(() => {
      setIsProcessing(false)
    })
  }, [tasks, isPaused, isProcessing, maxConcurrentTasks, activeTasks.length, queuedTasks.length, processTask])

  useEffect(() => {
    if (tasks.length > 0 && tasks.every(t => t.status === 'completed' || t.status === 'failed' || t.status === 'review_required')) {
      onBatchComplete?.(tasks)
    }
  }, [tasks, onBatchComplete])

  const handleStartAll = useCallback(() => {
    setIsPaused(false)
    feedback.showInfo('开始执行', `将处理 ${queuedTasks.length} 个排队中的任务`)
  }, [queuedTasks.length, feedback])

  const handlePauseAll = useCallback(() => {
    setIsPaused(true)
    feedback.showInfo('已暂停', '所有进行中的任务将暂停')
  }, [feedback])

  const handleCancelAll = useCallback(() => {
    setTasks([])
    setReviewHistory([])
    feedback.showWarning('已取消', '所有任务已清除')
  }, [feedback])

  const handleTaskAction = useCallback((taskId: string, action: 'start' | 'pause' | 'cancel' | 'retry') => {
    switch (action) {
      case 'cancel':
        setTasks(prev => prev.filter(t => t.id !== taskId))
        break
      case 'retry':
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: 'queued' as const, progress: 0, error: undefined } : t,
        ))
        break
      default:
        break
    }
  }, [])

  const handleReviewAction = useCallback((taskId: string, action: ReviewAction['action'], notes?: string) => {
    const reviewAction: ReviewAction = {
      taskId,
      action,
      notes,
      timestamp: Date.now(),
    }

    setReviewHistory(prev => [...prev, reviewAction])

    if (action === 'confirm') {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'completed' as const, reviewNotes: [...(t.reviewNotes || []), notes || '确认通过'] } : t,
      ))
    } else if (action === 'reject') {
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'failed' as const, reviewNotes: [...(t.reviewNotes || []), notes || '审核驳回'] } : t,
      ))
    }

    feedback.showSuccess(
      action === 'confirm' ? '确认通过' : action === 'reject' ? '已驳回' : '已重新指派',
      `任务 ${taskId} 已更新`,
    )
  }, [feedback])

  const moveTaskPriority = useCallback((taskId: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const index = prev.findIndex(t => t.id === taskId)
      if (index === -1) return prev

      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev

      const newTasks = [...prev]
      ;[newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]]
      return newTasks.map((t, i) => ({ ...t, priority: i }))
    })
  }, [])

  const getStatusIcon = (status: BatchTask['status']) => {
    switch (status) {
      case 'queued': return '⏳'
      case 'processing': return '🔄'
      case 'completed': return '✅'
      case 'failed': return '❌'
      case 'review_required': return '⚠️'
      default: return '❓'
    }
  }

  const getStatusBadgeVariant = (status: BatchTask['status']) => {
    switch (status) {
      case 'queued': return 'neutral' as const
      case 'processing': return 'info' as const
      case 'completed': return 'success' as const
      case 'failed': return 'danger' as const
      case 'review_required': return 'warning' as const
      default: return 'neutral' as const
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          📋 批量安全检查工作台
        </h2>

        {!uploadData ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-secondary-50 dark:bg-secondary-900/20'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={supportedFormats.join(',')}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            <div className="space-y-3">
              <div className="text-4xl">📁</div>
              <div>
                <p className="text-neutral-700 dark:text-neutral-300 font-medium">
                  拖拽文件到此处或点击上传
                </p>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                  支持 CSV、Excel 格式，最大 {maxFileSize / 1024 / 1024}MB
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="info">
              <div className="flex items-start gap-3">
                <span>📄</span>
                <div className="flex-1">
                  <p className="font-medium">{uploadData.file.name}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    大小: {(uploadData.file.size / 1024).toFixed(1)} KB |
                    预览: {uploadData.preview.length - 1} 行数据
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadData(null)}
                >
                  ✕
                </Button>
              </div>
            </Alert>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-800">
                  <tr>
                    {uploadData.preview[0]?.map((header, idx) => (
                      <th key={idx} className="px-4 py-2 text-left font-medium text-neutral-700 dark:text-neutral-300">
                        {header}
                        {idx === 0 && <span className="ml-1 text-error-500">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadData.preview.slice(1, 6).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t border-neutral-200 dark:border-neutral-700">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                列映射:
                <span className="ml-2 font-medium">成分名: {uploadData.columnMapping.ingredientColumn}</span>
                {uploadData.columnMapping.concentrationColumn && (
                  <span className="ml-4 font-medium">浓度: {uploadData.columnMapping.concentrationColumn}</span>
                )}
              </div>
              <Button onClick={createTasksFromFile}>
                创建检测任务
              </Button>
            </div>
          </div>
        )}
      </Card>

      {tasks.length > 0 && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                📊 进度汇总
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartAll}
                  disabled={queuedTasks.length === 0}
                >
                  ▶️ 开始全部
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePauseAll}
                  disabled={activeTasks.length === 0}
                >
                  ⏸️ 暂停全部
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCancelAll}
                >
                  🚫 取消全部
                </Button>
              </div>
            </div>

            <Progress value={statistics.completionRate} className="mb-4" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-success-600">{statistics.passed}</div>
                <div className="text-xs text-success-600 mt-1">✅ 通过 ({Math.round(statistics.passed / statistics.total * 100) || 0}%)</div>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{statistics.warning}</div>
                <div className="text-xs text-yellow-600 mt-1">⚠️ 警告（需复核）</div>
              </div>
              <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-lg text-center">
                <div className="text-2xl font-bold text-error-600">{statistics.failed}</div>
                <div className="text-xs text-error-600 mt-1">❌ 不合规</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg text-center">
                <div className="text-2xl font-bold text-neutral-600">{statistics.pending}</div>
                <div className="text-xs text-neutral-600 mt-1">❓ 待检测</div>
              </div>
            </div>

            {estimatedTimeRemaining > 0 && (
              <div className="mt-4 text-sm text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                ⏱️ 预计剩余时间: ~{estimatedTimeRemaining}秒
              </div>
            )}

            <div className="mt-4 p-3 bg-slate-50 dark:bg-neutral-800 rounded text-sm text-neutral-600 dark:text-neutral-400">
              并发限制: {maxConcurrentTasks} | 进行中: {activeTasks.length} | 排队中: {queuedTasks.length}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              📝 任务队列
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">文件名</th>
                    <th className="px-4 py-2 text-left">成分数</th>
                    <th className="px-4 py-2 text-left">状态</th>
                    <th className="px-4 py-2 text-left">进度</th>
                    <th className="px-4 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={task.id} className="border-t border-neutral-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2 font-medium">{task.fileName}</td>
                      <td className="px-4 py-2">{task.ingredientCount}</td>
                      <td className="px-4 py-2">
                        <Badge variant={getStatusBadgeVariant(task.status)}>
                          {getStatusIcon(task.status)}
                          <span className="ml-1">
                            {task.status === 'queued' ? '排队中' :
                             task.status === 'processing' ? '检测中' :
                             task.status === 'completed' ? '完成' :
                             task.status === 'failed' ? '失败' :
                             '需复核'}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={task.progress} className="w-24" />
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {task.status === 'queued' && (
                            <>
                              <button
                                onClick={() => moveTaskPriority(task.id, 'up')}
                                className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 rounded hover:bg-neutral-300"
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveTaskPriority(task.id, 'down')}
                                className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 rounded hover:bg-neutral-300"
                                disabled={index === tasks.length - 1}
                              >
                                ↓
                              </button>
                            </>
                          )}
                          {(task.status === 'failed' || task.status === 'review_required') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTaskAction(task.id, 'retry')}
                            >
                              🔄 重试
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTaskAction(task.id, 'cancel')}
                          >
                            ✕
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {reviewRequiredTasks.length > 0 && (
            <Card className="p-6 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                ⚠️ 异常标记与复核工作流
              </h3>

              <div className="space-y-3">
                {reviewRequiredTasks.map(task => (
                  <div key={task.id} className="p-4 bg-white dark:bg-neutral-800 rounded-lg border border-yellow-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                          {task.fileName}
                        </h4>
                        <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                          成分数: {task.ingredientCount} | 检测时间: {new Date(task.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="warning">需人工复核</Badge>
                    </div>

                    {task.result?.warnings && (
                      <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">风险提示:</p>
                        <ul className="mt-1 list-disc list-inside text-yellow-700 dark:text-yellow-300">
                          {task.result.warnings.map((warning, idx) => (
                            <li key={idx}>{typeof warning === 'string' ? warning : warning.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 mb-3">
                      <textarea
                        placeholder="添加复核备注..."
                        className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded text-sm resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            handleReviewAction(task.id, 'confirm', (e.target as HTMLTextAreaElement).value)
                            ;(e.target as HTMLTextAreaElement).value = ''
                          }
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReviewAction(task.id, 'confirm')}
                      >
                        ✓ 确认通过
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleReviewAction(task.id, 'reject')}
                      >
                        ✗ 驳回
                      </Button>
                    </div>

                    {task.reviewNotes && task.reviewNotes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                        <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">复核历史:</p>
                        {task.reviewNotes.map((note, idx) => (
                          <div key={idx} className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                            • {note}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export type { BatchSafetyCheckerProps, BatchTask, FileUploadData, ReviewAction }
