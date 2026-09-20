/**
 * ChatStateProvider - AI 对话状态容器 (ADR-029 P1-1)
 *
 * 所有业务逻辑在此初始化，通过 Context 提供给子组件。
 * ChatTab 组件只负责渲染布局，不包含任何状态逻辑。
 *
 * @version 1.0.0
 * @created 2026-09-21
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModelClient } from '@/api/modelClient'
import { logger } from '@/utils/safeLogger'
import { useScenarioStore } from '@/stores/scenarioStore'

// ===== Hooks =====
import { useChatTabOrchestrator } from './hooks/useChatTabOrchestrator'
import { useChatSendMessage } from './hooks/useChatSendMessage'
import { useChatCallbacks } from './hooks/useChatCallbacks'
import { useRAGContext } from '@/hooks/useRAGContext'
import { useSafeTranslation } from './hooks/useSafeTranslation'
import { useFormulaActions } from './hooks/useFormulaActions'
import { useMessageEditing } from './hooks/useMessageEditing'
import { useChatHandlers } from './hooks/useChatHandlers'
import { useChatMessages } from './hooks/useChatMessages'
import { useFormulaManager } from './hooks/useFormulaManager'
import { useReportGenerator } from './hooks/useReportGenerator'
import { useExportManager } from './hooks/useExportManager'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useChatTheme } from './hooks/useChatTheme'
import { useChatHistoryManager } from './hooks/useChatHistoryManager'

// ===== Services =====
import { scenarioSwitcher } from './services/scenarioSwitcher'
import { sessionCapability } from './capabilities/session/SessionCapability'
import type { ScenarioMode } from './services/scenarioSwitcher'
import type { HistorySession } from './components/pro'
import type { BackendThinkingStep } from './hooks/useThinkingProcessV3'
import type { ChatMessage } from './types'

// ===== Context =====
import { ChatStateContext } from './ChatStateContext'

interface ChatStateProviderProps {
  children: ReactNode
  onBatchExport?: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete?: (ids: string[]) => void
  onBatchTag?: (ids: string[], tags: string[]) => void
  onSelectAll?: () => void
  onToggleSelect?: (id: string, sel?: boolean) => void
  onImport?: (data: unknown[]) => void
}

export function ChatStateProvider({ children, ...props }: ChatStateProviderProps) {
  // ===== 1. 安全翻译 =====
  const safeT = useSafeTranslation()

  // ===== 2. 核心消息状态 =====
  const chatMessages = useChatMessages()
  const {
    messages, input, setInput, isStreaming, setIsStreaming,
    chatError, setChatError, clearMessages, addMessage, updateMessage,
    retryLastMessage, clearError, isPaused, pauseStreaming, resumeStreaming,
    setActiveSessionId, checkCompaction,
  } = chatMessages

  // ===== 3. 引擎编排 =====
  const orchestrator = useChatTabOrchestrator()
  orchestrator.scenarioSwitcher.setAutoSwitch(false)

  // 后端 thinking_steps → 前端思维可视化同步
  const lastProcessedMsgCountRef = useRef(0)
  useEffect(() => {
    const currentCount = messages.length
    if (currentCount <= lastProcessedMsgCountRef.current) return
    lastProcessedMsgCountRef.current = currentCount
    const recentMsgs = messages.slice(-10)
    const lastAssistant = [...recentMsgs].reverse().find((m) => m.role === 'assistant' && !m.isLoading)
    if (lastAssistant) {
      const msg = lastAssistant as { role: string; content: string; isLoading?: boolean; thinking_steps?: BackendThinkingStep[] }
      if (msg.thinking_steps && Array.isArray(msg.thinking_steps) && msg.thinking_steps.length > 0) {
        orchestrator.thinkingProcessV3.loadExternalSteps(msg.thinking_steps, msg.content)
      }
    }
  }, [messages, orchestrator.thinkingProcessV3])

  // ===== 4. 模型状态 =====
  const { data: modelStatus } = useQuery({
    queryKey: ['ai-model-status'],
    queryFn: ModelClient.getModelStatus,
    refetchOnMount: true, gcTime: 0, staleTime: 0, retry: 1,
  })
  const llmAvailable = modelStatus?.llm?.status === 'active'
  const llmModel = modelStatus?.llm?.model ?? ''

  // ===== 5. 会话统计 =====
  const assistantCount = messages.filter(m => m.role === 'assistant').length
  const firstMsgTime = messages.length > 0 ? messages[0].timestamp : 0
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    if (messages.length === 0) { setElapsedSeconds(0); return }
    const base = Math.floor((Date.now() - firstMsgTime) / 1000)
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - firstMsgTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [firstMsgTime, messages.length])

  // ===== 6. RAG 上下文 =====
  const rag = useRAGContext()

  // ===== 7. 场景模式 =====
  const scenarioMode = useScenarioStore(s => s.mode)

  // ===== 8. 消息发送 =====
  const chatHook = useChatSendMessage(chatMessages, {
    orchestrator, ragAugment: rag.augment, llmAvailable, scenarioMode,
  })

  // ===== 9. 导出管理 =====
  const { exportMessages } = useExportManager()

  // ===== 10. 配方管理 =====
  const {
    formulas, formulaIndex, formulaCount, expandedIds, selectedIds,
    selectedForDetail, isDetailModalOpen, toggleExpand, selectFormula,
    selectAll, batchDelete, batchExport, batchTag, showDetailTable,
    closeDetailTable, importFormulas, exportFormulas: handleExportFormulas,
    clearAllFormulas,
  } = useFormulaManager()

  // ===== 11. 报告生成 =====
  const {
    handleGenerateReport, reportData, isGeneratingReport,
    showReportModal, setShowModal: setShowReportModal, clearReport,
  } = useReportGenerator(formulaIndex)

  // ===== 12. 主题 =====
  const { scheme, cycleScheme, schemeInfo } = useChatTheme()

  // ===== 13. 场景切换 =====
  const handleScenarioSwitch = useCallback((mode: ScenarioMode) => {
    const result = scenarioSwitcher.switchTo(mode, 'user_selected')
    if (result) {
      useScenarioStore.getState().setMode(result.newMode)
      logger.info(`[ChatStateProvider] 场景切换: ${result.previousMode} → ${result.newMode}`)
    }
  }, [])

  // ===== 14. 会话管理 =====
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null)
  const [historyVisible, setHistoryVisible] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    sessionCapability.listSessions()
      .then(sessions => {
        const mapped: HistorySession[] = sessions.map(s => ({
          id: s.id, title: s.title, messageCount: s.messageCount, lastMessage: '', timestamp: s.updatedAt,
        }))
        setHistorySessions(mapped)
        if (mapped.length > 0) setActiveSessionIdState(mapped[0].id)
      })
      .catch(err => logger.warn('[ChatStateProvider] 加载会话列表失败:', err))
  }, [])

  // 同步会话 ID 到持久化层
  useEffect(() => {
    setActiveSessionId(activeSessionId)
  }, [activeSessionId, setActiveSessionId])

  const handleForkMessage = useCallback(async (messageId: string) => {
    if (!activeSessionId) return
    try {
      const childId = await sessionCapability.fork(activeSessionId, {
        boundaryMessageId: messageId,
        title: `分支 @${messageId.slice(-6)}`,
      })
      setActiveSessionIdState(childId)
      const refreshed = await sessionCapability.listSessions()
      setHistorySessions(refreshed.map(s => ({
        id: s.id, title: s.title, messageCount: s.messageCount, lastMessage: '', timestamp: s.updatedAt,
      })))
      logger.info(`[ChatStateProvider] 已分支至新会话: ${childId}`)
    } catch (e) {
      logger.error('[ChatStateProvider] 分支失败:', e)
    }
  }, [activeSessionId])

  // ===== 15. 附件管理 =====
  const [attachments, setAttachments] = useState<Array<{ id: string; file: File; previewUrl: string }>>([])
  const handleAddAttachment = useCallback((file: File) => {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const previewUrl = URL.createObjectURL(file)
    setAttachments(prev => [...prev, { id, file, previewUrl }])
  }, [])
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  // ===== 16. Details 面板 =====
  const [detailsCall, setDetailsCall] = useState<{ id: string; name: string; args: Record<string, unknown>; result?: string; status: 'running' | 'completed' | 'error'; durationMs?: number } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showKBPanel, setShowKBPanel] = useState(false)

  // ===== 17. 回调管理 =====
  const callbacks = useChatCallbacks({
    historySessions, setHistorySessions, setActiveSessionId: setActiveSessionIdState,
    historyVisible, setHistoryVisible, clearMessages, clearAllFormulas,
    clearWorkingMemory: () => {},
    clearMultiTurnDialogue: orchestrator.multiTurnDialogue.clearDialogue,
    clearShortTermMemory: () => {},
    messages, setMessages: chatMessages.replaceMessages, activeSessionId,
  })

  // ===== 18. 键盘快捷键 =====
  useKeyboardShortcuts({ disabled: isStreaming })

  // ===== 19. 消息编辑 =====
  const messageEditing = useMessageEditing({
    messages, editMessage: chatMessages.editMessage,
    removeMessage: chatMessages.removeMessage,
    retractMessage: chatMessages.retractMessage,
    sendMessage: async (content: string) => {
      await chatHook.handleSendMessage(content)
      if (activeSessionId) {
        callbacks.updateSessionMetadata(activeSessionId, messages)
      }
    },
  })

  // ===== 20. UI 状态 =====
  const [showFormulaList, setShowFormulaList] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  // ===== 21. 聊天处理器 =====
  const chatHandlers = useChatHandlers({
    input, isStreaming, activeSessionId, chatError, setChatError, clearError,
    retryLastMessage, handleSendMessage: chatHook.handleSendMessage,
    updateSessionMetadata: callbacks.updateSessionMetadata, messages,
    showReportModal, setShowReportModal,
    isDetailModalOpen, closeDetailTable,
    showFormulaList, setShowFormulaList,
    checkCompaction,
  })

  // ===== 22. 配方操作 =====
  const formulaActions = useFormulaActions({
    formulas, selectedIds, selectedForDetail, expandedIds, formulaCount,
    isDetailModalOpen,
    onToggleExpand: toggleExpand, onShowDetail: showDetailTable, onCloseDetail: closeDetailTable,
    onGenerateReport: handleGenerateReport, onExport: handleExportFormulas,
    onClearStorage: clearAllFormulas,
    onBatchExport: props.onBatchExport ?? (() => {}),
    onBatchDelete: props.onBatchDelete ?? (() => {}),
    onBatchTag: props.onBatchTag ?? (() => {}),
    onSelectAll: selectAll,
    onToggleSelect: (id, sel) => selectFormula(id, sel ?? false),
    onImport: importFormulas,
  })

  // ===== 23. 构建 Context Value =====
  const contextValue = useMemo<Parameters<typeof ChatStateContext.Provider>[0]['value']>(() => ({
    // 消息
    messages, input, setInput, isStreaming, setIsStreaming,
    chatError, setChatError, clearMessages, addMessage, updateMessage,
    retryLastMessage, clearError, isPaused, pauseStreaming, resumeStreaming,
    editMessage: messageEditing.handleEditMessage,
    retractMessage: messageEditing.handleRetractMessage,
    setActiveSessionId, checkCompaction,

    // 会话
    historySessions, setHistorySessions,
    activeSessionId, setActiveSessionIdCtx: setActiveSessionIdState,
    historyVisible, setHistoryVisible,

    // UI
    isDetailModalOpen, selectedForDetail,
    showFormulaList, searchQuery, highlightedMessageId,
    attachments, detailsCall, detailsOpen, showKBPanel,

    // 引擎
    llmAvailable, llmModel, scenarioMode,
    assistantCount, elapsedSeconds,

    // 配方
    formulaCount, expandedIds, selectedIds, formulas,

    // 报告
    showReportModal, reportData, isGeneratingReport,

    // 方法
    handleSendMessage: chatHook.handleSendMessage,
    handleNewSession: callbacks.handleNewSession,
    handleSelectSession: callbacks.handleSelectSession,
    handleDeleteSession: callbacks.handleDeleteSession,
    handleRenameSession: callbacks.handleRenameSession,
    handleClearChat: callbacks.handleClearChat,
    handleRetry: chatHandlers.handleRetry,
    handleSend: chatHandlers.handleSend,
    handleForkMessage,
    handleAddAttachment, handleRemoveAttachment,
    toggleHistory: callbacks.toggleHistory,
    syncSessionsFromServer: callbacks.syncSessionsFromServer,
  }), [
    messages, input, isStreaming, chatError, assistantCount, elapsedSeconds,
    historySessions, activeSessionId, historyVisible,
    llmAvailable, llmModel, scenarioMode,
    formulaCount, expandedIds, selectedIds, formulas,
    showReportModal, reportData, isGeneratingReport,
    showFormulaList, searchQuery, highlightedMessageId,
    attachments, detailsCall, detailsOpen, showKBPanel, isDetailModalOpen, selectedForDetail,
    chatHook, callbacks, chatHandlers, messageEditing, formulaActions,
    handleForkMessage, handleAddAttachment, handleRemoveAttachment,
    props,
  ])

  return (
    <ChatStateContext.Provider value={contextValue}>
      {children}
    </ChatStateContext.Provider>
  )
}

export default ChatStateProvider
