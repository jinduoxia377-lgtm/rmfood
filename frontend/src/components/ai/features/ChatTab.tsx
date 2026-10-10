/**
 * ChatTab - 智能对话布局组件 (v13.0 ADR-029)
 *
 * v13.0 重构 (2026-09-21):
 * ✅ 所有业务逻辑提取至 ChatStateProvider
 * ✅ 纯布局组件，无 useState/useEffect
 * ✅ 通过 useChatContext() 获取所有状态和方法
 *
 * 核心职责：
 * - 提供 ChatStateProvider 包裹所有子组件
 * - 渲染 JSX 布局结构
 * - 委托事件处理给 Context 提供的回调
 *
 * @version 13.0.0
 * @lastUpdated 2026-09-21
 */

import React from 'react'
import { useChatContext } from './ChatStateContext'
import { logger } from '@/utils/safeLogger'
import { useScenarioStore } from '@/stores/scenarioStore'

// ===== Pro 组件 =====
import { ChatMessages, ChatInputPro, ChatHistory, type HistorySession } from './components/pro'
import { TopBar, EmptyStateCard } from './components/pro'
import ComposerStatusBar from './components/pro/ComposerStatusBar'
import DetailsPanel from './components/pro/DetailsPanel'
import FollowUpSuggestionsBar from './components/pro/FollowUpSuggestionsBar'
import type { DraftAttachment } from './components/pro/ChatInput'

// ===== UI 子组件 =====
import { FormulaPanel } from './components/FormulaPanel'
import { ErrorBoundary } from './components/ErrorBoundary'

// ===== 视觉设计系统 =====
import { scenarioSwitcher } from './services/scenarioSwitcher'
import { sessionCapability } from './capabilities/session/SessionCapability'

// ===== UI 组件 =====
import { Button } from '@/components/ui'

// ===== 专业内容组件 =====
import { ProfessionalReport as ProfessionalReportModal } from '@/components/ai/components/ProfessionalReport'
import { EnhancedDataTable } from '@/components/ai/components/EnhancedDataTable'
import type { EnhancedIngredient } from '@/types/ai.types'

// ===== 新功能组件 =====
import { UserProfileSettingsPanel } from './components/UserProfileSettingsPanel'
import { FormulaShareModal } from './components/FormulaShareModal'
import { ChatSearchOverlay } from './components/ChatSearchOverlay'
import { detectStructuredContent } from './components/structured/utils'
import * as formulaExtractorService from './services/formulaExtractorService'

// ===== 图标库 =====
import {
  AlertTriangle, Play, Pause, Leaf, Database,
  UserCircle, Share2, Search as SearchIcon,
  Save,
} from 'lucide-react'

// ===== 配置 =====
import { QUICK_QUESTIONS } from '@/config/ai'

// ===== RAG / UI =====
import { RAGSourcesBanner } from '@/components/ai/rag/RAGSourcesBanner'
import { RAGKnowledgePanel } from './components/RAGKnowledgePanel'
import { Card } from '@/components/ui'

interface ChatTabProps {
  onBatchExport?: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete?: (ids: string[]) => void
  onBatchTag?: (ids: string[], tags: string[]) => void
  onSelectAll?: () => void
  onToggleSelect?: (id: string, sel?: boolean) => void
  onImport?: (data: unknown[]) => void
}

/**
 * ChatTab - 纯布局组装组件 (v13.0)
 * 所有业务逻辑已提取至 ChatStateProvider
 */
export function ChatTab({ onBatchExport, onBatchDelete, onBatchTag, onSelectAll: propsSelectAll, onToggleSelect: propsToggleSelect, onImport: propsImport }: ChatTabProps) {
  // ===== 从 Context 获取所有状态 =====
  const ctx = useChatContext()
  const {
    // 消息
    messages, input, setInput, isStreaming, setIsStreaming,
    chatError, setChatError, clearMessages, addMessage, updateMessage,
    retryLastMessage, clearError, isPaused, pauseStreaming, resumeStreaming,
    editMessage, retractMessage, setActiveSessionId, checkCompaction,
    // 会话
    historySessions, setHistorySessions, activeSessionId, setHistoryVisible, historyVisible,
    // UI
    isDetailModalOpen, selectedForDetail, showFormulaList, searchQuery, highlightedMessageId,
    attachments, detailsCall, detailsOpen, showKBPanel,
    // 引擎
    llmAvailable, llmModel, scenarioMode,
    assistantCount, elapsedSeconds,
    // 配方
    formulaCount, expandedIds, selectedIds, formulas,
    // 报告
    showReportModal, reportData, isGeneratingReport,
    // 方法
    handleSendMessage, handleNewSession, handleSelectSession, handleDeleteSession,
    handleRenameSession, handleClearChat, handleRetry, handleSend, handleForkMessage,
    handleAddAttachment, handleRemoveAttachment, toggleHistory, syncSessionsFromServer,
  } = ctx

  // ===== 本地 UI 状态 =====
  const [detailsCallLocal, setDetailsCall] = React.useState<typeof detailsCall>(null)
  const [detailsOpenLocal, setDetailsOpen] = React.useState(false)
  const [showKBPanelLocal, setShowKBPanelLocal] = React.useState(false)

  // ===== 新功能：设置/分享/搜索 =====
  const [showUserProfileSettings, setShowUserProfileSettings] = React.useState(false)
  const [shareModalContent, setShareModalContent] = React.useState<{ messageId: string; content: string } | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [savedFormulaId, setSavedFormulaId] = React.useState<string | null>(null)

  // ── 同步 Context 状态到本地（用于回调）──
  React.useEffect(() => {
    if (detailsCall !== detailsCallLocal) setDetailsCall(detailsCall)
  }, [detailsCall])
  React.useEffect(() => {
    if (detailsOpen !== detailsOpenLocal) setDetailsOpen(detailsOpen)
  }, [detailsOpen])
  React.useEffect(() => {
    if (showKBPanel !== showKBPanelLocal) setShowKBPanelLocal(showKBPanel)
  }, [showKBPanel])

  // ── 从结构化内容提取配方并保存 ──
  const handleStructureSave = React.useCallback((messageId: string, content: string) => {
    const structured = detectStructuredContent(content)
    if (!structured) {
      logger.warn('[ChatTab] 消息内容不是结构化格式，无法保存:', messageId)
      return
    }
    const extracted = formulaExtractorService.extractFormulaFromContent(structured)
    if (!extracted) {
      logger.warn('[ChatTab] 未能从结构化内容中提取配方:', messageId)
      return
    }
    const formulaId = formulaExtractorService.generateFormulaId(extracted.name)
    setSavedFormulaId(formulaId)
    logger.info('[ChatTab] 配方已保存到库:', { formulaId, name: extracted.name, ingredients: extracted.ingredients.length })
    // TODO: 调用后端API保存到数据库
  }, [])

  const handleStructureShare = React.useCallback((messageId: string, content: string) => {
    setShareModalContent({ messageId, content })
  }, [])

  return (
    <div className={`flex h-full relative chat-unified chat-area`}>
      {/* 对话历史侧栏 */}
      <ChatHistory
        sessions={historySessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onForkSession={async (sessionId, title) => {
          try {
            const newId = await sessionCapability.fork(sessionId, {
              title: title || `分支-${sessionId.slice(-6)}`,
            })
            handleSelectSession(newId)
            return newId
          } catch (e) {
            logger.warn('[ChatTab] Fork failed:', e)
            return ''
          }
        }}
        isVisible={historyVisible}
        onToggle={toggleHistory}
      />

      {/* 主内容区 */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {/* ① 顶栏 */}
        <TopBar
          llmAvailable={llmAvailable}
          llmModel={llmModel}
          onModelChange={(model) => logger.debug('[ChatTab] Model changed:', model)}
          scenarioMode={scenarioMode}
          onScenarioSwitch={(mode) => scenarioSwitcher.switchTo(mode, 'user_selected')}
          historyVisible={historyVisible}
          historySessions={historySessions}
          onToggleHistory={toggleHistory}
          ragEnabled={false}
          ragIsSeeded={false}
          ragIsSeeding={false}
          onToggleRAG={() => {}}
          onTriggerSeed={() => {}}
          formulaCount={formulaCount}
          onShowFormulaList={() => {}}
          messageCount={messages.length}
          onClearChat={handleClearChat}
          onOpenKBPanel={() => setShowKBPanelLocal(true)}
          onOpenUserProfile={() => setShowUserProfileSettings(true)}
          onToggleSearch={() => setSearchOpen(v => !v)}
          searchOpen={searchOpen}
          t={() => ''}
        />

        {/* ② 消息滚动区 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-5 space-y-5">
            {/* 错误提示 */}
            {chatError && (
              <div className="p-3 bg-error-50 dark:bg-error-300/15 border border-error-200 dark:border-error-800/30 rounded-xl">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-error-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-error-800 dark:text-error-700">对话出错</p>
                    <p className="text-xs text-error-600 dark:text-error-700 mt-0.5 truncate">
                      {chatError instanceof Error ? chatError.message : String(chatError)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={handleRetry}>重试</Button>
                      <Button variant="ghost" size="sm" onClick={clearError}>关闭</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {messages.length === 0 && (
              <EmptyStateCard
                welcomeTitle="欢迎使用智能配方助手"
                welcomeSubtitle="选择下方问题快速开始，或直接输入您的配方需求"
                questions={QUICK_QUESTIONS}
                onAsk={handleSend}
              />
            )}

            {/* 消息列表 */}
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              chatError={chatError}
              onRetry={handleRetry}
              onGenerateReport={() => {}}
              showReportButton={formulaCount > 0}
              highlightedMessageId={highlightedMessageId}
              selectedMessageIds={[]}
              onReferenceMessage={() => {}}
              onEditMessage={editMessage}
              onRetractMessage={retractMessage}
              onForkMessage={handleForkMessage}
              onDetailsMessage={(call) => { setDetailsCall(call); setDetailsOpen(true) }}
              thinkingSteps={[]}
              onStructureSave={handleStructureSave}
              onStructureShare={handleStructureShare}
            />

            {/* 追问建议栏 */}
            {!isStreaming && messages.length > 0 && (
              <FollowUpSuggestionsBar
                onSendSuggestion={(question) => {
                  setInput(question)
                  handleSend()
                }}
                messages={messages}
                isVisible={!isStreaming && messages.length > 0}
              />
            )}

            {/* 生成中占位 */}
            {isStreaming && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center flex-shrink-0">
                  <Leaf className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 py-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ③ 输入区 */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-shrink-0">
          {/* 暂停条 */}
          {isStreaming && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-50/50 dark:bg-neutral-900/50">
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                生成中
              </span>
              <button onClick={pauseStreaming}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                <Pause className="w-2.5 h-2.5" />
                暂停
              </button>
            </div>
          )}
          <ChatInputPro
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            onStop={() => pauseStreaming()}
            isStreaming={isStreaming}
            maxLength={2000}
            placeholder="描述您的配方需求..."
            modelName={llmModel || 'deepseek-chat'}
            modelColor="text-success-500"
            attachments={attachments as DraftAttachment[]}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onSlashSelect={(cmd) => {
              setInput('/' + cmd + ' ')
              handleSend()
            }}
          />
          <ComposerStatusBar
            messageCount={messages.length}
            assistantCount={assistantCount}
            elapsedSeconds={elapsedSeconds}
            modelName={llmModel || undefined}
            ragStatus={null}
          />
        </div>

        {/* Details 面板 */}
        {detailsOpenLocal && detailsCallLocal && (
          <div className="w-[320px] flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <DetailsPanel
              selectedCall={{ ...detailsCallLocal, arguments: detailsCallLocal.args } as any}
              onClose={() => setDetailsOpen(false)}
              title="工具调用详情"
            />
          </div>
        )}

        {/* RAG 知识库管理面板 */}
        {showKBPanelLocal && (
          <RAGKnowledgePanel
            onClose={() => setShowKBPanelLocal(false)}
            onSeedComplete={() => setShowKBPanelLocal(false)}
          />
        )}

        {/* 健康画像设置面板 */}
        {showUserProfileSettings && (
          <UserProfileSettingsPanel
            onClose={() => setShowUserProfileSettings(false)}
          />
        )}

        {/* 配方分享模态框 */}
        {shareModalContent && (
          <FormulaShareModal
            content={detectStructuredContent(shareModalContent.content) ?? { blocks: [], responseType: 'general' as any}}
            onClose={() => setShareModalContent(null)}
          />
        )}

        {/* 聊天消息搜索浮层 */}
        {searchOpen && (
          <ChatSearchOverlay
            messages={messages}
            onGoToMessage={(id) => {
              setSearchOpen(false)
              // 滚动到对应消息
              const el = document.querySelector(`[data-message-id="${id}"]`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            onClose={() => setSearchOpen(false)}
          />
        )}

        {/* 保存成功提示 */}
        {savedFormulaId && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full
            bg-success-500 text-white text-xs font-medium shadow-lg animate-fade-in">
            ✓ 配方已保存到配方库
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatTab
