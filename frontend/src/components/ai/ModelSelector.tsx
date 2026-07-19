/**
 * 模型选择与参数调节组件
 * 允许用户选择不同的模型和调节模型参数
 */
import { useState } from 'react'
import { Card, Select, Slider, Badge, Button } from '@/components/ui'
import { Brain, Settings, ChevronDown, ChevronUp } from 'lucide-react'
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
    {
      value: 'formula_gpt',
      label: 'FormulaGPT',
      description: '配方生成模型',
      icon: <Brain className="w-4 h-4" />,
    },
    {
      value: 'synergy_net',
      label: 'SynergyNet',
      description: '协同分析模型',
      icon: <Brain className="w-4 h-4" />,
    },
    {
      value: 'safety_checker',
      label: 'SafetyChecker',
      description: '安全检查模型',
      icon: <Brain className="w-4 h-4" />,
    },
    {
      value: 'taste_predictor',
      label: 'TastePredictor',
      description: '口感预测模型',
      icon: <Brain className="w-4 h-4" />,
    },
    {
      value: 'stability_model',
      label: 'StabilityModel',
      description: '稳定性预测模型',
      icon: <Brain className="w-4 h-4" />,
    },
  ]

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value }
    setParams(newParams)
    onParamsChange(newParams)
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium">模型选择</h3>
            <p className="text-xs text-neutral-500">选择和配置 AI 模型</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowParams(!showParams)}
          icon={showParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        >
          {showParams ? '收起参数' : '调节参数'}
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">模型类型</label>
          <Select value={modelType} onChange={(e) => onModelChange(e.target.value as ModelType)}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </Select>
        </div>

        {showParams && (
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">温度 (Temperature)</label>
                <span className="text-xs text-neutral-500">{params.temperature.toFixed(2)}</span>
              </div>
              <Slider
                value={params.temperature}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => handleParamChange('temperature', value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>0.0 (确定)</span>
                <span>1.0 (随机)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">最大 Tokens</label>
                <span className="text-xs text-neutral-500">{params.maxTokens}</span>
              </div>
              <Slider
                value={params.maxTokens}
                min={100}
                max={4000}
                step={100}
                onChange={(value) => handleParamChange('maxTokens', value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>100</span>
                <span>4000</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Top P</label>
                <span className="text-xs text-neutral-500">{params.topP.toFixed(2)}</span>
              </div>
              <Slider
                value={params.topP}
                min={0.1}
                max={1}
                step={0.01}
                onChange={(value) => handleParamChange('topP', value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>0.1</span>
                <span>1.0</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">频率惩罚</label>
                  <span className="text-xs text-neutral-500">{params.frequencyPenalty.toFixed(2)}</span>
                </div>
                <Slider
                  value={params.frequencyPenalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  onChange={(value) => handleParamChange('frequencyPenalty', value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">存在惩罚</label>
                  <span className="text-xs text-neutral-500">{params.presencePenalty.toFixed(2)}</span>
                </div>
                <Slider
                  value={params.presencePenalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  onChange={(value) => handleParamChange('presencePenalty', value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ModelSelector
