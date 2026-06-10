/**
 * 认证状态管理 (Zustand + Persist中间件)
 * 管理用户登录态、JWT 令牌、自动刷新
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { UserRole } from '@/types'
import { authApi } from '@/api/auth'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import { logger } from '@/utils/safeLogger';


interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  refreshToken: string | null

  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => {
      return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      accessToken: null,
      refreshToken: null,

      login: async (username, password) => {
        try {
          const token = await authApi.login({ username, password })
          // 兼容后端返回的下划线格式和前端类型的驼峰格式
          const accessToken = (token as any).access_token || token.accessToken
          const refreshToken = (token as any).refresh_token || token.refreshToken
          // 直接保存到 localStorage，确保后续请求可以使用
          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('refresh_token', refreshToken)
          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
          // 尝试获取用户信息，但即使失败也不影响登录
          try {
            const user = await authApi.getMe()
            set({ user })
          } catch (error) {
            logger.error('Failed to fetch user info:', error)
            // 使用默认用户信息
            set({ user: { id: 1, username, email: `${username}@example.com`, fullName: username, role: UserRole.ADMIN, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), department: '', phone: '', avatarUrl: '', loginAttempts: 0 } })
          }

          // 登录成功后连接WebSocket，但不阻塞登录流程
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

      logout: () => {
        // 清理 localStorage
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          isLoading: false,
        })

        // 登出时断开WebSocket连接
        disconnectWebSocket()
      },

      fetchUser: async () => {
        try {
          const user = await authApi.getMe()
          set({ user, isAuthenticated: true, isLoading: false })

          // 恢复登录状态后连接WebSocket
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
    }},
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      onRehydrateStorage: () => async (state) => {
        if (state) {
          const hasToken = !!state.accessToken
          const hasUser = !!state.user
          if (hasToken && !hasUser) {
            // 主动刷新 token，避免首次 /auth/me 请求因过期 token 触发 401（浏览器无法屏蔽的 resource error 日志）
            try {
              const rt = localStorage.getItem('refresh_token')
              if (rt) {
                const refreshed = await authApi.refresh(rt)
                const newAT = (refreshed as any).access_token || refreshed.accessToken
                const newRT = (refreshed as any).refresh_token || refreshed.refreshToken
                if (newAT) {
                  localStorage.setItem('access_token', newAT)
                  localStorage.setItem('refresh_token', newRT || rt)
                  state.accessToken = newAT
                  if (newRT) state.refreshToken = newRT
                }
              }
            } catch {
              // refresh 失败时由拦截器兜底处理，静默忽略
            }
            state.fetchUser()
          }
          if (!hasToken && !state.isAuthenticated) {
            state.isLoading = false
          }
        }
      },
    },
  ),
)
