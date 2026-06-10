/**
 * 多维度参数调整组件
 * 支持精细化的剂量、口感、安全性等参数配置
 */
import { useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui'
import { Sliders, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'

interface ParameterConfig {
  id: string
  name: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  description: string
}

interface TasteProfile {
  sweetness: number
  bitterness: number
  astringency: number
  umami: number
}

interface SafetyConfig {
  level: number
  excludeRestricted: boolean
  minSafetyScore: number
}

interface CostConfig {
  minCost: number
  maxCost: number
  optimizeCost: boolean
}

interface ParameterAdjustPanelProps {
  onParameterChange?: (params: {
    tasteProfile: TasteProfile
    safety: SafetyConfig
    cost: CostConfig
  }) => void
  expanded?: boolean
  onToggle?: () => void
}

const DEFAULT_TASTE: TasteProfile = {
  sweetness: 0.5,
  bitterness: 0.3,
  astringency: 0.2,
  umami: 0.4,
}

const DEFAULT_SAFETY: SafetyConfig = {
  level: 0.8,
  excludeRestricted: true,
  minSafetyScore: 0.7,
}

const DEFAULT_COST: CostConfig = {
  minCost: 0,
  maxCost: 1000,
  optimizeCost: false,
}

export function ParameterAdjustPanel({
  onParameterChange,
  expanded = false,
  onToggle,
}: ParameterAdjustPanelProps) {
  const { preferences, updatePreferences } = useUserPreferenceStore()

  const [tasteProfile, setTasteProfile] = useState<TasteProfile>({
    sweetness: preferences.tasteProfile?.sweetness ?? DEFAULT_TASTE.sweetness,
    bitterness: preferences.tasteProfile?.bitterness ?? DEFAULT_TASTE.bitterness,
    astringency: preferences.tasteProfile?.astringency ?? DEFAULT_TASTE.astringency,
    umami: preferences.tasteProfile?.umami ?? DEFAULT_TASTE.umami,
  })

  const [safety, setSafety] = useState<SafetyConfig>({
    level: preferences.safetyLevel ?? DEFAULT_SAFETY.level,
    excludeRestricted: true,
    minSafetyScore: 0.7,
  })

  const [cost, setCost] = useState<CostConfig>(DEFAULT_COST)

  const [savedTemplates, setSavedTemplates] = useState<{ name: string; taste: TasteProfile; safety: SafetyConfig }[]>([])

  const handleTasteChange = useCallback((key: keyof TasteProfile, value: number) => {
    const updated = { ...tasteProfile, [key]: value }
    setTasteProfile(updated)
    updatePreferences({ tasteProfile: updated })
    onParameterChange?.({ tasteProfile: updated, safety, cost })
  }, [tasteProfile, safety, cost, onParameterChange, updatePreferences])

  const handleSafetyChange = useCallback((updates: Partial<SafetyConfig>) => {
    const updated = { ...safety, ...updates }
    setSafety(updated)
    updatePreferences({ safetyLevel: updated.level })
    onParameterChange?.({ tasteProfile, safety: updated, cost })
  }, [tasteProfile, safety, cost, onParameterChange, updatePreferences])

  const handleCostChange = useCallback((updates: Partial<CostConfig>) => {
    const updated = { ...cost, ...updates }
    setCost(updated)
    onParameterChange?.({ tasteProfile, safety, cost: updated })
  }, [tasteProfile, safety, cost, onParameterChange])

  const handleReset = useCallback(() => {
    setTasteProfile(DEFAULT_TASTE)
    setSafety(DEFAULT_SAFETY)
    setCost(DEFAULT_COST)
    updatePreferences({
      tasteProfile: DEFAULT_TASTE,
      safetyLevel: DEFAULT_SAFETY.level,
    })
    onParameterChange?.({ tasteProfile: DEFAULT_TASTE, safety: DEFAULT_SAFETY, cost: DEFAULT_COST })
  }, [onParameterChange, updatePreferences])

  const handleSaveTemplate = useCallback(() => {
    const name = `模板 ${savedTemplates.length + 1}`
    setSavedTemplates((prev) => [...prev, { name, taste: tasteProfile, safety }])
  }, [tasteProfile, safety, savedTemplates.length])

  const handleLoadTemplate = useCallback((template: { name: string; taste: TasteProfile; safety: SafetyConfig }) => {
    setTasteProfile(template.taste)
    setSafety(template.safety)
    updatePreferences({ tasteProfile: template.taste, safetyLevel: template.safety.level })
    onParameterChange?.({ tasteProfile: template.taste, safety: template.safety, cost })
  }, [cost, onParameterChange, updatePreferences])

  const tasteScore = useMemo(() => {
    const total = tasteProfile.sweetness + tasteProfile.bitterness + tasteProfile.astringency + tasteProfile.umami
    return total > 0 ? (tasteProfile.sweetness - tasteProfile.bitterness + 0.5) / 1.5 : 0.5
  }, [tasteProfile])

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:from-purple-100 dark:hover:from-purple-900/30 hover:to-pink-100 dark:hover:to-pink-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-medium text-purple-700 dark:text-purple-300">多维度参数调整</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-6 animate-fade-in">
          {/* 口感偏好 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">口感偏好</h4>
            <div className="grid grid-cols-2 gap-4">
              <TasteSlider
                label="甜度"
                value={tasteProfile.sweetness}
                onChange={(v) => handleTasteChange('sweetness', v)}
                color="emerald"
              />
              <TasteSlider
                label="苦度"
                value={tasteProfile.bitterness}
                onChange={(v) => handleTasteChange('bitterness', v)}
                color="amber"
              />
              <TasteSlider
                label="涩度"
                value={tasteProfile.astringency}
                onChange={(v) => handleTasteChange('astringency', v)}
                color="orange"
              />
              <TasteSlider
                label="鲜度"
                value={tasteProfile.umami}
                onChange={(v) => handleTasteChange('umami', v)}
                color="blue"
              />
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">综合口感评分</span>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {tasteScore.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${tasteScore * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 安全性偏好 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">安全性偏好</h4>
            <div className="space-y-3">
              <SafetySlider
                label="安全等级"
                value={safety.level}
                onChange={(v) => handleSafetyChange({ level: v })}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safety.excludeRestricted}
                  onChange={(e) => handleSafetyChange({ excludeRestricted: e.target.checked })}
                  className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                <span>排除受限制成分</span>
              </label>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>最低安全评分：</span>
                <span className="font-medium">{safety.minSafetyScore.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* 成本控制 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">成本控制</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={cost.minCost}
                  onChange={(e) => handleCostChange({ minCost: parseFloat(e.target.value) || 0 })}
                  placeholder="最低"
                  className="w-24 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  value={cost.maxCost}
                  onChange={(e) => handleCostChange({ maxCost: parseFloat(e.target.value) || 1000 })}
                  placeholder="最高"
                  className="w-24 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <span className="text-gray-500 text-sm">元/kg</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cost.optimizeCost}
                  onChange={(e) => handleCostChange({ optimizeCost: e.target.checked })}
                  className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span>优化成本（保持功效下降低成本）</span>
              </label>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置
            </button>
            <button
              onClick={handleSaveTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              保存模板
            </button>
            {savedTemplates.length > 0 && (
              <select
                onChange={(e) => {
                  const template = savedTemplates[parseInt(e.target.value)]
                  if (template) handleLoadTemplate(template)
                }}
                className="ml-auto px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="">加载模板...</option>
                {savedTemplates.map((t, i) => (
                  <option key={i} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

interface TasteSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  color: 'emerald' | 'amber' | 'orange' | 'blue'
}

function TasteSlider({ label, value, onChange, color }: TasteSliderProps) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
        style={{
          background: `linear-gradient(to right, ${colorClasses[color]} 0%, ${colorClasses[color]} ${value * 100}%, #d1d5db ${value * 100}%, #d1d5db 100%)`,
        }}
      />
    </div>
  )
}

interface SafetySliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

function SafetySlider({ label, value, onChange }: SafetySliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {value < 0.4 ? '低' : value < 0.7 ? '中' : '高'}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-red-500"
        style={{
          background: `linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #22c55e ${value * 100}%, #d1d5db ${value * 100}%, #d1d5db 100%)`,
        }}
      />
    </div>
  )
}
