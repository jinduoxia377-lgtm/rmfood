/**
 * ChatStateContext - AI 对话状态上下文 (ADR-029 P1-1)
 *
 * 将所有 ChatTab 的状态和方法提取到 Context 中，
 * 使 ChatTab 组件成为纯布局组件。
 *
 * @version 1.0.0
 * @created 2026-09-21
 */

import React, { createContext, useContext } from 'react'
import type { HistorySession } from './components/pro'
import type { ChatMessage } from './types'
import type { ScenarioMode } from './services/scenarioSwitcher'

export interface ChatState {
  // ===== 消息状态 =====
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void
  chatError: Error | null
  setChatError: (e: Error | null) => void
  clearMessages: () => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  retryLastMessage: () => Promise<void>
  clearError: () => void
  isPaused: boolean
  pauseStreaming: () => void
  resumeStreaming: () => void
  editMessage: (id: string, newContent: string) => void
  retractMessage: (id: string) => void
  setActiveSessionId: (id: string | null) => void
  checkCompaction: () => Promise<void>

  // ===== 会话状态 =====
  historySessions: HistorySession[]
  setHistorySessions: React.Dispatch<React.SetStateAction<HistorySession[]>>
  activeSessionId: string | null
  setActiveSessionIdCtx: React.Dispatch<React.SetStateAction<string | null>>
  historyVisible: boolean
  setHistoryVisible: React.Dispatch<React.SetStateAction<boolean>>

  // ===== UI 状态 =====
  isDetailModalOpen: boolean
  selectedForDetail: unknown
  showFormulaList: boolean
  searchQuery: string
  highlightedMessageId: string | null
  attachments: Array<{ id: string; file: File; previewUrl: string }>
  detailsCall: { id: string; name: string; args: Record<string, unknown>; result?: string; status: string; durationMs?: number } | null
  detailsOpen: boolean
  showKBPanel: boolean

  // ===== 引擎状态 =====
  llmAvailable: boolean
  llmModel: string
  scenarioMode: ScenarioMode
  assistantCount: number
  elapsedSeconds: number

  // ===== 配方状态 =====
  formulaCount: number
  expandedIds: Set<string>
  selectedIds: Set<string>
  formulas: unknown[]

  // ===== 报告状态 =====
  showReportModal: boolean
  /** 关闭报告弹窗并清理报告数据（实现为 useReportGenerator.clearReport） */
  setShowReportModal: (show: boolean) => void
  reportData: unknown
  isGeneratingReport: boolean

  // ===== 操作方法 =====
  handleSendMessage: (content: string) => Promise<void>
  handleNewSession: () => void
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
  handleClearChat: () => void
  handleRetry: () => Promise<void>
  handleSend: (content?: string) => Promise<void>
  handleForkMessage: (messageId: string) => Promise<void>
  handleAddAttachment: (file: File) => void
  handleRemoveAttachment: (id: string) => void
  toggleHistory: () => void
  syncSessionsFromServer: () => Promise<void>
  /** 生成配方报告（客户端生成，见 useReportGenerator）。formulaId 为空则汇总全部配方。 */
  handleGenerateReport: (formulaId?: string) => Promise<void>
}

export const ChatStateContext = createContext<ChatState | null>(null)

export function useChatState(): ChatState {
  const context = useContext(ChatStateContext)
  if (!context) {
    throw new Error('useChatState must be used within ChatStateProvider')
  }
  return context
}

/** 供组件直接使用的便捷 Hook */
export function useChatContext(): ChatState {
  return useChatState()
}
