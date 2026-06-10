/**
 * 标签 API
 */
import api from './client'
import type { Tag } from '@/types'

export interface TagCreatePayload {
  name: string
  color?: string
  icon?: string
}

export const tagApi = {
  list: (params?: { search?: string; order_by?: 'usage_count' | 'created_at' | 'name' }) =>
    api.get<Tag[]>('/tags', { params }).then((r) => r.data),

  getPopular: (limit?: number) =>
    api.get<Tag[]>('/tags/popular', { params: { limit } }).then((r) => r.data),

  get: (id: number) =>
    api.get<Tag>(`/tags/${id}`).then((r) => r.data),

  create: (data: TagCreatePayload) =>
    api.post<Tag>('/tags', null, { params: data }).then((r) => r.data),

  update: (id: number, data: Partial<TagCreatePayload>) =>
    api.put<Tag>(`/tags/${id}`, null, { params: data }).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/tags/${id}`),

  batchCreate: (names: string[]) =>
    api.post<{ created: { id: number; name: string }[]; skipped: string[] }>('/tags/batch', null, { params: { names } }).then((r) => r.data),
}
