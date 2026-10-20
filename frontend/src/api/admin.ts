/**
 * 通知与用户管理 API
 */
import api from './client'
import type { User } from '@/types'
import { normalizeNotificationList } from '@/utils/notification'

// ═══════════════════════════════════════
// 账号申请（预注册）队列类型
// ═══════════════════════════════════════
export type PreRegisterStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface PreRegisterRequest {
  id: number
  email: string
  full_name: string | null
  department: string | null
  apply_reason: string | null
  source: string | null
  status: PreRegisterStatus
  email_verified_at: string | null
  verify_attempts: number
  cooldown_until: string | null
  attempt_count: number
  review_deadline: string | null
  review_note: string | null
  expired_at: string | null
  reviewed_by: number | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  reject_reason: string | null
  user_id: number | null
  ip_address: string | null
  created_at: string
  updated_at: string
}

export interface PreRegisterListResponse {
  items: PreRegisterRequest[]
  total: number
  page: number
  page_size: number
  status_counts: Record<PreRegisterStatus, number>
}

export interface PreRegisterApproveParams {
  role?: string
  password?: string
  note?: string
}

export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get<any>('/notifications', {
      params: {
        ...params,
        // 对齐后端契约（v1 notification_router）：状态筛选参数名为 is_read
        is_read: params?.status ? params.status === 'read' : undefined,
      },
    }).then((r) => normalizeNotificationList(r.data)),

  markRead: (id: number) => api.put(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
}

export const adminApi = {
  listUsers: (params?: { page?: number; page_size?: number; role?: string; search?: string; status?: string; organization_id?: number; sort_field?: string; sort_dir?: string }) =>
    api.get<any>('/admin/users', { params }).then((r) => {
      const raw = r.data;
      // Backend returns {items, total, page, page_size, stats}
      // Normalize to standard PaginatedResponse shape
      return {
        success: true,
        data: raw.items || [],
        items: raw.items || [],
        total: raw.total || 0,
        page: raw.page || 1,
        page_size: raw.page_size || 20,
        stats: raw.stats,
        pagination: {
          page: raw.page || 1,
          pageSize: raw.page_size || 20,
          total: raw.total || 0,
          totalPages: raw.total ? Math.ceil(raw.total / (raw.page_size || 20)) : 0,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  createUser: (data: { username: string; password: string; email: string; full_name?: string; department?: string; role?: string; organization_id?: number }) =>
    api.post<User>('/users', data).then((r) => r.data),

  deleteUser: (userId: number) =>
    api.delete(`/users/${userId}`).then((r) => r.data),

  updateUser: (userId: number, data: { email?: string; full_name?: string; phone?: string; department?: string; avatar_url?: string; preferences?: Record<string, any> }) =>
    api.put<User>(`/users/${userId}`, data).then((r) => r.data),

  updateUserRole: (userId: number, role: string) =>
    api.put(`/admin/users/${userId}/role`, null, { params: { role } }).then((r) => r.data),

  toggleUserStatus: (userId: number) =>
    api.put(`/admin/users/${userId}/status`).then((r) => r.data),

  setUserStatus: (userId: number, active: boolean) =>
    api.put(`/admin/users/${userId}/status`, null, { params: { enable: active } }).then((r) => r.data),

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
    api.get<{ items: any[]; total: number }>('/activity/timeline', { params: { ...params, user_id: userId } }).then((r) => r.data),

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

  resetUserPassword: (userId: number, password?: string) =>
    api.post<{ detail: string; username: string; temp_password: string | null }>(
      `/admin/users/${userId}/reset-password`,
      { password: password || undefined },
    ).then((r) => r.data),

  getUser2faStatus: (userId: number) =>
    api.get<{ user_id: number; username: string; enabled: boolean }>(`/admin/users/${userId}/2fa-status`).then((r) => r.data),

  enableUser2fa: (userId: number) =>
    api.post<{ enabled: boolean; secret: string; otpauth_url: string; username: string }>(`/admin/users/${userId}/2fa/enable`).then((r) => r.data),

  disableUser2fa: (userId: number) =>
    api.post<{ user_id: number; username: string; enabled: boolean }>(`/admin/users/${userId}/2fa/disable`).then((r) => r.data),

  getUserTrend: (days?: number) =>
    api.get<any>('/analytics/trends/users', { params: { days: days ?? 30, granularity: 'daily' } }).then((r) => r.data),

  getOrganizations: () =>
    api.get<{ organizations: { id: number; name: string; user_count: number }[] }>('/admin/users/organizations').then((r) => r.data),

  // ── 账号申请（预注册）队列管理 ──
  listPreRegisterRequests: (params?: {
    page?: number
    page_size?: number
    status?: PreRegisterStatus | ''
    source?: string
    search?: string
  }) =>
    api.get<PreRegisterListResponse>('/admin/pre-register-requests', {
      params: {
        page: params?.page,
        page_size: params?.page_size,
        status: params?.status || undefined,
        source: params?.source || undefined,
        search: params?.search || undefined,
      },
    }).then((r) => r.data),

  approvePreRegisterRequest: (
    requestId: number,
    data?: PreRegisterApproveParams,
  ) =>
    api.post<{ detail: string; user_id: number; username: string; temp_password: string | null }>(
      `/admin/pre-register-requests/${requestId}/approve`,
      data ?? {},
    ).then((r) => r.data),

  rejectPreRegisterRequest: (requestId: number, reason?: string) =>
    api
      .post<{ detail: string }>(`/admin/pre-register-requests/${requestId}/reject`, {
        reason: reason || undefined,
      })
      .then((r) => r.data),

  /** 批量通过 */
  batchApprovePreRegisterRequests: (ids: number[], data?: { role?: string; password?: string; note?: string }) =>
    api
      .post<{ results: { request_id: number; ok: boolean; message: string; username?: string; user_id?: number; temp_password?: string | null }[]; success_count: number; fail_count: number }>(
        '/admin/pre-register-requests/batch-approve',
        { ids, role: data?.role ?? 'researcher', password: data?.password, note: data?.note },
      )
      .then((r) => r.data),

  /** 批量拒绝 */
  batchRejectPreRegisterRequests: (ids: number[], reason?: string) =>
    api
      .post<{ results: { request_id: number; ok: boolean; message: string }[]; success_count: number; fail_count: number }>(
        '/admin/pre-register-requests/batch-reject',
        { ids, reason: reason || undefined },
      )
      .then((r) => r.data),

  /** 重发邮箱验证码（管理员） */
  resendPreRegisterCode: (requestId: number) =>
    api
      .post<{ request_id: number; email: string; retry_after: number; server_time: string }>(
        `/admin/pre-register-requests/${requestId}/resend-code`,
      )
      .then((r) => r.data),

  /** 重新激活过期申请 */
  reactivatePreRegisterRequest: (requestId: number) =>
    api
      .post<{ detail: string }>(`/admin/pre-register-requests/${requestId}/reactivate`)
      .then((r) => r.data),

  /** 撤销拒绝（误操作恢复为待审核） */
  undoRejectPreRegisterRequest: (requestId: number) =>
    api
      .post<{ detail: string }>(`/admin/pre-register-requests/${requestId}/undo-reject`)
      .then((r) => r.data),

  /** 导出申请列表（CSV） */
  exportPreRegisterRequests: (params?: { status?: string; source?: string; search?: string }) =>
    api
      .get<Blob>('/admin/pre-register-requests/export', {
        params: { status: params?.status, source: params?.source, search: params?.search },
        responseType: 'blob',
      })
      .then((r) => r.data),
}
