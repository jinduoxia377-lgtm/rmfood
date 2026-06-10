import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useChatTabOrchestrator } from '../useChatTabOrchestrator'

describe('useChatTabOrchestrator', () => {
  it('should return all engine instances', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())

    expect(result.current.promptFramework).toBeDefined()
    expect(result.current.nlpEngine).toBeDefined()
    expect(result.current.workingMemory).toBeDefined()
    expect(result.current.multiTurnDialogue).toBeDefined()
    expect(result.current.shortTermMemory).toBeDefined()
    expect(result.current.thinkingProcessV3).toBeDefined()
  })

  it('should create PromptEngineeringFramework with correct config', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())
    expect(typeof result.current.promptFramework.detectScenario).toBe('function')
    expect(typeof result.current.promptFramework.generateOptimizedPrompt).toBe('function')
  })

  it('should return singleton hybridNLPEngineV2 reference', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())
    expect(result.current.nlpEngine).toBeDefined()
    expect(typeof result.current.nlpEngine.detectIntent).toBe('function')
  })

  it('should maintain stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useChatTabOrchestrator())
    const firstRef = result.current.promptFramework
    rerender()
    expect(result.current.promptFramework).toBe(firstRef)
  })
})
