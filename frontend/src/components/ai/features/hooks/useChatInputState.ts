/**
 * useChatInputState - 输入状态协调器 (v2.0)
 *
 * v2.0 重构 (2026-07-06):
 * - 将 1840 行单体拆分为 6 个职责单一的 Hook
 * - 本文件仅负责组合与透传
 *
 * 组成 Hook：
 * - useChatInputBehavior    — 聚焦/失焦/自动高度/字符计数/语言检测
 * - useChatInputSuggestions — 智能建议引擎（多引擎降级链）
 * - useChatInputAttachments — 文件粘贴/拖拽/类型校验
 * - useChatInputDeepThinking — 深度思考分析
 * - useChatInputValidation  — 发送按钮可用性判断
 * - useChatInputKeyboard    — Enter/Shift+Enter/Tab/Escape
 *
 * @version 2.0.0
 * @lastUpdated 2026-07-06
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import type { SmartSuggestion } from './useChatInputSuggestions'
export type { SmartSuggestion } from './useChatInputSuggestions'

import { useChatInputBehavior, type UseChatInputBehaviorOptions, type UseChatInputBehaviorReturn } from './useChatInputBehavior'
import { useChatInputSuggestions, type UseChatInputSuggestionsOptions, type UseChatInputSuggestionsReturn } from './useChatInputSuggestions'
import { useChatInputAttachments, type UseChatInputAttachmentsReturn } from './useChatInputAttachments'
import { useChatInputDeepThinking, type UseChatInputDeepThinkingReturn } from './useChatInputDeepThinking'
import { useChatInputValidation, type UseChatInputValidationReturn } from './useChatInputValidation'
import { useChatInputKeyboard } from './useChatInputKeyboard'

// ===== 公共类型 =====
export interface UseChatInputStateOptions extends UseChatInputBehaviorOptions, UseChatInputSuggestionsOptions {
  isStreaming?: boolean
  isDisabled?: boolean
}

export interface UseChatInputStateReturn {
  // 行为
  inputRef: UseChatInputBehaviorReturn['inputRef']
  fileInputRef: UseChatInputBehaviorReturn['fileInputRef']
  value: UseChatInputBehaviorReturn['value']
  onChange: UseChatInputBehaviorReturn['onChange']
  isFocused: UseChatInputBehaviorReturn['isFocused']
  onFocus: UseChatInputBehaviorReturn['onFocus']
  onBlur: UseChatInputBehaviorReturn['onBlur']
  inputHeight: UseChatInputBehaviorReturn['inputHeight']
  charCount: UseChatInputValidationReturn['charCount']
  detectedLanguage: UseChatInputBehaviorReturn['detectedLanguage']
  showFormatError: UseChatInputBehaviorReturn['showFormatError']
  errorMessage: UseChatInputValidationReturn['errorMessage']

  // 建议
  suggestions: UseChatInputSuggestionsReturn['suggestions']
  isLoadingSuggestions: UseChatInputSuggestionsReturn['isLoadingSuggestions']
  showSuggestions: UseChatInputSuggestionsReturn['showSuggestions']
  setShowSuggestions: UseChatInputSuggestionsReturn['setShowSuggestions']
  applySuggestion: (s: SmartSuggestion) => void
  searchResults: UseChatInputSuggestionsReturn['searchResults']
  isSearching: UseChatInputSuggestionsReturn['isSearching']
  selectSearchResult: UseChatInputSuggestionsReturn['selectSearchResult']

  // 深度思考
  deepThinking: boolean
  smartSearch: boolean
  showDeepThinkingPanel: boolean
  setShowDeepThinkingPanel: (v: boolean) => void
  showSearchPanel: boolean
  setShowSearchPanel: UseChatInputSuggestionsReturn['setShowSearchPanel']
  showSettings: boolean
  setShowSettings: (v: boolean) => void
  deepThinkingAnalysis: UseChatInputDeepThinkingReturn['deepThinkingAnalysis']
  isAnalyzing: UseChatInputDeepThinkingReturn['isAnalyzing']
  toggleDeepThinking: UseChatInputSuggestionsReturn['toggleDeepThinking']
  toggleSmartSearch: UseChatInputSuggestionsReturn['toggleSmartSearch']
  triggerDeepThinking: UseChatInputDeepThinkingReturn['triggerDeepThinking']
  triggerSearch: () => void

  // 行为附加
  inputBehavior: UseChatInputBehaviorReturn['inputBehavior']

  // 附件
  attachments: UseChatInputAttachmentsReturn['attachments']
  isDragging: UseChatInputAttachmentsReturn['isDragging']
  showAttachments: UseChatInputAttachmentsReturn['showAttachments']
  setShowAttachments: UseChatInputAttachmentsReturn['setShowAttachments']
  addAttachments: UseChatInputAttachmentsReturn['addAttachments']
  removeAttachment: UseChatInputAttachmentsReturn['removeAttachment']
  clearAttachments: UseChatInputAttachmentsReturn['clearAttachments']
  handleFileSelect: UseChatInputAttachmentsReturn['handleFileSelect']

  // 麦克风
  showMic: boolean
  setShowMic: (v: boolean) => void

  // 校验
  isOverLimit: UseChatInputValidationReturn['isOverLimit']
  isExceeded: UseChatInputValidationReturn['isExceeded']
  canSend: UseChatInputValidationReturn['canSend']

  // 键盘
  handleKeyDown: ReturnType<typeof useChatInputKeyboard>['handleKeyDown']

  // 清除
  clearAll: () => void
}

export function useChatInputState(
  options: UseChatInputStateOptions = {},
): UseChatInputStateReturn {
  const {
    initialValue = '', maxLength,
    isStreaming = false, isDisabled = false,
    conversationHistory = [],
    externalDeepThinking, externalSmartSearch,
    onDeepThinkingChange, onSmartSearchChange,
    onChange: propsOnChange,
  } = options

  // 1. 行为
  const behavior = useChatInputBehavior({
    maxLength, initialValue, onChange: propsOnChange,
  })

  // 2. 建议
  const suggestions = useChatInputSuggestions({
    conversationHistory, externalDeepThinking, externalSmartSearch,
    onDeepThinkingChange, onSmartSearchChange,
  })

  // 3. 附件
  const attachments = useChatInputAttachments(behavior.fileInputRef)

  // 4. 深度思考
  const deepThinking = useChatInputDeepThinking()

  // 5. 校验
  const validation = useChatInputValidation({
    maxLength, value: behavior.value,
    isStreaming, isDisabled, showFormatError: behavior.showFormatError,
  })

  // 6. 键盘
  const keyboard = useChatInputKeyboard({
    canSend: validation.canSend,
    showSuggestions: suggestions.showSuggestions,
    suggestions: suggestions.suggestions,
    applySuggestion: suggestions.applySuggestion,
    setShowSuggestions: suggestions.setShowSuggestions,
    setShowDeepThinkingPanel: () => suggestions.showDeepThinkingPanel && suggestions.setShowSuggestions(false),
    setShowSearchPanel: () => {},
  })

  // 应用建议（组合）
  const applySuggestion = useCallback((s: SmartSuggestion) => {
    suggestions.applySuggestion(s)
    // 追加到输入框
    if (behavior.onChange) {
      behavior.onChange(behavior.value + ' ' + s.text)
    }
    behavior.onFocus()
  }, [behavior])

  // 清除全部
  const clearAll = useCallback(() => {
    behavior.onChange('')
    suggestions.setShowSuggestions(false)
    attachments.clearAttachments()
  }, [behavior, suggestions, attachments])

  // 触发深度思考：执行分析并打开面板
  const triggerDeepThinking = useCallback((input: string) => {
    deepThinking.triggerDeepThinking(input)
    suggestions.setShowDeepThinkingPanel(true)
  }, [deepThinking, suggestions])

  return {
    // 行为
    ...behavior,
    // 校验（覆盖 charCount）
    charCount: validation.charCount,
    isOverLimit: validation.isOverLimit,
    isExceeded: validation.isExceeded,
    canSend: validation.canSend,
    // errorMessage 使用 behavior 的真实错误消息（validation 的 errorMessage 恒为空）
    errorMessage: behavior.errorMessage,
    // 建议
    ...suggestions,
    applySuggestion,
    // 深度思考
    deepThinking: suggestions.deepThinking,
    smartSearch: suggestions.smartSearch,
    showSearchPanel: suggestions.showSearchPanel,
    setShowSearchPanel: suggestions.setShowSearchPanel,
    showSettings: suggestions.showSettings,
    setShowSettings: suggestions.setShowSettings,
    showDeepThinkingPanel: suggestions.showDeepThinkingPanel,
    setShowDeepThinkingPanel: suggestions.setShowDeepThinkingPanel,
    deepThinkingAnalysis: deepThinking.deepThinkingAnalysis,
    isAnalyzing: deepThinking.isAnalyzing,
    toggleDeepThinking: suggestions.toggleDeepThinking,
    toggleSmartSearch: suggestions.toggleSmartSearch,
    triggerDeepThinking,
    triggerSearch: suggestions.triggerSearch,
    // 行为附加
    inputBehavior: behavior.inputBehavior,
    // 附件
    ...attachments,
    // 麦克风
    showMic: false,
    setShowMic: () => {},
    // 键盘
    handleKeyDown: keyboard.handleKeyDown,
    // 清除
    clearAll,
  }
}
