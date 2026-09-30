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
  output_data?: Record<string, unknown> | null
  input_data?: Record<string, unknown> | null
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

export interface WorkflowListResponse {
  items: Workflow[]
  total: number
  page: number
  page_size: number
}

export interface WorkflowStatistics {
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

export interface WorkflowCreatePayload {
  name: string
  workflow_type: string
  description?: string
  template_id?: string
  config?: Record<string, unknown>
}

export interface WorkflowExecutionData {
  execution_id: string
  workflow_id: number
  status: 'running' | 'completed' | 'failed'
  node_count: number
}

export interface WorkflowExecutionResult {
  success: boolean
  data: WorkflowExecutionData
}

export interface WorkflowTemplate {
  id: number
  template_id: string
  name: string
  label?: string
  description: string | null
  category: string
  icon: string | null
  node_count: number | null
  estimated_duration: string | null
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  preset_config: Record<string, unknown> | null
}

export interface WorkflowTemplateListResponse {
  items: WorkflowTemplate[]
  total: number
}

export const workflowApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    workflow_type?: string
    search?: string
  }) =>
    api.get<WorkflowListResponse>('/workflows', { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<WorkflowDetail>(`/workflows/${id}`).then((r) => r.data),

  statistics: () =>
    api.get<WorkflowStatistics>('/workflows/statistics/summary').then((r) => r.data),

  cancel: (id: number) =>
    api.post<{ message: string }>(`/workflows/${id}/cancel`).then((r) => r.data),

  retry: (id: number) =>
    api.post<{ message: string }>(`/workflows/${id}/retry`).then((r) => r.data),

  /** 执行工作流 */
  execute: (id: number) =>
    api.post<WorkflowExecutionResult>(`/workflows/${id}/execute`).then((r) => r.data),

  /** 创建工作流 */
  create: (payload: WorkflowCreatePayload) =>
    api.post<{ id: number; message: string; task_count: number }>(
      '/workflows',
      payload,
    ).then((r) => r.data),

  /** 更新工作流配置 */
  updateConfig: (id: number, config: Record<string, unknown>) =>
    api.put<{ message: string }>(`/workflows/${id}/config`, config).then((r) => r.data),

  /** 删除工作流 */
  delete: (id: number) =>
    api.delete<{ message: string }>(`/workflows/${id}`).then((r) => r.data),

  /** 列出可用模板 */
  listTemplates: () =>
    api.get<WorkflowTemplateListResponse>('/workflows/templates').then((r) => r.data),

  /** 获取单个模板详情 */
  getTemplate: (templateId: string) =>
    api.get<WorkflowTemplate>(`/workflows/templates/${templateId}`).then((r) => r.data),

  /** 获取可用执行器列表 */
  listExecutors: () =>
    api.get<{ success: boolean; executors: Array<{ task_type: string; description: string }> }>(
      '/workflows/executors',
    ).then((r) => r.data),
}
