/**
 * 统一的 Token 管理工具
 *
 * 🔒 P0 安全修复: 集中管理认证状态，消除分散的 localStorage token 读取。
 * 所有需要认证的 API 请求应通过 api 实例（基于 Cookie 认证）或 getApiHeader()。
 */

// 🔒 P0 修复：统一 token 存储名称（避免三种不同 key）
export const TOKEN_STORAGE_KEY = 'rmfood_access_token' as const
export const REFRESH_TOKEN_STORAGE_KEY = 'rmfood_refresh_token' as const

/**
 * 从 localStorage 获取 access token
 * @deprecated 优先使用 api 实例（Cookie-based）；仅在必须使用 Bearer token 的场景调用
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

/**
 * 从 sessionStorage 获取旧格式 token（兼容遗留代码）
 * @internal
 */
function getLegacyToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null
}

/**
 * 获取认证 token（访问主 token → 回退到旧格式）
 * @deprecated 仅用于兼容遗留组件，逐步迁移到 api 实例
 */
export function getAuthToken(): string {
  return getAccessToken() || getLegacyToken() || ''
}
