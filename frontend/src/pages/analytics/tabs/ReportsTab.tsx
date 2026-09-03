/**
 * 报表中心 Tab — 参考 Dashboard 设计风格
 * 使用 Card+CardHeader+CardContent 统一卡片样式
 */
import React, { useState, useEffect, useCallback } from 'react'
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
        export_format: 'excel',
      })
      const reportData = reportRes.data

      const exportRes = await api.post('/analytics/export', {
        data: reportData.report,
        format: 'excel',
        file_name: `${template.name}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      }, { responseType: 'blob' })

      const blob = exportRes.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = exportRes.headers['content-disposition']
      a.download = disposition
        ?.split('filename*=')[1]?.replace(/"/g, '').replace(/UTF-8''/, '')
        || `${template.name}_export.xlsx`
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

  const CATEGORY_LABELS: Record<string, string> = {
    summary: '汇总报表',
    detail: '详细报表',
    trend: '趋势分析',
    custom: '自定义报表',
  }

  const FORMAT_ICONS: Record<string, React.ElementType> = {
    pdf: FileType,
    excel: Table,
    csv: FileText,
  }

  const FORMAT_COLORS: Record<string, string> = {
    pdf: 'text-error-600 bg-error-50 dark:bg-red-950/40',
    excel: 'text-success-600 bg-success-50 dark:bg-green-950/40',
    csv: 'text-secondary-600 bg-secondary-50 dark:bg-blue-950/40',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          <span className="text-sm text-text-muted">正在加载报表模板…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          共 {templates.length} 个报表模板
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          创建自定义报表
        </button>
      </div>

      {/* 导出结果消息 */}
      {exportMsg && (
        <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
          exportMsg.startsWith('导出失败')
            ? 'bg-error-50 dark:bg-error-950/20 border-error-200 dark:border-error-900/40 text-error-700 dark:text-error-400'
            : 'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900/40 text-success-700 dark:text-success-400'
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
                    ? 'ring-2 ring-primary-500 border-primary-500'
                    : ''
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      {IconComponent ? React.createElement(IconComponent, { className: 'w-5 h-5' }) : null}
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-surface-hover text-text-muted rounded-full">
                      {CATEGORY_LABELS.summary}
                    </span>
                  </div>
                  <CardTitle className="mt-3 text-base font-semibold">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-muted mb-4 line-clamp-2">{template.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{template.widgets.length} 个小部件</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleGenerate(template.id)
                      }}
                      disabled={exporting}
                      className="px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors flex items-center gap-1 disabled:opacity-50"
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
        <div className="p-10 text-center rounded-lg bg-surface-hover">
          <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">暂无报表模板</p>
          <p className="text-xs text-text-muted mt-1">后端尚未配置报表模板</p>
        </div>
      )}

      {/* 自定义报表生成器 */}
      {showGenerator && (
        <Card className="animate-micro-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="w-4 h-4 text-primary-600" />
                自定义报表生成器
              </CardTitle>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">报表名称</label>
                  <input
                    type="text"
                    placeholder="输入报表名称…"
                    className="w-full px-3 py-2 text-sm input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">数据范围</label>
                  <select className="w-full px-3 py-2 text-sm input">
                    <option>近 7 天</option>
                    <option>近 30 天</option>
                    <option>近 90 天</option>
                    <option>自定义范围</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">包含维度</label>
                  <div className="space-y-1.5">
                    {['配方数据', '实验记录', '用户行为', '系统日志'].map((dim) => (
                      <label key={dim} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded border-border text-primary-600" />
                        <span className="text-sm text-text-primary">{dim}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">导出格式</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { format: 'PDF', icon: FileType, color: 'text-error-600 border-error-200 hover:bg-error-50' },
                      { format: 'Excel', icon: Table, color: 'text-success-600 border-success-200 hover:bg-success-50' },
                      { format: 'CSV', icon: FileText, color: 'text-secondary-600 border-secondary-200 hover:bg-secondary-50' },
                    ].map(({ format, icon: Icon, color }) => (
                      <button
                        key={format}
                        className={`p-3 border rounded-lg transition-all flex flex-col items-center gap-1.5 ${color}`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{format}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  生成并预览报表
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
