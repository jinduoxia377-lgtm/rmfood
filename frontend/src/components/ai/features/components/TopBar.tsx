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
import { useTranslation } from 'react-i18next'
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

// ─── 模型配置 ──────────────────────────────────────────────────────
const MODELS: { id: string; label: string; desc: string; color: string }[] = [
  { id: 'deepseek-chat', label: 'DeepSeek', desc: '深度推理', color: 'text-emerald-500' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: '快速响应', color: 'text-blue-500' },
  { id: 'glm-4-flash', label: 'GLM-4 Flash', desc: '本地优化', color: 'text-violet-500' },
]

// ─── 场景模式配置 ──────────────────────────────────────────────────
const SCENARIO_OPTIONS: Array<{ mode: ScenarioMode; icon: LucideIcon; label: string }> = [
  { mode: 'academician', icon: GraduationCap, label: '学者顾问' },
  { mode: 'safety_off', icon: Shield, label: '安全专员' },
  { mode: 'process_eng', icon: Wrench, label: '工艺工程师' },
  { mode: 'concise_adv', icon: Zap, label: '精简顾问' },
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
  t: (key: string, fallback?: string) => string
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
      <button onClick={() => setOpen(!open)} className="h-full">
        {trigger}
      </button>
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
  messageCount, onClearChat,
}: {
  formulaCount: number
  onShowFormulaList: () => void
  messageCount: number
  onClearChat: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  return (
    <Dropdown trigger={
      <button
        className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="设置" title="设置"
      >
        <Settings className="w-4 h-4" />
      </button>
    }>
      {/* 配方面板 */}
      <button onClick={onShowFormulaList}
        className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
        <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        <div className="flex-1 min-w-0">
          <div className="text-neutral-800 dark:text-neutral-200 font-medium text-xs">配方面板</div>
          {formulaCount > 0 && <div className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formulaCount} 条配方</div>}
        </div>
      </button>
      {/* 分隔 */}
      <div className="h-px bg-neutral-100 dark:bg-neutral-700 my-1" />
      {/* 清除 */}
      {showConfirm ? (
        <div className="px-3 py-2">
          <p className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">清空 {messageCount} 条对话？</p>
          <div className="flex gap-1.5">
            <button onClick={() => { onClearChat(); setShowConfirm(false) }}
              className="flex-1 px-2 py-1 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 transition-colors">确认</button>
            <button onClick={() => setShowConfirm(false)}
              className="flex-1 px-2 py-1 text-[10px] bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded hover:bg-neutral-200 transition-colors">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowConfirm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
          <span>清除对话</span>
          {messageCount > 0 && (
            <span className="ml-auto text-[9px] bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded-full">{messageCount}</span>
          )}
        </button>
      )}
    </Dropdown>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────
export function TopBar({
  llmAvailable, llmModel, onModelChange,
  scenarioMode, onScenarioSwitch,
  historyVisible, historySessions, onToggleHistory,
  ragEnabled, ragIsSeeded, ragIsSeeding,
  onToggleRAG, onTriggerSeed,
  formulaCount, onShowFormulaList,
  messageCount, onClearChat, onOpenKBPanel,
  onOpenUserProfile, onToggleSearch, searchOpen, t,
}: TopBarProps) {
  const currentModel = MODELS.find(m => m.id === llmModel) || MODELS[0]
  const ScenarioIcon = getScenarioIcon(scenarioMode)
  const currentScenario = SCENARIO_OPTIONS.find(s => s.mode === scenarioMode) || SCENARIO_OPTIONS[0]

  return (
    <div className="flex items-center justify-between h-[44px] px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-shrink-0">
      {/* 左侧：头像 + 标题 + 历史 */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-neutral-900 dark:text-white tracking-tight">
          {t('ai.chat.chatTab.title', '智能对话')}
        </span>
        <button
          onClick={onToggleHistory}
          className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs transition-colors ${
            historyVisible
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
              : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title="对话历史"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {historySessions.length > 0 && (
            <span className="min-w-[14px] h-4 px-1 flex items-center justify-center text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
              {historySessions.length}
            </span>
          )}
        </button>
      </div>

      {/* 右侧：控制栏 — 三个子模块常驻可见 */}
      <div className="flex items-center gap-1">
        {/* ① 模型选择（下拉） */}
        <Dropdown trigger={
          <button title="切换模型"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
            <span className={currentModel.color}><Leaf className="w-3 h-3" /></span>
            <span className="hidden md:inline">{currentModel.label}</span>
            <ChevronDown className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
        }>
          {MODELS.map(m => (
            <button key={m.id} onClick={() => onModelChange?.(m.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
              <span className={m.color}><Leaf className="w-3.5 h-3.5" /></span>
              <div>
                <div className="text-neutral-800 dark:text-neutral-200 font-medium text-xs">{m.label}</div>
                <div className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{m.desc}</div>
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
          title={`切换角色：${currentScenario.label}`}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
        >
          <ScenarioIcon className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <span className="hidden sm:inline">{currentScenario.label}</span>
        </button>

        {/* 分隔 */}
        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        {/* ③ RAG知识库 — 常驻开关按钮 */}
        <button
          onClick={() => {
            if (ragEnabled && ragIsSeeded) onToggleRAG()
            else if (!ragEnabled) onToggleRAG()
            else onTriggerSeed()
          }}
          disabled={ragIsSeeding}
          title={
            !ragEnabled ? '启用知识库检索' :
            ragIsSeeding ? '知识库初始化中…' :
            ragIsSeeded ? '关闭知识库检索' :
            '知识库初始化中'
          }
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
            ragEnabled && ragIsSeeded
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
              : ragEnabled && ragIsSeeding
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 cursor-wait'
                : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:border-neutral-300 dark:hover:border-neutral-700'
          }`}
        >
          <Database className={`w-3.5 h-3.5 ${ragEnabled && ragIsSeeded ? 'text-emerald-500' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} />
          <span className="hidden sm:inline">
            {ragIsSeeding ? '初始化…' : ragEnabled && ragIsSeeded ? '知识库ON' : !ragEnabled ? '知识库OFF' : '准备中'}
          </span>
          {ragEnabled && ragIsSeeded && (
            <button onClick={onOpenKBPanel}
              className="ml-1 px-1.5 py-0.5 text-[9px] bg-emerald-200/60 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 transition-colors">
              管理
            </button>
          )}
        </button>

        {/* 分隔 */}
        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

        {/* ④ 健康画像 */}
        {onOpenUserProfile && (
          <button
            onClick={onOpenUserProfile}
            title="健康画像"
            className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <UserCircle className="w-4 h-4" />
          </button>
        )}

        {/* ⑤ 搜索 */}
        {onToggleSearch && (
          <button
            onClick={onToggleSearch}
            title={searchOpen ? '关闭搜索' : '搜索消息'}
            className={`p-1.5 rounded-md transition-colors ${
              searchOpen
                ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20'
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
        />
      </div>
    </div>
  )
}

export default TopBar
