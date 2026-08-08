/**
 * useChatTabOrchestrator - ChatTab 引擎编排 Hook (v12.0 精简版)
 *
 * v12.0 精简说明:
 * - 移除 PromptEngineeringFramework（场景检测已迁移到后端）
 * - 保留 NLP 引擎（用于意图分支逻辑）
 * - 保留多轮对话管理（指代消解 + 话题追踪）
 * - 工作记忆/短期记忆由 useChatSendMessage 直接管理，不再在此处创建
 *
 * @version 12.0.0
 * @lastUpdated 2026-06-26
 */

import { useCallback } from 'react'
import { hybridNLPEngineV2 } from '../services/hybridNLPEngineV2'
import { useMultiTurnDialogue } from './useMultiTurnDialogue'
import { useThinkingProcessV3 } from './useThinkingProcessV3'
import { scenarioSwitcher } from '../services/scenarioSwitcher'
import { userProfileManager } from '../services/userProfileService'
import type { ScenarioMode, ScenarioSwitchResult } from '../services/scenarioSwitcher'

export interface ChatTabOrchestratorReturn {
  /** HybridNLPEngineV2 混合 NLP 引擎 */
  nlpEngine: typeof hybridNLPEngineV2
  /** 多轮对话管理 Hook */
  multiTurnDialogue: ReturnType<typeof useMultiTurnDialogue>
  /** 思考过程可视化 V3 Hook */
  thinkingProcessV3: ReturnType<typeof useThinkingProcessV3>
  /** 场景切换器单例 */
  scenarioSwitcher: typeof scenarioSwitcher
  /** 当前场景模式 */
  currentScenarioMode: ScenarioMode
  /** 手动切换场景模式 */
  switchScenario: (mode: ScenarioMode) => ScenarioSwitchResult | null
  /** 统一用户画像管理器 */
  userProfileManager: typeof userProfileManager
}

/**
 * ChatTab 引擎编排 Hook
 */
export function useChatTabOrchestrator(): ChatTabOrchestratorReturn {
  const multiTurnDialogue = useMultiTurnDialogue()
  const thinkingProcessV3 = useThinkingProcessV3()

  /** 场景切换方法（透传给 UI 层） */
  const switchScenario = useCallback((mode: ScenarioMode): ScenarioSwitchResult | null => {
    return scenarioSwitcher.switchTo(mode)
  }, [])

  return {
    nlpEngine: hybridNLPEngineV2,
    multiTurnDialogue,
    thinkingProcessV3,
    scenarioSwitcher: scenarioSwitcher as unknown as typeof scenarioSwitcher,
    currentScenarioMode: scenarioSwitcher.getCurrentMode(),
    switchScenario,
    userProfileManager: userProfileManager as unknown as typeof userProfileManager,
  }
}
