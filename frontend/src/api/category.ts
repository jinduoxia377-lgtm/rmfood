/**
 * 分类 API
 */
import api from './client'
import type { Category } from '@/types'

export interface CategoryCreatePayload {
  name: string
  parent_id?: number | null
  description?: string
  sort_order?: number
}

export const categoryApi = {
  list: (params?: { parent_id?: number | null }) =>
    api.get<Category[]>('/categories', { params }).then((r) => r.data),

  getTree: () =>
    api.get<Category[]>('/categories/tree').then((r) => r.data),

  get: (id: number) =>
    api.get<Category>(`/categories/${id}`).then((r) => r.data),

  create: (data: CategoryCreatePayload) =>
    api.post<Category>('/categories', null, { params: data }).then((r) => r.data),

  update: (id: number, data: Partial<CategoryCreatePayload>) =>
    api.put<Category>(`/categories/${id}`, null, { params: data }).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/categories/${id}`),
}
