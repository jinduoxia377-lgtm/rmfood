/**
 * 报表中心 Tab — 参考 Dashboard 设计风格
 * 使用 Card+CardHeader+CardContent 统一卡片样式
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '@/utils/safeLogger'
import {
  FileText, Download, Clock, Plus,
  Table, FileType, Settings2, Loader2, CheckCircle2,
} from 'lucide-react'
import api from '@/api/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  widgets: Array<{
    type: string
    title: string
    [key: string]: unknown
  }>
  category?: string
}

interface Props {
  filters: FilterConfig
}

export default function ReportsTab({ filters }: Props) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  // 自定义报表表单状态
  const [reportName, setReportName] = useState('')
  // 自定义报表表单状态 — 初始值来自父级 filters，可手动覆盖
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>(filters?.timeRange ?? '30d')
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['formulas'])
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('excel')

  const formatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get('/analytics/reports/templates')
      .then(res => {
        setTemplates(res.data.templates ?? [])
        setLoading(false)
      })
      .catch(e => {
        logger.error('[ReportsTab] Failed to load templates:', e)
        setLoading(false)
      })
  }, [])

  const handleGenerate = useCallback(async (templateId: string) => {
    setExporting(true)
    setExportMsg(null)

    try {
      const template = templates.find(t => t.id === templateId)
      if (!template) {
        setExportMsg('找不到模板')
        setExporting(false)
        return
      }

      const widgets = template.widgets.map((w: any) => ({
        type: w.type,
        title: w.title,
        entity: w.table || w.entity,
        columns: w.columns,
        limit: w.limit || 100,
      }))

      const reportRes = await api.post('/analytics/reports', {
        name: template.name,
        description: template.description,
        widgets,
        export_format: exportFormat,
      })
      const reportData = reportRes.data

      const exportRes = await api.post('/analytics/export', {
        data: reportData.report,
        format: exportFormat,
        file_name: `${template.name}_${new Date().toISOString().slice(0, 10)}.${exportFormat === 'pdf' ? 'pdf' : exportFormat === 'csv' ? 'csv' : 'xlsx'}`,
      }, { responseType: 'blob' })

      const blob = exportRes.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = exportRes.headers['content-disposition']
      const ext = exportFormat === 'pdf' ? 'pdf' : exportFormat === 'csv' ? 'csv' : 'xlsx'
      a.download = disposition
        ?.split('filename*=')[1]?.replace(/"/g, '').replace(/UTF-8''/, '')
        || `${template.name}_export.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportMsg(`报表 "${template.name}" 已成功生成并下载`)
    } catch (e: any) {
      logger.error('[ReportsTab] Export failed:', e)
      setExportMsg(`导出失败: ${e?.response?.data?.detail || e?.message || '未知错误'}`)
    } finally {
      setExporting(false)
    }
  }, [templates])

  // 自定义报表提交处理
  const handleCustomGenerate = useCallback(async () => {
    if (!reportName.trim()) {
      setExportMsg('请输入报表名称')
      return
    }

    setExporting(true)
    setExportMsg(null)

    try {
      const widgets = selectedDimensions.map(dim => ({
        type: dim === 'formulas' ? 'table' : dim === 'experiments' ? 'table' : 'kpi',
        title: `${dim} 数据`,
        entity: dim,
        columns: ['id', 'name', 'status', 'created_at'],
        limit: 100,
      }))

      const reportRes = await api.post('/analytics/reports', {
        name: reportName.trim(),
        description: `自定义报表 - 包含 ${selectedDimensions.join(', ')} 数据`,
        widgets,
        export_format: exportFormat,
        filters: { time_range: timeRange },
      })

      const reportData = reportRes.data

      // 根据格式下载
      const formatMap: Record<string, string> = { pdf: 'pdf', excel: 'excel', csv: 'csv' }
      const fmt = formatMap[exportFormat] || 'excel'

      const exportRes = await api.post('/analytics/export', {
        data: reportData.report,
        format: fmt,
        file_name: `${reportName.trim()}_${new Date().toISOString().slice(0, 10)}.${fmt}`,
      }, { responseType: 'blob' })

      const blob = exportRes.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportName.trim()}_export.${fmt}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportMsg(`报表 "${reportName.trim()}" 已成功生成并下载`)
      setShowGenerator(false)
      // 重置表单
      setReportName('')
      setSelectedDimensions(['formulas'])
      setExportFormat('excel')
    } catch (e: any) {
      logger.error('[ReportsTab] Custom report failed:', e)
      setExportMsg(`导出失败: ${e?.response?.data?.detail || e?.message || '未知错误'}`)
    } finally {
      setExporting(false)
    }
  }, [reportName, selectedDimensions, exportFormat, timeRange])

  const toggleDimension = (dim: string) => {
    setSelectedDimensions(prev =>
      prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]
    )
  }

  const CATEGORY_LABELS: Record<string, string> = {
    summary: '汇总报表',
    detail: '详细报表',
    trend: '趋势分析',
    custom: '自定义报表',
  }

  const FORMAT_ICONS: Record<string, React.ComponentType<any>> = {
    pdf: FileType,
    excel: Table,
    csv: FileText,
  }

  const FORMAT_COLORS: Record<string, string> = {
    pdf: 'text-[var(--color-error-text)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/40',
    excel: 'text-[var(--color-success-text)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/40',
    csv: 'text-[var(--color-secondary-text)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/40',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-[var(--space-apple-sm)]">
          <Loader2 className="w-6 h-6 text-[var(--color-primary-text)] animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">正在加载报表模板…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-[var(--space-apple-md)]">

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-muted)]">
          共 {templates.length} 个报表模板
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="px-[var(--space-apple-sm)] py-1.5 bg-primary-container hover:bg-primary-container text-[var(--color-primary)] text-sm rounded-[var(--radius-Apple-sm)] transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          创建自定义报表
        </button>
      </div>

      {/* 导出结果消息 */}
      {exportMsg && (
        <div className={`p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border text-sm flex items-center gap-2 ${
          exportMsg.startsWith('导出失败')
            ? 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/20 border-[var(--color-error-border)] dark:border-error-900/40 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]'
            : 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-success-900/40 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
        }`}>
          {exportMsg.startsWith('导出失败') ? <Settings2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{exportMsg}</span>
        </div>
      )}

      {/* 报表模板网格 */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const firstWidget = template.widgets[0]
            const format = firstWidget?.type === 'table' ? 'excel' : 'pdf'
            const IconComponent = FORMAT_ICONS[format] || FileType
            const colorClass = FORMAT_COLORS[format] || FORMAT_ICONS.pdf

            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTemplate === template.id
                    ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]'
                    : ''
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-[var(--radius-Apple-sm)] ${colorClass}`}>
                      {IconComponent ? React.createElement(IconComponent, { className: 'w-5 h-5' }) : null}
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-surface-hover text-[var(--text-muted)] rounded-[var(--radius-pill)]">
                      {CATEGORY_LABELS[template.category ?? 'summary'] ?? '汇总报表'}
                    </span>
                  </div>
                  <CardTitle className="mt-[var(--space-apple-sm)] text-base font-semibold">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--text-muted)] mb-[var(--space-apple-md)] line-clamp-2">{template.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{template.widgets.length} 个小部件</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleGenerate(template.id)
                      }}
                      disabled={exporting}
                      className="px-[var(--space-apple-sm)] py-1.5 text-xs bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/40 text-[var(--color-primary-text)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/60 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      生成
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="p-10 text-center rounded-[var(--radius-Apple-sm)] bg-surface-hover">
          <FileText className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-[var(--space-apple-sm)]" />
          <p className="text-[var(--text-muted)] text-sm">暂无报表模板</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">后端尚未配置报表模板</p>
        </div>
      )}

      {/* 自定义报表生成器 */}
      {showGenerator && (
        <Card className="animate-micro-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="w-4 h-4 text-[var(--color-primary-text)]" />
                自定义报表生成器
              </CardTitle>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-[var(--space-apple-md)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">报表名称</label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="输入报表名称…"
                    className="w-full px-[var(--space-apple-sm)] py-2 text-sm input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">数据范围</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
                    className="w-full px-[var(--space-apple-sm)] py-2 text-sm input"
                  >
                    <option value="7d">近 7 天</option>
                    <option value="30d">近 30 天</option>
                    <option value="90d">近 90 天</option>
                    <option value="1y">近 1 年</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">包含维度</label>
                  <div className="space-y-1.5">
                    {[
                      { key: 'formulas', label: '配方数据' },
                      { key: 'experiments', label: '实验记录' },
                      { key: 'users', label: '用户行为' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDimensions.includes(key)}
                          onChange={() => toggleDimension(key)}
                          className="rounded border-border text-[var(--color-primary-text)]"
                        />
                        <span className="text-sm text-[var(--text-primary)]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-[var(--space-apple-md)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">导出格式</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { format: 'pdf' as const, icon: FileType, color: 'text-[var(--color-error-text)] border-[var(--color-error-border)] hover:bg-[var(--color-error-container)]' },
                      { format: 'excel' as const, icon: Table, color: 'text-[var(--color-success-text)] border-[var(--color-success-border)] hover:bg-[var(--color-success-container)]' },
                      { format: 'csv' as const, icon: FileText, color: 'text-[var(--color-secondary-text)] border-[var(--color-secondary-border)] hover:bg-[var(--color-secondary-container)]' },
                    ].map(({ format, icon: Icon, color }) => (
                      <button
                        key={format}
                        onClick={() => setExportFormat(format)}
                        className={`p-[var(--space-apple-sm)] border rounded-[var(--radius-Apple-sm)] transition-all flex flex-col items-center gap-1.5 ${
                          exportFormat === format ? 'ring-2 ring-[var(--color-primary)] ' + color : color
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{format.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCustomGenerate}
                  disabled={exporting || !reportName.trim() || selectedDimensions.length === 0}
                  className="w-full py-2 bg-primary-container hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-primary)] rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  生成并下载报表
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
