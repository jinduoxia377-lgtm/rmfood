import { useState, useCallback } from 'react'
import { X, Save, RotateCcw, Eye, EyeOff, Palette } from 'lucide-react'
import type { CustomTheme, ThemeStyles } from '@/types/theme-mode'
import { DEFAULT_THEME_STYLES } from '@/types/theme-mode'
import { themeStorageAdapter } from '@/utils/theme/ThemeStorageAdapter'
import { versionController } from '@/utils/theme/VersionController'
import { themeEventBus } from '@/utils/events/ThemeEventBus'
import { ColorEditor } from './ColorEditor'
import { logger } from '@/utils/safeLogger';


interface ThemeEditorProps {
  theme?: CustomTheme | null
  onSave: (theme: CustomTheme) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}

type PreviewMode = 'idle' | 'previewing' | 'applying'

export function ThemeEditor({ theme, onSave, onCancel, onDelete }: ThemeEditorProps) {
  const [name, setName] = useState(theme?.name ?? '新主题')
  const [description, setDescription] = useState(theme?.description ?? '')
  const [config, setConfig] = useState<ThemeStyles>(theme?.config ?? { ...DEFAULT_THEME_STYLES })
  const [previewMode, setPreviewMode] = useState<PreviewMode>('idle')
  const [isSaving, setIsSaving] = useState(false)

  const handleConfigChange = useCallback((partial: Partial<ThemeStyles>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    if (previewMode === 'idle') setPreviewMode('previewing')
  }, [previewMode])

  const handleSave = async () => {
    setIsSaving(true)
    setPreviewMode('applying')

    try {
      let savedTheme: CustomTheme

      if (theme?.id) {
        savedTheme = themeStorageAdapter.update(theme.id, { name, description, config })!
        versionController.createSnapshot(config, `更新: ${name}`)
      } else {
        savedTheme = themeStorageAdapter.create({ name, description, config, isPreset: false, tags: [] })
        versionController.createSnapshot(config, `创建: ${name}`)
      }

      await themeEventBus.emit('custom-theme-update', {
        data: { theme: savedTheme, action: theme ? 'update' : 'create' },
      })

      onSave(savedTheme)
    } catch (error) {
      logger.error('[ThemeEditor] Save failed:', error)
    } finally {
      setIsSaving(false)
      setPreviewMode('idle')
    }
  }

  const handleReset = () => {
    setConfig({ ...DEFAULT_THEME_STYLES })
    setPreviewMode('previewing')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {theme ? '编辑主题' : '新建主题'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">自定义颜色、字体和视觉样式</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-6 p-6">
            {/* Left Panel - Properties */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">主题名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="输入主题名称"
                />
              </div>

              {/* Color Editor */}
              <ColorEditor config={config} onChange={handleConfigChange} />

              {/* Preview Mode Indicator */}
              {previewMode === 'previewing' && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                  <Eye className="w-4 h-4" />
                  <span>预览模式 - 点击"应用"保存更改</span>
                </div>
              )}
            </div>

            {/* Right Panel - Live Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                实时预览
              </h3>

              <div
                className="rounded-xl p-6 space-y-4 transition-all duration-200"
                style={{
                  backgroundColor: config.colors?.background,
                  color: config.colors?.text,
                  fontFamily: config.font?.fontFamily,
                  borderRadius: `${config.spacing?.borderRadius ?? 12}px`,
                }}
              >
                {/* Sample Card */}
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: config.colors?.surface }}
                >
                  <h4 style={{ color: config.colors?.primary, fontWeight: 600 }}>
                    示例标题
                  </h4>
                  <p style={{ fontSize: `${config.font?.fontSize ?? 16}px`, opacity: 0.8 }}>
                    这是一段示例文本，展示当前主题的字体和颜色效果。
                  </p>
                </div>

                {/* Sample Buttons */}
                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 rounded-lg text-white font-medium transition-transform hover:scale-105"
                    style={{
                      backgroundColor: config.colors?.primary,
                      borderRadius: `${config.spacing?.borderRadius ?? 12}px`,
                    }}
                  >
                    主要按钮
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg font-medium border-2 transition-transform hover:scale-105"
                    style={{
                      borderColor: config.colors?.primary,
                      color: config.colors?.primary,
                      borderRadius: `${config.spacing?.borderRadius ?? 12}px`,
                    }}
                  >
                    次要按钮
                  </button>
                </div>

                {/* Sample Input */}
                <input
                  type="text"
                  placeholder="输入框示例"
                  className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none"
                  style={{
                    borderColor: config.colors?.text,
                    backgroundColor: config.colors?.surface,
                    color: config.colors?.text,
                    borderRadius: `${config.spacing?.borderRadius ?? 12}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-2">
            {onDelete && theme && (
              <button
                onClick={() => onDelete(theme.id)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                删除主题
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '应用'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
