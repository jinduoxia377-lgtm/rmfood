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

export interface AICandidate {
  id: string;
  name: string;
  ingredients: {
    name: string;
    dosage: string;
    unit: string;
    amount_mg?: number;
    dosage_g?: number;
  }[];
  score: number;
  effects: string[];
  formula_name?: string;
  herb_combination?: Array<{
    name?: string;
    dosage?: string;
    dosage_g?: number;
    role?: string;
  }>;
  synergy_score?: number;
  patent_synergy_scores?: PatentSynergyScores;
  peptide_candidates?: { name: string; sequence: string }[];
  safety_passed?: boolean;
  safety_details?: { warnings: string[]; contraindications: string[]; summary: string };
  taste_score?: number;
  stability_score?: number;
  overall_score?: number;
  generated_by?: string;
  generated_at?: string;
  description?: string;
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
}

export interface GenerationRecord {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  min_fitness: number;
  diversity: number;
}

export interface GeneticGenerateResponse {
  candidates: Array<{
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
  }>;
  history: GenerationRecord[];
  algorithm: string;
  total_generations: number;
  total_evaluations: number;
  best_score: number;
  execution_time_ms?: number;
  convergence_generation?: number;
  hybrid_mode?: boolean;
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
  pareto_front: MOParetoPoint[];
  best_by_objective: MOBestByObjective[];
  history: GenerationRecord[];
  algorithm: string;
  mode: string;
  objectives_config: Array<{ name: string; key: string; direction: string; weight: number }>;
  nutrition_objectives?: NutritionObjectiveConfig[];
  total_generations: number;
  total_evaluations: number;
  execution_time_ms: number;
  convergence_generation: number;
  stop_reason: string;
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

export interface StabilityPredictionResponse {
  stability_score: number;
  estimated_shelf_life_months: number;
  risk_factors: string[];
  monthly_curve: Array<{ month: number; stability: number }>;
  storage_advice: string;
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

/** 扩展的遗传算法响应（包含MILP结果） */
export interface GeneticHybridResponse {
  candidates: Array<{
    ingredients: Array<{
      id: string;
      name_cn: string;
      dosage: number;
      dosage_lp: number;       // MILP精确配比
      dosage_raw: number;      // GA原始剂量
      difference: number;      // 差异量
    }>;
    overall_score: number;
    efficacy_score: number;
    safety_score: number;
    taste_score: number;
    cost_score: number;
    confidence: number;
    explanation?: string;
    milp_result?: MILPResult;  // MILP精确求解结果
    nutrition_score?: number;  // 营养评分
    nutrition_matrix?: Record<string, number>;
  }>;
  history: Array<{
    generation: number;
    best_fitness: number;
    avg_fitness: number;
    min_fitness: number;
    diversity: number;
    constraint_satisfaction_rate?: number;  // 约束满足率
    milp_solve_time_ms?: number;
  }>;
  total_generations: number;
  total_evaluations: number;
  best_score: number;
  execution_time_ms: number;
  convergence_generation: number;
  algorithm: string;
  hybrid_mode: boolean;
  nutrition_constraints_met: boolean;
  constraint_violations?: Record<string, number>;
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
