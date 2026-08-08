/**
 * 报表中心 Tab 组件 — 真实后端数据版
 * 从 /api/v1/analytics/reports/templates 拉取报表模板
 * 从 /api/v1/analytics/export 导出报表
 */
import React, { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import {
  FileText, Download, Clock, Calendar, Plus,
  Table, FileType, Settings2, Loader2, CheckCircle2,
} from 'lucide-react'
import api from '@/api/client'

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

  // 拉取模板列表
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

  // 生成并下载报表
  const handleGenerate = useCallback(async (templateId: string) => {
    setExporting(true)
    setExportMsg(null)

    try {
      // 先根据模板构建 widgets
      const template = templates.find(t => t.id === templateId)
      if (!template) {
        setExportMsg('找不到模板')
        setExporting(false)
        return
      }

      // 调用 aggregate 获取数据
      const widgets = template.widgets.map((w: any) => ({
        type: w.type,
        title: w.title,
        entity: w.table || w.entity,
        columns: w.columns,
        limit: w.limit || 100,
      }))

      // 生成报告
      const reportRes = await api.post('/analytics/reports', {
        name: template.name,
        description: template.description,
        widgets,
        export_format: 'excel',
      })
      const reportData = reportRes.data

      // 导出
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="ml-3 text-sm text-text-muted">正在加载报表模板...</span>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          共 {templates.length} 个报表模板
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          创建自定义报表
        </button>
      </div>

      {/* 导出结果消息 */}
      {exportMsg && (
        <div className={`p-4 rounded-lg border ${exportMsg.startsWith('导出失败') ? 'bg-error-50 dark:bg-error-950/20 border-error-200 dark:border-error-800 text-error-700 dark:text-error-400' : 'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-800 text-success-700 dark:text-success-400'}`}>
          <div className="flex items-center gap-2">
            {exportMsg.startsWith('导出失败') ? <Settings2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span className="text-sm font-medium">{exportMsg}</span>
          </div>
        </div>
      )}

      {/* 报表模板网格 */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const firstWidget = template.widgets[0]
            const format = firstWidget?.type === 'table' ? 'excel' : 'pdf'
            const IconComponent = FORMAT_ICONS[format] || FileType

            return (
              <div
                key={template.id}
                className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 hover:shadow-lg transition-all cursor-pointer group ${
                  selectedTemplate === template.id
                    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                    : 'border-neutral-200 dark:border-neutral-700'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${FORMAT_COLORS[format]}`}>
                    {IconComponent ? <IconComponent className="w-6 h-6" /> : null}
                  </div>
                  <span className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-text-muted rounded-full">
                    {CATEGORY_LABELS.summary}
                  </span>
                </div>

                <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary-600 transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-text-muted mb-4 line-clamp-2">
                  {template.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
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
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">暂无报表模板</p>
          <p className="text-xs text-text-muted mt-1">后端尚未配置报表模板</p>
        </div>
      )}

      {/* 自定义报表生成器 */}
      {showGenerator && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 animate-micro-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary-600" />
              自定义报表生成器
            </h3>
            <button
              onClick={() => setShowGenerator(false)}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">报表名称</label>
                <input
                  type="text"
                  placeholder="输入报表名称..."
                  className="w-full px-4 py-2 input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">数据范围</label>
                <select className="w-full px-4 py-2 input">
                  <option>近 7 天</option>
                  <option>近 30 天</option>
                  <option>近 90 天</option>
                  <option>自定义范围</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">包含维度</label>
                <div className="space-y-2">
                  {['配方数据', '实验记录', '用户行为', '系统日志'].map((dim) => (
                    <label key={dim} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{dim}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">导出格式</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { format: 'PDF', icon: FileType, color: 'text-error-600 border-red-200 hover:bg-error-50' },
                    { format: 'Excel', icon: Table, color: 'text-success-600 border-green-200 hover:bg-success-50' },
                    { format: 'CSV', icon: FileText, color: 'text-secondary-600 border-blue-200 hover:bg-secondary-50' },
                  ].map(({ format, icon: Icon, color }) => (
                    <button
                      key={format}
                      className={`p-4 border rounded-lg transition-all flex flex-col items-center gap-2 ${color}`}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-xs font-medium">{format}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" />
                生成并预览报表
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
