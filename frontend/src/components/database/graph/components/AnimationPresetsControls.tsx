import { Sparkles, Target, RefreshCw, Zap, type LucideIcon } from 'lucide-react'
import { AnimationPreset } from './types'

export interface AnimationPresetsControlsProps {
  animationPreset: AnimationPreset
  onSwitchAnimationPreset: (preset: AnimationPreset) => void
}

const ANIMATION_PRESETS: Record<AnimationPreset, { label: string; icon: LucideIcon }> = {
  fadeIn:   { label: '淡入浮现', icon: Sparkles },
  expand:   { label: '从中心展开', icon: Target },
  converge: { label: '散点聚合', icon: RefreshCw },
  none:     { label: '无动画', icon: Zap },
}

export default function AnimationPresetsControls({ animationPreset, onSwitchAnimationPreset }: AnimationPresetsControlsProps) {
  return (
    <div className="absolute top-14 right-3 z-30 flex items-center gap-0.5 bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm rounded-lg border border-neutral-200/50 dark:border-neutral-700/40 p-0.5 shadow-sm">
      {(Object.entries(ANIMATION_PRESETS) as [AnimationPreset, typeof ANIMATION_PRESETS[AnimationPreset]][]).map(([key, preset]) => (
        <button key={key} onClick={() => onSwitchAnimationPreset(key)}
          className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${animationPreset === key ? 'bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700 shadow-sm' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
          title={preset.label}>
          <preset.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}
