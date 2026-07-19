/**
 * 认证状态管理 (Zustand)
 * 管理用户登录态、认证状态
 *
 * 🔒 P0 安全修复:
 * - Token 现在通过 HttpOnly Cookie 存储（后端设置）
 * - 不再将 Token 持久化到 localStorage/sessionStorage
 * - Zustand store 仅管理用户信息和认证状态
 *
 * 🔒 竞态修复:
 * - 登录成功后必须先验证 Cookie 可用（getMe），再标记 isAuthenticated
 * - 启动时的静默检查只更新 user/isAuthenticated，不覆盖 isLoading
 * - 避免 setTimeout(0) 与登录流程产生状态竞争
 */
import { create } from 'zustand'
import type { User } from '@/types'
import { UserRole } from '@/types'
import { authApi } from '@/api/auth'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import { logger } from '@/utils/safeLogger';
import api from '@/api/client'
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()((set, get) => {

  // ═══════════════════════════════════════════
  // 启动时静默检查认证状态
  // 使用 Cookie 自动携带机制验证登录态
  // ═══════════════════════════════════════════
  setTimeout(async () => {
    try {
      const response = await api.get('/auth/me', { params: { _silent: true } })
      const user = response.data
      if (user) {
        set({ user, isAuthenticated: true })
      } else {
        set({ user: null, isAuthenticated: false })
      }
    } catch {
      // 静默失败 — 不覆盖 isLoading，让登录流程自行处理
      set({ user: null, isAuthenticated: false })
    } finally {
      set({ isLoading: false })
    }
  }, 0)

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    // ═══════════════════════════════════════════
    // 登录流程 — 必须先验证 Cookie 再标记已认证
    // ═══════════════════════════════════════════
    login: async (username, password) => {
      let userFetched = false

      try {
        set({ isLoading: true })

        // 1. 调用登录 API，后端会设置 HttpOnly Cookie
        await authApi.login({ username, password })

        // 2. 立即获取用户信息 — 这一步验证 Cookie 确实被浏览器接受了
        //    使用 _loginFlow 标记跳过 token 刷新逻辑（避免登录期间 401 触发重定向）
        try {
          const { data: user } = await api.get<User>('/auth/me', {
            _loginFlow: true,
          } as Record<string, unknown>)
          set({ user, isAuthenticated: true })
          userFetched = true
        } catch (error) {
          logger.error('Failed to fetch user info after login:', error)
          // getMe 失败 = Cookie 未被接受，保持未认证状态
          set({ isAuthenticated: false, isLoading: false })
          throw new Error('登录失败：Cookie 未被接受，请检查 CORS 和端口配置')
        }

        // 3. 验证通过后，连接 WebSocket
        connectWebSocket().then((connected) => {
          logger.info('WebSocket connected after login:', connected)
        }).catch((error) => {
          logger.error('WebSocket connection error after login:', error)
        })
      } catch (error) {
        logger.error('Login error:', error)
        set({ isLoading: false })
        throw error
      } finally {
        // 如果 getMe 成功但 finally 时 isLoading 仍为 true，确保重置
        if (userFetched) {
          set({ isLoading: false })
        }
      }
    },

    logout: async () => {
      try {
        // 调用登出 API，后端会清除 HttpOnly Cookie
        await authApi.logout()
      } catch (error) {
        logger.warn('Logout API failed, continuing with local cleanup:', error)
      } finally {
        // 清理本地状态
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })

        // 断开 WebSocket 连接
        disconnectWebSocket()
      }
    },

    fetchUser: async () => {
      try {
        const user = await authApi.getMe()
        set({ user, isAuthenticated: true, isLoading: false })

        // 连接 WebSocket
        connectWebSocket().then((connected) => {
          logger.info('WebSocket connected after fetchUser:', connected)
        }).catch((error) => {
          logger.error('WebSocket connection error after fetchUser:', error)
        })
      } catch (error) {
        logger.warn('fetchUser failed, keeping existing auth state:', error)
        // 不清除 isAuthenticated — 登录态仍然有效，只是用户信息获取失败
        set({ isLoading: false })
      }
    },

    setUser: (user) => set({ user }),
  }
})
