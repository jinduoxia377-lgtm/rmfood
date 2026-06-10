// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ChatStateMachine, ChatState, getTransitionRules, validateTransitionSequence } from '../../../utils/chatStateMachine'

describe('ChatStateMachine', () => {
  let stateMachine: ChatStateMachine

  beforeEach(() => {
    stateMachine = new ChatStateMachine()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应初始化为 Idle 状态', () => {
      expect(stateMachine.state).toBe(ChatState.Idle)
      expect(stateMachine.previousState).toBe(ChatState.Idle)
      expect(stateMachine.canTransition(ChatState.Validating)).toBe(true)
      expect(stateMachine.canTransition(ChatState.Thinking)).toBe(true)
      expect(stateMachine.canTransition(ChatState.Streaming)).toBe(false)
    })

    it('应提供所有状态常量（包含 v7.0 新增状态）', () => {
      expect(ChatState.Idle).toBeDefined()
      expect(ChatState.Validating).toBeDefined()
      expect(ChatState.Sending).toBeDefined()
      expect(ChatState.Streaming).toBeDefined()
      expect(ChatState.Success).toBeDefined()
      expect(ChatState.Error).toBeDefined()
      expect(ChatState.RateLimited).toBeDefined()
      expect(ChatState.Thinking).toBeDefined()
      expect(ChatState.Formatting).toBeDefined()
      expect(ChatState.Processing).toBeDefined()
      expect(ChatState.Paused).toBeDefined()
      expect(ChatState.Retrying).toBeDefined()
    })
  })

  describe('状态转换', () => {
    it('应允许从 Idle 转换到 Validating', () => {
      const success = stateMachine.transition(ChatState.Validating)

      expect(success).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Validating)
      expect(stateMachine.previousState).toBe(ChatState.Idle)
    })

    it('应允许从 Idle 转换到 Thinking（v7.0 新增）', () => {
      const success = stateMachine.transition(ChatState.Thinking)

      expect(success).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Thinking)
    })

    it('应触发 onStateChange 回调', () => {
      const listener = jest.fn()
      stateMachine.onStateChange = listener

      stateMachine.transition(ChatState.Validating)

      expect(listener).toHaveBeenCalledWith(ChatState.Idle, ChatState.Validating)
    })

    it('应触发 onTransitionError 回调当转换无效时', () => {
      const errorListener = jest.fn()
      stateMachine.onTransitionError = errorListener

      stateMachine.transition(ChatState.Streaming)

      expect(errorListener).toHaveBeenCalled()
    })

    it('应拒绝无效的状态转换', () => {
      const result = stateMachine.transition(ChatState.Streaming)

      expect(result).toBe(false)
      expect(stateMachine.state).toBe(ChatState.Idle)
    })
  })

  describe('完整对话流程', () => {
    it('应正确执行 Idle → Validating → Sending → Streaming → Success 流程', () => {
      expect(stateMachine.transition(ChatState.Validating)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Validating)

      expect(stateMachine.transition(ChatState.Sending)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Sending)

      expect(stateMachine.transition(ChatState.Streaming)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Streaming)

      expect(stateMachine.transition(ChatState.Success)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Success)
    })

    it('应支持 Processing 状态流程（v7.0 新增）', () => {
      expect(stateMachine.transition(ChatState.Processing)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Processing)

      expect(stateMachine.transition(ChatState.Streaming)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Streaming)
    })

    it('应支持 Paused 状态恢复（v7.0 新增）', () => {
      expect(stateMachine.transition(ChatState.Validating)).toBe(true)
      expect(stateMachine.transition(ChatState.Sending)).toBe(true)
      expect(stateMachine.transition(ChatState.Streaming)).toBe(true)

      expect(stateMachine.transition(ChatState.Paused)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Paused)

      expect(stateMachine.transition(ChatState.Streaming)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Streaming)
    })

    it('应支持 Retrying 状态（v7.0 新增）', () => {
      expect(stateMachine.transition(ChatState.Validating)).toBe(true)
      expect(stateMachine.transition(ChatState.Error)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Error)

      expect(stateMachine.transition(ChatState.Retrying)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Retrying)

      expect(stateMachine.transition(ChatState.Sending)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Sending)
    })

    it('应在错误后允许恢复到 Idle', () => {
      expect(stateMachine.transition(ChatState.Validating)).toBe(true)
      expect(stateMachine.transition(ChatState.Error)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Error)

      expect(stateMachine.transition(ChatState.Idle)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Idle)
    })
  })

  describe('状态查询方法', () => {
    it('isInState 应正确判断状态', () => {
      expect(stateMachine.isInState(ChatState.Idle)).toBe(true)
      expect(stateMachine.isInState(ChatState.Validating)).toBe(false)

      stateMachine.transition(ChatState.Validating)
      expect(stateMachine.isInState(ChatState.Idle)).toBe(false)
      expect(stateMachine.isInState(ChatState.Validating)).toBe(true)
      expect(stateMachine.isInState(ChatState.Sending, ChatState.Validating)).toBe(true)
    })

    it('getStateDuration 应返回状态持续时间', () => {
      expect(stateMachine.getStateDuration()).toBe(0)

      stateMachine.transition(ChatState.Validating)
      expect(stateMachine.getStateDuration()).toBeGreaterThanOrEqual(0)
    })

    it('getTransitionCount 应返回转换次数', () => {
      expect(stateMachine.getTransitionCount()).toBe(0)

      stateMachine.transition(ChatState.Validating)
      expect(stateMachine.getTransitionCount()).toBe(1)

      stateMachine.transition(ChatState.Sending)
      expect(stateMachine.getTransitionCount()).toBe(2)
      expect(stateMachine.getTransitionCount(ChatState.Validating)).toBe(1)
      expect(stateMachine.getTransitionCount(ChatState.Validating, ChatState.Sending)).toBe(1)
    })
  })

  describe('transitionHistory', () => {
    it('应记录状态转换历史', () => {
      stateMachine.transition(ChatState.Validating)
      stateMachine.transition(ChatState.Sending)

      const history = stateMachine.transitionHistory
      expect(history.length).toBe(2)
      expect(history[0].from).toBe(ChatState.Idle)
      expect(history[0].to).toBe(ChatState.Validating)
      expect(history[1].from).toBe(ChatState.Validating)
      expect(history[1].to).toBe(ChatState.Sending)
    })

    it('应限制历史记录数量（最多100条）', () => {
      for (let i = 0; i < 110; i++) {
        stateMachine.transition(ChatState.Validating)
        stateMachine.transition(ChatState.Idle)
      }

      const history = stateMachine.transitionHistory
      expect(history.length).toBeLessThanOrEqual(100)
    })
  })

  describe('RateLimited 特殊处理', () => {
    it('应支持从任意状态进入 RateLimited', () => {
      expect(stateMachine.transition(ChatState.RateLimited)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.RateLimited)
    })

    it('应只允许从 RateLimited 转换到 Idle', () => {
      expect(stateMachine.transition(ChatState.RateLimited)).toBe(true)
      
      expect(stateMachine.canTransition(ChatState.Idle)).toBe(true)
      expect(stateMachine.canTransition(ChatState.Validating)).toBe(false)

      expect(stateMachine.transition(ChatState.Idle)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Idle)
    })
  })

  describe('transitionLock', () => {
    it('应在锁定时阻止状态转换', () => {
      stateMachine.setTransitionLock(true)

      expect(stateMachine.canTransition(ChatState.Validating)).toBe(false)
      expect(stateMachine.transition(ChatState.Validating)).toBe(false)
      expect(stateMachine.state).toBe(ChatState.Idle)
    })

    it('应在解锁后允许状态转换', () => {
      stateMachine.setTransitionLock(true)
      stateMachine.setTransitionLock(false)

      expect(stateMachine.canTransition(ChatState.Validating)).toBe(true)
      expect(stateMachine.transition(ChatState.Validating)).toBe(true)
      expect(stateMachine.state).toBe(ChatState.Validating)
    })
  })

  describe('reset 方法', () => {
    it('应重置到初始状态', () => {
      stateMachine.transition(ChatState.Validating)
      stateMachine.transition(ChatState.Sending)
      expect(stateMachine.state).toBe(ChatState.Sending)
      expect(stateMachine.transitionHistory.length).toBe(2)

      stateMachine.reset()
      expect(stateMachine.state).toBe(ChatState.Idle)
      expect(stateMachine.previousState).toBe(ChatState.Idle)
      expect(stateMachine.transitionHistory.length).toBe(0)
    })
  })

  describe('静态方法', () => {
    it('getAllStates 应返回所有状态（包含 v7.0 新增）', () => {
      const states = ChatStateMachine.getAllStates()
      
      expect(states).toContain(ChatState.Idle)
      expect(states).toContain(ChatState.Validating)
      expect(states).toContain(ChatState.Sending)
      expect(states).toContain(ChatState.Streaming)
      expect(states).toContain(ChatState.Success)
      expect(states).toContain(ChatState.Error)
      expect(states).toContain(ChatState.RateLimited)
      expect(states).toContain(ChatState.Thinking)
      expect(states).toContain(ChatState.Formatting)
      expect(states).toContain(ChatState.Processing)
      expect(states).toContain(ChatState.Paused)
      expect(states).toContain(ChatState.Retrying)
      expect(states.length).toBe(11)
    })

    it('getValidTransitions 应返回有效的转换规则', () => {
      const transitions = ChatStateMachine.getValidTransitions()
      
      expect(transitions[ChatState.Idle]).toContain(ChatState.Validating)
      expect(transitions[ChatState.Idle]).toContain(ChatState.Thinking)
      expect(transitions[ChatState.Validating]).toContain(ChatState.Sending)
      expect(transitions[ChatState.Validating]).toContain(ChatState.Error)
      expect(transitions[ChatState.Thinking]).toContain(ChatState.Sending)
    })

    it('getInitialStates 应返回初始状态', () => {
      const initialStates = ChatStateMachine.getInitialStates()
      expect(initialStates).toEqual([ChatState.Idle])
    })

    it('getTerminalStates 应返回终止状态', () => {
      const terminalStates = ChatStateMachine.getTerminalStates()
      expect(terminalStates).toContain(ChatState.Success)
      expect(terminalStates).toContain(ChatState.Error)
      expect(terminalStates).toContain(ChatState.RateLimited)
    })

    it('getActiveStates 应返回活跃状态（包含 v7.0 新增）', () => {
      const activeStates = ChatStateMachine.getActiveStates()
      expect(activeStates).toContain(ChatState.Validating)
      expect(activeStates).toContain(ChatState.Sending)
      expect(activeStates).toContain(ChatState.Streaming)
      expect(activeStates).toContain(ChatState.Thinking)
      expect(activeStates).toContain(ChatState.Formatting)
      expect(activeStates).toContain(ChatState.Processing)
      expect(activeStates).toContain(ChatState.Retrying)
    })
  })

  describe('辅助函数', () => {
    it('getTransitionRules 应返回完整的转换规则表', () => {
      const rules = getTransitionRules()
      expect(rules.length).toBe(11 * 11)
      
      const idleToValidating = rules.find(r => r.from === ChatState.Idle && r.to === ChatState.Validating)
      expect(idleToValidating?.isValid).toBe(true)

      const idleToStreaming = rules.find(r => r.from === ChatState.Idle && r.to === ChatState.Streaming)
      expect(idleToStreaming?.isValid).toBe(false)
    })

    it('validateTransitionSequence 应验证状态序列的有效性', () => {
      const validSequence = [ChatState.Idle, ChatState.Validating, ChatState.Sending, ChatState.Streaming]
      expect(validateTransitionSequence(validSequence)).toBe(true)

      const invalidSequence = [ChatState.Idle, ChatState.Streaming, ChatState.Success]
      expect(validateTransitionSequence(invalidSequence)).toBe(false)
    })
  })

  describe('边界情况和异常处理', () => {
    it('应处理 throwOnError 配置', () => {
      const strictMachine = new ChatStateMachine(ChatState.Idle, { throwOnError: true })
      
      expect(() => {
        strictMachine.transition(ChatState.Streaming)
      }).toThrow()
    })

    it('配置为不抛出时应警告并继续', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      stateMachine.transition(ChatState.Streaming)
      
      expect(consoleSpy).toHaveBeenCalled()
      expect(stateMachine.state).toBe(ChatState.Idle)
      
      consoleSpy.mockRestore()
    })

    it('应处理 enableDebug 配置', () => {
      const debugMachine = new ChatStateMachine(ChatState.Idle, { enableDebug: true })
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})

      debugMachine.transition(ChatState.Validating)
      
      expect(consoleDebugSpy).toHaveBeenCalled()
      
      consoleDebugSpy.mockRestore()
    })
  })

  describe('性能测试', () => {
    it('应高效处理大量快速状态转换（10000 次）', () => {
      const startTime = performance.now()

      for (let i = 0; i < 10000; i++) {
        if (i % 2 === 0) {
          stateMachine.transition(ChatState.Validating)
          stateMachine.transition(ChatState.Sending)
          stateMachine.transition(ChatState.Streaming)
          stateMachine.transition(ChatState.Success)
          stateMachine.reset()
        } else {
          stateMachine.transition(ChatState.Validating)
          stateMachine.transition(ChatState.Error)
          stateMachine.reset()
        }
      }

      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(500)
    })
  })
})