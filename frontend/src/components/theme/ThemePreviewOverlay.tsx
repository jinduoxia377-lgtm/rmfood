import { useState, useEffect, useRef } from 'react'
import { X, Eye } from 'lucide-react'
import type { CustomTheme, ThemeStyles } from '@/types/theme-mode'

interface ThemePreviewOverlayProps {
  theme: CustomTheme
  position: { x: number; y: number }
  onClose: () => void
  onApply: (theme: CustomTheme) => void
}

export function ThemePreviewOverlay({ theme, position, onClose, onApply }: ThemePreviewOverlayProps) {
  const [isVisible, setIsVisible] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Auto-dismiss after 3 seconds
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for fade-out animation
    }, 3000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const config = theme.config || ({} as Record<string, unknown>)

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y + 10}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-4 w-80"
        style={{ backgroundColor: config.colors?.background || '#fff' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{ color: config.colors?.text || '#000' }}>
            {theme.name}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Content */}
        <div
          className="rounded-lg p-3 mb-3 space-y-2"
          style={{ backgroundColor: config.colors?.surface || '#F5F5F7' }}
        >
          {/* Color Swatches */}
          <div className="flex gap-1">
            {['primary', 'secondary', 'tertiary', 'error'].map((key) => (
              <div
                key={key}
                className="w-8 h-8 rounded-md border border-white/20"
                style={{ backgroundColor: (config.colors as Record<string, string>)?.[key] ?? 'var(--color-neutral-400, #9CA3AF)' }}
              />
            ))}
          </div>

          {/* Sample Text */}
          <p className="text-xs" style={{ color: config.colors?.text || '#000', fontSize: `${Number(config.font?.fontSize || 16) * 0.8}px` }}>
            预览文本效果
          </p>
          <p className="text-xs opacity-60" style={{ color: config.colors?.text || '#000' }}>
            次要文本内容
          </p>
        </div>

        {/* Apply Button */}
        <button
          onClick={() => onApply(theme)}
          className="w-full py-2 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: config.colors?.primary || 'var(--color-primary, #34C759)' }}
        >
          <Eye className="w-4 h-4" />
          应用此主题
        </button>
      </div>
    </div>
  )
}
