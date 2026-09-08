/**
 * 模型选择与参数调节组件
 * 与 AI 主页面设计风格同步（AIAssistantPage 规范）
 */
import { useState } from 'react'
import { Card } from '@/components/ui'
import { Select, Slider } from '@/components/ui'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'
import type { ModelType } from '@/api/modelClient'

interface ModelSelectorProps {
  modelType: ModelType
  onModelChange: (modelType: ModelType) => void
  onParamsChange: (params: Record<string, any>) => void
  className?: string
}

interface ModelOption {
  value: ModelType
  label: string
  description: string
  icon: React.ReactNode
}

export function ModelSelector({ modelType, onModelChange, onParamsChange, className }: ModelSelectorProps) {
  const [showParams, setShowParams] = useState(false)
  const [params, setParams] = useState({
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  })

  const modelOptions: ModelOption[] = [
    { value: 'formula_gpt',   label: 'FormulaGPT',  description: '配方生成模型', icon: <Brain className="w-4 h-4" /> },
    { value: 'synergy_net',   label: 'SynergyNet',  description: '协同分析模型', icon: <Brain className="w-4 h-4" /> },
    { value: 'safety_checker',label: 'SafetyChecker',description: '安全检查模型', icon: <Brain className="w-4 h-4" /> },
    { value: 'taste_predictor',label: 'TastePredictor',description: '口感预测模型', icon: <Brain className="w-4 h-4" /> },
    { value: 'stability_model',label: 'StabilityModel',description: '稳定性预测模型', icon: <Brain className="w-4 h-4" /> },
  ]

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value }
    setParams(newParams)
    onParamsChange(newParams)
  }

  return (
    // Card default: p-5 (20px), rounded-xl, shadow-sm — matches parent page
    <Card className={`shadow-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* icon: rounded-xl w-10 h-10 — matches SectionHeader icon pattern */}
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            {/* text-sm font-semibold — matches StatCard label pattern (was font-medium=500) */}
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">模型选择</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">选择和配置 AI 模型</p>
          </div>
        </div>
        <button
          onClick={() => setShowParams(!showParams)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
        >
          {showParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showParams ? '收起参数' : '调节参数'}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">模型类型</label>
          <Select value={modelType} onChange={(v) => onModelChange(v as ModelType)}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </Select>
        </div>

        {showParams && (
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            {[
              { key: 'temperature', label: '温度 (Temperature)', min: 0, max: 1, step: 0.01, display: 'toFixed(2)', low: '0.0 (确定)', high: '1.0 (随机)' },
              { key: 'maxTokens',   label: '最大 Tokens',       min: 100, max: 4000, step: 100, display: '', low: '100', high: '4000' },
              { key: 'topP',        label: 'Top P',              min: 0.1, max: 1, step: 0.01, display: 'toFixed(2)', low: '0.1', high: '1.0' },
            ].map(({ key, label, min, max, step, display, low, high }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {display === 'toFixed(2)' ? params[key as keyof typeof params]?.toFixed?.(2) : params[key as keyof typeof params]}
                  </span>
                </div>
                <Slider
                  value={params[key as keyof typeof params] as number}
                  min={min} max={max} step={step}
                  onChange={(value) => handleParamChange(key, value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
                  <span>{low}</span><span>{high}</span>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'frequencyPenalty', label: '频率惩罚', min: -2, max: 2, step: 0.1 },
                { key: 'presencePenalty', label: '存在惩罚', min: -2, max: 2, step: 0.1 },
              ].map(({ key, label, min, max, step }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {params[key as keyof typeof params]?.toFixed?.(2)}
                    </span>
                  </div>
                  <Slider
                    value={params[key as keyof typeof params] as number}
                    min={min} max={max} step={step}
                    onChange={(value) => handleParamChange(key, value)}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ModelSelector
