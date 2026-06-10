/**
 * AI 智能服务 API
 */
import api from './client'
import { logger } from '@/utils/safeLogger'
import type { SynergyResult, SafetyCheckResult } from '@/types'

// 定义缺失的类型 (这些类型在 @/types 中未导出)
export interface PatentSynergyScores {
  bliss_independence: number   // 药效增强 [0, 2]
  pk_interaction: number       // 药代动力学 [0, 2]
  gibbs_stability: number      // 结构稳定性 [0, 1]
  network_pharmacology: number // 靶点通路 [0, 1]
  taste_matrix: number         // 感官品质 [0, 1]
  overall_si: number           // 综合协同指数 [0, 1]
  weighted_score: number       // 加权综合分 [0, 100]
  dominant_mechanism: string   // 主导机制
  quality_level: string        // 质量等级
  confidence: number          // 置信度 [0, 1]
}

export interface AICandidate {
  id: string
  name: string
  ingredients: {
    name: string
    dosage: string
    unit: string
    amount_mg?: number
  }[]
  score: number
  effects: string[]
  formula_name?: string
  herb_combination?: {
    name?: string
    dosage?: string
    role?: string
  }[]
  synergy_score?: number
  patent_synergy_scores?: PatentSynergyScores
  /** 配方分析扩展字段 */
  peptide_candidates?: { name: string; sequence: string }[]
  safety_passed?: boolean
  safety_details?: { warnings: string[]; contraindications: string[]; summary: string }
  taste_score?: number
  stability_score?: number
  overall_score?: number
  generated_by?: string
  generated_at?: string
  description?: string
}

export interface SafetyCheckResult {
  safe?: boolean
  passed?: boolean
  riskLevel?: 'safe' | 'caution' | 'danger' | 'contraindicated' | 'low' | 'medium' | 'high' | 'critical'
  checkedAt?: string
  checkedBy?: string
  summary?: string
  errors?: string[]
  checks?: Record<string, { passed?: boolean }>
  warnings: {
    ingredient?: string
    level?: 'info' | 'warning' | 'danger'
    code?: string
    message: string
    severity?: string
    category?: string
  }[]
  details?: Record<string, unknown>
}

export interface PeptideResult {
  sequence: string
  molecular_weight: number
  logp: number
  tpsa: number
  activity_scores: Record<string, number>
  composite_score: number
  smiles?: string
  amino_acid_count: number
  properties?: Record<string, unknown>
}

export interface PeptideGenerateResponse {
  success: boolean
  data: {
    peptides: PeptideResult[]
    total: number
    generation_method: string
    target_effects: string[]
    diversity_metrics: {
      diversity_score: number
      unique_count: number
      average_similarity: number
    }
    generated_at: string
    processing_time_ms: number
  }
}

export interface OptimizedPeptide {
  sequence: string
  scores: Record<string, number>
  weighted_score: number
  iteration_improved: number
  improvement_over_seed: number
  properties?: Record<string, unknown>
  seed_sequence?: string
}

export interface PeptideOptimizeResponse {
  success: boolean
  data: {
    optimized_peptides: OptimizedPeptide[]
    total: number
    optimization_goals: Record<string, number>
    seed_count: number
    iterations_performed: number
    generated_at: string
    processing_time_ms: number
  }
}

export interface SampleResponse {
  success: boolean
  data: {
    peptides: {
      sequence: string
      log_probability: number
      smiles?: string
      properties?: Record<string, unknown>
      molecular_weight: number
      amino_acid_count: number
    }[]
    total: number
    diversity_metrics: {
      diversity_score: number
      unique_count: number
      average_similarity: number
      similarity_matrix: number[][]
    }
    sampling_parameters: {
      requested_size: number
      actual_size: number
      temperature: number | null
      top_k: number | null
      metric: string
    }
    generated_at: string
    processing_time_ms: number
  }
}

export interface PepinventStatusResponse {
  service_name: string
  version: string
  available: boolean
  initialized: boolean
  simulation_mode: boolean
  device: string
  dependencies: {
    available: boolean
    missing: string[]
    version_info: Record<string, string | null>
  }
  config: Record<string, unknown>
  cache_stats: {
    cache_size: number
    cache_enabled: boolean
  }
}

export const aiApi = {
  /** AI 配方生成（支持 LLM 模式） */
  generate: (
    targetEffects: string[],
    constraints?: Record<string, unknown>,
    useLlm = false,
    signal?: AbortSignal,
  ) =>
    api.post<{ candidates: AICandidate[]; total: number; generator: string }>(
      '/ai/generate',
      {
        target_effects: targetEffects,
        constraints,
        use_llm: useLlm,
        // 兼容后端 AIGenerateRequest 的 description 必填字段
        description: targetEffects.length > 0
          ? `基于${targetEffects.join('、')}功效需求，生成中药配方方案`
          : undefined,
      },
      { timeout: 30000, signal },
    ).then((r) => r.data),

  /** 神经网络配方生成（基于专利 US 11,742,060 B2）*/
  generateNeural: (
    targetEffects: string[],
    priorityValues?: Record<string, number>,
    constraints?: {
      maxIngredients?: number
      excludedIngredients?: string[]
      ingredientTypes?: string[]
      tastePreferences?: string[]
      safetyLevel?: string
    },
    maxCandidates = 5,
    signal?: AbortSignal,
  ) =>
    api.post<{ candidates: AICandidate[]; total: number; generator: string }>(
      '/ai/generate/neural',
      {
        target_effects: targetEffects,
        priority_values: priorityValues,
        constraints,
        max_candidates: maxCandidates,
      },
      { timeout: 45000, signal },
    ).then((r) => r.data),

  /** 安全合规检查 */
  safetyCheck: (ingredientNames: string[], peptideSequences?: string[]) =>
    api.post<SafetyCheckResult>(
      '/ai/safety-check',
      { ingredient_names: ingredientNames, peptide_sequences: peptideSequences },
    ).then((r) => r.data),

  /** 协同作用分析 */
  synergyAnalysis: (herbNames: string[], peptideSequences?: string[]) =>
    api.post<SynergyResult>(
      '/ai/synergy-analysis',
      { herb_names: herbNames, peptide_sequences: peptideSequences },
    ).then((r) => r.data),

  /** 口感预测 */
  tastePredict: (ingredients: { name: string }[]) =>
    api.post<{ sweetness: number; bitterness: number; astringency: number; overall_score: number; flavor_notes: string[] }>(
      '/ai/taste-predict',
      { ingredients },
    ).then((r) => r.data),

  /** 稳定性预测 */
  stabilityPredict: (ingredients: { name: string }[]) =>
    api.post<{ stability_score: number; estimated_shelf_life_months: number; risk_factors: string[]; monthly_curve: { month: number; stability: number }[]; storage_advice: string }>(
      '/ai/stability-predict',
      { ingredients },
    ).then((r) => r.data),

  /** 模型状态 */
  modelStatus: () => api.get<Record<string, Record<string, string>>>('/ai/models/status').then((r) => r.data),

  /** AI 智能对话（非流式） */
  chat: async (question: string, history?: { role: string; content: string }[]) => {
    let apiKey = ''
    let useLegacyStorage = false

    try {
      const { unifiedApiKeyManager } = await import('@/utils/unifiedApiKeyManager')
      const keyResult = await unifiedApiKeyManager.getApiKey()
      apiKey = keyResult.apiKey
      useLegacyStorage = keyResult.source === 'configmanager'

      // 仅在开发环境输出存储类型提示（避免生产环境日志污染）
      if (process.env.NODE_ENV === 'development' && useLegacyStorage) {
        console.info('[aiApi.chat] 使用传统存储 (ConfigManager) 的 API Key，建议升级到安全存储')
      }
    } catch (e) {
      // 优雅降级：统一管理器失败时尝试从localStorage读取
      if (process.env.NODE_ENV === 'development') {
        console.warn('[aiApi.chat] 统一API Key管理器读取失败，尝试降级方案:', e)
      }

      try {
        // 降级方案1: 从localStorage直接读取
        const legacyKey = localStorage.getItem('deepseek_api_key') || localStorage.getItem('api_key')
        if (legacyKey) {
          apiKey = legacyKey
          if (process.env.NODE_ENV === 'development') {
            console.info('[aiApi.chat] 成功从localStorage获取备用API Key')
          }
        }
      } catch (fallbackError) {
        logger.error('[aiApi.chat] 所有API Key获取方式均失败', fallbackError)
      }
    }

    apiKey = sanitizeApiKey(apiKey)

    // 最终验证：确保apiKey有效
    if (!apiKey && process.env.NODE_ENV === 'development') {
      console.warn('[aiApi.chat] ⚠️ API Key为空，请求可能会被后端拒绝')
    }

    return api.post<{ answer: string }>(
      '/ai/chat',
      { question, history, api_key: apiKey },
    ).then((r) => r.data)
  },

  /** AI 智能对话（流式） - 返回原始 Response 用于 ReadableStream */
  chatStream: async (question: string, history?: { role: string; content: string }[]) => {
    const token = localStorage.getItem('access_token')

    let apiKey = ''
    try {
      const { unifiedApiKeyManager } = await import('@/utils/unifiedApiKeyManager')
      const keyResult = await unifiedApiKeyManager.getApiKey()
      apiKey = keyResult.apiKey

      // 仅在开发环境输出存储类型提示
      if (process.env.NODE_ENV === 'development' && keyResult.source === 'configmanager') {
        console.info('[aiApi.chatStream] 使用传统存储 (ConfigManager) 的 API Key，建议升级到安全存储')
      }
    } catch (e) {
      // 优雅降级：统一管理器失败时尝试从localStorage读取
      if (process.env.NODE_ENV === 'development') {
        console.warn('[aiApi.chatStream] 统一API Key管理器读取失败，尝试降级方案:', e)
      }

      try {
        // 降级方案：从localStorage直接读取
        const legacyKey = localStorage.getItem('deepseek_api_key') || localStorage.getItem('api_key')
        if (legacyKey) {
          apiKey = legacyKey
          if (process.env.NODE_ENV === 'development') {
            console.info('[aiApi.chatStream] 成功从localStorage获取备用API Key')
          }
        }
      } catch (fallbackError) {
        logger.error('[aiApi.chatStream] 所有API Key获取方式均失败', fallbackError)
      }
    }

    apiKey = sanitizeApiKey(apiKey)

    // 最终验证：确保apiKey有效
    if (!apiKey && process.env.NODE_ENV === 'development') {
      console.warn('[aiApi.chatStream] ⚠️ API Key为空，请求可能会被后端拒绝')
    }

    const response = await fetch(`${api.defaults.baseURL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, history, stream: true, api_key: apiKey }),
    })
    if (!response.ok) throw new Error(`AI 对话失败: ${response.status}`)
    return response
  },
}

/**
 * 清洗 API Key（移除所有可能导致认证失败的隐藏字符）
 */
function sanitizeApiKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') {
    // 仅在开发环境输出警告
    if (process.env.NODE_ENV === 'development') {
      console.warn('[sanitizeApiKey] 输入为空或非字符串')
    }
    return ''
  }

  const originalLength = rawKey.length

  // Step 1: 移除首尾空白
  let cleaned = rawKey.trim()

  // Step 2: 移除所有空白字符（包括不可见的）
  cleaned = cleaned.replace(/[\s\r\n\t\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '')

  // Step 3: 移除零宽字符（Zero-width characters）
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')

  // Step 4: 移除控制字符（保留合法的可打印字符）
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')

  const cleanedLength = cleaned.length

  // 仅在开发环境和实际清洗发生时记录日志
  if (process.env.NODE_ENV === 'development' && originalLength !== cleanedLength) {
    console.info(`[sanitizeApiKey] Key 已清洗: ${originalLength} → ${cleanedLength} 字符 (移除 ${originalLength - cleanedLength} 个隐藏字符)`)
  }

  // 验证基本格式（仅开发环境输出详细信息）
  if (process.env.NODE_ENV === 'development' && cleanedLength > 0) {
    const prefix = cleaned.substring(0, Math.min(8, cleanedLength))
    const suffix = cleaned.substring(Math.max(0, cleanedLength - 4))

    console.debug(`[sanitizeApiKey] Key 验证通过: 长度=${cleanedLength}, 前缀="${prefix}...", 后缀="...${suffix}"`)

    // 检查常见格式问题
    if (!cleaned.startsWith('sk-') && !cleaned.startsWith('Bearer ')) {
      console.warn(`[sanitizeApiKey] Key 格式异常: 不以 "sk-" 或 "Bearer " 开头，前8位="${prefix}"`)
    }
  } else if (cleanedLength === 0 && process.env.NODE_ENV === 'development') {
      logger.error(`[sanitizeApiKey] ❌ 清洗后 Key 为空！原始长度=${originalLength}`)
    }

  return cleaned
}

// v7.1: 导出默认 API 实例
export default aiApi

// ══════════════════════════════════════
// 肽序列分析 数据库集成 API (新增)
// ══════════════════════════════════════

export interface PeptideAnalysisData {
  id: number
  sequence: string
  user_id: number
  analysis_mode: 'quick' | 'deep' | 'custom'
  tags: string[]
  notes: string | null
  peptide_id: number | null
  created_at: string
  updated_at: string
  details: {
    id: number
    dimension_type: 'basic' | 'structure' | 'physicochemical' | 'bioactivity' | 'safety' | 'overall'
    data: Record<string, unknown>
    created_at: string
  }[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface BatchResult {
  success_count: number
  failed_items: { index: number; error: string; sequence?: string }[]
}

export const peptideAnalysisApi = {
  /** 创建分析记录 */
  createAnalysis: (data: {
    sequence: string
    analysis_mode?: 'quick' | 'deep' | 'custom'
    tags?: string[]
    notes?: string
    peptide_id?: number
  }) =>
    api.post<{ success: boolean; data: PeptideAnalysisData }>(
      '/peptide-analyses',
      data,
    ).then((r) => r.data),

  /** 获取分析列表（分页） */
  listAnalyses: (params?: {
    page?: number
    page_size?: number
    search?: string
    activity_type?: string
    start_date?: string
    end_date?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }) =>
    api.get<PaginatedResponse<PeptideAnalysisData>>(
      '/peptide-analyses',
      { params },
    ).then((r) => r.data),

  /** 获取分析详情（含7维数据） */
  getAnalysis: (id: number) =>
    api.get<PeptideAnalysisData>(`/peptide-analyses/${id}`).then((r) => r.data),

  /** 更新分析元数据（备注、标签） */
  updateAnalysis: (id: number, data: { tags?: string[]; notes?: string }) =>
    api.put<PeptideAnalysisData>(`/peptide-analyses/${id}`, data).then((r) => r.data),

  /** 软删除分析记录 */
  deleteAnalysis: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/peptide-analyses/${id}`).then((r) => r.data),

  /** 批量创建分析记录（最多100条） */
  batchCreateAnalyses: (items: {
    sequence: string
    analysis_mode?: string
    tags?: string[]
    notes?: string
  }[]) =>
    api.post<BatchResult>('/peptide-analyses/batch', { items }).then((r) => r.data),

  /** 导出分析数据（CSV格式） */
  exportAnalyses: (params?: {
    format?: 'csv' | 'excel'
    search?: string
    start_date?: string
    end_date?: string
  }) =>
    api.get<Blob>('/peptide-analyses/export', {
      params: { format: 'csv', ...params },
      responseType: 'blob',
    }).then((r) => r.data),
}

// ══════════════════════════════════════
// 肽设计优化 数据库集成 API (新增)
// ══════════════════════════════════════

export interface PeptideDesignData {
  id: number
  project_name: string
  user_id: number
  target_effects: string[]
  objective_weights: Record<string, number>
  constraints: Record<string, unknown> | null
  seed_sequence: string | null
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  version: number
  parent_version_id: number | null
  total_candidates: number
  pareto_size: number
  candidates: {
    id: number
    design_id: number
    sequence: string
    objectives_scores: Record<string, number>
    rank: number
    is_pareto_frontier: boolean
    dominated_by_count: number
    created_at: string
  }[]
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface VersionInfo {
  version: number
  status: string
  config_snapshot: Record<string, unknown>
  candidate_count: number
  created_at: string
  change_summary: string | null
}

export interface ComparisonResult {
  v1_version: number
  v2_version: number
  config_changes: Record<string, unknown>
  candidate_changes: Record<string, unknown>
  summary: string
}

export const peptideDesignApi = {
  /** 创建设计项目 */
  createProject: (data: {
    project_name: string
    target_effects: string[]
    objective_weights?: Record<string, number>
    constraints?: Record<string, unknown>
    seed_sequence?: string
  }) =>
    api.post<{ success: boolean; data: PeptideDesignData }>(
      '/peptide-designs',
      data,
    ).then((r) => r.data),

  /** 获取项目列表（分页，支持状态筛选） */
  listProjects: (params?: {
    page?: number
    page_size?: number
    status?: string
    search?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }) =>
    api.get<PaginatedResponse<PeptideDesignData>>(
      '/peptide-designs',
      { params },
    ).then((r) => r.data),

  /** 获取项目详情（含候选方案） */
  getProject: (id: number, includeCandidates = true) =>
    api.get<{ success: boolean; data: PeptideDesignData }>(
      `/peptide-designs/${id}`,
      { params: { include_candidates: includeCandidates } },
    ).then((r) => r.data),

  /** 更新项目元数据（名称、备注等） */
  updateProject: (id: number, data: {
    project_name?: string
    notes?: string
    tags?: string[]
  }) =>
    api.put<{ success: boolean; data: PeptideDesignData }>(
      `/peptide-designs/${id}`,
      data,
    ).then((r) => r.data),

  /** 更新项目状态（自动递增版本号） */
  updateStatus: (id: number, newStatus: string) =>
    api.patch<{ success: boolean; data: PeptideDesignData }>(
      `/peptide-designs/${id}/status`,
      null,
      { params: { new_status: newStatus } },
    ).then((r) => r.data),

  /** 归档项目 */
  archiveProject: (id: number) =>
    api.delete<{ success: boolean; message: string }>(
      `/peptide-designs/${id}`,
    ).then((r) => r.data),

  /** 向项目添加候选方案（自动计算Pareto前沿） */
  addCandidates: (
    projectId: number,
    candidates: {
      sequence: string
      objectives_scores: Record<string, number>
      rank?: number
      is_pareto_frontier?: boolean
      dominated_by_count?: number
    }[],
  ) =>
    api.post<{ success: boolean; data: { design_id: number; added_count: number; message: string } }>(
      `/peptide-designs/${projectId}/candidates`,
      candidates,
    ).then((r) => r.data),

  /** 获取版本历史 */
  getVersions: (projectId: number) =>
    api.get<VersionInfo[]>(`/peptide-designs/${projectId}/versions`).then((r) => r.data),

  /** 版本对比 */
  compareVersions: (projectId: number, v1: number, v2: number) =>
    api.get<ComparisonResult>(
      `/peptide-designs/${projectId}/compare`,
      { params: { v1, v2 } },
    ).then((r) => r.data),

  /** 获取 PepInvent 服务状态 */
  getPepinventStatus: () =>
    api.get<PepinventStatusResponse>('/ai/peptide/status').then((r) => r.data),

  /** 生成多肽序列 */
  generatePeptides: (targetEffects: string[], constraints?: Record<string, unknown>) =>
    api.post<PeptideGenerateResponse>('/ai/peptide/generate', {
      target_effects: targetEffects,
      max_candidates: constraints?.max_candidates || 5,
      constraints,
    }).then((r) => r.data),

  /** 优化多肽序列 */
  optimizePeptide: (
    seedSequence: string,
    goals: Record<string, number>,
    maxIterations = 10,
  ) =>
    api.post<PeptideOptimizeResponse>('/ai/peptide/optimize', {
      seed_sequence: seedSequence,
      optimization_goals: goals,
      iterations: maxIterations,
    }).then((r) => r.data),

  /** 多样性采样 */
  sampleDiversePeptides: (
    _existingSequences: string[],
    sampleSize = 5,
    temperature?: number | null,
  ) =>
    api.post<SampleResponse>('/ai/peptide/sample', {
      sample_size: sampleSize,
      temperature,
      diversity_metric: 'tanimoto',
    }).then((r) => r.data),
}
