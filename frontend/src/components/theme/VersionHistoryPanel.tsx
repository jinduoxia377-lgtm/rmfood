import { useState } from 'react'
import { History, RotateCcw, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { versionController } from '@/utils/theme/VersionController'
import type { ThemeStyles } from '@/types/theme-mode'

interface VersionHistoryPanelProps {
  onSelectVersion: (config: ThemeStyles) => void
  onClose: () => void
}

export function VersionHistoryPanel({ onSelectVersion, onClose }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState(versionController.getHistory())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleRollback = (versionId: string) => {
    const config = versionController.rollback(versionId)
    if (config && window.confirm('是否将主题回退到此版本？')) {
      onSelectVersion(config)
      onClose()
    }
    // Refresh list
    setVersions(versionController.getHistory())
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return new Date(timestamp).toLocaleDateString('zh-CN')
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5" />
          版本历史
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          ×
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {versions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无版本记录</p>
            <p className="text-sm mt-1">保存主题时将自动创建快照</p>
          </div>
        ) : (
          versions.map((version, index) => (
            <div
              key={version.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Timeline Node */}
              <button
                onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {version.summary || `版本 ${index + 1}`}
                    </p>
                    <p className="text-xs text-gray-500">{formatTime(version.timestamp)}</p>
                  </div>
                </div>
                {expandedId === version.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Expanded Details */}
              {expandedId === version.id && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Color Preview */}
                  <div className="flex gap-1">
                    {Object.entries(version.snapshot.colors || {}).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="flex-1">
                        <div
                          className="h-8 rounded border border-gray-200 dark:border-gray-600"
                          style={{ backgroundColor: String(value) }}
                        />
                        <p className="text-xs mt-1 text-gray-500 truncate">{key}</p>
                      </div>
                    ))}
                  </div>

                  {/* Rollback Button */}
                  <button
                    onClick={() => handleRollback(version.id)}
                    className="w-full py-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    回退到此版本
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            if (window.confirm('确定要清空所有版本历史吗？')) {
              versionController.clear()
              setVersions([])
            }
          }}
          className="text-sm text-red-600 hover:text-red-700"
        >
          清空历史
        </button>
      </div>
    </div>
  )
}
