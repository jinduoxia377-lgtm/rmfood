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
import type { RAGChunkResult } from '@/api/rag'
import type { AIRecognizedFormula } from '@/types/ai.types'

/** 与后端 ThinkingStep 对齐的简化类型，供 ReasoningRow 消费 */
export interface ThinkingStepExport {
  step: string
  content: string
  status: 'thinking' | 'complete' | 'pending'
  detail?: string
}

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

  // ===== 实时进度条状态 =====
  streamProgress: number
  streamStageKey: string
  streamChars: number
  streamStatus: 'idle' | 'active' | 'indeterminate' | 'done' | 'error'
  streamSteps: Array<{ key: string; status: 'done' | 'active' | 'pending' }>

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
  /** 显示/关闭配方列表面板 */
  setShowFormulaList: (show: boolean) => void
  searchQuery: string
  highlightedMessageId: string | null
  detailsCall: { id: string; name: string; args: Record<string, unknown>; result?: string; status: string; durationMs?: number } | null
  detailsOpen: boolean
  showKBPanel: boolean

  // ===== 引擎状态 =====
  llmAvailable: boolean
  llmModel: string
  scenarioMode: ScenarioMode
  assistantCount: number
  elapsedSeconds: number

  // ===== RAG 知识库状态 =====
  ragEnabled: boolean
  ragIsSeeded: boolean
  ragIsSeeding: boolean
  onToggleRAG: () => void
  onTriggerSeed: () => Promise<boolean>
  /** RAG 检索到的文档块（最近一次查询） */
  ragChunks: RAGChunkResult[]
  /** 最近一次检索的源文件列表（去重） */
  ragLastSources: string[]
  /** 是否有有效的 RAG 检索结果 */
  ragHasActiveChunks: boolean
  /** 最近一次 RAG 检索是否成功 */
  ragLastQuerySuccess: boolean
  /** 清除 RAG 检索缓存 */
  ragClearChunks: () => void

  // ===== 配方状态 =====
  formulaCount: number
  expandedIds: Set<string>
  selectedIds: Set<string>
  formulas: AIRecognizedFormula[]
  /** 配方操作回调（展开/详情/报告/导出/导入/批量操作） */
  formulaActions: {
    handleToggleExpand: (id: string) => void
    handleShowDetail: (id: string) => void
    handleGenerateReportFromFormula: (id?: string) => void
    handleExportData: (format: string) => Promise<void>
    handleImportData: () => void
    handleToggleSelect: (id: string) => void
    handleBatchExport: (format: 'json' | 'csv' | 'excel' | 'pdf') => void
    handleBatchDelete: () => void
    handleBatchTag: (tags: string[]) => void
    handleSelectAll: () => void
  }
  /** 清除配方存储 */
  onClearStorage: () => void

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
  toggleHistory: () => void
  syncSessionsFromServer: () => Promise<void>
  /** 生成配方报告（客户端生成，见 useReportGenerator）。formulaId 为空则汇总全部配方。 */
  handleGenerateReport: (formulaId?: string) => Promise<void>

  // ===== 思考过程 =====
  /** 当前最新 assistant 消息的思考步骤，由 ChatStateProvider 从 thinkingProcessV3 同步而来 */
  thinkingSteps: ThinkingStepExport[]
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
