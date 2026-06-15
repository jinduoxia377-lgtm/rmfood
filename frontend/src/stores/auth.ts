/**
 * 认证状态管理 (Zustand)
 * 管理用户登录态、认证状态
 *
 * 🔒 P0 安全修复:
 * - Token 现在通过 HttpOnly Cookie 存储（后端设置）
 * - 不再将 Token 持久化到 localStorage/sessionStorage
 * - Zustand store 仅管理用户信息和认证状态
 */
import { create } from 'zustand'
import type { User } from '@/types'
import { UserRole } from '@/types'
import { authApi } from '@/api/auth'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import { logger } from '@/utils/safeLogger';


interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()((set) => {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (username, password) => {
      try {
        set({ isLoading: true })

        // 调用登录 API，后端会设置 HttpOnly Cookie
        await authApi.login({ username, password })

        set({
          isAuthenticated: true,
          isLoading: false,
        })

        // 获取用户信息
        try {
          const user = await authApi.getMe()
          set({ user })
        } catch (error) {
          logger.error('Failed to fetch user info:', error)
          // 使用默认用户信息（临时）
          set({
            user: {
              id: 0,
              username,
              email: `${username}@example.com`,
              fullName: username,
              role: UserRole.RESEARCHER,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              department: '',
              phone: '',
              avatarUrl: '',
              loginAttempts: 0,
            }
          })
        }

        // 登录成功后连接 WebSocket
        connectWebSocket().then((connected) => {
          logger.info('WebSocket connected after login:', connected)
        }).catch((error) => {
          logger.error('WebSocket connection error after login:', error)
        })
      } catch (error) {
        logger.error('Login error:', error)
        set({ isLoading: false })
        throw error
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
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    },

    setUser: (user) => set({ user }),
  }
})
