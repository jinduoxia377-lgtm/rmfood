/**
 * 批记录与样品 API 客户端
 * Phase 1: 数据底座加固
 *
 * 🔒 路径规范: axios baseURL = '/api/v1'，此处使用相对路径（不带 /api/v1 前缀）
 */
import api from './client'

// ── 类型定义 ────────────────────────────────────────────────────

export interface Batch {
  id: number
  organization_id: number | null
  batch_code: string
  formula_id: number
  formula_version_id: number | null
  formula_code: string
  formula_name: string
  target_weight_kg: number
  actual_weight_kg: number | null
  yield_rate: number | null
  status: 'planned' | 'in_progress' | 'completed' | 'closed'
  prepared_by: number | null
  preparation_date: string | null
  notes: string | null
  sample_count: number
  ingredient_lot_count: number
  created_at: string
  updated_at: string
}

export interface Sample {
  id: number
  sample_code: string
  batch_id: number
  batch_code: string
  formula_code: string | null
  sample_type: 'qc' | 'stability' | 'pilot' | 'retention'
  quantity_g: number | null
  storage_condition: string | null
  aliquot_count: number
  test_count: number
  created_at: string
}

export interface TestReport {
  id: number
  sample_id: number
  parameter: string
  value: number | null
  unit: string | null
  spec_min: number | null
  spec_max: number | null
  result: 'pass' | 'fail' | 'warn' | 'pending' | null
  is_in_spec: boolean
  deviation_pct: number | null
  tested_at: string | null
  notes: string | null
}

export interface CreateBatchRequest {
  formula_id: number
  target_weight_kg: number
  preparer_id?: number
  notes?: string
  ingredient_lot_assignments?: Record<number, number>
}

export interface ListBatchesParams {
  formula_id?: number
  status?: string
  search?: string
  formula_code?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ── 批记录 API ──────────────────────────────────────────────────

export const batchApi = {
  /** 创建批记录 */
  async create(data: CreateBatchRequest): Promise<Batch> {
    const resp = await api.post('/batches', data)
    return resp.data
  },

  /** 获取批记录列表 */
  async list(params: ListBatchesParams = {}): Promise<{ items: Batch[]; total: number; page: number; page_size: number }> {
    const resp = await api.get('/batches', { params })
    return resp.data
  },

  /** 获取批记录详情（null 表示不存在） */
  async get(batchId: number): Promise<Batch | null> {
    try {
      const resp = await api.get(`/batches/${batchId}`)
      return resp.data
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.response?.status === 503) return null
      throw e
    }
  },

  /** 更新批记录状态 */
  async updateStatus(batchId: number, status: string, actualWeight?: number): Promise<Batch> {
    const resp = await api.patch(`/batches/${batchId}/status`, { status, actual_weight_kg: actualWeight })
    return resp.data
  },

  /** 反向追溯：批次 → 原料 */
  async backwardTrace(batchId: number): Promise<any> {
    const resp = await api.get(`/batches/${batchId}/trace/backward`)
    return resp.data
  },

  /** 正向追溯：原料批号 → 批次 */
  async forwardTrace(lotId: number): Promise<any> {
    const resp = await api.get(`/batches/lots/${lotId}/trace/forward`)
    return resp.data
  },

  /** 分析原料调价影响 */
  async analyzePriceImpact(ingredientId: number, newPricePerKg: number): Promise<any> {
    const resp = await api.get(`/batches/prices/impact/${ingredientId}`, {
      params: { new_price_per_kg: newPricePerKg },
    })
    return resp.data
  },

  /** 更新原料价格 */
  async updatePrice(ingredientId: number, newPricePerKg: number, options?: { currency?: string; note?: string }): Promise<any> {
    const resp = await api.post(
      `/batches/prices/${ingredientId}/update`,
      {},
      { params: { new_price_per_kg: newPricePerKg, ...options } },
    )
    return resp.data
  },
}

// ── 样品 API ────────────────────────────────────────────────────

export const sampleApi = {
  /** 创建样品 */
  async create(data: {
    batch_id: number
    sample_type?: string
    quantity_g?: number
    storage_condition?: string
  }): Promise<Sample> {
    const resp = await api.post('/samples', data)
    return resp.data
  },

  /** 获取样品列表 */
  async list(params: {
    batch_id?: number
    sample_type?: string
    page?: number
    page_size?: number
  } = {}): Promise<{ items: Sample[]; total: number; page: number; page_size: number }> {
    const resp = await api.get('/samples', { params })
    return resp.data
  },

  /** 获取样品测试报告 */
  async getTests(sampleId: number): Promise<TestReport[]> {
    const resp = await api.get(`/samples/${sampleId}/tests`)
    return resp.data
  },
}

// ── 导出默认 ────────────────────────────────────────────────────

export default {
  batch: batchApi,
  sample: sampleApi,
}
