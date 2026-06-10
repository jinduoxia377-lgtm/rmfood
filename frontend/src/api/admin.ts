/**
 * 通知与用户管理 API
 */
import api from './client'
import type { Notification, User, PaginatedResponse } from '@/types'

export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<PaginatedResponse<Notification> & { unread_count: number }>('/notifications', { params }).then((r) => r.data),

  markRead: (id: number) => api.post(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
}

export const adminApi = {
  listUsers: (params?: { page?: number; page_size?: number; role?: string; search?: string }) =>
    api.get<PaginatedResponse<User>>('/admin/users', { params }).then((r) => r.data),

  createUser: (data: { username: string; password: string; email: string; full_name?: string; role?: string }) =>
    api.post<User>('/users', data).then((r) => r.data),

  deleteUser: (userId: number) =>
    api.delete(`/users/${userId}`).then((r) => r.data),

  updateUserRole: (userId: number, role: string) =>
    api.put(`/admin/users/${userId}/role`, null, { params: { role } }).then((r) => r.data),

  toggleUserStatus: (userId: number) =>
    api.put(`/admin/users/${userId}/status`).then((r) => r.data),
}
