/**
 * 通知与用户管理 API
 */
import api from './client'
import type { Notification, User, PaginatedResponse } from '@/types'

export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<PaginatedResponse<Notification> & { unread_count: number }>('/notifications', {
      params: {
        ...params,
        // 对齐后端契约（v1 notification_router）：状态筛选参数名为 is_read
        is_read: params?.status ? params.status === 'read' : undefined,
      },
    }).then((r) => r.data),

  markRead: (id: number) => api.put(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
}

export const adminApi = {
  listUsers: (params?: { page?: number; page_size?: number; role?: string; search?: string; status?: string; organization_id?: number }) =>
    api.get<any>('/admin/users', { params }).then((r) => {
      const raw = r.data;
      // Backend returns {items, total, page, page_size}
      // Normalize to standard PaginatedResponse shape
      return {
        success: true,
        data: raw.items || [],
        items: raw.items || [],
        total: raw.total || 0,
        page: raw.page || 1,
        page_size: raw.page_size || 20,
        pagination: {
          page: raw.page || 1,
          pageSize: raw.page_size || 20,
          total: raw.total || 0,
          totalPages: raw.total ? Math.ceil(raw.total / (raw.page_size || 20)) : 0,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  createUser: (data: { username: string; password: string; email: string; full_name?: string; role?: string; organization_id?: number }) =>
    api.post<User>('/users', data).then((r) => r.data),

  deleteUser: (userId: number) =>
    api.delete(`/users/${userId}`).then((r) => r.data),

  updateUser: (userId: number, data: { email?: string; full_name?: string; phone?: string; department?: string; avatar_url?: string; preferences?: Record<string, any> }) =>
    api.put<User>(`/users/${userId}`, data).then((r) => r.data),

  updateUserRole: (userId: number, role: string) =>
    api.put(`/admin/users/${userId}/role`, null, { params: { role } }).then((r) => r.data),

  toggleUserStatus: (userId: number) =>
    api.put(`/admin/users/${userId}/status`).then((r) => r.data),

  getAuditLogs: (params?: { page?: number; page_size?: number; entity_type?: string; action?: string }) =>
    api.get<any>('/admin/audit-logs', { params }).then((r) => {
      const raw = r.data;
      return {
        success: true,
        data: raw.items || [],
        items: raw.items || [],
        total: raw.total || 0,
        page: raw.page || 1,
        page_size: raw.page_size || 20,
        pagination: {
          page: raw.page || 1,
          pageSize: raw.page_size || 20,
          total: raw.total || 0,
          totalPages: raw.total ? Math.ceil(raw.total / (raw.page_size || 20)) : 0,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  getUserActivity: (userId: number, params?: { days?: number; limit?: number }) =>
    api.get<{ items: any[]; total: number }>('/activity/timeline', { params }).then((r) => r.data),

  batchImportUsers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ total: number; created: number; skipped_duplicate: number; errors: any[] }>('/admin/users/batch-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  getAccountLockStatus: (userId: number) =>
    api.get<{ is_locked: boolean; login_attempts: number; last_login?: string; lock_info?: any }>(`/admin/users/${userId}/lock-status`).then((r) => r.data),

  unlockUserAccount: (userId: number) =>
    api.post(`/admin/users/${userId}/unlock`).then((r) => r.data),

  getUserTrend: (days?: number) =>
    api.get<any>('/analytics/trends/users', { params: { days: days ?? 30, granularity: 'daily' } }).then((r) => r.data),

  getOrganizations: () =>
    api.get<{ organizations: { id: number; name: string; user_count: number }[] }>('/admin/users/organizations').then((r) => r.data),
}
