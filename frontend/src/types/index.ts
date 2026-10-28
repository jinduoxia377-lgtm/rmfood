/**
 * RMFOOD 核心业务类型定义
 *
 * 提供精确的TypeScript接口，替代项目中的 `any` 类型。
 * 覆盖：用户、配方、肽分析、AI响应等核心实体。
 *
 * 使用示例：
 * ```typescript
 * import type { User, Formula, PeptideAnalysisResult } from '@/types';
 *
 * const user: User = await api.getCurrentUser();
 * const formulas: Formula[] = await api.listFormulas();
 * ```
 */

// ════════════════════════════════════════════
// 1. 用户与权限
// ════════════════════════════════════════════

export interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;

  // 订阅计划（用户级，Phase 1：'free' | 'pro'；缺省 'free'）
  plan: 'free' | 'pro';

  // 角色与权限
  role: UserRole;
  isActive: boolean;
  department?: string;
  phone?: string;

  // 个人资料扩展字段（设置页「账户」模块）
  position?: string;
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;

  // 安全信息
  lastLoginAt?: string; // ISO 8601
  loginAttempts: number;
  lockedUntil?: string | null;

  // 偏好设置
  preferences?: UserPreferences;

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  GUEST = 'guest',
  RESEARCHER = 'researcher',
  FORMULATOR = 'formulator',
  REVIEWER = 'reviewer',
}

export interface UserPreferences {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  dashboardLayout?: DashboardLayoutConfig;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  categories: {
    system: boolean;
    collaboration: boolean;
    aiComplete: boolean;
    deadline: boolean;
  };
}

export interface DashboardLayoutConfig {
  widgets: WidgetConfig[];
  columns: number;
}

export interface WidgetConfig {
  id: string;
  type: 'chart' | 'list' | 'stat' | 'table';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
}

// ════════════════════════════════════════════
// 2. 配方 (Formula)
// ════════════════════════════════════════════

export interface Formula {
  id: number;
  name: string;
  description?: string;
  version: number;

  // 分类
  category?: FormulaCategory;
  tags?: string[];
  status: FormulaStatus;

  // 配方内容
  ingredients: { id: number; name: string; name_cn?: string; category?: string; source?: string; is_food_homology?: boolean; properties?: Record<string, any> }[];
  processSteps?: ProcessStep[];

  // 目标指标
  targetEffects?: TargetEffect[] | string[];
  nutritionalInfo?: NutritionalInfo;

  // 成本与效率
  estimatedCost?: number;
  productionTime?: string;

  // 关联数据
  creatorId?: number;
  creator?: User;
  projectId?: number;
  experimentIds?: number[];

  // AI优化建议
  aiSuggestions?: AISuggestion[];

  // 审批流程
  approvalStatus?: ApprovalStatus;
  approvedBy?: number;
  approvedAt?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;

  // 扩展字段（API 响应中可能存在的额外属性）
  composition?: Record<string, unknown>;
  safety_check?: Record<string, unknown>;
  synergy_analysis?: Record<string, unknown>;
  dosage?: string;
  processing_method?: string;
  storage_conditions?: string;
  shelf_life?: number;
  notes?: string;
  code?: string;
  reviewer_id?: number;
  reviewed_at?: string;
  review_notes?: string;
  creator_name?: string;
  categories?: { id: number }[]; // 多分类支持
  // Recipe params (camelCase aliases)
  processingMethod?: string;
  storageConditions?: string;
  shelfLife?: number;
  // API 兼容别名（snake_case）
  created_at?: string;
  updated_at?: string;
  target_effects?: string[];
}

export enum FormulaCategory {
  FUNCTIONAL_FOOD = 'functional_food', // 功能性食品
  DIETARY_SUPPLEMENT = 'dietary_supplement', // 膳食补充剂
  BEVERAGE = 'beverage', // 饮品
  SNACK = 'snack', // 零食
  TCM_FORMULA = 'tcm_formula', // 中药配方
  SPORTS_NUTRITION = 'sports_nutrition', // 运动营养
  CLINICAL_NUTRITION = 'clinical_nutrition', // 临床营养
  OTHER = 'other',
}

export enum FormulaStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated',
  CANCELLED = 'cancelled',
}

export interface IngredientItem {
  id: number;
  ingredientId: number;
  name: string;
  chineseName?: string;
  amount: number;
  unit: string;
  percentage: number; // 百分比
  source?: string; // 来源（如TCMSP）
  qualityGrade?: string;
  notes?: string;
}

export interface ProcessStep {
  stepNumber: number;
  description: string;
  temperature?: { min: number; max: number; unit: string };
  duration?: { value: number; unit: string };
  equipment?: string;
  criticalParameters?: CriticalParameter[];
}

export interface CriticalParameter {
  name: string;
  targetValue: number;
  tolerance: number; // ±范围
  unit: string;
}

export interface TargetEffect {
  effectName: string;
  expectedLevel: number; // 0-100
  evidenceLevel?: EvidenceLevel;
  references?: string[];
}

export enum EvidenceLevel {
  STRONG = 'strong',
  MODERATE = 'moderate',
  WEAK = 'weak',
  THEORETICAL = 'theoretical',
}

export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

export interface AISuggestion {
  type: 'optimization' | 'substitution' | 'new_ingredient';
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact?: {
    costChange?: number;
    efficacyImprovement?: number;
    safetyScore?: number;
  };
  confidence: number; // 0-1
}

// ════════════════════════════════════════════
// 3. 肽分析 (Peptide Analysis)
// ════════════════════════════════════════════

export interface PeptideAnalysisRecord {
  id: number;
  sequence: string;
  analysisMode: 'basic' | 'deep' | 'custom';

  // 分析结果
  details: AnalysisDimension[];

  // 元数据
  tags: string[];
  notes?: string;
  isPublic: boolean;

  // 关联
  createdBy: number;
  formulaId?: number;

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisDimension {
  id: number;
  dimensionType: DimensionType;
  data: any; // 根据dimensionType不同，结构不同
  confidence?: number;
  methodology?: string;
  version: string;
}

export enum DimensionType {
  BASIC = 'basic', // 基本性质
  STRUCTURE = 'structure', // 结构预测
  BIOACTIVITY = 'bioactivity', // 生物活性
  SAFETY = 'safety', // 安全性评估
  OVERALL = 'overall', // 综合评分
}

export interface BasicProperties {
  sequence: string;
  length: number;
  molecularWeight: number;
  theoreticalPI: number; // 等电点
  instabilityIndex: number; // 不稳定指数
  gravyHydropathyIndex: number; // 亲水性指数
  aliphaticIndex: number; // 脂肪族氨基酸指数
  bomanIndex: number; // Boman结合指数
  halfLife: {
    mammalian: string; // 哺乳动物网织红细胞
    yeast: string; // 酵母
    eColi: string; // 大肠杆菌
  };
  extinctionCoefficient: number;
  solubility: SolubilityPrediction;
  allergenicity: AllergenicityAssessment;
}

export interface SolubilityPrediction {
  predictedSolubility: 'high' | 'medium' | 'low';
  phOptimum: number;
  temperatureRange: { min: number; max: number };
  recommendations: string[];
}

export interface AllergenicityAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  potentialAllergens: string[];
  crossReactivityRisk: string;
}

export interface StructurePrediction {
  secondaryStructure: SecondaryStructureContent;
  tertiaryStructure?: TertiaryStructureModel;
  flexibility: FlexibilityAnalysis;
  disorderRegions: DisorderRegion[];
}

export interface SecondaryStructureContent {
  alphaHelix: percentage;
  betaSheet: percentage;
  betaTurn: percentage;
  coil: percentage;
  predictionMethod: string;
  confidence: number;
  sequenceAnnotation: string[]; // 每个残基的二级结构标注
}

export interface TertiaryStructureModel {
  pdbContent?: string;
  modelFormat: string;
  rmsd?: number; // 与实验结构的偏差
  tmScore?: number; // 模型质量评分
  validationReport?: string;
}

export interface FlexibilityAnalysis {
  averageBFactor: number;
  rigidRegions: Region[];
  flexibleRegions: Region[];
}

export interface Region {
  start: number;
  end: number;
  score: number;
  annotation: string;
}

export interface DisorderRegion {
  start: number;
  end: number;
  probability: number;
  type: 'intrinsically_disordered' | 'molten_globule';
}

export interface BioactivityPrediction {
  activities: PredictedActivity[];
  mechanismOfAction?: MechanismInsight;
  drugLikeness: DrugLikenessAssessment;
}

export interface PredictedActivity {
  activityType: ActivityType;
  probability: number;
  evidenceCount: number;
  keyResidues: number[];
  similarPeptides: SimilarPeptideSummary[];
  proposedMechanism?: string;
}

export enum ActivityType {
  ANTIOXIDANT = 'antioxidant',
  ANTI_HYPERTENSIVE = 'anti_hypertensive',
  ANTIMICROBIAL = 'antimicrobial',
  ANTI_INFLAMMATORY = 'anti_inflammatory',
  IMMUNOMODULATORY = 'immunomodulatory',
  OPIOID = 'opioid',
  ACE_INHIBITORY = 'ace_inhibitory',
  ALPHA_GLUCOSIDASE_INHIBITORY = 'alpha_glucosidase_inhibitory',
  OTHER = 'other',
}

export interface SimilarPeptideSummary {
  sequence: string;
  similarity: number;
  source: string;
  activity: string;
}

export interface MechanismInsight {
  primaryTarget: string;
  bindingAffinity?: number;
  pathwayInvolvement: string[];
  keyInteractions: MolecularInteraction[];
}

export interface MolecularInteraction {
  residue: number;
  interactionType: 'hydrogen_bond' | 'hydrophobic' | 'ionic' | 'pi_stacking';
  partner: string;
  distance?: number;
}

export interface DrugLikenessAssessment {
  lipinskiRuleCompliant: boolean;
  veberRuleCompliant: boolean;
  oralBioavailabilityScore: number;
  drugLikenessScore: number;
  warnings: string[];
}

export interface SafetyAssessment {
  toxicityProfile: ToxicityProfile;
  admetProperties: ADMETProperties;
  regulatoryStatus: RegulatoryInfo;
}

export interface ToxicityProfile {
  acuteToxicity: ToxicityLevel;
  chronicToxicity: ToxicityLevel;
  mutagenicity: RiskLevel;
  carcinogenicity: RiskLevel;
  organSpecificToxicity: OrganToxicity[];
}

export enum ToxicityLevel {
  SAFE = 'safe',
  LOW_RISK = 'low_risk',
  MODERATE_RISK = 'moderate_risk',
  HIGH_RISK = 'high_risk',
  UNKNOWN = 'unknown',
}

export enum RiskLevel {
  NEGLIGIBLE = 'negligible',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
}

export interface OrganToxicity {
  organ: string;
  level: ToxicityLevel;
  evidence: string;
  noObservedEffectLevel?: number;
}

export interface ADMETProperties {
  absorption: AbsorptionData;
  distribution: DistributionData;
  metabolism: MetabolismData;
  excretion: ExcretionData;
  toxicity: ToxicityData;
}

export interface AbsorptionData {
  caco2Permeability: 'high' | 'medium' | 'low';
  humanIntestinalAbsorption: percentage;
  bioavailability: percentage;
}

export interface DistributionData {
  volumeOfDistribution: string;
  plasmaProteinBinding: percentage;
  bloodBrainBarrierPenetration: 'yes' | 'no' | 'uncertain';
}

export interface MetabolismData {
  cyp450Substrates: string[];
  cyp450Inhibitors: string[];
  majorMetabolicPathway: string;
  halfLife: string;
}

export interface ExcretionData {
  renalClearance: string;
  hepaticClearance: string;
  excretionRoute: string[];
}

export interface ToxicityData {
  hERGInhibition: RiskLevel;
  hepatotoxicity: RiskLevel;
  drugDrugInteractions: DDIPrediction[];
}

export interface DDIPrediction {
  interactingDrug: string;
  severity: 'minor' | 'moderate' | 'major';
  mechanism: string;
  clinicalRecommendation: string;
}

export interface RegulatoryInfo {
  grasStatus: 'approved' | 'pending' | 'not_approved' | 'unknown';
  novelFoodApproval?: string;
  restrictions: string[];
  maximumDailyIntake?: number;
  unit?: string;
}

// ════════════════════════════════════════════
// 4. AI 响应
// ════════════════════════════════════════════

export interface AIResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  metadata: AIMetadata;
  usage?: TokenUsage;
}

export interface AIMetadata {
  model: string;
  provider: string;
  version: string;
  latencyMs: number;
  timestamp: string;
  requestId?: string;
  cacheHit: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD?: number;
}

export interface AIGenerationRequest {
  prompt: string;
  mode: 'formula_generation' | 'peptide_design' | 'analysis' | 'optimization';
  parameters: GenerationParameters;
  constraints?: UserConstraints;
  context?: GenerationContext;
}

export interface GenerationParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences?: string[];
}

export interface UserConstraints {
  budget?: { min: number; max: number; currency: string };
  allergens?: string[]; // 需要避免的过敏原
  dietaryRestrictions?: string[]; // 素食、无麸质等
  targetAudience?: string; // 儿童、老人、运动员等
  shelfLife?: number; // 保质期（月）
  flavorProfile?: string[]; // 口味偏好
  regulatoryRequirements?: string[]; // 合规要求
}

export interface GenerationContext {
  previousAttempts?: Formula[];
  referenceFormulas?: Formula[];
  userExpertiseLevel: 'beginner' | 'intermediate' | 'expert';
  projectGoal?: string;
}

// ════════════════════════════════════════════
// 5. API 通用类型
// ════════════════════════════════════════════

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  items?: T[];
  total?: number;
  pagination: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface APIError {
  success: false;
  error: ErrorDetail;
  timestamp: string;
  requestId?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  type: string;
  details?: Record<string, any>;
  suggestion?: string;
}

export interface SuccessResponse<T = void> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

// ════════════════════════════════════════════
// 6. 工具类型
// ════════════════════════════════════════════

type percentage = number; // 0-100

/** 可选的回调函数 */
// type AsyncCallback<T = void> = () => Promise<T>;

/** 表单字段验证状态 */
// interface FieldValidationState {
//   isValid: boolean;
//   errorMessage?: string;
//   isTouched: boolean;
//   isDirty: boolean;
// }

/** 排序配置 */
// interface SortConfig {
//   field: string;
//   direction: 'asc' | 'desc';
// }

/** 过滤器配置 */
// interface _FilterConfig {
//   field: string;
//   operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
//   value: any;
// }

/** 导出选项 */
// interface ExportOptions {
//   format: 'csv' | 'excel' | 'pdf' | 'json';
//   includeHeaders: boolean;
//   fields?: string[];
//   dateRange?: [string, string];
//   filters?: FilterConfig[];
// }

// ════════════════════════════════════════════
// 7. 认证与授权 (Authentication & Authorization)
// ════════════════════════════════════════════

export interface Token {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: Date;
  user?: User;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
  twoFactorCode?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface AuthResponse {
  success: boolean;
  data: Token;
  message?: string;
}

// ════════════════════════════════════════════
// 8. 分类管理 (Category Management)
// ════════════════════════════════════════════

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parentId?: number | null;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

// ════════════════════════════════════════════
// 9. 数据库实体 (Database Entities)
// ════════════════════════════════════════════

export interface TCMHerb {
  id: number;
  name: string;
  latinName?: string;
  pinyinName?: string;
  category?: string;
  nature?: string; // 药性（四气五味）
  meridian?: string; // 归经
  efficacy?: string; // 功效
  dosage?: string; // 用量
  contraindications?: string[]; // 禁忌
  toxicity?: string; // 毒性
  sourceDatabase?: string; // 来源数据库
  qualityGrade?: string; // 品质等级
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;

  // 兼容旧字段
  name_cn?: string;
  is_food_homology?: boolean;
  effects?: string;
}

/** SymMap 中药材知识图谱数据 */
export interface SymMapHerb {
  id: number;
  symmapId: number;
  nameCn: string;
  nameLatin?: string;
  namePinyin?: string;
  nameEng?: string;
  natureCn?: string; // 四气
  natureEng?: string;
  meridiansCn?: string; // 归经
  meridiansEng?: string;
  categoryCn?: string; // 分类
  categoryEng?: string;
  usePart?: string; // 药用部位
  tcmspId?: number; // 交叉引用 TCMSP ID
  tcmidId?: number; // 交叉引用 TCMID ID
  tcmid2Id?: number; // 交叉引用 TCM-ID ID
  herbdbId?: string; // 交叉引用 HERBDB ID
  alias?: string; // 别名
  sourceVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BioactivePeptide {
  id: number;
  sequence: string;
  name?: string;
  source?: string; // 来源
  length: number;
  molecularWeight?: number;
  isoelectricPoint?: number;
  hydrophobicity?: number;
  activityTypes?: string[];
  mechanismOfAction?: string;
  safetyProfile?: string;
  stability?: string;
  bioavailability?: number;
  halfLife?: string;
  clinicalTrials?: string[];
  references?: string[];
  createdAt: string;
  updatedAt: string;
  // Added for compatibility with PeptideDetailContent
  dfbp_id?: string;
  literature_doi?: string;
}

export interface KnowledgeNode {
  id: number;
  type: 'herb' | 'peptide' | 'compound' | 'target' | 'pathway' | 'disease';
  title: string;
  content?: string;
  metadata?: Record<string, any>;
  connections?: KnowledgeConnection[];
  confidence?: number;
  source?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeConnection {
  sourceId: number;
  targetId: number;
  relationType: 'interacts_with' | 'similar_to' | 'causes' | 'treats' | 'contains' | 'derived_from';
  strength?: number;
  evidence?: string;
}

// ════════════════════════════════════════════
// 10. 实验管理 (Experiment Management)
// ════════════════════════════════════════════

export interface Experiment {
  id: number;
  title: string;
  description?: string;
  type: ExperimentType;
  status: ExperimentStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';

  // 关联数据
  formulaId?: number;
  peptideIds?: number[];
  researcherIds?: number[];
  projectId?: number;

  // 实验配置
  parameters: ExperimentParameters;
  materials?: Array<{ name: string; quantity?: string; unit?: string }>;
  equipment?: Array<{ name: string; quantity?: string; unit?: string }>;
  expectedOutcomes?: string[];

  // 结果
  results?: ExperimentData[];
  conclusion?: string;
  attachments?: Attachment[];

  // 元数据
  createdBy: number;
  approvedBy?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;

  // API 兼容字段（后端 ExperimentResponse 返回 snake_case）
  code?: string;
  objectives?: string[];
  methodology?: string;
  recommendations?: string;
  conclusions?: string;
  start_date?: string;
  end_date?: string;
  actual_start?: string;
  actual_end?: string;
  formula_id?: number;
  formula_name?: string | null;
  researcher_id?: number;
  researcher_name?: string | null;
  created_at?: string;
  updated_at?: string;
  share_code?: string;
  view_count?: number;
}

export enum ExperimentType {
  FORMULATION = 'formulation',
  ANALYSIS = 'analysis',
  OPTIMIZATION = 'optimization',
  STABILITY = 'stability',
  TOXICITY = 'toxicity',
  CLINICAL = 'clinical',
  OTHER = 'other',
}

export enum ExperimentStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export interface ExperimentParameters {
  temperature?: { min: number; max: number; unit: string };
  ph?: { min: number; max: number };
  duration?: { value: number; unit: string };
  concentration?: { value: number; unit: string };
  sampleSize?: number;
  repetitions?: number;
  customParams?: Record<string, any>;
}

export interface ExperimentData {
  id: number;
  experimentId: number;
  measurementType: string;
  values: number[];
  unit: string;
  timestamp: string;
  notes?: string;
  isValidated: boolean;
  validatedBy?: number;
  attachments?: Attachment[];

  // API 兼容字段
  parameter?: string;
  value?: string | number | null;
  recorded_at?: string;
  created_at?: string;
  measurement_time?: string | null;
}

export interface Attachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
  uploadedBy: number;
}

// ════════════════════════════════════════════
// 11. AI 模型相关 (AI Model Related)
// ════════════════════════════════════════════

export interface AICandidate {
  id?: string;
  name?: string;
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
  config?: ModelConfiguration;

  // 配方分析扩展属性
  formula_name?: string;
  herb_combination?: { name: string; role: string; dosage: string }[];
  peptide_candidates?: any[];
  patent_synergy_scores?: any;
  synergy_score?: number;
  safety_passed?: boolean;
  safety_details?: { warnings: string[]; contraindications: string[]; summary: string };
  taste_score?: number;
  stability_score?: number;
  overall_score?: number;
  description?: string;
  target_population?: string;
  contraindications?: string;
  generated_at?: string;
  candidateId?: string;
  effects?: string[];
  ingredients?: { name: string; dosage: string; unit: string; amount_mg?: number }[];
  score?: number;
}

export interface ModelConfiguration {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences?: string[];
  customParams?: Record<string, any>;
}

export interface SafetyCheckResult {
  passed?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | 'safe' | 'caution' | 'danger' | 'contraindicated';
  summary?: string;
  errors?: string[];
  warnings?: {
    ingredient?: string;
    level?: 'info' | 'warning' | 'danger';
    code?: string;
    message: string;
    severity?: string;
    category?: string;
  }[];
  recommendations?: string[];
  checks?: Record<string, { passed?: boolean }>;
  checkedAt?: string;
  checkedBy?: string;
}

export interface SafetyWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'content_policy' | 'harmful_content' | 'pii' | 'medical_advice' | 'other';
  details?: Record<string, any>;
}

export interface SynergyResult {
  synergyScore?: number; // 0-100
  synergyType?: 'additive' | 'synergistic' | 'antagonistic' | 'neutral';
  interactingPairs?: SynergyPair[];
  overallAssessment?: string;
  evidenceLevel?: EvidenceLevel;
  recommendations?: string[];

  // 兼容旧格式 / fallback 使用的属性
  score?: number;
  synergy_pairs?: { a: string; b: string; score: number }[];
  antagonism_warnings?: { a: string; b: string; reason?: string }[];
  shared_pathways?: string[];
  heat_map?: Record<string, any>;
  summary?: string;
}

export interface SynergyPair {
  componentA: string;
  componentB: string;
  interactionType: string;
  effectDescription: string;
  confidence: number;
  references?: string[];
}

// ════════════════════════════════════════════
// 12. 标签管理 (Tag Management)
// ════════════════════════════════════════════

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  category?: string;
  description?: string;
  usageCount?: number;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// ════════════════════════════════════════════
// 13. 通知系统 (Notification System)
// ════════════════════════════════════════════

export interface Notification {
  id: number;
  userId: number;
  type: 'info' | 'warning' | 'success' | 'error' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  actionUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

// ════════════════════════════════════════════
// 14. 推理链 (Inference Chain)
// ════════════════════════════════════════════

export * from './inference';

// ════════════════════════════════════════════
// 15. 兼容性别名 (Compatibility Aliases)
// ════════════════════════════════════════════

/**
 * @deprecated 请使用 camelCase 版本的属性名
 * 此接口仅用于向后兼容旧的 snake_case API 响应格式
 */
export interface LegacyTCMHerb extends TCMHerb {
  name_cn?: string; // 兼容旧字段 → name
  name_latin?: string; // 兼容旧字段 → latinName
  name_pinyin?: string; // 兼容旧字段 → pinyinName
  effects?: string; // 兼容旧字段 → efficacy
  ob_percent?: number; // 兼容旧字段 → oralBioavailability
  dl_value?: number; // 兼容旧字段 → drugLikeness
  compound_count?: number; // 兼容旧字段 → activeCompounds
  target_count?: number; // 兼容旧字段 → targetCount
  is_food_homology?: boolean; // 兼容旧字段 → isFoodHomology
}

export interface LegacyBioactivePeptide extends Omit<BioactivePeptide, 'sequence' | 'length'> {
  sequence?: string; // 兼容旧字段 → 序列本身
  source_protein?: string; // 兼容旧字段 → source
  activity_value?: number; // 兼容旧字段 → activityScore
  activity_unit?: string; // 兼容旧字段 → activityUnit
  molecular_weight?: number; // 兼容旧字段 → molecularWeight
  hydrolysis_enzyme?: string; // 兼容旧字段 → hydrolysisEnzyme
  length?: number;
}

export interface LegacyKnowledgeNode extends KnowledgeNode {
  node_label?: string; // 兼容旧字段 → title
  node_type?: string; // 兼容旧字段 → type
}

// ════════════════════════════════════════════
// 16. 搜索系统 (Search System)
// ════════════════════════════════════════════

export * from './search.types';
