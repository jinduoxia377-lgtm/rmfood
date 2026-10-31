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
 * - 多个并发 401 请求共享同一个 refresh 调用（排队），刷新失败时排队请求会被 reject
 *
 * 🔇 降噪修复:
 * - 修复响应拦截器内 `return Promise.reject(error)` 短路导致下方 401/403/404
 *   处理全部成为死代码的问题（token 刷新逻辑从未真正执行）
 * - _silent 请求在 401/5xx 时完全静默降级：不输出日志、不触发刷新、不重定向
 * - 请求日志降噪：静默请求不打日志；401/5xx 降级仅 debug 级别
 * - token 刷新带 5s 超时保护（AbortController + axios timeout）
 */
import axios from 'axios'
import type { Token } from '@/types'
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

// ── 静默请求判定 ──
// _silent 可位于 params(GET)、data(POST/PUT) 或 headers 三个位置，统一探测。
// 带 _silent 的请求属于「预期态请求」（启动认证检查、后台轮询等），
// 其 401/5xx 失败属于正常现象，应完全静默降级。
function isSilentRequest(config: unknown): boolean {
  const c = config as { params?: { _silent?: unknown }; data?: { _silent?: unknown }; headers?: { _silent?: unknown } } | undefined
  return Boolean(c?.params?._silent || c?.data?._silent || c?.headers?._silent)
}

// ── 静默降级响应构造 ──
// 返回一个 AxiosResponse 形状的对象；调用方拿到 data:null 即可按「无数据」处理，
// 不会触发 console 错误堆栈 / token 刷新 / 重定向。
function makeSilentResponse(original: unknown, status: number): Record<string, unknown> {
  const config = original as { request?: unknown } | undefined
  return {
    data: null,
    status,
    statusText: status === 401 ? 'Unauthorized' : status === 502 ? 'Bad Gateway' : 'Error',
    headers: {},
    config: original,
    request: config?.request,
    __silent: true as const,
  }
}

// 请求拦截器：自动附加 CSRF token + 请求日志降噪
api.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrf_token')
  if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  // 🔇 请求日志降噪：静默请求不打印，避免启动时 auth/me 等预期失败刷屏
  if (import.meta.env.DEV && !isSilentRequest(config)) {
    logger.debug(`[API] ${(config.method || 'get').toUpperCase()} ${config.url || ''}`)
  }
  return config
})

// 🔒 Cookie 名称（与后端一致）
const ACCESS_TOKEN_COOKIE = 'rmfood_access_token'
const REFRESH_TOKEN_COOKIE = 'rmfood_refresh_token'

// ── Token 刷新状态管理 ──
let isRefreshing = false
// 订阅者同时持有 resolve/reject：刷新成功 resolve，刷新失败 reject。
// 修复旧实现只持有 resolve 的缺陷 —— 否则刷新失败时，所有排队请求会永久挂起。
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

/**
 * 订阅 token 刷新事件，返回可 await 的 promise。
 * 多个并发 401 请求共享同一个 refresh 调用（排队）。
 */
const subscribeTokenRefresh = (): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject })
  })

/**
 * 通知所有订阅者 token 已刷新
 */
const notifyTokenRefresh = (token: string) => {
  refreshSubscribers.forEach(s => s.resolve(token))
  refreshSubscribers = []
}

/**
 * 通知所有订阅者 token 刷新失败（避免等待方永久挂起）
 */
const rejectTokenRefresh = (err: unknown) => {
  refreshSubscribers.forEach(s => s.reject(err))
  refreshSubscribers = []
}

// ── Token 刷新超时保护（5s）──
// 防止刷新请求挂起导致所有排队请求永久等待
const REFRESH_TIMEOUT_MS = 5000

/**
 * 🔒 P0 安全修复: 刷新 Token
 * 现在完全依赖后端 HttpOnly Cookie，刷新成功后自动续期
 * ⏱ 带 5s 超时保护 + AbortController，双保险
 */
const refreshToken = async (): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)
  try {
    // 🔒 刷新请求会自动携带 HttpOnly Cookie
    const response = await axios.post<Token>(
      `${API_BASE}/auth/refresh`,
      {},
      {
        withCredentials: true,
        timeout: REFRESH_TIMEOUT_MS,
        signal: controller.signal,
      },
    )

    // 🔒 Token 现在存储在后端设置的 HttpOnly Cookie 中，前端不再需要处理
    // 后端实际返回 snake_case access_token，兼容两种字段名
    const data = response.data as Token & { access_token?: string }
    return data.accessToken ?? data.access_token ?? ''
  } catch (error) {
    // 🔒 刷新失败时，Cookie 会被后端清除或过期
    // 重定向到登录页（确保不会静默失败）
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
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

// ── 响应拦截器：错误处理与静默降级 ──
// 🔇 降噪修复：原实现在此拦截器内以 `return Promise.reject(error)` 提前短路，
// 导致下方 404/401/403 处理（含 _silent 降级与 token 刷新）全部成为死代码。
// 本次修复移除了该短路，恢复完整错误处理链。
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const silent = isSilentRequest(original)

    // ── 静默处理请求被中止的错误（页面导航、组件卸载等正常场景）──
    if (error.code === 'ERR_ABORTED' || error.message === 'canceled') {
      if (import.meta.env.DEV && !silent) logger.debug('[API] 请求中止:', original?.url)
      return Promise.resolve(makeSilentResponse(original, 0) as never)
    }

    const status = error.response?.status

    // ── 404 未找到资源 ──
    if (status === 404) {
      if (import.meta.env.DEV && !silent) logger.debug(`[API] 404: ${original?.url || ''}`)
      return Promise.reject(error)
    }

    // ── 401 认证失败 / Token 过期 ──
    if (status === 401) {
      // 静默请求（启动时认证检查、后台轮询等）：完全静默降级
      // 不输出日志、不触发 token 刷新、不重定向，调用方拿到 data:null 自行处理
      if (silent) {
        return Promise.resolve(makeSilentResponse(original, 401) as never)
      }

      // 🔒 竞态修复：登录流程中的 getMe 调用跳过 token 刷新
      // 如果请求是登录流程的一部分（post-login getMe），直接拒绝而不是触发刷新
      // 否则会导致：getMe 401 → refreshToken → 再次 401 → clearAuthState → 重定向回登录页
      if (original?._loginFlow) {
        if (import.meta.env.DEV) logger.warn('[API] 登录流程中 getMe 失败，跳过 token 刷新')
        return Promise.reject(error)
      }

      // 防止无限重试：同一请求最多重试 1 次
      if (original?._retryCount) {
        clearAuthState()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
      original._retryCount = true

      const errorDetail = String(error.response?.data?.detail || error.response?.data?.message || '')
      const isAuthError = errorDetail.includes('认证') ||
                          errorDetail.includes('token') ||
                          errorDetail.includes('登录') ||
                          errorDetail.includes('Unauthorized') ||
                          errorDetail.includes('expired')

      if (isAuthError) {
        // 如果是登录或刷新请求，直接拒绝（避免登录页被自己的刷新逻辑重定向）
        if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
          if (import.meta.env.DEV) logger.warn('[API] 登录或刷新失败:', errorDetail)
          clearAuthState()
          return Promise.reject(error)
        }

        // 🔄 Token 刷新排队：多个并发 401 共享同一个 refresh 调用
        // 排队请求同时绑定 resolve/reject，刷新失败时会被 reject（旧实现只绑定 resolve，
        // 刷新失败会让排队请求永久挂起）。
        if (isRefreshing) {
          return subscribeTokenRefresh().then(
            () => api(original),
            (refreshErr) => Promise.reject(refreshErr),
          )
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
          // 🔄 通知所有排队请求刷新失败，避免永久挂起
          rejectTokenRefresh(refreshError)
          if (import.meta.env.DEV) logger.warn('[API] Token 刷新失败，用户将被登出')
          clearAuthState()
          // 重定向到登录页（确保不会静默失败）
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return Promise.reject(error)
        }
      }

      return Promise.reject(error)
    }

    // ── 403 权限不足 ──
    if (status === 403) {
      const errorDetail = String(error.response?.data?.detail || error.response?.data?.message || '')
      if (import.meta.env.DEV && !silent) logger.warn(`[API] 权限不足 (403): ${original?.url} - ${errorDetail}`)
      // AI/组织配额超限提示：dispatch 全局事件供前端升级引导
      if (errorDetail.includes('升级计划') || errorDetail.includes('上限')) {
        try {
          if (typeof window !== 'undefined') {
            const orgMatch = errorDetail.match(/\[org_id=(\d+)\]/)
            window.dispatchEvent(new CustomEvent('ai-quota-exceeded', {
              detail: {
                message: errorDetail,
                url: original?.url,
                org_id: orgMatch ? Number(orgMatch[1]) : undefined,
              },
            }))
          }
        } catch { /* ignore */ }
      }
      return Promise.reject(error)
    }

    // ── 5xx 静默降级：_silent 请求遇到 5xx（如 models/list 502）时降级而非报错 ──
    if (silent && typeof status === 'number' && status >= 500) {
      if (import.meta.env.DEV) logger.debug(`[API] 静默降级 ${status}: ${original?.url || ''}`)
      return Promise.resolve(makeSilentResponse(original, status) as never)
    }

    // 其余错误：静默请求不输出，避免非预期 5xx 刷屏
    if (import.meta.env.DEV && !silent) {
      logger.debug(`[API] 请求失败 ${status || error.code || ''}: ${original?.url || ''}`)
    }
    return Promise.reject(error)
  },
)

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE }
export default api
