import { useState, useCallback, useMemo } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Package,
  Settings,
  Check,
  AlertCircle,
} from 'lucide-react'
import type { Formula } from '@/types/index'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Checkbox } from '@/components/ui/Checkbox'
import { exportFormulasEnhanced, type EnhancedExportOptions } from '@/utils/formulaExporter'

export type ExportFormat = 'excel' | 'csv' | 'pdf'
export type ExportScope = 'current_page' | 'filtered' | 'selected' | 'all'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  formulas: Formula[]
  totalCount: number
  currentPageCount?: number
  filteredCount?: number
  selectedIds?: Set<string>
}

const FORMAT_OPTIONS: {
  value: ExportFormat
  label: string
  icon: LucideIcon
  description: string
  color: string
  extension: string
}[] = [
  {
    value: 'excel',
    label: 'Excel (.xlsx)',
    icon: FileSpreadsheet,
    description: '支持样式、条件格式、自动列宽',
    color: 'emerald',
    extension: '.xlsx',
  },
  {
    value: 'csv',
    label: 'CSV (.csv)',
    icon: FileType,
    description: 'UTF-8 BOM 编码，兼容 Excel',
    color: 'sky',
    extension: '.csv',
  },
  {
    value: 'pdf',
    label: 'PDF (.pdf)',
    icon: FileText,
    description: '表格排版，含页眉页脚',
    color: 'rose',
    extension: '.pdf',
  },
]

interface ScopeOptionProps {
  totalCount: number
  currentPageCount?: number
  filteredCount?: number
  selectedIds?: Set<string>
}

const SCOPE_OPTIONS: {
  value: ExportScope
  label: string
  getDescription: (props: ScopeOptionProps) => string
}[] = [
  {
    value: 'current_page',
    label: '当前页',
    getDescription: (p) => `${p.currentPageCount ?? 0} 条`,
  },
  {
    value: 'filtered',
    label: '筛选结果',
    getDescription: (p) => `${p.filteredCount ?? p.totalCount} 条`,
  },
  {
    value: 'selected',
    label: '已选择',
    getDescription: (p) => `${p.selectedIds?.size ?? 0} 条`,
  },
  {
    value: 'all',
    label: '全部',
    getDescription: (p) => `${p.totalCount} 条`,
  },
]

export function ExportModal({
  open,
  onClose,
  formulas,
  totalCount,
  currentPageCount,
  filteredCount,
  selectedIds,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('excel')
  const [scope, setScope] = useState<ExportScope>('all')
  const [filename, setFilename] = useState('')
  const [includeIngredients, setIncludeIngredients] = useState(true)
  const [includeSteps, setIncludeSteps] = useState(true)
  const [includeAnalysis, setIncludeAnalysis] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportMessage, setExportMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const defaultFilename = useMemo(() => {
    return `配方数据_${new Date().toISOString().slice(0, 10)}`
  }, [])

  const hasSelectedItems = (selectedIds?.size ?? 0) > 0

  const availableScopes = useMemo(() => SCOPE_OPTIONS.filter(opt => {
    if (opt.value === 'selected') return hasSelectedItems
    if (opt.value === 'filtered') return (filteredCount ?? 0) > 0
    return true
  }), [hasSelectedItems, filteredCount])

  const getTargetFormulas = useCallback((): Formula[] => {
    switch (scope) {
      case 'current_page':
        return formulas.slice(0, currentPageCount ?? formulas.length)
      case 'selected':
        return formulas.filter(f => selectedIds?.has(String(f.id)))
      case 'filtered':
        return formulas.slice(0, filteredCount ?? formulas.length)
      case 'all':
      default:
        return formulas
    }
  }, [scope, formulas, currentPageCount, filteredCount, selectedIds])

  const targetCount = useMemo(() => {
    switch (scope) {
      case 'current_page': return currentPageCount ?? formulas.length
      case 'selected': return selectedIds?.size ?? 0
      case 'filtered': return filteredCount ?? totalCount
      case 'all': return totalCount
      default: return totalCount
    }
  }, [scope, currentPageCount, selectedIds, filteredCount, totalCount, formulas.length])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setError(null)
    setExportProgress(0)
    setExportMessage('准备导出...')

    try {
      const targetFormulas = getTargetFormulas()

      if (targetFormulas.length === 0) {
        throw new Error('没有可导出的数据')
      }

      const options: EnhancedExportOptions = {
        format,
        scope,
        ids: scope === 'selected' ? Array.from(selectedIds || []) : undefined,
        filename: filename || undefined,
        includeIngredients,
        includeSteps,
        includeAnalysis,
        onProgress: (progress) => {
          setExportProgress(progress.progress)
          setExportMessage(progress.message)
        },
      }

      const success = await exportFormulasEnhanced(targetFormulas, options)

      if (!success) {
        throw new Error('导出过程中出现错误')
      }

      setTimeout(() => {
        onClose()
      }, 800)
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败，请重试'
      setError(message)
    } finally {
      setIsExporting(false)
    }
  }, [format, scope, filename, includeIngredients, includeSteps, includeAnalysis, getTargetFormulas, selectedIds, onClose])

  const resetState = useCallback(() => {
    setFormat('excel')
    setScope('all')
    setFilename('')
    setIncludeIngredients(true)
    setIncludeSteps(true)
    setIncludeAnalysis(false)
    setIsExporting(false)
    setExportProgress(0)
    setExportMessage('')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (!isExporting) {
      resetState()
      onClose()
    }
  }, [isExporting, resetState, onClose])

  const showProgressBar = isExporting && targetCount > 1000

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="导出配方数据"
      size="xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-error-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">导出范围</span>
          </div>

          <div className="space-y-2">
            {availableScopes.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                  scope === option.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-slate-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={option.value}
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                  disabled={isExporting}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-white">{option.label}</span>
                <span className="text-xs text-neutral-500 ml-auto">
                  ({option.getDescription({ totalCount, currentPageCount, filteredCount, selectedIds })})
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">导出格式</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map((fmt) => {
              const Icon = fmt.icon
              const isSelected = format === fmt.value

              return (
                <button
                  key={fmt.value}
                  onClick={() => setFormat(fmt.value)}
                  disabled={isExporting}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? `border-${fmt.color}-500 bg-${fmt.color}-50 dark:bg-${fmt.color}-900/20`
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {isSelected && (
                    <div className={`absolute top-2 right-2 w-5 h-5 bg-${fmt.color}-500 rounded-full flex items-center justify-center`}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <Icon className={`w-7 h-7 mb-2 ${isSelected ? `text-${fmt.color}-600` : 'text-neutral-400'}`} />
                  <div className={`text-sm font-semibold ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {fmt.label.split(' ')[0]}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {(/\((.*)\)/.exec(fmt.label))?.[1]}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">导出选项</span>
          </div>

          <div className="space-y-3">
            <Checkbox
              id="exp-ingredients"
              checked={includeIngredients}
              onCheckedChange={(checked) => setIncludeIngredients(checked as boolean)}
              disabled={isExporting}
              label="包含成分详细信息"
            />

            <Checkbox
              id="exp-steps"
              checked={includeSteps}
              onCheckedChange={(checked) => setIncludeSteps(checked as boolean)}
              disabled={isExporting}
              label="包含制作步骤"
            />

            <Checkbox
              id="exp-analysis"
              checked={includeAnalysis}
              onCheckedChange={(checked) => setIncludeAnalysis(checked as boolean)}
              disabled={isExporting}
              label="包含 AI 分析结果（可能导致文件较大）"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            文件名
          </label>
          <input
            type="text"
            value={filename || defaultFilename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={isExporting}
            placeholder={defaultFilename}
            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50"
          />
        </div>

        {showProgressBar && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{exportMessage}</span>
              <span className="font-medium text-neutral-900 dark:text-white">{exportProgress}%</span>
            </div>
            <Progress
              value={exportProgress}
              variant={exportProgress >= 100 ? 'success' : 'default'}
              size="lg"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          onClick={handleClose}
          disabled={isExporting}
        >
          取消
        </Button>

        <Button
          variant="primary"
          onClick={handleExport}
          loading={isExporting}
          disabled={isExporting || targetCount === 0}
        >
          {isExporting ? (
            showProgressBar ? `${exportMessage}` : '正在导出...'
          ) : (
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              开始导出
            </span>
          )}
        </Button>
      </div>
    </Modal>
  )
}

export default ExportModal
