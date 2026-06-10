import { StateCoordinator } from '../StateCoordinator'
import { DEFAULT_GLOBAL_STATE } from '../types'
import { vi } from 'vitest'

describe('StateCoordinator', () => {
  let coordinator: StateCoordinator

  beforeEach(() => {
    coordinator = new StateCoordinator()
  })

  afterEach(() => {
    coordinator.clearAllListeners()
    coordinator.clearAllMiddlewares()
  })

  describe('状态读写正确性测试', () => {
    it('应该返回默认状态', () => {
      const authState = coordinator.getState('auth')
      expect(authState).toEqual(DEFAULT_GLOBAL_STATE.auth)
    })

    it('应该正确更新状态', () => {
      const newAuth = {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
        token: 'test-token',
      }

      coordinator.setState('auth', newAuth)

      expect(coordinator.getState('auth')).toEqual(newAuth)
    })

    it('应该支持获取完整状态', () => {
      const fullState = coordinator.getFullState()
      expect(fullState).toEqual(DEFAULT_GLOBAL_STATE)
    })

    it('应该独立更新不同状态键', () => {
      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })
      coordinator.setState('theme', {
        ...DEFAULT_GLOBAL_STATE.theme,
        mode: 'dark',
      })

      expect(coordinator.getState('auth').isLoggedIn).toBe(true)
      expect(coordinator.getState('theme').mode).toBe('dark')
    })
  })

  describe('订阅和取消订阅', () => {
    it('应该在状态变更时通知订阅者', () => {
      const listener = vi.fn()
      coordinator.subscribe('auth', listener)

      const newAuth = { ...DEFAULT_GLOBAL_STATE.auth, isLoggedIn: true }
      coordinator.setState('auth', newAuth)

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(newAuth, DEFAULT_GLOBAL_STATE.auth)
    })

    it('取消订阅后不应该再收到通知', () => {
      const listener = vi.fn()
      const unsubscribe = coordinator.subscribe('auth', listener)

      unsubscribe()

      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })

      expect(listener).not.toHaveBeenCalled()
    })

    it('应该支持多个订阅者', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      coordinator.subscribe('auth', listener1)
      coordinator.subscribe('auth', listener2)

      const newAuth = { ...DEFAULT_GLOBAL_STATE.auth, isLoggedIn: true }
      coordinator.setState('auth', newAuth)

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('1000次订阅后 clear 应该清理所有监听器（内存泄漏检测）', () => {
      const listeners: Array<() => void> = []

      for (let i = 0; i < 1000; i++) {
        const unsubscribe = coordinator.subscribe('auth', vi.fn())
        listeners.push(unsubscribe)
      }

      expect(coordinator.getListenerCount('auth')).toBe(1000)

      coordinator.clearAllListeners()

      expect(coordinator.getListenerCount('auth')).toBe(0)
      expect(coordinator.getListenerCount()).toBe(0)
    })

    it('取消单个订阅应该减少计数器', () => {
      const unsubscribes: Array<() => void> = []

      for (let i = 0; i < 10; i++) {
        unsubscribes.push(coordinator.subscribe('auth', vi.fn()))
      }

      expect(coordinator.getListenerCount('auth')).toBe(10)

      unsubscribes[0]()
      expect(coordinator.getListenerCount('auth')).toBe(9)

      unsubscribes.slice(1).forEach((unsubscribe) => unsubscribe())
      expect(coordinator.getListenerCount('auth')).toBe(0)
    })
  })

  describe('批量更新', () => {
    it('应该支持批量更新多个状态', () => {
      const authListener = vi.fn()
      const themeListener = vi.fn()

      coordinator.subscribe('auth', authListener)
      coordinator.subscribe('theme', themeListener)

      coordinator.batchUpdate([
        {
          key: 'auth',
          value: { ...DEFAULT_GLOBAL_STATE.auth, isLoggedIn: true },
        },
        {
          key: 'theme',
          value: { ...DEFAULT_GLOBAL_STATE.theme, mode: 'dark' as const },
        },
      ])

      expect(authListener).toHaveBeenCalledTimes(1)
      expect(themeListener).toHaveBeenCalledTimes(1)
      expect(coordinator.getState('auth').isLoggedIn).toBe(true)
      expect(coordinator.getState('theme').mode).toBe('dark')
    })

    it('空批量更新不应该触发任何操作', () => {
      const listener = vi.fn()
      coordinator.subscribe('auth', listener)

      coordinator.batchUpdate([])

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('并发更新竞态条件测试', () => {
    it('快速连续更新应该保持最终状态一致性', async () => {
      const results: Array<{ value: unknown; timestamp: number }> = []
      const listener = (newValue: unknown, _oldValue: unknown) => {
        results.push({ value: newValue, timestamp: Date.now() })
      }

      coordinator.subscribe('aiConfig', listener)

      const updates = Array.from({ length: 100 }, (_, i) => ({
        key: 'aiConfig' as const,
        value: {
          ...DEFAULT_GLOBAL_STATE.aiConfig,
          temperature: i * 0.01,
        },
      }))

      updates.forEach((update) => {
        coordinator.setState(update.key, update.value)
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(results.length).toBe(100)
      expect(
        (coordinator.getState('aiConfig') as { temperature: number }).temperature
      ).toBeCloseTo(0.99, 2)
    })

    it('并发批量更新不应该丢失更新', () => {
      const batch1 = [
        {
          key: 'workspace' as const,
          value: {
            ...DEFAULT_GLOBAL_STATE.workspace,
            activeTab: 'tab1',
          },
        },
      ]
      const batch2 = [
        {
          key: 'workspace' as const,
          value: {
            ...DEFAULT_GLOBAL_STATE.workspace,
            activeTab: 'tab2',
          },
        },
      ]

      coordinator.batchUpdate(batch1)
      coordinator.batchUpdate(batch2)

      expect(coordinator.getState('workspace').activeTab).toBe('tab2')
    })
  })

  describe('中间件执行顺序验证', () => {
    it('beforeSet 中间件应该在 setState 之前执行', () => {
      const executionOrder: string[] = []

      coordinator.addMiddleware('beforeSet', 'auth', (context, next) => {
        executionOrder.push(`beforeSet-${context.key}`)
        next()
      })

      coordinator.addMiddleware('afterSet', 'auth', (context, next) => {
        executionOrder.push(`afterSet-${context.key}`)
        next()
      })

      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })

      expect(executionOrder).toEqual(['beforeSet-auth', 'afterSet-auth'])
    })

    it('多个 beforeSet 中间件应该按添加顺序执行', () => {
      const executionOrder: number[] = []

      coordinator.addMiddleware('beforeSet', 'auth', (_context, next) => {
        executionOrder.push(1)
        next()
      })

      coordinator.addMiddleware('beforeSet', 'auth', (_context, next) => {
        executionOrder.push(2)
        next()
      })

      coordinator.addMiddleware('beforeSet', 'auth', (_context, next) => {
        executionOrder.push(3)
        next()
      })

      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })

      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('中间件错误不应该阻止其他中间件执行', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()
      let secondExecuted = false

      coordinator.addMiddleware('beforeSet', 'auth', (_context, _next) => {
        throw new Error('Test error')
      })

      coordinator.addMiddleware('beforeSet', 'auth', (_context, next) => {
        secondExecuted = true
        next()
      })

      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })

      expect(secondExecuted).toBe(true)
      consoleSpy.mockRestore()
    })
  })

  describe('重置功能', () => {
    it('resetState 应该恢复到默认值或指定的部分状态', () => {
      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
        token: 'test-token',
      })

      coordinator.resetState()

      expect(coordinator.getState('auth')).toEqual(DEFAULT_GLOBAL_STATE.auth)
    })

    it('resetState 应该支持部分重置', () => {
      coordinator.setState('auth', {
        ...DEFAULT_GLOBAL_STATE.auth,
        isLoggedIn: true,
      })
      coordinator.setState('theme', {
        ...DEFAULT_GLOBAL_STATE.theme,
        mode: 'dark',
      })

      coordinator.resetState({
        auth: { ...DEFAULT_GLOBAL_STATE.auth, isLoggedIn: true },
        theme: { ...DEFAULT_GLOBAL_STATE.theme, mode: 'light' },
      })

      expect(coordinator.getState('auth').isLoggedIn).toBe(true)
      expect(coordinator.getState('theme').mode).toBe('light')
    })
  })

  describe('与现有 auth store 兼容性测试', () => {
    it('应该能够从现有 auth store 迁移状态', () => {
      const existingAuthState = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'admin' as const,
          is_active: true,
          avatar_url: '',
        },
        token: 'jwt-token',
        role: 'admin' as const,
        isLoggedIn: true,
      }

      coordinator.setState('auth', existingAuthState)

      const migratedAuth = coordinator.getState('auth')

      expect(migratedAuth.isLoggedIn).toBe(true)
      expect(migratedAuth.token).toBe('jwt-token')
      expect(migratedAuth.user?.username).toBe('testuser')
      expect(migratedAuth.role).toBe('admin')
    })

    it('应该支持与现有 useAuthStore 的数据结构兼容', () => {
      const legacyAuthData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
        user: {
          id: 1,
          username: 'legacyuser',
          email: 'legacy@example.com',
          full_name: 'Legacy User',
          role: 'user' as const,
          is_active: true,
          avatar_url: '',
        },
      }

      const migratedAuth = {
        token: legacyAuthData.accessToken,
        user: legacyAuthData.user,
        role: legacyAuthData.user.role,
        isLoggedIn: legacyAuthData.isAuthenticated,
      }

      coordinator.setState('auth', migratedAuth)

      const currentAuth = coordinator.getState('auth')

      expect(currentAuth.token).toBe('access-token')
      expect(currentAuth.isLoggedIn).toBe(true)
      expect(currentAuth.user?.id).toBe(1)
    })
  })
})
