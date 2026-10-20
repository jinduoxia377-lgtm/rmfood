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

// ===== Pro 组件 =====
import { ChatMessages, ChatInputPro, ChatHistory } from './components/pro'
import { TopBar, EmptyStateCard } from './components/pro'
import ComposerStatusBar from './components/pro/ComposerStatusBar'
import DetailsPanel from './components/pro/DetailsPanel'
import FollowUpSuggestionsBar from './components/pro/FollowUpSuggestionsBar'
import type { DraftAttachment } from './components/pro/ChatInput'

// ===== 视觉设计系统 =====
import { scenarioSwitcher } from './services/scenarioSwitcher'
import { sessionCapability } from './capabilities/session/SessionCapability'

// ===== UI 组件 =====
import { Button } from '@/components/ui'

// ===== 专业内容组件 =====
import { ProfessionalReport as ProfessionalReportModal, type ProfessionalReportProps as ProfessionalReportModalProps } from '@/components/ai/components/ProfessionalReport'

// ===== 新功能组件 =====
import { UserProfileSettingsPanel } from './components/UserProfileSettingsPanel'
import { FormulaShareModal } from './components/FormulaShareModal'
import { ChatSearchOverlay } from './components/ChatSearchOverlay'
import { detectStructuredContent } from './components/structured/utils'
import * as formulaExtractorService from './services/formulaExtractorService'
import { createFormula } from '@/api/formula'
import { FormulaStatus } from '@/types'
import type { FormulaCreatePayload } from '@/types/formula'

// ===== 图标库 =====
import { AlertTriangle, Pause, Leaf } from 'lucide-react'

// ===== 配置 =====
import { QUICK_QUESTIONS } from '@/config/ai'

// ===== RAG / UI =====
import { RAGKnowledgePanel } from './components/RAGKnowledgePanel'

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 兼容既有 Props 契约，当前实现未使用这些 props
export function ChatTab(_props: ChatTabProps) {
  // ===== 从 Context 获取所有状态 =====
  const ctx = useChatContext()
  const {
    // 消息
    messages, input, setInput, isStreaming,
    chatError, clearError, pauseStreaming,
    editMessage, retractMessage,
    // 会话
    historySessions, activeSessionId, historyVisible,
    // UI
    highlightedMessageId,
    attachments, detailsCall, detailsOpen, showKBPanel,
    // 引擎
    llmAvailable, llmModel, scenarioMode,
    assistantCount, elapsedSeconds,
    // 配方
    formulaCount,
    // 报告
    showReportModal, setShowReportModal, reportData, isGeneratingReport,
    // 方法
    handleNewSession, handleSelectSession, handleDeleteSession,
    handleRenameSession, handleClearChat, handleRetry, handleSend, handleForkMessage,
    handleGenerateReport,
    handleAddAttachment, handleRemoveAttachment, toggleHistory,
  } = ctx

  // ===== 本地 UI 状态 =====
  const [detailsCallLocal, setDetailsCall] = React.useState<typeof detailsCall>(null)
  const [detailsOpenLocal, setDetailsOpen] = React.useState(false)
  const [showKBPanelLocal, setShowKBPanelLocal] = React.useState(false)

  // ===== 新功能：设置/分享/搜索 =====
  const [showUserProfileSettings, setShowUserProfileSettings] = React.useState(false)
  const [shareModalContent, setShareModalContent] = React.useState<{ messageId: string; content: string } | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  // 轻量提示条：后端未提供端点的按钮点下去必须给出明确反馈，不能静默无响应
  const [notice, setNotice] = React.useState<{ kind: 'success' | 'warning' | 'error'; text: string } | null>(null)
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotice = React.useCallback((kind: 'success' | 'warning' | 'error', text: string) => {
    setNotice({ kind, text })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])
  React.useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  // ── 同步 Context 状态到本地（用于回调）──
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 镜像 Context 状态到本地，保持现有同步逻辑不变
    if (detailsCall !== detailsCallLocal) setDetailsCall(detailsCall)
  }, [detailsCall])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 镜像 Context 状态到本地，保持现有同步逻辑不变
    if (detailsOpen !== detailsOpenLocal) setDetailsOpen(detailsOpen)
  }, [detailsOpen])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 镜像 Context 状态到本地，保持现有同步逻辑不变
    if (showKBPanel !== showKBPanelLocal) setShowKBPanelLocal(showKBPanel)
  }, [showKBPanel])

  // ── 从结构化内容提取配方并真正保存到后端 /formulas ──
  // 此前只生成本地 id 就弹"✓ 配方已保存到配方库"，实际没有落库。
  const handleStructureSave = React.useCallback(async (messageId: string, content: string) => {
    const structured = detectStructuredContent(content)
    if (!structured) {
      logger.warn('[ChatTab] 消息内容不是结构化格式，无法保存:', messageId)
      showNotice('warning', '该消息不是结构化配方，无法保存')
      return
    }
    const extracted = formulaExtractorService.extractFormulaFromContent(structured)
    if (!extracted) {
      logger.warn('[ChatTab] 未能从结构化内容中提取配方:', messageId)
      showNotice('warning', '未能从消息中提取到配方成分表')
      return
    }

    // 剂量字符串 -> 数值（"10g" / "10-15g" / "约15克"）。区间取上限。
    const parseDosage = (raw: string): number => {
      const range = /(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)/.exec(raw)
      const val = range ? Number(range[2]) : Number((/^[\s约]*([\d.]+)/.exec(raw) || [0, '0'])[1])
      return Number.isFinite(val) ? val : 0
    }
    const totalAmount = extracted.ingredients.reduce((s, i) => s + parseDosage(i.dosage), 0)
    const ingredients = extracted.ingredients.map((i) => {
      const amount = parseDosage(i.dosage)
      return {
        name: i.name,
        amount,
        unit: /斤/.test(i.dosage) ? 'kg' : 'g',
        percentage: totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0,
        role: i.role,
      }
    })

    const payload: FormulaCreatePayload = {
      name: extracted.name,
      description: [extracted.description, extracted.rationale && `【配伍思路】${extracted.rationale}`]
        .filter(Boolean)
        .join('\n\n'),
      status: FormulaStatus.DRAFT,
      ingredients,
      effects: extracted.expectedEffects ?? [],
      target_effects: extracted.expectedEffects ?? [],
      dosage: extracted.dosageAdvice,
      processing_method: extracted.productionSteps?.length ? extracted.productionSteps.join('；') : undefined,
      notes: extracted.precautions?.length ? `【注意事项】${extracted.precautions.join('；')}` : undefined,
      composition: extracted.scores,
      version_notes: '由 AI 对话结构化内容导入',
    }

    try {
      const created = await createFormula(payload)
      showNotice('success', `配方「${created.name ?? extracted.name}」已保存到配方库`)
      logger.info('[ChatTab] 配方已保存到配方库:', {
        formulaId: created.id,
        name: created.name,
        ingredients: ingredients.length,
      })
    } catch (e) {
      logger.error('[ChatTab] 配方保存失败:', e)
      showNotice('error', '配方保存失败：' + (e instanceof Error ? e.message : '服务端未接受请求'))
    }
  }, [showNotice])

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
          onModelChange={(model) => {
            // 后端没有"按对话切换模型"的端点，聊天始终走 /models/status 的默认模型。
            // 此前这里只打日志，用户以为切换生效了。
            logger.debug('[ChatTab] Model changed:', model)
            showNotice('warning', '模型切换暂不可用：后端未提供按对话指定模型的接口，当前仍使用默认模型')
          }}
          scenarioMode={scenarioMode}
          onScenarioSwitch={(mode) => scenarioSwitcher.switchTo(mode, 'user_selected')}
          historyVisible={historyVisible}
          historySessions={historySessions}
          onToggleHistory={toggleHistory}
          ragEnabled={false}
          ragIsSeeded={false}
          ragIsSeeding={false}
          onToggleRAG={() =>
            showNotice('warning', '知识库检索暂不可用：后端未提供 RAG 索引与检索端点')
          }
          onTriggerSeed={() =>
            showNotice('warning', '知识库初始化暂不可用：后端未提供 RAG 端点')
          }
          formulaCount={formulaCount}
          onShowFormulaList={() => setShowKBPanelLocal(true)}
          messageCount={messages.length}
          onClearChat={handleClearChat}
          onOpenKBPanel={() => setShowKBPanelLocal(true)}
          onOpenUserProfile={() => setShowUserProfileSettings(true)}
          onToggleSearch={() => setSearchOpen(v => !v)}
          searchOpen={searchOpen}
          // 此前是 t={() => ''}，把 TopBar 标题清空了
          t={(_key, fallback) => fallback ?? _key}
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
              onGenerateReport={() => {
                if (isGeneratingReport) {
                  showNotice('warning', '报告正在生成中，请稍候')
                  return
                }
                if (formulaCount === 0) {
                  showNotice('warning', '还没有配方数据，请先在对话中描述配方需求或导入配方')
                  return
                }
                showNotice('success', '开始生成配方报告…')
                // 汇总当前会话识别出的全部配方；useReportGenerator 内部会做缓存与版本记录
                handleGenerateReport().catch((err) => {
                  const msg = err instanceof Error ? err.message : String(err ?? '未知错误')
                  showNotice('error', `报告生成失败：${msg}`)
                })
              }}
              showReportButton={formulaCount > 0}
              highlightedMessageId={highlightedMessageId}
              selectedMessageIds={[]}
              onReferenceMessage={(msg) => {
                const text = typeof msg.content === 'string' ? msg.content : String(msg.content ?? '')
                const snippet = text.length > 160 ? text.slice(0, 160) + '…' : text
                if (!snippet.trim()) return
                // 把被引用的消息作为上下文插入输入框，供下一轮提问引用
                setInput(`> ${snippet}\n${input}`)
              }}
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

        {/* Details 面板 — 移动端为全屏抽屉，sm+ 恢复为右侧内嵌列 */}
        {detailsOpenLocal && detailsCallLocal && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[320px] flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800 overflow-hidden sm:static sm:z-auto sm:w-[320px] sm:max-w-none">
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

        {/* 专业配方报告模态框
            注意：ProfessionalReport 内部 report.sections / report.title 无空值守卫，
            所以必须同时要求 reportData 存在才渲染，不能只看 showReportModal。 */}
        {showReportModal && !!reportData && (
          <ProfessionalReportModal
            report={reportData as ProfessionalReportModalProps['report']}
            isLoading={isGeneratingReport}
            onClose={() => setShowReportModal(false)}
          />
        )}

        {/* 操作反馈提示：成功 / 后端未提供端点 / 失败 */}
        {notice && (
          <div
            role="status"
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full
              text-xs font-medium shadow-lg animate-fade-in text-white ${
                notice.kind === 'success'
                  ? 'bg-success-500'
                  : notice.kind === 'error'
                    ? 'bg-error-500'
                    : 'bg-warning-500'
              }`}
          >
            {notice.kind === 'success' ? '✓ ' : '⚠ '}
            {notice.text}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatTab
