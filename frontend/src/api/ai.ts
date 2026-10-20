/**
 * AI 智能服务 API
 */
import { getCurrentScenarioMode } from '@/stores/scenarioStore';
import api from './client';
import { logger } from '@/utils/safeLogger';
import type { SynergyResult } from '@/types';

// ===== 统一类型导入 (从 ai.api.ts) =====
// 所有 API 响应类型集中管理，此处仅为向后兼容重新导出
import type {
  AICandidate,
  SafetyCheckResult,
  PeptideGenerateResponse,
  PeptideOptimizeResponse,
  SampleResponse,
  PepinventStatusResponse,
  GeneticGenerateResponse,
  GeneticHybridResponse,
  MultiObjectiveResponse,
  MOPresetInfo,
  GAHistoryRecord,
  GADetailResponse,
  PeptideAnalysisData,
  PaginatedResponse,
  BatchResult,
  PeptideDesignData,
  VersionInfo,
  ComparisonResult,
  TastePredictionResponse,
  StabilityPredictionResponse,
} from '@/types/ai.api';

export type {
  PatentSynergyScores,
  AICandidate,
  GenerationRecord,
  SafetyCheckResult,
  PeptideResult,
  PeptideGenerateResponse,
  GeneticHybridResponse,
  OptimizedPeptide,
  PeptideOptimizeResponse,
  SampleResponse,
  PepinventStatusResponse,
  GeneticGenerateResponse,
  MOObjective,
  MOParetoPoint,
  MOCandidate,
  MOBestByObjective,
  MultiObjectiveResponse,
  MOPresetInfo,
  GAHistoryRecord,
  GADetailResponse,
  PeptideAnalysisData,
  PaginatedResponse,
  BatchResult,
  PeptideDesignData,
  VersionInfo,
  ComparisonResult,
  TastePredictionResponse,
  StabilityPredictionResponse,
  ModelHealth,
  RateLimitInfo,
  AISummaryStats,
  KnowledgeDoc,
  KnowledgeChunk,
  SearchResult,
  MILPResult,
  NutritionConstraint,
  NutritionObjectiveConfig,
} from '@/types/ai.api';

/** 高级优化生成响应（标准化 generator 值） */
export interface AdvancedGenerateResponse {
  candidates: AICandidate[];
  total: number;
  generator: string;
}

export const aiApi = {
  /** AI 配方生成（支持 LLM 模式，自动路由到遗传算法引擎） */
  generate: async (
    targetEffects: string[],
    constraints?: Record<string, unknown>,
    useLlm = false,
    signal?: AbortSignal,
    algorithmConfig?: Record<string, unknown>,
  ) => {
    const result = await api.post<{
      candidates: AICandidate[];
      total: number;
      generator: string;
      execution_time_ms?: number;
      strategy?: string;
      best_score?: number;
    }>('/ai/generate', {
      target_effects: targetEffects,
      constraints: {
        ...constraints,
        ...algorithmConfig,
      },
      use_llm: useLlm,
      description: targetEffects.length > 0
        ? `基于${targetEffects.join('、')}功效需求，生成中药配方方案`
        : undefined,
    }, { timeout: 120000, signal });
    return result.data;
  },

  /** 智能配方推荐（基于数据库用户历史 + 协同配伍网络） */
  recommendFormula: async (
    targetEffects: string[],
    topK = 3,
  ): Promise<{ recommendations: Array<Record<string, unknown>>; total: number; generator: string }> => {
    const res = await api.post<{ recommendations: Array<Record<string, unknown>>; total: number; generator: string }>(
      '/ai/recommend',
      { target_effects: targetEffects, top_k: topK },
    );
    return res.data;
  },

  /** 配方智能解释（方解与现代药理机制） */
  interpretFormula: async (payload: {
    formula_name?: string
    herbs: Array<{ name: string; dosage_g?: number; role?: string }>
    target_effects: string[]
  }): Promise<{ interpretation: Record<string, unknown> }> => {
    const res = await api.post<{ interpretation: Record<string, unknown> }>(
      '/ai/interpret',
      payload,
    );
    return res.data;
  },
  /** 高级优化配方生成（真实 GA 引擎） */
  generateAdvanced: (
    targetEffects: string[],
    priorityValues?: Record<string, number>,
    constraints?: {
      maxIngredients?: number;
      excludedIngredients?: string[];
      ingredientTypes?: string[];
      tastePreferences?: string[];
      safetyLevel?: string;
    },
    maxCandidates = 5,
    signal?: AbortSignal,
  ): Promise<AdvancedGenerateResponse> =>
    api
      .post<AdvancedGenerateResponse>(
        '/ai/generate/advanced',
        {
          target_effects: targetEffects,
          priority_values: priorityValues,
          constraints,
          max_candidates: maxCandidates,
        },
        { timeout: 45000, signal },
      )
      .then((r) => r.data),

  /** 遗传算法配方生成 */
  generateGenetic: async (
    params: {
      targetEffects: string[];
      populationSize?: number;
      generations?: number;
      mutationRate?: number;
      crossoverRate?: number;
      eliteRatio?: number;
      tournamentSize?: number;
      count?: number;
      constraints?: Record<string, unknown>;
      /**
       * 综合适应度权重，键：efficacy/safety/taste/cost(成本效率)/synergy/stability。
       * 服务端会归一化；未列出的目标权重按 0 处理。不传则用后端内置默认。
       */
      objectiveWeights?: Record<string, number>;
    },
    signal?: AbortSignal,
  ) => {
    const res = await api.post(
      '/ai/generate/genetic',
      {
        target_effects: params.targetEffects,
        population_size: params.populationSize ?? 50,
        generations: params.generations ?? 40,
        mutation_rate: params.mutationRate ?? 0.15,
        crossover_rate: params.crossoverRate ?? 0.85,
        elite_ratio: params.eliteRatio ?? 0.15,
        tournament_size: params.tournamentSize ?? 5,
        count: params.count ?? 5,
        constraints: params.constraints ?? null,
        objective_weights: params.objectiveWeights ?? null,
      },
      { signal, timeout: 120000 },
    );
    return res.data as GeneticGenerateResponse;
  },

  // 多目标优化 (NSGA-II)
  multiObjectiveOptimize: async (
    params: {
      targetEffects?: string[];
      objectives?: Array<{ name?: string; key: string; direction?: string; weight?: number; description?: string }>;
      preset?: 'balanced' | 'cost_first' | 'efficacy_first' | 'safety_first' | 'synergy_focused' | 'comprehensive';
      mode?: 'pareto' | 'weighted' | 'epsilon';
      populationSize?: number;
      generations?: number;
      mutationRate?: number;
      crossoverRate?: number;
      eliteRatio?: number;
      constraints?: Record<string, unknown>;
      count?: number;
    },
    signal?: AbortSignal,
  ) => {
    const res = await api.post(
      '/ai/generate/multi-objective',
      {
        target_effects: params.targetEffects || ['免疫调节'],
        objectives: params.objectives || null,
        preset: params.preset || null,
        mode: params.mode || 'pareto',
        population_size: params.populationSize ?? 60,
        generations: params.generations ?? 50,
        mutation_rate: params.mutationRate ?? 0.15,
        crossover_rate: params.crossoverRate ?? 0.85,
        elite_ratio: params.eliteRatio ?? 0.1,
        constraints: params.constraints ?? null,
        count: params.count ?? 10,
      },
      { signal, timeout: 180000 },
    );
    return res.data as MultiObjectiveResponse;
  },

  // 获取预设场景列表
  getMOPresets: async () => {
    const res = await api.get('/ai/generate/multi-objective/presets');
    return res.data as { presets: Record<string, MOPresetInfo>; total: number };
  },

  // BinaryGA+MILP 混合优化
  generateGeneticHybrid: async (
    params: {
      targetEffects: string[];
      populationSize?: number;
      generations?: number;
      mutationRate?: number;
      crossoverRate?: number;
      eliteRatio?: number;
      tournamentSize?: number;
      count?: number;
      constraints?: Record<string, unknown>;
      totalDosage?: number;
      warmStartEnabled?: boolean;
      /** 同 generateGenetic：未列出的目标权重按 0 处理，服务端归一化。 */
      objectiveWeights?: Record<string, number>;
    },
    signal?: AbortSignal,
  ) => {
    const res = await api.post(
      '/ai/generate/genetic/hybrid',
      {
        target_effects: params.targetEffects,
        population_size: params.populationSize ?? 50,
        generations: params.generations ?? 40,
        mutation_rate: params.mutationRate ?? 0.15,
        crossover_rate: params.crossoverRate ?? 0.85,
        elite_ratio: params.eliteRatio ?? 0.15,
        tournament_size: params.tournamentSize ?? 5,
        count: params.count ?? 5,
        constraints: params.constraints ?? null,
        total_dosage: params.totalDosage ?? 100.0,
        warm_start_enabled: params.warmStartEnabled ?? true,
        hybrid_mode: true,
        objective_weights: params.objectiveWeights ?? null,
      },
      { signal, timeout: 180000 },
    );
    return res.data as GeneticHybridResponse;
  },

  // 统一优化调度器
  unifiedOptimize: async (
    params: {
      targetEffects: string[];
      strategy?: 'auto' | 'ga' | 'ga_lp_hybrid' | 'nsga2' | 'nsga3' | 'bayesian';
      populationSize?: number;
      generations?: number;
      maxIngredients?: number;
      minIngredients?: number;
      totalDosage?: number;
      requirePareto?: boolean;
      strictNutrition?: boolean;
      excludeHerbs?: string[];
      maxCost?: number;
    },
    signal?: AbortSignal,
  ) => {
    const res = await api.post(
      '/ai/generate/unified',
      {
        target_effects: params.targetEffects,
        strategy: params.strategy ?? 'auto',
        population_size: params.populationSize ?? 50,
        generations: params.generations ?? 40,
        max_ingredients: params.maxIngredients ?? 12,
        min_ingredients: params.minIngredients ?? 3,
        total_dosage: params.totalDosage ?? 100.0,
        require_pareto: params.requirePareto ?? false,
        strict_nutrition: params.strictNutrition ?? false,
        exclude_herbs: params.excludeHerbs ?? [],
        max_cost: params.maxCost ?? null,
      },
      { signal, timeout: 180000 },
    );
    return res.data;
  },

  // GA 运行历史 (数据库版)
  getGAHistory: async (params?: { algorithmType?: 'all' | 'genetic' | 'nsga2'; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.algorithmType && params.algorithmType !== 'all') q.set('algorithm_type', params.algorithmType);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const res = await api.get(`/ai/generate/history?${q.toString()}`);
    return res.data as { records: GAHistoryRecord[]; total: number; limit: number; offset: number };
  },

  // GA 运行详情
  getGADetail: async (runId: string) => {
    const res = await api.get(`/ai/generate/history/${runId}`);
    return res.data as GADetailResponse;
  },

  /** 安全合规检查 */
  safetyCheck: (ingredientNames: string[], peptideSequences?: string[]) =>
    api
      .post<SafetyCheckResult>('/ai/safety-check', {
        ingredient_names: ingredientNames,
        peptide_sequences: peptideSequences,
      })
      .then((r) => r.data),

  /** 协同作用分析 */
  synergyAnalysis: (herbNames: string[], peptideSequences?: string[]) =>
    api
      .post<SynergyResult>('/ai/synergy-analysis', { herb_names: herbNames, peptide_sequences: peptideSequences })
      .then((r) => r.data),

  /** 口感预测 */
  tastePredict: (ingredients: { name: string }[]) =>
    api.post<TastePredictionResponse>('/ai/taste-predict', { ingredients }).then((r) => r.data),

  /**
   * 稳定性预测
   *
   * 注意：后端路由是 `/ai/stability`（models_and_tools.py:145），历史上写成
   * `/ai/stability-predict` 会稳定 404。这里保留第二个参数透传储存条件，
   * 与后端 `StabilityPredictRequest(storage_temp)` 对齐。
   */
  stabilityPredict: (ingredients: { name: string }[], storageTemp = 25) =>
    api
      .post<StabilityPredictionResponse>('/ai/stability', { ingredients, storage_temp: storageTemp })
      .then((r) => r.data),

  /** 模型状态 */
  modelStatus: () => api.get<Record<string, Record<string, string>>>('/ai/models/status').then((r) => r.data),

  /**
   * AI 智能对话（非流式）
   * @deprecated 本地 API Key 路径已废弃：后端 /ai/chat 明确拒绝前端传递 key（chat.py L231），
   * 密钥由后端 llm_service（数据库/环境变量）驱动。/ai 页面的真实聊天走
   * chatService.sendMessage（components/ai/features/services/chatService.ts）。
   * 此方法仅保留给外部调用方过渡，请求体不含任何密钥字段。
   */
  chat: async (question: string, history?: { role: string; content: string }[]) => {
    logger.warn('[aiApi.chat] deprecated: 本地密钥不参与 /ai 对话，后端使用服务器配置的 LLM 密钥')
    return api.post<{ answer: string }>('/ai/chat', { question, history, scenario_mode: getCurrentScenarioMode() }).then((r) => r.data);
  },

  /**
   * AI 智能对话（流式）
   * @deprecated 同 chat：本地密钥不参与，流式请求走后端 llm_service。
   * 返回 Response 供 ReadableStream 消费。
   */
  chatStream: async (question: string, history?: { role: string; content: string }[]) => {
    logger.warn('[aiApi.chatStream] deprecated: 本地密钥不参与 /ai 对话，后端使用服务器配置的 LLM 密钥')
    const response = await api.post('/ai/chat/stream', { question, history, stream: true, scenario_mode: getCurrentScenarioMode() }, {
      responseType: 'stream',
    });
    return response.data;
  },
};

/**
 * 清洗 API Key（移除所有可能导致认证失败的隐藏字符）
 * @deprecated 本地密钥不再参与 /ai 对话（后端由 llm_service 驱动）。
 * 仅保留供未来仍接受密钥参数的旧端点做输入清洗，避免零宽/控制字符导致失败。
 */
export function sanitizeApiKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') {
    logger.warn('[sanitizeApiKey] 输入为空或非字符串');
    return '';
  }

  const originalLength = rawKey.length;

  // 移除首尾空白 + 所有空白/零宽/控制字符
  let cleaned = rawKey.trim();
  cleaned = cleaned.replace(/[\s\r\n\t\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '');
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
  // eslint-disable-next-line no-control-regex -- 有意清理输入中的控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  if (import.meta.env.DEV && originalLength !== cleaned.length) {
    logger.info(`[sanitizeApiKey] Key 已清洗: ${originalLength} → ${cleaned.length} 字符`);
  }

  return cleaned;
}

// v7.1: 导出默认 API 实例
export default aiApi;

// ===== 肽序列分析 API =====
export const peptideAnalysisApi = {
  /** 创建分析记录 */
  createAnalysis: (data: {
    sequence: string;
    analysis_mode?: 'quick' | 'deep' | 'custom';
    tags?: string[];
    notes?: string;
    peptide_id?: number;
  }) => api.post<{ success: boolean; data: PeptideAnalysisData }>('/peptide-analyses', data).then((r) => r.data),

  /** 获取分析列表（分页） */
  listAnalyses: (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    activity_type?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get<PaginatedResponse<PeptideAnalysisData>>('/peptide-analyses', { params }).then((r) => r.data),

  /** 获取分析详情（含7维数据） */
  getAnalysis: (id: number) => api.get<PeptideAnalysisData>(`/peptide-analyses/${id}`).then((r) => r.data),

  /** 更新分析元数据（备注、标签） */
  updateAnalysis: (id: number, data: { tags?: string[]; notes?: string }) =>
    api.put<PeptideAnalysisData>(`/peptide-analyses/${id}`, data).then((r) => r.data),

  /** 软删除分析记录 */
  deleteAnalysis: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/peptide-analyses/${id}`).then((r) => r.data),

  /** 批量创建分析记录（最多100条） */
  batchCreateAnalyses: (
    items: {
      sequence: string;
      analysis_mode?: string;
      tags?: string[];
      notes?: string;
    }[],
  ) => api.post<BatchResult>('/peptide-analyses/batch', { items }).then((r) => r.data),

  /** 导出分析数据（CSV格式） */
  exportAnalyses: (params?: { format?: 'csv' | 'excel'; search?: string; start_date?: string; end_date?: string }) =>
    api
      .get<Blob>('/peptide-analyses/export', {
        params: { format: 'csv', ...params },
        responseType: 'blob',
      })
      .then((r) => r.data),
};

// ===== 肽设计 API =====
export const peptideDesignApi = {
  /** 创建设计项目 */
  createProject: (data: {
    project_name: string;
    target_effects: string[];
    objective_weights?: Record<string, number>;
    constraints?: Record<string, unknown>;
    seed_sequence?: string;
  }) => api.post<{ success: boolean; data: PeptideDesignData }>('/peptide-designs', data).then((r) => r.data),

  /** 获取项目列表（分页，支持状态筛选） */
  listProjects: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get<PaginatedResponse<PeptideDesignData>>('/peptide-designs', { params }).then((r) => r.data),

  /** 获取项目详情（含候选方案） */
  getProject: (id: number, includeCandidates = true) =>
    api
      .get<{
        success: boolean;
        data: PeptideDesignData;
      }>(`/peptide-designs/${id}`, { params: { include_candidates: includeCandidates } })
      .then((r) => r.data),

  /** 更新项目元数据（名称、备注等） */
  updateProject: (
    id: number,
    data: {
      project_name?: string;
      notes?: string;
      tags?: string[];
    },
  ) => api.put<{ success: boolean; data: PeptideDesignData }>(`/peptide-designs/${id}`, data).then((r) => r.data),

  /** 更新项目状态（自动递增版本号） */
  updateStatus: (id: number, newStatus: string) =>
    api
      .patch<{
        success: boolean;
        data: PeptideDesignData;
      }>(`/peptide-designs/${id}/status`, null, { params: { new_status: newStatus } })
      .then((r) => r.data),

  /** 归档项目 */
  archiveProject: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/peptide-designs/${id}`).then((r) => r.data),

  /** 向项目添加候选方案（自动计算Pareto前沿） */
  addCandidates: (
    projectId: number,
    candidates: {
      sequence: string;
      objectives_scores: Record<string, number>;
      rank?: number;
      is_pareto_frontier?: boolean;
      dominated_by_count?: number;
    }[],
  ) =>
    api
      .post<{
        success: boolean;
        data: { design_id: number; added_count: number; message: string };
      }>(`/peptide-designs/${projectId}/candidates`, candidates)
      .then((r) => r.data),

  /** 获取版本历史 */
  getVersions: (projectId: number) =>
    api.get<VersionInfo[]>(`/peptide-designs/${projectId}/versions`).then((r) => r.data),

  /** 版本对比 */
  compareVersions: (projectId: number, v1: number, v2: number) =>
    api.get<ComparisonResult>(`/peptide-designs/${projectId}/compare`, { params: { v1, v2 } }).then((r) => r.data),

  /** 获取 PepInvent 服务状态 */
  getPepinventStatus: () => api.get<PepinventStatusResponse>('/ai/peptide/status').then((r) => r.data),

  /** 生成多肽序列 */
  generatePeptides: (targetEffects: string[], constraints?: Record<string, unknown>) =>
    api
      .post<PeptideGenerateResponse>('/ai/peptide/generate', {
        target_effects: targetEffects,
        max_candidates: constraints?.max_candidates || 5,
        constraints,
      })
      .then((r) => r.data),

  /** 优化多肽序列 */
  optimizePeptide: (seedSequence: string, goals: Record<string, number>, maxIterations = 10) =>
    api
      .post<PeptideOptimizeResponse>('/ai/peptide/optimize', {
        seed_sequence: seedSequence,
        optimization_goals: goals,
        iterations: maxIterations,
      })
      .then((r) => r.data),

  /** 多样性采样 */
  sampleDiversePeptides: (_existingSequences: string[], sampleSize = 5, temperature?: number | null) =>
    api
      .post<SampleResponse>('/ai/peptide/sample', {
        sample_size: sampleSize,
        temperature,
        diversity_metric: 'tanimoto',
      })
      .then((r) => r.data),
};
