// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { EventBus } from '../../../services/eventBus'
import { IEventBus, ChatEvent, AIEvent, FormulaEvent, ExportEvent } from '../../../types'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  afterEach(() => {
    eventBus.clear()
  })

  describe('基础功能', () => {
    it('应创建 EventBus 实例', () => {
      expect(eventBus).toBeInstanceOf(EventBus)
      expect(typeof eventBus.emit).toBe('function')
      expect(typeof eventBus.subscribe).toBe('function')
      expect(typeof eventBus.once).toBe('function')
      expect(typeof eventBus.clear).toBe('function')
      expect(typeof eventBus.getSubscriberCount).toBe('function')
    })

    it('应正确发布和订阅事件', () => {
      const mockCallback = jest.fn()
      const testData = { message: 'test' }

      eventBus.subscribe(ChatEvent.MESSAGE_SENT, mockCallback)
      eventBus.emit(ChatEvent.MESSAGE_SENT, testData)

      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledWith(testData)
    })

    it('应支持多个订阅者监听同一事件', () => {
      const mock1 = jest.fn()
      const mock2 = jest.fn()
      const mock3 = jest.fn()

      eventBus.subscribe(ChatEvent.MESSAGE_RECEIVED, mock1)
      eventBus.subscribe(ChatEvent.MESSAGE_RECEIVED, mock2)
      eventBus.subscribe(ChatEvent.MESSAGE_RECEIVED, mock3)

      eventBus.emit(ChatEvent.MESSAGE_RECEIVED, { content: 'test' })

      expect(mock1).toHaveBeenCalledTimes(1)
      expect(mock2).toHaveBeenCalledTimes(1)
      expect(mock3).toHaveBeenCalledTimes(1)
    })

    it('应返回取消订阅函数', () => {
      const mockCallback = jest.fn()

      const unsubscribe = eventBus.subscribe(ChatEvent.ERROR_OCCURRED, mockCallback)
      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      eventBus.emit(ChatEvent.ERROR_OCCURRED, { error: new Error('test') })

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('一次性订阅 (once)', () => {
    it('应只触发一次回调', () => {
      const mockCallback = jest.fn()

      eventBus.once(AIEvent.STREAM_START, mockCallback)

      eventBus.emit(AIEvent.STREAM_START, {})
      eventBus.emit(AIEvent.STREAM_START, {})
      eventBus.emit(AIEvent.STREAM_START, {})

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('应在触发后自动取消订阅', () => {
      const mockCallback = jest.fn()

      eventBus.once(FormulaEvent.FORMULA_RECOGNIZED, mockCallback)
      eventBus.emit(FormulaEvent.FORMULA_RECOGNIZED, {})

      expect(eventBus.getSubscriberCount(FormulaEvent.FORMULA_RECOGNIZED)).toBe(0)
    })

    it('once 返回的取消订阅函数应有效', () => {
      const mockCallback = jest.fn()

      const unsubscribe = eventBus.once(ExportEvent.EXPORT_START, mockCallback)
      unsubscribe()

      eventBus.emit(ExportEvent.EXPORT_START, {})
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('清理功能', () => {
    it('应清除指定事件的所有订阅者', () => {
      const mock1 = jest.fn()
      const mock2 = jest.fn()

      eventBus.subscribe(ChatEvent.LOADING_START, mock1)
      eventBus.subscribe(ChatEvent.LOADING_START, mock2)
      eventBus.subscribe(ChatEvent.LOADING_END, jest.fn())

      eventBus.clear(ChatEvent.LOADING_START)

      eventBus.emit(ChatEvent.LOADING_START, {})
      eventBus.emit(ChatEvent.LOADING_END, {})

      expect(mock1).not.toHaveBeenCalled()
      expect(mock2).not.toHaveBeenCalled()
    })

    it('应清除所有事件的订阅者', () => {
      const mock1 = jest.fn()
      const mock2 = jest.fn()

      eventBus.subscribe(ChatEvent.SESSION_CREATED, mock1)
      eventBus.subscribe(AIEvent.RESPONSE_COMPLETE, mock2)

      eventBus.clear()

      eventBus.emit(ChatEvent.SESSION_CREATED, {})
      eventBus.emit(AIEvent.RESPONSE_COMPLETE, {})

      expect(mock1).not.toHaveBeenCalled()
      expect(mock2).not.toHaveBeenCalled()
    })

    it('清除后 getSubscriberCount 应返回 0', () => {
      eventBus.subscribe(ChatEvent.MESSAGE_SENT, jest.fn())
      eventBus.subscribe(ChatEvent.MESSAGE_RECEIVED, jest.fn())

      expect(eventBus.getSubscriberCount()).toBeGreaterThan(0)

      eventBus.clear()

      expect(eventBus.getSubscriberCount(ChatEvent.MESSAGE_SENT)).toBe(0)
      expect(eventBus.getSubscriberCount(ChatEvent.MESSAGE_RECEIVED)).toBe(0)
    })
  })

  describe('订阅者计数', () => {
    it('应正确返回指定事件的订阅者数量', () => {
      expect(eventBus.getSubscriberCount(ChatEvent.MESSAGE_SENT)).toBe(0)

      eventBus.subscribe(ChatEvent.MESSAGE_SENT, jest.fn())
      expect(eventBus.getSubscriberCount(ChatEvent.MESSAGE_SENT)).toBe(1)

      eventBus.subscribe(ChatEvent.MESSAGE_SENT, jest.fn())
      expect(eventBus.getSubscriberCount(ChatEvent.MESSAGE_SENT)).toBe(2)
    })

    it('取消订阅后应减少计数', () => {
      const unsub1 = eventBus.subscribe(ChatEvent.ERROR_OCCURRED, jest.fn())
      const unsub2 = eventBus.subscribe(ChatEvent.ERROR_OCCURRED, jest.fn())

      expect(eventBus.getSubscriberCount(ChatEvent.ERROR_OCCURRED)).toBe(2)

      unsub1()
      expect(eventBus.getSubscriberCount(ChatEvent.ERROR_OCCURRED)).toBe(1)

      unsub2()
      expect(eventBus.getSubscriberCount(ChatEvent.ERROR_OCCURRED)).toBe(0)
    })
  })

  describe('事件数据传递', () => {
    it('应正确传递复杂数据对象', () => {
      const mockCallback = jest.fn()
      const complexData = {
        id: '123',
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' }
        ],
        metadata: {
          timestamp: Date.now(),
          model: 'gpt-4'
        }
      }

      eventBus.subscribe(ChatEvent.SESSION_LOADED, mockCallback)
      eventBus.emit(ChatEvent.SESSION_LOADED, complexData)

      expect(mockCallback).toHaveBeenCalledWith(complexData)
      expect(mockCallback.mock.calls[0][0]).toEqual(complexData)
    })

    it('应支持 undefined 和 null 数据', () => {
      const mockCallback = jest.fn()

      eventBus.subscribe(ChatEvent.CLEAR_MESSAGES, mockCallback)
      eventBus.emit(ChatEvent.CLEAR_MESSAGES, undefined)

      expect(mockCallback).toHaveBeenCalledWith(undefined)
    })
  })

  describe('错误处理', () => {
    it('应捕获并处理订阅者回调中的错误', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Subscriber error')
      })
      const successCallback = jest.fn()

      console.error = jest.fn()

      eventBus.subscribe(ChatEvent.MESSAGE_SENT, errorCallback)
      eventBus.subscribe(ChatEvent.MESSAGE_SENT, successCallback)

      expect(() => {
        eventBus.emit(ChatEvent.MESSAGE_SENT, {})
      }).not.toThrow()

      expect(errorCallback).toHaveBeenCalled()
      expect(successCallback).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })

    it('不应因一个订阅者错误而影响其他订阅者', () => {
      const throwingFn = jest.fn(() => { throw new Error('test') })
      const normalFn = jest.fn()

      eventBus.subscribe(AIEvent.STREAM_CHUNK, throwingFn)
      eventBus.subscribe(AIEvent.STREAM_CHUNK, normalFn)

      eventBus.emit(AIEvent.STREAM_CHUNK, { chunk: 'data' })

      expect(throwingFn).toHaveBeenCalled()
      expect(normalFn).toHaveBeenCalled()
    })
  })

  describe('性能测试', () => {
    it('应高效处理大量事件发布（10000 次）', () => {
      const mockCallback = jest.fn()
      eventBus.subscribe(ChatEvent.MESSAGE_SENT, mockCallback)

      const startTime = performance.now()

      for (let i = 0; i < 10000; i++) {
        eventBus.emit(ChatEvent.MESSAGE_SENT, { index: i })
      }

      const endTime = performance.now()

      expect(mockCallback).toHaveBeenCalledTimes(10000)
      expect(endTime - startTime).toBeLessThan(500)
    })

    it('应高效处理大量订阅者（1000 个）', () => {
      const subscribers: Array<jest.Mock> = []

      for (let i = 0; i < 1000; i++) {
        const mock = jest.fn()
        eventBus.subscribe(ChatEvent.MESSAGE_RECEIVED, mock)
        subscribers.push(mock)
      }

      eventBus.emit(ChatEvent.MESSAGE_RECEIVED, { test: true })

      subscribers.forEach(subscriber => {
        expect(subscriber).toHaveBeenCalledTimes(1)
      })
    })
  })
})
