import { ThemeConfig, THEME_PRESETS } from '../types'

export interface ThemePanelProps {
  [key: string]: any;
  showThemePanel: boolean
  activeTheme: ThemeConfig
  onApplyTheme: (theme: ThemeConfig) => void
  onClose: () => void
}

export default function ThemePanel({ showThemePanel, activeTheme, onApplyTheme, onClose }: ThemePanelProps) {
  if (!showThemePanel) return null

  return (
    <>
      <button onClick={onClose}
        className="absolute top-3 right-14 z-30 w-6 h-6 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
        title={`主题: ${activeTheme.name}`}>
        <span className="text-xs">{activeTheme.icon}</span>
      </button>

      <div className="absolute top-12 right-3 z-50 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-neutral-200/60 dark:border-neutral-700/60 p-3 min-w-[220px] animate-fade-in">
        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 px-1">选择配色主题</div>
        <div className="space-y-1">
          {THEME_PRESETS.map(t => (
            <button key={t.id} onClick={() => onApplyTheme(t)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTheme.id === t.id ? 'ring-2 ring-offset-1 ring-success-500 bg-primary-50/80 dark:bg-primary-300/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/40'}`}
              style={{ color: activeTheme.id === t.id ? t.accentColor : undefined }}>
              <span className="text-base">{t.icon}</span>
              <span className="flex-1 text-left">{t.name}</span>
              <div className="flex gap-0.5">
                {['herb', 'compound', 'target'].slice(0, 3).map(type => (
                  <span key={type} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.nodeColors[type]?.color }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
