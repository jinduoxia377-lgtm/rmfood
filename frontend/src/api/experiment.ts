/**
 * 实验 API
 */
import api from './client'
import type { Experiment, ExperimentData, PaginatedResponse } from '@/types'

export interface ExperimentCreatePayload {
  title: string
  description?: string
  formula_id?: number
  objectives?: string[]
  methodology?: string
  parameters?: Record<string, unknown>
  materials?: Array<{ name: string; quantity?: string; unit?: string }>
  equipment?: Array<{ name: string; quantity?: string; unit?: string }>
  start_date?: string
  end_date?: string
}

export const experimentApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    researcher_id?: number
    formula_id?: number
    search?: string
  }) => api.get<PaginatedResponse<Experiment>>('/experiments', { params }).then((r) => r.data),

  get: (id: number) => api.get<Experiment>(`/experiments/${id}`).then((r) => r.data),

  create: (data: ExperimentCreatePayload) =>
    api.post<Experiment>('/experiments', data).then((r) => r.data),

  update: (id: number, data: Partial<ExperimentCreatePayload>) =>
    api.put<Experiment>(`/experiments/${id}`, data).then((r) => r.data),

  delete: (id: number) => api.delete(`/experiments/${id}`),

  batchDelete: (ids: number[]) =>
    api.post<{ message: string; deleted: number }>('/experiments/batch-delete', { ids }).then((r) => r.data),

  // 状态
  start: (id: number) =>
    api.post<Experiment>(`/experiments/${id}/start`).then((r) => r.data),

  complete: (id: number, data?: { results?: Record<string, unknown>; conclusions?: string; recommendations?: string }) =>
    api.post<Experiment>(`/experiments/${id}/complete`, null, { params: data }).then((r) => r.data),

  // 数据点
  getData: (id: number) =>
    api.get<ExperimentData[]>(`/experiments/${id}/data`).then((r) => r.data),

  addData: (id: number, parameter: string, value?: number | string | null, unit?: string, notes?: string) =>
    api
      .post<ExperimentData>(`/experiments/${id}/data`, null, { params: { parameter, value, unit, notes } })
      .then((r) => r.data),

  deleteData: (dataPointId: number) => api.delete(`/experiments/data/${dataPointId}`),

  // 统计
  statistics: () => api.get<Record<string, number>>('/experiments/statistics').then((r) => r.data),
}
