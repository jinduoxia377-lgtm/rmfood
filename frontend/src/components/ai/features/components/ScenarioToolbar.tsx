/**
 * ScenarioToolbar - 场景模式切换工具栏组件 (v1.0)
 *
 * 职责：
 * - 渲染 4 种场景模式的切换按钮（学者顾问/安全专员/工艺工程师/精简顾问）
 * - 通过回调通知父组件模式切换
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import React from 'react'
import { GraduationCap, Shield, Wrench, Zap, type LucideIcon } from 'lucide-react'
import type { ScenarioMode } from '../services/scenarioSwitcher'

interface ScenarioOption {
  mode: ScenarioMode
  icon: LucideIcon
  label: string
  activeColor: string
}

interface ScenarioToolbarProps {
  mode: ScenarioMode
  onSwitch: (mode: ScenarioMode) => void
  t: (key: string, fallback?: string) => string
}

const SCENARIOS: ScenarioOption[] = [
  { mode: 'academician', icon: GraduationCap, label: '学者顾问', activeColor: 'text-secondary-600 dark:text-secondary-700 active:bg-secondary-100 dark:active:bg-secondary-900/30' },
  { mode: 'safety_off', icon: Shield, label: '安全专员', activeColor: 'text-error-600 dark:text-error-600 active:bg-error-100 dark:active:bg-error-900/30' },
  { mode: 'process_eng', icon: Wrench, label: '工艺工程师', activeColor: 'text-warning-600 dark:text-warning-700 active:bg-warning-100 dark:active:bg-warning-900/30' },
  { mode: 'concise_adv', icon: Zap, label: '精简顾问', activeColor: 'text-primary-700 dark:text-primary-700 active:bg-primary-100 dark:active:bg-primary-900/30' },
]

export function ScenarioToolbar({ mode, onSwitch }: ScenarioToolbarProps) {
  return (
    <div
      role="radiogroup"
      aria-label="场景模式"
      className="flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/50 p-0.5"
    >
      {SCENARIOS.map(({ mode: m, icon: Icon, label, activeColor }) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onSwitch(m)}
          title={label}
          className={`flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-md transition-all duration-200 active:scale-95 ${
            mode === m
              ? `${activeColor} bg-white dark:bg-neutral-700 shadow-sm scale-105`
              : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 active:bg-neutral-200 dark:active:bg-neutral-600'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}
