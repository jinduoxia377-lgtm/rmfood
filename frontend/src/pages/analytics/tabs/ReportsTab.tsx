/**
 * 报表中心 Tab 组件
 * 提供预定义报表模板、自定义报表生成、定时发送功能
 */
import React, { useState } from 'react'
import { logger } from '@/utils/safeLogger'
import {
  FileText, Download, Clock, Calendar, Plus,
  Table, FileType, Settings2,
} from 'lucide-react'

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
  category: 'summary' | 'detail' | 'trend' | 'custom'
  format: 'pdf' | 'excel' | 'csv'
  lastGenerated?: Date
  schedule?: string
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'weekly-summary',
    name: '周报汇总',
    description: '本周配方创建、实验完成、用户活跃度等核心指标汇总',
    category: 'summary',
    format: 'pdf',
    schedule: '每周一 09:00',
  },
  {
    id: 'monthly-detail',
    name: '月度详细报表',
    description: '月度全量数据明细，包含所有维度分析和图表',
    category: 'detail',
    format: 'excel',
  },
  {
    id: 'quarterly-trend',
    name: '季度趋势分析',
    description: '季度数据趋势对比、增长率分析、预测建议',
    category: 'trend',
    format: 'pdf',
    schedule: '每季首日 10:00',
  },
  {
    id: 'user-activity',
    name: '用户行为报告',
    description: '用户活跃度、操作习惯、功能使用频率分析',
    category: 'custom',
    format: 'excel',
  },
  {
    id: 'system-performance',
    name: '系统性能报告',
    description: '系统响应时间、错误率、资源使用情况监控',
    category: 'detail',
    format: 'pdf',
  },
]

const CATEGORY_LABELS: Record<ReportTemplate['category'], string> = {
  summary: '汇总报表',
  detail: '详细报表',
  trend: '趋势分析',
  custom: '自定义报表',
}

const FORMAT_ICONS: Record<ReportTemplate['format'], React.ElementType> = {
  pdf: FileType,
  excel: Table,
  csv: FileText,
}

const FORMAT_COLORS: Record<ReportTemplate['format'], string> = {
  pdf: 'text-red-600 bg-red-50 dark:bg-red-950/40',
  excel: 'text-green-600 bg-green-50 dark:bg-green-950/40',
  csv: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
}

interface Props {
  filters: FilterConfig
}

export default function ReportsTab({ filters }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  return (
    <div className="w-full space-y-6">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          共 {REPORT_TEMPLATES.length} 个报表模板
        </div>

        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          创建自定义报表
        </button>
      </div>

      {/* 报表模板网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className={`bg-white dark:bg-slate-900 rounded-xl border p-6 hover:shadow-lg transition-all cursor-pointer group ${
              selectedTemplate === template.id
                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            {/* 头部：图标 + 格式标签 */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${FORMAT_COLORS[template.format]}`}>
                {(() => {
                  const IconComponent = FORMAT_ICONS[template.format]
                  return IconComponent ? <IconComponent className="w-6 h-6" /> : null
                })()}
              </div>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 text-text-muted rounded-full">
                {CATEGORY_LABELS[template.category]}
              </span>
            </div>

            {/* 内容 */}
            <h3 className="font-bold text-text-primary mb-2 group-hover:text-primary-600 transition-colors">
              {template.name}
            </h3>
            <p className="text-sm text-text-muted mb-4 line-clamp-2">
              {template.description}
            </p>

            {/* 底部：调度信息 + 操作按钮 */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              {template.schedule ? (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{template.schedule}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>手动生成</span>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  logger.info('生成报表:', template.name)
                }}
                className="px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                生成
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 自定义报表生成器（可折叠） */}
      {showGenerator && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-micro-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary-600" />
              自定义报表生成器
            </h3>
            <button
              onClick={() => setShowGenerator(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左侧：配置选项 */}
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
                      <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{dim}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧：预览 + 导出选项 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">导出格式</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { format: 'PDF', icon: FileType, color: 'text-red-600 border-red-200 hover:bg-red-50' },
                    { format: 'Excel', icon: Table, color: 'text-green-600 border-green-200 hover:bg-green-50' },
                    { format: 'CSV', icon: FileText, color: 'text-blue-600 border-blue-200 hover:bg-blue-50' },
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

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">定时发送</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600" />
                  <span className="text-sm text-text-muted">启用定时发送</span>
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
