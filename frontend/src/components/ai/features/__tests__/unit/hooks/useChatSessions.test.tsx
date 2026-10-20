/**
 * useChatSessions 单元测试
 *
 * 测试覆盖：
 * - 会话 CRUD 操作（创建/切换/删除/重命名）
 * - 会话置顶功能
 * - 会话搜索和过滤
 * - 会话导出/导入数据完整性
 * - 边界条件处理
 *
 * @version 1.0.0
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useChatSessions } from '../../../hooks/useChatSessions'

describe('useChatSessions', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('初始化', () => {
    it('应正确初始化为空状态', () => {
      const { result } = renderHook(() => useChatSessions())

      expect(result.current.sessions).toEqual([])
      expect(result.current.activeSessionId).toBeNull()
      expect(result.current.getStats()).toEqual({
        totalSessions: 0,
        totalMessages: 0,
        pinnedCount: 0,
      })
    })

    it('应从 localStorage 恢复已保存的会话', async () => {
      const savedSessions = [
        {
          id: 'session_1',
          title: '测试会话',
          createdAt: Date.now() - 1000,
          updatedAt: Date.now(),
          messageCount: 5,
          tags: ['test'],
          pinned: false,
        },
      ]

      localStorage.setItem(
        'rmfood_chat_sessions_v1',
        JSON.stringify(savedSessions)
      )

      const { result } = renderHook(() => useChatSessions())
      expect(result.current.sessions.length).toBe(1)
      expect(result.current.sessions[0].title).toBe('测试会话')
    })
  })

  describe('会话 CRUD 操作', () => {
    describe('createSession', () => {
      it('应成功创建新会话并返回 ID', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('新对话')
        })

        expect(result.current.sessions.length).toBe(1)
        expect(result.current.activeSessionId).toBe(sessionId)
        expect(result.current.sessions[0].title).toBe('新对话')
        expect(result.current.sessions[0].messageCount).toBe(0)
        expect(result.current.sessions[0].pinned).toBe(false)
        expect(result.current.sessions[0].tags).toEqual([])
      })

      it('不传标题时应使用默认标题', () => {
        const { result } = renderHook(() => useChatSessions())

        act(() => {
          result.current.createSession()
        })

        expect(result.current.sessions[0].title).toBe('新对话')
      })

      it('新创建的会话应添加到列表开头', () => {
        const { result } = renderHook(() => useChatSessions())

        act(() => {
          result.current.createSession('第一个')
          result.current.createSession('第二个')
        })

        expect(result.current.sessions.length).toBe(2)
        expect(result.current.sessions[0].title).toBe('第二个')
        expect(result.current.sessions[1].title).toBe('第一个')
      })

      it('超过最大限制时应抛出错误', () => {
        const { result } = renderHook(() => useChatSessions())

        expect(() => {
          for (let i = 0; i <= 101; i++) {
            act(() => {
              try {
                result.current.createSession(`会话 ${i}`)
              } catch (e) {
                if (i === 100) throw e
              }
            })
          }
        }).toThrow()

        expect(consoleWarnSpy).toHaveBeenCalled()
      })
    })

    describe('switchSession', () => {
      it('应成功切换活跃会话', () => {
        const { result } = renderHook(() => useChatSessions())

        let id1: string, id2: string

        act(() => {
          id1 = result.current.createSession('会话1')
          id2 = result.current.createSession('会话2')
        })

        act(() => {
          result.current.switchSession(id1!)
        })

        expect(result.current.activeSessionId).toBe(id1)

        act(() => {
          result.current.switchSession(id2!)
        })

        expect(result.current.activeSessionId).toBe(id2)
      })

      it('切换到不存在的会话时应警告', () => {
        const { result } = renderHook(() => useChatSessions())

        act(() => {
          result.current.switchSession('non_existent_id')
        })

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('目标会话不存在')
        )
      })
    })

    describe('deleteSession', () => {
      it('应成功删除指定会话', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('待删除')
          result.current.createSession('保留')
        })

        expect(result.current.sessions.length).toBe(2)

        act(() => {
          result.current.deleteSession(sessionId!)
        })

        expect(result.current.sessions.length).toBe(1)
        expect(result.current.sessions[0].title).toBe('保留')
      })

      it('删除当前活跃会话时应自动切换', () => {
        const { result } = renderHook(() => useChatSessions())

        let id1: string, id2: string

        act(() => {
          id1 = result.current.createSession('会话1')
          id2 = result.current.createSession('会话2')
        })

        act(() => {
          result.current.deleteSession(id2!)
        })

        expect(result.current.activeSessionId).toBe(id1)
      })

      it('删除唯一会话时 activeSessionId 应为 null', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('唯一会话')
        })

        act(() => {
          result.current.deleteSession(sessionId!)
        })

        expect(result.current.activeSessionId).toBeNull()
        expect(result.current.sessions.length).toBe(0)
      })
    })

    describe('renameSession', () => {
      it('应成功重命名会话', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('原始名称')
        })

        act(() => {
          result.current.renameSession(sessionId!, '新名称')
        })

        expect(result.current.sessions[0].title).toBe('新名称')
      })

      it('标题过长时应自动截断', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('短名称')
        })

        const longTitle = 'A'.repeat(60)

        act(() => {
          result.current.renameSession(sessionId!, longTitle)
        })

        expect(result.current.sessions[0].title.length).toBe(50)
      })

      it('空标题时应拒绝重命名', () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('原始')
        })

        act(() => {
          result.current.renameSession(sessionId!, '')
        })

        expect(result.current.sessions[0].title).toBe('原始')
        expect(consoleWarnSpy).toHaveBeenCalled()
      })
    })
  })

  describe('置顶功能', () => {
    it('应切换会话的置顶状态', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('置顶测试')
      })

      expect(result.current.sessions[0].pinned).toBe(false)

      act(() => {
        result.current.pinSession(sessionId!)
      })

      expect(result.current.sessions[0].pinned).toBe(true)

      act(() => {
        result.current.pinSession(sessionId!)
      })

      expect(result.current.sessions[0].pinned).toBe(false)
    })

    it('置顶会话应在排序中优先显示', () => {
      const { result } = renderHook(() => useChatSessions())

      let id1: string, id2: string

      act(() => {
        id1 = result.current.createSession('普通会话')
        id2 = result.current.createSession('置顶会话')
        result.current.pinSession(id2!)
      })

      expect(result.current.sessions[0].id).toBe(id2)
      expect(result.current.sessions[0].pinned).toBe(true)
      expect(result.current.sessions[1].id).toBe(id1)
      expect(result.current.sessions[1].pinned).toBe(false)
    })

    it('getStats 应正确统计置顶数量', () => {
      const { result } = renderHook(() => useChatSessions())

      let id1: string, id3: string

      act(() => {
        id1 = result.current.createSession('会话1')
        result.current.createSession('会话2')
        id3 = result.current.createSession('会话3')

        result.current.pinSession(id1!)
        result.current.pinSession(id3!)
      })

      const stats = result.current.getStats()
      expect(stats.pinnedCount).toBe(2)
      expect(stats.totalSessions).toBe(3)
    })
  })

  describe('搜索和过滤', () => {
    it('应根据关键词搜索会话', () => {
      const { result } = renderHook(() => useChatSessions())

      act(() => {
        result.current.createSession('配方开发咨询')
        result.current.createSession('营养成分分析')
        result.current.createSession('工艺优化建议')
      })

      const results = result.current.searchSessions('配方')
      expect(results.length).toBe(1)
      expect(results[0].title).toContain('配方')
    })

    it('空查询时应返回所有会话', () => {
      const { result } = renderHook(() => useChatSessions())

      act(() => {
        result.current.createSession('会话A')
        result.current.createSession('会话B')
      })

      const results = result.current.searchSessions('')
      expect(results.length).toBe(2)
    })

    it('搜索结果应按置顶和时间排序', () => {
      const { result } = renderHook(() => useChatSessions())

      let id1: string

      act(() => {
        id1 = result.current.createSession('Alpha')
        result.current.createSession('Beta')
        result.current.createSession('Alpha Beta')

        result.current.pinSession(id1!)
      })

      const results = result.current.searchSessions('Alpha')
      expect(results[0].id).toBe(id1)
      expect(results[0].pinned).toBe(true)
    })
  })

  describe('标签管理', () => {
    it('应设置会话标签', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('带标签的会话')
        result.current.setSessionTags(sessionId!, ['重要', '工作'])
      })

      expect(result.current.sessions[0].tags).toEqual(['重要', '工作'])
    })

    it('搜索应支持基于标签的匹配', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('某会话')
        result.current.setSessionTags(sessionId!, ['紧急'])
      })

      const results = result.current.searchSessions('紧急')
      expect(results.length).toBe(1)
    })
  })

  describe('导出和导入', () => {
    describe('exportSession', () => {
      it('应以 JSON 格式导出会话', async () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('导出测试')
        })

        const blob = await result.current.exportSession(sessionId!, 'json')
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(blob)
        })
        const parsed = JSON.parse(text)

        expect(parsed.title).toBe('导出测试')
        expect(parsed.id).toBeDefined()
        expect(parsed.createdAt).toBeDefined()
      })

      it('应以 Markdown 格式导出会话', async () => {
        const { result } = renderHook(() => useChatSessions())

        let sessionId: string

        act(() => {
          sessionId = result.current.createSession('Markdown 导出')
        })

        const blob = await result.current.exportSession(sessionId!, 'markdown')
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(blob)
        })

        expect(text).toContain('# Markdown 导出')
        expect(text).toContain('- **消息数量**:')
      })

      it('导出不存在的会话时应抛出错误', async () => {
        const { result } = renderHook(() => useChatSessions())

        await expect(
          result.current.exportSession('non_existent', 'json')
        ).rejects.toThrow('会话不存在')
      })
    })

    describe('importSession', () => {
      it('应从 JSON 数据导入会话', async () => {
        const { result } = renderHook(() => useChatSessions())

        const exportData = {
          id: 'original_session',
          title: '导入测试',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 3600000,
          messageCount: 10,
          tags: ['测试'],
          pinned: false,
        }

        const newSessionId = await result.current.importSession(
          JSON.stringify(exportData)
        )

        await waitFor(() => {
          expect(result.current.sessions.length).toBe(1)
          expect(result.current.activeSessionId).toBe(newSessionId)
          expect(result.current.sessions[0].title).toContain('导入测试')
          expect(result.current.sessions[0].title).toContain('(已导入)')
        })
      })

      it('导入无效数据时应抛出错误', async () => {
        const { result } = renderHook(() => useChatSessions())

        await expect(
          result.current.importSession('not valid json')
        ).rejects.toThrow()

        await expect(
          result.current.importSession(JSON.stringify({ invalid: true }))
        ).rejects.toThrow('缺少必要字段')
      })

      it('导入后数据应保持完整性', async () => {
        const { result } = renderHook(() => useChatSessions())

        const originalData = {
          id: 'test_123',
          title: '完整数据测试',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 42,
          tags: ['完整', '测试'],
          pinned: true,
        }

        const importId = await result.current.importSession(
          JSON.stringify(originalData)
        )

        await waitFor(() => {
          const session = result.current.getSession(importId)
          expect(session?.tags).toEqual(['完整', '测试'])
          expect(session?.messageCount).toBe(42)
        })
      })
    })
  })

  describe('状态查询方法', () => {
    it('getSession 应返回正确的会话对象', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('查询测试')
      })

      const session = result.current.getSession(sessionId!)
      expect(session?.title).toBe('查询测试')
      expect(session?.id).toBe(sessionId)
    })

    it('getSession 对于不存在的 ID 应返回 undefined', () => {
      const { result } = renderHook(() => useChatSessions())

      const session = result.current.getSession('nonexistent')
      expect(session).toBeUndefined()
    })

    it('getActiveSession 应返回当前活跃会话', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('活跃会话')
      })

      const activeSession = result.current.getActiveSession()
      expect(activeSession?.id).toBe(sessionId)
    })

    it('updateMessageCount 应更新消息计数', () => {
      const { result } = renderHook(() => useChatSessions())

      let sessionId: string

      act(() => {
        sessionId = result.current.createSession('计数测试')
      })

      act(() => {
        result.current.updateMessageCount(sessionId!, 10)
      })

      expect(result.current.sessions[0].messageCount).toBe(10)

      const stats = result.current.getStats()
      expect(stats.totalMessages).toBe(10)
    })
  })

  describe('持久化', () => {
    it('会话变更应自动保存到 localStorage', () => {
      const { result } = renderHook(() => useChatSessions())

      act(() => {
        result.current.createSession('持久化测试')
      })

      const stored = localStorage.getItem('rmfood_chat_sessions_v1')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.length).toBeGreaterThan(0)
      expect(parsed.some((s: any) => s.title === '持久化测试')).toBe(true)
    })
  })
})
