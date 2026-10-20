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
import { normalizeUser } from '@/utils/userNormalizer';
import api from '@/api/client'
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  requiresTwoFactor: boolean
  twoFactorUsername: string | null

  login: (username: string, password: string, twoFactorCode?: string) => Promise<'ok' | '2fa'>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  setUser: (user: User) => void
  clearTwoFactor: () => void
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
        set({ user: normalizeUser(user), isAuthenticated: true })
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
    requiresTwoFactor: false,
    twoFactorUsername: null,

    // ═══════════════════════════════════════════
    // 登录流程 — 必须先验证 Cookie 再标记已认证
    // ═══════════════════════════════════════════
    login: async (username, password, twoFactorCode) => {
      let userFetched = false
      let fallbackToken: string | null = null

      try {
        set({ isLoading: true })

        // 1. 调用登录 API — 后端同时设置 HttpOnly Cookie 并返回 token
        const loginResult = await authApi.login({ username, password, twoFactorCode })

        // 1a. 2FA 二次验证：返回 requires_2fa 时不发放令牌，需要用户输入动态码
        if (loginResult && 'requires_2fa' in loginResult && loginResult.requires_2fa) {
          set({ requiresTwoFactor: true, twoFactorUsername: username, isLoading: false })
          return '2fa'
        }

        // 保存 token 作为 Cookie 失效时的降级方案
        // 后端返回 snake_case access_token；同时兼容 camelCase accessToken
        fallbackToken = (loginResult as any)?.access_token || (loginResult as any)?.accessToken || null

        // 2. 获取 CSRF token（必须在登录成功后、任何状态变更请求之前）
        // 说明: 后端并无 /auth/csrf 路由（只有 /agent/csrf-token）。
        // 双提交 CSRF 依赖 CsrfProtectMiddleware 在每个 GET 响应的 Set-Cookie 种下
        // csrf_token，而登录成功后的 getMe（GET）已完成该种入。
        // 旧实现显式 GET /auth/csrf 会 404 → 每次登录日志一条 404 + 一次无效请求。
        // 移除该调用；csrf cookie 由 getMe 自动完成。

        // 3. 立即获取用户信息 — 优先使用 Cookie，失败时回退到 Authorization header
        try {
          const { data: user } = await api.get<User>('/auth/me', {
            _loginFlow: true,
          } as Record<string, unknown>)
          set({ user: normalizeUser(user as unknown as Record<string, unknown>), isAuthenticated: true, requiresTwoFactor: false, twoFactorUsername: null })
          userFetched = true
        } catch (error) {
          // Cookie 可能因域名不匹配（如局域网访问）未被浏览器接受
          // 回退：使用登录接口返回的 token 作为 Authorization header 重试
          if (fallbackToken) {
            try {
              const { data: user } = await api.get<User>('/auth/me', {
                _loginFlow: true,
                headers: { Authorization: `Bearer ${fallbackToken}` },
              } as Record<string, unknown>)
              set({ user: normalizeUser(user as unknown as Record<string, unknown>), isAuthenticated: true, requiresTwoFactor: false, twoFactorUsername: null })
              userFetched = true
            } catch (fallbackError) {
              logger.error('Login fallback failed:', fallbackError)
              set({ isAuthenticated: false, isLoading: false })
              throw new Error('登录失败：Cookie 未被接受，请检查 CORS 和端口配置')
            }
          } else {
            logger.error('Failed to fetch user info after login:', error)
            set({ isAuthenticated: false, isLoading: false })
            throw new Error('登录失败：Cookie 未被接受，请检查 CORS 和端口配置')
          }
        }

        // 3. 初始化 CSRF token
        // 说明: 与上面第 2 步相同 —— 后端无 /auth/csrf 路由，csrf cookie 已由
        // 登录成功后的 getMe(GET) 由中间件种下，无需再显式请求。保留注释记录设计。

        // 4. 连接 WebSocket
        connectWebSocket().then((connected) => {
          logger.info('WebSocket connected after login:', connected)
        }).catch((error) => {
          logger.error('WebSocket connection error after login:', error)
        })

        return 'ok'
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

    clearTwoFactor: () => set({ requiresTwoFactor: false, twoFactorUsername: null }),

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
        set({ user: normalizeUser(user as unknown as Record<string, unknown>), isAuthenticated: true, isLoading: false })

        // 连接 WebSocket
        connectWebSocket().then((connected) => {
          logger.info('WebSocket connected after fetchUser:', connected)
        }).catch((error) => {
          logger.error('WebSocket connection error after fetchUser:', error)
        })
      } catch (error) {
        // 401 = 未登录 / 令牌过期，属于预期态而非错误；
        // 原实现打成 WARN，登录未鉴权时刷新/轮询会刷屏 401，
        // 降噪：降级为 debug（保留上下文，必要时打开 devtools 还能看到）。
        if ((error as { response?: { status?: number } })?.response?.status === 401) {
          logger.debug('fetchUser 未认证（预期态），保留现有 auth state')
        } else {
          logger.warn('fetchUser failed, keeping existing auth state:', error)
        }
        // 不清除 isAuthenticated — 登录态仍然有效，只是用户信息获取失败
        set({ isLoading: false })
      }
    },

    setUser: (user) => set({ user: normalizeUser(user as unknown as Record<string, unknown>) }),
  }
})
