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

// ── 配方在线验证类型 ────────────────────────────────────────────

export interface ValidationStageResult {
  stage: string
  success: boolean
  score: number
  passed: boolean
  latency_ms: number
  details: Record<string, unknown>
  warnings: string[]
  errors: string[]
}

export interface PredictionComparison {
  parameter: string
  unit: string
  predicted_value: number
  predicted_range: [number, number]
  measured_value?: number
  measured_range?: [number, number]
  deviation_percent: number
  within_tolerance: boolean
  confidence: string
}

export interface FormulaValidationResult {
  success: boolean
  validation_id: string
  formula_id: number
  formula_name: string
  overall_score: number
  outcome: 'passed' | 'conditional' | 'failed' | 'inconclusive'
  stages: ValidationStageResult[]
  comparisons: PredictionComparison[]
  recommendations: string[]
  total_latency_ms: number
  error_message?: string
}

export interface ValidationProgress {
  validation_id: string
  formula_id: number
  formula_name: string
  workflow_id?: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  current_stage?: string
  stage_index: number
  total_stages: number
  progress_percent: number
  current_score: number
  message: string
}

export interface FormulaValidationRequest {
  experiment_id?: number
  validation_stages?: string[]
  parallel?: boolean
  daily_dosage_g?: number
  target_population?: string
  body_weight_kg?: number
  storage_temp_c?: number
  storage_humidity?: number
}

export const experimentApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    researcher_id?: number
    formula_id?: number
    search?: string
    sort_field?: string
    sort_order?: 'asc' | 'desc'
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

  // ── 分享 ──
  createShare: (id: number) =>
    api.post<{ share_code: string; url: string; experiment_id: number; title: string }>(
      `/experiments/${id}/share`,
    ).then((r) => r.data),

  getShared: (shareCode: string) =>
    api.get<Experiment & { data_points?: ExperimentData[]; view_count?: number }>(
      `/experiments/share/${shareCode}`,
    ).then((r) => r.data),

  // ── 回写配方 ──
  writeback: (id: number, data: { safety_score?: number; synergy_score?: number; compliance_status?: Record<string, unknown> }) =>
    api.post<{ success: boolean; formula_id: number; code: string; updated_fields: string[] }>(
      `/experiments/${id}/writeback`, data,
    ).then((r) => r.data),

  addData: (id: number, parameter: string, value?: number | string | null, unit?: string, notes?: string) =>
    api
      .post<ExperimentData>(`/experiments/${id}/data`, null, { params: { parameter, value, unit, notes } })
      .then((r) => r.data),

  deleteData: (dataPointId: number) => api.delete(`/experiments/data/${dataPointId}`),

  // ── 数据点编辑 ──
  updateData: (dataPointId: number, data: { parameter?: string; value?: number | string | null; unit?: string; notes?: string; measurement_time?: string }) =>
    api.put<ExperimentData>(`/experiments/data/${dataPointId}`, data).then((r) => r.data),

  // ── 实验数据文件解析（AnIML / JCAMP / CSV）──
  parseDataFile: (file: File, formatType: 'auto' | 'animl' | 'jcamp' | 'csv' = 'auto') => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<{ success: boolean; data: Record<string, unknown> }>('/experiment-data/parse', formData, {
        params: { format_type: formatType, recognize_peaks: true },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  // 统计
  statistics: () => api.get<Record<string, number>>('/experiments/statistics').then((r) => r.data),

  // ── 配方在线验证 ──────────────────────────────────────────────

  /** 一键触发配方全流程验证 */
  triggerValidation: (formulaId: number, data: FormulaValidationRequest) =>
    api.post<FormulaValidationResult>(`/formulas/${formulaId}/validate`, data).then((r) => r.data),

  /** 查询验证进度 */
  getValidationProgress: (formulaId: number, validationId: string) =>
    api.get<ValidationProgress>(`/formulas/${formulaId}/validation/${validationId}`).then((r) => r.data),

  /** 查询配方的历史验证记录 */
  listValidations: (formulaId: number, limit = 10) =>
    api.get<FormulaValidationResult[]>(`/formulas/${formulaId}/validation?limit=${limit}`).then((r) => r.data),

  /** 重试失败的验证阶段 */
  retryValidation: (formulaId: number, validationId: string) =>
    api.post<FormulaValidationResult>(`/formulas/${formulaId}/validation/${validationId}/retry`).then((r) => r.data),
}
