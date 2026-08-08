import { useState, useCallback, useRef, useMemo } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  Download,
  Loader2,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react'
import type {
  FormulaImportRequest,
  FormulaImportResult,
} from '@/types/formula'
import type { ParsedImportRow } from '@/utils/formulaExporter'
import {
  parseImportFile,
  validateImportRow,
  generateImportTemplate,
} from '@/utils/formulaExporter'
import { formulaApi } from '@/api/formula'
import { downloadBlob } from '@/utils/encodingUtils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'


import { logger } from '@/utils/safeLogger';
type ImportStep = 'upload' | 'preview' | 'result'
type ImportMode = 'all' | 'valid_only' | 'skip_errors'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const SUPPORTED_FORMATS = ['.xlsx', '.xls', '.csv']

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImportComplete?: (result: FormulaImportResult) => void
}

export function ImportModal({ open, onClose, onImportComplete }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [importMode, setImportMode] = useState<ImportMode>('valid_only')

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<FormulaImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const resetState = useCallback(() => {
    setStep('upload')
    setFile(null)
    setIsDragging(false)
    setIsParsing(false)
    setParseError(null)
    setHeaders([])
    setRows([])
    setImportMode('valid_only')
    setIsImporting(false)
    setImportProgress(0)
    setImportResult(null)
    setImportError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (!isImporting) {
      resetState()
      onClose()
    }
  }, [isImporting, resetState, onClose])

  const validateFile = useCallback((selectedFile: File): string | null => {
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase()

    if (!SUPPORTED_FORMATS.includes(extension)) {
      return `不支持的文件格式: ${extension}，仅支持 ${SUPPORTED_FORMATS.join('、')} 格式`
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      return `文件过大 (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }

    return null
  }, [])

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const error = validateFile(selectedFile)
    if (error) {
      setParseError(error)
      return
    }

    setFile(selectedFile)
    setParseError(null)
    setIsParsing(true)

    try {
      const result = await parseImportFile(selectedFile)
      setHeaders(result.headers)

      const validatedRows = result.rows.map(row =>
        validateImportRow(row, result.headers),
      )
      setRows(validatedRows)
      setStep('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '文件解析失败，请检查文件格式')
    } finally {
      setIsParsing(false)
    }
  }, [validateFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    dragCounterRef.current = 0

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFileSelect])

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await generateImportTemplate()
      downloadBlob(blob, '配方导入模板.xlsx', { timestamp: false })
    } catch (err) {
      logger.error('下载模板失败:', err)
    }
  }, [])

  const handleBackToUpload = useCallback(() => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setRows([])
    setParseError(null)
  }, [])

  const handleConfirmImport = useCallback(async () => {
    if (!file) return

    setIsImporting(true)
    setImportProgress(0)
    setImportError(null)

    try {
      const request: FormulaImportRequest = {
        file,
        mode: importMode,
        options: {},
      }

      const result = await formulaApi.importFormulas(request, (progress) => {
        setImportProgress(progress)
      })

      setImportResult(result)
      setStep('result')
      onImportComplete?.(result)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败，请重试')
    } finally {
      setIsImporting(false)
    }
  }, [file, importMode, onImportComplete])

  const handleDownloadFailedRecords = useCallback(() => {
    if (!importResult || importResult.errors.length === 0) return

    const headers = ['行号', '字段', '错误原因', '严重程度', '原始数据']
    const csvLines = [
      headers.join(','),
      ...importResult.errors.map(err =>
        [
          String(err.row),
          err.field || '-',
          `"${err.reason.replace(/"/g, '""')}"`,
          err.severity === 'error' ? '错误' : '警告',
          err.data ? `"${JSON.stringify(err.data).replace(/"/g, '""')}"` : '-',
        ].join(','),
      ),
    ]

    const BOM = '\uFEFF'
    const content = BOM + csvLines.join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `导入失败明细_${new Date().toISOString().slice(0, 10)}.csv`, { timestamp: false })
  }, [importResult])

  const stats = useMemo(() => {
    const validCount = rows.filter(r => r.severity === 'valid').length
    const warningCount = rows.filter(r => r.severity === 'warning').length
    const errorCount = rows.filter(r => r.severity === 'error').length
    return { validCount, warningCount, errorCount, total: rows.length }
  }, [rows])

  const showProgressBar = isImporting && stats.total > 50

  const displayHeaders = useMemo(() => {
    return headers.slice(0, 6)
  }, [headers])

  if (!open) return null

  return (
    <Modal open={open} onClose={handleClose} size="xl" title={
      step === 'upload'
        ? '导入配方数据'
        : step === 'preview'
          ? '导入配方数据 (2/3)'
          : '导入完成!'
    }>
      {/* Step 1: 文件上传 */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onClick={() => !isParsing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02]'
                : parseError
                  ? 'border-red-300 bg-error-50 dark:bg-error-900/10 hover:border-red-400'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-neutral-800/30'
            } ${isParsing ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden"
            />

            {isParsing ? (
              <div className="space-y-3">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">正在解析文件...</p>
              </div>
            ) : (
              <>
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  isDragging ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-neutral-100 dark:bg-neutral-800'
                }`}>
                  <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-500' : 'text-neutral-400'}`} />
                </div>

                <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                  点击或拖拽上传文件
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  支持 .xlsx / .csv 格式，最大 10MB
                </p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700 dark:text-error-400">{parseError}</p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Lightbulb className="w-5 h-5 text-secondary-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-secondary-700 dark:text-secondary-400">
              还没有模板？
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadTemplate() }}
                className="font-medium underline ml-1 hover:text-secondary-800"
              >
                下载导入模板
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={handleClose}>
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: 数据预览 + 验证 */}
      {step === 'preview' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary-500" />
              数据预览
            </h3>
            <span className="text-sm text-neutral-500">共 {stats.total} 条</span>
          </div>

          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 w-12">状态</th>
                  {displayHeaders.map((header, idx) => (
                    <th key={idx} className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {(header.replace(/\*/g, '').split('(')[0] || header).trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.slice(0, 100).map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors ${
                      row.severity === 'error' ? 'bg-error-50/50 dark:bg-error-900/5' :
                      row.severity === 'warning' ? 'bg-warning-50/50 dark:bg-warning-900/5' : ''
                    }`}
                    title={row.errors.length > 0 || row.warnings.length > 0
                      ? [...row.errors, ...row.warnings].map(e => e.message).join('; ')
                      : undefined
                    }
                  >
                    <td className="px-3 py-2">
                      {row.severity === 'valid' && <Check className="w-4 h-4 text-primary-500" />}
                      {row.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-warning-500" />}
                      {row.severity === 'error' && <XCircle className="w-4 h-4 text-error-500" />}
                    </td>
                    {displayHeaders.map((header, idx) => (
                      <td key={idx} className="px-3 py-2 max-w-[180px] truncate text-neutral-700 dark:text-neutral-300">
                        {row.data[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {stats.total > 100 && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-800 text-xs text-neutral-500 text-center border-t">
                仅显示前 100 条，共 {stats.total} 条记录
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="success" dot>
              有效: {stats.validCount} 条
            </Badge>
            <Badge variant="warning" dot>
              警告: {stats.warningCount} 条
            </Badge>
            <Badge variant="danger" dot>
              错误: {stats.errorCount} 条
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">导入模式</label>
            <div className="space-y-2">
              {[
                { value: 'all' as ImportMode, label: '全部导入（跳过错误行）', desc: '导入所有有效行和警告行，跳过错误行' },
                { value: 'valid_only' as ImportMode, label: '仅导入有效行', desc: `只导入 ${stats.validCount} 条完全有效的记录` },
                { value: 'skip_errors' as ImportMode, label: '取消', desc: '返回重新选择文件' },
              ].map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    importMode === mode.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : mode.value === 'skip_errors'
                        ? 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value={mode.value}
                    checked={importMode === mode.value}
                    onChange={() => {
                      if (mode.value === 'skip_errors') {
                        handleBackToUpload()
                      } else {
                        setImportMode(mode.value)
                      }
                    }}
                    disabled={isImporting}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{mode.label}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {showProgressBar && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">正在导入...</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} size="lg" />
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700 dark:text-error-400">{importError}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={handleBackToUpload}
              disabled={isImporting}
            >
              <span className="flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" />
                上一步
              </span>
            </Button>

            <Button
              variant="primary"
              loading={isImporting}
              onClick={handleConfirmImport}
              disabled={isImporting || stats.validCount === 0}
            >
              {isImporting ? '导入中...' : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  确认导入
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: 导入结果 */}
      {step === 'result' && (
        <div className="space-y-6 py-4">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-primary-500" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              导入{importResult && importResult.failed > 0 ? '完成' : '成功'}！
            </h3>
          </div>

          {importResult && (
            <div className="max-w-md mx-auto space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {importResult.success}
                  </div>
                  <div className="text-xs text-primary-700 dark:text-primary-500 mt-1">成功导入</div>
                </div>

                <div className="bg-warning-50 dark:bg-warning-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                    {importResult.skipped}
                  </div>
                  <div className="text-xs text-warning-700 dark:text-warning-500 mt-1">跳过(警告)</div>
                </div>

                <div className="bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-error-600 dark:text-error-400">
                    {importResult.failed}
                  </div>
                  <div className="text-xs text-error-700 dark:text-error-500 mt-1">导入失败</div>
                </div>
              </div>

              <div className="text-center text-sm text-neutral-500">
                共处理 {importResult.total} 条记录
              </div>

              {importResult.errors.length > 0 && (
                <button
                  onClick={handleDownloadFailedRecords}
                  className="flex items-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载失败明细 ({importResult.errors.length} 条)
                </button>
              )}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <Button
              variant="primary"
              onClick={handleClose}
            >
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                完成
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ImportModal
