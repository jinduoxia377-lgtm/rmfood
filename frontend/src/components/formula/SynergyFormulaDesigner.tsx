/**
 * 协同配方深度设计器 - 双模式架构主组件
 *
 * 功能:
 * - GuidedModeProvider: 普通用户向导模式
 * - ExpertModeProvider: 专家模式
 * - 协同效应可视化展示
 * - 配比精细调整与实时预览
 * - 效果预测图表集成
 */

import React, { useState, useCallback } from 'react'
import {
  FlaskConical, Brain, ShieldCheck, Activity, TrendingUp,
  ChevronRight, ChevronLeft, Sparkles, Settings2, User,
  Lightbulb, BarChart3, PieChart as PieChartIcon, ScatterChart,
  CheckCircle2, Info, Zap,
  RotateCcw, Download, Eye, EyeOff,
} from 'lucide-react'
import { Card, Button, Input, Slider, Badge, Alert } from '@/components/ui'
import { logger } from '@/utils/safeLogger'
import type {
  DeepGenerationResponse,
} from '@/types/formula'

// ==================== 类型定义 ====================

type UserMode = 'guided' | 'expert'

interface FormulaIngredient {
  name: string
  amount_mg: number
  percentage: number
  min_ratio?: number
  max_ratio?: number
  cost_per_gram?: number
  category?: string
}

interface DesignStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

interface OptimizationObjective {
  efficacy: number    // 0-1
  safety: number      // 0-1
  stability: number   // 0-1
  cost: number        // 0-1 (cost priority, inverted)
}

// ==================== 常量配置 ====================

const GUIDED_STEPS: DesignStep[] = [
  {
    id: 'efficacy',
    title: '选择功效目标',
    description: '您希望配方主要实现什么功效？',
    icon: <Zap className="w-6 h-6" />,
  },
  {
    id: 'ingredients',
    title: '成分推荐',
    description: '基于您的需求，我们为您推荐以下成分组合',
    icon: <FlaskConical className="w-6 h-6" />,
  },
  {
    id: 'adjustment',
    title: '偏好调整',
    description: '您可以微调各成分的比例以满足个性化需求',
    icon: <Settings2 className="w-6 h-6" />,
  },
  {
    id: 'result',
    title: '结果展示',
    description: '查看优化后的配比方案及详细分析报告',
    icon: <BarChart3 className="w-6 h-6" />,
  },
]

const EFFICACY_OPTIONS = [
  { id: 'immune', label: '免疫调节', icon: <ShieldCheck className="w-5 h-5" /> },
  { id: 'antiaging', label: '抗氧化抗衰', icon: <Activity className="w-5 h-5" /> },
  { id: 'energy', label: '能量代谢', icon: <Zap className="w-5 h-5" /> },
  { id: 'cognitive', label: '认知功能', icon: <Brain className="w-5 h-5" /> },
  { id: 'bone', label: '骨骼健康', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'digestive', label: '消化系统', icon: <Lightbulb className="w-5 h-5" /> },
]

const DEFAULT_INGREDIENTS: FormulaIngredient[] = [
  { name: '大豆肽', amount_mg: 500, percentage: 25, min_ratio: 5, max_ratio: 40, cost_per_gram: 0.8, category: 'peptide' },
  { name: '黄芪多糖', amount_mg: 300, percentage: 15, min_ratio: 5, max_ratio: 35, cost_per_gram: 1.2, category: 'polysaccharide' },
  { name: '人参皂苷', amount_mg: 100, percentage: 5, min_ratio: 2, max_ratio: 20, cost_per_gram: 2.5, category: 'saponin' },
  { name: '大豆异黄酮', amount_mg: 80, percentage: 4, min_ratio: 3, max_ratio: 25, cost_per_gram: 1.5, category: 'flavonoid' },
  { name: '维生素C', amount_mg: 200, percentage: 10, min_ratio: 1, max_ratio: 15, cost_per_gram: 0.3, category: 'vitamin' },
]

// ==================== 主组件 ====================

export function SynergyFormulaDesigner() {
  const [userMode, setUserMode] = useState<UserMode>('guided')
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedEfficacy, setSelectedEfficacy] = useState<string[]>([])
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>(DEFAULT_INGREDIENTS)
  const [objectives, setObjectives] = useState<OptimizationObjective>({
    efficacy: 0.75,
    safety: 0.85,
    stability: 0.70,
    cost: 0.65,
  })
  const [loading, setLoading] = useState(false)
  const [generationResult, setGenerationResult] = useState<DeepGenerationResponse | null>(null)
  const [showRawData, setShowRawData] = useState(false)

  // ==================== 核心逻辑 ====================

  const handleGenerateFormula = useCallback(async () => {
    setLoading(true)

    try {
      // 调用后端 API 执行完整管线
      const response = await fetch('/api/v1/formula/deep-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          ingredients: ingredients.map(ing => ({
            name: ing.name,
            amount_mg: ing.amount_mg,
            percentage: ing.percentage,
            min_ratio: ing.min_ratio,
            max_ratio: ing.max_ratio,
            cost_per_gram: ing.cost_per_gram,
          })),
          mode: 'deep_integration',
          target_efficacy: objectives.efficacy,
          safety_priority: objectives.safety > 0.7,
          use_caching: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setGenerationResult(data)

        // 更新优化后的比例
        if (data.optimized_ratios) {
          setIngredients(prev => prev.map(ing => ({
            ...ing,
            percentage: data.optimized_ratios[ing.name] || ing.percentage,
            amount_mg: (data.optimized_ratios[ing.name] || ing.percentage) * 10,
          })))
        }

        if (userMode === 'guided') {
          setCurrentStep(3) // 跳转到结果页
        }
      }
    } catch (error) {
      logger.error('生成失败:', error)
    } finally {
      setLoading(false)
    }
  }, [ingredients, objectives, userMode])

  const handleRatioChange = useCallback((index: number, newPercentage: number) => {
    setIngredients(prev => {
      const updated = [...prev]
      const delta = newPercentage - updated[index].percentage

      // 自动调整其他成分以保持总和=100%
      const others = updated.filter((_, i) => i !== index)
      const totalOthers = others.reduce((sum, ing) => sum + ing.percentage, 0)

      if (totalOthers > 0 && totalOthers + delta >= 0) {
        updated[index].percentage = newPercentage
        updated[index].amount_mg = newPercentage * 10

        others.forEach((ing) => {
          const originalIdx = prev.indexOf(ing)
          if (originalIdx !== index) {
            const scale = (totalOthers - delta) / totalOthers
            updated[originalIdx].percentage = Math.max(0, Math.min(
              (ing.max_ratio || 50) * 100,
              ing.percentage * scale,
            ))
            updated[originalIdx].amount_mg = updated[originalIdx].percentage * 10
          }
        })
      }

      return updated
    })
  }, [])

  const handleEfficacyToggle = useCallback((efficacyId: string) => {
    setSelectedEfficacy(prev =>
      prev.includes(efficacyId)
        ? prev.filter(id => id !== efficacyId)
        : [...prev, efficacyId],
    )
  }, [])

  // ==================== 渲染辅助函数 ====================

  const renderModeSwitcher = () => (
    <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-900 rounded-xl border border-secondary-200 dark:border-neutral-700">
      <div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          协同配方设计器
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          基于多目标优化的智能配方生成系统
        </p>
      </div>

      <div className="flex bg-white dark:bg-neutral-800 rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setUserMode('guided')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
            userMode === 'guided'
              ? 'bg-primary-container text-primary-main shadow-md'
              : 'text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">引导模式</span>
        </button>
        <button
          onClick={() => setUserMode('expert')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
            userMode === 'expert'
              ? 'bg-primary-container text-primary-main shadow-md'
              : 'text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span className="text-sm font-medium">专家模式</span>
        </button>
      </div>
    </div>
  )

  // ==================== 引导模式渲染 ====================

  const renderGuidedMode = () => {
    const step = GUIDED_STEPS[currentStep]

    return (
      <div className="space-y-6">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-between mb-8">
          {GUIDED_STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className={`flex flex-col items-center gap-2 transition-all ${
                  idx <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  idx < currentStep
                    ? 'bg-success-500 text-white'
                    : idx === currentStep
                    ? 'bg-primary-container text-primary-main ring-4 ring-primary-200 dark:ring-primary-900'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                }`}>
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    s.icon
                  )}
                </div>
                <span className={`text-xs font-medium text-center max-w-[80px] ${
                  idx === currentStep ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-600 dark:text-neutral-400'
                }`}>
                  {s.title}
                </span>
              </button>
              {idx < GUIDED_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded ${
                  idx < currentStep ? 'bg-success-500' : 'bg-neutral-200 dark:bg-neutral-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 步骤内容 */}
        <Card className="p-8 min-h-[400px]">
          <div className="space-y-6">
            <div>
              <h2 className="h2 text-neutral-900 dark:text-white flex items-center gap-3">
                {step.icon}
                {step.title}
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mt-2">{step.description}</p>
            </div>

            {/* 步骤 1: 功效选择 */}
            {currentStep === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                {EFFICACY_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleEfficacyToggle(option.id)}
                    className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                      selectedEfficacy.includes(option.id)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 shadow-md'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 text-primary-700 dark:text-primary-700 mb-2">
                      {option.icon}
                      <span className="font-medium">{option.label}</span>
                    </div>
                    {selectedEfficacy.includes(option.id) && (
                      <Badge variant="success" className="mt-2">已选择</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* 步骤 2: 成分推荐 */}
            {currentStep === 1 && (
              <div className="space-y-4 mt-6">
                <Alert variant="info">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    <span>基于您选择的功效目标，系统为您推荐以下成分组合：</span>
                  </div>
                </Alert>

                <div className="grid gap-3">
                  {ingredients.map((ing) => (
                    <div
                      key={ing.name}
                      className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FlaskConical className="w-5 h-5 text-primary-500" />
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-white">{ing.name}</p>
                          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ing.category} • ¥{ing.cost_per_gram}/g</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-lg text-primary-700">
                          {ing.percentage.toFixed(1)}%
                        </p>
                        <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ing.amount_mg}mg</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 步骤 3: 偏好调整 */}
            {currentStep === 2 && (
              <div className="space-y-6 mt-6">
                {/* 目标权重滑块 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-neutral-900 dark:text-white">优化目标优先级</h3>

                  {[
                    { key: 'efficacy' as const, label: '功效强度', color: 'blue' },
                    { key: 'safety' as const, label: '安全性', color: 'green' },
                    { key: 'stability' as const, label: '稳定性', color: 'purple' },
                    { key: 'cost' as const, label: '经济性', color: 'orange' },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
                        <span className="font-mono text-primary-700 font-bold">
                          {(objectives[key] * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={objectives[key] * 100}
                        onChange={(val: number) => setObjectives(prev => ({ ...prev, [key]: val / 100 }))}
                        min={0}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>

                {/* 成分比例微调 */}
                <div className="mt-8 space-y-4">
                  <h3 className="font-semibold text-neutral-900 dark:text-white">成分比例调整</h3>

                  {ingredients.map((ing: FormulaIngredient, idx: number) => (
                    <div key={ing.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{ing.name}</span>
                        <span className="font-mono font-bold text-primary-700">
                          {ing.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Slider
                        value={ing.percentage}
                        onChange={(val: number) => handleRatioChange(idx, val)}
                        min={(ing.min_ratio || 0) * 100}
                        max={(ing.max_ratio || 50) * 100}
                        step={0.5}
                        className="w-full"
                      />
                    </div>
                  ))}

                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="flex justify-between font-semibold">
                      <span>总计</span>
                      <span className={`${
                        Math.abs(ingredients.reduce((sum, ing) => sum + ing.percentage, 0) - 100) < 1
                          ? 'text-success-600'
                          : 'text-error-600'
                      }`}>
                        {ingredients.reduce((sum, ing) => sum + ing.percentage, 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 步骤 4: 结果展示 */}
            {currentStep === 3 && generationResult && (
              <div className="space-y-6 mt-6">
                {/* 总体评分卡片 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: '协同指数', value: generationResult.synergy_summary?.overall_si ?? 0, icon: <Brain />, color: 'blue' },
                    { label: '方案数', value: generationResult.optimization_summary?.solution_count ?? 0, icon: <BarChart3 />, color: 'green' },
                    { label: '兼容性', value: generationResult.compatibility_summary?.score ?? 0, icon: <ShieldCheck />, color: 'purple' },
                    { label: '安全性', value: generationResult.safety_check_summary?.is_safe ? 100 : 0, icon: <Activity />, color: 'orange' },
                  ].map(({ label, value, icon, color }) => (
                    <Card key={label} className="p-4 text-center">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-${color}-100 dark:bg-${color}-900 text-${color}-600 dark:text-${color}-400 mb-2`}>
                        {icon}
                      </div>
                      <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {typeof value === 'number' ? (value * 100).toFixed(0) : value}
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{label}</p>
                    </Card>
                  ))}
                </div>

                {/* 推荐列表 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-neutral-900 dark:text-white">💡 系统建议</h3>
                  {generationResult.recommendations.slice(0, 5).map((rec: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <ChevronRight className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 导航按钮 */}
          <div className="flex justify-between mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              上一步
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={() => {
                  if (currentStep === 2) {
                    handleGenerateFormula()
                  } else {
                    setCurrentStep(currentStep + 1)
                  }
                }}
                disabled={loading || (currentStep === 0 && selectedEfficacy.length === 0)}
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    下一步
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleGenerateFormula} disabled={loading}>
                <Sparkles className="w-4 h-4 mr-2" />
                重新优化
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // ==================== 专家模式渲染 ====================

  const renderExpertMode = () => (
    <div className="space-y-6">
      {/* 参数控制面板 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary-500" />
          高级参数控制
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：优化参数 */}
          <div className="space-y-4">
            <h4 className="font-medium text-neutral-700 dark:text-neutral-300">NSGA-III 优化器配置</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">种群大小</label>
                <Input type="number" defaultValue={100} min={20} max={200} />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">迭代次数</label>
                <Input type="number" defaultValue={50} min={10} max={100} />
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'efficacy' as const, label: '功效权重', defaultVal: 35 },
                { key: 'safety' as const, label: '安全权重', defaultVal: 30 },
                { key: 'stability' as const, label: '稳定权重', defaultVal: 20 },
                { key: 'cost' as const, label: '成本权重', defaultVal: 15 },
              ].map(({ key, label, defaultVal }) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-mono text-primary-700">{defaultVal}%</span>
                  </div>
                  <Slider value={defaultVal} min={0} max={100} step={5} onChange={() => {}} />
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：约束条件 */}
          <div className="space-y-4">
            <h4 className="font-medium text-neutral-700 dark:text-neutral-300">约束条件设置</h4>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">目标功效值</label>
              <Input type="number" defaultValue={0.75} min={0} max={1} step={0.05} />
            </div>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">安全阈值</label>
              <Input type="number" defaultValue={0.80} min={0} max={1} step={0.05} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="safety-priority" defaultChecked className="rounded" />
              <label htmlFor="safety-priority" className="text-sm text-neutral-700 dark:text-neutral-300">
                安全性优先模式
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="use-cache" defaultChecked className="rounded" />
              <label htmlFor="use-cache" className="text-sm text-neutral-700 dark:text-neutral-300">
                启用结果缓存
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <Button
            onClick={handleGenerateFormula}
            loading={loading}
            className="flex-1"
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            执行优化
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowRawData(!showRawData)}
          >
            {showRawData ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showRawData ? '隐藏原始数据' : '显示原始数据'}
          </Button>
        </div>
      </Card>

      {/* 实时数据表格 */}
      {showRawData && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            原始数据视图
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-neutral-700 dark:text-neutral-300">成分名称</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-700 dark:text-neutral-300">比例 (%)</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-700 dark:text-neutral-300">剂量 (mg)</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-700 dark:text-neutral-300">成本 (¥)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {ingredients.map(ing => (
                  <tr key={ing.name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{ing.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{ing.percentage.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{ing.amount_mg.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ¥{(ing.amount_mg / 1000 * (ing.cost_per_gram || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-100 dark:bg-neutral-900 font-semibold">
                  <td className="px-4 py-3 text-neutral-900 dark:text-white">合计</td>
                  <td className="px-4 py-3 text-right font-mono text-primary-700">
                    {ingredients.reduce((sum, ing) => sum + ing.percentage, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {ingredients.reduce((sum, ing) => sum + ing.amount_mg, 0).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ¥{ingredients.reduce((sum, ing) => sum + (ing.amount_mg / 1000 * (ing.cost_per_gram || 0)), 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 结果可视化区域 */}
      {generationResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pareto 前沿散点图占位 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <ScatterChart className="w-5 h-5 text-primary-500" />
              Pareto 最优前沿
            </h3>
            <div className="h-64 bg-gradient-to-br from-secondary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-900 rounded-lg flex items-center justify-center">
              <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">📊 Pareto 散点图 (待集成 ECharts)</p>
            </div>
          </Card>

          {/* 协同机制饼图占位 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary-500" />
              协同机制分布
            </h3>
            <div className="h-64 bg-gradient-to-br from-success-50 to-success-50 dark:from-neutral-800 dark:to-neutral-900 rounded-lg flex items-center justify-center">
              <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">🥧 机制贡献饼图 (待集成 ECharts)</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )

  // ==================== 主渲染 ====================

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {renderModeSwitcher()}

      {userMode === 'guided' ? renderGuidedMode() : renderExpertMode()}

      {/* 性能指标 */}
      {generationResult && (
        <div className="flex items-center justify-between p-4 bg-success-50 dark:bg-success-950 rounded-lg border border-success-200 dark:border-success-900">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
            <span className="text-sm font-medium text-success-800 dark:text-success-200">
              优化完成 · 耗时 {(generationResult.generation_time_ms / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={generationResult.cache_hit ? 'info' : 'success'}>
              {generationResult.cache_hit ? '缓存命中' : '新生成'}
            </Badge>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              导出报告
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SynergyFormulaDesigner
