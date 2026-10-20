import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useChatTabOrchestrator } from '../useChatTabOrchestrator'

// useChatTabOrchestrator v12 精简版：
// - 已移除 PromptEngineeringFramework（场景检测迁移到后端）
// - 已移除 workingMemory / shortTermMemory（由 useChatSendMessage 直接管理）
// - 保留：nlpEngine / multiTurnDialogue / thinkingProcessV3 / scenarioSwitcher /
//         currentScenarioMode / switchScenario / userProfileManager
describe('useChatTabOrchestrator', () => {
  it('should return all engine instances', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())

    expect(result.current.nlpEngine).toBeDefined()
    expect(result.current.multiTurnDialogue).toBeDefined()
    expect(result.current.thinkingProcessV3).toBeDefined()
    expect(result.current.scenarioSwitcher).toBeDefined()
    expect(result.current.currentScenarioMode).toBeDefined()
    expect(result.current.switchScenario).toBeDefined()
    expect(result.current.userProfileManager).toBeDefined()
  })

  it('should expose scenario switcher with switchTo/getCurrentMode', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())
    expect(typeof result.current.scenarioSwitcher.switchTo).toBe('function')
    expect(typeof result.current.scenarioSwitcher.getCurrentMode).toBe('function')
  })

  it('should return singleton hybridNLPEngineV2 reference', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())
    expect(result.current.nlpEngine).toBeDefined()
    expect(typeof result.current.nlpEngine.detectIntent).toBe('function')
  })

  it('should maintain stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useChatTabOrchestrator())
    const firstRef = result.current.scenarioSwitcher
    rerender()
    expect(result.current.scenarioSwitcher).toBe(firstRef)
  })
})