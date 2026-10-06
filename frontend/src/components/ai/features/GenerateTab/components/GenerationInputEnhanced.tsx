/**
 * GenerationInputEnhanced - 增强版配方生成输入组件
 * 
 * @description 解决子模块重叠问题，添加对话式输入，优化布局层次
 * @version 2.0.0
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { 
  Target, FileText, MessageSquare, Sparkles, Send, 
  X, ChevronDown, ChevronUp, Zap, Loader2,
  History, Star, Lightbulb, Settings, Sliders
} from 'lucide-react'
import { Button } from '@/components/ui'
import { GenerationProgressPanel } from '@/components/ai/GenerationProgressPanel'
import { FormulaInputWindow } from '@/components/ai/FormulaInputWindow'
import { EFFECT_OPTIONS, EFFECT_CATEGORIES, getEffectsByCategory } from '@/config/ai/effects'
import { DEFAULTS, VALIDATION } from '@/config'
import { CheckCircle, Upload } from 'lucide-react'
import { logger } from '@/utils/safeLogger'

const QUICK_TEMPLATES = [
  { id: 'immune', name: '增强免疫', effects: ['增强免疫', '提高抵抗力'], icon: '🛡️' },
  { id: 'fatigue', name: '抗疲劳', effects: ['抗疲劳', '提升精力'], icon: '⚡' },
  { id: 'sleep', name: '改善睡眠', effects: ['改善睡眠', '安神定志'], icon: '😴' },
  { id: 'digestion', name: '健脾养胃', effects: ['健脾养胃', '促进消化'], icon: '🍵' },
  { id: 'beauty', name: '美容养颜', effects: ['美容养颜', '延缓衰老'], icon: '✨' },
  { id: 'cardio', name: '心血管健康', effects: ['降血脂', '保护血管'], icon: '❤️' },
]

interface EffectOption {
  id: string
  label: string
  category: string
  popular: boolean
}

interface GenerationInputEnhancedProps {
  inputMode: 'effects' | 'manual' | 'chat'
  onInputModeChange: (mode: 'effects' | 'manual' | 'chat') => void
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
}

export const GenerationInputEnhanced: React.FC<GenerationInputEnhancedProps> = ({
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
}) => {
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant'; content: string}[]>([])
  const [isChatProcessing, setIsChatProcessing] = useState(false)
  const [showQuickTemplates, setShowQuickTemplates] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleQuickTemplateClick = useCallback((template: typeof QUICK_TEMPLATES[0]) => {
    const existingIds = selectedEffects.map(e => e.id)
    const newEffects = template.effects
      .map(label => EFFECT_OPTIONS.find(e => e.label === label))
      .filter((e): e is EffectOption => e !== undefined && !existingIds.includes(e.id))
    
    if (newEffects.length > 0) {
      onSetSelectedEffects([...selectedEffects, ...newEffects])
    }
    setShowQuickTemplates(false)
  }, [selectedEffects, onSetSelectedEffects])

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatProcessing) return
    
    const userMessage = chatInput.trim()
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    setChatInput('')
    setIsChatProcessing(true)

    try {
      // 模拟AI处理（实际应调用API）
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const assistantMessage = `已理解您的需求："${userMessage}"。基于此，我为您推荐以下功效组合：
      
• 增强免疫
• 改善睡眠  
• 健脾养胃

这些功效组合有助于整体调理。是否要应用这些选择？`

      setChatHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }])
      
      // 自动选择推荐的效应
      const recommendedEffects = ['增强免疫', '改善睡眠', '健脾养胃']
        .map(label => EFFECT_OPTIONS.find(e => e.label === label))
        .filter((e): e is EffectOption => e !== undefined)
      
      if (recommendedEffects.length > 0) {
        onSetSelectedEffects(recommendedEffects)
      }
    } catch (error) {
      logger.error('Chat processing failed:', error)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: '处理请求时出现问题，请重试。' 
      }])
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

  const getSelectedCount = useCallback(() => {
    return selectedEffects.length
  }, [selectedEffects])

  return (
    <div className="space-y-6 animate-[fadeInUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
      {/* 输入模式切换 - 三栏设计 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            {DEFAULTS.PLACEHOLDER_TEXTS.LABEL_INPUT_MODE}
          </span>
          <div className="flex bg-neutral-100 dark:bg-neutral-800/80 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => onInputModeChange('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'chat'
                  ? 'bg-white dark:bg-neutral-700 shadow-md text-neutral-900 dark:text-neutral-100 scale-105'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              对话模式
            </button>
            <button
              onClick={() => onInputModeChange('effects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'effects'
                  ? 'bg-white dark:bg-neutral-700 shadow-md text-neutral-900 dark:text-neutral-100 scale-105'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Target className="w-4 h-4" />
              功效选择
            </button>
            <button
              onClick={() => onInputModeChange('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'manual'
                  ? 'bg-white dark:bg-neutral-700 shadow-md text-neutral-900 dark:text-neutral-100 scale-105'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              手动输入
            </button>
          </div>
        </div>

        {/* 当前状态指示器 */}
        {selectedEffects.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-full border border-primary-200 dark:border-primary-800">
            <CheckCircle className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
              已选 {selectionCount}/{VALIDATION.maxEffectSelection} 个功效
            </span>
          </div>
        )}
      </div>

      {/* 对话模式 */}
      {inputMode === 'chat' && (
        <div className="space-y-4 animate-fade-in">
          {/* 快捷模板 */}
          {showQuickTemplates && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">快捷模板</span>
                <button 
                  onClick={() => setShowQuickTemplates(false)}
                  className="ml-auto text-amber-500 hover:text-amber-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleQuickTemplateClick(template)}
                    className="flex flex-col items-center gap-1 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all duration-200"
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{template.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 聊天输入区域 */}
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {/* 聊天记录区 */}
            <div className="max-h-64 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 dark:text-neutral-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">描述您的健康需求，AI将为您生成个性化配方</p>
                  <p className="text-xs mt-1">例如："我最近经常熬夜，容易疲劳，想调理身体"</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary-container text-primary-main rounded-br-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-sm'
                      }`}
                    >
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {isChatProcessing && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 p-3 flex gap-2">
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述您的健康需求，如：改善睡眠、增强免疫..."
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
                disabled={isChatProcessing}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatProcessing}
                className="px-3 py-2 bg-primary-container hover:bg-primary-container disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-primary-main rounded-xl transition-colors duration-200"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 选择结果展示 */}
          {selectedEffects.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-success-50 dark:bg-success-900/10 rounded-xl border border-success-200 dark:border-success-800/30">
              <span className="text-xs font-medium text-success-700 dark:text-success-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                AI已为您选择：
              </span>
              {selectedEffects.map((effect) => (
                <span
                  key={effect.id}
                  className="text-xs px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-full"
                >
                  {effect.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 功效选择模式 */}
      {inputMode === 'effects' && (
        <div className="space-y-6 animate-fade-in">
          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2">
            {EFFECT_CATEGORIES.map((category) => {
              const effects = getEffectsByCategory(category)
              const hasSelected = effects.some(e => selectedEffects.some(s => s.id === e.id))
              return (
                <button
                  key={category}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    hasSelected
                      ? 'bg-primary-container text-primary-main shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {category}
                  {hasSelected && <span className="ml-1 text-[10px]">✓</span>}
                </button>
              )
            })}
          </div>

          {/* 功效选择网格 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <div className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                </div>
                {DEFAULTS.PLACEHOLDER_TEXTS.TITLE_SELECT_EFFECTS}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 text-white shadow-sm">
                  {selectionCount}/{VALIDATION.maxEffectSelection}
                </span>
              </h3>
              {selectedEffects.length > 0 && (
                <button
                  onClick={onClearEffects}
                  className="text-xs text-neutral-500 hover:text-error-500 transition-colors"
                >
                  清空选择
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {EFFECT_OPTIONS.map((effect) => {
                const isSelected = selectedEffects.some(e => e.id === effect.id)
                return (
                  <button
                    key={effect.id}
                    onClick={() => onToggleEffect(effect)}
                    disabled={!isSelected && !canSelectMore}
                    className={`group relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'shadow-lg scale-105'
                        : !isSelected && !canSelectMore
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:shadow-md hover:scale-102 active:scale-98'
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-primary-500)'
                        : 'var(--bg-secondary)',
                      border: isSelected
                        ? 'none'
                        : '1px solid var(--border-color)',
                      color: isSelected
                        ? 'white'
                        : 'var(--text-secondary)',
                      boxShadow: isSelected
                        ? '0 8px 24px rgba(99, 102, 241, 0.3)'
                        : 'none',
                    }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50" />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      {effect.label}
                      {effect.popular && !isSelected && (
                        <span className="text-[10px] px-1 py-0.5 rounded-full bg-warning-500/15 dark:bg-warning-500/25 text-warning-600 dark:text-warning-400 font-semibold">
                          热
                        </span>
                      )}
                      {isSelected && (
                        <CheckCircle className="w-3.5 h-3.5 ml-1" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 参数调整面板 */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <button
              onClick={onToggleParamPanel}
              className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              高级参数配置
              {paramPanelExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {paramPanelExpanded && (
              <div className="mt-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl animate-fade-in">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                  参数配置功能开发中...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 手动输入模式 */}
      {inputMode === 'manual' && (
        <div className="animate-fade-in">
          <FormulaInputWindow
            onClose={() => onInputModeChange('effects')}
            onSubmit={onManualFormulaInput}
          />
        </div>
      )}

      {/* 进度显示 */}
      {progress.stage !== 'idle' && (
        <GenerationProgressPanel
          progress={progress}
          onCancel={onCancelGeneration}
          showCancelButton={progress.canCancel}
        />
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            disabled={selectedEffects.length === 0 || isGenerating}
            onClick={() => onGenerate(effectLabels)}
            loading={isGenerating}
            icon={useLlm && llmAvailable ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            size="lg"
            className="min-w-[180px] rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500 hover:from-primary-600 hover:via-indigo-600 hover:to-purple-600"
          >
            {useLlm && llmAvailable
              ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_AI_GENERATE
              : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_START_GENERATE
            }
          </Button>

          {selectedEffects.length > 0 && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:inline">
              ✓ {selectedEffects.length} 个功效已选择
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onFullReset}
            className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}

export default GenerationInputEnhanced
