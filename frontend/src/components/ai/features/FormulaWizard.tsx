import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Settings,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  FolderOpen,
  Trash2,
  RotateCcw,
  Droplets,
  Thermometer,
  Gauge,
  Shield,
  AlertTriangle,
  DollarSign,
  Leaf,
  Award,
  Globe,
  Ban,
  Sparkles,
  Eye,
} from 'lucide-react'

export interface EfficacyType {
  id: string
  label: string
  category: string
  icon?: React.ReactNode
}

export interface ConstraintConfig {
  phRange: [number, number]
  temperature: 'room' | 'heated' | 'refrigerated'
  viscosity: 'watery' | 'lotion' | 'cream' | 'solid'
  irritationLevel: 'none' | 'low' | 'acceptable'
  excludedAllergens: string[]
  maxCostPerKg: number | null
}

export interface AdvancedOptions {
  sourcePreference: ('natural' | 'synthetic' | 'fermented' | 'plant_extract')[]
  certifications: ('organic' | 'gmp' | 'iso' | 'halal' | 'kosher')[]
  targetMarket: ('china' | 'eu' | 'usa' | 'japan' | 'global')[]
  specialRestrictions: ('no_preservative' | 'no_fragrance' | 'no_colorant')[]
}

export interface WizardConfig {
  efficacies: { id: string; weight: number }[]
  constraints: ConstraintConfig
  advanced: AdvancedOptions
}

export interface PresetData {
  id: string
  name: string
  description: string
  config: WizardConfig
  createdAt: number
  updatedAt: number
}

interface FormulaWizardProps {
  onComplete: (config: WizardConfig) => void
  onCancel?: () => void
  initialConfig?: Partial<WizardConfig>
  className?: string
}

const EFFICACY_TYPES: EfficacyType[] = [
  { id: 'moisturizing', label: '保湿', category: '基础护肤', icon: <Droplets className="w-4 h-4" /> },
  { id: 'antioxidant', label: '抗氧化', category: '抗衰老', icon: <Shield className="w-4 h-4" /> },
  { id: 'whitening', label: '美白', category: '美白祛斑', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'anti_inflammatory', label: '抗炎', category: '舒缓修护', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'repair', label: '修复', category: '屏障修护', icon: <Shield className="w-4 h-4" /> },
  { id: 'anti_aging', label: '抗皱', category: '抗衰老', icon: <Gauge className="w-4 h-4" /> },
  { id: 'oil_control', label: '控油', category: '毛孔护理', icon: <Droplets className="w-4 h-4" /> },
  { id: 'acne_treatment', label: '祛痘', category: '痘痘护理', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'sun_protection', label: '防晒', category: '光防护', icon: <Shield className="w-4 h-4" /> },
  { id: 'firming', label: '紧致', category: '抗衰老', icon: <Gauge className="w-4 h-4" /> },
  { id: 'brightening', label: '提亮', category: '美白祛斑', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'soothing', label: '舒缓', category: '敏感肌', icon: <Leaf className="w-4 h-4" /> },
]

const PRESET_CONFIGS: { id: string; name: string; description: string; config: Partial<WizardConfig> }[] = [
  {
    id: 'strong_moisture',
    name: '强效保湿',
    description: '高权重保湿 + 抗炎 + 修复',
    config: {
      efficacies: [
        { id: 'moisturizing', weight: 80 },
        { id: 'repair', weight: 60 },
        { id: 'soothing', weight: 50 },
      ],
    },
  },
  {
    id: 'balanced',
    name: '均衡配方',
    description: '多功效均衡分配，适合日常使用',
    config: {
      efficacies: [
        { id: 'moisturizing', weight: 50 },
        { id: 'antioxidant', weight: 45 },
        { id: 'whitening', weight: 40 },
        { id: 'anti_aging', weight: 35 },
      ],
    },
  },
  {
    id: 'cost_priority',
    name: '成本优先',
    description: '低成本 + 基础功效配方',
    config: {
      efficacies: [
        { id: 'moisturizing', weight: 60 },
        { id: 'soothing', weight: 40 },
      ],
      constraints: {
        maxCostPerKg: 100,
      } as ConstraintConfig,
    },
  },
]

const ALLERGEN_OPTIONS = [
  { id: 'nuts', label: '坚果类' },
  { id: 'dairy', label: '乳制品' },
  { id: 'gluten', label: '麸质' },
  { id: 'soy', label: '大豆' },
  { id: 'seafood', label: '海鲜' },
  { id: 'eggs', label: '蛋类' },
]

const STORAGE_KEY = 'formula_wizard_presets'

function loadPresets(): PresetData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function savePresets(presets: PresetData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch (e) {
    console.warn('Failed to save presets:', e)
  }
}

export function FormulaWizard({ onComplete, onCancel, initialConfig, className = '' }: FormulaWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [efficacies, setEfficacies] = useState<{ id: string; weight: number }[]>(
    initialConfig?.efficacies || [],
  )
  const [constraints, setConstraints] = useState<ConstraintConfig>(
    initialConfig?.constraints || {
      phRange: [5.5, 7.0],
      temperature: 'room',
      viscosity: 'lotion',
      irritationLevel: 'low',
      excludedAllergens: [],
      maxCostPerKg: null,
    },
  )
  const [advanced, setAdvanced] = useState<AdvancedOptions>(
    initialConfig?.advanced || {
      sourcePreference: [],
      certifications: [],
      targetMarket: [],
      specialRestrictions: [],
    },
  )
  const [presets, setPresets] = useState<PresetData[]>(loadPresets)
  const [showPresetManager, setShowPresetManager] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  const steps = [
    { title: '目标功效', icon: <Target className="w-5 h-5" />, description: '选择主要功效类型和权重' },
    { title: '约束条件', icon: <Settings className="w-5 h-5" />, description: '配置物理化学约束' },
    { title: '高级选项', icon: <Sliders className="w-5 h-5" />, description: '原料来源与认证要求' },
  ]

  const toggleEfficacy = useCallback((efficacyId: string) => {
    setEfficacies(prev => {
      const exists = prev.find(e => e.id === efficacyId)
      if (exists) {
        return prev.filter(e => e.id !== efficacyId)
      }
      return [...prev, { id: efficacyId, weight: 50 }]
    })
  }, [])

  const updateEfficacyWeight = useCallback((efficacyId: string, weight: number) => {
    setEfficacies(prev =>
      prev.map(e => (e.id === efficacyId ? { ...e, weight: Math.max(0, Math.min(100, weight)) } : e)),
    )
  }, [])

  const applyPreset = useCallback((presetId: string) => {
    const preset = [...PRESET_CONFIGS, ...presets].find(p => p.id === presetId)
    if (!preset?.config) return

    if (preset.config.efficacies) {
      setEfficacies(preset.config.efficacies)
    }
    if (preset.config.constraints) {
      setConstraints(prev => ({ ...prev, ...preset.config.constraints }))
    }
    if (preset.config.advanced) {
      setAdvanced(prev => ({ ...prev, ...preset.config.advanced }))
    }
  }, [presets])

  const saveCurrentAsPreset = useCallback((name: string) => {
    const newPreset: PresetData = {
      id: `custom_${Date.now()}`,
      name,
      description: `自定义预设 - ${new Date().toLocaleDateString('zh-CN')}`,
      config: { efficacies, constraints, advanced },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setPresets(prev => {
      const updated = [...prev, newPreset]
      savePresets(updated)
      return updated
    })
  }, [efficacies, constraints, advanced])

  const deletePreset = useCallback((presetId: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.id !== presetId)
      savePresets(updated)
      return updated
    })
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete({ efficacies, constraints, advanced })
    }
  }, [currentStep, steps.length, onComplete, efficacies, constraints, advanced])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleSkip = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete({ efficacies, constraints, advanced })
    }
  }, [currentStep, steps.length, onComplete, efficacies, constraints, advanced])

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0:
        return efficacies.length > 0
      case 1:
      case 2:
        return true
      default:
        return false
    }
  }, [currentStep, efficacies.length])

  const totalWeight = useMemo(() => efficacies.reduce((sum, e) => sum + e.weight, 0), [efficacies])

  const previewData = useMemo(
    () => ({
      selectedEfficacies: efficacies.map(e => {
        const type = EFFICACY_TYPES.find(t => t.id === e.id)
        return { ...type, weight: e.weight }
      }),
      constraints,
      advanced,
      totalWeight,
    }),
    [efficacies, constraints, advanced, totalWeight],
  )

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* 步骤指示器 */}
      <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, index) => (
            <React.Fragment key={step.title}>
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{
                    backgroundColor: index <= currentStep ? 'rgb(16, 185, 129)' : 'rgb(229, 231, 235)',
                    scale: index === currentStep ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md ${
                    index <= currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
                </motion.div>
                <span
                  className={`text-xs font-medium ${
                    index === currentStep ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <motion.div
                  animate={{ backgroundColor: index < currentStep ? 'rgb(16, 185, 129)' : 'rgb(229, 231, 235)' }}
                  className="flex-1 h-0.5 mx-3 rounded"
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex min-h-[520px]">
        {/* 左侧：表单区域 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Step 1: 目标功效选择 */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      选择目标功效
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      选择一个或多个功效类型，并调整各功效的权重（总和可超过100%）
                    </p>
                  </div>

                  {/* 快捷预设 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">快捷预设</label>
                    <div className="flex flex-wrap gap-2">
                      {[...PRESET_CONFIGS, ...presets].map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset.id)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                        >
                          {preset.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowPresetManager(!showPresetManager)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <FolderOpen className="w-3 h-3 inline mr-1" />
                        管理预设
                      </button>
                    </div>
                  </div>

                  {/* 预设管理面板 */}
                  <AnimatePresence>
                    {showPresetManager && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <PresetManager
                          presets={presets}
                          onSave={saveCurrentAsPreset}
                          onDelete={deletePreset}
                          onClose={() => setShowPresetManager(false)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 功效选择网格 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {EFFICACY_TYPES.map(type => {
                      const selected = efficacies.find(e => e.id === type.id)
                      return (
                        <motion.button
                          key={type.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleEfficacy(type.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={selected ? 'text-emerald-600' : 'text-gray-500'}>{type.icon}</span>
                            <span className={`text-sm font-medium ${selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {type.label}
                            </span>
                          </div>
                          {selected && (
                            <div className="space-y-1">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={selected.weight}
                                onChange={(e) => updateEfficacyWeight(type.id, Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                              <span className="text-xs text-emerald-600 font-medium">{selected.weight}%</span>
                            </div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* 权重汇总 */}
                  {efficacies.length > 0 && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        已选 {efficacies.length} 种功效，总权重：
                        <span className="font-semibold text-emerald-600">{totalWeight}%</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: 约束条件配置 */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      约束条件配置
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      设置配方的物理化学约束和安全限制
                    </p>
                  </div>

                  {/* pH 范围 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Droplets className="w-4 h-4" />
                      pH 范围: {constraints.phRange[0].toFixed(1)} - {constraints.phRange[1].toFixed(1)}
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="3.5"
                        max="9.0"
                        step="0.1"
                        value={constraints.phRange[0]}
                        onChange={(e) =>
                          setConstraints(prev => ({
                            ...prev,
                            phRange: [Math.min(Number(e.target.value), prev.phRange[1]), prev.phRange[1]],
                          }))
                        }
                        className="flex-1 accent-red-500"
                      />
                      <input
                        type="range"
                        min="3.5"
                        max="9.0"
                        step="0.1"
                        value={constraints.phRange[1]}
                        onChange={(e) =>
                          setConstraints(prev => ({
                            ...prev,
                            phRange: [prev.phRange[0], Math.max(Number(e.target.value), prev.phRange[0])],
                          }))
                        }
                        className="flex-1 accent-green-500"
                      />
                    </div>
                  </div>

                  {/* 温度范围 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      温度要求
                    </label>
                    <div className="flex gap-2">
                      {(['room', 'heated', 'refrigerated'] as const).map(temp => (
                        <button
                          key={temp}
                          onClick={() => setConstraints(prev => ({ ...prev, temperature: temp }))}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            constraints.temperature === temp
                              ? 'bg-emerald-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {{ room: '常温', heated: '加热', refrigerated: '冷藏' }[temp]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 粘度类型 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Gauge className="w-4 h-4" />
                      粘度类型
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['watery', 'lotion', 'cream', 'solid'] as const).map(visc => (
                        <button
                          key={visc}
                          onClick={() => setConstraints(prev => ({ ...prev, viscosity: visc }))}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            constraints.viscosity === visc
                              ? 'bg-emerald-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {{ watery: '水状', lotion: '乳液', cream: '膏体', solid: '固体' }[visc]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 刺激性限制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      刺激性限制
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: 'none', label: '无刺激' },
                        { value: 'low', label: '低刺激' },
                        { value: 'acceptable', label: '可接受' },
                      ] as const).map(level => (
                        <button
                          key={level.value}
                          onClick={() => setConstraints(prev => ({ ...prev, irritationLevel: level.value }))}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            constraints.irritationLevel === level.value
                              ? 'bg-emerald-500 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 过敏原排除 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      排除过敏原
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGEN_OPTIONS.map(allergen => (
                        <button
                          key={allergen.id}
                          onClick={() =>
                            setConstraints(prev => ({
                              ...prev,
                              excludedAllergens: prev.excludedAllergens.includes(allergen.id)
                                ? prev.excludedAllergens.filter(a => a !== allergen.id)
                                : [...prev.excludedAllergens, allergen.id],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            constraints.excludedAllergens.includes(allergen.id)
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300'
                          }`}
                        >
                          {constraints.excludedAllergens.includes(allergen.id) && <Ban className="w-3 h-3 inline mr-1" />}
                          {allergen.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 成本上限 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      成本上限{constraints.maxCostPerKg ? `: ¥${constraints.maxCostPerKg}/kg` : ': 不限'}
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="10"
                        value={constraints.maxCostPerKg || 0}
                        onChange={(e) =>
                          setConstraints(prev => ({
                            ...prev,
                            maxCostPerKg: Number(e.target.value) || null,
                          }))
                        }
                        className="flex-1 accent-yellow-500"
                      />
                      <button
                        onClick={() => setConstraints(prev => ({ ...prev, maxCostPerKg: null }))}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: 高级选项 */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      高级选项
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      配置原料来源偏好、认证要求和特殊工艺限制
                    </p>
                  </div>

                  {/* 原料来源 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Leaf className="w-4 h-4" />
                      原料来源偏好
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'natural', label: '天然' },
                        { value: 'synthetic', label: '合成' },
                        { value: 'fermented', label: '发酵' },
                        { value: 'plant_extract', label: '植物提取' },
                      ].map(source => (
                        <button
                          key={source.value}
                          onClick={() =>
                            setAdvanced(prev => ({
                              ...prev,
                              sourcePreference: prev.sourcePreference.includes(source.value as any)
                                ? prev.sourcePreference.filter(s => s !== source.value)
                                : [...prev.sourcePreference, source.value as any],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            advanced.sourcePreference.includes(source.value as any)
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300'
                          }`}
                        >
                          {advanced.sourcePreference.includes(source.value as any) && <Check className="w-3 h-3 inline mr-1" />}
                          {source.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 认证要求 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      认证要求
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'organic', label: '有机认证' },
                        { value: 'gmp', label: 'GMP' },
                        { value: 'iso', label: 'ISO' },
                        { value: 'halal', label: 'Halal' },
                        { value: 'kosher', label: 'Kosher' },
                      ].map(cert => (
                        <button
                          key={cert.value}
                          onClick={() =>
                            setAdvanced(prev => ({
                              ...prev,
                              certifications: prev.certifications.includes(cert.value as any)
                                ? prev.certifications.filter(c => c !== cert.value)
                                : [...prev.certifications, cert.value as any],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            advanced.certifications.includes(cert.value as any)
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300'
                          }`}
                        >
                          {advanced.certifications.includes(cert.value as any) && <Check className="w-3 h-3 inline mr-1" />}
                          {cert.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 目标市场 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      目标市场
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'china', label: '中国' },
                        { value: 'eu', label: '欧盟' },
                        { value: 'usa', label: '美国' },
                        { value: 'japan', label: '日本' },
                        { value: 'global', label: '全球' },
                      ].map(market => (
                        <button
                          key={market.value}
                          onClick={() =>
                            setAdvanced(prev => ({
                              ...prev,
                              targetMarket: prev.targetMarket.includes(market.value as any)
                                ? prev.targetMarket.filter(m => m !== market.value)
                                : [...prev.targetMarket, market.value as any],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            advanced.targetMarket.includes(market.value as any)
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300'
                          }`}
                        >
                          {advanced.targetMarket.includes(market.value as any) && <Check className="w-3 h-3 inline mr-1" />}
                          {market.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 特殊工艺限制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Ban className="w-4 h-4" />
                      特殊工艺限制
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'no_preservative', label: '无防腐剂' },
                        { value: 'no_fragrance', label: '无香精' },
                        { value: 'no_colorant', label: '无色素' },
                      ].map(restriction => (
                        <button
                          key={restriction.value}
                          onClick={() =>
                            setAdvanced(prev => ({
                              ...prev,
                              specialRestrictions: prev.specialRestrictions.includes(restriction.value as any)
                                ? prev.specialRestrictions.filter(r => r !== restriction.value)
                                : [...prev.specialRestrictions, restriction.value as any],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            advanced.specialRestrictions.includes(restriction.value as any)
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300'
                          }`}
                        >
                          {advanced.specialRestrictions.includes(restriction.value as any) && <Check className="w-3 h-3 inline mr-1" />}
                          {restriction.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 右侧：预览面板 */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  配置预览
                </h4>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <ConfigPreview data={previewData} currentStep={currentStep} />
            </motion.div>
          )}
        </AnimatePresence>

        {!showPreview && (
          <button
            onClick={() => setShowPreview(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-gray-800 shadow-lg rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700 hover:bg-gray-50"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              上一步
            </button>
          )}

          {currentStep < steps.length - 1 && (
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              跳过此步
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            disabled={!canProceed && currentStep < steps.length - 1}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all ${
              canProceed || currentStep === steps.length - 1
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            }`}
          >
            {currentStep === steps.length - 1 ? (
              <>
                <Check className="w-4 h-4" />
                完成配置
              </>
            ) : (
              <>
                下一步
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function ConfigPreview({ data, currentStep }: { data: any; currentStep: number }) {
  return (
    <div className="space-y-4 text-sm">
      {currentStep >= 0 && data.selectedEfficacies?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">目标功效</h5>
          <div className="space-y-1.5">
            {data.selectedEfficacies.slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">{e.label}</span>
                <span className="text-emerald-600 font-medium">{e.weight}%</span>
              </div>
            ))}
            {data.selectedEfficacies.length > 5 && (
              <div className="text-xs text-gray-400">+{data.selectedEfficacies.length - 5} 更多...</div>
            )}
          </div>
        </div>
      )}

      {currentStep >= 1 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">约束条件</h5>
          <div className="space-y-1 text-gray-600 dark:text-gray-400">
            <div>pH: {data.constraints?.phRange?.[0]}-{data.constraints?.phRange?.[1]}</div>
            <div>温度: {{ room: '常温', heated: '加热', refrigerated: '冷藏' }[data.constraints?.temperature]}</div>
            <div>粘度: {{ watery: '水状', lotion: '乳液', cream: '膏体', solid: '固体' }[data.constraints?.viscosity]}</div>
            {data.constraints?.maxCostPerKg && <div>成本上限: ¥{data.constraints.maxCostPerKg}/kg</div>}
          </div>
        </div>
      )}

      {currentStep >= 2 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">高级选项</h5>
          <div className="space-y-1 text-gray-600 dark:text-gray-400">
            {data.advanced?.sourcePreference?.length > 0 && (
              <div>原料: {data.advanced.sourcePreference.join(', ')}</div>
            )}
            {data.advanced?.certifications?.length > 0 && (
              <div>认证: {data.advanced.certifications.join(', ')}</div>
            )}
            {data.advanced?.targetMarket?.length > 0 && (
              <div>市场: {data.advanced.targetMarket.join(', ')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PresetManager({
  presets,
  onSave,
  onDelete,
  onClose,
}: {
  presets: PresetData[]
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [newPresetName, setNewPresetName] = useState('')

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">管理自定义预设</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          ✕
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          placeholder="输入预设名称..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={() => {
            if (newPresetName.trim()) {
              onSave(newPresetName.trim())
              setNewPresetName('')
            }
          }}
          disabled={!newPresetName.trim()}
          className="px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">暂无自定义预设</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {presets.map(preset => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg"
            >
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{preset.name}</div>
                <div className="text-xs text-gray-500">{preset.description}</div>
              </div>
              <button
                onClick={() => onDelete(preset.id)}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FormulaWizard
