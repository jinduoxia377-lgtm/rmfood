/**
 * 配方深度集成 API 服务
 *
 * 提供所有与协同配方设计相关的 API 调用函数
 * 包含 RESTful API 和 WebSocket 支持
 */

import api from './client'
import { logger } from '@/utils/safeLogger'
import type {
  SynergyAnalysisRequest,
  SynergyAnalysisResponse,
  RatioOptimizationRequest,
  RatioOptimizationResponse,
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  EffectPredictionRequest,
  EffectPredictionResponse,
  SafetyCheckRequest,
  SafetyCheckResponse,
  DeepGenerationRequest,
  DeepGenerationResponse,
  OptimizationProgressMessage,
  LabValidationUploadRequest,
  LabValidationResponse,
  ValidationReportConfig,
  ThresholdUpdateRequest,
  SystemHealthStatus,
  FormulaImportRequest,
  FormulaImportResult,
  FormulaExportRequest,
  FormulaExportOptions,
  OperationLog,
  OperationLogQueryParams,
  FormulaPermission,
  FormulaListQueryParams,
  FormulaListResponse,
  FormulaCreatePayload,
  FormulaVersion,
  VersionDiffResult,
  FormulaStatistics,
  IngredientConfig,
  MultiAlgorithmRequest,
  MultiAlgorithmResponse,
} from '@/types/formula'

import type { Formula } from '@/types/index'

// ==================== 基础配置 ====================

const FORMULA_BASE_URL = '/formulas'

// ==================== 1. 协同效应分析 API ====================

export async function analyzeSynergy(
  request: SynergyAnalysisRequest,
): Promise<SynergyAnalysisResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/synergy/analyze`, request)
  return response.data
}

// 批量协同分析（多对成分）
export async function batchAnalyzeSynergy(
  pairs: { ingredient_a: string; ingredient_b: string }[],
): Promise<SynergyAnalysisResponse[]> {
  const results = await Promise.all(
    pairs.map(pair => analyzeSynergy(pair)),
  )
  return results
}

// ==================== 2. 配比优化 API ====================

export async function optimizeRatio(
  request: RatioOptimizationRequest,
): Promise<RatioOptimizationResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/ratio/optimize`, request)
  return response.data
}

// 快速优化（使用默认参数）
export async function quickOptimizeRatio(
  ingredients: Omit<IngredientConfig, 'efficacy_base' | 'safety_score' | 'stability_score'>[],
): Promise<RatioOptimizationResponse> {
  return optimizeRatio({
    ingredients,
    population_size: 80,
    max_generations: 40,
  })
}

// MILP 配比优化（基于营养约束的精确求解）
export interface OptimizeLPRequest {
  total_dosage_g: number
  max_cost?: number
}

export interface MILPSolution {
  formula_id: number
  formula_name: string
  total_dosage_g: number
  feasible: boolean
  min_cost: number
  ratios: Array<{
    ingredient: string
    dosage_g: number
    percentage: number
  }>
  nutrition_matrix: Record<string, number>
  violation?: Record<string, number>
  solve_time_ms: number
}

export async function optimizeLP(
  formulaId: number,
  options?: OptimizeLPRequest,
): Promise<MILPSolution> {
  const response = await api.post(
    `${FORMULA_BASE_URL}/${formulaId}/optimize/lp`,
    null,
    { params: options },
  )
  return response.data
}

// ==================== 3. 兼容性检测 API ====================

export async function checkCompatibility(
  request: CompatibilityCheckRequest,
): Promise<CompatibilityCheckResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/compatibility/check`, request)
  return response.data
}

// 快速兼容性检查
export async function quickCheckCompatibility(
  ingredients: { name: string; amount_mg: number; percentage: number }[],
): Promise<CompatibilityCheckResponse> {
  return checkCompatibility({ ingredients })
}

// ==================== 4. 效果预测 API ====================

export async function predictEffect(
  request: EffectPredictionRequest,
): Promise<EffectPredictionResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/effect/predict`, request)
  return response.data
}

// 标准效果预测（24小时模拟）
export async function standardPredictEffect(
  formulaIngredients: {
    name: string
    amount_mg: number
    percentage: number
  }[],
): Promise<EffectPredictionResponse> {
  return predictEffect({
    formula_ingredients: formulaIngredients,
    body_weight_kg: 70,
    simulation_hours: 24,
    time_points: 100,
  })
}

// ==================== 5. 安全检查 API ====================

export async function checkSafety(
  request: SafetyCheckRequest,
): Promise<SafetyCheckResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/safety/check`, request)
  return response.data
}

// 快速安全检查
export async function quickSafetyCheck(
  ingredients: { name: string; amount_mg: number; percentage: number }[],
  targetGroup: 'adult' | 'pregnant' | 'children' | 'elderly' = 'adult',
): Promise<SafetyCheckResponse> {
  return checkSafety({
    ingredients,
    target_group: targetGroup,
    daily_dosage_g: ingredients.reduce((sum, ing) => sum + ing.amount_mg, 0) / 1000,
    usage_scenario: 'supplement',
  })
}

// ==================== 6. 增强配方生成 (完整管线) ====================

export async function generateDeepFormula(
  request: DeepGenerationRequest,
): Promise<DeepGenerationResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/deep-generation`, request)
  return response.data
}

// 一键智能生成（推荐参数）
export async function generateSmartFormula(
  ingredients: {
    name: string
    amount_mg: number
    percentage: number
    min_ratio?: number
    max_ratio?: number
    cost_per_gram?: number
  }[],
  options?: {
    targetEfficacy?: number
    safetyPriority?: boolean
    targetPopulation?: string
  },
): Promise<DeepGenerationResponse> {
  return generateDeepFormula({
    ingredients,
    mode: 'deep_integration',
    target_efficacy: options?.targetEfficacy ?? 0.75,
    safety_priority: options?.safetyPriority ?? true,
    target_population: options?.targetPopulation ?? 'adult',
    use_caching: true,
  })
}

// ==================== 7. 安全阈值管理 API (管理员) ====================

export async function getSafetyThresholds() {
  const response = await api.get(`${FORMULA_BASE_URL}/safety-thresholds`)
  return response.data
}

export async function updateSafetyThreshold(
  ingredientName: string,
  updates: Record<string, any>,
) {
  const response = await api.put(
    `${FORMULA_BASE_URL}/safety-thresholds/${encodeURIComponent(ingredientName)}`,
    updates,
  )
  return response.data
}

// ==================== 8. WebSocket 实时进度推送 ====================

type ProgressCallback = (message: OptimizationProgressMessage) => void

class OptimizationWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private callbacks = new Set<ProgressCallback>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 1000

  constructor(url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${FORMULA_BASE_URL.replace('/api', '')}/ws/optimization-progress`) {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          logger.info('[WebSocket] 连接成功')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: OptimizationProgressMessage = JSON.parse(event.data)
            this.callbacks.forEach(callback => callback(message))
          } catch (error) {
            logger.error('[WebSocket] 消息解析失败:', error)
          }
        }

        this.ws.onerror = (error) => {
          logger.error('[WebSocket] 错误:', error)
          reject(error)
        }

        this.ws.onclose = () => {
          logger.info('[WebSocket] 连接关闭')
          this.attemptReconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        logger.info(`[WebSocket] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
        this.connect().catch(err => {
          logger.error('[WebSocket] 重连失败:', err)
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  onProgress(callback: ProgressCallback): () => void {
    this.callbacks.add(callback)

    // 返回取消订阅函数
    return () => {
      this.callbacks.delete(callback)
    }
  }

  sendStartOptimization(taskId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'start_optimization',
        task_id: taskId,
      }))
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.callbacks.clear()
  }
}

// 创建 WebSocket 实例工厂
export function createOptimizationWebSocket(url?: string) {
  return new OptimizationWebSocket(url)
}

// ==================== 导出统一服务对象 ====================

export const formulaApi = {
  // 协同分析
  analyzeSynergy,
  batchAnalyzeSynergy,

  // 配比优化
  optimizeRatio,
  quickOptimizeRatio,

  // 兼容性检查
  checkCompatibility,
  quickCheckCompatibility,

  // 效果预测
  predictEffect,
  standardPredictEffect,

  // 安全检查
  checkSafety,
  quickSafetyCheck,

  // 增强生成
  generateDeepFormula,
  generateSmartFormula,

  // 阈值管理
  getSafetyThresholds,
  updateSafetyThreshold,

  // WebSocket
  createOptimizationWebSocket,

  // 实验室验证
  uploadLabValidationData,
  getValidationResults,
  generateValidationReport,

  // 系统健康
  getSystemHealthStatus,

  // ===== 新增：基础 CRUD =====
  list: listFormulas,
  get: getFormula,
  create: createFormula,
  update: updateFormula,
  patch: patchFormula,
  delete: deleteFormula,
  batchDelete: batchDeleteFormulas,

  // ===== 新增：审核流程 =====
  submit: submitFormula,
  review: reviewFormula,

  // ===== 新增：版本管理 =====
  versions: getFormulaVersions,
  getVersionDiff,
  rollbackToVersion,

  // ===== 新增：AI 推荐 =====
  recommendations: getAIRecommendations,

  // ===== 新增：导入导出 =====
  importFormulas,
  exportFormulas,
  downloadImportTemplate,

  // ===== 新增：操作日志 =====
  getOperationLogs,
  getOperationLogDetail,
  exportLogs,
  createBatchOperationLogs,

  // ===== 新增：权限检查 =====
  checkPermission,
  getUserPermissions,

  // ===== 新增：统计数据 =====
  getStatistics: getFormulaStatistics,

  // ===== 新增：批量状态变更 =====
  batchUpdateStatus: (ids: number[], status: string) =>
    api.patch(`${FORMULA_BASE_URL}/batch-status`, { ids, status }).then((r) => r.data),

  // ===== 新增：配比优化 =====
  optimizeLP,
  optimizeMultiAlgorithm,

  // ===== 新增：配方深度分析 =====
  analyzeFormulaSynergy,
  predictFormulaStability,
  predictFormulaTaste,
  checkFormulaSafety,
  checkFormulaCompatibility,
  predictFormulaEffect,

  // ===== 新增：模板管理 =====
  createFormulaTemplate,
  updateFormulaTemplate,
  deleteFormulaTemplate,

  // ===== 新增：配方复制 =====
  copyFormula,
  exportFormulaPDF,
  exportFormulaExcel,
  applyOptimization,
  saveAnalysisResult,
  getAnalysisHistory,
}

// ==================== 9. 实验室验证 API ====================

export async function uploadLabValidationData(
  request: LabValidationUploadRequest,
): Promise<LabValidationResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/lab-validation/upload`, request)
  return response.data
}

export async function getValidationResults(
  formulaId: string,
  params?: { data_type?: string; limit?: number; offset?: number },
): Promise<{ results: LabValidationResponse[]; total: number }> {
  const response = await api.get(`${FORMULA_BASE_URL}/lab-validation/results/${formulaId}`, { params })
  return response.data
}

export async function generateValidationReport(
  validationId: string,
  config?: ValidationReportConfig,
): Promise<Blob> {
  const response = await api.post(
    `${FORMULA_BASE_URL}/lab-validation/report/${validationId}`,
    config || {},
    { responseType: 'blob' },
  )
  return response.data
}

// ==================== 10. 系统健康监控 API ====================

export async function getSystemHealthStatus(): Promise<SystemHealthStatus> {
  const response = await api.get('/system/health')
  return response.data
}

// ==================== 11. 批量阈值管理 (管理员) ====================

export async function batchUpdateThresholds(
  updates: ThresholdUpdateRequest[],
): Promise<{ success_count: number; failed_items: { name: string; error: string }[] }> {
  const response = await api.put(`${FORMULA_BASE_URL}/safety-thresholds/batch`, updates)
  return response.data
}

export async function exportThresholdsToCSV(): Promise<string> {
  const response = await api.get(`${FORMULA_BASE_URL}/safety-thresholds/export`, {
    responseType: 'text',
  })
  return response.data
}

// ==================== 12. 基础 CRUD API（补充缺失方法）====================

export async function listFormulas(
  params?: FormulaListQueryParams,
): Promise<FormulaListResponse> {
  const response = await api.get(`${FORMULA_BASE_URL}`, { params })
  return response.data
}

export async function getFormula(id: string | number): Promise<Formula> {
  const response = await api.get(`${FORMULA_BASE_URL}/${id}`)
  return response.data
}

export async function createFormula(data: FormulaCreatePayload): Promise<Formula> {
  const response = await api.post(`${FORMULA_BASE_URL}`, data)
  return response.data
}

export async function updateFormula(
  id: string | number,
  data: Partial<FormulaCreatePayload>,
): Promise<Formula> {
  const response = await api.put(`${FORMULA_BASE_URL}/${id}`, data)
  return response.data
}

export async function patchFormula(
  id: string | number,
  data: Partial<FormulaCreatePayload>,
): Promise<Formula> {
  const response = await api.patch(`${FORMULA_BASE_URL}/${id}`, data)
  return response.data
}

export async function deleteFormula(id: string | number): Promise<void> {
  await api.delete(`${FORMULA_BASE_URL}/${id}`)
}

export async function batchDeleteFormulas(
  ids: (string | number)[],
): Promise<{ success: number; failed: number }> {
  const response = await api.post(`${FORMULA_BASE_URL}/batch-delete`, { ids })
  return response.data
}

// ==================== 13. 审核流程 API ====================

export async function submitFormula(id: string | number): Promise<Formula> {
  const response = await api.post(`${FORMULA_BASE_URL}/${id}/submit`)
  return response.data
}

export async function reviewFormula(
  id: string | number,
  approved: boolean,
  notes?: string,
): Promise<Formula> {
  const response = await api.post(`${FORMULA_BASE_URL}/${id}/review`, {
    approved,
    notes,
  })
  return response.data
}

// ==================== 14. 版本管理 API ====================

export async function getFormulaVersions(formulaId: string | number): Promise<FormulaVersion[]> {
  const response = await api.get(`${FORMULA_BASE_URL}/${formulaId}/versions`)
  return response.data
}

export async function getVersionDiff(
  formulaId: string | number,
  v1: string,
  v2: string,
): Promise<VersionDiffResult> {
  const response = await api.get(
    `${FORMULA_BASE_URL}/${formulaId}/versions/diff`,
    { params: { v1, v2 } },
  )
  return response.data
}

export async function rollbackToVersion(
  formulaId: string | number,
  versionId: string,
): Promise<Formula> {
  const response = await api.post(
    `${FORMULA_BASE_URL}/${formulaId}/versions/${versionId}/rollback`,
  )
  return response.data
}

// ==================== 15. AI 推荐 API ====================

export async function getAIRecommendations(effects: string[]): Promise<{
  id: string
  name: string
  score: number
  ingredients: { name: string; dosage: string }[]
  effects: string[]
}[]> {
  const response = await api.post(`${FORMULA_BASE_URL}/ai/recommendations`, { effects })
  return response.data
}

// ==================== 16. 导入导出 API ====================

export async function importFormulas(
  request: FormulaImportRequest,
  onProgress?: (progress: number) => void,
): Promise<FormulaImportResult> {
  const formData = new FormData()
  formData.append('file', request.file)
  formData.append('mode', request.mode)

  if (request.options) {
    formData.append('options', JSON.stringify(request.options))
  }

  const response = await api.post(`${FORMULA_BASE_URL}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(progress)
      }
    },
  })

  return response.data
}

export async function exportFormulas(
  request: FormulaExportRequest,
  options?: FormulaExportOptions,
): Promise<Blob> {
  const response = await api.post(
    `${FORMULA_BASE_URL}/export`,
    request,
    {
      params: options,
      responseType: 'blob',
    },
  )
  return response.data
}

export async function downloadImportTemplate(): Promise<Blob> {
  const response = await api.get(`${FORMULA_BASE_URL}/import/template`, {
    responseType: 'blob',
  })
  return response.data
}

// ==================== 17. 操作日志 API ====================

export async function getOperationLogs(
  params?: OperationLogQueryParams,
): Promise<{ data: OperationLog[]; total: number }> {
  const response = await api.get(`${FORMULA_BASE_URL}/logs`, { params })
  return response.data
}

export async function getOperationLogDetail(id: string): Promise<OperationLog> {
  const response = await api.get(`${FORMULA_BASE_URL}/logs/${id}`)
  return response.data
}

export async function exportLogs(
  params: OperationLogQueryParams,
  format: 'excel' | 'csv',
): Promise<Blob> {
  const response = await api.get(`${FORMULA_BASE_URL}/logs/export`, {
    params: { ...params, format },
    responseType: 'blob',
  })
  return response.data
}

export async function createBatchOperationLogs(
  logs: {
    action: string
    target_type: string
    target_id: string
    target_name: string
    details?: Record<string, unknown>
    result: string
    error_message?: string
    operator_id: string
    operator_name: string
    operator_role: string
    ip_address?: string
    user_agent?: string
    created_at: string
    metadata?: Record<string, unknown>
  }[],
): Promise<void> {
  await api.post(`${FORMULA_BASE_URL}/logs/batch`, logs)
}

// ==================== 18. 权限检查 API ====================

export async function checkPermission(permission: FormulaPermission): Promise<boolean> {
  const response = await api.get(`${FORMULA_BASE_URL}/permissions/check`, {
    params: { permission },
  })
  return response.data.has_permission
}

export async function getUserPermissions(): Promise<FormulaPermission[]> {
  const response = await api.get(`${FORMULA_BASE_URL}/permissions`)
  return response.data.permissions
}

// ==================== 19. 统计数据 API ====================

export async function getFormulaStatistics(): Promise<FormulaStatistics> {
  const response = await api.get(`${FORMULA_BASE_URL}/statistics`)
  return response.data
}

// ==================== 20. 营养成分计算 API ====================

export interface NutritionSummary {
  formula_id: number
  total_weight_g: number
  nutrition_per_100g: Record<string, number>
  total_nutrition: Record<string, number>
  allergens: string[]
  compliance: {
    passed: string[]
    issues: string[]
    is_compliant: boolean
  }
  warnings: string[]
}

export async function getFormulaNutrition(formulaId: number): Promise<NutritionSummary> {
  const response = await api.get(`${FORMULA_BASE_URL}/${formulaId}/nutrition`)
  return response.data
}

// ==================== 21. 营养成分表（GB 28050）====================

export interface NutritionLabelItem {
  nutrient: string
  unit: string
  is_mandatory: boolean
  per_100g: number
  per_serving: number | null
  nrv_percent: number | null
  claim?: string
}

export interface ServingInfo {
  serving_size_g: number
  servings_per_container: number
  package_size_g: number
}

export interface EnergyCheck {
  calculated_kj: number
  listed_kj: number
  diff_kj: number
  match: boolean
}

export interface ComplianceResult {
  is_compliant: boolean
  standard: string
  violations: any[]
  warnings: any[]
}

export interface NutritionLabelResult {
  formula_id: number
  formula_name: string
  serving_info: ServingInfo
  per_100g: Record<string, number>
  per_serving: Record<string, number>
  nrv_percentages: Record<string, number>
  label_items: NutritionLabelItem[]
  energy_check: EnergyCheck
  claims: string[]
  compliance: ComplianceResult
  unknown_ingredients: string[]
  warnings: string[]
  generated_at: string
  unit_system?: string
  display_unit?: string
}

export interface CalculateNutritionLabelRequest {
  serving_size_g?: number
  servings_per_container?: number
  unit_system?: string
}

export async function calculateNutritionLabel(
  formulaId: number,
  params: CalculateNutritionLabelRequest = {},
): Promise<NutritionLabelResult> {
  const response = await api.get<NutritionLabelResult>(
    `${FORMULA_BASE_URL}/${formulaId}/nutrition`,
    { params },
  )
  return response.data
}

// ==================== 22. 配方发布 API ====================

export async function publishFormula(formulaId: number): Promise<any> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/publish`)
  return response.data
}

export async function archiveFormula(formulaId: number): Promise<any> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/archive`)
  return response.data
}

export default formulaApi

// ==================== 23. 多算法融合优化 API ====================

export async function optimizeMultiAlgorithm(
  request: MultiAlgorithmRequest,
): Promise<MultiAlgorithmResponse> {
  const response = await api.post(`${FORMULA_BASE_URL}/optimize/multi-algorithm`, request)
  return response.data
}

// ==================== 24. 配方深度分析 API ====================

export interface FormulaSynergyResult {
  formula_id: number
  overall_si?: number
  pairs?: any[]
}

export interface FormulaStabilityResult {
  formula_id: number
  predicted_shelf_life_months?: number
  stability_score?: number
  risk_factors?: any[]
}

export interface FormulaTasteResult {
  formula_id: number
  taste_profile?: { bitter: number; sweet: number; umami: number; astringent: number; sour: number }
  balance_score?: number
  acceptability?: number
}

export interface FormulaSafetyResult {
  formula_id: number
  is_safe?: boolean
  overall_risk_score?: number
  alerts?: any[]
}

export interface FormulaCompatibilityResult {
  formula_id: number
  overall_score?: number
  error_count?: number
  warning_count?: number
  issues?: any[]
}

export async function analyzeFormulaSynergy(formulaId: number): Promise<FormulaSynergyResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/synergy/analyze`)
  return response.data
}

export async function predictFormulaStability(
  formulaId: number,
  options?: { temperature_c?: number; humidity_pct?: number; light_exposure?: string },
): Promise<FormulaStabilityResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/stability/predict`, null, { params: options })
  return response.data
}

export async function predictFormulaTaste(formulaId: number): Promise<FormulaTasteResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/taste/predict`)
  return response.data
}

export async function checkFormulaSafety(
  formulaId: number,
  options?: { daily_dosage_g?: number; target_group?: string },
): Promise<FormulaSafetyResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/safety/check`, null, { params: options })
  return response.data
}

export async function checkFormulaCompatibility(formulaId: number): Promise<FormulaCompatibilityResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/compatibility/check`)
  return response.data
}

export async function predictFormulaEffect(formulaId: number, options?: any): Promise<any> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/effect/predict`)
  return response.data
}

// ==================== 25. 模板管理 API ====================

export interface FormulaTemplate {
  id: number
  code: string
  name: string
  description?: string
  category?: string
  effects: string[]
  usage_count: number
  is_featured: boolean
}

export async function createFormulaTemplate(data: Partial<FormulaTemplate>): Promise<FormulaTemplate> {
  const response = await api.post(`${FORMULA_BASE_URL}/templates`, data)
  return response.data
}

export async function updateFormulaTemplate(code: string, data: Partial<FormulaTemplate>): Promise<FormulaTemplate> {
  const response = await api.put(`${FORMULA_BASE_URL}/templates/${code}`, data)
  return response.data
}

export async function deleteFormulaTemplate(code: string): Promise<any> {
  const response = await api.delete(`${FORMULA_BASE_URL}/templates/${code}`)
  return response.data
}

// ==================== 26. 配方复制 API ====================

export async function copyFormula(formulaId: number): Promise<Formula> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/copy`)
  return response.data
}

// ==================== 27. 配方导出 API ====================

export interface ExportedFormula {
  id: number
  code: string
  name: string
  description: string
  status: string
  version: number
  target_effects: string[]
  dosage: string
  processing_method: string
  storage_conditions: string
  shelf_life: string
  ingredients: any[]
  peptides: any[]
  created_at: string
  updated_at: string
  format?: string
  generated_at?: string
}

export async function exportFormulaPDF(formulaId: number): Promise<ExportedFormula> {
  const response = await api.get(`${FORMULA_BASE_URL}/${formulaId}/export`, {
    params: { format_type: 'pdf' },
  })
  return response.data
}

export async function exportFormulaExcel(formulaId: number): Promise<Blob> {
  const response = await api.get(`${FORMULA_BASE_URL}/${formulaId}/export`, {
    params: { format_type: 'excel' },
    responseType: 'blob',
  })
  return response.data
}

// ==================== 28. 优化结果应用 API ====================

export interface OptimizeApplyRequest {
  ratios: Array<{
    ingredient: string
    dosage_g: number
    percentage: number
  }>
}

export interface OptimizeApplyResult {
  success: boolean
  formula_id: number
  message: string
  applied_ratios: any[]
}

export async function applyOptimization(
  formulaId: number,
  request: OptimizeApplyRequest,
): Promise<OptimizeApplyResult> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/optimize/apply`, request)
  return response.data
}

// ==================== 29. 分析结果持久化 API ====================

export async function saveAnalysisResult(
  formulaId: number,
  type: string,
  result: any,
): Promise<any> {
  const response = await api.post(`${FORMULA_BASE_URL}/${formulaId}/analysis/save`, { type, result })
  return response.data
}

export async function getAnalysisHistory(formulaId: number): Promise<any> {
  const response = await api.get(`${FORMULA_BASE_URL}/${formulaId}/analysis/history`)
  return response.data
}
