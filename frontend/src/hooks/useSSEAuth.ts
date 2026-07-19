/**
 * 共享的 SSE token 获取逻辑
 * 避免在每个面板中重复 localStorage.getItem('token')
 */
export function getAuthToken(): string {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}
