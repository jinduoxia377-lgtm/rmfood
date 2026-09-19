import { useState, useCallback } from 'react'
import { X, Save, RotateCcw, Eye, EyeOff, Palette } from 'lucide-react'
import type { UserCustomTheme, ThemeStyles } from '@/types/theme.types'
import { DEFAULT_THEME_STYLES } from '@/types/theme.types'
import { themeStorage } from '@/stores/theme.storage'

import { themeEventBus } from '@/utils/events/ThemeEventBus'
import { ColorEditor } from './ColorEditor'
import { cn } from '@/lib/utils'
import { logger } from '@/utils/safeLogger';


interface ThemeEditorProps {
  theme?: UserCustomTheme | null
  onSave: (theme: UserCustomTheme) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}

type PreviewMode = 'idle' | 'previewing' | 'applying'
type PreviewView = 'samples' | 'context'

export function ThemeEditor({ theme, onSave, onCancel, onDelete }: ThemeEditorProps) {
  const [name, setName] = useState(theme?.name ?? '新主题')
  const [description, setDescription] = useState(theme?.description ?? '')
  const [config, setConfig] = useState<ThemeStyles>(theme?.config ?? { ...DEFAULT_THEME_STYLES })
  const [previewMode, setPreviewMode] = useState<PreviewMode>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [previewView, setPreviewView] = useState<PreviewView>('samples')

  const handleConfigChange = useCallback((partial: Partial<ThemeStyles>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
    if (previewMode === 'idle') setPreviewMode('previewing')
  }, [previewMode])

  const handleSave = async () => {
    setIsSaving(true)
    setPreviewMode('applying')

    try {
      let savedTheme: UserCustomTheme

      if (theme?.id) {
        savedTheme = themeStorage.updateUserCustomTheme(theme.id, { name, description, config })!
        themeStorage.createVersion(config, `更新: ${name}`)
      } else {
        savedTheme = themeStorage.createUserCustomTheme({ name, description, config, isPreset: false, tags: [] })
        themeStorage.createVersion(config, `创建: ${name}`)
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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              {theme ? '编辑主题' : '新建主题'}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">自定义颜色、字体和视觉样式</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
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
                <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">主题名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500"
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  实时预览
                </h3>
                <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewView('samples')}
                    className={cn(
                      'px-3 py-1 text-xs rounded-md transition-colors',
                      previewView === 'samples'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
                    )}
                  >
                    控件样本
                  </button>
                  <button
                    onClick={() => setPreviewView('context')}
                    className={cn(
                      'px-3 py-1 text-xs rounded-md transition-colors',
                      previewView === 'context'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
                    )}
                  >
                    上下文预览
                  </button>
                </div>
              </div>

              {previewView === 'samples' ? (
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
              ) : (
                /* Context Preview — 模拟真实仪表盘布局 */
                <div
                  className="rounded-xl overflow-hidden border transition-all duration-200"
                  style={{
                    backgroundColor: config.colors?.background,
                    color: config.colors?.text,
                    borderColor: config.colors?.border || 'rgba(148,163,184,0.2)',
                  }}
                >
                  {/* Mini Header */}
                  <div className="flex items-center justify-between px-4 py-2.5" style={{
                    backgroundColor: config.colors?.surface,
                    borderBottom: `1px solid ${config.colors?.border || 'rgba(148,163,184,0.2)'}`,
                  }}>
                    <span className="text-xs font-semibold" style={{ color: config.colors?.primary }}>RMFOOD</span>
                    <div className="flex gap-3 text-[10px]" style={{ color: config.colors?.secondary || config.colors?.text }}>
                      <span>仪表盘</span>
                      <span>配方</span>
                      <span>实验</span>
                      <span>AI</span>
                    </div>
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: config.colors?.primary }} />
                  </div>

                  {/* Mini Stats Row */}
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {[
                      { label: '配方总数', value: '128', color: '#34C759' },
                      { label: '待审核', value: '23', color: '#D97706' },
                      { label: '本月新增', value: '+12', color: '#AF52DE' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-2 rounded-lg" style={{
                        backgroundColor: config.colors?.surface,
                        border: `1px solid ${config.colors?.border || 'rgba(148,163,184,0.2)'}`,
                      }}>
                        <div className="text-[10px] leading-tight" style={{ color: config.colors?.secondary || config.colors?.text }}>{stat.label}</div>
                        <div className="text-sm font-bold mt-0.5" style={{ color: stat.color }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mini Chart Area */}
                  <div className="mx-3 mb-3 h-16 rounded-lg overflow-hidden relative" style={{
                    backgroundColor: config.colors?.surface,
                    border: `1px solid ${config.colors?.border || 'rgba(148,163,184,0.2)'}`,
                  }}>
                    {/* Simulated area chart */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="ctxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34C759" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#34C759" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,50 Q20,35 40,40 T80,25 T120,30 T160,15 T200,20 L200,64 L0,64 Z"
                        fill="url(#ctxGrad)"
                      />
                      <path
                        d="M0,50 Q20,35 40,40 T80,25 T120,30 T160,15 T200,20"
                        fill="none"
                        stroke="#34C759"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/50">
          <div className="flex gap-2">
            {onDelete && theme && (
              <button
                onClick={() => onDelete(theme.id)}
                className="px-4 py-2 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors"
              >
                删除主题
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
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
