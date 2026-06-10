/**
 * 工作流 API
 */
import api from './client'

export interface WorkflowTask {
  id: number
  step_order: number
  name: string
  task_type: string
  status: string
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
}

export interface Workflow {
  id: number
  name: string
  workflow_type: string
  status: string
  description: string | null
  error_message: string | null
  created_by: number
  created_at: string
  updated_at: string
  task_count?: number
}

export interface WorkflowDetail extends Workflow {
  config: Record<string, unknown> | null
  result: Record<string, unknown> | null
  tasks: WorkflowTask[]
}

export const workflowApi = {
  list: (params?: { page?: number; page_size?: number; status?: string; workflow_type?: string }) =>
    api.get('/workflows', { params }).then((r) => r.data),

  get: (id: number) =>
    api.get(`/workflows/${id}`).then((r) => r.data as WorkflowDetail),

  statistics: () =>
    api.get('/workflows/statistics/summary').then((r) => r.data),

  cancel: (id: number) =>
    api.post(`/workflows/${id}/cancel`).then((r) => r.data),

  retry: (id: number) =>
    api.post(`/workflows/${id}/retry`).then((r) => r.data),
}
