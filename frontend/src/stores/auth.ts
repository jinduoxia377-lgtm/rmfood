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
 *
 * 🔇 降噪修复:
 * - 认证状态缓存到 sessionStorage（5 分钟 TTL），避免启动时重复请求 auth/me
 * - 缓存仅存非敏感用户档案（不含 token），符合 P0「不持久化 token」约束
 * - fetchUser 使用 _silent 请求：401 属预期态，不触发 token 刷新/重定向
 * - 并发 fetchUser 共享同一 in-flight promise，避免重复请求
 */
import { create } from 'zustand'
import type { User } from '@/types'
import { authApi } from '@/api/auth'
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket'
import { logger } from '@/utils/safeLogger';
import { normalizeUser } from '@/utils/userNormalizer';
import api from '@/api/client'

// ═══════════════════════════════════════════
// 认证状态缓存 (sessionStorage, 5 分钟 TTL)
// 仅缓存非敏感用户档案（不含 token），符合 P0「不持久化 token」约束
// ═══════════════════════════════════════════
const AUTH_CACHE_KEY = 'rmfood_auth_cache_v1'
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000

interface AuthCacheEntry {
  user: Record<string, unknown>
  ts: number
}

function readAuthCache(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthCacheEntry
    if (!parsed?.user || typeof parsed.ts !== 'number') return null
    // 过期即清除，避免返回陈旧缓存
    if (Date.now() - parsed.ts > AUTH_CACHE_TTL_MS) {
      sessionStorage.removeItem(AUTH_CACHE_KEY)
      return null
    }
    return parsed.user
  } catch {
    // sessionStorage 不可用（隐私模式 / SSR）时静默降级为无缓存
    return null
  }
}

function writeAuthCache(user: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, ts: Date.now() }))
  } catch { /* 忽略配额/隐私模式错误 */ }
}

function clearAuthCache(): void {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY)
  } catch { /* 忽略 */ }
}

// ═══════════════════════════════════════════
// 并发去重：共享同一 in-flight promise
// 多个组件同时调用 fetchUser 时只发一个网络请求
// ═══════════════════════════════════════════
let fetchUserInFlight: Promise<void> | null = null

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

export const useAuthStore = create<AuthState>()((set, _get) => {

  // ═══════════════════════════════════════════
  // 启动时静默检查认证状态
  // 使用 Cookie 自动携带机制验证登录态；优先读取 sessionStorage 缓存
  // ═══════════════════════════════════════════
  setTimeout(async () => {
    try {
      // 1. 5 分钟内的缓存直接复用，避免重复 auth/me 网络请求
      const cached = readAuthCache()
      if (cached) {
        set({ user: normalizeUser(cached), isAuthenticated: true, isLoading: false })
        return
      }

      // 2. 静默网络请求（_silent → 401 时由拦截器完全静默降级）
      const response = await api.get('/auth/me', { params: { _silent: true } })
      const user = response.data
      if (user) {
        const normalized = normalizeUser(user as Record<string, unknown>)
        writeAuthCache(normalized as unknown as Record<string, unknown>)
        set({ user: normalized, isAuthenticated: true })
      } else {
        clearAuthCache()
        set({ user: null, isAuthenticated: false })
      }
    } catch {
      // 静默失败 — 不覆盖 isLoading，让登录流程自行处理
      clearAuthCache()
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
        const loginResultToken = loginResult as { access_token?: string | null; accessToken?: string | null }
        fallbackToken = loginResultToken?.access_token || loginResultToken?.accessToken || null

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
          const normalized = normalizeUser(user as unknown as Record<string, unknown>)
          writeAuthCache(normalized as unknown as Record<string, unknown>)
          set({ user: normalized, isAuthenticated: true, requiresTwoFactor: false, twoFactorUsername: null })
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
              const normalized = normalizeUser(user as unknown as Record<string, unknown>)
              writeAuthCache(normalized as unknown as Record<string, unknown>)
              set({ user: normalized, isAuthenticated: true, requiresTwoFactor: false, twoFactorUsername: null })
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
        // 清理本地状态 + 认证缓存
        clearAuthCache()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })

        // 断开 WebSocket 连接
        disconnectWebSocket()
      }
    },

    fetchUser: () => {
      // 🔄 并发去重：已有 in-flight 请求时直接复用，避免重复 auth/me
      if (fetchUserInFlight) return fetchUserInFlight

      fetchUserInFlight = (async () => {
        try {
          // 🔇 _silent=true：401 属预期态（未登录），由拦截器静默降级，
          // 不触发 token 刷新/重定向，仅保留现有 auth state。
          const user = await authApi.getMe({ silent: true })

          // 401 静默降级时 data 为 null → 保留现有 auth state，不清除登录态
          if (!user) {
            set({ isLoading: false })
            return
          }

          const normalized = normalizeUser(user as unknown as Record<string, unknown>)
          writeAuthCache(normalized as unknown as Record<string, unknown>)
          set({ user: normalized, isAuthenticated: true, isLoading: false })

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
        } finally {
          fetchUserInFlight = null
        }
      })()

      return fetchUserInFlight
    },

    setUser: (user) => {
      const normalized = normalizeUser(user as unknown as Record<string, unknown>)
      writeAuthCache(normalized as unknown as Record<string, unknown>)
      set({ user: normalized })
    },
  }
})
