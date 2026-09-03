/**
 * Logger 工具单元测试
 */
import { logger } from '@/utils/logger'

describe('Logger', () => {
  beforeEach(() => {
    logger.clearLogs()
  })

  describe('log methods', () => {
    it('should store log entries', () => {
      logger.log('Test message')
      
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('Test message')
      expect(logs[0].level).toBe('log')
    })

    it('should store error logs', () => {
      logger.error('Error message')
      
      const logs = logger.getLogs()
      expect(logs[0].level).toBe('error')
    })

    it('should store warning logs', () => {
      logger.warn('Warning message')
      
      const logs = logger.getLogs()
      expect(logs[0].level).toBe('warn')
    })

    it('should store info logs', () => {
      logger.info('Info message')
      
      const logs = logger.getLogs()
      expect(logs[0].level).toBe('info')
    })
  })

  describe('log data', () => {
    it('should store additional data with log entry', () => {
      logger.log('With data', { key: 'value' })
      
      const logs = logger.getLogs()
      expect(logs[0].data).toEqual({ key: 'value' })
    })

    it('should include timestamp in log entry', () => {
      logger.log('Timestamp test')
      
      const logs = logger.getLogs()
      expect(logs[0].timestamp).toBeDefined()
      expect(new Date(logs[0].timestamp).getTime()).not.toBeNaN()
    })
  })

  describe('log management', () => {
    it('should clear all logs', () => {
      logger.log('Message 1')
      logger.log('Message 2')
      logger.clearLogs()
      
      expect(logger.getLogs()).toHaveLength(0)
    })

    it('should limit log storage to maxLogs', () => {
      for (let i = 0; i < 150; i++) {
        logger.log(`Message ${i}`)
      }
      
      const logs = logger.getLogs()
      expect(logs.length).toBeLessThanOrEqual(100)
    })
  })

  describe('exportLogs', () => {
    it('should export logs as JSON string', () => {
      logger.log('Export test')
      
      const exported = logger.exportLogs()
      const parsed = JSON.parse(exported)
      
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0]).toHaveProperty('level')
      expect(parsed[0]).toHaveProperty('message')
      expect(parsed[0]).toHaveProperty('timestamp')
    })
  })
})
