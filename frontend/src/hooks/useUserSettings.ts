/**
 * 用户设置 API 钩子
 *
 * 封装所有用户设置相关的后端 API 调用
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
})

// ── 2FA ──

export function use2FAStatus() {
  return useQuery({
    queryKey: ['user-settings', '2fa-status'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/settings/2fa/status')
      return data
    },
  })
}

export function useEnable2FA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/settings/2fa/enable')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings', '2fa-status'] }),
  })
}

export function useDisable2FA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/settings/2fa/disable')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings', '2fa-status'] }),
  })
}

export function useVerify2FA() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post('/users/me/settings/2fa/verify', null, { params: { code } })
      return data
    },
  })
}

// ── 设备 ──

export function useDevices() {
  return useQuery({
    queryKey: ['user-settings', 'devices'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/settings/devices')
      return data
    },
  })
}

export function useRemoveDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deviceId: number) => {
      await api.delete(`/users/me/settings/devices/${deviceId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings', 'devices'] }),
  })
}

// ── 偏好 ──

export function usePreferences() {
  return useQuery({
    queryKey: ['user-settings', 'preferences'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/settings/preferences')
      return data
    },
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prefs: Record<string, any>) => {
      const { data } = await api.put('/users/me/settings/preferences', prefs)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings', 'preferences'] }),
  })
}

// ── 导出/导入 ──

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get('/users/me/settings/export', {
        responseType: 'blob',
      })
      return response.data
    },
  })
}

export function useImportData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/users/me/settings/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-profile'] }),
  })
}

// ── 登录历史 ──

export function useLoginHistory(limit = 20) {
  return useQuery({
    queryKey: ['user-settings', 'login-history', limit],
    queryFn: async () => {
      const { data } = await api.get('/users/me/settings/login-history', { params: { limit } })
      return data
    },
  })
}

// ── 清除数据 ──

export function useClearUserData() {
  return useMutation({
    mutationFn: async (confirm: string) => {
      const { data } = await api.post('/users/me/settings/clear-data', null, { params: { confirm } })
      return data
    },
  })
}
