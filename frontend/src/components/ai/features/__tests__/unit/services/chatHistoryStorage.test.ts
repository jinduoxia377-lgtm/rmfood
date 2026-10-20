import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ChatHistoryStorage } from '../../../services/chatHistoryStorage'
import { ChatSession, ChatTopic, MAX_TAGS_PER_SESSION } from '../../../types/chatHistory.types'

const TEST_DB_NAME = 'RMFOOD_ChatHistory_Test'
const TEST_LOCALSTORAGE_KEY = 'rmfood_chat_history_test'

describe('ChatHistoryStorage', () => {
  let storage: ChatHistoryStorage

  beforeEach(async () => {
    storage = new ChatHistoryStorage({
      indexedDBName: TEST_DB_NAME,
      localStorageKey: TEST_LOCALSTORAGE_KEY,
      maxSessions: 100
    })
    await storage.clearAll()
  })

  afterEach(async () => {
    await storage.clearAll()
  })

  function createTestSession(index: number, topic: ChatTopic = ChatTopic.KNOWLEDGE_QUERY): ChatSession {
    const now = Date.now()
    return {
      id: `session-${index}`,
      title: `测试会话 ${index}`,
      messages: [
        {
          id: `msg-${index}-1`,
          role: 'user',
          content: `用户消息 ${index}`,
          timestamp: now - 1000
        },
        {
          id: `msg-${index}-2`,
          role: 'assistant',
          content: `助手回复 ${index}`,
          timestamp: now
        }
      ],
      metadata: {
        topic,
        tags: [`tag-${index % 5}`, `tag-${(index + 1) % 5}`].slice(0, Math.min(index % 3 + 1, MAX_TAGS_PER_SESSION)),
        createdAt: now - 1000,
        updatedAt: now,
        messageCount: 2
      }
    }
  }

  describe('基本CRUD操作', () => {
    it('应保存和读取单个会话', async () => {
      const session = createTestSession(1, ChatTopic.FORMULA_DESIGN)
      await storage.saveSession(session)

      const retrieved = await storage.getSession(session.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(session.id)
      expect(retrieved?.title).toBe(session.title)
      expect(retrieved?.metadata.topic).toBe(ChatTopic.FORMULA_DESIGN)
    })

    it('应返回null当会话不存在时', async () => {
      const retrieved = await storage.getSession('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('应删除指定会话', async () => {
      const session = createTestSession(1)
      await storage.saveSession(session)

      await storage.deleteSession(session.id)
      const retrieved = await storage.getSession(session.id)
      expect(retrieved).toBeNull()
    })

    it('应清除所有会话', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.saveSession(createTestSession(i))
      }

      await storage.clearAll()
      const sessions = await storage.getAllSessions()
      expect(sessions).toHaveLength(0)
    })
  })

  describe('主题分类', () => {
    it('应支持所有8个预设主题', async () => {
      const topics = Object.values(ChatTopic)
      expect(topics).toHaveLength(8)

      for (let i = 0; i < topics.length; i++) {
        const session = createTestSession(i, topics[i])
        await storage.saveSession(session)
      }

      const sessions = await storage.getAllSessions()
      expect(sessions).toHaveLength(8)

      const sessionByTopic = await storage.getAllSessions({ topic: ChatTopic.FORMULA_DESIGN })
      expect(sessionByTopic).toHaveLength(1)
      expect(sessionByTopic[0].metadata.topic).toBe(ChatTopic.FORMULA_DESIGN)
    })
  })

  describe('标签管理', () => {
    it('应支持最多5个标签', async () => {
      const session: ChatSession = {
        id: 'test-tags',
        title: '标签测试',
        messages: [],
        metadata: {
          topic: ChatTopic.KNOWLEDGE_QUERY,
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0
        }
      }
      await storage.saveSession(session)

      const retrieved = await storage.getSession('test-tags')
      expect(retrieved?.metadata.tags).toHaveLength(5)
    })

    it('应拒绝超过5个标签', async () => {
      const session: ChatSession = {
        id: 'test-tags-exceed',
        title: '标签超限测试',
        messages: [],
        metadata: {
          topic: ChatTopic.KNOWLEDGE_QUERY,
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0
        }
      }

      await expect(storage.saveSession(session)).rejects.toThrow(
        `最多支持 ${MAX_TAGS_PER_SESSION} 个标签`
      )
    })
  })

  describe('100条记录存储测试', () => {
    it('应成功存储100条会话记录', async () => {
      const sessions: ChatSession[] = []
      const topics = Object.values(ChatTopic)

      for (let i = 0; i < 100; i++) {
        const topic = topics[i % topics.length]
        sessions.push(createTestSession(i, topic))
      }

      const startTime = Date.now()
      for (const session of sessions) {
        await storage.saveSession(session)
      }
      const saveTime = Date.now() - startTime

      console.log(`保存100条会话耗时: ${saveTime}ms`)

      const retrieved = await storage.getAllSessions()
      expect(retrieved).toHaveLength(100)
    })

    it('应正确加载100条会话记录', async () => {
      for (let i = 0; i < 100; i++) {
        await storage.saveSession(createTestSession(i))
      }

      const startTime = Date.now()
      const sessions = await storage.getAllSessions()
      const loadTime = Date.now() - startTime

      console.log(`加载100条会话耗时: ${loadTime}ms`)

      expect(sessions).toHaveLength(100)
      
      const sessionIds = sessions.map(s => s.id)
      expect(sessionIds).toContain('session-0')
      expect(sessionIds).toContain('session-99')
      
      for (let i = 0; i < sessions.length - 1; i++) {
        expect(sessions[i].metadata.updatedAt).toBeGreaterThanOrEqual(sessions[i + 1].metadata.updatedAt)
      }
    })

    it('100条记录应包含所有主题分布', async () => {
      const topics = Object.values(ChatTopic)
      for (let i = 0; i < 100; i++) {
        const topic = topics[i % topics.length]
        await storage.saveSession(createTestSession(i, topic))
      }

      const stats = await storage.getStatistics()
      expect(stats.totalSessions).toBe(100)
      expect(stats.totalMessages).toBe(200)

      const topicsWithSessions = Object.values(stats.sessionsByTopic).filter(count => count > 0)
      expect(topicsWithSessions).toHaveLength(8)
    })
  })

  describe('搜索与过滤', () => {
    beforeEach(async () => {
      for (let i = 0; i < 20; i++) {
        const topic = i % 2 === 0 ? ChatTopic.FORMULA_DESIGN : ChatTopic.INGREDIENT_ANALYSIS
        await storage.saveSession(createTestSession(i, topic))
      }
    })

    it('应按主题过滤', async () => {
      const sessions = await storage.getAllSessions({ topic: ChatTopic.FORMULA_DESIGN })
      expect(sessions).toHaveLength(10)
      sessions.forEach(session => {
        expect(session.metadata.topic).toBe(ChatTopic.FORMULA_DESIGN)
      })
    })

    it('应按关键词搜索', async () => {
      const sessions = await storage.getAllSessions({ keyword: '测试会话 5' })
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('session-5')
    })

    it('应按标签过滤', async () => {
      const sessions = await storage.getAllSessions({ tags: ['tag-0'] })
      expect(sessions.length).toBeGreaterThan(0)
    })

    it('应按日期范围过滤', async () => {
      const now = Date.now()
      const sessions = await storage.getAllSessions({
        dateFrom: now - 10000,
        dateTo: now + 10000
      })
      expect(sessions).toHaveLength(20)
    })
  })

  describe('统计信息', () => {
    it('应返回正确的统计信息', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.saveSession(createTestSession(i))
      }

      const stats = await storage.getStatistics()
      expect(stats.totalSessions).toBe(10)
      expect(stats.totalMessages).toBe(20)
      expect(stats.sessionsLastWeek).toBe(10)
      expect(stats.sessionsLastMonth).toBe(10)
    })

    it('应统计热门标签', async () => {
      for (let i = 0; i < 20; i++) {
        const session = createTestSession(i)
        session.metadata.tags = [`common-tag`, `tag-${i % 3}`]
        await storage.saveSession(session)
      }

      const stats = await storage.getStatistics()
      expect(stats.topTags.length).toBeGreaterThan(0)
      expect(stats.topTags[0].tag).toBe('common-tag')
      expect(stats.topTags[0].count).toBe(20)
    })
  })

  describe('存储限制', () => {
    it('应限制最多100条会话', async () => {
      for (let i = 0; i < 105; i++) {
        await storage.saveSession(createTestSession(i))
      }

      const sessions = await storage.getAllSessions()
      expect(sessions).toHaveLength(100)
    })
  })
})