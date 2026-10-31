/**
 * TopBar — DSH 风格极简顶栏 (v4.0)
 *
 * 设计原则（对标 DeepSeek Harness）：
 * - 单行布局，高度紧凑（~48px）
 * - 左侧：AI 头像 + 标题 + 历史按钮
 * - 右侧：模型选择(下拉) | 场景切换(常驻按钮) | RAG开关(常驻按钮) | 设置(齿轮)
 * - 三个子模块直接可见，不再隐藏在 Settings 菜单中
 *
 * @version 4.0.0
 */
import React, { useState, useRef, useEffect } from 'react'
import type { TFunction } from 'i18next'
import {
  Leaf,
  MessageSquare,
  Database,
  Settings,
  ChevronDown,
  GraduationCap,
  Shield,
  Wrench,
  Zap,
  Trash2,
  FileText,
  UserCircle,
  Search as SearchIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ScenarioMode } from '../services/scenarioSwitcher'
import type { HistorySession } from './pro'
import { useModelStore, getModelMeta } from '@/stores/modelStore'
import type { ModelMeta } from '@/stores/modelStore'

// ─── 模型配置（动态从 useModelStore 获取，见下方组件内逻辑） ────────

// ─── 场景模式配置 ──────────────────────────────────────────────────
const SCENARIO_OPTIONS: Array<{ mode: ScenarioMode; icon: LucideIcon; labelKey: string }> = [
  { mode: 'academician', icon: GraduationCap, labelKey: 'scenarioAcademician' },
  { mode: 'safety_off', icon: Shield, labelKey: 'scenarioSafety' },
  { mode: 'process_eng', icon: Wrench, labelKey: 'scenarioProcess' },
  { mode: 'concise_adv', icon: Zap, labelKey: 'scenarioConcise' },
]

function getScenarioIcon(mode: ScenarioMode): LucideIcon {
  const opt = SCENARIO_OPTIONS.find(s => s.mode === mode)
  return opt?.icon ?? GraduationCap
}

// ─── Props ─────────────────────────────────────────────────────────
export interface TopBarProps {
  llmAvailable: boolean
  llmModel: string
  onModelChange?: (modelId: string) => void
  scenarioMode: ScenarioMode
  onScenarioSwitch: (mode: ScenarioMode) => void
  historyVisible: boolean
  historySessions: HistorySession[]
  onToggleHistory: () => void
  ragEnabled: boolean
  ragIsSeeded: boolean
  ragIsSeeding: boolean
  onToggleRAG: () => void
  onTriggerSeed: () => void
  formulaCount: number
  onShowFormulaList: () => void
  messageCount: number
  onClearChat: () => void
  onOpenKBPanel?: () => void
  onOpenUserProfile?: () => void
  onToggleSearch?: () => void
  searchOpen?: boolean
  t: TFunction
}

// ─── Dropdown 组件 ─────────────────────────────────────────────────
function Dropdown({ trigger, children, className = '' }: {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* 外层用 div 而非 button，避免 trigger（本身是 button）嵌套 button 导致 HTML 非法 */}
      <div onClick={() => setOpen(!open)} className="h-full cursor-pointer">
        {trigger}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-30"  role="button" tabIndex={0} onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-40 bg-white dark:bg-neutral-800 rounded-lg shadow-md border border-neutral-200 dark:border-neutral-700 py-1 min-w-[180px]">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Settings Menu（仅保留配方面板 + 清除）──────────────────────────
function SettingsMenu({
  formulaCount, onShowFormulaList,
  messageCount, onClearChat, t,
}: {
  formulaCount: number
  onShowFormulaList: () => void
  messageCount: number
  onClearChat: () => void
  t: TFunction
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  return (
    <Dropdown trigger={
      <button
        className="p-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label={t('ai.chat.topbar.settings')} title={t('ai.chat.topbar.settings')}
      >
        <Settings className="w-4 h-4" />
      </button>
    }>
      {/* 配方面板 */}
      <button onClick={onShowFormulaList}
        className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
        <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        <div className="flex-1 min-w-0">
          <div className="text-neutral-800 dark:text-neutral-200 font-medium text-xs">{t('ai.chat.topbar.formulaPanel')}</div>
          {formulaCount > 0 && <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('ai.chat.topbar.formulaCount', { count: formulaCount })}</div>}
        </div>
      </button>
      {/* 分隔 */}
      <div className="h-px bg-neutral-100 dark:bg-neutral-700 my-1" />
      {/* 清除 */}
      {showConfirm ? (
        <div className="px-3 py-2">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{t('ai.chat.topbar.clearChatConfirm', { count: messageCount })}</p>
          <div className="flex gap-1.5">
            <button onClick={() => { onClearChat(); setShowConfirm(false) }}
              className="flex-1 px-2 py-1 text-xs bg-error-500 text-white rounded hover:bg-error-600 transition-colors">{t('ai.chat.topbar.confirm')}</button>
            <button onClick={() => setShowConfirm(false)}
              className="flex-1 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded hover:bg-neutral-200 transition-colors">{t('ai.chat.topbar.cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowConfirm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('ai.chat.topbar.clearChat')}</span>
          {messageCount > 0 && (
            <span className="ml-auto text-xs bg-error-100 dark:bg-error-300/30 px-1 py-0.5 rounded-full">{messageCount}</span>
          )}
        </button>
      )}
    </Dropdown>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────
export function TopBar({
  llmModel, onModelChange,
  scenarioMode, onScenarioSwitch,
  historyVisible, historySessions, onToggleHistory,
  ragEnabled, ragIsSeeded, ragIsSeeding,
  onToggleRAG, onTriggerSeed,
  formulaCount, onShowFormulaList,
  messageCount, onClearChat, onOpenKBPanel,
  onOpenUserProfile, onToggleSearch, searchOpen, t,
}: TopBarProps) {
  // 动态模型列表：从 store 获取，若无则降级为已知提供商默认模型
  const { selectedModel, availableModels } = useModelStore()
  const effectiveModel = selectedModel || llmModel || ''
  const currentModel: ModelMeta = getModelMeta(effectiveModel)
  const dynamicModels: ModelMeta[] = (availableModels.length > 0 ? availableModels : [
    'deepseek-chat', 'gpt-4o-mini', 'glm-4-flash',
  ]).map(getModelMeta)
  const ScenarioIcon = getScenarioIcon(scenarioMode)
  const currentScenario = SCENARIO_OPTIONS.find(s => s.mode === scenarioMode) || SCENARIO_OPTIONS[0]

  return (
    <div className="flex items-center justify-between h-[44px] px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-shrink-0">
      {/* 左侧：头像 + 标题 + 历史 */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-neutral-900 dark:text-white tracking-tight">
          {t('ai.chat.chatTab.title', '智能对话')}
        </span>
        <button
          onClick={onToggleHistory}
          className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs transition-colors ${
            historyVisible
              ? 'text-success-700 dark:text-success-600 bg-success-50 dark:bg-success-300/20'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title={t('ai.chat.topbar.chatHistory')}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {historySessions.length > 0 && (
            <span className="min-w-[14px] h-4 px-1 flex items-center justify-center text-xs font-semibold bg-success-100 dark:bg-success-300/30 text-success-700 dark:text-success-700 rounded-full">
              {historySessions.length}
            </span>
          )}
        </button>
      </div>

      {/* 右侧：控制栏 — 三个子模块常驻可见 */}
      <div className="flex items-center gap-1">
        {/* ① 模型选择（下拉） */}
        <Dropdown trigger={
          <button title={t('ai.chat.topbar.switchModel')}
            className="flex items-center gap-1.5 px-2 py-1 min-h-[36px] rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
            <span className={currentModel.color}><Leaf className="w-3 h-3" /></span>
            <span className="hidden md:inline">{currentModel.label}</span>
            <ChevronDown className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
        }>
          {dynamicModels.map(m => (
            <button key={m.id} onClick={() => onModelChange?.(m.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
              <span className={m.color}><Leaf className="w-3.5 h-3.5" /></span>
              <div>
                <div className="text-neutral-800 dark:text-neutral-200 font-medium text-xs">{m.label}</div>
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{m.descKey ? t(`ai.chat.topbar.${m.descKey}`) : ''}</div>
              </div>
            </button>
          ))}
        </Dropdown>

        {/* 分隔 */}
        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        {/* ② 场景模式切换 — 常驻按钮（非下拉） */}
        <button
          onClick={() => {
            const idx = SCENARIO_OPTIONS.findIndex(s => s.mode === scenarioMode)
            const next = SCENARIO_OPTIONS[(idx + 1) % SCENARIO_OPTIONS.length]
            onScenarioSwitch(next.mode)
          }}
          title={t('ai.chat.topbar.switchRole', { label: t(`ai.chat.topbar.${currentScenario.labelKey}`) })}
          className="flex items-center gap-1 px-2 py-1 min-h-[36px] rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <ScenarioIcon className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <span className="hidden sm:inline">{t(`ai.chat.topbar.${currentScenario.labelKey}`)}</span>
        </button>

        {/* 分隔 */}
        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        {/* ③ RAG知识库 — 常驻开关 + 管理（外层用 div，避免按钮嵌套） */}
        <div
          className={`flex items-center gap-1 px-2 py-1 min-h-[36px] rounded-md text-xs font-medium border transition-colors ${
            ragEnabled && ragIsSeeded
              ? 'bg-success-50 dark:bg-success-300/20 border-success-200 dark:border-success-800 text-success-700 dark:text-success-700 hover:bg-success-100 dark:hover:bg-success-900/30'
              : ragEnabled && ragIsSeeding
                ? 'bg-warning-50 dark:bg-warning-300/20 border-warning-200 dark:border-warning-800 text-warning-600 dark:text-warning-700 cursor-wait'
                : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:border-neutral-300 dark:hover:border-neutral-700'
          }`}
        >
          <button
            onClick={() => {
              if (ragEnabled && ragIsSeeded) onToggleRAG()
              else if (!ragEnabled) onToggleRAG()
              else onTriggerSeed()
            }}
            disabled={ragIsSeeding}
            title={
              !ragEnabled ? t('ai.chat.topbar.ragEnable') :
              ragIsSeeding ? t('ai.chat.topbar.ragSeeding') :
              ragIsSeeded ? t('ai.chat.topbar.ragDisable') :
              t('ai.chat.topbar.ragSeeding')
            }
            className="flex items-center gap-1"
          >
            <Database className={`w-3.5 h-3.5 ${ragEnabled && ragIsSeeded ? 'text-success-500' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} />
            <span className="hidden sm:inline">
              {ragIsSeeding
                ? t('ai.chat.topbar.ragInitializing')
                : ragEnabled && ragIsSeeded
                  ? t('ai.chat.topbar.ragOn')
                  : !ragEnabled && !ragIsSeeded
                    ? t('ai.chat.topbar.ragInit')
                    : !ragEnabled
                      ? t('ai.chat.topbar.ragOff')
                      : t('ai.chat.topbar.ragReady')}
            </span>
          </button>
          {ragEnabled && ragIsSeeded && (
            <button onClick={onOpenKBPanel}
              className="ml-1 px-1.5 py-0.5 text-xs bg-success-200/60 dark:bg-success-800/40 text-success-700 dark:text-success-700 rounded hover:bg-success-200 transition-colors">
              {t('ai.chat.topbar.ragManage')}
            </button>
          )}
        </div>

        {/* 分隔 */}
        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        {/* ④ 健康画像 */}
        {onOpenUserProfile && (
          <button
            onClick={onOpenUserProfile}
            title={t('ai.chat.topbar.healthProfile')}
            className="p-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <UserCircle className="w-4 h-4" />
          </button>
        )}

        {/* ⑤ 搜索 */}
        {onToggleSearch && (
          <button
            onClick={onToggleSearch}
            title={searchOpen ? t('ai.chat.topbar.closeSearch') : t('ai.chat.topbar.searchMessages')}
            className={`p-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md transition-colors ${
              searchOpen
                ? 'text-primary-500 bg-primary-50 dark:bg-primary-300/20'
                : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        )}

        {/* ⑥ 设置（仅保留配方面板 + 清除对话） */}
        <SettingsMenu
          formulaCount={formulaCount}
          onShowFormulaList={onShowFormulaList}
          messageCount={messageCount}
          onClearChat={onClearChat}
          t={t}
        />
      </div>
    </div>
  )
}

export default TopBar
