/**
 * 配方深度集成模块 - TypeScript 类型定义
 *
 * 定义所有与协同配方设计相关的数据结构
 */

import type { Formula, FormulaStatus } from './index';

export type { Formula, FormulaStatus };

// ==================== 协同效应分析 ====================

export interface SynergyAnalysisRequest {
  ingredient_a: string;
  ingredient_b: string;
  context?: Record<string, any>;
}

export interface SynergyMechanismScore {
  mechanism_type: 'bliss_independence' | 'pk_interaction' | 'gibbs_stability' | 'network_pharmacology' | 'taste_matrix';
  score: number;
  confidence: number;
  parameters?: Record<string, number>;
}

export interface SynergyAnalysisResponse {
  success: boolean;
  ingredient_pair: string;
  overall_si: number;
  mechanisms: Record<string, number>;
  dominant_mechanism: string | null;
  confidence: number;
  timestamp: string;
}

// ==================== 配比优化 ====================

export interface IngredientConfig {
  name: string;
  min_ratio: number;
  max_ratio: number;
  cost_per_gram: number;
  efficacy_base?: number;
  safety_score?: number;
  stability_score?: number;
}

export interface RatioOptimizationRequest {
  ingredients: IngredientConfig[];
  constraints?: {
    target_efficacy?: number;
    safety_threshold?: number;
    max_cost?: number;
  };
  population_size?: number;
  max_generations?: number;
}

export interface OptimizationSolution {
  ratios: Record<string, number>;
  objectives: {
    efficacy: number;
    safety: number;
    stability: number;
    cost: number;
  };
  pareto_rank: number;
  recommendation_reason: string;
}

export interface RatioOptimizationResponse {
  success: boolean;
  formula_id: string;
  pareto_solutions: OptimizationSolution[];
  best_solution: OptimizationSolution | null;
  computation_time_ms: number;
  solution_count: number;
  diversity_metric: number;
}

// ==================== 兼容性检测 ====================

export interface CompatibilityCheckRequest {
  ingredients: {
    name: string;
    amount_mg: number;
    percentage: number;
  }[];
  target_population?: 'adult' | 'pregnant' | 'children' | 'elderly';
  formula_id?: string;
}

export interface CompatibilityIssue {
  level: 'error' | 'warning' | 'info';
  category: 'chemical' | 'pharmacological' | 'nutritional' | 'regulatory';
  description: string;
  scientific_basis: string;
  suggestion: string;
  affected_ingredients: string[];
  severity_score: number;
}

export interface CompatibilityCheckResponse {
  success: boolean;
  overall_score: number;
  issues: CompatibilityIssue[];
  passed_checks: number;
  total_checks: number;
  recommendations: string[];
  error_count: number;
  warning_count: number;
  info_count: number;
}

// ==================== 效果预测 ====================

export interface EffectPredictionTimePoint {
  time_hour: number;
  concentration: number;
  effect_level: number;
  confidence_interval: [number, number];
}

export interface EffectPredictionRequest {
  formula_ingredients: {
    name: string;
    amount_mg: number;
    percentage: number;
  }[];
  body_weight_kg?: number;
  simulation_hours?: number;
  time_points?: number;
}

export interface EffectPredictionResponse {
  success: boolean;
  formula_id: string;
  peak_time: number;
  peak_concentration: number;
  max_effect: number;
  effect_duration: number;
  optimal_window: [number, number];
  visualization_data: {
    chart_type: string;
    series: {
      name: string;
      data: { time: number; value: number }[];
      unit: string;
      color: string;
    }[];
    markers: {
      time: number;
      label: string;
      type: string;
    }[];
    key_metrics: Record<string, any>;
    confidence_band: {
      upper: number[];
      lower: number[];
    };
  };
  auc: number;
}

// ==================== 安全检查 ====================

export interface SafetyCheckRequest {
  ingredients: {
    name: string;
    amount_mg: number;
    percentage: number;
  }[];
  daily_dosage_g?: number;
  usage_scenario?: 'supplement' | 'food' | 'medical';
  target_group?: 'adult' | 'pregnant' | 'children' | 'elderly';
}

export interface SafetyAlert {
  level: 'info' | 'warning' | 'critical';
  ingredient_name: string;
  parameter: string;
  current_value: number;
  threshold_value: number;
  percentage: number;
  message: string;
  recommendation: string;
  blocking: boolean;
}

export interface SafetyCheckResponse {
  is_safe: boolean;
  overall_risk_score: number;
  alerts: SafetyAlert[];
  checked_parameters: number;
  blocked_by_critical: boolean;
  recommendations: string[];
}

// ==================== 增强配方生成 (完整管线) ====================

export interface DeepGenerationRequest {
  ingredients: {
    name: string;
    amount_mg: number;
    percentage: number;
    min_ratio?: number;
    max_ratio?: number;
    cost_per_gram?: number;
  }[];
  mode?: 'standard' | 'deep_integration';
  target_efficacy?: number;
  safety_priority?: boolean;
  cost_constraint?: number;
  target_population?: string;
  use_caching?: boolean;
}

export interface DeepGenerationResponse {
  success: boolean;
  formula_id: string;
  optimized_ratios: Record<string, number>;
  synergy_summary?: {
    overall_si: number | null;
    dominant_mechanism: string | null;
  };
  optimization_summary?: {
    solution_count: number;
    computation_time: number;
    diversity: number;
  };
  compatibility_summary?: {
    score: number | null;
    issues_count: number;
  };
  effect_prediction_summary?: {
    tmax: number | null;
    emax: number | null;
    duration: number | null;
  };
  safety_check_summary?: {
    is_safe: boolean | null;
    risk_score: number | null;
    alerts_count: number;
  };
  recommendations: string[];
  generation_time_ms: number;
  mode_used: string;
  cache_hit: boolean;
}

// ==================== WebSocket 消息类型 ====================

export interface OptimizationProgressMessage {
  type: 'connected' | 'started' | 'iteration' | 'complete' | 'error' | 'ping' | 'pong';
  client_id?: string;
  task_id?: string;
  message?: string;
  generation?: number;
  total_generations?: number;
  progress_percent?: number;
  best_fitness?: number;
  timestamp?: string;
}

// ==================== 实验室验证相关类型 ====================

export interface LabValidationUploadRequest {
  experiment_id: string;
  formula_id: string;
  data_type: 'pk_data' | 'pd_data' | 'efficacy' | 'safety' | 'sensory';
  raw_data: Record<string, any>[];
  metadata: {
    lab_name: string;
    researcher: string;
    test_date: string;
    instrument_info?: string;
    protocol_version?: string;
    notes?: string;
  };
}

export interface LabValidationResponse {
  success: boolean;
  validation_id: string;
  data_points_count: number;
  validation_summary: {
    r_squared: number;
    rmse: number;
    mae: number;
    bias_percent: number;
    bland_altman_loa_upper: number;
    bland_altman_loa_lower: number;
    within_agreement_rate: number;
  };
  detailed_comparison: {
    parameter: string;
    predicted_value: number;
    measured_value: number;
    deviation_percent: number;
    is_within_acceptable_range: boolean;
    confidence_level: string;
  }[];
  recommendations: string[];
  quality_score: number;
}

export interface ValidationReportConfig {
  format: 'pdf' | 'html' | 'markdown';
  include_raw_data: boolean;
  include_charts: boolean;
  language: 'zh-CN' | 'en-US';
  template_style: 'academic' | 'industry' | 'regulatory';
}

// ==================== 管理员配置相关类型 ====================

export interface SafetyThresholdRecord {
  id: number;
  threshold_name: string;
  category: 'adi' | 'ul' | 'special_population' | 'regulatory';
  ingredient_name: string;
  unit: string;
  soft_limit: number;
  hard_limit: number;
  reference_source: string;
  effective_from: string;
  version: number;
  is_active: boolean;
}

export interface ThresholdUpdateRequest {
  threshold_name: string;
  soft_limit?: number;
  hard_limit?: number;
  reference_source?: string;
  effective_from?: string;
  reason_for_change: string;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: { status: string; latency_ms: number };
    cache: { status: string; hit_rate: number };
    optimization_engine: { status: string; queue_length: number };
    websocket: { status: string; active_connections: number };
  };
  uptime_seconds: number;
  last_error?: string;
}

// ==================== 配方历史与版本管理类型 ====================

export interface FormulaHistoryEntry {
  id: string;
  formula_id: string;
  version: number;
  change_type: 'create' | 'update_ratio' | 'update_ingredients' | 'optimize' | 'validate';
  changed_by: string;
  change_timestamp: string;
  changes_description: string;
  previous_state_snapshot?: Record<string, any>;
  new_state_snapshot: Record<string, any>;
}

export interface FormulaVersionCompareResult {
  base_version: FormulaHistoryEntry;
  compare_version: FormulaHistoryEntry;
  differences: {
    field: string;
    old_value: any;
    new_value: any;
    change_type: 'added' | 'removed' | 'modified';
  }[];
  impact_analysis: {
    efficacy_impact: 'positive' | 'negative' | 'neutral';
    safety_impact: 'improved' | 'degraded' | 'unchanged';
    cost_impact: 'increased' | 'decreased' | 'same';
  };
}

// ==================== 导入导出相关类型 ====================

export interface FormulaImportRequest {
  file: File;
  mode: 'all' | 'valid_only' | 'skip_errors';
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    defaultStatus?: FormulaStatus;
  };
}

export interface FormulaImportResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: ImportErrorItem[];
}

export interface ImportErrorItem {
  row: number;
  field?: string;
  reason: string;
  severity: 'error' | 'warning';
  data?: Record<string, unknown>;
}

export interface FormulaExportRequest {
  format: 'excel' | 'csv' | 'pdf';
  scope: 'current_page' | 'filtered' | 'all' | 'selected';
  ids?: string[];
  includeIngredients?: boolean;
  includeSteps?: boolean;
  includeAnalysis?: boolean;
}

export interface FormulaExportOptions {
  filename?: string;
  sheetName?: string;
  template?: 'standard' | 'detailed' | 'minimal';
}

// ==================== 操作日志相关类型 ====================

export interface OperationLog {
  id: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  action: OperationAction;
  target_type: 'formula' | 'ingredient' | 'template' | 'system';
  target_id: string;
  target_name: string;
  details: OperationLogDetail;
  result: 'success' | 'failure' | 'partial';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export type OperationAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'approve'
  | 'reject'
  | 'archive'
  | 'restore'
  | 'rollback'
  | 'permission_change'
  | 'batch_operation'
  | 'undo_delete';

export interface OperationLogDetail {
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  error_message?: string;
  duration_ms?: number;
}

export interface OperationLogQueryParams {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
  operator_id?: string;
  action?: OperationAction;
  target_type?: string;
  result?: 'success' | 'failure' | 'partial';
  sort_field?: 'created_at' | 'action' | 'operator_name';
  sort_order?: 'asc' | 'desc';
}

// ==================== 权限相关类型 ====================

export enum FormulaPermission {
  VIEW = 'formula:view',
  CREATE = 'formula:create',
  EDIT = 'formula:edit',
  DELETE = 'formula:delete',
  EXPORT = 'formula:export',
  AUDIT = 'formula:audit',
  MANAGE = 'formula:manage',
  IMPORT = 'formula:import',
}

export type RolePermissionMap = Record<string, FormulaPermission[]>;

// ==================== 验证错误类型 ====================

export interface FieldValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
}

export type ValidationErrorCode =
  | 'REQUIRED'
  | 'INVALID_FORMAT'
  | 'OUT_OF_RANGE'
  | 'SUM_NOT_100'
  | 'DUPLICATE_NAME'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'INVALID_CHARACTERS'
  | 'CUSTOM_RULE_FAILED';

export interface FormulaValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  warnings: FieldValidationError[];
}

// ==================== 筛选/排序/分页类型 ====================

export interface FormulaListQueryParams {
  page: number;
  page_size: number;
  search?: string;
  status?: FormulaStatus[];
  created_start?: string;
  created_end?: string;
  updated_start?: string;
  updated_end?: string;
  tags?: string[];
  category?: string;
  effect_category?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  sort_field2?: string;
  sort_order2?: 'asc' | 'desc';
  creator_id?: string;
}

export interface FormulaListResponse {
  items: Formula[];
  total: number;
  page: number;
  page_size: number;
  total_pages?: number;
}

// ==================== 版本管理相关类型 ====================

export interface FormulaVersion {
  id: string;
  formula_id: string;
  version_number: number;
  version_label: string;
  change_summary: string;
  changed_by: string;
  changed_by_name: string;
  snapshot: Record<string, unknown>;
  created_at: string;
  is_current: boolean;
}

export interface VersionDiffResult {
  version_a: FormulaVersion;
  version_b: FormulaVersion;
  changes: {
    path: string;
    old_value: unknown;
    new_value: unknown;
    change_type: 'added' | 'removed' | 'modified';
  }[];
  summary: {
    added_count: number;
    removed_count: number;
    modified_count: number;
  };
}

// ==================== 统计数据类型 ====================

export interface FormulaStatistics {
  total_formulas: number;
  status_distribution: Record<FormulaStatus, number>;
  category_distribution: Record<string, number>;
  recent_creations: { date: string; count: number }[];
  recent_updates: { date: string; count: number }[];
  top_creators: { name: string; count: number }[];
  approval_stats: {
    pending: number;
    approved: number;
    rejected: number;
  };
  trend_data: {
    period: string;
    created: number;
    updated: number;
    deleted: number;
  }[];
}

// ==================== CRUD Payload 类型 ====================

export interface FormulaCreatePayload {
  name: string;
  description?: string;
  category?: string;
  status?: FormulaStatus;
  tags?: string[];
  ingredients?: {
    id?: string;
    name: string;
    amount: number;
    unit: string;
    percentage: number;
    role?: string;
  }[];
  process_steps?: {
    step_number: number;
    description: string;
    temperature?: { min: number; max: number; unit: string };
    duration?: { value: number; unit: string };
    equipment?: string;
  }[];
  effects?: string[];
  dosage?: string;
  processing_method?: string;
  storage_conditions?: string;
  shelf_life?: number;
  composition?: Record<string, unknown>;
  category_ids?: number[];
  tag_ids?: number[];
  version_notes?: string;
  original_updated_at?: string;
  force?: boolean;
  estimated_cost?: number;
  production_time?: string;
  notes?: string;
}

// ==================== 多算法融合优化 ====================

export type AlgorithmType = 'nsga3' | 'moead' | 'pso' | 'sa';

export type FusionMethod = 'union' | 'weighted' | 'voting';

export interface MultiAlgorithmRequest {
  ingredients: Array<{ name: string; efficacy?: number; safety?: number }>;
  algorithms?: AlgorithmType[];
  fusion_method?: FusionMethod;
  time_budget?: number;
  constraints?: Record<string, any>;
}

export interface AlgorithmIndividualResult {
  algorithm: AlgorithmType;
  pareto_frontier: Array<{
    efficacy: number;
    safety: number;
    stability: number;
    cost: number;
    ingredients: Record<string, number>;
  }>;
  convergence_score: number;
  diversity_score: number;
  computation_time: number;
  success: boolean;
  error_message?: string;
}

export interface MultiAlgorithmResponse {
  success: boolean;
  fusion_method: FusionMethod;
  total_solutions: number;
  computation_time: number;
  best_solution: {
    efficacy: number;
    safety: number;
    stability: number;
    cost: number;
    ingredients: Record<string, number>;
  } | null;
  pareto_frontier: Array<{
    efficacy: number;
    safety: number;
    stability: number;
    cost: number;
    ingredients: Record<string, number>;
  }>;
  algorithms_used: number;
  algorithm_stats: {
    total_algorithms: number;
    successful_algorithms: number;
    total_solutions_found: number;
    average_convergence: number;
    average_diversity: number;
  };
}
