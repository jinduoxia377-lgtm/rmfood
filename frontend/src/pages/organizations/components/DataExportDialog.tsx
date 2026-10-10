import React, { useState, useMemo, useCallback } from 'react'
import { memo } from 'react'
import {
  Download,
  FileType,
  FileText,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Settings,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react'
import type { Organization } from '@/hooks/useOrganizations'
import type { ExportFormat } from '../../../types/organization.types'
import { logger } from '@/utils/safeLogger';


interface ExportField {
  key: string
  label: string
  visible: boolean
  formatter?: (value: any) => string
}

interface DataExportDialogProps {
  isOpen: boolean
  onClose: () => void
  organizations: Organization[]
  selectedIds?: Set<number>
  onExportComplete?: (format: ExportFormat, count: number) => void
}

const DEFAULT_FIELDS: ExportField[] = [
  { key: 'name', label: '组织名称', visible: true },
  { key: 'slug', label: '标识符', visible: true },
  { key: 'description', label: '描述', visible: false },
  { key: 'plan', label: '订阅计划', visible: true },
  { key: 'memberCount', label: '成员数量', visible: true },
  { key: 'teamCount', label: '团队数量', visible: true },
  { key: 'storageUsed', label: '已用存储 (GB)', visible: true, formatter: (v) => (v / (1024 ** 3)).toFixed(2) },
  { key: 'storageLimit', label: '存储上限 (GB)', visible: false, formatter: (v) => (v / (1024 ** 3)).toFixed(2) },
  { key: 'apiCalls', label: 'API调用次数', visible: false },
  { key: 'status', label: '状态', visible: true },
  { key: 'createdAt', label: '创建时间', visible: true },
  { key: 'updatedAt', label: '更新时间', visible: false },
]

const FORMAT_OPTIONS = [
  {
    value: 'csv' as ExportFormat,
    icon: FileType,
    label: 'CSV',
    description: '逗号分隔值，兼容Excel、Google Sheets',
    extension: '.csv',
    color: 'green',
    available: true,
  },
  {
    value: 'excel' as ExportFormat,
    icon: FileType,
    label: 'Excel',
    description: 'XLSX 格式，支持多工作表',
    extension: '.xlsx',
    color: 'blue',
    available: false,
  },
  {
    value: 'pdf' as ExportFormat,
    icon: FileType,
    label: 'PDF',
    description: '便携式文档格式，适合打印归档',
    extension: '.pdf',
    color: 'red',
    available: false,
  },
]

export const DataExportDialog: React.FC<DataExportDialogProps> = memo(({
  isOpen,
  onClose,
  organizations,
  selectedIds,
  onExportComplete,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
  const [fields, setFields] = useState<ExportField[]>(DEFAULT_FIELDS)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileName = `organizations-export-${new Date().toISOString().split('T')[0]}`

  const filteredOrganizations = useMemo(() => {
    if (selectedIds && selectedIds.size > 0) {
      return organizations.filter(org => selectedIds.has(org.id))
    }
    return organizations
  }, [organizations, selectedIds])

  const visibleFields = useMemo(() =>
    fields.filter(f => f.visible),
    [fields],
  )

  const previewData = useMemo(() => {
    return filteredOrganizations.slice(0, 5).map(org => {
      const row: Record<string, string> = {}
      visibleFields.forEach(field => {
        let value = (org as unknown as Record<string, unknown>)[field.key]
        if (field.formatter) {
          value = field.formatter(value)
        }
        row[field.label] = String(value ?? '-')
      })
      return row
    })
  }, [filteredOrganizations, visibleFields])

  const toggleField = useCallback((key: string) => {
    setFields(prev => prev.map(f =>
      f.key === key ? { ...f, visible: !f.visible } : f,
    ))
  }, [])

  const selectAllFields = useCallback(() => {
    setFields(prev => prev.map(f => ({ ...f, visible: true })))
  }, [])

  const deselectAllFields = useCallback(() => {
    setFields(prev => prev.map(f => ({ ...f, visible: f.key === 'name' })))
  }, [])

  const generateCSVContent = useCallback((): string => {
    const BOM = '\uFEFF'
    let csv = BOM

    csv += visibleFields.map(f => `"${f.label}"`).join(',') + '\n'

    filteredOrganizations.forEach(org => {
      const rowData = visibleFields.map(field => {
        let value = (org as unknown as Record<string, unknown>)[field.key]
        if (field.formatter) value = field.formatter(value)
        if (value === null || value === undefined) return '""'
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""')
          return `"${value}"`
        }
        return String(value)
      })
      csv += rowData.join(',') + '\n'
    })

    return csv
  }, [filteredOrganizations, visibleFields])

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const handleExport = useCallback(async () => {
    if (visibleFields.length === 0) {
      setError('请至少选择一个导出字段')
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      const csvContent = generateCSVContent()
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      downloadBlob(blob, `${fileName}.csv`)

      onExportComplete?.('csv', filteredOrganizations.length)

      setTimeout(() => {
        setIsExporting(false)
        onClose()
      }, 500)
    } catch (err) {
      logger.error('Export error:', err)
      setError(err instanceof Error ? err.message : '导出失败，请重试')
      setIsExporting(false)
    }
  }, [visibleFields, generateCSVContent, downloadBlob, fileName, onExportComplete, filteredOrganizations.length, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
         role="button" tabIndex={0} onClick={onClose}
      />

      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-300/25 rounded-lg">
              <Download className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">数据导出</h2>
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                导出 {filteredOrganizations.length} 个组织的数据
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              选择导出格式
            </label>
            <div className="grid grid-cols-3 gap-5">
              {FORMAT_OPTIONS.map((config) => {
                const Icon = config.icon
                const isSelected = selectedFormat === config.value

                return (
                  <button
                    key={config.value}
                    onClick={() => setSelectedFormat(config.value)}
                    disabled={isExporting}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-success-500 bg-success-50 dark:bg-success-300/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-success-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-success-600' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} />
                    <div className={`font-medium text-sm ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
                      {config.label}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{config.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                导出字段 ({visibleFields.length}/{fields.length})
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFields}
                  className="text-xs text-primary-700 hover:text-primary-700"
                >
                  全选
                </button>
                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                <button
                  onClick={deselectAllFields}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-700"
                >
                  取消全选
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {fields.map(field => (
                <label
                  key={field.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    field.visible
                      ? 'border-primary-300 bg-primary-50 dark:bg-primary-300/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={field.visible}
                    onChange={() => toggleField(field.key)}
                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              <Settings className="w-4 h-4" />
              高级选项
              {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvancedOptions && (
              <div className="mt-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                    文件名
                  </label>
                  <input
                    type="text"
                    defaultValue={fileName}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-primary-500"
        aria-label="文件名"
      />
                </div>
              </div>
            )}
          </div>

          {showPreview && previewData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  数据预览 (前5条)
                </label>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-700"
                >
                  隐藏预览
                </button>
              </div>

              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800">
                    <tr>
                      {visibleFields.map(field => (
                        <th key={field.key} className="px-3 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {previewData.map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        {visibleFields.map(field => (
                          <td key={field.key} className="px-3 py-2 text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">
                            {row[field.label]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!showPreview && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 text-sm text-primary-700 hover:text-primary-700"
            >
              <Eye className="w-4 h-4" />
              显示数据预览
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-error-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-error-700 dark:text-error-600">{error}</div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-secondary-50 dark:bg-secondary-300/20 border border-secondary-200 dark:border-secondary-800 rounded-lg">
            <Info className="w-5 h-5 text-secondary-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-secondary-700 dark:text-secondary-700 space-y-1">
              <p>• CSV格式可在Excel、Google Sheets等软件中直接打开</p>
              <p>• 支持UTF-8编码，完美显示中文内容</p>
              <p>• 导出的数据包含BOM头，确保Excel正确识别编码</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成文件...
                </span>
              ) : (
                <span>共 {filteredOrganizations.length} 条记录待导出</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                取消
              </button>

              <button
                onClick={handleExport}
                disabled={isExporting || visibleFields.length === 0}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-primary-main bg-primary-container rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    开始导出
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

DataExportDialog.displayName = 'DataExportDialog'
export default DataExportDialog
