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

  updateMe: (data: { email?: string; full_name?: string; phone?: string; department?: string; avatar_url?: string }) =>
    api.put<User>('/auth/me', data).then((r) => r.data),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/auth/password', { old_password: oldPassword, new_password: newPassword }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
}
