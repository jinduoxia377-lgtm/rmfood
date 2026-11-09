/**
 * AI 智能助手中心 — API 响应类型定义
 *
 * 所有 AI API 的请求/响应类型统一在此定义，
 * 由 src/api/ai.ts 导入使用。
 * 其他模块通过 '@/types/ai.api' 或 '@/api/ai'（重新导出）导入。
 *
 * @module types/ai.api
 */

// ===== 配方生成 =====

export interface PatentSynergyScores {
  bliss_independence: number;
  pk_interaction: number;
  gibbs_stability: number;
  network_pharmacology: number;
  taste_matrix: number;
  overall_si: number;
  weighted_score: number;
  dominant_mechanism: string;
  quality_level: string;
  confidence: number;
}

/**
 * 知识库 RAG 检索证据（配方生成响应级字段，后端 formula_generation_service 注入）。
 * 归一化层（api/ai.ts normalizeGenerateResponse）会将其透传到每个候选，
 * 供 FormulaResultsPro 渲染「知识库证据」摘要；缺失时 UI 显示「暂无知识库证据」占位。
 */
export interface RAGEvidence {
  /** RAG 检索是否真正返回了知识块 */
  enabled: boolean;
  /** 实际检索查询 */
  query: string;
  /** 检索到的知识块（source/score/content） */
  chunks: Array<{ source: string; score: number; content: string }>;
  /** 命中正向知识条目的药材中文名 */
  whitelist: string[];
  /** 命中禁忌/毒性/用量限制的药材中文名 */
  blacklist: string[];
  /** 知识摘要 */
  summary: string;
  /** 检索异常信息（可选） */
  error?: string | null;
}

/**
 * 配方候选统一类型（权威定义，见 types/index.ts 的 re-export）。
 *
 * 合并自原 types/index.ts 的 AICandidate（模型管理域字段：provider/model/maxTokens/...）
 * 与原 types/ai.api.ts 的 AICandidate（配方生成域字段），保留双方字段并集。
 * 配方生成主域字段（id/name/effects）保持必填，模型管理域字段全部可选。
 */
/** 安全合规三态（前端 UI 呈现口径，ADR-046 L5 可信呈现层） */
export type SafetyVerdictStatus = 'passed' | 'needs_attention' | 'unverified'

/**
 * 安全合规裁定（含信任来源）。
 * 原则「不向用户传递未经证实的信任」：无裁定 = unverified（灰态），禁止由评分反推。
 */
export interface SafetyVerdict {
  status: SafetyVerdictStatus
  /** 裁定来源：backend_verdict=后端安全闸门；explicit_flag=后端显式 safety_passed；none=无裁定（灰态） */
  source: 'backend_verdict' | 'explicit_flag' | 'none'
  /** 人类可读原因（violation/warning 摘要），unverified 时通常为 undefined */
  reason?: string
  /** 后端 violations 原文（needs_attention 时非空） */
  violations?: string[]
  /** 后端 warnings 原文 */
  warnings?: string[]
}

export interface AICandidate {
  id: string;
  name: string;
  /**
   * 成分列表。
   * 注意：后端 /ai/generate 主端点实际返回 `herb_combination`（[{name,name_cn,dosage,dosage_g,role}]），
   * 归一化层（api/ai.ts normalizeGenerateCandidate）会将其映射到此字段；
   * 直接消费原始响应时该字段可能缺失，请用 `herb_combination ?? []` 兜底。
   */
  ingredients?: {
    name: string;
    dosage: string;
    unit: string;
    amount_mg?: number;
    dosage_g?: number;
  }[];
  /**
   * 综合评分。
   * 后端主端点返回 `overall_score`，归一化层会补 `score = overall_score`；
   * 直接消费原始响应时该字段可能缺失，请用 `overall_score ?? synergy_score ?? 0` 兜底。
   */
  score?: number;
  effects: string[];
  formula_name?: string;
  herb_combination?: Array<{
    name?: string;
    /** 后端 genetic 系列字段改名后的中文名（task-1 后端同步），归一化层优先读取 */
    name_cn?: string;
    id?: string;
    /** 显示剂量字符串（如 "12g"）；数值剂量请用 dosage_g / dosage_mg */
    dosage?: string;
    dosage_g?: number;
    /** 历史字段名：GA 系列数值即克（不再 /1000），归一化层按克处理 */
    dosage_mg?: number;
    role?: string;
  }>;
  synergy_score?: number;
  patent_synergy_scores?: PatentSynergyScores;
  peptide_candidates?: { name: string; sequence: string }[];
  safety_passed?: boolean;
  /**
   * 安全合规三态裁定（ADR-046 L5）。由 api/ai.ts deriveSafetyVerdict 唯一推导：
   * passed（绿）/ needs_attention（黄）/ unverified（灰虚线，未校验）。
   * UI 必须按此渲染，禁止由 safety_score 反推绿色「安全合规」。
   */
  safety_verdict?: SafetyVerdict;
  /** 归一化层（api/ai.ts normalizeGenerateCandidate）补充的安全性得分（0-1；null/缺失=未校验，不补0） */
  safety_score?: number;
  /** 成本/功效得分（后端 /ai/generate 主端点返回，归一化层透传保留） */
  cost_score?: number;
  efficacy_score?: number;
  safety_details?: { warnings: string[]; contraindications: string[]; summary: string };
  taste_score?: number;
  stability_score?: number;
  overall_score?: number;
  /** 部分评估服务失败时为 true（降级标志，UI 应明示「部分评估暂不可用」，禁止伪造默认分） */
  degraded?: boolean;
  generated_by?: string;
  generated_at?: string;
  description?: string;
  /**
   * 后端 L4 机理阐释（阶段2续 `/ai/generate` 每候选招带，normalizeGenerateCandidate
   * 经 `...c` spread 透传保留）。含 explanation（方解与机理主文本）、mechanisms
   * （逐药材成分→靶点网络药理）、synergy（配伍协同）等；degraded=true 表示机理生成降级。
   * 方解面板应优先消费此字段（后端现成机理），无则回退 interpretFormula / explanation。
   */
  mechanism?: {
    explanation?: string;
    constitution?: string;
    mechanisms?: Array<{
      herb?: string;
      effects?: string;
      compounds?: string[];
      targets?: string[];
      diseases?: string[];
      note?: string;
    }>;
    synergy?: string;
    safety?: Record<string, unknown>;
    usage?: Record<string, unknown>;
    monitoring?: Array<Record<string, unknown>>;
    disclaimer?: string;
    degraded?: boolean;
  };
  algorithm_info?: {
    strategy: string;
    generation: number;
    evaluations: number;
    convergence_generation: number;
  };
  explanation?: {
    formula_name: string;
    structure_analysis: string;
    mechanism_explanation: string;
    synergistic_analysis: string;
    suitable_population: string;
    contraindications: string;
    usage_instructions: string;
    monitoring_suggestions: string;
  };
  /**
   * 知识库 RAG 检索证据（响应级，归一化层 normalizeGenerateResponse 透传到每个候选）。
   * 缺失时 UI 显示「暂无知识库证据」占位，不报错。
   */
  rag_evidence?: RAGEvidence;

  // ── 模型管理域字段（合并自原 types/index.ts AICandidate；配方生成域通常不使用）──
  provider?: string;
  model?: string;
  version?: string;
  capabilities?: string[];
  maxTokens?: number;
  costPerToken?: number;
  latencyMs?: number;
  accuracyScore?: number;
  safetyRating?: 'safe' | 'moderate' | 'risky' | 'unknown';
  isAvailable?: boolean;
  documentationUrl?: string;
  config?: Record<string, unknown>;
  target_population?: string;
  contraindications?: string;
  candidateId?: string;
}

export interface GenerationRecord {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  min_fitness: number;
  diversity: number;
}

/**
 * 遗传算法候选方案（前端统一使用归一化后的字段）。
 * 后端 genetic.py 实际返回 candidates[].herb_combination[{name,dosage_mg}] +
 * fitness/efficacy/safety/taste/cost，由 api/ai.ts 归一化为 ingredients/
 * efficacy_score/.../overall_score/confidence/explanation；原始字段保留便于调试/导出。
 */
export interface GeneticCandidate {
  ingredients: Array<{ id: string; name_cn: string; dosage: number }>;
  efficacy_score: number;
  safety_score: number;
  taste_score: number;
  cost_score: number;
  overall_score: number;
  confidence: number;
  explanation: string | null;
  milp_result?: MILPResult;
  nutrition_score?: number;
  nutrition_matrix?: Record<string, number>;
  // ── 后端原始字段（兼容实际响应，归一化时保留）──
  rank?: number;
  herb_combination?: Array<{
    name?: string;
    /** 后端 genetic 系列字段改名后的中文名 */
    name_cn?: string;
    id?: string;
    dosage_mg?: number;
    dosage?: string | number;
    dosage_g?: number;
    role?: string;
  }>;
  fitness?: number;
  efficacy?: number;
  safety?: number;
  taste?: number;
  cost?: number;
  /**
   * 后端 L4 机理阐释（`/ai/generate` 每候选招带，阶段2续接入）。
   * 含 explanation（方解与机理主文本）、mechanisms（逐药材成分→靶点网络药理）、
   * synergy（配伍协同）等；degraded=true 表示机理生成降级。
   * 由 normalizeGeneticCandidate 保留，供方解面板优先消费（无则回退 interpretFormula）。
   */
  mechanism?: {
    explanation?: string;
    constitution?: string;
    mechanisms?: Array<{
      herb?: string;
      effects?: string;
      compounds?: string[];
      targets?: string[];
      diseases?: string[];
      note?: string;
    }>;
    synergy?: string;
    safety?: Record<string, unknown>;
    usage?: Record<string, unknown>;
    monitoring?: Array<Record<string, unknown>>;
    disclaimer?: string;
    degraded?: boolean;
  };
}

export interface GeneticGenerateResponse {
  candidates: GeneticCandidate[];
  history: GenerationRecord[];
  algorithm: string;
  total_generations: number;
  total_evaluations: number;
  best_score: number;
  execution_time_ms?: number;
  convergence_generation?: number;
  hybrid_mode?: boolean;
  // ── 后端原始顶层字段 ──
  run_id?: string;
  total_candidates?: number;
  stop_reason?: string;
}

// ===== 多目标优化 =====

export interface MOObjective {
  name: string;
  key: string;
  direction: 'maximize' | 'minimize';
  weight: number;
  description?: string;
}

export interface MOParetoPoint {
  objective_values: Record<string, number>;
  rank: number;
  crowding_distance: number;
}

export interface MOCandidate {
  ingredients: Array<{ id: string; name_cn: string; dosage: number }>;
  objective_scores: Record<string, number>;
  overall_fitness: number;
  pareto_rank: number;
  crowding_distance: number;
  explanation: string | null;
  // ── 后端原始字段（兼容实际响应，归一化时保留）──
  rank?: number;
  herb_combination?: Array<{
    name?: string;
    /** 后端 genetic 系列字段改名后的中文名 */
    name_cn?: string;
    id?: string;
    dosage_mg?: number;
    dosage?: string | number;
    dosage_g?: number;
    role?: string;
  }>;
  scores?: Record<string, number>;
  fitness?: number;
  is_pareto_optimal?: boolean;
}

export interface MOBestByObjective {
  objective_key: string;
  objective_name: string;
  score: number;
  ingredients: Array<{ id: string; name_cn: string; dosage: number }>;
  explanation: string;
}

export interface MultiObjectiveResponse {
  candidates: Array<MOCandidate & {
    nutrition_score?: number;
    nutrition_matrix?: Record<string, number>;
    compliance_status?: 'compliant' | 'warning' | 'violation';
  }>;
  pareto_front?: MOParetoPoint[];
  best_by_objective?: MOBestByObjective[];
  history?: GenerationRecord[];
  algorithm?: string;
  mode?: string;
  objectives_config?: Array<{ name: string; key: string; direction: string; weight: number }>;
  nutrition_objectives?: NutritionObjectiveConfig[];
  total_generations: number;
  total_evaluations?: number;
  execution_time_ms?: number;
  convergence_generation?: number;
  stop_reason?: string;
  // ── 后端原始顶层字段 ──
  run_id?: string;
  total_candidates?: number;
  best_score?: number;
}

export interface MOPresetInfo {
  name: string;
  objectives: MOObjective[];
  mode: string;
  default_params: {
    population_size: number;
    generations: number;
    mutation_rate: number;
    crossover_rate: number;
  };
}

// ===== 安全检查 =====

export interface SafetyCheckResult {
  safe?: boolean;
  passed?: boolean;
  riskLevel?: 'safe' | 'caution' | 'danger' | 'contraindicated' | 'low' | 'medium' | 'high' | 'critical';
  checkedAt?: string;
  checkedBy?: string;
  summary?: string;
  errors?: string[];
  checks?: Record<string, { passed?: boolean }>;
  warnings: Array<{
    ingredient?: string;
    level?: 'info' | 'warning' | 'danger';
    code?: string;
    message: string;
    severity?: string;
    category?: string;
  }>;
  details?: Record<string, unknown>;
}

// ===== 口感预测 =====

export interface TastePredictionResponse {
  sweetness: number;
  bitterness: number;
  astringency: number;
  pungency?: number;
  saltiness?: number;
  overall_score: number;
  flavor_notes: string[];
}

// ===== 稳定性预测 =====

/**
 * 稳定性风险因子 —— 对齐后端 stability_model.py 的 `risk_factors`。
 * severity 是 0-1 数值（如 0.3 / 0.2 / 0.15），不是字符串。
 */
export interface StabilityRiskFactor {
  type: string;
  severity: number;
  description?: string;
}

/** 月度降解曲线点 —— 后端字段是 `remaining_pct`（0-1），不是 `stability`。 */
export interface StabilityMonthlyPoint {
  month: number;
  remaining_pct: number;
}

export interface StabilityShelfLifeDetails {
  months_to_90: number | null;
  months_to_80: number | null;
  predicted_months: number | null;
  confidence: number;
}

export interface StabilityPredictionResponse {
  /** 综合稳定性评分 [0, 1] */
  stability_score: number;
  estimated_shelf_life_months: number;
  risk_factors: StabilityRiskFactor[];
  monthly_curve: StabilityMonthlyPoint[];
  /** 后端返回 string[]，不是单个 string */
  storage_advice: string[];
  shelf_life_details?: StabilityShelfLifeDetails | null;
}

// ===== 肽序列分析 =====

export interface PeptideResult {
  sequence: string;
  molecular_weight: number;
  logp: number;
  tpsa: number;
  activity_scores: Record<string, number>;
  composite_score: number;
  smiles?: string;
  amino_acid_count: number;
  properties?: Record<string, unknown>;
}

export interface PeptideGenerateResponse {
  success: boolean;
  data: {
    peptides: PeptideResult[];
    total: number;
    generation_method: string;
    target_effects: string[];
    diversity_metrics: {
      diversity_score: number;
      unique_count: number;
      average_similarity: number;
    };
    generated_at: string;
    processing_time_ms: number;
  };
}

export interface OptimizedPeptide {
  sequence: string;
  scores: Record<string, number>;
  weighted_score: number;
  iteration_improved: number;
  improvement_over_seed: number;
  properties?: Record<string, unknown>;
  seed_sequence?: string;
}

export interface PeptideOptimizeResponse {
  success: boolean;
  data: {
    optimized_peptides: OptimizedPeptide[];
    total: number;
    optimization_goals: Record<string, number>;
    seed_count: number;
    iterations_performed: number;
    generated_at: string;
    processing_time_ms: number;
  };
}

export interface SampleResponse {
  success: boolean;
  data: {
    peptides: Array<{
      sequence: string;
      log_probability: number;
      smiles?: string;
      properties?: Record<string, unknown>;
      molecular_weight: number;
      amino_acid_count: number;
    }>;
    total: number;
    diversity_metrics: {
      diversity_score: number;
      unique_count: number;
      average_similarity: number;
      similarity_matrix: number[][];
    };
    sampling_parameters: {
      requested_size: number;
      actual_size: number;
      temperature: number | null;
      top_k: number | null;
      metric: string;
    };
    generated_at: string;
    processing_time_ms: number;
  };
}

export interface PepinventStatusResponse {
  service_name: string;
  version: string;
  available: boolean;
  initialized: boolean;
  simulation_mode: boolean;
  device: string;
  dependencies: {
    available: boolean;
    missing: string[];
    version_info: Record<string, string | null>;
  };
  config: Record<string, unknown>;
  cache_stats: {
    cache_size: number;
    cache_enabled: boolean;
  };
}

// ===== GA 历史 =====

export interface GAHistoryRecord {
  run_id: string;
  algorithm_type: string;
  mode: string;
  preset_name: string | null;
  target_effects: string[];
  best_fitness: number;
  candidate_count: number;
  total_generations: number;
  execution_time_ms: number;
  stop_reason: string;
  final_diversity: number;
  created_at: string;
}

export interface GADetailResponse {
  run: GAHistoryRecord & {
    algorithm_params: Record<string, unknown>;
    objectives_config: Array<{ name: string; key: string; direction: string; weight: number }>;
    constraints: Record<string, unknown> | null;
    history: GenerationRecord[];
    pareto_front: MOParetoPoint[];
    best_by_objective: MOBestByObjective[];
  };
  candidates: Array<{
    rank: number;
    pareto_rank: number;
    crowding_distance: number;
    ingredients: Array<{ id: string; name_cn: string; dosage: number }>;
    ingredient_count: number;
    total_dosage: number;
    efficacy_score: number;
    safety_score: number;
    taste_score: number;
    cost_score: number;
    synergy_score: number;
    stability_score: number;
    admet_score: number;
    overall_fitness: number;
    objective_scores: Record<string, number>;
    explanation: string | null;
  }>;
}

// ===== 肽数据库 =====

export interface PeptideAnalysisData {
  id: number;
  sequence: string;
  user_id: number;
  analysis_mode: 'quick' | 'deep' | 'custom';
  tags: string[];
  notes: string | null;
  peptide_id: number | null;
  created_at: string;
  updated_at: string;
  details: Array<{
    id: number;
    dimension_type: 'basic' | 'structure' | 'physicochemical' | 'bioactivity' | 'safety' | 'overall';
    data: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface BatchResult {
  success_count: number;
  failed_items: Array<{ index: number; error: string; sequence?: string }>;
}

// ===== 肽设计 =====

export interface PeptideDesignData {
  id: number;
  project_name: string;
  user_id: number;
  target_effects: string[];
  objective_weights: Record<string, number>;
  constraints: Record<string, unknown> | null;
  seed_sequence: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  version: number;
  parent_version_id: number | null;
  total_candidates: number;
  pareto_size: number;
  candidates: Array<{
    id: number;
    design_id: number;
    sequence: string;
    objectives_scores: Record<string, number>;
    rank: number;
    is_pareto_frontier: boolean;
    dominated_by_count: number;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface VersionInfo {
  version: number;
  status: string;
  config_snapshot: Record<string, unknown>;
  candidate_count: number;
  created_at: string;
  change_summary: string | null;
}

export interface ComparisonResult {
  v1_version: number;
  v2_version: number;
  config_changes: Record<string, unknown>;
  candidate_changes: Record<string, unknown>;
  summary: string;
}

// ===== 配置管理 =====

export interface ModelHealth {
  model: string;
  latency_ms: number;
  success_rate: number;
  error_count: number;
  uptime_percentage: number;
}

export interface RateLimitInfo {
  requests_per_minute: number;
  requests_used: number;
  requests_remaining: number;
  reset_at: string;
}

// ===== 统计卡片 =====

export interface AISummaryStats {
  chatCount: number;
  generateCount: number;
  safetyChecks: number;
  synergyCount: number;
  tasteCount: number;
  stabilityCount: number;
  peptideAnalyzeCount: number;
  peptideDesignCount: number;
  knowledgeDocCount: number;
  modelStatus: { llm: string; status: 'active' | 'inactive' };
}

// ===== 知识库 =====

export interface KnowledgeDoc {
  id: string;
  title: string;
  type: 'pdf' | 'txt' | 'md' | 'url';
  chunks_count: number;
  uploaded_at: string;
  last_indexed_at: string;
}

export interface KnowledgeChunk {
  id: string;
  doc_id: string;
  content: string;
  embedding_dimension: number;
  metadata: Record<string, unknown>;
}

// ===== 搜索 =====

export interface SearchResult {
  id: string;
  type: 'formula' | 'ingredient' | 'analysis' | 'experiment';
  title: string;
  snippet: string;
  score: number;
}

// ═══════════════════════════════════════════════
// MILP / Nutrition types (GA-LP Hybrid)
// ═══════════════════════════════════════════════

/** 营养约束 */
export interface NutritionConstraint {
  nutrient: string;        // "protein", "fat", "carbohydrate", "sodium", etc.
  min_value: number | null; // per 100g
  max_value: number | null;
  target_value?: number | null;
}

/** MILP求解结果 */
export interface MILPResult {
  feasible: boolean;
  ratios: Record<string, number>;    // {herb_id: dosage_g}
  min_cost: number;
  nutrition_matrix: Record<string, number>;  // {nutrient: value_per_100g}
  violation: Record<string, number>;  // {constraint_key: violation_amount}
  solve_time_ms: number;
  warm_start_used: boolean;
}

/** 营养偏差目标 */
export interface NutritionDeviationObjective {
  nutrient: string;
  target: number;       // 目标值 per 100g
  tolerance: number;    // 容忍度
  direction: 'maximize' | 'minimize' | 'target';
  weight: number;       // 权重
}

/** 扩展的遗传算法请求（支持MILP混合模式） */
export interface GeneticHybridRequest {
  target_effects: string[];
  population_size?: number;
  generations?: number;
  mutation_rate?: number;
  crossover_rate?: number;
  elite_ratio?: number;
  tournament_size?: number;
  count?: number;
  constraints?: Record<string, unknown>;
  // 新增：混合模式参数
  hybrid_mode?: boolean;           // 是否启用 BinaryGA+MILP 混合
  nutrition_constraints?: NutritionConstraint[];
  total_dosage?: number;           // 总剂量(g)
  warm_start_enabled?: boolean;    // 是否启用warm start
  max_ingredients?: number;        // 最大药材数
  min_ingredients?: number;        // 最小药材数
}

/**
 * 扩展的遗传算法响应（包含MILP结果）
 *
 * 后端 hybrid 实际返回 ga_candidates / mo_candidates / combined_results 汇总结构，
 * 前端由 api/ai.ts 归一化填充 candidates；原 MILP 字段（dosage_lp/milp_result/
 * nutrition_*）后端暂未返回，全部改为可选。
 */
export interface GeneticHybridResponse {
  candidates: Array<GeneticCandidate & {
    dosage_lp?: number;       // MILP精确配比（后端暂未返回）
    dosage_raw?: number;      // GA原始剂量
    difference?: number;      // 差异量
  }>;
  history?: Array<{
    generation: number;
    best_fitness: number;
    avg_fitness: number;
    min_fitness: number;
    diversity: number;
    constraint_satisfaction_rate?: number;  // 约束满足率
    milp_solve_time_ms?: number;
  }>;
  total_generations: number;
  total_evaluations?: number;
  best_score: number;
  execution_time_ms?: number;
  convergence_generation?: number;
  algorithm: string;
  hybrid_mode?: boolean;
  nutrition_constraints_met?: boolean;
  constraint_violations?: Record<string, number>;
  // ── 后端 hybrid 实际响应字段 ──
  ga_candidates?: number;
  ga_history_length?: number;
  mo_candidates?: number;
  mo_history_length?: number;
  combined_results?: Array<{
    type?: string;
    rank?: number;
    fitness?: number;
    herbs?: string[];
    scores?: Record<string, number>;
    herb_combination?: Array<{
      name?: string;
      /** 后端 genetic 系列字段改名后的中文名 */
      name_cn?: string;
      id?: string;
      dosage_mg?: number;
      dosage?: string | number;
      dosage_g?: number;
      role?: string;
    }>;
  }>;
}

/** 营养偏差目标配置（用于多目标优化） */
export interface NutritionObjectiveConfig {
  key: 'nutrition_balance' | 'nutrition_protein' | 'nutrition_fat' |
       'nutrition_carb' | 'nutrition_sodium' | 'nutrition_calcium' |
       'nutrition_iron' | 'nutrition_energy';
  name: string;
  direction: 'maximize' | 'minimize';
  weight: number;
  target_range?: [number, number];  // [min, max] per 100g
  description: string;
}

/** 扩展的多目标响应（包含营养维度） */
export interface MultiObjectiveEnhancedResponse extends MultiObjectiveResponse {
  nutrition_objectives?: NutritionObjectiveConfig[];
  candidates: Array<MultiObjectiveResponse['candidates'][0] & {
    nutrition_score?: number;
    nutrition_matrix?: Record<string, number>;
    compliance_status?: 'compliant' | 'warning' | 'violation';
    compliance_details?: Array<{
      standard: string;
      nutrient: string;
      value: number;
      limit: number;
      status: 'pass' | 'fail' | 'warn';
    }>;
  }>;
}
