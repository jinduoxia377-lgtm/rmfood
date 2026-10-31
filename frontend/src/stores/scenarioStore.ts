/**
 * Scenario Store — 场景模式状态管理（Zustand）
 *
 * 替代 window.__SCENARIO_MODE__ 全局变量污染（2026-07-22）。
 * scenarioSwitcher 是真实的状态引擎（内部保存 currentMode），
 * 本 store 只作为 React/Zustand 生态中的"读取窗口"，
 * 通过 selector + onChange 机制保持与 scenarioSwitcher 同步。
 */
import { create } from 'zustand'
import type { ScenarioMode } from '@/components/ai/features/services/scenarioSwitcher'
import { scenarioSwitcher } from '@/components/ai/features/services/scenarioSwitcher'

interface ScenarioState {
  /** 当前场景模式 */
  mode: ScenarioMode
  /** 切换到指定模式并同步到 scenarioSwitcher */
  setMode: (mode: ScenarioMode) => void
  /** 手动刷新（当 scenarioSwitcher 被外部调用时同步） */
  refresh: () => void
}

export const useScenarioStore = create<ScenarioState>((set, _get) => ({
  // 初始值从 scenarioSwitcher 读取
  mode: scenarioSwitcher.getCurrentMode(),

  setMode: (mode) => {
    // 委托给 scenarioSwitcher（它会更新内部 state 并记录日志）
    scenarioSwitcher.switchTo(mode, 'user_selected')
    // 同步到 Zustand store
    set({ mode: scenarioSwitcher.getCurrentMode() })
  },

  refresh: () => {
    set({ mode: scenarioSwitcher.getCurrentMode() })
  },
}))

/**
 * 非 React 环境下读取当前场景模式的函数（供 API 层使用）
 * 直接从 scenarioSwitcher 单例读取，避免 window 变量依赖
 */
export function getCurrentScenarioMode(): ScenarioMode {
  return scenarioSwitcher.getCurrentMode()
}
