import { LayoutType } from '../types'
import { THEME_PRESETS, ThemeConfig } from '../types'
import type { AnimationPreset } from './types'

const ANIMATION_PRESETS: Record<AnimationPreset, { label: string; icon: string; duration: number }> = {
  fadeIn:   { label: '淡入浮现', icon: '✨', duration: 800 },
  expand:   { label: '从中心展开', icon: '🎯', duration: 1200 },
  converge: { label: '散点聚合', icon: '🌀', duration: 1000 },
  none:     { label: '无动画', icon: '⚡', duration: 0 },
}

export interface LayoutIndicatorProps {
  [key: string]: any;
  localLayout: LayoutType
  showLayoutMenu: boolean
  onToggleLayoutMenu: () => void
  onSwitchLayout: (layout: LayoutType) => void
}

const LAYOUT_OPTIONS: [LayoutType, string, string][] = [
  ['force', '力导向', '🧲'],
  ['radial', '放射状', '🎯'],
  ['tree', '树形', '🌳'],
  ['hierarchical', '层次化', '📊'],
  ['circular', '同心圆', '⭕'],
  ['grid', '网格', '▦'],
] as const

const LAYOUT_NAMES: Record<LayoutType, string> = {
  force: '力导向', radial: '放射', tree: '树形',
  hierarchical: '层次化', circular: '圆形', grid: '网格',
}

export default function LayoutIndicator({ localLayout, showLayoutMenu, onToggleLayoutMenu, onSwitchLayout }: LayoutIndicatorProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
      <div
        className="px-3 py-1 rounded-full text-[10px] font-medium bg-white/92 dark:bg-neutral-800/92 backdrop-blur-md border border-neutral-200/60 dark:border-neutral-700/60 shadow-sm text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-white dark:hover:bg-neutral-700 transition-colors"
        onClick={onToggleLayoutMenu}
      >
        布局: {LAYOUT_NAMES[localLayout]}
        <span className="ml-1 text-[8px]">▾</span>
      </div>
      {showLayoutMenu && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200/60 dark:border-neutral-700/60 p-1.5 min-w-[140px] z-50 animate-fade-in">
          {LAYOUT_OPTIONS.map(([key, label, icon]) => (
            <button key={key} onClick={() => onSwitchLayout(key)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${localLayout === key ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-50 dark:hover:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}>
              <span>{icon}</span><span>{label}</span>
              {localLayout === key && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
