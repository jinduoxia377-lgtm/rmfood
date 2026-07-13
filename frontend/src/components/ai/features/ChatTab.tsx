/**
 * ChatTab - 智能对话主容器组件 (v12.0)
 *
 * v12.0 重构 (2026-07-06):
 * ✅ 顶栏/空状态/场景切换/主题切换全部提取为独立组件
 * ✅ 配方操作回调提取为 useFormulaActions Hook
 * ✅ 编辑/撤回消息逻辑提取为 useMessageEditing Hook
 * ✅ i18n safeT 提取为 useSafeTranslation Hook
 * ✅ 行数从 913 降至 ~280
 *
 * 核心职责：
 * - 组合自定义 Hooks 获取状态和方法
 * - 渲染 JSX 布局结构（委托给 TopBar/EmptyStateCard）
 * - 委托事件处理给子组件
 *
 * @version 12.0.0
 * @lastUpdated 2026-07-06
 * @author RMFOOD Team
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModelClient } from '@/api/modelClient'
import { logger } from '@/utils/safeLogger'

// ===== v11.0: 编排 Hooks =====
import { useChatTabOrchestrator } from './hooks/useChatTabOrchestrator'
import { useChatSendMessage } from './hooks/useChatSendMessage'
import { useChatCallbacks } from './hooks/useChatCallbacks'
import { useRAGContext } from '@/hooks/useRAGContext'

// ===== 新提取 Hooks =====
import { useSafeTranslation } from './hooks/useSafeTranslation'
import { useFormulaActions } from './hooks/useFormulaActions'
import { useMessageEditing } from './hooks/useMessageEditing'
import { useChatHandlers } from './hooks/useChatHandlers'

// ===== 核心 Hooks =====
import { useChatMessages } from './hooks/useChatMessages'
import { useFormulaManager } from './hooks/useFormulaManager'
import { useReportGenerator } from './hooks/useReportGenerator'
import { useExportManager } from './hooks/useExportManager'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { BackendThinkingStep } from './hooks/useThinkingProcessV3'

// ===== Pro 组件 =====
import { ChatMessages, ChatInputPro, ChatHistory, loadSessions, type HistorySession } from './components/pro'
import ChatSidebarV4, { type SidebarStepV4, type AlgorithmType } from './components/pro/ChatSidebarV4'
import { TopBar, EmptyStateCard } from './components/pro'

// ===== UI 子组件 =====
import { FormulaPanel } from './components/FormulaPanel'
import { ErrorBoundary } from './components/ErrorBoundary'

// ===== 视觉设计系统 =====
import { useChatTheme } from './hooks/useChatTheme'
import { scenarioSwitcher } from './services/scenarioSwitcher'
import type { ScenarioMode } from './services/scenarioSwitcher'

// ===== UI 组件 =====
import { Button } from '@/components/ui'

// ===== 专业内容组件 =====
import { ProfessionalReport as ProfessionalReportModal } from '@/components/ai/components/ProfessionalReport'
import { EnhancedDataTable } from '@/components/ai/components/EnhancedDataTable'
import type { EnhancedIngredient } from '@/types/ai.types'

// ===== 图标库 =====
import {
  AlertTriangle, Play, Pause,
  Brain, MessageSquare, Palette, Database, FlaskConical,
  X, GraduationCap, Shield, Wrench, Zap, Loader2,
} from 'lucide-react'

// ===== 配置 =====
import { QUICK_QUESTIONS } from '@/config/ai'

// ===== 类型 =====
import type { ChatMessage } from './types'

// ===== RAG / UI =====
import { RAGSourcesBanner } from '@/components/ai/rag/RAGSourcesBanner'
import { Card } from '@/components/ui'

interface ChatTabProps {
  onMessageSend?: (message: string) => void
  onBatchExport?: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete?: (ids: string[]) => void
  onBatchTag?: (ids: string[], tags: string[]) => void
  onSelectAll?: () => void
  onToggleSelect?: (id: string, sel?: boolean) => void
  onImport?: (data: unknown[]) => void
}

/**
 * ChatTab - 纯布局组装组件 (v12.0)
 * 所有业务逻辑均已提取至独立 Hooks 和组件
 */
export function ChatTab({ onBatchExport, onBatchDelete, onBatchTag, onSelectAll: propsSelectAll, onToggleSelect: propsToggleSelect, onImport: propsImport }: ChatTabProps) {
  // ===== 1. 安全翻译 =====
  const safeT = useSafeTranslation()

  // ===== 2. 核心状态 Hooks =====
  const chatMessages = useChatMessages()
  const {
    messages, input, setInput, isStreaming, setIsStreaming,
    chatError, setChatError, clearMessages, addMessage, updateMessage,
    retryLastMessage, clearError, isPaused, pauseStreaming, resumeStreaming,
  } = chatMessages

  // ===== 3. 引擎编排 =====
  const orchestrator = useChatTabOrchestrator()
  orchestrator.scenarioSwitcher.setAutoSwitch(false)

  // 后端 thinking_steps → 前端思维可视化同步
  const prevMsgCountRef = useRef(messages.length)
  useEffect(() => {
    if (messages.length <= prevMsgCountRef.current) return
    const newMsgs = messages.slice(prevMsgCountRef.current)
    prevMsgCountRef.current = messages.length
    const lastAssistant = [...newMsgs].reverse().find((m) => m.role === 'assistant' && !m.isLoading)
    if (lastAssistant) {
      const msg = lastAssistant as { role: string; content: string; isLoading?: boolean; thinking_steps?: BackendThinkingStep[] }
      if (msg.thinking_steps && Array.isArray(msg.thinking_steps) && msg.thinking_steps.length > 0) {
        orchestrator.thinkingProcessV3.loadExternalSteps(msg.thinking_steps, msg.content)
      }
    }
  }, [messages, orchestrator.thinkingProcessV3])

  // ===== 4. 全局状态 =====
  const { data: modelStatus } = useQuery({
    queryKey: ['ai-model-status'],
    queryFn: ModelClient.getModelStatus,
    refetchOnMount: true, gcTime: 0, staleTime: 0, retry: 1,
  })
  const llmAvailable = modelStatus?.llm?.status === 'active'
  const llmModel = modelStatus?.llm?.model ?? ''

  // ===== 5. RAG 上下文 =====
  const rag = useRAGContext()

  // ===== 6. 消息发送流水线 =====
  const chatHook = useChatSendMessage(chatMessages, {
    orchestrator, ragAugment: rag.augment, llmAvailable,
  })
  const { exportMessages } = useExportManager()

  // ===== 7. 配方管理 =====
  const {
    formulas, formulaIndex, formulaCount, expandedIds, selectedIds,
    selectedForDetail, isDetailModalOpen, toggleExpand, selectFormula,
    selectAll, batchDelete, batchExport, batchTag, showDetailTable,
    closeDetailTable, importFormulas, exportFormulas: handleExportFormulas,
    clearAllFormulas,
  } = useFormulaManager()

  // ===== 8. 报告生成 =====
  const {
    handleGenerateReport, reportData, isGeneratingReport,
    showReportModal, setShowModal: setShowReportModal, clearReport,
  } = useReportGenerator(formulaIndex)

  // ===== 9. 主题系统 =====
  const { scheme, cycleScheme, schemeInfo } = useChatTheme()

  // ===== 10. 模式状态 =====
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>(scenarioSwitcher.getCurrentMode())

  useEffect(() => {
    ;window.__SCENARIO_MODE__ = scenarioSwitcher.getCurrentMode()
  }, [])

  const handleScenarioSwitch = useCallback((mode: ScenarioMode) => {
    const result = scenarioSwitcher.switchTo(mode, 'user_selected')
    if (result) {
      setScenarioMode(result.newMode)
      ;window.__SCENARIO_MODE__ = result.newMode
      logger.info(`[ChatTab] 场景切换: ${result.previousMode} → ${result.newMode}`)
    }
  }, [])

  // ===== 11. 会话管理 =====
  const [historySessions, setHistorySessions] = useState<HistorySession[]>(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const sessions = loadSessions()
    return sessions.length > 0 ? sessions[0].id : null
  })
  const [historyVisible, setHistoryVisible] = React.useState(false)

  const callbacks = useChatCallbacks({
    historySessions, setHistorySessions, setActiveSessionId,
    historyVisible, setHistoryVisible, clearMessages, clearAllFormulas,
    clearWorkingMemory: () => {},
    clearMultiTurnDialogue: orchestrator.multiTurnDialogue.clearDialogue,
    clearShortTermMemory: () => {},
    messages, setMessages: chatMessages.replaceMessages, activeSessionId,
  })

  // ===== 12. 键盘快捷键 =====
  useKeyboardShortcuts({ disabled: isStreaming })

  // ===== 13. 消息编辑 Hook =====
  const messageEditing = useMessageEditing({
    messages, editMessage: chatMessages.editMessage,
    removeMessage: chatMessages.removeMessage,
    retractMessage: chatMessages.retractMessage,
    sendMessage: async (content: string) => {
      await chatHook.handleSendMessage(content)
    },
  })

  // ===== 15. 本地状态 =====
  const [showFormulaList, setShowFormulaList] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null)

  // ===== 16. 聊天事件处理 =====
  const chatHandlers = useChatHandlers({
    input, isStreaming, activeSessionId, chatError, setChatError, clearError,
    retryLastMessage, handleSendMessage: chatHook.handleSendMessage,
    updateSessionMetadata: callbacks.updateSessionMetadata, messages,
    showReportModal: showReportModal, setShowReportModal: setShowReportModal,
    isDetailModalOpen, closeDetailTable,
    showFormulaList, setShowFormulaList,
  })

  // ===== 17. 提取的 Hooks =====
  const formulaActions = useFormulaActions({
    formulas, selectedIds, selectedForDetail, expandedIds, formulaCount,
    isDetailModalOpen,
    onToggleExpand: toggleExpand, onShowDetail: showDetailTable, onCloseDetail: closeDetailTable,
    onGenerateReport: handleGenerateReport, onExport: handleExportFormulas,
    onClearStorage: clearAllFormulas,
    onBatchExport: onBatchExport ?? (() => {}),
    onBatchDelete: onBatchDelete ?? (() => {}),
    onBatchTag: onBatchTag ?? (() => {}),
    onSelectAll: selectAll,
    onToggleSelect: (id, sel) => selectFormula(id, sel ?? false),
    onImport: importFormulas,
  })

  // ===== 17. JSX 布局 =====
  return (
    <ErrorBoundary>
      <div className={`flex h-full relative chat-theme-${scheme} chat-area`}>
        {/* 对话历史侧栏 */}
        <ChatHistory
          sessions={historySessions}
          activeSessionId={activeSessionId}
          onNewChat={callbacks.handleNewSession}
          onSelectSession={callbacks.handleSelectSession}
          onDeleteSession={callbacks.handleDeleteSession}
          onRenameSession={callbacks.handleRenameSession}
          isVisible={historyVisible}
          onToggle={() => setHistoryVisible((v) => !v)}
        />

        {/* 主内容区 */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* 顶栏（模型状态 + 操作按钮 + RAG + 场景切换） */}
          <TopBar
            llmAvailable={llmAvailable}
            llmModel={llmModel}
            scenarioMode={scenarioMode}
            scenarioDisplayName={scenarioSwitcher.getCurrentScenario().displayName}
            onScenarioSwitch={handleScenarioSwitch}
            historyVisible={historyVisible}
            historySessions={historySessions}
            onToggleHistory={callbacks.toggleHistory}
            scheme={scheme}
            schemeNameCN={schemeInfo?.nameCN}
            onCycleScheme={cycleScheme}
            ragEnabled={rag.isEnabled}
            ragHasActiveChunks={rag.hasActiveChunks}
            ragIsSeeded={rag.isSeeded}
            ragIsSeeding={rag.isSeeding}
            onToggleRAG={rag.toggleRAG}
            onTriggerSeed={rag.triggerSeed}
            formulaCount={formulaCount}
            onShowFormulaList={() => setShowFormulaList(true)}
            messageCount={messages.length}
            onClearChat={callbacks.handleClearChat}
            t={safeT}
          />

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 错误提示 */}
            {chatError && (
              <Card className="p-4 bg-error-50 dark:bg-error-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-error-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-error-800 dark:text-error-200">{safeT('ai.chat.chatTab.chatError', '对话出错')}</p>
                    <p className="text-xs text-error-600 dark:text-error-300 mt-1">{chatError instanceof Error ? chatError.message : String(chatError)}</p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={chatHandlers.handleRetry}>{safeT('ai.chat.chatTab.retry', '重试')}</Button>
                      <Button variant="ghost" size="sm" onClick={clearError}>{safeT('ai.chat.chatTab.close', '关闭')}</Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* RAG 来源横幅 */}
            <RAGSourcesBanner isEnabled={rag.isEnabled} chunks={rag.chunks} sources={rag.lastSources} onDismiss={rag.clearChunks} />

            {/* 空状态欢迎引导 */}
            {messages.length === 0 && (
              <EmptyStateCard
                welcomeTitle={safeT('ai.chat.chatTab.welcomeTitle', '欢迎使用智能配方助手')}
                welcomeSubtitle={safeT('ai.chat.chatTab.welcomeSubtitle', '选择下方问题快速开始，或直接输入您的配方需求')}
                questions={QUICK_QUESTIONS}
                onAsk={chatHandlers.handleSend}
              />
            )}

            {/* 消息列表 */}
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              chatError={chatError}
              onRetry={chatHandlers.handleRetry}
              onClear={callbacks.handleClearChat}
              onGenerateReport={() => handleGenerateReport()}
              showReportButton={formulaCount > 0}
              highlightedMessageId={highlightedMessageId}
              selectedMessageIds={[]}
              onSelectMessage={() => {}}
              onReferenceMessage={() => {}}
              onEditMessage={messageEditing.handleEditMessage}
              onRetractMessage={messageEditing.handleRetractMessage}
            />

            {/* 思考过程侧栏 V4 */}
            <ChatSidebarV4
              steps={orchestrator.thinkingProcessV3.state.steps.map((s) => {
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
                  status: (s.status === 'completed' ? 'complete' : s.status === 'processing' ? 'thinking' : 'pending') as SidebarStepV4['status'],
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
          <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <div className="max-w-4xl mx-auto px-3 py-2 space-y-2">
              {(isStreaming || isPaused) && (
                <div className="flex items-center justify-center pt-1">
                  <button
                    onClick={isPaused ? resumeStreaming : pauseStreaming}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      isPaused
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400 hover:bg-warning-100 dark:hover:bg-warning-900/30 border border-amber-200 dark:border-amber-800'
                    }`}
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
              onSend={() => chatHandlers.handleSend()}
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
              onToggleExpand={formulaActions.handleToggleExpand}
              onToggleSelect={formulaActions.handleToggleSelect}
              onShowDetail={formulaActions.handleShowDetail}
              onGenerateReport={formulaActions.handleGenerateReportFromFormula}
              onExport={formulaActions.handleExportData}
              onImport={formulaActions.handleImportData}
              onClearStorage={clearAllFormulas}
              onClearMemory={clearAllFormulas}
              isGeneratingReport={isGeneratingReport}
              onClose={() => setShowFormulaList(false)}
              onBatchExport={formulaActions.handleBatchExport}
              onBatchDelete={formulaActions.handleBatchDelete}
              onBatchTag={formulaActions.handleBatchTag}
              onSelectAll={formulaActions.handleSelectAll}
            />
          )}

          {/* 报告预览模态框 */}
          {showReportModal && reportData && (
            <ProfessionalReportModal
              report={reportData}
              onClose={() => { setShowReportModal(false); clearReport() }}
            />
          )}

          {/* 详细数据表格模态框 */}
          {isDetailModalOpen && selectedForDetail && (
            <EnhancedDataTable
              data={(selectedForDetail as unknown as { ingredients?: EnhancedIngredient[] }).ingredients || []}
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
