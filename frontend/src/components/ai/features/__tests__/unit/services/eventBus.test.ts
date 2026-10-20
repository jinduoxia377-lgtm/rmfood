import { describe, it, expect, beforeEach, vi } from 'vitest'
import { eventBus } from '../../../services/eventBus'

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clear()
  })

  afterEach(() => {
    eventBus.clear()
  })

  describe('基础功能', () => {
    it('应提供 EventBus 单例', () => {
      expect(eventBus).toBeDefined()
      expect(typeof eventBus.emit).toBe('function')
      expect(typeof eventBus.subscribe).toBe('function')
      expect(typeof eventBus.once).toBe('function')
      expect(typeof eventBus.clear).toBe('function')
      expect(typeof eventBus.getSubscriberCount).toBe('function')
    })

    it('应正确发布和订阅事件', () => {
      const mockCallback = vi.fn()
      const testData = { content: 'test', timestamp: 123 }

      eventBus.subscribe('message:sending', mockCallback)
      eventBus.emit('message:sending', testData)

      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledWith(testData)
    })

    it('应支持多个订阅者监听同一事件', () => {
      const mock1 = vi.fn()
      const mock2 = vi.fn()
      const mock3 = vi.fn()

      eventBus.subscribe('message:received', mock1)
      eventBus.subscribe('message:received', mock2)
      eventBus.subscribe('message:received', mock3)

      eventBus.emit('message:received', { content: 'test', senderId: 's1', timestamp: 1 })

      expect(mock1).toHaveBeenCalledTimes(1)
      expect(mock2).toHaveBeenCalledTimes(1)
      expect(mock3).toHaveBeenCalledTimes(1)
    })

    it('应返回取消订阅函数', () => {
      const mockCallback = vi.fn()

      const unsubscribe = eventBus.subscribe('message:error', mockCallback)
      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      eventBus.emit('message:error', { error: new Error('test') })

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('一次性订阅 (once)', () => {
    it('应只触发一次回调', () => {
      const mockCallback = vi.fn()

      eventBus.once('search:started', mockCallback)

      eventBus.emit('search:started', { query: 'q', timestamp: 1 })
      eventBus.emit('search:started', { query: 'q', timestamp: 2 })
      eventBus.emit('search:started', { query: 'q', timestamp: 3 })

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('应在触发后自动取消订阅', () => {
      const mockCallback = vi.fn()

      eventBus.once('formulas:detected', mockCallback)
      eventBus.emit('formulas:detected', { formulas: [] })

      expect(eventBus.getSubscriberCount('formulas:detected')).toBe(0)
    })
  })

  describe('清理功能', () => {
    it('应清除指定事件的所有订阅者', () => {
      const mock1 = vi.fn()
      const mock2 = vi.fn()

      eventBus.subscribe('state:changed', mock1)
      eventBus.subscribe('state:changed', mock2)
      eventBus.subscribe('language:changed', vi.fn())

      eventBus.clearEvent('state:changed')

      eventBus.emit('state:changed', { newState: 'x' })
      eventBus.emit('language:changed', { language: 'zh' })

      expect(mock1).not.toHaveBeenCalled()
      expect(mock2).not.toHaveBeenCalled()
    })

    it('应清除所有事件的订阅者', () => {
      const mock1 = vi.fn()
      const mock2 = vi.fn()

      eventBus.subscribe('report:generated', mock1)
      eventBus.subscribe('search:completed', mock2)

      eventBus.clear()

      eventBus.emit('report:generated', { reportUrl: '', reportType: 'x' })
      eventBus.emit('search:completed', { query: 'q', results: 0, timeTaken: 0, timestamp: 0 })

      expect(mock1).not.toHaveBeenCalled()
      expect(mock2).not.toHaveBeenCalled()
    })
  })

  describe('订阅者计数', () => {
    it('应正确返回指定事件的订阅者数量', () => {
      expect(eventBus.getSubscriberCount('message:sending')).toBe(0)

      eventBus.subscribe('message:sending', vi.fn())
      expect(eventBus.getSubscriberCount('message:sending')).toBe(1)

      eventBus.subscribe('message:sending', vi.fn())
      expect(eventBus.getSubscriberCount('message:sending')).toBe(2)
    })

    it('取消订阅后应减少计数', () => {
      const unsub1 = eventBus.subscribe('message:error', vi.fn())
      const unsub2 = eventBus.subscribe('message:error', vi.fn())

      expect(eventBus.getSubscriberCount('message:error')).toBe(2)

      unsub1()
      expect(eventBus.getSubscriberCount('message:error')).toBe(1)

      unsub2()
      expect(eventBus.getSubscriberCount('message:error')).toBe(0)
    })
  })

  describe('事件数据传递', () => {
    it('应正确传递复杂数据对象', () => {
      const mockCallback = vi.fn()
      const complexData = {
        step: 'analysis',
        question: '测试问题',
        timestamp: 123,
      }

      eventBus.subscribe('thinking:step', mockCallback)
      eventBus.emit('thinking:step', complexData)

      expect(mockCallback).toHaveBeenCalledWith(complexData)
      expect(mockCallback.mock.calls[0][0]).toEqual(complexData)
    })
  })

  describe('错误处理', () => {
    it('应捕获并处理订阅者回调中的错误', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error')
      })
      const successCallback = vi.fn()

      console.error = vi.fn()

      eventBus.subscribe('message:sending', errorCallback)
      eventBus.subscribe('message:sending', successCallback)

      expect(() => {
        eventBus.emit('message:sending', { content: 'x', timestamp: 1 })
      }).not.toThrow()

      expect(errorCallback).toHaveBeenCalled()
      expect(successCallback).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('性能测试', () => {
    it('应高效处理大量事件发布（1000 次）', () => {
      const mockCallback = vi.fn()
      eventBus.subscribe('message:sending', mockCallback)

      const startTime = performance.now()

      for (let i = 0; i < 1000; i++) {
        eventBus.emit('message:sending', { content: `c${i}`, timestamp: i })
      }

      const endTime = performance.now()

      expect(mockCallback).toHaveBeenCalledTimes(1000)
      expect(endTime - startTime).toBeLessThan(500)
    })
  })
})