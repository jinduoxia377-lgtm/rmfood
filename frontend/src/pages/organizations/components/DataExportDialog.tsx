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
  { key: 'apiUsage', label: 'API调用次数', visible: false },
  { key: 'isActive', label: '状态', visible: true },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-apple-md)]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
         role="button" tabIndex={0} onClick={onClose}
      />

      <div className="relative bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="p-2 bg-[var(--color-primary-container)] rounded-[var(--radius-Apple-sm)]">
              <Download className="w-5 h-5 text-[var(--color-primary-text)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">数据导出</h2>
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                导出 {filteredOrganizations.length} 个组织的数据
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-[var(--space-apple-lg)] space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)]">
              选择导出格式
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {FORMAT_OPTIONS.map((config) => {
                const Icon = config.icon
                const isSelected = selectedFormat === config.value

                return (
                  <button
                    key={config.value}
                    onClick={() => setSelectedFormat(config.value)}
                    disabled={isExporting}
                    className={`relative p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border-2 transition-all ${
                      isSelected
                        ? 'border-[var(--color-success)] bg-[var(--color-success-container)]'
                        : 'border-[var(--border-color)] hover:border-[var(--border-color)] dark:hover:border-neutral-600'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--color-success-container)]0 rounded-[var(--radius-pill)] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-[var(--color-success-text)]' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} />
                    <div className={`font-medium text-sm ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {config.label}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{config.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                导出字段 ({visibleFields.length}/{fields.length})
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFields}
                  className="text-xs text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)]"
                >
                  全选
                </button>
                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                <button
                  onClick={deselectAllFields}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  取消全选
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {fields.map(field => (
                <label
                  key={field.key}
                  className={`flex items-center gap-2 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] border cursor-pointer transition-all ${
                    field.visible
                      ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-container)]'
                      : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={field.visible}
                    onChange={() => toggleField(field.key)}
                    className="w-4 h-4 rounded border-[var(--border-color)] dark:border-neutral-700 text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-white"
            >
              <Settings className="w-4 h-4" />
              高级选项
              {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvancedOptions && (
              <div className="mt-[var(--space-apple-sm)] p-[var(--space-apple-md)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)]">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    文件名
                  </label>
                  <input
                    type="text"
                    defaultValue={fileName}
                    className="w-full px-[var(--space-apple-sm)] py-2 border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
        aria-label="文件名"
      />
                </div>
              </div>
            )}
          </div>

          {showPreview && previewData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  数据预览 (前5条)
                </label>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  隐藏预览
                </button>
              </div>

              <div className="overflow-x-auto border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-tertiary)]">
                    <tr>
                      {visibleFields.map(field => (
                        <th key={field.key} className="px-[var(--space-apple-sm)] py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {previewData.map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50">
                        {visibleFields.map(field => (
                          <td key={field.key} className="px-[var(--space-apple-sm)] py-2 text-[var(--text-primary)] truncate max-w-[200px]">
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
              className="flex items-center gap-2 text-sm text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)]"
            >
              <Eye className="w-4 h-4" />
              显示数据预览
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 p-[var(--space-apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] rounded-[var(--radius-Apple-sm)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-error-text)]0 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{error}</div>
            </div>
          )}

          <div className="flex items-start gap-2 p-[var(--space-apple-sm)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] rounded-[var(--radius-Apple-sm)]">
            <Info className="w-5 h-5 text-[var(--color-secondary-text)]0 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] space-y-1">
              <p>• CSV格式可在Excel、Google Sheets等软件中直接打开</p>
              <p>• 支持UTF-8编码，完美显示中文内容</p>
              <p>• 导出的数据包含BOM头，确保Excel正确识别编码</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
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

            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
              >
                取消
              </button>

              <button
                onClick={handleExport}
                disabled={isExporting || visibleFields.length === 0}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-[var(--color-primary)] bg-primary-container rounded-[var(--radius-Apple-sm)] hover:bg-primary-container transition-colors disabled:opacity-50"
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
