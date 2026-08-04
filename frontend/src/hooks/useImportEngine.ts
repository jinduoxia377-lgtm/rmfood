/**
 * useImportEngine — 数据导入引擎 Hook
 *
 * 管理完整的导入流程：上传 → 预览 → 映射配置 → 执行 → 进度追踪 → 错误查看
 */
import { useCallback, useState } from 'react'
import { importApi, type FieldMappingConfig, type ImportTaskDetail, type ImportErrorItem, type UploadResponse } from '@/api/import'


import { logger } from '@/utils/safeLogger';
export type ImportStep = 'idle' | 'upload' | 'preview' | 'mapping' | 'running' | 'done' | 'error'

export interface ImportProgress {
  totalRows: number
  processedRows: number
  insertedRows: number
  updatedRows: number
  errorRows: number
  progressPct: number
  successRate: number
}

export interface UseImportEngineReturn {
  // State
  step: ImportStep
  task: ImportTaskDetail | null
  uploadResponse: UploadResponse | null
  previewData: Record<string, unknown>[] | null
  errors: ImportErrorItem[]
  progress: ImportProgress | null
  file: File | null
  errorMessage: string | null
  isRunning: boolean

  // Actions
  setFile: (file: File | null) => void
  uploadFile: (fileType: string, delimiter: string) => Promise<void>
  fetchPreview: (limit?: number) => Promise<void>
  runImport: (targetTable: string, idField: string, mappings: FieldMappingConfig[]) => Promise<void>
  refreshTask: () => Promise<void>
  cancelTask: () => Promise<void>
  clear: () => void
  goToStep: (step: ImportStep) => void
}

export function useImportEngine(): UseImportEngineReturn {
  const [step, setStep] = useState<ImportStep>('idle')
  const [task, setTask] = useState<ImportTaskDetail | null>(null)
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [errors, setErrors] = useState<ImportErrorItem[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [file, setFileState] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const taskId = uploadResponse?.task_id || ''

  const setFile = useCallback((f: File | null) => {
    setFileState(f)
    if (!f) {
      setStep('idle')
      setUploadResponse(null)
      setTask(null)
      setPreviewData(null)
      setErrors([])
      setProgress(null)
      setErrorMessage(null)
    }
  }, [])

  const uploadFile = useCallback(async (fileType: string, delimiter: string) => {
    if (!file) return
    try {
      setErrorMessage(null)
      const resp = await importApi.uploadFile(file, fileType, delimiter)
      setUploadResponse(resp)
      setStep('upload')
    } catch (e: any) {
      setErrorMessage(e.response?.data?.detail || e.message || '文件上传失败')
      setStep('error')
    }
  }, [file])

  const fetchPreview = useCallback(async (limit = 10) => {
    if (!taskId) return
    try {
      const data = await importApi.preview(taskId, limit, 'auto', 'csv')
      setPreviewData(data.preview)
      setStep('preview')
    } catch (e: any) {
      setErrorMessage(e.response?.data?.detail || e.message || '预览失败')
      setStep('error')
    }
  }, [taskId])

  const runImport = useCallback(async (targetTable: string, idField: string, mappings: FieldMappingConfig[]) => {
    if (!taskId) return
    try {
      setStep('running')
      const report = await importApi.runImport(taskId, targetTable, idField, mappings)
      setTask({
        task_id: report.task_id,
        adapter_type: 'csv',
        target_table: targetTable,
        status: report.status,
        total_rows: (report.stats as Record<string, unknown> | undefined)?.total_rows as number || 0,
        processed_rows: (report.stats as Record<string, unknown> | undefined)?.valid_rows as number || 0,
        inserted_rows: (report.stats as Record<string, unknown> | undefined)?.inserted as number || 0,
        updated_rows: (report.stats as Record<string, unknown> | undefined)?.updated as number || 0,
        error_rows: (report.stats as Record<string, unknown> | undefined)?.error_count as number || 0,
        progress_pct: 100,
        success_rate: (report.stats as Record<string, unknown> | undefined)?.success_rate as number || 0,
        error_summary: report.message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      setProgress({
        totalRows: (report.stats as Record<string, unknown> | undefined)?.total_rows as number || 0,
        processedRows: (report.stats as Record<string, unknown> | undefined)?.valid_rows as number || 0,
        insertedRows: (report.stats as Record<string, unknown> | undefined)?.inserted as number || 0,
        updatedRows: (report.stats as Record<string, unknown> | undefined)?.updated as number || 0,
        errorRows: (report.stats as Record<string, unknown> | undefined)?.error_count as number || 0,
        progressPct: 100,
        successRate: (report.stats as Record<string, unknown> | undefined)?.success_rate as number || 0,
      })
      setStep(report.status === 'completed' ? 'done' : 'error')
      setErrorMessage(report.status === 'failed' ? report.message : null)
    } catch (e: any) {
      setErrorMessage(e.response?.data?.detail || e.message || '导入失败')
      setStep('error')
    }
  }, [taskId])

  const refreshTask = useCallback(async () => {
    if (!uploadResponse?.task_id) return
    try {
      const detail = await importApi.getTaskDetail(uploadResponse.task_id)
      setTask(detail)
      setProgress({
        totalRows: detail.total_rows,
        processedRows: detail.processed_rows,
        insertedRows: detail.inserted_rows,
        updatedRows: detail.updated_rows,
        errorRows: detail.error_rows,
        progressPct: detail.progress_pct,
        successRate: detail.success_rate,
      })
      if (detail.status === 'running') {
        setStep('running')
      } else if (detail.status === 'completed') {
        setStep('done')
      } else if (detail.status === 'failed') {
        setStep('error')
        setErrorMessage(detail.error_summary || '导入失败')
      }
    } catch (e: any) {
      logger.warn('[useImportEngine] refresh failed:', e.message)
    }
  }, [uploadResponse?.task_id])

  const cancelTask = useCallback(async () => {
    if (!uploadResponse?.task_id) return
    try {
      await importApi.cancelTask(uploadResponse.task_id)
      setStep('idle')
      setUploadResponse(null)
    } catch (e: any) {
      setErrorMessage(e.response?.data?.detail || e.message || '取消失败')
    }
  }, [uploadResponse?.task_id])

  const clear = useCallback(() => {
    setStep('idle')
    setTask(null)
    setUploadResponse(null)
    setPreviewData(null)
    setErrors([])
    setProgress(null)
    setFileState(null)
    setErrorMessage(null)
  }, [])

  const goToStep = useCallback((s: ImportStep) => {
    setStep(s)
  }, [])

  return {
    step,
    task,
    uploadResponse,
    previewData,
    errors,
    progress,
    file,
    errorMessage,
    isRunning: step === 'running',
    setFile,
    uploadFile,
    fetchPreview,
    runImport,
    refreshTask,
    cancelTask,
    clear,
    goToStep,
  }
}
