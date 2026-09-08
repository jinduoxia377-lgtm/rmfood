/**
 * GenerationInputPro - Professional Formula Generation Input Component
 * 
 * @description Clean layout following RMFOOD design system
 * @version 5.0.0 - Unified Layout
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Target, FileText, MessageSquare, Sparkles, Send,
  X, ChevronDown, ChevronUp, Zap, Loader2,
  History, Star, Lightbulb, Settings, CheckCircle,
  TrendingUp, Filter, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { GenerationProgressPanel } from '@/components/ai/GenerationProgressPanel'
import { FormulaInputWindow } from '@/components/ai/FormulaInputWindow'
import { EFFECT_OPTIONS, EFFECT_CATEGORIES } from '@/config/ai/effects'
import { DEFAULTS, VALIDATION } from '@/config'
import { useGenerationShortcuts } from '../hooks/useGenerationShortcuts'
import type { InputMode } from '../config/generateTabConfig'
import { AlgorithmConfigPanel } from './AlgorithmConfigPanel'
import { ConstraintPanel } from './ConstraintPanel'
import type { AlgorithmConfig } from './AlgorithmConfigPanel'
import type { PersonalConstraints } from './ConstraintPanel'

// Quick templates
const QUICK_TEMPLATES = [
  { id: 'immune', name: '增强免疫', icon: '🛡️', effects: ['immune_enhancement', 'resistance_boost'] },
  { id: 'fatigue', name: '抗疲劳', icon: '⚡', effects: ['anti_fatigue', 'energy_boost'] },
  { id: 'sleep', name: '改善睡眠', icon: '😴', effects: ['sleep_improvement', 'calm_mind'] },
  { id: 'digestion', name: '健脾养胃', icon: '🍵', effects: ['spleen_stomach', 'digestion_promotion'] },
  { id: 'beauty', name: '美容养颜', icon: '✨', effects: ['beauty_skin', 'antioxidant'] },
  { id: 'cardio', name: '心血管健康', icon: '❤️', effects: ['blood_lipid', 'vascular_protection'] },
]

interface EffectOption {
  id: string
  label: string
  category: string
  popular: boolean
}

interface GenerationInputProProps {
  inputMode: InputMode | 'chat'
  onInputModeChange: (mode: InputMode | 'chat') => void
  selectedEffects: EffectOption[]
  onToggleEffect: (effect: EffectOption) => void
  onClearEffects: () => void
  effectLabels: string[]
  canSelectMore: boolean
  selectionCount: number
  onGenerate: (effects: string[]) => void
  isGenerating: boolean
  progress: any
  onCancelGeneration: () => void
  onManualFormulaInput: (candidate: any) => void
  onSetSelectedEffects: (effects: EffectOption[]) => void
  paramPanelExpanded: boolean
  onToggleParamPanel: () => void
  onFullReset: () => void
  useLlm: boolean
  llmAvailable: boolean
  algorithmConfig?: AlgorithmConfig
  onAlgorithmConfigChange?: (config: AlgorithmConfig) => void
  constraints?: PersonalConstraints
  onConstraintsChange?: (constraints: PersonalConstraints) => void
  className?: string
}

export const GenerationInputPro: React.FC<GenerationInputProProps> = ({
  inputMode,
  onInputModeChange,
  selectedEffects,
  onToggleEffect,
  onClearEffects,
  effectLabels,
  canSelectMore,
  selectionCount,
  onGenerate,
  isGenerating,
  progress,
  onCancelGeneration,
  onManualFormulaInput,
  onSetSelectedEffects,
  paramPanelExpanded,
  onToggleParamPanel,
  onFullReset,
  useLlm,
  llmAvailable,
  algorithmConfig,
  onAlgorithmConfigChange,
  constraints,
  onConstraintsChange,
  className = '',
}) => {
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant'; content: string; timestamp?: number}[]>([])
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [showQuickTemplates, setShowQuickTemplates] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { shortcuts } = useGenerationShortcuts({
    onGenerate: () => onGenerate(effectLabels),
    onCancel: onCancelGeneration,
    onReset: onFullReset,
    onSwitchToChat: () => onInputModeChange('chat'),
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const categories = ['All', ...EFFECT_CATEGORIES]
  const filteredEffects = activeCategory === 'All' 
    ? EFFECT_OPTIONS 
    : EFFECT_OPTIONS.filter(e => e.category === activeCategory)

  const handleQuickTemplateClick = useCallback((template: typeof QUICK_TEMPLATES[0]) => {
    const existingIds = new Set(selectedEffects.map(e => e.id))
    const newEffects = template.effects
      .map(id => EFFECT_OPTIONS.find(e => e.id === id))
      .filter((e): e is EffectOption => e !== undefined && !existingIds.has(e.id))
    
    if (newEffects.length > 0) {
      onSetSelectedEffects([...selectedEffects, ...newEffects])
    }
    setShowQuickTemplates(false)
  }, [selectedEffects, onSetSelectedEffects])

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatProcessing) return
    
    const userMessage = chatInput.trim()
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }])
    setChatInput('')
    setIsChatProcessing(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1200))

      const assistantMessage = `已理解您的需求："${userMessage}"

根据您的描述，推荐以下功效组合：
- 增强免疫
- 改善睡眠
- 健脾养胃`

      setChatHistory(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: Date.now() }])

      const recommendedEffects = ['immune_enhancement', 'sleep_improvement', 'spleen_stomach']
        .map(id => EFFECT_OPTIONS.find(e => e.id === id))
        .filter((e): e is EffectOption => e !== undefined)

      if (recommendedEffects.length > 0) {
        onSetSelectedEffects(recommendedEffects)
      }
    } catch (error) {
      console.error('Chat processing failed:', error)
      setChatHistory(prev => [...prev, { role: 'assistant', content: '出错了，请重试。', timestamp: Date.now() }])
    } finally {
      setIsChatProcessing(false)
    }
  }, [chatInput, isChatProcessing, onSetSelectedEffects])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  }, [handleChatSend])

  return (
    <div className={className}>
      {/* Mode switcher - compact */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-overline font-semibold text-muted-foreground uppercase tracking-wider">Mode</span>
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['chat', 'effects', 'manual'] as const).map((mode) => {
              const labels = { chat: 'Chat', effects: 'Effects', manual: 'Manual' }
              const icons = { chat: MessageSquare, effects: Target, manual: FileText }
              const Icon = icons[mode]
              const isActive = inputMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => onInputModeChange(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium transition-all
                    ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {labels[mode]}
                </button>
              )
            })}
          </div>
        </div>
        {selectedEffects.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
            <span className="text-body-sm font-medium text-primary">{selectionCount}/{VALIDATION.maxEffectSelection}</span>
          </div>
        )}
      </div>

      {/* Chat mode */}
      {inputMode === 'chat' && (
        <div className="space-y-4">
          {showQuickTemplates && (
            <div className="p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-warning" />
                  <span className="text-body-sm font-semibold">快速开始</span>
                </div>
                <button onClick={() => setShowQuickTemplates(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleQuickTemplateClick(template)}
                    className="flex flex-col items-center gap-1.5 p-3 bg-background rounded-lg border border-border hover:border-primary/40 transition-all"
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="text-caption font-medium text-center">{template.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat input */}
          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-body-sm font-medium mb-1">描述您的健康需求</p>
                  <p className="text-caption text-muted-foreground">例如："长期熬夜、精神疲惫"</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-body-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}>
                      {msg.content.split('\n').map((line, i) => <p key={i} className={i > 0 ? 'mt-1.5' : ''}>{line}</p>)}
                    </div>
                  </div>
                ))
              )}
              {isChatProcessing && (
                <div className="flex justify-start">
                  <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述您的健康需求..."
                rows={2}
                className="flex-1 resize-none bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
                disabled={isChatProcessing}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatProcessing}
                className="px-3 py-2 bg-primary hover:bg-primary-hover disabled:bg-muted text-primary-foreground rounded-lg transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedEffects.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-success/5 rounded-lg border border-success/20">
              <span className="text-body-sm font-medium text-success flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />AI已选择：
              </span>
              {selectedEffects.map((effect) => (
                <span key={effect.id} className="text-caption px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">
                  {effect.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Effects mode */}
      {inputMode === 'effects' && (
        <div className="space-y-4">
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => {
              const count = category === 'All' ? EFFECT_OPTIONS.length : EFFECT_OPTIONS.filter(e => e.category === category).length
              const hasSelected = category === 'All' ? selectedEffects.length > 0 : EFFECT_OPTIONS.some(e => e.category === category && selectedEffects.some(s => s.id === e.id))
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-caption font-medium transition-all
                    ${activeCategory === category ? 'bg-primary text-primary-foreground' : hasSelected ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground hover:bg-background'}`}
                >
                  {category} <span className="opacity-70 ml-1">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Effects grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-title-sm font-semibold flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                  <Target className="w-3 h-3 text-primary" />
                </div>
                选择功效
                <span className="text-caption font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                  {selectionCount}/{VALIDATION.maxEffectSelection}
                </span>
              </h3>
              {selectedEffects.length > 0 && (
                <button onClick={onClearEffects} className="text-caption text-muted-foreground hover:text-error">清空</button>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {filteredEffects.map((effect) => {
                const isSelected = selectedEffects.some(e => e.id === effect.id)
                return (
                  <button
                    key={effect.id}
                    onClick={() => onToggleEffect(effect)}
                    disabled={!isSelected && !canSelectMore}
                    className={`px-3 py-2 rounded-lg text-body-sm font-medium transition-all border
                      ${isSelected ? 'bg-primary text-primary-foreground border-primary' : !isSelected && !canSelectMore ? 'opacity-40 cursor-not-allowed bg-muted border-transparent' : 'bg-background border-border hover:border-primary/40'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {effect.label}
                      {effect.popular && !isSelected && <span className="text-[9px] px-1 py-0.5 rounded bg-warning/10 text-warning font-bold">热门</span>}
                      {isSelected && <CheckCircle className="w-3 h-3 ml-auto" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Parameters */}
          <div className="border-t border-border pt-3">
            <button onClick={onToggleParamPanel} className="flex items-center gap-2 text-body-sm font-medium text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
              算法参数
              {paramPanelExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {paramPanelExpanded && (
              <div className="mt-3 space-y-4 animate-fade-in">
                {/* Algorithm Config */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">遗传算法配置</h4>
                  </div>
                  <AlgorithmConfigPanel
                    config={algorithmConfig || {
                      strategy: 'auto',
                      preset: 'balanced',
                      populationSize: 50,
                      generations: 40,
                      mutationRate: 0.15,
                      crossoverRate: 0.85,
                      eliteRatio: 0.15,
                      tournamentSize: 5,
                      tastePreference: 'balanced',
                    }}
                    onChange={(config) => onAlgorithmConfigChange?.(config)}
                    onApplyPreset={(preset) => onAlgorithmConfigChange?.({
                      ...(algorithmConfig || {}),
                      preset,
                    } as AlgorithmConfig)}
                    isGenerating={isGenerating}
                  />
                </div>

                {/* Personal Constraints */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-warning" />
                    <h4 className="text-sm font-semibold">个人约束条件</h4>
                  </div>
                  <ConstraintPanel
                    constraints={constraints}
                    onChange={(c) => onConstraintsChange?.(c)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual mode */}
      {inputMode === 'manual' && (
        <FormulaInputWindow onClose={() => onInputModeChange('effects')} onSubmit={onManualFormulaInput} />
      )}

      {/* Progress */}
      {progress.stage !== 'idle' && (
        <GenerationProgressPanel progress={progress} onCancel={onCancelGeneration} showCancelButton={progress.canCancel} />
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            disabled={selectedEffects.length === 0 || isGenerating}
            onClick={() => onGenerate(effectLabels)}
            loading={isGenerating}
            icon={useLlm && llmAvailable ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            size="lg"
            className="rounded-lg font-semibold"
          >
            {useLlm && llmAvailable ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_AI_GENERATE : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_START_GENERATE}
          </Button>
          {selectedEffects.length > 0 && (
            <span className="text-caption text-muted-foreground">
              ✓ {selectedEffects.length} 已选
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-caption text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">{shortcuts.generate}</kbd>
            <span>生成配方</span>
          </div>
          <button onClick={onFullReset} className="px-3 py-1.5 text-body-sm text-muted-foreground hover:text-foreground">重置</button>
        </div>
      </div>
    </div>
  )
}

export default GenerationInputPro
