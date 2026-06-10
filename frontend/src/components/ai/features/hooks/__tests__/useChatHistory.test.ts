import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatHistory } from '../useChatHistory'
import { storageService } from '../../services/storageService'

vi.mock('../../services/storageService', () => ({
  storageService: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn().mockReturnValue([]),
  },
}))

describe('useChatHistory', () => {
  const mockStorageGet = storageService.get as Mock
  const mockStorageSet = storageService.set as Mock

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('应初始化空会话列表', () => {
      const { result } = renderHook(() => useChatHistory())
      
      expect(result.current.sessions).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('应从存储加载会话', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          title: 'Test Session',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        },
      ]
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory())
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })
    })
  })

  describe('会话创建', () => {
    it('应创建新会话', async () => {
      const { result } = renderHook(() => useChatHistory())
      
      await act(async () => {
        const session = result.current.createNewSession('New Session')
        expect(session.title).toBe('New Session')
      })
      
      expect(result.current.sessions).toHaveLength(1)
    })
  })

  describe('会话删除', () => {
    it('应删除会话', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          title: 'Test Session',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        },
      ]
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory())
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })
      
      await act(async () => {
        await result.current.deleteSession('session-1')
      })
      
      expect(result.current.sessions).toHaveLength(0)
    })
  })

  describe('会话搜索', () => {
    it('应搜索会话', async () => {
      const mockSessions = [
        { id: 's1', title: 'React Tutorial', messages: [], createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
        { id: 's2', title: 'Vue Guide', messages: [], createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
        { id: 's3', title: 'React Hooks', messages: [], createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
      ]
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory())
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(3)
      })
      
      await act(() => {
        result.current.setSearchQuery('React')
      })
      
      const filtered = result.current.getFilteredSessions()
      expect(filtered).toHaveLength(2)
    })
  })

  describe('会话排序', () => {
    it('应按更新时间排序', async () => {
      const now = Date.now()
      const mockSessions = [
        { id: 's1', title: 'Old', messages: [], createdAt: now - 1000, updatedAt: now - 1000, messageCount: 0 },
        { id: 's2', title: 'New', messages: [], createdAt: now, updatedAt: now, messageCount: 0 },
        { id: 's3', title: 'Middle', messages: [], createdAt: now - 500, updatedAt: now - 500, messageCount: 0 },
      ]
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory())
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(3)
      })
      
      expect(result.current.sessions[0].title).toBe('New')
      expect(result.current.sessions[1].title).toBe('Middle')
      expect(result.current.sessions[2].title).toBe('Old')
    })
  })

  describe('分页功能', () => {
    it('应支持分页', async () => {
      const mockSessions = Array.from({ length: 15 }, (_, i) => ({
        id: `session-${i}`,
        title: `Session ${i}`,
        messages: [],
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
        messageCount: 0,
      }))
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory({ pageSize: 5 }))
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(15)
      })
      
      const paged = result.current.getPagedSessions()
      expect(paged).toHaveLength(10)
      
      await act(() => {
        result.current.goToPage(2)
      })
      
      expect(result.current.pagination.currentPage).toBe(2)
    })
  })

  describe('辅助方法', () => {
    it('应根据ID获取会话', async () => {
      const mockSessions = [
        { id: 's1', title: 'Session 1', messages: [], createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
        { id: 's2', title: 'Session 2', messages: [], createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
      ]
      mockStorageGet.mockReturnValue(mockSessions)
      
      const { result } = renderHook(() => useChatHistory())
      
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })
      
      const session = result.current.getSessionById('s2')
      expect(session?.title).toBe('Session 2')
    })
  })
})
