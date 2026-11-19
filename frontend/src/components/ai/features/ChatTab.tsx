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
import { useTranslation } from 'react-i18next'
import { useChatContext } from './ChatStateContext'
import { logger } from '@/utils/safeLogger'

// ===== Pro 组件 =====
import { ChatMessages, ChatInputPro, ChatHistory, ChatProgressBar } from './components/pro'
import { TopBar, EmptyStateCard } from './components/pro'
import ComposerStatusBar from './components/pro/ComposerStatusBar'
import DetailsPanel from './components/pro/DetailsPanel'
import FollowUpSuggestionsBar from './components/pro/FollowUpSuggestionsBar'
import { RAGSourcesBanner } from '@/components/ai/rag/RAGSourcesBanner'
import { useExpandChatA11y } from './hooks/useExpandChatA11y'

// ===== 视觉设计系统 =====

import { useScenarioStore } from '@/stores/scenarioStore'
import { useModelStore } from '@/stores/modelStore'
import { sessionCapability } from './capabilities/session/SessionCapability'

// ===== UI 组件 =====
import { Button } from '@/components/ui'

// ===== 专业内容组件（⚡ P3 性能优化：仅打开模态框时才下载，含 recharts 依赖） =====
import type { ProfessionalReportProps as ProfessionalReportModalProps } from '@/components/ai/components/ProfessionalReport'
const ProfessionalReportModal = React.lazy(() => import('@/components/ai/components/ProfessionalReport').then(m => ({ default: m.ProfessionalReport })))

// ===== 新功能组件（⚡ P3 性能优化：均为条件渲染的模态框，改为懒加载缩小 ChatTab 首屏 bundle） =====
const UserProfileSettingsPanel = React.lazy(() => import('./components/UserProfileSettingsPanel').then(m => ({ default: m.UserProfileSettingsPanel })))
const FormulaShareModal = React.lazy(() => import('./components/FormulaShareModal').then(m => ({ default: m.FormulaShareModal })))
const FormulaPanel = React.lazy(() => import('./components/FormulaPanel').then(m => ({ default: m.FormulaPanel })))
const ChatSearchOverlay = React.lazy(() => import('./components/ChatSearchOverlay').then(m => ({ default: m.ChatSearchOverlay })))
import { detectStructuredContent } from './components/structured/utils'
import * as formulaExtractorService from './services/formulaExtractorService'
import { createFormula } from '@/api/formula'
import { validateAiFormula, repairStructuredFormula, type AiFormulaValidationResponse } from '@/api/ai'
import { parseDosageToGramsOrZero } from './utils/dosage'
import { FormulaStatus } from '@/types'
import type { FormulaCreatePayload } from '@/types/formula'
import type { ToolCall } from './components/pro/DetailsPanel'
const FeedbackModal = React.lazy(() => import('./components/FeedbackModal').then(m => ({ default: m.FeedbackModal })))

// ===== 图标库 =====
import { AlertTriangle, Pause, Leaf, Wand2 } from 'lucide-react'

// ===== 配置 =====
import { QUICK_QUESTIONS } from '@/config/ai'

// ===== RAG / UI =====
import { FormulaValidationModal } from './components/FormulaValidationModal'

interface ChatTabProps {
  onBatchExport?: (ids: string[], format: 'json' | 'csv' | 'excel' | 'pdf') => void
  onBatchDelete?: (ids: string[]) => void
  onBatchTag?: (ids: string[], tags: string[]) => void
  onSelectAll?: () => void
  onToggleSelect?: (id: string, sel?: boolean) => void
  onImport?: (data: unknown[]) => void
  /**
   * P1-4 合并：点击 TopBar「知识库」按钮时跳转到 knowledge tab 的单一知识库页面，
   * 不再打开与 KnowledgeBasePanel 重复的管理模态框。
   */
  onOpenKnowledgeTab?: () => void
}

/**
 * ChatTab - 纯布局组装组件 (v13.0)
 * 所有业务逻辑已提取至 ChatStateProvider
 */
 
/**
 * 将 AI 校验响应中的阻断性错误汇总为提示文本（含超限/违禁成分与建议）。
 * showNotice 是轻量提示条，文本需保持简短可读。
 */
export function buildValidationErrorSummary(validation: AiFormulaValidationResponse): string {
  const criticalAlerts = validation.alerts.filter(a => a.level === 'critical' || a.blocking)
  const parts = criticalAlerts.map(a => {
    const ingredient = a.ingredient ? `「${a.ingredient}」` : ''
    const detail = a.message || a.parameter || ''
    const suggestion = a.recommendation ? `（建议：${a.recommendation}）` : ''
    return `${ingredient}${detail}${suggestion}`
  })
  if (validation.errors?.length) parts.push(...validation.errors)
  if (validation.recommendations?.length) parts.push(`建议：${validation.recommendations.join('；')}`)
  const summary = parts.filter(Boolean).join('；')
  return summary ? `校验未通过：${summary}` : '配方存在安全性问题，已阻止保存'
}

export function ChatTab({ onOpenKnowledgeTab }: ChatTabProps) {
  const { t } = useTranslation()
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
    detailsCall, detailsOpen,
    // 引擎
    llmAvailable, llmModel, scenarioMode,
    assistantCount, elapsedSeconds,
    // RAG
    ragEnabled, ragIsSeeded, ragIsSeeding,
    onToggleRAG, onTriggerSeed,
    ragChunks, ragLastSources, ragClearChunks,
    // 配方
    formulaCount, formulas, expandedIds, selectedIds,
    formulaActions, onClearStorage,
    // v8.5：本地持久化失败提示
    formulaStorageError, clearFormulaStorageError,
    // v8.5：批量删除撤销
    undoBatchDelete, canUndoBatchDelete,
    // v8.5：批量删除超限提示
    batchLimitExceeded, clearBatchLimitExceeded,
    // UI（配方列表面板）
    showFormulaList, setShowFormulaList, searchQuery,
    // 报告
    showReportModal, setShowReportModal, reportData, isGeneratingReport,
    // 思考过程
    thinkingSteps,
    // 方法
    handleNewSession, handleSelectSession, handleDeleteSession,
    handleRenameSession, handleClearChat, handleRetry, handleSend, handleForkMessage,
    handleGenerateReport,
    toggleHistory,
  } = ctx

  // ===== 本地 UI 状态 =====
  const [detailsCallLocal, setDetailsCall] = React.useState<typeof detailsCall>(null)
  const [detailsOpenLocal, setDetailsOpen] = React.useState(false)

  // ===== 新功能：设置/分享/搜索 =====
  const [showUserProfileSettings, setShowUserProfileSettings] = React.useState(false)
  const [shareModalContent, setShareModalContent] = React.useState<{ messageId: string; content: string } | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  // 轻量提示条：后端未提供端点的按钮点下去必须给出明确反馈，不能静默无响应。
  // 成功提示可附带一个动作按钮（如「提交效果反馈」），通过 onAction 触发。
  const [notice, setNotice] = React.useState<{
    kind: 'success' | 'warning' | 'error'
    text: string
    actionLabel?: string
    onAction?: () => void
  } | null>(null)
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotice = React.useCallback((
    kind: 'success' | 'warning' | 'error',
    text: string,
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setNotice({ kind, text, actionLabel, onAction })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), actionLabel ? 8000 : 4000)
  }, [])
  React.useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  // ── 反馈闭环：保存成功后记录配方 ID，供「提交效果反馈」打开模态框 ──
  const [feedbackTarget, setFeedbackTarget] = React.useState<{ formulaId: number; formulaName?: string } | null>(null)

  // ── 成分级配方校验报告弹窗：有校验结果时先展示，用户确认后才 createFormula ──
  const [validationModal, setValidationModal] = React.useState<{
    result: AiFormulaValidationResponse
    formulaName: string
    payload: FormulaCreatePayload
  } | null>(null)

  // ── 放大对话窗口：展开态 + 触发按钮 ref + 展开面根容器 ref，并接入 a11y 副作用 ──
  const [chatExpanded, setChatExpanded] = React.useState(false)
  const expandTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const chatStageRef = React.useRef<HTMLDivElement | null>(null)
  const toggleChatExpand = React.useCallback(() => setChatExpanded(v => !v), [])
  // 仅展开态生效：Esc 关闭 / Tab 焦点陷阱 / body 滚动锁 / 折叠时焦点还原
  useExpandChatA11y({
    isExpanded: chatExpanded,
    stageRef: chatStageRef,
    triggerRef: expandTriggerRef,
    onCollapse: () => setChatExpanded(false),
  })

  // ── 同步 Context 状态到本地（用于回调）──
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 镜像 Context 状态到本地，保持现有同步逻辑不变
    if (detailsCall !== detailsCallLocal) setDetailsCall(detailsCall)
  }, [detailsCall])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 镜像 Context 状态到本地，保持现有同步逻辑不变
    if (detailsOpen !== detailsOpenLocal) setDetailsOpen(detailsOpen)
  }, [detailsOpen])

  // ── 从结构化内容提取配方并真正保存到后端 /formulas ──
  // 保存前调用 AI 配方校验（/ai/formula/validate）：
  // - 有校验结果时弹出 FormulaValidationModal（成分级报告），用户确认后才 createFormula
  // - CRITICAL 阻断时弹窗内「确认保存」禁用，只能取消
  // - 有 warnings 未阻断 → 弹窗确认后保存，并把校验建议追加到 notes（【AI校验】前缀）
  // - 校验接口异常 → 不阻断保存但提示（诚实降级）
  const handleStructureSave = React.useCallback(async (messageId: string, content: string) => {
    const structured = detectStructuredContent(content)
    if (!structured) {
      logger.warn('[ChatTab] 消息内容不是结构化格式，无法保存:', messageId)
      showNotice('warning', t('ai.chat.notStructuredFormula'))
      return
    }
    const extracted = formulaExtractorService.extractFormulaFromContent(structured)
    if (!extracted) {
      logger.warn('[ChatTab] 未能从结构化内容中提取配方:', messageId)
      showNotice('warning', t('ai.chat.extractFormulaFailed'))
      return
    }

    // 剂量字符串 -> 克数（"10g" / "500mg" / "10-15g" / "约15克"）。区间取上限，
    // 单位统一归一化为克（g），非法单位返回 0（不阻断保存）。
    const parseDosage = (raw: string): number => parseDosageToGramsOrZero(raw)
    const totalAmount = extracted.ingredients.reduce((s, i) => s + parseDosage(i.dosage), 0)
    const ingredients = extracted.ingredients.map((i) => {
      const amount = parseDosage(i.dosage)
      return {
        name: i.name,
        amount,
        unit: 'g', // 剂量已统一换算为克
        percentage: totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0,
        role: i.role,
      }
    })

    // 机理摘要（专业配方设计卡：由各成分 mechanism 汇总）
    const mechanismSummary = extracted.ingredients
      .filter(i => i.mechanism)
      .map(i => `${i.name}：${i.mechanism}`)
      .join('；')
    // 监测与迭代建议 + 参考文献
    const professionalNotes = [
      extracted.monitoringAdvice ? `【监测与迭代】${extracted.monitoringAdvice}` : undefined,
      extracted.references?.length ? `【参考文献】${extracted.references.join('；')}` : undefined,
    ].filter(Boolean).join('\n\n')

    const payload: FormulaCreatePayload = {
      name: extracted.name,
      description: [
        extracted.description,
        extracted.rationale && `【配伍思路】${extracted.rationale}`,
        mechanismSummary && `【作用机理】${mechanismSummary}`,
      ].filter(Boolean).join('\n\n'),
      status: FormulaStatus.DRAFT,
      ingredients,
      effects: extracted.expectedEffects ?? [],
      target_effects: extracted.expectedEffects ?? [],
      dosage: extracted.dosageAdvice,
      processing_method: extracted.productionSteps?.length ? extracted.productionSteps.join('；') : undefined,
      notes: [
        extracted.precautions?.length ? `【注意事项】${extracted.precautions.join('；')}` : undefined,
        professionalNotes,
      ].filter(Boolean).join('\n\n'),
      composition: extracted.scores,
      version_notes: '由 AI 对话结构化内容导入',
    }

    // ── 保存前 AI 校验 ──
    let validation: AiFormulaValidationResponse | null = null
    let validationSkipped = false
    try {
      validation = await validateAiFormula({
        formula_name: extracted.name,
        ingredients: extracted.ingredients.map(i => ({ name: i.name, dosage_g: parseDosage(i.dosage) })),
        target_effects: extracted.expectedEffects ?? [],
      })
    } catch (e) {
      // 校验接口异常 → 不阻断保存，但明确提示校验服务不可用（诚实降级）
      validationSkipped = true
      logger.warn('[ChatTab] AI 配方校验服务调用失败，已跳过校验直接保存:', e)
    }

    if (validation) {
      // 有 warnings 但未阻断 → 先把校验建议追加到 payload.notes（【AI校验】前缀）
      const warnings = validation.warnings?.length
        ? validation.warnings
        : validation.alerts
            .filter(a => a.level === 'warning' || !a.blocking)
            .map(a => a.message)
      const suggestions = validation.suggestions?.length
        ? validation.suggestions
        : (validation.recommendations ?? [])
      if (warnings.length > 0 || suggestions.length > 0) {
        const aiNotes = [
          ...warnings.filter(Boolean),
          ...suggestions.map(s => `建议：${s}`),
        ].join('；')
        payload.notes = [payload.notes, `【AI校验】${aiNotes}`].filter(Boolean).join('\n\n')
      }

      // 弹出成分级校验报告，用户确认后才真正保存（CRITICAL 时确认按钮禁用）
      setValidationModal({ result: validation, formulaName: extracted.name, payload })
      return
    }

    // 校验接口异常 → 诚实降级：不阻断保存，直接落库
    try {
      const created = await createFormula(payload)
      if (validationSkipped) {
        // 诚实降级：保存成功但校验未执行，提示中明确说明
        showNotice('warning', t('ai.chat.formulaSavedValidationSkipped', { name: created.name ?? extracted.name }))
      } else {
        // 保存成功通知：附带「提交效果反馈」入口，打开 FeedbackModal
        showNotice(
          'success',
          t('ai.chat.formulaSaved', { name: created.name ?? extracted.name }),
          t('ai.chat.submitFeedback'),
          () => setFeedbackTarget({ formulaId: created.id, formulaName: created.name ?? extracted.name }),
        )
      }
      logger.info('[ChatTab] 配方已保存到配方库:', {
        formulaId: created.id,
        name: created.name,
        ingredients: ingredients.length,
        validationSkipped,
      })
    } catch (e) {
      logger.error('[ChatTab] 配方保存失败:', e)
      showNotice('error', t('ai.chat.formulaSaveFailed', { error: e instanceof Error ? e.message : t('ai.chat.serverRejectedRequest') }))
    }
  }, [showNotice, t])

  // 用户在校验报告弹窗中点击「确认保存」后真正落库
  const handleValidationConfirm = React.useCallback(async () => {
    if (!validationModal) return
    const { payload } = validationModal
    const formulaName = payload.name
    setValidationModal(null)
    try {
      const created = await createFormula(payload)
      // 保存成功通知：附带「提交效果反馈」入口，打开 FeedbackModal
      showNotice(
        'success',
        t('ai.chat.formulaSaved', { name: created.name ?? formulaName }),
        t('ai.chat.submitFeedback'),
        () => setFeedbackTarget({ formulaId: created.id, formulaName: created.name ?? formulaName }),
      )
      logger.info('[ChatTab] 校验确认后配方已保存到配方库:', {
        formulaId: created.id,
        name: created.name,
        validationSkipped: false,
      })
    } catch (e) {
      logger.error('[ChatTab] 配方保存失败:', e)
      showNotice('error', t('ai.chat.formulaSaveFailed', { error: e instanceof Error ? e.message : t('ai.chat.serverRejectedRequest') }))
    }
  }, [validationModal, showNotice, t])

  const handleStructureShare = React.useCallback((messageId: string, content: string) => {
    setShareModalContent({ messageId, content })
  }, [])

  // ── 结构化输出兜底：消息不是结构化 JSON 但看起来像配方时 ──
  // 调用后端 /ai/formula/repair-structured 修复为 blocks 结构化内容，
  // 成功后把修复结果转成结构化消息 JSON，复用 handleStructureSave 的提取+校验+保存流程。
  const handleStructureRepair = React.useCallback(async (messageId: string, content: string) => {
    showNotice('warning', t('ai.chat.repairingFormula'))
    try {
      const result = await repairStructuredFormula(content)
      if (result.success && result.structured && Array.isArray(result.structured.blocks) && result.structured.blocks.length > 0) {
        // 转成与一期 detectStructuredContent 兼容的消息 JSON（含 blocks）
        const structuredJson = JSON.stringify({
          responseType: 'formula',
          blocks: result.structured.blocks,
        })
        showNotice('success', t('ai.chat.repairSuccessSaving'))
        await handleStructureSave(messageId, structuredJson)
      } else {
        // 后端返回 success=false（LLM 不可用 / 解析失败）
        showNotice('error', result.message || t('ai.chat.repairFailedRetry'))
      }
    } catch (e) {
      logger.error('[ChatTab] 结构化修复调用失败:', e)
      showNotice('error', t('ai.chat.repairFailed', { error: e instanceof Error ? e.message : t('ai.chat.serverRejectedRequest') }))
    }
  }, [handleStructureSave, showNotice, t])

  // ── RAG 知识库：接入真实后端 /rag/*（不再硬编码禁用）──
  const handleTriggerSeed = React.useCallback(async () => {
    showNotice('warning', t('ai.chat.notice.ragSeeding'))
    try {
      const ok = await onTriggerSeed()
      if (ok) {
        showNotice('success', t('ai.chat.notice.ragSeedComplete'))
      } else {
        showNotice('warning', t('ai.chat.notice.ragSeedFailed'))
      }
    } catch {
      showNotice('error', t('ai.chat.notice.ragSeedFailed'))
    }
  }, [onTriggerSeed, showNotice, t])

  const handleToggleRAG = React.useCallback(() => {
    // 未 seed 时点击开关 → 先触发种子注入；已 seed 才切换 RAG 开关
    if (!ragIsSeeded) {
      void handleTriggerSeed()
      return
    }
    onToggleRAG()
  }, [ragIsSeeded, onToggleRAG, handleTriggerSeed])

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

      {/* 主内容区 — 展开态：fixed 覆盖层放大对话窗口（z-[60] 高于 DetailsPanel/notice 的 z-50）；
          折叠态：常规 flex 列。id="chat-stage" 供 TopBar 放大按钮 aria-controls 引用。 */}
      <div
        id="chat-stage"
        ref={chatStageRef}
        // 仅展开态宣告为模态对话框，折叠态是常驻非模态区域（不能恒标 dialog）
        role={chatExpanded ? 'dialog' : undefined}
        aria-modal={chatExpanded ? true : undefined}
        aria-label={chatExpanded ? t('ai.empty.chatAreaAria') : undefined}
        className={`flex flex-col flex-1 min-h-0 min-w-0 ${
          chatExpanded ? 'fixed inset-0 z-[60] bg-white dark:bg-neutral-950' : ''
        }`}
      >
        {/* ① 顶栏 */}
        <TopBar
          llmAvailable={llmAvailable}
          llmModel={llmModel}
          onModelChange={(model) => {
            // 模型切换：更新 store 并持久化，后续对话自动使用新模型
            useModelStore.getState().setSelectedModel(model)
            logger.debug('[ChatTab] Model switched to:', model)
          }}
          scenarioMode={scenarioMode}
          onScenarioSwitch={(mode) => useScenarioStore.getState().setMode(mode)}
          historyVisible={historyVisible}
          historySessions={historySessions}
          onToggleHistory={toggleHistory}
          ragEnabled={ragEnabled}
          ragIsSeeded={ragIsSeeded}
          ragIsSeeding={ragIsSeeding}
          onToggleRAG={handleToggleRAG}
          onTriggerSeed={handleTriggerSeed}
          formulaCount={formulaCount}
          onShowFormulaList={() => setShowFormulaList(true)}
          messageCount={messages.length}
          onClearChat={handleClearChat}
          onOpenKBPanel={() => onOpenKnowledgeTab?.()}
          onOpenUserProfile={() => setShowUserProfileSettings(true)}
          onToggleSearch={() => setSearchOpen(v => !v)}
          searchOpen={searchOpen}
          // 放大/还原对话窗口：传 expanded + onToggleExpand 后 TopBar 才渲染放大按钮（⑤½）
          expanded={chatExpanded}
          onToggleExpand={toggleChatExpand}
          expandTriggerRef={expandTriggerRef}
          // 传入真实翻译函数，确保 TopBar 文案随全局语言切换
          t={t}
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
                    <p className="text-sm font-medium text-error-800 dark:text-error-700">{t('ai.chat.chatTab.chatError')}</p>
                    <p className="text-xs text-error-600 dark:text-error-700 mt-0.5 truncate">
                      {chatError instanceof Error ? chatError.message : String(chatError)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={handleRetry}>{t('ai.chat.chatTab.retry')}</Button>
                      <Button variant="ghost" size="sm" onClick={clearError}>{t('ai.chat.chatTab.close')}</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {messages.length === 0 && (
              <EmptyStateCard
                welcomeTitle={t('ai.chat.chatTab.welcomeTitle')}
                welcomeSubtitle={t('ai.chat.chatTab.welcomeSubtitle')}
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
                  showNotice('warning', t('ai.chat.notice.reportGenerating'))
                  return
                }
                if (formulaCount === 0) {
                  showNotice('warning', t('ai.chat.notice.noFormulaData'))
                  return
                }
                showNotice('success', t('ai.chat.notice.reportStarted'))
                // 汇总当前会话识别出的全部配方；useReportGenerator 内部会做缓存与版本记录
                handleGenerateReport().catch((err) => {
                  const msg = err instanceof Error ? err.message : String(err ?? t('ai.chat.notice.unknownError'))
                  showNotice('error', t('ai.chat.notice.reportFailed', { error: msg }))
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
              thinkingSteps={thinkingSteps}
              onStructureSave={handleStructureSave}
              onStructureShare={handleStructureShare}
              onStructureRepair={handleStructureRepair}
            />

            {/* RAG 知识库检索来源横幅 */}
            <RAGSourcesBanner
              isEnabled={ragEnabled}
              chunks={ragChunks}
              sources={ragLastSources}
              onDismiss={ragClearChunks}
            />

            {/* 追问建议栏 */}
            {!isStreaming && messages.length > 0 && (
              <FollowUpSuggestionsBar
                onSendSuggestion={(question) => {
                  setInput(question)
                  handleSend(question)
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

        {/* ③ 输入区：主题令牌（--bg-secondary/--border-color） */}
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
          {/* 暂停条 */}
          {isStreaming && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-tertiary)]/40">
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                {t('ai.chat.chatTab.generating')}
              </span>
              <button onClick={pauseStreaming}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] dark:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <Pause className="w-2.5 h-2.5" />
                {t('ai.chat.chatTab.pause')}
              </button>
            </div>
          )}
          {/* 实时进度条（输入框上方，由 SSE progress 事件驱动） */}
          <ChatProgressBar />
          <ChatInputPro
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            onStop={() => pauseStreaming()}
            isStreaming={isStreaming}
            maxLength={2000}
            placeholder={t('ai.chat.input.placeholder')}
            modelName={llmModel || 'deepseek-chat'}
            modelColor="text-success-500"
            onSlashSelect={(cmd) => {
              setInput('/' + cmd + ' ')
              handleSend('/' + cmd)
            }}
            onModelChange={(model) => {
              useModelStore.getState().setSelectedModel(model)
              logger.debug('[ChatTab] Model switched to:', model)
            }}
          />
          <ComposerStatusBar
            messageCount={messages.length}
            assistantCount={assistantCount}
            elapsedSeconds={elapsedSeconds}
            modelName={llmModel || undefined}
            ragStatus={ragEnabled ? (ragIsSeeded ? t('ai.chat.composer.ragReady') : null) : null}
          />
        </div>

        {/* Details 面板 — 移动端为全屏抽屉，sm+ 恢复为右侧内嵌列 */}
        {detailsOpenLocal && detailsCallLocal && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[320px] flex-shrink-0 border-l border-[var(--border-color)] overflow-hidden sm:static sm:z-auto sm:w-[320px] sm:max-w-none">
            <DetailsPanel
              selectedCall={{ ...detailsCallLocal, arguments: detailsCallLocal.args } as unknown as ToolCall}
              onClose={() => setDetailsOpen(false)}
              title={t('ai.chat.toolCallDetail')}
            />
          </div>
        )}

        {/* 健康画像设置面板（懒加载） */}
        {showUserProfileSettings && (
          <React.Suspense fallback={null}>
            <UserProfileSettingsPanel
              onClose={() => setShowUserProfileSettings(false)}
            />
          </React.Suspense>
        )}

        {/* 配方分享模态框（懒加载） */}
        {shareModalContent && (
          <React.Suspense fallback={null}>
            <FormulaShareModal
              content={detectStructuredContent(shareModalContent.content) ?? { blocks: [], responseType: 'general'}}
              onClose={() => setShareModalContent(null)}
            />
          </React.Suspense>
        )}

        {/* 配方列表面板（懒加载）— 点击 TopBar「配方面板」打开 */}
        {showFormulaList && (
          <React.Suspense fallback={null}>
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
              onClearStorage={onClearStorage}
              onClearMemory={formulaActions.handleClearMemoryCache}
              isGeneratingReport={isGeneratingReport}
              onClose={() => setShowFormulaList(false)}
              onBatchExport={formulaActions.handleBatchExport}
              onBatchDelete={formulaActions.handleBatchDelete}
              onBatchTag={formulaActions.handleBatchTag}
              onSelectAll={formulaActions.handleSelectAll}
              clearSelection={formulaActions.handleClearSelection}
              onRenameFormula={formulaActions.handleRenameFormula}
              getFormulaScore={formulaActions.getFormulaScore}
              onToggleFavorite={formulaActions.handleToggleFavorite}
              onBatchFavorite={formulaActions.handleBatchFavorite}
              onCompare={formulaActions.handleCompare}
              onSetPriority={formulaActions.handleSetPriority}
              onGetVersions={formulaActions.handleGetVersions}
              onRollbackVersion={formulaActions.handleRollbackVersion}
              onAddTag={formulaActions.handleAddTag}
              onRemoveTag={formulaActions.handleRemoveTag}
              storageError={formulaStorageError}
              onDismissStorageError={clearFormulaStorageError}
              onUndoBatchDelete={undoBatchDelete}
              canUndoBatchDelete={canUndoBatchDelete}
              batchLimitExceeded={batchLimitExceeded}
              onDismissBatchLimit={clearBatchLimitExceeded}
            />
          </React.Suspense>
        )}

        {/* 聊天消息搜索浮层（懒加载） */}
        {searchOpen && (
          <React.Suspense fallback={null}>
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
          </React.Suspense>
        )}

        {/* 专业配方报告模态框（懒加载）
            注意：ProfessionalReport 内部 report.sections / report.title 无空值守卫，
            所以必须同时要求 reportData 存在才渲染，不能只看 showReportModal。 */}
        {showReportModal && !!reportData && (
          <React.Suspense fallback={null}>
            <ProfessionalReportModal
              report={reportData as ProfessionalReportModalProps['report']}
              isLoading={isGeneratingReport}
              onClose={() => setShowReportModal(false)}
            />
          </React.Suspense>
        )}

        {/* 配方效果反馈模态框（懒加载） */}
        {feedbackTarget && (
          <React.Suspense fallback={null}>
            <FeedbackModal
              formulaId={feedbackTarget.formulaId}
              formulaName={feedbackTarget.formulaName}
              onClose={() => setFeedbackTarget(null)}
            />
          </React.Suspense>
        )}

        {/* 成分级配方校验报告弹窗：用户确认后才真正保存 */}
        <FormulaValidationModal
          open={!!validationModal}
          result={validationModal?.result ?? null}
          formulaName={validationModal?.formulaName}
          onConfirm={() => void handleValidationConfirm()}
          onCancel={() => setValidationModal(null)}
        />

        {/* 操作反馈提示：成功 / 后端未提供端点 / 失败 */}
        {notice && (
          <div
            role="status"
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full
              text-xs font-medium shadow-lg animate-fade-in text-white flex items-center gap-3 ${
                notice.kind === 'success'
                  ? 'bg-success-500'
                  : notice.kind === 'error'
                    ? 'bg-error-500'
                    : 'bg-warning-500'
              }`}
          >
            <span>{notice.kind === 'success' ? '✓ ' : '⚠ '}{notice.text}</span>
            {notice.actionLabel && notice.onAction && (
              <button
                type="button"
                onClick={notice.onAction}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                {notice.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatTab
