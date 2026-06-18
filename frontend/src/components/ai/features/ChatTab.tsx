/**
 * ChatTab - 智能对话主容器组件 (v11.0)
 *
 * v11.0 重构 (2026-06-07):
 * ✅ AI 引擎剥离至 useChatTabOrchestrator
 * ✅ 消息发送流水线剥离至 useChatSendMessage
 * ✅ 会话管理回调剥离至 useChatCallbacks
 * ✅ 行数从 1109 降至 ~300
 *
 * 核心职责：
 * - 组合自定义 Hooks 获取状态和方法
 * - 配置 Context Providers 和 ErrorBoundary
 * - 渲染 JSX 布局结构
 * - 委托事件处理给子组件
 *
 * @version 11.0.0
 * @lastUpdated 2026-06-07
 * @author RMFOOD Team
 */

import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18nInstance from 'i18next'
import { useQuery } from '@tanstack/react-query'
import { ModelClient } from '@/api/modelClient'
import { logger } from '@/utils/safeLogger'

// ===== v11.0: 编排 Hooks =====
import { useChatTabOrchestrator } from './hooks/useChatTabOrchestrator'
import { useChatSendMessage } from './hooks/useChatSendMessage'
import { useChatCallbacks } from './hooks/useChatCallbacks'
import { useRAGContext } from '@/hooks/useRAGContext'

// ===== Pro 组件 =====
import { ChatMessages, ChatInputPro, ChatHistory, loadSessions, type HistorySession } from './components/pro'
import ChatSidebarV4, { type SidebarStepV4, type AlgorithmType } from './components/pro/ChatSidebarV4'
import MarkdownRenderer from './components/pro/MarkdownRenderer'

// ===== 自定义 Hooks =====
import { useChatMessages } from './hooks/useChatMessages'
import { useFormulaManager } from './hooks/useFormulaManager'
import { useReportGenerator } from './hooks/useReportGenerator'
import { useExportManager } from './hooks/useExportManager'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// ===== UI 子组件 =====
import { FormulaPanel } from './components/FormulaPanel'
import { ErrorBoundary } from './components/ErrorBoundary'

// ===== 视觉设计系统 =====
import './styles/chatTheme.css'
import { useChatTheme } from './hooks/useChatTheme'
import { scenarioSwitcher } from './services/scenarioSwitcher'
import type { ScenarioMode } from './services/scenarioSwitcher'

// ===== UI 组件导入 =====
import { Button, Card } from '@/components/ui'

// ===== 专业内容组件 =====
import { ProfessionalReport as ProfessionalReportModal } from '@/components/ai/components/ProfessionalReport'
import { EnhancedDataTable } from '@/components/ai/components/EnhancedDataTable'
import { RAGSourcesBanner } from '@/components/ai/rag/RAGSourcesBanner'

// ===== 配置和常量 =====
import { QUICK_QUESTIONS, MODEL_EXPERTS as _MODEL_EXPERTS } from '@/config/ai'
import { ERROR_MESSAGES as _ERROR_MESSAGES } from '@/config'

// ===== 图标库 =====
import { Brain, AlertTriangle, X, FlaskConical, MessageSquare, Pause, Play, Palette, Database, GraduationCap, Shield, Wrench, Zap } from 'lucide-react'

// ===== 类型定义 =====
interface ChatTabProps {
  onMessageSend?: (message: string) => void
}

/**
 * ChatTab - 纯布局组装组件 (v11.0)
 */
export function ChatTab({ }: ChatTabProps) {
  // ===== i18n (带 fallback 的安全翻译) =====
  const { t } = useTranslation()
  const reportedKeysRef = useRef<Set<string>>(new Set())
  const safeT = (key: string, fallback?: string): string => {
    const result = t(key)
    if (result === key || !result) {
      // react-i18next 绑定层可能无法解析深层嵌套键，回退到原生 i18n.t()
      const nativeResult = i18nInstance.t(key)
      if (nativeResult && nativeResult !== key) {
        return nativeResult
      }
      if (process.env.NODE_ENV === 'development' && !reportedKeysRef.current.has(key)) {
        reportedKeysRef.current.add(key)
        console.warn(`[ChatTab] i18n key not translated: "${key}", using fallback: "${fallback || key}"`)
      }
      return fallback || key
    }
    return result
  }

  // ===== 1. 核心 Hooks =====
  const chatMessages = useChatMessages()
  const {
    messages, input, setInput, isStreaming, setIsStreaming, chatError, setChatError,
    clearMessages, addMessage, updateMessage,
    retryLastMessage, clearError, isPaused, pauseStreaming, resumeStreaming,
  } = chatMessages

  // ===== v11.0: 引擎编排 =====
  const orchestrator = useChatTabOrchestrator()

  // 后端 thinking_steps → 前端思维可视化同步
  const prevMsgCountRef = React.useRef(messages.length)
  React.useEffect(() => {
    if (messages.length <= prevMsgCountRef.current) return
    const newMsgs = messages.slice(prevMsgCountRef.current)
    prevMsgCountRef.current = messages.length
    const lastAssistant = [...newMsgs].reverse().find(m => m.role === 'assistant' && !m.isLoading)
    if (lastAssistant) {
      const msg = lastAssistant as any
      if (msg.thinking_steps && Array.isArray(msg.thinking_steps) && msg.thinking_steps.length > 0) {
        orchestrator.thinkingProcessV3.loadExternalSteps(msg.thinking_steps, msg.content)
      }
    }
  }, [messages, orchestrator.thinkingProcessV3])

  // ===== RAG 知识库上下文 =====
  const rag = useRAGContext()

  // ===== v11.0: 消息发送流水线（含 RAG 增强）=====
  const chatHook = useChatSendMessage(chatMessages, {
    orchestrator,
    ragAugment: rag.augment,
  })

  const { exportMessages } = useExportManager()

  const {
    formulas, formulaIndex, formulaCount, expandedIds, selectedIds,
    selectedForDetail, isDetailModalOpen, toggleExpand, selectFormula, selectAll,
    batchDelete, batchExport, batchTag, showDetailTable, closeDetailTable,
    importFormulas, exportFormulas: handleExportFormulas, clearAllFormulas,
  } = useFormulaManager()

  const {
    handleGenerateReport, reportData, isGeneratingReport,
    showReportModal, setShowModal: setShowReportModal, clearReport,
  } = useReportGenerator(formulaIndex)

  // ===== 视觉主题系统 =====
  const { scheme, cycleScheme, schemeInfo } = useChatTheme()

  // ===== 2. 模式状态管理 =====
  const [deepThinking, setDeepThinking] = useState(false)
  const [smartSearch, setSmartSearch] = useState(false)
  // Phase 4: 场景模式状态（与 scenarioSwitcher 单例同步）
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>(scenarioSwitcher.getCurrentMode())

  const handleDeepThinkingChange = useCallback((enabled: boolean) => {
    setDeepThinking(enabled)
    if (enabled) setSmartSearch(false)
    logger.debug('[ChatTab] 深度思考模式:', { enabled })
  }, [])

  const handleSmartSearchChange = useCallback((enabled: boolean) => {
    setSmartSearch(enabled)
    if (enabled) setDeepThinking(false)
    logger.debug('[ChatTab] 智能搜索模式:', { enabled })
  }, [])

  // Phase 4: 场景模式切换处理
  const handleScenarioSwitch = useCallback((mode: ScenarioMode) => {
    const result = scenarioSwitcher.switchTo(mode, 'user_selected')
    if (result) {
      setScenarioMode(result.newMode)
      logger.info(`[ChatTab] 场景切换: ${result.previousMode} → ${result.newMode}`)
    }
  }, [])

  // ===== 3. 全局状态查询 =====
  const { data: modelStatus } = useQuery({
    queryKey: ['ai-model-status'],
    queryFn: ModelClient.getModelStatus,
    refetchOnMount: true,
    gcTime: 0,
    staleTime: 0,
    retry: 1,
  })
  const llmAvailable = modelStatus?.llm?.status === 'active'
  const llmModel = modelStatus?.llm?.model ?? ''

  const [showFormulaList, setShowFormulaList] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null)

  // ===== 对话历史状态 =====
  const [historySessions, setHistorySessions] = React.useState<HistorySession[]>(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(() => {
    const sessions = loadSessions()
    return sessions.length > 0 ? sessions[0].id : null
  })
  const [historyVisible, setHistoryVisible] = React.useState(false)

  // ===== v11.0: 会话管理回调 =====
  const callbacks = useChatCallbacks({
    historySessions, setHistorySessions, setActiveSessionId,
    historyVisible, setHistoryVisible,
    clearMessages,
    clearAllFormulas,
    clearWorkingMemory: orchestrator.workingMemory.clearMemory,
    clearMultiTurnDialogue: orchestrator.multiTurnDialogue.clearDialogue,
    clearShortTermMemory: orchestrator.shortTermMemory.clearMemory,
    messages,
    setMessages: chatMessages.replaceMessages,
    activeSessionId,
  })

  // ===== 4. 键盘快捷键配置 =====
  useKeyboardShortcuts({
    onSend: () => handleSendMessage(),
    onCancel: () => handleCancel(),
    onExport: () => exportMessages(messages),
    onNewChat: callbacks.handleClearChat,
    disabled: isStreaming,
  } as any)

  // ===== 5. 事件处理器 =====
  const handleSendMessage = useCallback(async (passedContent?: string) => {
    const contentToSend = (passedContent || input).trim()
    if (!contentToSend || isStreaming) return
    try {
      await chatHook.handleSendMessage(contentToSend)
      // 更新当前会话元数据（消息数、最后消息预览）
      if (activeSessionId) {
        callbacks.updateSessionMetadata(activeSessionId, chatMessages.messages)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[ChatTab] ❌ Message send failed:', { error: errorMessage })
      setChatError(error instanceof Error ? error : new Error('发送失败'))
    }
  }, [input, isStreaming, chatHook.handleSendMessage, setChatError, activeSessionId, callbacks.updateSessionMetadata, chatMessages.messages])

  const handleRetry = useCallback(async () => {
    logger.debug('[ChatTab] 🔄 重试最后一条消息')
    await retryLastMessage()
  }, [retryLastMessage])

  const handleCancel = useCallback(() => {
    if (showReportModal) {
      setShowReportModal(false)
      logger.debug('[ChatTab] ❌ 关闭报告弹窗')
    }
    if (isDetailModalOpen) {
      closeDetailTable()
      logger.debug('[ChatTab] ❌ 关闭详情表格')
    }
    if (showFormulaList) {
      setShowFormulaList(false)
      logger.debug('[ChatTab] ❌ 关闭配方列表')
    }
    if (chatError) {
      clearError()
      logger.debug('[ChatTab] ❌ 清除错误状态')
    }
  }, [showReportModal, setShowReportModal, isDetailModalOpen, closeDetailTable, showFormulaList, setShowFormulaList, chatError, clearError])

  // ===== 6. 配方操作回调（简洁委托）=====
  const handleToggleExpand = useCallback((id: string) => toggleExpand(id), [toggleExpand])
  const handleShowDetail = useCallback((id: string) => {
    showDetailTable(id)
    setHighlightedMessageId(null)
  }, [showDetailTable, setHighlightedMessageId])
  const handleGenerateReportFromFormula = useCallback((formulaId?: string) => handleGenerateReport(formulaId), [handleGenerateReport])

  const handleExportData = useCallback(async (format: string) => {
    await handleExportFormulas(format as any)
  }, [handleExportFormulas])

  const handleImportData = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        importFormulas(data)
        logger.debug('[ChatTab] 📥 配方导入成功')
      } catch (error) {
        logger.error('[ChatTab] ❌ 配方导入失败:', error)
      }
    }
    input.click()
  }, [importFormulas])

  const handleToggleSelect = useCallback((id: string) => {
    const isSelected = selectedIds.has(id)
    selectFormula(id, !isSelected)
  }, [selectedIds, selectFormula])

  const handleBatchExport = useCallback((format: 'json' | 'csv' | 'excel' | 'pdf') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    batchExport(ids, format)
  }, [selectedIds, batchExport])

  const handleBatchDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    batchDelete(ids)
  }, [selectedIds, batchDelete])

  const handleBatchTag = useCallback((tags: string[]) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || tags.length === 0) return
    batchTag(ids, tags)
  }, [selectedIds, batchTag])

  const handleSelectAll = useCallback(() => {
    selectAll()
  }, [selectAll])

  // ===== 7. JSX 布局组装（主体）=====
  return (
    <ErrorBoundary>
      <div className={`flex h-full relative chat-theme-${scheme} chat-area`}>
        {/* D-1: 对话历史侧栏 */}
        <ChatHistory
          sessions={historySessions}
          activeSessionId={activeSessionId}
          onNewChat={callbacks.handleNewSession}
          onSelectSession={callbacks.handleSelectSession}
          onDeleteSession={callbacks.handleDeleteSession}
          onRenameSession={callbacks.handleRenameSession}
          isVisible={historyVisible}
          onToggle={() => setHistoryVisible(v => !v)}
        />

        {/* 主内容区 */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* 顶部栏：模型状态 + 配方计数 */}
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-tertiary)] dark:from-gray-900 dark:to-gray-800">
            <div className="flex items-center gap-3 group">
              {/* AI头像 */}
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25 transition-transform duration-200 group-hover:scale-110">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                {llmAvailable && (
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-md" />
                )}
              </div>
              {/* 标题区域 */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                  {safeT('ai.chat.chatTab.title', '智能对话')}
                </span>
                {/* 模型状态徽章 */}
                <span className={`
                  px-2.5 py-1 rounded-full text-xs font-medium
                  ${llmAvailable
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }
                `}>
                  {llmModel}
                </span>
              </div>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-3">
              {/* D-1: 对话历史切换按钮 */}
              <button
                onClick={() => setHistoryVisible(v => !v)}
                aria-label="对话历史"
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 ${
                  historyVisible
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700'
                }`}
                title="对话历史"
              >
                <MessageSquare className="w-4 h-4" />
                {historySessions.length > 0 && (
                  <span className="text-xs font-medium">{historySessions.length}</span>
                )}
              </button>

              {/* 主题切换按钮 */}
              <button
                onClick={cycleScheme}
                aria-label="切换主题"
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 active:bg-gray-100 dark:active:bg-gray-700"
                title={`切换主题: ${schemeInfo?.nameCN || scheme}`}
              >
                <Palette className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{schemeInfo?.nameCN || scheme}</span>
              </button>

              {/* RAG 知识库开关 */}
              <button
                onClick={rag.toggleRAG}
                aria-label="RAG知识库"
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 ${
                  rag.isEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300 dark:hover:border-emerald-600 active:bg-gray-100 dark:active:bg-gray-700'
                }`}
                title={rag.isEnabled ? '知识库检索已开启' : '知识库检索已关闭'}
              >
                <Database className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">
                  {rag.isEnabled ? '知识库' : '知识库'}
                </span>
                {rag.hasActiveChunks && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* 配方计数徽章 */}
              <button
                onClick={() => setShowFormulaList(true)}
                aria-label="已生成配方数"
                className="relative flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 hover:shadow-md active:scale-95"
                title={`${formulaCount} 个配方`}
              >
                <FlaskConical className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{formulaCount}</span>
                {formulaCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Phase 4: 场景模式切换器 */}
              <div role="radiogroup" aria-label="场景模式" className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-0.5">
                {([
                  { mode: 'academician' as ScenarioMode, icon: GraduationCap, label: '学者顾问', color: 'text-blue-600 dark:text-blue-400 active:bg-blue-100 dark:active:bg-blue-900/30' },
                  { mode: 'safety_off' as ScenarioMode, icon: Shield, label: '安全专员', color: 'text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-900/30' },
                  { mode: 'process_eng' as ScenarioMode, icon: Wrench, label: '工艺工程师', color: 'text-orange-600 dark:text-orange-400 active:bg-orange-100 dark:active:bg-orange-900/30' },
                  { mode: 'concise_adv' as ScenarioMode, icon: Zap, label: '精简顾问', color: 'text-emerald-600 dark:text-emerald-400 active:bg-emerald-100 dark:active:bg-emerald-900/30' },
                ]).map(({ mode, icon: Icon, label, color }) => (
                  <button
                    key={mode}
                    role="radio"
                    aria-checked={scenarioMode === mode}
                    onClick={() => handleScenarioSwitch(mode)}
                    title={label}
                    className={`flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-md transition-all duration-200 active:scale-95 ${
                      scenarioMode === mode
                        ? `${color} bg-white dark:bg-gray-700 shadow-sm scale-105`
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* 清除按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={callbacks.handleClearChat}
                disabled={messages.length === 0}
                className="h-8 px-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              >
                <X className="w-4 h-4 mr-1" />
                {safeT('ai.chat.chatTab.clear', '清空')}
              </Button>
            </div>
          </div>

          {/* 主内容区：消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatError && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">{safeT('ai.chat.chatTab.chatError', '对话出错')}</p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">{chatError instanceof Error ? chatError.message : String(chatError)}</p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={handleRetry}>{safeT('ai.chat.chatTab.retry', '重试')}</Button>
                      <Button variant="ghost" size="sm" onClick={clearError}>{safeT('ai.chat.chatTab.close', '关闭')}</Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* RAG 知识库来源横幅 */}
            <RAGSourcesBanner
              isEnabled={rag.isEnabled}
              chunks={rag.chunks}
              sources={rag.lastSources}
              onDismiss={rag.clearChunks}
            />

            {/* 空状态欢迎引导 */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] max-w-2xl mx-auto w-full animate-[fadeInUp_0.5s_ease-out]">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                    <Brain className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {safeT('ai.chat.chatTab.welcomeTitle', '欢迎使用智能配方助手')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {safeT('ai.chat.chatTab.welcomeSubtitle', '选择下方问题快速开始，或直接输入您的配方需求')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  {QUICK_QUESTIONS.filter(q => q.popular).slice(0, 3).map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleSendMessage(q.question)}
                      className="group/card flex flex-col items-start p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
                    >
                      <span className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-1.5">{q.category}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed group-hover/card:text-gray-900 dark:group-hover/card:text-white transition-colors">
                        {q.question}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              chatError={chatError}
              onRetry={handleRetry}
              onClear={callbacks.handleClearChat}
              onGenerateReport={() => handleGenerateReport()}
              showReportButton={formulaCount > 0}
              highlightedMessageId={highlightedMessageId}
              selectedMessageIds={[]}
              onSelectMessage={(id) => {}}
              onReferenceMessage={(msg) => {}}
            />

            {/* 思考过程侧栏 V4 — 算法感知 */}
            <ChatSidebarV4
              steps={orchestrator.thinkingProcessV3.state.steps.map(s => {
                // 基于步骤名自动识别算法类型
                const stepName = s.title
                let algorithm: AlgorithmType = 'rule-engine'
                if (/理解|意图|NLP|识别/.test(stepName)) algorithm = 'hybrid-nlp'
                else if (/检索|搜索|查找|知识/.test(stepName)) algorithm = 'semantic-search'
                else if (/推理|分析|评估|预测/.test(stepName)) algorithm = 'llm'
                else if (/设计|生成|优化|配方/.test(stepName)) algorithm = 'bayesian'
                else if (/回答|整合|结论/.test(stepName)) algorithm = 'ensemble'

                return {
                  step: stepName,
                  content: s.description,
                  status: (s.status === 'completed' ? 'complete'
                    : s.status === 'processing' ? 'thinking'
                    : 'pending') as SidebarStepV4['status'],
                  detail: s.details || s.description,
                  algorithm,
                  confidence: s.confidence || 0.85,
                }
              })}
              isThinking={orchestrator.thinkingProcessV3.state.isThinking}
              isVisible={orchestrator.thinkingProcessV3.state.isVisible}
              onToggle={orchestrator.thinkingProcessV3.toggleVisibility}
            />
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="max-w-4xl mx-auto px-3 py-2 space-y-2">
              {/* 暂停/继续控制栏 */}
              {(isStreaming || isPaused) && (
                <div className="flex items-center justify-center pt-1">
                  <button
                    onClick={isPaused ? resumeStreaming : pauseStreaming}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                      transition-all duration-200
                      ${isPaused
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                      }
                    `}
                  >
                    {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {isPaused ? safeT('ai.chat.chatTab.resume', '继续生成') : safeT('ai.chat.chatTab.pause', '暂停生成')}
                  </button>
                </div>
              )}
            </div>
            <ChatInputPro
              value={input}
              onChange={setInput}
              onSend={() => handleSendMessage()}
              onStop={() => pauseStreaming()}
              isStreaming={isStreaming}
              maxLength={2000}
              placeholder={safeT('ai.chat.chatTab.placeholder', '描述您的配方需求，例如：设计一款低糖饮料的甜味剂方案...')}
              modelName={llmModel || 'deepseek-chat'}
              onModelChange={(model) => logger.debug('[ChatTab] Model changed:', model)}
              charCount={input.length}
            />
          </div>

          {/* 配方面板模态框 */}
          {showFormulaList && (
            <FormulaPanel
              formulas={formulas}
              formulaCount={formulaCount}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              searchQuery={searchQuery}
              onToggleExpand={handleToggleExpand}
              onToggleSelect={handleToggleSelect}
              onShowDetail={handleShowDetail}
              onGenerateReport={handleGenerateReportFromFormula}
              onExport={handleExportData}
              onImport={handleImportData}
              onClearStorage={clearAllFormulas}
              onClearMemory={clearAllFormulas}
              isGeneratingReport={isGeneratingReport}
              onClose={() => setShowFormulaList(false)}
              onBatchExport={handleBatchExport}
              onBatchDelete={handleBatchDelete}
              onBatchTag={handleBatchTag}
              onSelectAll={handleSelectAll}
            />
          )}

          {/* 报告预览模态框 */}
          {showReportModal && reportData && (
            <ProfessionalReportModal
              report={reportData}
              onClose={() => {
                setShowReportModal(false)
                clearReport()
              }}
            />
          )}

          {/* 详细数据表格模态框 */}
          {isDetailModalOpen && selectedForDetail && (
            <EnhancedDataTable
              data={(selectedForDetail as any).ingredients || []}
              visible={isDetailModalOpen}
              onClose={closeDetailTable}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default ChatTab
