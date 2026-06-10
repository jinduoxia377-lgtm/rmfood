/**
 * useChatTabOrchestrator - ChatTab 引擎编排 Hook (v1.0)
 *
 * 集中管理 ChatTab 所需的所有 AI 引擎：
 * - PromptEngineeringFramework V2.0 提示词引擎
 * - HybridNLPEngineV2 混合 NLP 引擎
 * - 三级记忆系统（工作记忆/多轮对话/短期记忆）
 * - 思考过程可视化 V3
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import { useMemo, useCallback } from 'react'
import { PromptEngineeringFramework } from '../services/promptEngineeringFramework'
import { hybridNLPEngineV2 } from '../services/hybridNLPEngineV2'
import { useWorkingMemory } from './useWorkingMemory'
import { useMultiTurnDialogue } from './useMultiTurnDialogue'
import { useShortTermMemory } from './useShortTermMemory'
import { useThinkingProcessV3 } from './useThinkingProcessV3'
import { scenarioSwitcher } from '../services/scenarioSwitcher'
import { userProfileManager } from '../services/userProfileService'
import type { ScenarioMode, ScenarioSwitchResult } from '../services/scenarioSwitcher'

export interface ChatTabOrchestratorReturn {
  /** PromptEngineeringFramework 单例 */
  promptFramework: PromptEngineeringFramework
  /** HybridNLPEngineV2 单例引用 */
  nlpEngine: typeof hybridNLPEngineV2
  /** 工作记忆 Hook */
  workingMemory: ReturnType<typeof useWorkingMemory>
  /** 多轮对话管理 Hook */
  multiTurnDialogue: ReturnType<typeof useMultiTurnDialogue>
  /** 短期记忆 Hook */
  shortTermMemory: ReturnType<typeof useShortTermMemory>
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
 *
 * 创建并返回所有 AI 引擎实例，供 ChatTab 及其子模块使用。
 * PromptEngineeringFramework 通过 useMemo 创建单例（仅在组件挂载时初始化一次）。
 *
 * @returns {ChatTabOrchestratorReturn} 所有引擎实例的集合
 *
 * @example
 * ```tsx
 * const orchestrator = useChatTabOrchestrator()
 * // 使用引擎
 * const scenario = orchestrator.promptFramework.detectScenario(userInput)
 * orchestrator.workingMemory.addMessage(msg)
 * ```
 */
export function useChatTabOrchestrator(): ChatTabOrchestratorReturn {
  const promptFramework = useMemo(() => new PromptEngineeringFramework({
    maxLength: 8000,
    defaultTier: 'standard',
    enableAutoScenarioDetection: true,
    enableKnowledgeInjection: true,
    enableFewShotLearning: false,
    enableEffectTracking: true,
    enableQualityEvaluation: true,
    preferredLanguage: 'zh-CN',
  }), [])

  const workingMemory = useWorkingMemory()
  const multiTurnDialogue = useMultiTurnDialogue()
  const shortTermMemory = useShortTermMemory()
  const thinkingProcessV3 = useThinkingProcessV3()

  /** 场景切换方法（透传给 UI 层） */
  const switchScenario = useCallback((mode: ScenarioMode): ScenarioSwitchResult | null => {
    return scenarioSwitcher.switchTo(mode)
  }, [])

  return {
    promptFramework,
    nlpEngine: hybridNLPEngineV2,
    workingMemory,
    multiTurnDialogue,
    shortTermMemory,
    thinkingProcessV3,
    scenarioSwitcher: scenarioSwitcher as unknown as typeof scenarioSwitcher,
    currentScenarioMode: scenarioSwitcher.getCurrentMode(),
    switchScenario,
    userProfileManager: userProfileManager as unknown as typeof userProfileManager,
  }
}
