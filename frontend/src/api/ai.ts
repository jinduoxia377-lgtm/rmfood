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
  GeneticCandidate,
  GenerationRecord,
  MultiObjectiveResponse,
  MOPresetInfo,
  MOParetoPoint,
  MOBestByObjective,
  NutritionObjectiveConfig,
  RAGEvidence,
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
  SafetyVerdict,
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
  GeneticCandidate,
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
  RAGEvidence,
} from '@/types/ai.api';

/** 高级优化生成响应（标准化 generator 值） */
export interface AdvancedGenerateResponse {
  candidates: AICandidate[];
  total: number;
  generator: string;
  execution_time_ms?: number;
  strategy?: string;
  best_score?: number;
  /** 知识库 RAG 检索证据（响应级；缺失时前端显示「暂无知识库证据」占位） */
  rag_evidence?: RAGEvidence;
  /**
   * 降级标志（响应级，ADR-046 L5）：true 表示本次结果由规则引擎兜底、未经 GA 优化，
   * UI 必须显示降级横幅，不得当作 GA 优化结果呈现。缺失/false = 正常路径。
   */
  degraded?: boolean;
  /** 降级原因（后端 fallback_reason 原文，供降级横幅展示具体原因） */
  fallback_reason?: string;
}

// ===== AI 配方校验 / 药材知识检索 =====

/** AI 配方校验成分输入 */
export interface AiFormulaValidationIngredient {
  name: string
  dosage_g?: number
}

/** AI 配方校验请求 */
export interface AiFormulaValidationRequest {
  formula_name?: string
  ingredients: AiFormulaValidationIngredient[]
  target_effects?: string[]
}

/** AI 配方校验预警项 */
export interface AiFormulaValidationAlert {
  level: 'info' | 'warning' | 'critical'
  ingredient?: string
  parameter?: string
  current_value?: number
  threshold_value?: number
  percentage?: number
  message: string
  recommendation?: string
  blocking?: boolean
}

/** AI 配方校验响应 */
export interface AiFormulaValidationResponse {
  /** 是否通过校验（后端返回字段） */
  valid?: boolean
  /** 是否被 CRITICAL 级别阻断 */
  blocked_by_critical: boolean
  /** 风险评分 0-100 */
  risk_score?: number
  /** 安全预警列表 */
  alerts: AiFormulaValidationAlert[]
  /** 成分级校验明细 */
  ingredients?: Array<Record<string, unknown>>
  /** 配伍兼容性问题（十八反/十九畏/CompatibilityChecker/过敏原） */
  compatibility_issues?: Array<{
    level?: string
    category?: string
    description?: string
    suggestion?: string
    affected_ingredients?: string[]
    source?: string
  }>
  /** 校验建议（追加到配方备注，【AI校验】前缀） */
  suggestions?: string[]
  recommendations?: string[]
  /** 非阻断性预警文本 */
  warnings?: string[]
  /** 阻断性错误文本 */
  errors?: string[]
  /** 目标功效匹配结果 */
  matched_effects?: Array<{ effect?: string; matched_in?: string }>
  /** 已检查成分数 */
  checked_ingredients_count?: number
  /** 兼容旧字段：是否安全（旧版后端/模拟响应） */
  is_safe?: boolean
}

/** AI 药材知识条目 */
export interface AiHerbKnowledgeItem {
  name_cn: string
  name_latin?: string
  name_en?: string
  aliases?: string[]
  effects?: string[]
  active_ingredients?: string[]
  safe_dose_range?: { min_g?: number | null; max_g?: number | null } | null
  contraindications?: string[]
  interactions?: string[]
  food_homology?: boolean
  data_quality?: number
  source?: string
}

/** AI 药材知识检索结果 */
export interface AiHerbKnowledgeResult {
  query: string
  total?: number
  items: AiHerbKnowledgeItem[]
}

/**
 * AI 配方保存前安全校验（超限/违禁成分检测）
 * POST /api/v1/ai/formula/validate
 */
export async function validateAiFormula(
  payload: AiFormulaValidationRequest,
): Promise<AiFormulaValidationResponse> {
  const res = await api.post<AiFormulaValidationResponse>('/ai/formula/validate', payload)
  return res.data
}

/**
 * AI 药材知识检索（药食同源信息/现代药理）
 * POST /api/v1/ai/formula/knowledge
 */
export async function retrieveHerbKnowledge(query: string): Promise<AiHerbKnowledgeResult> {
  const res = await api.post<AiHerbKnowledgeResult>('/ai/formula/knowledge', { query })
  return res.data
}

// ===== AI 结构化输出兜底（repair-structured）/ 反馈闭环（feedback） =====

/** 修复后的结构化内容 block（结构与一期 default.yaml 的 blocks 一致） */
export interface RepairStructuredBlock {
  type: string
  data: Record<string, unknown>
}

/** 修复后的结构化内容 */
export interface RepairStructuredContent {
  blocks: RepairStructuredBlock[]
}

/** POST /ai/formula/repair-structured 响应 */
export interface RepairStructuredResponse {
  /** 是否修复成功 */
  success: boolean
  /** 修复后的结构化 JSON；失败时为 null/缺失 */
  structured?: RepairStructuredContent | null
  /** 失败原因（LLM 不可用 / 解析失败等），成功时可能为空 */
  message?: string
}

/** 反馈指标复查条目（metric_updates 元素） */
export interface FormulaMetricUpdate {
  /** 指标名称（如 空腹血糖 / 甘油三酯） */
  metric_name?: string
  /** 调理前基线值 */
  baseline_value?: string | number | null
  /** 复查当前值 */
  current_value?: string | number | null
  /** 单位（mmol/L / mg/dL 等） */
  unit?: string
  /** 变化方向或状态描述 */
  status?: string
  /** 补充说明 */
  notes?: string
}

/** POST /ai/formula/feedback 请求 payload */
export interface FormulaFeedbackPayload {
  /** 配方 ID */
  formula_id: number
  /** 效果评分 1-5 */
  rating: number
  /** 症状变化文本 */
  symptom_change?: string
  /** 指标复查列表 */
  metric_updates?: FormulaMetricUpdate[]
  /** 备注 */
  notes?: string
}

/** POST /ai/formula/feedback 响应 */
export interface FormulaFeedbackSubmitResponse {
  success: boolean
  /** 新建反馈记录 ID（兼容约定字段） */
  feedback_id?: number
  /** 新建的反馈记录完整对象（task-5 后端实际返回字段） */
  feedback?: FormulaFeedbackItem
  message?: string
}

/** GET /ai/formula/{formula_id}/feedback 返回的历史反馈条目 */
export interface FormulaFeedbackItem {
  id?: number
  feedback_id?: number
  formula_id: number
  rating: number
  symptom_change?: string | null
  metric_updates?: FormulaMetricUpdate[] | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  user_id?: number
  organization_id?: number
}

/** GET /ai/formula/{formula_id}/feedback 响应 */
export interface FormulaFeedbackListResponse {
  formula_id?: number
  total?: number
  items: FormulaFeedbackItem[]
}

/**
 * 结构化输出兜底：将非结构化配方文本修复为 blocks 结构化 JSON
 * POST /api/v1/ai/formula/repair-structured
 */
export async function repairStructuredFormula(
  content: string,
  formula_name?: string,
): Promise<RepairStructuredResponse> {
  const res = await api.post<RepairStructuredResponse>('/ai/formula/repair-structured', {
    content,
    ...(formula_name ? { formula_name } : {}),
  })
  return res.data
}

/**
 * 提交配方效果反馈（评分/症状变化/指标复查/备注）
 * POST /api/v1/ai/formula/feedback
 */
export async function submitFormulaFeedback(
  payload: FormulaFeedbackPayload,
): Promise<FormulaFeedbackSubmitResponse> {
  const res = await api.post<FormulaFeedbackSubmitResponse>('/ai/formula/feedback', payload)
  return res.data
}

/**
 * 获取指定配方的历史反馈列表
 * GET /api/v1/ai/formula/{formula_id}/feedback
 */
export async function getFormulaFeedback(
  formulaId: number | string,
): Promise<FormulaFeedbackListResponse> {
  const res = await api.get<FormulaFeedbackListResponse>(`/ai/formula/${formulaId}/feedback`)
  return res.data
}

// ═══════════════════════════════════════════════
// 响应归一化适配（P0 前端响应契约）
//
// 后端 genetic / multi-objective / hybrid 实际返回：
//   candidates[].herb_combination[{name,dosage_mg}] + fitness/efficacy/safety/taste/cost
// 而前端类型与渲染期望：
//   candidates[].ingredients[{id,name_cn,dosage}] + overall_score/confidence/explanation
// 这些函数在 API 返回前将后端响应归一化为前端类型，保证字段不缺、不出现 NaN/undefined。
// ═══════════════════════════════════════════════

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * 将 herb_combination 的 dosage 字符串/数值统一换算为克（g）。
 *
 * ⚠️ 契约修正（task-4）：后端 genetic 系列端点历史上用 `dosage_mg` 字段名
 * 承载**克**数值（如 12 表示 12g，并非 12mg），因此数值型 dosage_mg 不再除以 1000。
 * 后端已同步将字段改名为 `dosage_g`，此处同时兼容两种形态：
 *   - dosage_mg 数值 → 按克直接使用（不再 /1000）
 *   - dosage_g 数值 → 按克直接使用
 *   - dosage 数值/字符串 → 按克解析；仅字符串显式携带 "mg" 单位时做 /1000 换算。
 */
function parseDosageGrams(item: UnknownRecord): number {
  const dosageMg = item.dosage_mg
  // 数值型 dosage_mg 实际是克（GA 系列字段名历史遗留），直接使用，不再 /1000
  if (typeof dosageMg === 'number' && Number.isFinite(dosageMg)) return dosageMg
  const dosageG = item.dosage_g
  if (typeof dosageG === 'number' && Number.isFinite(dosageG)) return dosageG
  const dosage = item.dosage
  if (typeof dosage === 'number' && Number.isFinite(dosage)) return dosage
  if (typeof dosage === 'string') {
    const match = dosage.match(/-?\d+(\.\d+)?/)
    if (match) {
      const val = parseFloat(match[0])
      // 兼容 "500mg" / "10.0g" / "10 克" 等字符串；"mg" 后缀字符串仍按毫克换算
      if (/mg/i.test(dosage)) return val / 1000
      return val
    }
  }
  return 0
}

/** 归一化 ingredients：兼容后端 herb_combination[{name,name_cn,dosage_mg,dosage_g}] 与前端已有 ingredients。 */
export function normalizeIngredients(value: unknown): GeneticCandidate['ingredients'] {
  if (!Array.isArray(value)) return []
  const result: GeneticCandidate['ingredients'] = []
  value.forEach((raw, index) => {
    const item = asRecord(raw)
    const name =
      (typeof item.name_cn === 'string' && item.name_cn ? item.name_cn : '') ||
      (typeof item.name === 'string' && item.name ? item.name : '') ||
      (typeof item.id === 'string' ? item.id : '')
    const id = (typeof item.id === 'string' && item.id ? item.id : '') || name || `herb_${index}`
    result.push({
      id,
      name_cn: name || '未知药材',
      dosage: parseDosageGrams(item),
    })
  })
  return result
}

/** 基于综合评分估算置信度（0.5 ~ 0.95），避免缺省 0.8 与评分脱节。 */
export function estimateConfidence(overallScore: number): number {
  const base = 0.5 + overallScore * 0.4
  return Math.round(Math.min(0.95, Math.max(0.5, base)) * 100) / 100
}

/** 生成缺省中文说明（不伪造具体功效数据）。 */
export function buildDefaultExplanation(
  overallScore: number,
  ingredientNames: string[],
  sourceLabel: string,
): string {
  const names = ingredientNames.length > 0 ? ingredientNames.join('、') : '（后端未返回成分明细）'
  return (
    `${sourceLabel}自动优化生成的候选配方，综合评分 ${overallScore.toFixed(4)}，药材组成：${names}。` +
    '本结果由算法计算得出，仅供参考，建议在专业人员指导下使用。'
  )
}

export interface GeneticCandidateNormalizeOptions {
  defaultConfidence?: number
  explanationPrefix?: string
}

/** 归一化单个 GA 候选方案：herb_combination → ingredients，fitness → overall_score。 */
export function normalizeGeneticCandidate(
  rawCandidate: unknown,
  options: GeneticCandidateNormalizeOptions = {},
): GeneticCandidate {
  const c = asRecord(rawCandidate)

  const ingredients: GeneticCandidate['ingredients'] = Array.isArray(c.ingredients)
    ? (c.ingredients as unknown[]).map((raw, idx) => {
        const item = asRecord(raw)
        const name =
          (typeof item.name_cn === 'string' && item.name_cn ? item.name_cn : '') ||
          (typeof item.name === 'string' && item.name ? item.name : '') ||
          (typeof item.id === 'string' ? item.id : '')
        const id = (typeof item.id === 'string' && item.id ? item.id : '') || name || `herb_${idx}`
        return { id, name_cn: name || '未知药材', dosage: toFiniteNumber(item.dosage, 0) }
      })
    : normalizeIngredients(c.herb_combination)

  const fitness = toFiniteNumber(c.fitness, 0)
  const efficacy = toFiniteNumber(c.efficacy, 0)
  const safety = toFiniteNumber(c.safety, 0)
  const taste = toFiniteNumber(c.taste, 0)
  const cost = toFiniteNumber(c.cost, 0)

  const overallScore = toFiniteNumber(c.overall_score, fitness)
  const confidence = toFiniteNumber(
    c.confidence,
    options.defaultConfidence ?? estimateConfidence(overallScore),
  )
  const explanation =
    toStringOrNull(c.explanation) ??
    buildDefaultExplanation(
      overallScore,
      ingredients.map((i) => i.name_cn),
      options.explanationPrefix ?? '遗传算法',
    )

  return {
    ingredients,
    efficacy_score: toFiniteNumber(c.efficacy_score, efficacy),
    safety_score: toFiniteNumber(c.safety_score, safety),
    taste_score: toFiniteNumber(c.taste_score, taste),
    cost_score: toFiniteNumber(c.cost_score, cost),
    overall_score: overallScore,
    confidence,
    explanation,
    milp_result: c.milp_result as GeneticCandidate['milp_result'],
    nutrition_score: typeof c.nutrition_score === 'number' ? c.nutrition_score : undefined,
    nutrition_matrix:
      typeof c.nutrition_matrix === 'object' && c.nutrition_matrix !== null
        ? (c.nutrition_matrix as Record<string, number>)
        : undefined,
    // 保留后端原始字段，便于调试/导出
    rank: typeof c.rank === 'number' ? c.rank : undefined,
    herb_combination: Array.isArray(c.herb_combination)
      ? (c.herb_combination as GeneticCandidate['herb_combination'])
      : undefined,
    fitness: typeof c.fitness === 'number' ? c.fitness : undefined,
    efficacy: typeof c.efficacy === 'number' ? c.efficacy : undefined,
    safety: typeof c.safety === 'number' ? c.safety : undefined,
    taste: typeof c.taste === 'number' ? c.taste : undefined,
    cost: typeof c.cost === 'number' ? c.cost : undefined,
    // 保留后端 L4 机理阐释（阶段2续接入），供方解面板优先消费
    mechanism:
      typeof c.mechanism === 'object' && c.mechanism !== null
        ? (c.mechanism as GeneticCandidate['mechanism'])
        : undefined,
  }
}

/** 归一化遗传算法响应。 */
export function normalizeGeneticResponse(rawData: unknown): GeneticGenerateResponse {
  const data = asRecord(rawData)
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : []
  const candidates = rawCandidates.map((c) => normalizeGeneticCandidate(c))
  const history = Array.isArray(data.history) ? (data.history as GenerationRecord[]) : []
  const maxCandidateScore = candidates.reduce((max, c) => Math.max(max, c.overall_score), 0)

  return {
    candidates,
    history,
    algorithm: typeof data.algorithm === 'string' ? data.algorithm : 'genetic_algorithm',
    total_generations: toFiniteNumber(data.total_generations, history.length),
    total_evaluations: toFiniteNumber(data.total_evaluations, 0),
    best_score: toFiniteNumber(data.best_score, maxCandidateScore),
    execution_time_ms: typeof data.execution_time_ms === 'number' ? data.execution_time_ms : undefined,
    convergence_generation:
      typeof data.convergence_generation === 'number' ? data.convergence_generation : undefined,
    hybrid_mode: typeof data.hybrid_mode === 'boolean' ? data.hybrid_mode : undefined,
    run_id: typeof data.run_id === 'string' ? data.run_id : undefined,
    total_candidates: typeof data.total_candidates === 'number' ? data.total_candidates : undefined,
    stop_reason: typeof data.stop_reason === 'string' ? data.stop_reason : undefined,
  }
}

/** 归一化单个多目标优化候选方案。 */
export function normalizeMOCandidate(rawCandidate: unknown): MultiObjectiveResponse['candidates'][0] {
  const c = asRecord(rawCandidate)

  const ingredients: MultiObjectiveResponse['candidates'][0]['ingredients'] = Array.isArray(
    c.ingredients,
  )
    ? (c.ingredients as unknown[]).map((raw, idx) => {
        const item = asRecord(raw)
        const name =
          (typeof item.name_cn === 'string' && item.name_cn ? item.name_cn : '') ||
          (typeof item.name === 'string' && item.name ? item.name : '') ||
          (typeof item.id === 'string' ? item.id : '')
        const id = (typeof item.id === 'string' && item.id ? item.id : '') || name || `herb_${idx}`
        return { id, name_cn: name || '未知药材', dosage: toFiniteNumber(item.dosage, 0) }
      })
    : normalizeIngredients(c.herb_combination)

  const rawScores =
    typeof c.objective_scores === 'object' && c.objective_scores !== null
      ? (c.objective_scores as UnknownRecord)
      : typeof c.scores === 'object' && c.scores !== null
        ? (c.scores as UnknownRecord)
        : {}
  const objectiveScores: Record<string, number> = {}
  Object.entries(rawScores).forEach(([key, value]) => {
    objectiveScores[key] = toFiniteNumber(value, 0)
  })

  const fitness = toFiniteNumber(c.fitness, 0)
  const overallFitness = toFiniteNumber(c.overall_fitness, fitness)
  const paretoRank = toFiniteNumber(c.pareto_rank, 1)
  const crowdingDistance = toFiniteNumber(c.crowding_distance, 0)
  const explanation =
    toStringOrNull(c.explanation) ??
    buildDefaultExplanation(overallFitness, ingredients.map((i) => i.name_cn), '多目标优化')

  const complianceStatus = c.compliance_status
  const isKnownComplianceStatus =
    complianceStatus === 'compliant' || complianceStatus === 'warning' || complianceStatus === 'violation'

  return {
    ingredients,
    objective_scores: objectiveScores,
    overall_fitness: overallFitness,
    pareto_rank: paretoRank,
    crowding_distance: crowdingDistance,
    explanation,
    nutrition_score: typeof c.nutrition_score === 'number' ? c.nutrition_score : undefined,
    nutrition_matrix:
      typeof c.nutrition_matrix === 'object' && c.nutrition_matrix !== null
        ? (c.nutrition_matrix as Record<string, number>)
        : undefined,
    compliance_status: isKnownComplianceStatus
      ? (complianceStatus as MultiObjectiveResponse['candidates'][0]['compliance_status'])
      : undefined,
    // 保留后端原始字段
    rank: typeof c.rank === 'number' ? c.rank : undefined,
    herb_combination: Array.isArray(c.herb_combination)
      ? (c.herb_combination as MultiObjectiveResponse['candidates'][0]['herb_combination'])
      : undefined,
    scores: typeof c.scores === 'object' && c.scores !== null ? (c.scores as Record<string, number>) : undefined,
    fitness: typeof c.fitness === 'number' ? c.fitness : undefined,
    is_pareto_optimal: typeof c.is_pareto_optimal === 'boolean' ? c.is_pareto_optimal : undefined,
  }
}

export interface MOMormalizeOptions {
  /** 调用方传入的优化目标，用于在缺失 objectives_config 时构建配置。 */
  objectives?: Array<{ name?: string; key: string; direction?: string; weight?: number }>
}

/** 归一化多目标优化响应。 */
export function normalizeMultiObjectiveResponse(
  rawData: unknown,
  options: MOMormalizeOptions = {},
): MultiObjectiveResponse {
  const data = asRecord(rawData)
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : []
  const candidates = rawCandidates.map((c) => normalizeMOCandidate(c))
  const history = Array.isArray(data.history) ? (data.history as GenerationRecord[]) : []

  // objectives_config：优先后端返回 → 其次调用方传入 objectives → 最后从候选 scores 键推导
  let objectivesConfig: MultiObjectiveResponse['objectives_config']
  if (Array.isArray(data.objectives_config)) {
    objectivesConfig = (data.objectives_config as unknown[]).map((o) => {
      const rec = asRecord(o)
      return {
        name: typeof rec.name === 'string' ? rec.name : typeof rec.key === 'string' ? rec.key : '',
        key: typeof rec.key === 'string' ? rec.key : '',
        direction: typeof rec.direction === 'string' ? rec.direction : 'maximize',
        weight: toFiniteNumber(rec.weight, 1),
      }
    })
  } else if (options.objectives && options.objectives.length > 0) {
    objectivesConfig = options.objectives.map((o) => ({
      name: o.name ?? o.key,
      key: o.key,
      direction: o.direction ?? 'maximize',
      weight: o.weight ?? 1,
    }))
  } else if (candidates.length > 0) {
    objectivesConfig = Object.keys(candidates[0].objective_scores).map((key) => ({
      name: key,
      key,
      direction: 'maximize',
      weight: 1,
    }))
  } else {
    objectivesConfig = []
  }

  const paretoFront: MOParetoPoint[] = Array.isArray(data.pareto_front)
    ? (data.pareto_front as MOParetoPoint[])
    : candidates.map((c) => ({
        objective_values: c.objective_scores,
        rank: c.pareto_rank,
        crowding_distance: c.crowding_distance,
      }))

  const bestByObjective: MOBestByObjective[] = Array.isArray(data.best_by_objective)
    ? (data.best_by_objective as MOBestByObjective[])
    : []

  return {
    candidates,
    pareto_front: paretoFront,
    best_by_objective: bestByObjective,
    history,
    algorithm: typeof data.algorithm === 'string' ? data.algorithm : 'nsga2_genetic_algorithm',
    mode: typeof data.mode === 'string' ? data.mode : 'pareto',
    objectives_config: objectivesConfig,
    nutrition_objectives: Array.isArray(data.nutrition_objectives)
      ? (data.nutrition_objectives as NutritionObjectiveConfig[])
      : undefined,
    total_generations: toFiniteNumber(data.total_generations, history.length),
    total_evaluations: typeof data.total_evaluations === 'number' ? data.total_evaluations : undefined,
    execution_time_ms: typeof data.execution_time_ms === 'number' ? data.execution_time_ms : undefined,
    convergence_generation:
      typeof data.convergence_generation === 'number' ? data.convergence_generation : undefined,
    stop_reason: typeof data.stop_reason === 'string' ? data.stop_reason : 'completed',
    run_id: typeof data.run_id === 'string' ? data.run_id : undefined,
    total_candidates: typeof data.total_candidates === 'number' ? data.total_candidates : undefined,
    best_score: typeof data.best_score === 'number' ? data.best_score : undefined,
  }
}

/** 归一化 GA+MILP 混合优化响应（兼容后端 ga_candidates/mo_candidates/combined_results）。 */
export function normalizeGeneticHybridResponse(rawData: unknown): GeneticHybridResponse {
  const data = asRecord(rawData)
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : []
  const combinedResults = Array.isArray(data.combined_results)
    ? (data.combined_results as UnknownRecord[])
    : []

  let candidates: GeneticHybridResponse['candidates']
  if (rawCandidates.length > 0) {
    candidates = rawCandidates.map((c) =>
      normalizeGeneticCandidate(c, { explanationPrefix: 'GA+MILP混合优化' }),
    )
  } else if (combinedResults.length > 0) {
    // 后端非流式 hybrid 仅返回汇总（fitness + herbs 代码列表，无剂量明细）。
    // 诚实降级：不伪造剂量；药材代码写入 explanation，成分区由前端显示“暂无成分数据”。
    candidates = combinedResults.map((r) => {
      const herbs = Array.isArray(r.herbs)
        ? (r.herbs as unknown[]).filter((h): h is string => typeof h === 'string')
        : []
      const fitness = toFiniteNumber(r.fitness, 0)
      const herbCombination = Array.isArray(r.herb_combination)
        ? (r.herb_combination as GeneticCandidate['herb_combination'])
        : undefined
      const ingredients = herbCombination ? normalizeIngredients(herbCombination) : []
      const explanation = herbCombination
        ? buildDefaultExplanation(fitness, ingredients.map((i) => i.name_cn), 'GA+MILP混合优化')
        : `混合优化汇总方案（来源：${typeof r.type === 'string' ? r.type : 'unknown'}，排名 ${
            toFiniteNumber(r.rank, 0)
          }）。` +
          (herbs.length > 0 ? `药材代码：${herbs.join('、')}（后端未返回剂量明细）。` : '后端未返回成分明细。') +
          '本结果由算法计算得出，仅供参考。'

      return {
        ingredients,
        efficacy_score: fitness,
        safety_score: fitness,
        taste_score: fitness,
        cost_score: fitness,
        overall_score: fitness,
        confidence: estimateConfidence(fitness),
        explanation,
        rank: typeof r.rank === 'number' ? r.rank : undefined,
        herb_combination: herbCombination,
        fitness: typeof r.fitness === 'number' ? r.fitness : undefined,
      }
    })
  } else {
    candidates = []
  }

  const maxCandidateScore = candidates.reduce((max, c) => Math.max(max, c.overall_score), 0)
  const history = Array.isArray(data.history)
    ? (data.history as GeneticHybridResponse['history'])
    : []
  const gaHistoryLength = toFiniteNumber(data.ga_history_length, 0)
  const moHistoryLength = toFiniteNumber(data.mo_history_length, 0)

  return {
    candidates,
    history,
    total_generations: toFiniteNumber(
      data.total_generations,
      Math.max(gaHistoryLength, moHistoryLength),
    ),
    total_evaluations: typeof data.total_evaluations === 'number' ? data.total_evaluations : undefined,
    best_score: toFiniteNumber(data.best_score, maxCandidateScore),
    execution_time_ms: typeof data.execution_time_ms === 'number' ? data.execution_time_ms : undefined,
    convergence_generation:
      typeof data.convergence_generation === 'number' ? data.convergence_generation : undefined,
    algorithm: typeof data.algorithm === 'string' ? data.algorithm : 'genetic_hybrid',
    hybrid_mode: typeof data.hybrid_mode === 'boolean' ? data.hybrid_mode : true,
    nutrition_constraints_met:
      typeof data.nutrition_constraints_met === 'boolean' ? data.nutrition_constraints_met : undefined,
    constraint_violations:
      typeof data.constraint_violations === 'object' && data.constraint_violations !== null
        ? (data.constraint_violations as Record<string, number>)
        : undefined,
    ga_candidates: typeof data.ga_candidates === 'number' ? data.ga_candidates : undefined,
    ga_history_length:
      typeof data.ga_history_length === 'number' ? data.ga_history_length : undefined,
    mo_candidates: typeof data.mo_candidates === 'number' ? data.mo_candidates : undefined,
    mo_history_length:
      typeof data.mo_history_length === 'number' ? data.mo_history_length : undefined,
    combined_results: Array.isArray(data.combined_results)
      ? (data.combined_results as GeneticHybridResponse['combined_results'])
      : undefined,
  }
}

/** 归一化统一优化响应：兼容 GA / MO / hybrid 三种实际返回结构。 */
export function normalizeUnifiedOptimizeResponse(rawData: unknown): GeneticGenerateResponse {
  const data = asRecord(rawData)
  // hybrid 汇总结构（无 candidates 数组）→ 先转 hybrid 再映射为 GA 响应
  if (!Array.isArray(data.candidates) && Array.isArray(data.combined_results)) {
    const hybrid = normalizeGeneticHybridResponse(rawData)
    return {
      candidates: hybrid.candidates,
      history: hybrid.history ?? [],
      algorithm: hybrid.algorithm,
      total_generations: hybrid.total_generations,
      total_evaluations: hybrid.total_evaluations ?? 0,
      best_score: hybrid.best_score,
      execution_time_ms: hybrid.execution_time_ms,
      convergence_generation: hybrid.convergence_generation,
      hybrid_mode: hybrid.hybrid_mode,
    }
  }
  return normalizeGeneticResponse(rawData)
}

// ═══════════════════════════════════════════════
// 安全合规三态（ADR-046 L5 可信呈现层）
//
// 硬约束原则「不向用户传递未经证实的信任」：
//   1. 信任必须有来源 —— 禁止由 safety_score 反推 safety_passed；无裁定 = 灰态「未校验」。
//   2. 后端唯一可信裁定来源：safety_verdict.status（pass/needs_attention/rejected/unverified），
//      或显式 boolean safety_passed。二者皆无 → unverified。
// SafetyVerdict / SafetyVerdictStatus 类型定义在 types/ai.api.ts（避免循环导入），此处再导出。
// ═══════════════════════════════════════════════

export type { SafetyVerdict, SafetyVerdictStatus } from '@/types/ai.api'

/** 安全合规裁定（含来源，供 UI 区分绿/黄/灰三态并标注信任来源） */
/**
 * 唯一的安全合规裁定推导函数（全前端禁另有 safety_passed 反推逻辑）。
 *
 * 推导优先级（信任必须有来源）：
 *   1. raw.safety_verdict.status 存在 → 按后端裁定映射三态（source='backend_verdict'）
 *   2. 否则 raw.safety_passed 为显式 boolean → 采信（source='explicit_flag'）
 *   3. 皆无 → unverified（source='none'），**绝不**用 safety_score 反推
 *
 * 后端 status → 前端三态映射：
 *   pass            → passed（绿）
 *   needs_attention → needs_attention（黄）
 *   rejected        → needs_attention（黄，附 violations 原因）
 *   unverified      → unverified（灰虚线）
 */
export function deriveSafetyVerdict(raw: unknown): SafetyVerdict {
  const c = asRecord(raw)
  const verdict = asRecord(c.safety_verdict)

  // 1) 后端安全闸门裁定（最高可信来源）
  const status = typeof verdict.status === 'string' ? verdict.status : undefined
  if (status) {
    const violations = Array.isArray(verdict.violations)
      ? (verdict.violations as unknown[]).filter((v): v is string => typeof v === 'string')
      : []
    const warnings = Array.isArray(verdict.warnings)
      ? (verdict.warnings as unknown[]).filter((w): w is string => typeof w === 'string')
      : []
    const reason =
      violations[0] ??
      warnings[0] ??
      (typeof verdict.summary === 'string' && verdict.summary ? verdict.summary : undefined)

    switch (status) {
      case 'pass':
        return { status: 'passed', source: 'backend_verdict', violations, warnings }
      case 'needs_attention':
        return { status: 'needs_attention', source: 'backend_verdict', reason, violations, warnings }
      case 'rejected':
        return {
          status: 'needs_attention',
          source: 'backend_verdict',
          reason: reason ?? '未通过安全合规校验',
          violations,
          warnings,
        }
      case 'unverified':
      default:
        return { status: 'unverified', source: 'backend_verdict', violations, warnings }
    }
  }

  // 2) 后端显式 boolean safety_passed（无 verdict 对象时的次级可信来源）
  if (typeof c.safety_passed === 'boolean') {
    return c.safety_passed
      ? { status: 'passed', source: 'explicit_flag' }
      : { status: 'needs_attention', source: 'explicit_flag' }
  }

  // 3) 皆无 → 灰态「未校验」。绝不由 safety_score 反推。
  return { status: 'unverified', source: 'none' }
}

/**
 * 归一化 /ai/generate 主端点返回的单个候选。
 *
 * 后端 _format_ga_candidates / _fallback_rule_engine 实际返回：
 *   { id, formula_name, name, herb_combination:[{name,dosage,role}], synergy_score,
 *     taste_score, stability_score, safety_score(null=未校验), cost_score, efficacy_score,
 *     overall_score, effects, safety_passed, safety_verdict, generated_by, generated_at }
 * 而前端 AICandidate 类型与渲染期望 ingredients/score/safety_passed。
 * 此处补齐：
 *   - score           = overall_score（缺失时回退 0）
 *   - safety_passed   = 由 deriveSafetyVerdict 唯一推导（有裁定用裁定；仅显式 boolean 则采信；皆无→undefined）
 *   - safety_verdict  = deriveSafetyVerdict 结果（三态 + 来源，UI 据此渲染绿/黄/灰）
 *   - ingredients     = herb_combination 映射（兼容后端新字段 name_cn / dosage_g）
 * 后端原始字段（herb_combination / overall_score / *_score）保留透传，便于调试/导出。
 */
export function normalizeGenerateCandidate(rawCandidate: unknown, index = 0): AICandidate {
  const c = asRecord(rawCandidate)

  const herbCombination = Array.isArray(c.herb_combination)
    ? (c.herb_combination as NonNullable<AICandidate['herb_combination']>)
    : undefined

  const overallScore = toFiniteNumber(c.overall_score, 0)
  // 原则4「缺失即缺失」：safety_score 为 null/缺失表示「未校验」，不补 0（0 会伪装成「已校验且极差」）。
  const safetyScore =
    typeof c.safety_score === 'number' && Number.isFinite(c.safety_score) ? c.safety_score : undefined
  // 安全合规三态：唯一推导入口（禁 safety_score 反推）。safety_passed 同步由裁定推导，
  // 无裁定（unverified）时为 undefined，UI 显示灰态「未校验」而非绿色「安全合规」。
  const safetyVerdict = deriveSafetyVerdict(c)
  const derivedSafetyPassed: boolean | undefined =
    safetyVerdict.status === 'passed'
      ? true
      : safetyVerdict.status === 'needs_attention'
        ? false
        : undefined

  // 已有 ingredients 直接透传；否则从 herb_combination 映射为 AICandidate.ingredients 形态
  let ingredients: AICandidate['ingredients']
  if (Array.isArray(c.ingredients) && c.ingredients.length > 0) {
    ingredients = (c.ingredients as unknown[]).map((raw) => {
      const item = asRecord(raw)
      const dosageNum = toFiniteNumber(item.dosage_g ?? item.dosage, 0)
      return {
        name:
          (typeof item.name === 'string' && item.name ? item.name : '') ||
          (typeof item.name_cn === 'string' && item.name_cn ? item.name_cn : '') ||
          '未知药材',
        dosage:
          (typeof item.dosage === 'string' && item.dosage ? item.dosage : '') ||
          (dosageNum > 0 ? `${dosageNum}g` : ''),
        unit: (typeof item.unit === 'string' && item.unit ? item.unit : '') || 'g',
        dosage_g: typeof item.dosage_g === 'number' ? item.dosage_g : undefined,
        amount_mg: typeof item.amount_mg === 'number' ? item.amount_mg : undefined,
      }
    })
  } else if (herbCombination && herbCombination.length > 0) {
    ingredients = herbCombination.map((h) => {
      const dosageG =
        h.dosage_g ??
        (typeof h.dosage_mg === 'number' && Number.isFinite(h.dosage_mg)
          ? h.dosage_mg
          : undefined) ??
        (typeof h.dosage === 'number' && Number.isFinite(h.dosage) ? h.dosage : undefined)
      const dosageStr =
        (typeof h.dosage === 'string' && h.dosage ? h.dosage : '') ||
        (typeof dosageG === 'number' && Number.isFinite(dosageG) ? `${dosageG}g` : '')
      return {
        name:
          (typeof h.name_cn === 'string' && h.name_cn ? h.name_cn : '') ||
          (typeof h.name === 'string' && h.name ? h.name : '') ||
          '未知药材',
        dosage: dosageStr,
        unit: 'g',
        dosage_g: typeof dosageG === 'number' ? dosageG : undefined,
      }
    })
  }

  const id = (typeof c.id === 'string' && c.id ? c.id : '') || `candidate_${index}_${Date.now()}`
  const name =
    (typeof c.name === 'string' && c.name ? c.name : '') ||
    (typeof c.formula_name === 'string' && c.formula_name ? c.formula_name : '') ||
    `配方方案${index + 1}`

  const effects = Array.isArray(c.effects) ? (c.effects as string[]) : []

  return {
    ...(c as unknown as AICandidate),
    id,
    name,
    ingredients,
    score: toFiniteNumber(c.score, overallScore),
    effects,
    formula_name: typeof c.formula_name === 'string' ? c.formula_name : undefined,
    herb_combination: herbCombination,
    safety_passed: derivedSafetyPassed,
    safety_verdict: safetyVerdict,
    overall_score: overallScore,
    safety_score: safetyScore,
    synergy_score: typeof c.synergy_score === 'number' ? c.synergy_score : undefined,
    taste_score: typeof c.taste_score === 'number' ? c.taste_score : undefined,
    stability_score: typeof c.stability_score === 'number' ? c.stability_score : undefined,
    cost_score: typeof c.cost_score === 'number' ? c.cost_score : undefined,
    efficacy_score: typeof c.efficacy_score === 'number' ? c.efficacy_score : undefined,
    generated_by: typeof c.generated_by === 'string' ? c.generated_by : undefined,
    generated_at: typeof c.generated_at === 'string' ? c.generated_at : undefined,
  }
}

/** 归一化 /ai/generate 主端点响应。 */
export function normalizeGenerateResponse(rawData: unknown): AdvancedGenerateResponse {
  const data = asRecord(rawData)
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : []
  const ragEvidence = (data.rag_evidence ?? undefined) as RAGEvidence | undefined
  // P1：响应级 rag_evidence 透传到每个候选（FormulaResultsPro 只持有 generateResult，
  // 从候选读取；同时保留到响应级便于 AdvancedGeneratePanel 直接消费）
  const candidates = rawCandidates.map((c, i) => {
    const candidate = normalizeGenerateCandidate(c, i)
    if (ragEvidence) candidate.rag_evidence = ragEvidence
    return candidate
  })
  return {
    candidates,
    total: typeof data.total === 'number' ? data.total : candidates.length,
    generator: typeof data.generator === 'string' ? data.generator : 'rule_engine',
    execution_time_ms: typeof data.execution_time_ms === 'number' ? data.execution_time_ms : undefined,
    strategy: typeof data.strategy === 'string' ? data.strategy : undefined,
    best_score: typeof data.best_score === 'number' ? data.best_score : undefined,
    rag_evidence: ragEvidence,
    // 原则2「降级必须可见」：degraded/fallback_reason 全链路透传（api→hook→store→UI），
    // 兜底结果不得被当作 GA 优化结果静默呈现。
    degraded: typeof data.degraded === 'boolean' ? data.degraded : undefined,
    fallback_reason: typeof data.fallback_reason === 'string' ? data.fallback_reason : undefined,
  }
}

export const aiApi = {
  /** AI 配方保存前安全校验（超限/违禁成分检测） */
  validateAiFormula,
  /** AI 药材知识检索（药食同源信息/现代药理） */
  retrieveHerbKnowledge,
  /** 结构化输出兜底：将非结构化配方文本修复为 blocks 结构化 JSON */
  repairStructuredFormula,
  /** 提交配方效果反馈（评分/症状变化/指标复查/备注） */
  submitFormulaFeedback,
  /** 获取指定配方的历史反馈列表 */
  getFormulaFeedback,
  /** AI 配方生成（支持 LLM 模式，自动路由到遗传算法引擎） */
  generate: async (
    targetEffects: string[],
    constraints?: Record<string, unknown>,
    useLlm = false,
    signal?: AbortSignal,
    algorithmConfig?: Record<string, unknown>,
  ) => {
    // 后端 /ai/generate（generation_v2.FormulaGenerateRequest）只接受顶层
    // target_effects / constraints / use_llm：算法参数（population_size、
    // generations、mutation_rate、crossover_rate、total_dosage_g 等）与个人约束
    // 合并为单层 constraints，避免 constraints:{..., constraints:{...}} 双层嵌套。
    const mergedConstraints: Record<string, unknown> = {
      ...(constraints ?? {}),
      ...(algorithmConfig ?? {}),
    }
    const result = await api.post<AdvancedGenerateResponse>('/ai/generate', {
      target_effects: targetEffects,
      constraints: mergedConstraints,
      use_llm: useLlm,
      description: targetEffects.length > 0
        ? `基于${targetEffects.join('、')}功效需求，生成中药配方方案`
        : undefined,
    }, { timeout: 120000, signal });
    // P1 契约适配：后端主端点返回 herb_combination + overall_score（无 score/
    // safety_passed/ingredients），归一化补齐这三个字段（参考 normalizeGeneticCandidate），
    // 使排序/安全统计/学术报告等组件不再拿到 undefined。
    return normalizeGenerateResponse(result.data);
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
    // P0 契约适配：后端返回 herb_combination + fitness，归一化为前端类型
    return normalizeGeneticResponse(res.data);
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
    // P0 契约适配：后端返回 herb_combination + scores + fitness，归一化为前端类型
    return normalizeMultiObjectiveResponse(res.data, { objectives: params.objectives });
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
    // P0 契约适配：后端 hybrid 实际返回 ga_candidates/mo_candidates/combined_results
    return normalizeGeneticHybridResponse(res.data);
  },

  // 统一优化调度器（后端将新增 /ai/generate/unified）
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
  ): Promise<GeneticGenerateResponse> => {
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
    // P0 契约适配：统一优化可能返回 GA / MO / hybrid 任一结构，统一归一化
    return normalizeUnifiedOptimizeResponse(res.data);
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
