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
import { useScenarioStore } from '@/stores/scenarioStore'

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
import { TopBar, EmptyStateCard } from './components/pro'
import ComposerStatusBar from './components/pro/ComposerStatusBar'
import DetailsPanel from './components/pro/DetailsPanel'
import type { DraftAttachment } from './components/pro/ChatInput'

// ===== UI 子组件 =====
import { FormulaPanel } from './components/FormulaPanel'
import { ErrorBoundary } from './components/ErrorBoundary'

// ===== 视觉设计系统 =====
import { useChatTheme } from './hooks/useChatTheme'
import { scenarioSwitcher } from './services/scenarioSwitcher'
import type { ScenarioMode } from './services/scenarioSwitcher'
import { sessionCapability } from './capabilities/session/SessionCapability'

// ===== UI 组件 =====
import { Button } from '@/components/ui'

// ===== 专业内容组件 =====
import { ProfessionalReport as ProfessionalReportModal } from '@/components/ai/components/ProfessionalReport'
import { EnhancedDataTable } from '@/components/ai/components/EnhancedDataTable'
import type { EnhancedIngredient } from '@/types/ai.types'

// ===== 图标库 =====
import {
  AlertTriangle, Play, Pause, Leaf, Database,
} from 'lucide-react'

// ===== 配置 =====
import { QUICK_QUESTIONS } from '@/config/ai'

// ===== 类型 =====
import type { ChatMessage } from './types'

// ===== RAG / UI =====
import { RAGSourcesBanner } from '@/components/ai/rag/RAGSourcesBanner'
import { RAGKnowledgePanel } from './components/RAGKnowledgePanel'
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
  // 使用 stable ref 避免并发消息时的竞态条件
  const lastProcessedMsgCountRef = useRef(0)
  useEffect(() => {
    const currentCount = messages.length
    if (currentCount <= lastProcessedMsgCountRef.current) return
    // 先消费再处理，防止重复消费
    lastProcessedMsgCountRef.current = currentCount

    // 从最新消息中找最后一条完成态的 AI 回复
    const recentMsgs = messages.slice(-10)
    const lastAssistant = [...recentMsgs].reverse().find((m) => m.role === 'assistant' && !m.isLoading)
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

  // ===== 6. 会话统计（用于 ComposerStatusBar）=====
  const assistantCount = messages.filter(m => m.role === 'assistant').length
  const firstMsgTime = messages.length > 0 ? messages[0].timestamp : 0
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    if (messages.length === 0) { setElapsedSeconds(0); return }
    const base = Math.floor((Date.now() - firstMsgTime) / 1000)
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - firstMsgTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [firstMsgTime, messages.length])

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

  // ===== 10. 模式状态 —— 用 Zustand store 替代 window 全局变量
  const scenarioMode = useScenarioStore(s => s.mode)

  const handleScenarioSwitch = useCallback((mode: ScenarioMode) => {
    const result = scenarioSwitcher.switchTo(mode, 'user_selected')
    if (result) {
      useScenarioStore.getState().setMode(result.newMode)
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

  // ===== 12. 消息分支(fork) — DSH 风格 ===
  const handleForkMessage = useCallback(async (messageId: string) => {
    if (!activeSessionId) return
    try {
      const childId = await sessionCapability.fork(activeSessionId, {
        boundaryMessageId: messageId,
        title: `分支 @${messageId.slice(-6)}`,
      })
      setActiveSessionId(childId)
      // 切换后会话自动加载，通过 historySessions 驱动
      logger.info(`[ChatTab] 已分支至新会话: ${childId}`)
    } catch (e) {
      logger.error('[ChatTab] 分支失败:', e)
    }
  }, [activeSessionId])

  // ===== 13. 图片附件状态 — DSH ComposerBar 模式 ===
  const [attachments, setAttachments] = useState<Array<{ id: string; file: File; previewUrl: string }>>([])
  const handleAddAttachment = useCallback((file: File) => {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const previewUrl = URL.createObjectURL(file)
    setAttachments(prev => [...prev, { id, file, previewUrl }])
  }, [])
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  // ===== 14. Details 面板状态 — DSH 工具调用详情 ===
  const [detailsCall, setDetailsCall] = useState<{ id: string; name: string; args: Record<string, unknown>; result?: string; status: 'running' | 'completed' | 'error'; durationMs?: number } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showKBPanel, setShowKBPanel] = useState(false)

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

  // ── 同步当前会话 ID 到持久化层 ──
  useEffect(() => {
    chatMessages.setActiveSessionId(activeSessionId)
  }, [activeSessionId])

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

  // ===== 18. JSX 布局 — DSH 标准三区域结构 =====
  return (

      <div className={`flex h-full relative chat-unified chat-area`}>
        {/* 对话历史侧栏 */}
        <ChatHistory
          sessions={historySessions}
          activeSessionId={activeSessionId}
          onNewChat={callbacks.handleNewSession}
          onSelectSession={callbacks.handleSelectSession}
          onDeleteSession={callbacks.handleDeleteSession}
          onRenameSession={callbacks.handleRenameSession}
          onForkSession={async (sessionId, title) => {
            try {
              const newId = await sessionCapability.fork(sessionId, {
                title: title || `分支-${sessionId.slice(-6)}`,
              })
              callbacks.handleSelectSession(newId)
              return newId
            } catch (e) {
              logger.warn('[ChatTab] Fork failed:', e)
              return ""
            }
          }}
          isVisible={historyVisible}
          onToggle={() => setHistoryVisible((v) => !v)}
        />

        {/* 主内容区 — DSH 三区域：顶栏(固定) + 消息(滚动) + 输入(固定底部) */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* ① 顶栏 — 固定，h-[48px] */}
          <TopBar
            llmAvailable={llmAvailable}
            llmModel={llmModel}
            onModelChange={(model) => logger.debug('[ChatTab] Model changed:', model)}
            scenarioMode={scenarioMode}
            onScenarioSwitch={handleScenarioSwitch}
            historyVisible={historyVisible}
            historySessions={historySessions}
            onToggleHistory={callbacks.toggleHistory}
            ragEnabled={rag.isEnabled}
            ragIsSeeded={rag.isSeeded}
            ragIsSeeding={rag.isSeeding}
            onToggleRAG={rag.toggleRAG}
            onTriggerSeed={rag.triggerSeed}
            formulaCount={formulaCount}
            onShowFormulaList={() => setShowFormulaList(true)}
            messageCount={messages.length}
            onClearChat={callbacks.handleClearChat}
            onOpenKBPanel={() => setShowKBPanel(true)}
            t={safeT}
          />

          {/* ② 消息滚动区 — flex-1 撑满剩余空间，overflow-y-auto */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 py-5 space-y-5">

              {/* RAG 状态通知 — 未初始化时引导打开知识库面板 */}
              {!rag.isSeeded && !rag.isSeeding && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-sm">
                  <Database className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="flex-1 text-emerald-700 dark:text-emerald-300">
                    知识库未初始化 — {rag.isEnabled ? '点击管理面板加载内置药材库' : '请先开启知识库'}
                  </span>
                  <button onClick={() => setShowKBPanel(true)}
                    className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors flex-shrink-0 shadow-sm">
                    知识库管理
                  </button>
                </div>
              )}
              {rag.isSeeded && rag.isEnabled && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400">
                  <Database className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 font-medium">知识库就绪 · {rag.totalChunks?.toLocaleString() ?? '330'} 个知识片段</span>
                  <button onClick={() => setShowKBPanel(true)}
                    className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded text-[10px] font-medium hover:bg-emerald-200 transition-colors flex-shrink-0">
                    管理
                  </button>
                </div>
              )}
              {!llmAvailable && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>LLM 服务离线，当前为离线模式</span>
                </div>
              )}

              {/* RAG 来源横幅 */}
              <RAGSourcesBanner isEnabled={rag.isEnabled} chunks={rag.chunks} sources={rag.lastSources} onDismiss={rag.clearChunks} />

              {/* 错误提示 */}
              {chatError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">{safeT('ai.chat.chatTab.chatError', '对话出错')}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">{chatError instanceof Error ? chatError.message : String(chatError)}</p>
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={chatHandlers.handleRetry}>{safeT('ai.chat.chatTab.retry', '重试')}</Button>
                        <Button variant="ghost" size="sm" onClick={clearError}>{safeT('ai.chat.chatTab.close', '关闭')}</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                onGenerateReport={() => handleGenerateReport()}
                showReportButton={formulaCount > 0}
                highlightedMessageId={highlightedMessageId}
                selectedMessageIds={[]}
                onReferenceMessage={() => {}}
                onEditMessage={messageEditing.handleEditMessage}
                onRetractMessage={messageEditing.handleRetractMessage}
                onForkMessage={handleForkMessage}
                onDetailsMessage={(call) => { setDetailsCall(call); setDetailsOpen(true); }}
                thinkingSteps={orchestrator.thinkingProcessV3.state.steps.map((s) => ({
                  step: s.title,
                  content: s.description,
                  status: s.status === 'completed' ? 'complete' : s.status === 'processing' ? 'thinking' : 'pending',
                  detail: s.details || s.description,
                }))}
              />

              {/* 生成中占位 — DSH 打字指示器 */}
              {isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ③ 输入区 — 固定底部，h-auto flex-shrink-0 */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-shrink-0">
            {/* 暂停条 — 仅在生成中时显示 */}
            {isStreaming && (
              <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-50/50 dark:bg-neutral-900/50">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  生成中
                </span>
                <button onClick={pauseStreaming}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                  <Pause className="w-2.5 h-2.5" />
                  暂停
                </button>
              </div>
            )}
            <ChatInputPro
              value={input}
              onChange={setInput}
              onSend={() => chatHandlers.handleSend()}
              onStop={() => pauseStreaming()}
              isStreaming={isStreaming}
              maxLength={2000}
              placeholder={safeT('ai.chat.chatTab.placeholder', '描述您的配方需求...')}
              modelName={llmModel || 'deepseek-chat'}
              modelColor="text-emerald-500"
              attachments={attachments.map(a => ({ id: a.id, file: a.file, previewUrl: a.previewUrl })) as DraftAttachment[]}
              onAddAttachment={handleAddAttachment}
              onRemoveAttachment={handleRemoveAttachment}
              onSlashSelect={(cmd) => {
                setInput('/' + cmd + ' ')
                chatHandlers.handleSend()
              }}
            />
            {/* DSH StatsLine 风格状态条 */}
            <ComposerStatusBar
              messageCount={messages.length}
              assistantCount={assistantCount}
              elapsedSeconds={elapsedSeconds}
              modelName={llmModel || undefined}
              ragStatus={rag.isEnabled && rag.isSeeded ? '知识库就绪' : rag.isEnabled ? '未就绪' : null}
            />
          </div>

          {/* DSH Details 面板 — 工具调用详情（右侧面板） */}
          {detailsOpen && detailsCall && (
            <div className="w-[320px] flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <DetailsPanel
                selectedCall={{ ...detailsCall, arguments: detailsCall.args }}
                onClose={() => setDetailsOpen(false)}
                title="工具调用详情"
              />
            </div>
          )}

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

          {/* RAG 知识库管理面板 */}
          {showKBPanel && (
            <RAGKnowledgePanel
              onClose={() => setShowKBPanel(false)}
              onSeedComplete={(chunks, files) => {
                logger.info('[ChatTab] 知识库初始化完成:', { chunks, files })
                setShowKBPanel(false)
              }}
            />
          )}
        </div>
      </div>

  )
}

export default ChatTab
