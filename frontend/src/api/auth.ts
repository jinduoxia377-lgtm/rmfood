/**
 * 认证 API
 */
import api from './client'
import type { Token, User, LoginRequest } from '@/types'

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<Token>('/auth/login', data).then((r) => r.data),

  register: (data: LoginRequest & { email: string; full_name?: string }) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post<Token>('/auth/refresh', { refresh_token: refreshToken }).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  // 🔒 P0 安全修复: 登出 API
  logout: () => api.post('/auth/logout'),

  updateMe: (data: { email?: string; full_name?: string; phone?: string; department?: string; avatar_url?: string }) =>
    api.put<User>('/auth/me', data).then((r) => r.data),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/auth/password', { old_password: oldPassword, new_password: newPassword }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),

  /**
   * 邮箱预注册申请 — 平台暂未开放自助注册，
   * 未认证用户留下联系方式，由管理员开通账号。
   * 后端端点: POST /auth/pre-register (201)
   */
  preRegister: (data: { email: string; fullName?: string; department?: string }) =>
    api.post('/auth/pre-register', {
      email: data.email,
      full_name: data.fullName,
      department: data.department,
    }).then((r) => r.data),
}
