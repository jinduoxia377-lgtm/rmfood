import { useState } from 'react'
import { Lock, Unlock, RefreshCw } from 'lucide-react'
import type { ThemeStyles } from '@/types/theme.types'
import { logger } from '@/utils/safeLogger';


interface ColorEditorProps {
  config: ThemeStyles
  onChange: (partial: Partial<ThemeStyles>) => void
}

const COLOR_KEYS = [
  { key: 'primary', label: '主色调', lockable: true },
  { key: 'secondary', label: '辅助色', lockable: false },
  { key: 'tertiary', label: '第三色', lockable: false },
  { key: 'background', label: '背景色', lockable: false },
  { key: 'surface', label: '表面色', lockable: false },
  { key: 'text', label: '文本色', lockable: false },
  { key: 'error', label: '错误色', lockable: false },
]

export function ColorEditor({ config, onChange }: ColorEditorProps) {
  const [lockedColors, setLockedColors] = useState<Set<string>>(new Set(['primary']))
  const [syncEnabled, setSyncEnabled] = useState(true)

  const handleColorChange = (key: string, value: string) => {
    const colorsUpdate = { [`colors.${key}`]: value } as unknown as Partial<ThemeStyles>
    onChange(colorsUpdate)

    // Sync logic: when primary changes, auto-generate secondary/tertiary
    if (syncEnabled && key === 'primary') {
      try {
        const hex = value.replace('#', '')
        if (hex.length !== 6) return

        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        if (isNaN(r) || isNaN(g) || isNaN(b)) return

        // Generate lighter secondary (subtle lighten)
        const sR = Math.min(255, Math.round(r * 1.15 + 25))
        const sG = Math.min(255, Math.round(g * 1.15 + 25))
        const sB = Math.min(255, Math.round(b * 1.15 + 25))
        const secondary = `#${sR.toString(16).padStart(2, '0')}${sG.toString(16).padStart(2, '0')}${sB.toString(16).padStart(2, '0')}`

        // Generate lighter tertiary (more pronounced lighten)
        const tR = Math.min(255, Math.round(r * 1.3 + 50))
        const tG = Math.min(255, Math.round(g * 1.3 + 50))
        const tB = Math.min(255, Math.round(b * 1.3 + 50))
        const tertiary = `#${tR.toString(16).padStart(2, '0')}${tG.toString(16).padStart(2, '0')}${tB.toString(16).padStart(2, '0')}`

        setTimeout(() => {
          onChange({
            'colors.secondary': secondary,
            'colors.tertiary': tertiary,
          } as unknown as Partial<ThemeStyles>)
        }, 50)
      } catch (e) {
        logger.warn('[ColorEditor] Sync failed:', e)
      }
    }
  }

  const toggleLock = (key: string) => {
    setLockedColors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Sync Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">同步调整</span>
        <button
          onClick={() => setSyncEnabled(!syncEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${syncEnabled ? 'bg-primary-600' : 'bg-neutral-300'}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${syncEnabled ? 'left-6' : 'left-1'}`}
          />
        </button>
      </div>

      {/* Color Grid */}
      <div className="grid grid-cols-2 gap-3">
        {COLOR_KEYS.map(({ key, label, lockable }) => {
          const isLocked = lockedColors.has(key)
          const currentValue = config.colors?.[key as keyof NonNullable<typeof config.colors>] ?? '#000000'

          return (
            <div key={key} className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</label>
                {lockable && (
                  <button onClick={() => toggleLock(key)} title={isLocked ? '已锁定' : '点击锁定'}>
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-primary-600" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentValue}
                  onChange={(e) => !isLocked && handleColorChange(key, e.target.value)}
                  disabled={isLocked}
                  className="w-10 h-10 rounded cursor-pointer border-2 border-neutral-200 dark:border-neutral-600"
                />
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && !isLocked && handleColorChange(key, e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded font-mono"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
