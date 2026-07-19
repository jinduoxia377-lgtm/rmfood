/**
 * TopBar - 对话顶栏组件 (v1.0)
 *
 * 职责：
 * - 渲染 AI 头像、模型状态徽章、场景模式徽章
 * - 渲染右侧操作区：历史切换、主题切换、RAG 开关、配方计数、清除按钮
 * - 渲染 LLM 离线态引导横幅
 * - 渲染 RAG 知识库未初始化引导横幅
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Brain,
  MessageSquare,
  Palette,
  Database,
  FlaskConical,
  X,
  Info,
  AlertTriangle,
  Loader2,
  GraduationCap,
  Shield,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { ScenarioMode } from '../services/scenarioSwitcher'
import type { HistorySession } from './pro'

interface TopBarProps {
  // 模型状态
  llmAvailable: boolean
  llmModel: string
  // 场景模式
  scenarioMode: ScenarioMode
  scenarioDisplayName: string
  onScenarioSwitch: (mode: ScenarioMode) => void
  // 会话管理
  historyVisible: boolean
  historySessions: HistorySession[]
  onToggleHistory: () => void
  // 主题
  scheme: string
  schemeNameCN?: string
  onCycleScheme: () => void
  // RAG
  ragEnabled: boolean
  ragHasActiveChunks: boolean
  ragIsSeeded: boolean
  ragIsSeeding: boolean
  onToggleRAG: () => void
  onTriggerSeed: () => void
  // 配方
  formulaCount: number
  onShowFormulaList: () => void
  // 清除
  messageCount: number
  onClearChat: () => void
  // 翻译
  t: (key: string, fallback?: string) => string
}

// 场景模式配置
const SCENARIO_OPTIONS: {
  mode: ScenarioMode
  icon: LucideIcon
  label: string
  activeColor: string
}[] = [
  { mode: 'academician', icon: GraduationCap, label: '学者顾问', activeColor: 'text-secondary-600 dark:text-secondary-400 active:bg-secondary-100 dark:active:bg-secondary-900/30' },
  { mode: 'safety_off', icon: Shield, label: '安全专员', activeColor: 'text-error-600 dark:text-error-400 active:bg-error-100 dark:active:bg-error-900/30' },
  { mode: 'process_eng', icon: Wrench, label: '工艺工程师', activeColor: 'text-orange-600 dark:text-orange-400 active:bg-orange-100 dark:active:bg-orange-900/30' },
  { mode: 'concise_adv', icon: Zap, label: '精简顾问', activeColor: 'text-primary-600 dark:text-primary-400 active:bg-primary-100 dark:active:bg-primary-900/30' },
]

export function TopBar({
  llmAvailable,
  llmModel,
  scenarioMode,
  scenarioDisplayName,
  onScenarioSwitch,
  historyVisible,
  historySessions,
  onToggleHistory,
  scheme,
  schemeNameCN,
  onCycleScheme,
  ragEnabled,
  ragHasActiveChunks,
  ragIsSeeded,
  ragIsSeeding,
  onToggleRAG,
  onTriggerSeed,
  formulaCount,
  onShowFormulaList,
  messageCount,
  onClearChat,
  t,
}: TopBarProps) {
  return (
    <>
      {/* 顶部栏 */}
      <div className="flex items-center justify-between p-4 border-b dark:border-neutral-700 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-tertiary)] dark:from-slate-900 dark:to-slate-800">
        {/* 左侧：AI 头像 + 标题 + 徽章 */}
        <div className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25 transition-transform duration-200 group-hover:scale-110">
              <Brain className="w-5 h-5 text-white" />
            </div>
            {llmAvailable && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success-500 rounded-full border-2 border-white dark:border-neutral-900 shadow-md" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-neutral-900 dark:text-white tracking-tight">
              {t('ai.chat.chatTab.title', '智能对话')}
            </span>
            {/* 模型状态徽章 */}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                llmAvailable
                  ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {llmAvailable ? llmModel : t('ai.chat.chatTab.offlineMode', '离线模式')}
            </span>
            {/* 场景模式徽章 */}
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700">
              {scenarioDisplayName}
            </span>
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-3">
          {/* 对话历史切换 */}
          <button
            onClick={onToggleHistory}
            aria-label="对话历史"
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 ${
              historyVisible
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                : 'bg-slate-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600 active:bg-neutral-100 dark:active:bg-neutral-700'
            }`}
            title="对话历史"
          >
            <MessageSquare className="w-4 h-4" />
            {historySessions.length > 0 && <span className="text-xs font-medium">{historySessions.length}</span>}
          </button>

          {/* 主题切换 */}
          <button
            onClick={onCycleScheme}
            aria-label="切换主题"
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 bg-slate-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 active:bg-neutral-100 dark:active:bg-neutral-700"
            title={`切换主题: ${schemeNameCN || scheme}`}
          >
            <Palette className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">{schemeNameCN || scheme}</span>
          </button>

          {/* RAG 知识库开关 */}
          <button
            onClick={onToggleRAG}
            aria-label="RAG知识库"
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 ${
              ragEnabled
                ? 'bg-primary-50 dark:bg-primary-900/20 border-emerald-300 dark:border-emerald-700 text-primary-600 dark:text-primary-400'
                : 'bg-slate-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-600 active:bg-neutral-100 dark:active:bg-neutral-700'
            }`}
            title={ragEnabled ? '知识库检索已开启' : '知识库检索已关闭'}
          >
            <Database className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">知识库</span>
            {ragHasActiveChunks && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* 配方计数 */}
          <button
            onClick={onShowFormulaList}
            aria-label="已生成配方数"
            className="relative flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 hover:shadow-md active:scale-95"
            title={`${formulaCount} 个配方`}
          >
            <FlaskConical className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{formulaCount}</span>
            {formulaCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* 场景模式切换器 */}
          <div
            role="radiogroup"
            aria-label="场景模式"
            className="flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800/50 p-0.5"
          >
            {SCENARIO_OPTIONS.map(({ mode: m, icon: Icon, activeColor }) => (
              <button
                key={m}
                role="radio"
                aria-checked={scenarioMode === m}
                onClick={() => onScenarioSwitch(m)}
                title={SCENARIO_OPTIONS.find((o) => o.mode === m)?.label}
                className={`flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-md transition-all duration-200 active:scale-95 ${
                  scenarioMode === m
                    ? `${activeColor} bg-white dark:bg-neutral-700 shadow-sm scale-105`
                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 active:bg-neutral-200 dark:active:bg-neutral-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {/* 清除按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            disabled={messageCount === 0}
            className="h-8 px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-error-600 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all duration-200"
          >
            <X className="w-4 h-4 mr-1" />
            {t('ai.chat.chatTab.clear', '清空')}
          </Button>
        </div>
      </div>

      {/* LLM 离线态引导 */}
      {!llmAvailable && (
        <div
          role="status"
          className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-warning-50 dark:bg-warning-900/20"
        >
          <Info className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
              {t('ai.chat.chatTab.offlineBannerTitle', '规则兜底模式')}
            </p>
            <p className="text-xs text-warning-700/90 dark:text-warning-300/90 mt-0.5 leading-relaxed">
              {t(
                'ai.chat.chatTab.offlineBannerDesc',
                '未检测到大模型 API Key，当前回答基于内置规则引擎。前往「配置管理」标签页配置 API Key 后可启用完整 AI 能力。',
              )}
            </p>
          </div>
        </div>
      )}

      {/* RAG 未初始化引导 */}
      {ragEnabled && !ragIsSeeded && (
        <div
          role="status"
          className="flex items-start gap-3 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800/50 bg-cyan-50 dark:bg-cyan-900/20"
        >
          <AlertTriangle className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cyan-800 dark:text-cyan-200">
              {t('ai.chat.chatTab.ragNotSeededTitle', '知识库尚未初始化')}
            </p>
            <p className="text-xs text-cyan-700/90 dark:text-cyan-300/90 mt-0.5 leading-relaxed">
              {t(
                'ai.chat.chatTab.ragNotSeededDesc',
                '知识库检索已开启，但向量库暂无数据，RAG 检索将不会返回结果。点击下方按钮注入内置知识后即可生效。',
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onTriggerSeed}
              disabled={ragIsSeeding}
              className="mt-2.5"
            >
              {ragIsSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  {t('ai.chat.chatTab.ragSeeding', '初始化中...')}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-1.5" />
                  {t('ai.chat.chatTab.ragSeedNow', '初始化知识库')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
