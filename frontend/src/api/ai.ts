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
  PatentSynergyScores,
  AICandidate,
  GenerationRecord,
  SafetyCheckResult,
  PeptideResult,
  PeptideGenerateResponse,
  OptimizedPeptide,
  PeptideOptimizeResponse,
  SampleResponse,
  PepinventStatusResponse,
  GeneticGenerateResponse,
  GeneticHybridResponse,
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

export const aiApi = {
  /** AI 配方生成（支持 LLM 模式） */
  generate: (targetEffects: string[], constraints?: Record<string, unknown>, useLlm = false, signal?: AbortSignal) =>
    api
      .post<{ candidates: AICandidate[]; total: number; generator: string }>(
        '/ai/generate',
        {
          target_effects: targetEffects,
          constraints,
          use_llm: useLlm,
          // 兼容后端 AIGenerateRequest 的 description 必填字段
          description:
            targetEffects.length > 0 ? `基于${targetEffects.join('、')}功效需求，生成中药配方方案` : undefined,
        },
        { timeout: 30000, signal },
      )
      .then((r) => r.data),

  /** 神经网络配方生成（基于专利 US 11,742,060 B2）*/
  generateNeural: (
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
  ) =>
    api
      .post<{ candidates: AICandidate[]; total: number; generator: string }>(
        '/ai/generate/neural',
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

  /** 稳定性预测 */
  stabilityPredict: (ingredients: { name: string }[]) =>
    api.post<StabilityPredictionResponse>('/ai/stability-predict', { ingredients }).then((r) => r.data),

  /** 模型状态 */
  modelStatus: () => api.get<Record<string, Record<string, string>>>('/ai/models/status').then((r) => r.data),

  /** AI 智能对话（非流式） */
  chat: async (question: string, history?: { role: string; content: string }[]) => {
    let apiKey = '';

    try {
      const { unifiedApiKeyManager } = await import('@/utils/unifiedApiKeyManager');
      const keyResult = await unifiedApiKeyManager.getApiKey();
      apiKey = keyResult.apiKey;

      // 仅在开发环境输出存储类型提示（避免生产环境日志污染）
      if (process.env.NODE_ENV === 'development' && keyResult.source === 'configmanager') {
        logger.info('[aiApi.chat] 使用传统存储 (ConfigManager) 的 API Key，建议升级到安全存储');
      }
    } catch (e) {
      // 统一管理器失败时仅在开发环境告警，不再降级到 localStorage
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[aiApi.chat] 统一API Key管理器读取失败:', e);
      }
    }

    apiKey = sanitizeApiKey(apiKey);

    // 最终验证：确保apiKey有效
    if (!apiKey && process.env.NODE_ENV === 'development') {
      logger.warn('[aiApi.chat] ⚠️ API Key为空，请求可能会被后端拒绝');
    }

    return api.post<{ answer: string }>('/ai/chat', { question, history, scenario_mode: getCurrentScenarioMode() }).then((r) => r.data);
  },

  /** AI 智能对话（流式） - 返回原始 Response 用于 ReadableStream */
  chatStream: async (question: string, history?: { role: string; content: string }[]) => {
    let apiKey = '';
    try {
      const { unifiedApiKeyManager } = await import('@/utils/unifiedApiKeyManager');
      const keyResult = await unifiedApiKeyManager.getApiKey();
      apiKey = keyResult.apiKey;

      // 仅在开发环境输出存储类型提示
      if (process.env.NODE_ENV === 'development' && keyResult.source === 'configmanager') {
        logger.info('[aiApi.chatStream] 使用传统存储 (ConfigManager) 的 API Key，建议升级到安全存储');
      }
    } catch (e) {
      // 不再降级到 localStorage，统一由后端管理 API Key
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[aiApi.chatStream] 统一API Key管理器读取失败:', e);
      }
    }

    apiKey = sanitizeApiKey(apiKey);

    // 最终验证：确保apiKey有效
    if (!apiKey && process.env.NODE_ENV === 'development') {
      logger.warn('[aiApi.chatStream] ⚠️ API Key为空，请求可能会被后端拒绝');
    }

    const response = await api.post('/ai/chat/stream', { question, history, stream: true, scenario_mode: getCurrentScenarioMode() }, {
      responseType: 'stream',
    });
    return response.data;
  },
};

/**
 * 清洗 API Key（移除所有可能导致认证失败的隐藏字符）
 */
function sanitizeApiKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') {
    // 仅在开发环境输出警告
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[sanitizeApiKey] 输入为空或非字符串');
    }
    return '';
  }

  const originalLength = rawKey.length;

  // Step 1: 移除首尾空白
  let cleaned = rawKey.trim();

  // Step 2: 移除所有空白字符（包括不可见的）
  cleaned = cleaned.replace(/[\s\r\n\t\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '');

  // Step 3: 移除零宽字符（Zero-width characters）
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');

  // Step 4: 移除控制字符（保留合法的可打印字符）
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  const cleanedLength = cleaned.length;

  // 仅在开发环境和实际清洗发生时记录日志
  if (process.env.NODE_ENV === 'development' && originalLength !== cleanedLength) {
    logger.info(
      `[sanitizeApiKey] Key 已清洗: ${originalLength} → ${cleanedLength} 字符 (移除 ${originalLength - cleanedLength} 个隐藏字符)`,
    );
  }

  // 验证基本格式（仅开发环境输出详细信息）
  if (process.env.NODE_ENV === 'development' && cleanedLength > 0) {
    const prefix = cleaned.substring(0, Math.min(8, cleanedLength));
    const suffix = cleaned.substring(Math.max(0, cleanedLength - 4));

    logger.debug(`[sanitizeApiKey] Key 验证通过: 长度=${cleanedLength}, 前缀="${prefix}...", 后缀="...${suffix}"`);

    // 检查常见格式问题
    if (!cleaned.startsWith('sk-') && !cleaned.startsWith('Bearer ')) {
      logger.warn(`[sanitizeApiKey] Key 格式异常: 不以 "sk-" 或 "Bearer " 开头，前8位="${prefix}"`);
    }
  } else if (cleanedLength === 0 && process.env.NODE_ENV === 'development') {
    logger.error(`[sanitizeApiKey] ❌ 清洗后 Key 为空！原始长度=${originalLength}`);
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
