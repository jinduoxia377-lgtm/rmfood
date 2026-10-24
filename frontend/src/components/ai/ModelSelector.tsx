/**
 * 模型选择与参数调节组件
 * 与 AI 主页面设计风格同步（AIAssistantPage 规范）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [showParams, setShowParams] = useState(false)
  const [params, setParams] = useState({
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  })

  const modelOptions: ModelOption[] = [
    { value: 'formula_gpt',   label: 'FormulaGPT',  description: t('ai.config.modelFormulaDesc'), icon: <Brain className="w-4 h-4" /> },
    { value: 'synergy_net',   label: 'SynergyNet',  description: t('ai.config.modelSynergyDesc'), icon: <Brain className="w-4 h-4" /> },
    { value: 'safety_checker',label: 'SafetyChecker',description: t('ai.config.modelSafetyDesc'), icon: <Brain className="w-4 h-4" /> },
    { value: 'taste_predictor',label: 'TastePredictor',description: t('ai.config.modelTasteDesc'), icon: <Brain className="w-4 h-4" /> },
    { value: 'stability_model',label: 'StabilityModel',description: t('ai.config.modelStabilityDesc'), icon: <Brain className="w-4 h-4" /> },
  ]

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value }
    setParams(newParams)
    onParamsChange(newParams)
  }

  return (
    // Card default: p-5 (20px), rounded-xl, shadow-sm — matches parent page
    <Card className={`shadow-sm border border-[var(--border-color)] bg-white dark:bg-neutral-900 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* icon: rounded-xl w-10 h-10 — matches SectionHeader icon pattern */}
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary-700 dark:text-primary-700" />
          </div>
          <div>
            {/* text-sm font-semibold — matches StatCard label pattern (was font-semibold=500) */}
            <h3 className="text-sm font-semibold text-[var(--text-primary)] dark:text-white leading-tight">{t('ai.config.modelSelect')}</h3>
            <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">{t('ai.config.modelSelectDesc')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowParams(!showParams)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal text-[var(--text-secondary)] border border-[var(--border-color)] bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
        >
          {showParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showParams ? t('ai.config.collapseParams') : t('ai.config.adjustParams')}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[var(--text-secondary)] block">{t('ai.config.modelType')}</label>
          <Select value={modelType} onChange={(v) => onModelChange(v as ModelType)}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </Select>
        </div>

        {showParams && (
          <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            {[
              { key: 'temperature', label: '温度 (Temperature)', min: 0, max: 1, step: 0.01, display: 'toFixed(2)', low: '0.0 (确定)', high: '1.0 (随机)' },
              { key: 'maxTokens',   label: '最大 Tokens',       min: 100, max: 4000, step: 100, display: '', low: '100', high: '4000' },
              { key: 'topP',        label: 'Top P',              min: 0.1, max: 1, step: 0.01, display: 'toFixed(2)', low: '0.1', high: '1.0' },
            ].map(({ key, label, min, max, step, display, low, high }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[var(--text-secondary)]">{label}</label>
                  <span className="text-xs text-[var(--text-muted)]">
                    {display === 'toFixed(2)' ? params[key as keyof typeof params]?.toFixed?.(2) : params[key as keyof typeof params]}
                  </span>
                </div>
                <Slider
                  value={params[key as keyof typeof params] as number}
                  min={min} max={max} step={step}
                  onChange={(value) => handleParamChange(key, value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>{low}</span><span>{high}</span>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'frequencyPenalty', label: '频率惩罚', min: -2, max: 2, step: 0.1 },
                { key: 'presencePenalty', label: '存在惩罚', min: -2, max: 2, step: 0.1 },
              ].map(({ key, label, min, max, step }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[var(--text-secondary)]">{label}</label>
                    <span className="text-xs text-[var(--text-muted)]">
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
