/**
 * GenerationInputPro - Professional Formula Generation Input Component
 * 
 * @description Clean layout following RMFOOD design system
 * @version 5.0.0 - Unified Layout
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Target, FileText, MessageSquare, Sparkles, Send,
  X, ChevronDown, ChevronUp, Zap, Loader2,
  Lightbulb, Settings, CheckCircle,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { GenerationProgressPanel } from '@/components/ai/GenerationProgressPanel'
import { FormulaInputWindow } from '@/components/ai/FormulaInputWindow'
import { EFFECT_OPTIONS, EFFECT_CATEGORIES } from '@/config/ai/effects'
import { VALIDATION } from '@/config'
import { aiApi } from '@/api/ai'
import type { AICandidate } from '@/api/ai'
import { formulaIntelligenceService } from '../../services/formulaIntelligenceService'
import type { InputMode } from '../config/generateTabConfig'
import { logger } from '@/utils/safeLogger'
import { AlgorithmConfigPanel } from './AlgorithmConfigPanel'
import { ConstraintPanel } from './ConstraintPanel'
import type { AlgorithmConfig } from './AlgorithmConfigPanel'
import type { PersonalConstraints } from './ConstraintPanel'

// Quick templates
const QUICK_TEMPLATES = [
  { id: 'immune', nameKey: 'ai.formula.generateTab.templateImmune', icon: '🛡️', effects: ['immune_enhancement', 'resistance_boost'] },
  { id: 'fatigue', nameKey: 'ai.formula.generateTab.templateAntiFatigue', icon: '⚡', effects: ['anti_fatigue', 'energy_boost'] },
  { id: 'sleep', nameKey: 'ai.formula.generateTab.templateSleep', icon: '😴', effects: ['sleep_improvement', 'calm_mind'] },
  { id: 'digestion', nameKey: 'ai.formula.generateTab.templateDigestion', icon: '🍵', effects: ['spleen_stomach', 'digestion_promotion'] },
  { id: 'beauty', nameKey: 'ai.formula.generateTab.templateBeauty', icon: '✨', effects: ['beauty_skin', 'antioxidant'] },
  { id: 'cardio', nameKey: 'ai.formula.generateTab.templateCardio', icon: '❤️', effects: ['blood_lipid', 'vascular_protection'] },
]

/**
 * 常见口语描述 → 前端功效标签（EFFECT_OPTIONS.label）的别名映射。
 * 用于聊天模式意图解析：把用户自然语言收敛为后端可识别的功效标签，
 * 禁止将自由文本直接作为 target_effects 直传 /ai/generate。
 */
const EFFECT_TEXT_ALIASES: Record<string, string[]> = {
  '增强免疫': ['增强免疫', '免疫力', '提高免疫', '抵抗力', '免疫'],
  '免疫调节': ['免疫调节'],
  '提高抵抗力': ['提高抵抗力', '增强抵抗'],
  '抗氧化': ['抗氧化', '自由基', '氧化'],
  '延缓衰老': ['延缓衰老', '抗衰老', '衰老', '逆龄'],
  '清除自由基': ['清除自由基'],
  '抗疲劳': ['抗疲劳', '疲劳', '乏力', '疲惫', '提神', '恢复体力'],
  '缓解疲劳': ['缓解疲劳'],
  '提升精力': ['提升精力', '精力', '活力'],
  '补气养阴': ['补气养阴', '补气', '养阴'],
  '滋阴补肾': ['滋阴补肾', '滋阴', '补肾'],
  '健脾益气': ['健脾益气', '益气'],
  '补血养血': ['补血养血', '补血', '养血'],
  '补气养血': ['补气养血'],
  '降血压': ['降血压', '降压', '血压高'],
  '降血脂': ['降血脂', '血脂'],
  '辅助降血脂': ['辅助降血脂'],
  '保护血管': ['保护血管', '血管'],
  '促进循环': ['促进循环', '活血', '循环'],
  '降血糖': ['降血糖', '降糖', '血糖'],
  '辅助降尿酸': ['辅助降尿酸', '尿酸'],
  '调节代谢': ['调节代谢', '代谢'],
  '控制体重': ['控制体重', '减肥', '瘦身', '体重'],
  '改善睡眠': ['改善睡眠', '睡眠', '失眠', '助眠', '入睡'],
  '安神定志': ['安神定志', '安神'],
  '缓解焦虑': ['缓解焦虑', '焦虑', '紧张', '压力'],
  '健脾养胃': ['健脾养胃', '健脾', '养胃', '脾胃'],
  '促进消化': ['促进消化', '消化', '积食', '食欲'],
  '调理脾胃': ['调理脾胃'],
  '润肺止咳': ['润肺止咳', '润肺', '止咳', '咳嗽'],
  '清咽利喉': ['清咽利喉', '咽喉', '利喉', '咽炎'],
  '明目护眼': ['明目护眼', '明目', '护眼', '视力', '眼睛'],
  '缓解眼疲劳': ['缓解眼疲劳', '眼疲劳'],
  '美容养颜': ['美容养颜', '美容', '养颜', '皮肤', '护肤', '美白'],
  '护肤保湿': ['护肤保湿', '保湿'],
  '强健筋骨': ['强健筋骨', '强健', '筋骨'],
  '补钙健骨': ['补钙健骨', '补钙', '健骨', '骨骼', '骨质疏松'],
}

/**
 * 从用户自然语言中提取已知功效标签（EFFECT_OPTIONS.label）。
 * 返回空数组表示无法解析，调用方应引导用户选择功效标签而不是直传自由文本。
 */
function extractEffectLabelsFromText(text: string): string[] {
  const lower = text.toLowerCase()
  const matched = new Set<string>()
  // 1) 直接命中前端功效标签
  for (const opt of EFFECT_OPTIONS) {
    if (lower.includes(opt.label.toLowerCase())) matched.add(opt.label)
  }
  // 2) 通过常见口语别名命中
  for (const [label, keywords] of Object.entries(EFFECT_TEXT_ALIASES)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) matched.add(label)
  }
  return Array.from(matched)
}

interface EffectOption {
  id: string
  label: string
  labelKey: string
  category: string
  categoryKey: string
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
  /** Chat 模式真实生成完成后，将候选配方同步给父组件用于结果面板展示 */
  onChatCandidates?: (candidates: AICandidate[]) => void
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
  onChatCandidates,
  className = '',
}) => {
  const { t } = useTranslation()
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant'; content: string; timestamp?: number}[]>([])
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [showQuickTemplates, setShowQuickTemplates] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const categories = ['All', ...EFFECT_CATEGORIES]
  const categoryKeyMap = React.useMemo(() => {
    const map: Record<string, string> = { All: 'all' }
    for (const e of EFFECT_OPTIONS) {
      if (!map[e.category]) map[e.category] = e.categoryKey
    }
    return map
  }, [])
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
      // P1 契约修复：禁止把用户自由文本直接作为 target_effects 直传 /ai/generate。
      // 先做意图解析 + 功效标签提取；无法解析出已知功效时，明确引导用户选择功效标签。
      const intent = formulaIntelligenceService.detectIntent(userMessage)
      const matchedLabels = extractEffectLabelsFromText(userMessage)

      if (matchedLabels.length === 0) {
        logger.info('[GenerationInputPro] 无法从聊天文本解析功效标签', { intent, userMessage })
        const guidance =
          '抱歉，我无法从您的描述中识别出明确的功效方向。请切换到「功效模式」直接选择功效标签，' +
          '或在聊天中描述具体功效，例如：「增强免疫」「改善睡眠」「抗疲劳」。'
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: guidance,
          timestamp: Date.now(),
        }])
        return
      }

      // 用解析出的功效标签（而非原始自由文本）调用真实后端生成
      const result = await aiApi.generate(matchedLabels, undefined, false)

      const candidates: AICandidate[] = result?.candidates ?? []
      if (candidates.length === 0) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: '未生成候选配方，请稍后重试或更换描述。',
          timestamp: Date.now(),
        }])
        return
      }

      // 用真实返回的候选映射推荐功效（仅在返回的 effects 命中已知功效时选择，不硬编码）
      const recommendedEffects: EffectOption[] = []
      const seenEffectIds = new Set<string>()
      for (const candidate of candidates) {
        for (const effect of candidate.effects ?? []) {
          const matched = EFFECT_OPTIONS.find(e => e.id === effect || e.label === effect)
          if (matched && !seenEffectIds.has(matched.id)) {
            seenEffectIds.add(matched.id)
            recommendedEffects.push(matched)
          }
        }
      }
      if (recommendedEffects.length > 0) {
        onSetSelectedEffects(recommendedEffects)
      }

      // 用真实候选驱动配方展示
      const candidateLines = candidates.map((candidate, index) => {
        const herbs = (candidate.herb_combination ?? [])
          .map(h => `${h.name || '未知药材'}${h.dosage ? ` ${h.dosage}` : ''}`)
          .join('、')
        const score = typeof candidate.overall_score === 'number'
          ? `（综合评分 ${candidate.overall_score.toFixed(4)}）`
          : ''
        return `${index + 1}. ${candidate.formula_name || candidate.name || '候选配方'}${score}${herbs ? `\n   ${herbs}` : ''}`
      })

      const assistantMessage = `已根据您的需求「${userMessage}」识别功效方向「${matchedLabels.join('、')}」，生成 ${candidates.length} 个候选配方：\n${candidateLines.join('\n')}`

      setChatHistory(prev => [...prev, { role: 'assistant', content: assistantMessage, timestamp: Date.now() }])

      // 将真实候选同步到结果面板，便于保存/对比/报告
      onChatCandidates?.(candidates)
    } catch (error) {
      logger.error('[GenerationInputPro] Chat processing failed:', error)
      const errorMsg = error instanceof Error ? error.message : '生成失败，请稍后重试。'
      setChatHistory(prev => [...prev, { role: 'assistant', content: `出错了：${errorMsg}`, timestamp: Date.now() }])
    } finally {
      setIsChatProcessing(false)
    }
  }, [chatInput, isChatProcessing, onSetSelectedEffects, onChatCandidates])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 回车（含 Ctrl+Enter）发送聊天：阻止冒泡，避免同时触发顶层文档级
    // Ctrl+Enter 快捷键导致重复生成。
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleChatSend()
    }
  }, [handleChatSend])

  return (
    <div className={className}>
      {/* Mode switcher - compact */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-overline font-semibold text-muted-foreground uppercase tracking-wider">{t('ai.formula.generateTab.mode')}</span>
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['chat', 'effects', 'manual'] as const).map((mode) => {
              const labels = {
                chat: t('ai.formula.generateTab.chatModeShort'),
                effects: t('ai.formula.generateTab.effectsMode'),
                manual: t('ai.formula.generateTab.manualMode'),
              }
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
                  <span className="text-body-sm font-semibold">{t('ai.formula.generateTab.quickStart')}</span>
                </div>
                <button onClick={() => setShowQuickTemplates(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-cols-6 gap-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleQuickTemplateClick(template)}
                    className="flex flex-col items-center gap-1.5 p-3 bg-background rounded-lg border border-border hover:border-primary/40 transition-all"
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="text-caption font-medium text-center">{t(template.nameKey)}</span>
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
                  <p className="text-body-sm font-medium mb-1">{t('ai.formula.generateTab.describeHealthNeeds')}</p>
                  <p className="text-caption text-muted-foreground">{t('ai.formula.generateTab.healthNeedsExample')}</p>
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
                placeholder={t('ai.formula.generateTab.describeHealthNeedsPlaceholder')}
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
                <CheckCircle className="w-3.5 h-3.5" />{t('ai.formula.generateTab.aiSelected')}
              </span>
              {selectedEffects.map((effect) => (
                <span key={effect.id} className="text-caption px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">
                  {t(`ai.formula.effects.labels.${effect.labelKey}`, { defaultValue: effect.label })}
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
                  {t(`ai.formula.effects.categories.${categoryKeyMap[category]}`, { defaultValue: category })} <span className="opacity-70 ml-1">{count}</span>
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
                {t('ai.formula.generateTab.selectEffects')}
                <span className="text-caption font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                  {selectionCount}/{VALIDATION.maxEffectSelection}
                </span>
              </h3>
              {selectedEffects.length > 0 && (
                <button onClick={onClearEffects} className="text-caption text-muted-foreground hover:text-error">{t('ai.formula.generateTab.clear')}</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
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
                      {t(`ai.formula.effects.labels.${effect.labelKey}`, { defaultValue: effect.label })}
                      {effect.popular && !isSelected && <span className="text-xs px-1 py-0.5 rounded bg-warning/10 text-warning font-bold">{t('ai.formula.generateTab.popular')}</span>}
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
              {t('ai.formula.generateTab.algorithmParams')}
              {paramPanelExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {paramPanelExpanded && (
              <div className="mt-3 space-y-4 animate-fade-in">
                {/* Algorithm Config */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">{t('ai.formula.generateTab.geneticAlgorithmConfig')}</h4>
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
                    <h4 className="text-sm font-semibold">{t('ai.formula.generateTab.personalConstraints')}</h4>
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
            {useLlm && llmAvailable ? t('ai.formula.ui.aiSmartGenerate') : t('ai.formula.wizard.startGeneration')}
          </Button>
          {selectedEffects.length > 0 && (
            <span className="text-caption text-muted-foreground">
              {t('ai.formula.generateTab.selectedCount', { count: selectedEffects.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-caption text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-xs">Ctrl+Enter</kbd>
            <span>{t('ai.formula.generateTab.generateFormula')}</span>
          </div>
          <button onClick={onFullReset} className="px-3 py-1.5 text-body-sm text-muted-foreground hover:text-foreground">{t('ai.formula.generateTab.reset')}</button>
        </div>
      </div>
    </div>
  )
}

export default GenerationInputPro
