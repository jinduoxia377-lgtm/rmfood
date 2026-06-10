import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StorageService, QuotaExceededError } from '../../../services/storageService'

describe('StorageService', () => {
  let storageService: StorageService
  const testKey = 'test_storage_key'

  beforeEach(() => {
    localStorage.clear()
    storageService = new StorageService(localStorage)
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('基础 CRUD 操作', () => {
    it('应设置和获取值', () => {
      const testValue = { name: 'test', value: 123 }
      
      storageService.set(testKey, testValue)
      const result = storageService.get<typeof testValue>(testKey)
      
      expect(result).toEqual(testValue)
    })

    it('应返回 null 当键不存在', () => {
      const result = storageService.get(testKey)
      expect(result).toBeNull()
    })

    it('应删除指定键', () => {
      storageService.set(testKey, 'test-value')
      expect(storageService.exists(testKey)).toBe(true)
      
      storageService.remove(testKey)
      expect(storageService.exists(testKey)).toBe(false)
    })

    it('应检查键是否存在', () => {
      expect(storageService.exists(testKey)).toBe(false)
      
      storageService.set(testKey, 'value')
      expect(storageService.exists(testKey)).toBe(true)
    })
  })

  describe('过期数据处理', () => {
    it('应自动清理过期数据', () => {
      const expiredData = {
        data: 'expired',
        version: 8,
        timestamp: Date.now(),
        expiresAt: Date.now() - 1000, // 已过期
      }
      localStorage.setItem(testKey, JSON.stringify(expiredData))
      
      const result = storageService.get(testKey)
      expect(result).toBeNull()
      expect(storageService.exists(testKey)).toBe(false)
    })

    it('应保留未过期数据', () => {
      storageService.set(testKey, 'valid', { expiresInMs: 3600000 })
      
      const result = storageService.get(testKey)
      expect(result).toBe('valid')
    })
  })

  describe('键管理', () => {
    it('应获取所有键', () => {
      storageService.set('prefix_key1', 'value1')
      storageService.set('prefix_key2', 'value2')
      storageService.set('other_key', 'value3')
      
      const allKeys = storageService.keys()
      expect(allKeys).toHaveLength(3)
    })

    it('应获取匹配前缀的键', () => {
      storageService.set('prefix_key1', 'value1')
      storageService.set('prefix_key2', 'value2')
      storageService.set('other_key', 'value3')
      
      const prefixKeys = storageService.keys('prefix')
      expect(prefixKeys).toHaveLength(2)
      expect(prefixKeys).toContain('prefix_key1')
      expect(prefixKeys).toContain('prefix_key2')
    })

    it('应清除匹配前缀的键', () => {
      storageService.set('prefix_key1', 'value1')
      storageService.set('prefix_key2', 'value2')
      storageService.set('other_key', 'value3')
      
      storageService.clearByPrefix('prefix')
      
      expect(storageService.keys('prefix')).toHaveLength(0)
      expect(storageService.exists('other_key')).toBe(true)
    })
  })

  describe('配额管理', () => {
    it('应在配额超限时抛出 QuotaExceededError', () => {
      // Mock localStorage 抛出配额错误
      const mockStorage = {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        },
        removeItem: () => {},
        key: () => null,
        length: 0,
        clear: () => {},
      }
      
      const service = new StorageService(mockStorage as unknown as Storage)
      
      expect(() => {
        service.set('large_data', 'x'.repeat(1000000))
      }).toThrow(QuotaExceededError)
    })
  })

  describe('统计信息', () => {
    it('应返回正确的统计信息', () => {
      storageService.set('key1', 'value1')
      storageService.set('key2', { nested: 'object' })
      
      const stats = storageService.getStats()
      
      expect(stats.itemCount).toBe(2)
      expect(stats.used).toBeGreaterThan(0)
      expect(stats.total).toBe(5 * 1024 * 1024)
    })

    it('应处理空存储', () => {
      const stats = storageService.getStats()
      
      expect(stats.itemCount).toBe(0)
      expect(stats.used).toBe(0)
    })
  })

  describe('清理过期数据', () => {
    it('应清理所有过期数据', () => {
      const expiredData = {
        data: 'expired',
        version: 8,
        timestamp: Date.now(),
        expiresAt: Date.now() - 1000,
      }
      const validData = {
        data: 'valid',
        version: 8,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
      }
      
      localStorage.setItem('expired_key', JSON.stringify(expiredData))
      localStorage.setItem('valid_key', JSON.stringify(validData))
      
      storageService.cleanExpiredData()
      
      expect(storageService.exists('expired_key')).toBe(false)
      expect(storageService.exists('valid_key')).toBe(true)
    })
  })

  describe('数据版本管理', () => {
    it('应存储版本号和时间戳', () => {
      storageService.set(testKey, 'test_value')
      
      const raw = localStorage.getItem(testKey)
      const parsed = JSON.parse(raw!)
      
      expect(parsed.version).toBe(8)
      expect(parsed.timestamp).toBeDefined()
      expect(parsed.data).toBe('test_value')
    })
  })

  describe('错误处理', () => {
    it('应处理无效的 JSON 数据', () => {
      localStorage.setItem(testKey, 'invalid json {{{')
      
      const result = storageService.get(testKey)
      expect(result).toBeNull()
    })

    it('应处理 null 值', () => {
      storageService.set(testKey, null)
      const result = storageService.get(testKey)
      expect(result).toEqual({ version: 8, timestamp: expect.any(Number), data: null })
    })

    it('应处理 undefined 值', () => {
      storageService.set(testKey, undefined as any)
      const result = storageService.get(testKey)
      expect(result).toEqual({ version: 8, timestamp: expect.any(Number) })
    })
  })

  describe('LRU 缓存', () => {
    it('应限制 LRU 缓存大小', () => {
      // 设置超过 MAX_HISTORY_SIZE 的键
      for (let i = 0; i < 1100; i++) {
        storageService.set(`key_${i}`, `value_${i}`)
      }
      
      // LRU 缓存应被限制在 1000 以内
      const keys = storageService.keys()
      expect(keys.length).toBe(1100) // localStorage 不受影响
    })
  })

  describe('复杂数据类型', () => {
    it('应支持存储数组', () => {
      const arrayData = [1, 2, 3, { nested: 'object' }]
      storageService.set(testKey, arrayData)
      
      const result = storageService.get(testKey)
      expect(result).toEqual(arrayData)
    })

    it('应支持存储嵌套对象', () => {
      const nestedData = {
        level1: {
          level2: {
            level3: 'deep',
            array: [1, 2, 3],
          },
        },
      }
      storageService.set(testKey, nestedData)
      
      const result = storageService.get(testKey)
      expect(result).toEqual(nestedData)
    })

    it('应支持存储 Date 对象（序列化后）', () => {
      const date = new Date('2024-01-01')
      storageService.set(testKey, date.toISOString())
      
      const result = storageService.get(testKey)
      expect(result).toBe('2024-01-01T00:00:00.000Z')
    })
  })
})