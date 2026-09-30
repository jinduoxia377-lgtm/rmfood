/**
 * DOE API Client — Design of Experiments
 * 对接后端 /doe/* 端点（axios baseURL 已含 /api/v1，此处路径不带前缀）
 */
import api from '@/api/client'

export interface DOEFactor {
  name: string
  low: number
  high: number
  center: number
}

export interface DOERun {
  run_id: number
  coded_levels: Record<string, number>
  factor_levels: Record<string, number>
  response_values: Record<string, number> | null
}

export interface CCDDesignRequest {
  factors: DOEFactor[]
  n_center_points?: number
}

export interface BBDDesignRequest {
  factors: DOEFactor[]
  n_center_points?: number
}

export interface MixtureComponentInput {
  name: string
  lower: number
  upper: number
}

export interface MixtureDesignRequest {
  components: MixtureComponentInput[]
  design_type: 'lattice' | 'centroid'
  degree?: number
}

export interface FitRequest {
  runs: DOERun[]
  response_names: string[]
  include_interaction?: boolean
  include_quadratic?: boolean
}

export interface InverseSearchRequest {
  model: {
    factors: string[]
    responses: string[]
    equation: string
    coefficients: Record<string, Record<string, number>>
    r_squared?: Record<string, number>
    significant_terms?: string[]
  }
  target_values: Record<string, number>
  factor_bounds?: Record<string, [number, number]>
}

export interface FittedModel {
  factors: string[]
  responses: string[]
  equation: string
  coefficients: Record<string, Record<string, number>>
  r_squared: Record<string, number>
  adjusted_r_squared: Record<string, number>
  rmse: Record<string, number>
  significant_terms: string[]
}

export interface ActiveLearningRequest {
  existing_runs: Array<{
    run_id: number
    coded_levels: Record<string, number>
    factor_levels?: Record<string, number>
    response_values: Record<string, number>
  }>
  n_recommend: number
}

export interface ActiveLearningRecommendation {
  run_id: number
  coded_levels: Record<string, number>
  factor_levels: Record<string, number>
}

export interface ActiveLearningResponse {
  status: string
  strategy: string
  n_recommend: number
  recommendations: ActiveLearningRecommendation[]
}

export interface ExperimentImportResponse {
  status: string
  experiment: { id: number; name: string | null; code: string | null; status: string | null }
  total_data_points: number
  total_runs: number
  grouping: string
  factors: Array<{ name: string; low: number; high: number; center: number }>
  response_candidates: string[]
  all_parameters: string[]
  runs: DOERun[]
  note: string
}

export interface DoeExportResponse {
  status: string
  experiment_id: number
  created_data_points: number
  data_point_ids: number[]
  note: string
}

export const doeApi = {
  health: () => api.get('/doe/health'),

  generateCCD: (data: CCDDesignRequest) =>
    api.post('/doe/ccd', data),

  generateBBD: (data: BBDDesignRequest) =>
    api.post('/doe/bbd', data),

  generateMixture: (data: MixtureDesignRequest) =>
    api.post('/doe/mixture', data),

  fitResponseSurface: (data: FitRequest) =>
    api.post('/doe/fit', data),

  inverseSearch: (data: InverseSearchRequest) =>
    api.post('/doe/inverse-search', data),

  activeLearning: (data: ActiveLearningRequest & { fitted_model?: unknown }) =>
    api.post<ActiveLearningResponse>('/doe/active-learning', data),

  /** 实验管理 → DOE：导入实验数据为 runs（后端返回裸对象，res.data 即该对象） */
  importExperimentRuns: (experimentId: number, params?: { group_size?: number; response_parameter?: string }) =>
    api.get<ExperimentImportResponse>(`/doe/experiments/${experimentId}/runs`, { params }).then(
      (res) => res.data
    ),

  /** DOE → 实验管理：把推荐点写回实验（闭环，后端返回裸对象） */
  exportToExperiment: (data: { experiment_id: number; recommendations: ActiveLearningRecommendation[]; note?: string }) =>
    api.post('/doe/experiments/export', data).then(
      (res) => res.data as DoeExportResponse
    ),

  /** 列出可作为 DOE 种子的真实配方（含真实成分占比；后端返回 { status, total, formulas }） */
  listSeedFormulas: () =>
    api.get<{ status: string; total: number; formulas: Array<{ id: number; name: string; ingredients: Array<{ name: string; percentage: number | null }> }> }>('/doe/formulas').then(
      (res) => res.data
    ),

  /** 从真实配方生成 DOE 种子 runs（成分占比→因子，真实响应值；后端返回裸对象） */
  seedFromFormula: (formulaId: number, params?: { n_center?: number; response_parameter?: string; experiment_id?: number }) =>
    api.get<{
      status: string
      formula: { id: number; name: string }
      response_parameter: string
      response_pool: number[]
      experiment_id: number | null
      total_runs: number
      factors: Array<{ name: string; low: number; high: number; center: number }>
      runs: DOERun[]
      note: string
    }>(`/doe/seed-from-formula/${formulaId}`, { params }).then(
      (res) => res.data
    ),
}
