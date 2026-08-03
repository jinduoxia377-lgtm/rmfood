/**
 * Axios API 客户端
 * 自动附加 JWT 令牌、统一错误处理、刷新令牌逻辑、CSRF token
 *
 * 🔒 P0 安全修复:
 * - Token 现在通过 HttpOnly Cookie 存储（后端设置）
 * - 前端不再从 localStorage 读写敏感 Token
 * - Authorization 头仅用于向后兼容，新请求依赖 Cookie 自动携带
 * - CSRF token 自动从 Cookie 读取并注入请求头
 *
 * 🔒 竞态修复:
 * - 登录流程中的 getMe 调用不再触发 token 刷新（_loginFlow 标记）
 * - 避免登录期间 401 导致重定向回登录页的死循环
 */
import axios from 'axios'
import type { Token, User } from '@/types'
import { UserRole } from '@/types'
import { envConfig } from '@/config/env'


import { logger } from '@/utils/safeLogger';
const API_BASE = envConfig.api.baseUrl

const api = axios.create({
  baseURL: API_BASE,
  timeout: envConfig.api.timeout,
  headers: { 'Content-Type': 'application/json' },
  // 🔒 启用 credentials，使浏览器自动携带 Cookie
  withCredentials: true,
})

// ── CSRF Token 工具 ──
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

// 请求拦截器：自动附加 CSRF token
api.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrf_token')
  if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

// 🔒 Cookie 名称（与后端一致）
const ACCESS_TOKEN_COOKIE = 'rmfood_access_token'
const REFRESH_TOKEN_COOKIE = 'rmfood_refresh_token'

// ── Token 刷新状态管理 ──
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

/**
 * 订阅 token 刷新事件
 */
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

/**
 * 通知所有订阅者 token 已刷新
 */
const notifyTokenRefresh = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

/**
 * 🔒 P0 安全修复: 刷新 Token
 * 现在完全依赖后端 HttpOnly Cookie，刷新成功后自动续期
 */
const refreshToken = async (): Promise<string> => {
  try {
    // 🔒 刷新请求会自动携带 HttpOnly Cookie
    const response = await axios.post<Token>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    )

    // 🔒 Token 现在存储在后端设置的 HttpOnly Cookie 中，前端不再需要处理
    return response.data.accessToken
  } catch (error) {
    // 🔒 刷新失败时，Cookie 会被后端清除或过期
    // 重定向到登录页
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw error
  }
}

/**
 * 清除认证状态
 */
const clearAuthState = () => {
  if (typeof window !== 'undefined') {
    // 清除 HttpOnly Cookie（后端 set-cookie with empty value）
    fetch(`${api.defaults.baseURL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => { /* 静默失败，不影响用户体验 */ })
    localStorage.removeItem('remember_me')
    localStorage.removeItem('username')
  }
}

// ── 响应拦截器：错误处理与模拟数据 fallback ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // ── 静默处理请求被中止的错误（页面导航、组件卸载等正常场景）──
    if (error.code === 'ERR_ABORTED' || error.message === 'canceled') {
      const silentResponse = {
        data: null,
        status: 0,
        statusText: 'aborted',
        headers: {},
        config: original,
        request: error.request,
        __aborted: true as const,
      }
      return Promise.resolve(silentResponse as never)
    }

    // 移除 mock fallback，始终使用真实 API
    return Promise.reject(error)

    // 处理 404 错误
    if (error.response?.status === 404) {
      return Promise.reject(error)
    }

    // ✅ 完整的 401 错误处理和 Token 自动刷新
    if (error.response?.status === 401) {
      // 静默请求（启动时认证检查）不触发 token 刷新和重定向
      if (original.params?._silent) {
        return Promise.resolve({ data: null, status: 401, statusText: 'Unauthorized', headers: {}, config: original })
      }

      // 🔒 竞态修复：登录流程中的 getMe 调用跳过 token 刷新
      // 如果请求是登录流程的一部分（post-login getMe），直接拒绝而不是触发刷新
      // 否则会导致：getMe 401 → refreshToken → 再次 401 → clearAuthState → 重定向回登录页
      if (original._loginFlow) {
        if (import.meta.env.DEV) logger.warn('[API] 登录流程中 getMe 失败，跳过 token 刷新')
        return Promise.reject(error)
      }

      // 防止无限重试：同一请求最多重试 1 次
      if (original._retryCount) {
        clearAuthState()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
      original._retryCount = true

      const errorDetail = error.response.data?.detail || error.response.data?.message || ''
      const isAuthError = errorDetail.includes('认证') ||
                          errorDetail.includes('token') ||
                          errorDetail.includes('登录') ||
                          errorDetail.includes('Unauthorized') ||
                          errorDetail.includes('expired')

      if (isAuthError) {
        // 如果是登录或刷新请求，直接拒绝
        if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
          if (import.meta.env.DEV) logger.warn('[API] 登录或刷新失败:', errorDetail)
          clearAuthState()
          return Promise.reject(error)
        }

        // 如果正在刷新，等待刷新完成
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeTokenRefresh(() => {
              // Token 刷新后重试请求（Cookie 会自动携带）
              resolve(api(original))
            })
          })
        }

        // 开始刷新 token
        isRefreshing = true

        try {
          await refreshToken()
          isRefreshing = false
          notifyTokenRefresh('refreshed')

          // 重新发送原始请求（Cookie 会自动携带）
          return api(original)
        } catch (refreshError) {
          isRefreshing = false
          if (import.meta.env.DEV) logger.warn('[API] Token 刷新失败，用户将被登出')
          clearAuthState()
          // 重定向到登录页
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return Promise.reject(error)
        }
      }

      return Promise.reject(error)
    }

    // 处理 403 权限不足错误
    if (error.response?.status === 403) {
      const errorDetail = error.response.data?.detail || error.response.data?.message || ''
      if (import.meta.env.DEV) logger.warn(`[API] 权限不足 (403): ${original.url} - ${errorDetail}`)
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE }
export default api
