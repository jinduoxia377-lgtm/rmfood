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
import { useFormulaActions } from './hooks/useFormulaActions'
import { useMessageEditing } from './hooks/useMessageEditing'
import { useChatHandlers } from './hooks/useChatHandlers'
import { useChatMessages } from './hooks/useChatMessages'
import { useFormulaManager } from './hooks/useFormulaManager'
import { useReportGenerator } from './hooks/useReportGenerator'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

// ===== Services =====
import { sessionCapability } from './capabilities/session/SessionCapability'
import { chatStorageService } from './capabilities/storage/ChatStorageService'
import type { HistorySession } from './components/pro'
import type { BackendThinkingStep } from './hooks/useThinkingProcessV3'

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
    if (messages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedSeconds(0); return
    }
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

  // ===== 10. 配方管理 =====
  const {
    formulas, formulaIndex, formulaCount, expandedIds, selectedIds,
    selectedForDetail, isDetailModalOpen, toggleExpand, selectFormula,
    selectAll, showDetailTable,
    closeDetailTable, importFormulas, exportFormulas: handleExportFormulas,
    clearAllFormulas,
  } = useFormulaManager()

  // ===== 11. 报告生成 =====
  const {
    handleGenerateReport, reportData, isGeneratingReport,
    showReportModal, setShowModal: setShowReportModal,
  } = useReportGenerator(formulaIndex)

  // ===== 12. 会话管理 =====
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null)
  const [historyVisible, setHistoryVisible] = useState(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    sessionCapability.listSessions()
      .then(async sessions => {
        const mapped: HistorySession[] = sessions.map(s => ({
          id: s.id, title: s.title, messageCount: s.messageCount, lastMessage: '', timestamp: s.updatedAt,
        }))
        setHistorySessions(mapped)
        if (mapped.length > 0) {
          setActiveSessionIdState(mapped[0].id)
          return
        }
        // 无历史会话：自动创建一个新会话，确保首次对话也能持久化恢复（修复「刷新后历史消失」）
        try {
          const newId = await sessionCapability.createSession('新对话')
          setActiveSessionIdState(newId)
          setHistorySessions(prev => [{
            id: newId, title: '新对话', messageCount: 0, lastMessage: '', timestamp: Date.now(),
          }, ...prev])
          logger.info('[ChatStateProvider] 无历史会话，已自动创建新会话:', newId)
        } catch (createErr) {
          logger.warn('[ChatStateProvider] 自动创建会话失败（对话将仅在内存中）:', createErr)
        }
      })
      .catch(err => logger.warn('[ChatStateProvider] 加载会话列表失败:', err))
  }, [])

  // 同步会话 ID 到持久化层
  useEffect(() => {
    setActiveSessionId(activeSessionId)
  }, [activeSessionId, setActiveSessionId])

  // ── 专项：刷新后自动恢复最近会话内容 ──
  // activeSessionId 就绪且当前消息区为空时，从存储自动加载，无需用户手动点击历史入口。
  useEffect(() => {
    if (!activeSessionId) return
    if (messages.length > 0) return
    let cancelled = false
    chatStorageService.loadMessages(activeSessionId)
      .then(msgs => {
        if (cancelled || msgs.length === 0) return
        chatMessages.replaceMessages(msgs)
        logger.info(`[ChatStateProvider] 已自动恢复最近会话 ${activeSessionId}（${msgs.length} 条消息）`)
      })
      .catch(err => logger.warn('[ChatStateProvider] 自动恢复会话消息失败（不影响后续对话）:', err))
    return () => { cancelled = true }
  }, [activeSessionId, messages.length, chatMessages])

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
  const [detailsCall] = useState<{ id: string; name: string; args: Record<string, unknown>; result?: string; status: 'running' | 'completed' | 'error'; durationMs?: number } | null>(null)
  const [detailsOpen] = useState(false)
  const [showKBPanel] = useState(false)

  // ===== 17. 回调管理 =====
  const callbacks = useChatCallbacks({
    historySessions, setHistorySessions, setActiveSessionId: setActiveSessionIdState,
    historyVisible, setHistoryVisible, clearMessages, clearAllFormulas,
    // 工作记忆/短期记忆已按 v12 决策从主聊天链路移除（无持久化/无反馈闭环），不再传入空实现。
    // 如需恢复用户级三级记忆，需产品决策后重新设计（含后端持久化）。
    clearMultiTurnDialogue: orchestrator.multiTurnDialogue.clearDialogue,
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
  const [searchQuery] = useState('')
  const [highlightedMessageId] = useState<string | null>(null)

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

    // RAG
    ragEnabled: rag.isEnabled,
    ragIsSeeded: rag.isSeeded,
    ragIsSeeding: rag.isSeeding,
    onToggleRAG: rag.toggleRAG,
    onTriggerSeed: rag.triggerSeed,

    // 配方
    formulaCount, expandedIds, selectedIds, formulas,

    // 报告
    showReportModal, setShowReportModal, reportData, isGeneratingReport,

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
    handleGenerateReport,
  }), [
    messages, input, isStreaming, chatError, assistantCount, elapsedSeconds,
    historySessions, activeSessionId, historyVisible,
    llmAvailable, llmModel, scenarioMode, rag,
    formulaCount, expandedIds, selectedIds, formulas,
    showReportModal, setShowReportModal, reportData, isGeneratingReport,
    handleGenerateReport,
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
