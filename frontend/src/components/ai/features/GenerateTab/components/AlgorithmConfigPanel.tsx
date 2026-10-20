import React, { useState, useCallback } from 'react'
import { Settings, SlidersHorizontal, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

// ─── 类型定义 ───

export type AlgorithmStrategy = 'ga' | 'nsga2' | 'hybrid' | 'auto'
export type PresetMode = 'balanced' | 'cost_first' | 'efficacy_first' | 'safety_first' | 'synergy_focused' | null

export interface AlgorithmConfig {
  strategy: AlgorithmStrategy
  preset: PresetMode
  populationSize: number
  generations: number
  mutationRate: number
  crossoverRate: number
  eliteRatio: number
  tournamentSize: number
  // 口感偏好
  tastePreference: 'balanced' | 'sweet_enhanced' | 'bitter_reduced' | 'custom'
  customTasteRatios?: Record<string, number>
}

export interface AlgorithmConfigPanelProps {
  config: AlgorithmConfig
  onChange: (config: AlgorithmConfig) => void
  onApplyPreset: (preset: PresetMode) => void
  onGenerate?: (config: AlgorithmConfig) => void
  isGenerating?: boolean
  className?: string
}

// ─── 常量定义 ───

const STRATEGY_LABELS: Record<AlgorithmStrategy, string> = {
  auto: '智能选择',
  ga: '遗传算法(GA)',
  nsga2: 'NSGA-II多目标',
  hybrid: '混合优化',
}

const PRESET_OPTIONS = [
  { value: 'balanced' as PresetMode, label: '均衡型', desc: '各维度均衡考量' },
  { value: 'cost_first' as PresetMode, label: '成本优先', desc: '严格控制预算' },
  { value: 'efficacy_first' as PresetMode, label: '功效优先', desc: '最大化功效输出' },
  { value: 'safety_first' as PresetMode, label: '安全优先', desc: '适用于敏感人群' },
  { value: 'synergy_focused' as PresetMode, label: '协同优化', desc: '强化配伍协同效应' },
]

const TASTE_PREFERENCES = [
  { value: 'balanced' as const, label: '均衡五味' },
  { value: 'sweet_enhanced' as const, label: '甘甜为主' },
  { value: 'bitter_reduced' as const, label: '降低苦味' },
  { value: 'custom' as const, label: '自定义' },
]

const DEFAULT_CONFIG: AlgorithmConfig = {
  strategy: 'auto',
  preset: 'balanced',
  populationSize: 50,
  generations: 40,
  mutationRate: 0.15,
  crossoverRate: 0.85,
  eliteRatio: 0.15,
  tournamentSize: 5,
  tastePreference: 'balanced',
}

// ─── 子组件 ───

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-primary">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-primary" aria-label="滑块" />
    </div>
  )
}

function StrategySelector({
  value,
  onChange,
}: {
  value: AlgorithmStrategy
  onChange: (v: AlgorithmStrategy) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {(Object.keys(STRATEGY_LABELS) as AlgorithmStrategy[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'px-3 py-2 rounded-lg text-xs font-medium transition-all',
            value === s
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {STRATEGY_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

function PresetSelector({
  value,
  onChange,
}: {
  value: PresetMode
  onChange: (v: PresetMode) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {PRESET_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-2 rounded-lg text-left transition-all',
            value === opt.value
              ? 'bg-primary/10 border-2 border-primary'
              : 'bg-muted border-2 border-transparent hover:border-muted-foreground/30',
          )}
        >
          <div className={cn(
            'text-xs font-medium',
            value === opt.value ? 'text-primary' : 'text-foreground',
          )}>
            {opt.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
        </button>
      ))}
    </div>
  )
}

// ─── 主组件 ───

export function AlgorithmConfigPanel({
  config = DEFAULT_CONFIG,
  onChange,
  onApplyPreset,
  onGenerate,
  isGenerating,
  className,
}: AlgorithmConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateConfig = useCallback(
    (updates: Partial<AlgorithmConfig>) => {
      const next = { ...config, ...updates }
      onChange(next)
      if (updates.preset) {
        onApplyPreset?.(updates.preset)
      }
    },
    [config, onChange, onApplyPreset],
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">算法配置</h3>
            <p className="text-xs text-muted-foreground">调整优化参数以定制配方生成</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
          {isExpanded ? '收起' : '高级'}
        </Button>
      </div>

      {/* 策略选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">生成策略</label>
        <StrategySelector
          value={config.strategy}
          onChange={(v) => updateConfig({ strategy: v, preset: null })}
        />
      </div>

      {/* 预设场景 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">优化场景</label>
        <PresetSelector
          value={config.preset}
          onChange={(v) => updateConfig({ preset: v })}
        />
      </div>

      {/* 口感偏好 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">口感偏好</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TASTE_PREFERENCES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateConfig({ tastePreference: opt.value })}
              className={cn(
                'px-3 py-2 rounded-lg text-xs transition-all',
                config.tastePreference === opt.value
                  ? 'bg-primary/10 border-2 border-primary text-primary'
                  : 'bg-muted border-2 border-transparent hover:border-muted-foreground/30',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 高级参数 */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            <span>进化参数</span>
          </div>

          <SliderField
            label="种群大小"
            value={config.populationSize}
            min={20}
            max={200}
            step={10}
            onChange={(v) => updateConfig({ populationSize: v })}
          />

          <SliderField
            label="进化代数"
            value={config.generations}
            min={10}
            max={100}
            step={5}
            onChange={(v) => updateConfig({ generations: v })}
          />

          <SliderField
            label="变异率"
            value={config.mutationRate}
            min={0.01}
            max={0.5}
            step={0.01}
            onChange={(v) => updateConfig({ mutationRate: v })}
            unit=""
          />

          <SliderField
            label="交叉率"
            value={config.crossoverRate}
            min={0.1}
            max={1.0}
            step={0.05}
            onChange={(v) => updateConfig({ crossoverRate: v })}
            unit=""
          />

          <SliderField
            label="精英比例"
            value={config.eliteRatio}
            min={0.01}
            max={0.5}
            step={0.01}
            onChange={(v) => updateConfig({ eliteRatio: v })}
            unit=""
          />

          <SliderField
            label="锦标赛规模"
            value={config.tournamentSize}
            min={2}
            max={20}
            step={1}
            onChange={(v) => updateConfig({ tournamentSize: v })}
          />
        </div>
      )}

      {/* 生成按钮 */}
      {onGenerate && (
        <Button
          className="w-full"
          disabled={isGenerating}
          onClick={() => onGenerate(config)}
        >
          {isGenerating ? '生成中...' : '应用配置并生成'}
        </Button>
      )}
    </div>
  )
}

// Re-export types for convenience (already exported at top of file)
// export type { AlgorithmConfig, AlgorithmStrategy, PresetMode }
