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
             role="button" tabIndex={0} onClick={() => !isParsing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-[var(--radius-Apple-md)] p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] scale-[1.02]'
                : parseError
                  ? 'border-[var(--color-error-border)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/15 hover:border-[var(--color-error)]'
                  : 'border-[var(--border-color)] hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30'
            } ${isParsing ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden" aria-hidden="true" tabIndex={-1} />

            {isParsing ? (
              <div className="space-y-[var(--space-apple-sm)]">
                <Loader2 className="w-12 h-12 text-[var(--color-primary-text)]0 animate-spin mx-auto" />
                <p className="text-sm text-[var(--text-secondary)]">正在解析文件...</p>
              </div>
            ) : (
              <>
                <div className={`w-16 h-16 rounded-[var(--radius-pill)] mx-auto mb-[var(--space-apple-md)] flex items-center justify-center ${
                  isDragging ? 'bg-[var(--color-primary-container)]' : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <Upload className={`w-8 h-8 ${isDragging ? 'text-[var(--color-primary-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} />
                </div>

                <p className="text-base font-medium text-[var(--text-primary)]">
                  点击或拖拽上传文件
                </p>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                  支持 .xlsx / .csv 格式，最大 10MB
                </p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-[var(--space-apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] rounded-[var(--radius-Apple-sm)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-error-text)]0 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{parseError}</p>
            </div>
          )}

          <div className="flex items-start gap-2 p-[var(--space-apple-sm)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] rounded-[var(--radius-Apple-sm)]">
            <Lightbulb className="w-5 h-5 text-[var(--color-secondary-text)]0 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">
              还没有模板？
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadTemplate() }}
                className="font-medium underline ml-1 hover:text-[var(--color-secondary-text)]"
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
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[var(--color-primary-text)]0" />
              数据预览
            </h3>
            <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">共 {stats.total} 条</span>
          </div>

          <div className="border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] overflow-hidden max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)] sticky top-0 z-10">
                <tr>
                  <th className="px-[var(--space-apple-sm)] py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] w-12">状态</th>
                  {displayHeaders.map((header, idx) => (
                    <th key={idx} className="px-[var(--space-apple-sm)] py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                      {(header.replace(/\*/g, '').split('(')[0] || header).trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {rows.slice(0, 100).map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50 transition-colors ${
                      row.severity === 'error' ? 'bg-[var(--color-error-container)]/50 dark:bg-[var(--color-error-container)]/10' :
                      row.severity === 'warning' ? 'bg-[var(--color-warning-container)]/50 dark:bg-[var(--color-warning-container)]/10' : ''
                    }`}
                    title={row.errors.length > 0 || row.warnings.length > 0
                      ? [...row.errors, ...row.warnings].map(e => e.message).join('; ')
                      : undefined
                    }
                  >
                    <td className="px-[var(--space-apple-sm)] py-2">
                      {row.severity === 'valid' && <Check className="w-4 h-4 text-[var(--color-primary-text)]0" />}
                      {row.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)]0" />}
                      {row.severity === 'error' && <XCircle className="w-4 h-4 text-[var(--color-error-text)]0" />}
                    </td>
                    {displayHeaders.map((header, idx) => (
                      <td key={idx} className="px-[var(--space-apple-sm)] py-2 max-w-[180px] truncate text-[var(--text-primary)]">
                        {row.data[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {stats.total > 100 && (
              <div className="px-[var(--space-apple-md)] py-2 bg-[var(--bg-tertiary)] text-xs text-[var(--text-muted)] text-center border-t">
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
            <label className="block text-sm font-medium text-[var(--text-primary)]">导入模式</label>
            <div className="space-y-2">
              {[
                { value: 'all' as ImportMode, label: '全部导入（跳过错误行）', desc: '导入所有有效行和警告行，跳过错误行' },
                { value: 'valid_only' as ImportMode, label: '仅导入有效行', desc: `只导入 ${stats.validCount} 条完全有效的记录` },
                { value: 'skip_errors' as ImportMode, label: '取消', desc: '返回重新选择文件' },
              ].map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border-2 cursor-pointer transition-all ${
                    importMode === mode.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                      : mode.value === 'skip_errors'
                        ? 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                        : 'border-[var(--border-color)] hover:border-[var(--border-color)] dark:hover:border-neutral-600'
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
                    className="w-4 h-4 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
                  />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{mode.label}</span>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {showProgressBar && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">正在导入...</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} size="lg" />
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 p-[var(--space-apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] rounded-[var(--radius-Apple-sm)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-error-text)]0 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{importError}</p>
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
          <div className="text-center space-y-[var(--space-apple-sm)]">
            <div className="w-16 h-16 bg-[var(--color-primary-container)] rounded-[var(--radius-pill)] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-[var(--color-primary-text)]0" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              导入{importResult && importResult.failed > 0 ? '完成' : '成功'}！
            </h3>
          </div>

          {importResult && (
            <div className="max-w-md mx-auto space-y-[var(--space-apple-sm)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                <div className="bg-[var(--color-primary-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] text-center">
                  <div className="text-2xl font-bold text-[var(--color-primary-text)]">
                    {importResult.success}
                  </div>
                  <div className="text-xs text-[var(--color-primary-text)] mt-1">成功导入</div>
                </div>

                <div className="bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] text-center">
                  <div className="text-2xl font-bold text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
                    {importResult.skipped}
                  </div>
                  <div className="text-xs text-[var(--color-warning-text)] mt-1">跳过(警告)</div>
                </div>

                <div className="bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] text-center">
                  <div className="text-2xl font-bold text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
                    {importResult.failed}
                  </div>
                  <div className="text-xs text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mt-1">导入失败</div>
                </div>
              </div>

              <div className="text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                共处理 {importResult.total} 条记录
              </div>

              {importResult.errors.length > 0 && (
                <button
                  onClick={handleDownloadFailedRecords}
                  className="flex items-center gap-2 mx-auto px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors"
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
