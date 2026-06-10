/**
 * 导出面板组件
 *
 * @description 提供配方导出功能的 UI 界面
 * @version 1.0.0
 */

import { useState } from 'react'
import { Button } from '@/components/ui'
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'

interface ExportPanelProps {
  hasData: boolean
  onExport: (format: 'json' | 'csv' | 'pdf', options: { includePatentScores: boolean; includeDetailedInfo: boolean }) => void
}

const EXPORT_FORMATS = [
  {
    id: 'json' as const,
    label: 'JSON',
    description: '完整的配方数据结构',
    icon: FileJson,
    available: true,
  },
  {
    id: 'csv' as const,
    label: 'CSV',
    description: 'Excel 兼容格式',
    icon: FileSpreadsheet,
    available: true,
  },
  {
    id: 'pdf' as const,
    label: 'PDF',
    description: '专业报告格式',
    icon: FileText,
    available: false,
    badge: '开发中',
  },
]

export function ExportPanel({ hasData, onExport }: ExportPanelProps) {
  const [includePatentScores, setIncludePatentScores] = useState(false)
  const [includeDetailedInfo, setIncludeDetailedInfo] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!hasData) return
    if (!EXPORT_FORMATS.find(f => f.id === format)?.available) return

    setIsExporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      onExport(format, { includePatentScores, includeDetailedInfo })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        disabled={!hasData}
        onClick={() => {}}
        leftIcon={<Download className="w-4 h-4" />}
      >
        导出配方数据
      </Button>

      <div className="space-y-2">
        {EXPORT_FORMATS.map((format) => (
          <button
            key={format.id}
            onClick={() => handleExport(format.id)}
            disabled={!hasData || !format.available || isExporting}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
              transition-all duration-200
              ${hasData && format.available && !isExporting
                ? 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
              }
            `}
          >
            <format.icon className={`w-4 h-4 ${format.id === 'json' ? 'text-blue-500' : format.id === 'csv' ? 'text-green-500' : 'text-red-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{format.label}</span>
                {format.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                    {format.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 truncate">{format.description}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includePatentScores}
            onChange={(e) => setIncludePatentScores(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">包含专利协同评分</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDetailedInfo}
            onChange={(e) => setIncludeDetailedInfo(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">包含详细信息</span>
        </label>
      </div>
    </div>
  )
}
