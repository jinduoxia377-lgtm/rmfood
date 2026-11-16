/**
 * AI 配方平台核心类型定义
 *
 * 定义成分、配方、协同分析、专业报告等核心数据结构
 */

// ==================== 功效标签 ====================

/**
 * 功效标签分类枚举
 * 用于对功效标签进行层级分类管理
 */
export type TagCategory =
  | 'immune' // 免疫调节
  | 'antioxidant' // 抗氧化
  | 'cardiovascular' // 心血管保护
  | 'metabolic' // 代谢调节
  | 'digestive' // 消化系统
  | 'nervous' // 神经系统
  | 'beauty' // 美容养颜
  | 'anti_aging' // 抗衰老
  | 'bone_joint' // 骨关节健康
  | 'liver_kidney' // 肝肾养护
  | 'respiratory' // 呼吸系统
  | 'energy' // 能量补充
  | 'sleep' // 助眠安神
  | 'other'; // 其他

/**
 * 成分功效标签枚举（扩展版）
 * 用于标注每种成分的主要功效属性
 *
 * @example
 * ```ts
 * const tags: EfficacyTag[] = ['补气养血', '抗氧化', '增强免疫']
 * ```
 */
export type EfficacyTag =
  | '补气养血'
  | '抗氧化'
  | '降血压'
  | '降血糖'
  | '增强免疫'
  | '抗疲劳'
  | '改善睡眠'
  | '安神'
  | '护肝'
  | '健脾益胃'
  | '美容养颜'
  | '抗炎'
  | '调节血脂'
  | '保护心血管'
  | '延缓衰老'
  | '促进消化'
  | '补肾壮阳'
  | '清热解毒'
  | '祛风除湿'
  | '活血化瘀'
  | '止咳化痰'
  | '润肺止咳'
  | '利水消肿'
  | '收敛固涩'
  | '温中散寒'
  | '疏肝理气'
  | '滋阴润燥'
  | '益气固表'
  | '补血活血'
  | '调和脾胃'
  | '宁心安神'
  | '聪耳明目'
  | '强筋健骨'
  | '乌须发'
  | '生津止渴'
  | '涩肠止泻'
  | '降脂减肥'
  | '抗肿瘤'
  | '抗病毒'
  | '抗菌'
  | '抗过敏'
  | '保胎'
  | '通乳'
  | '驱虫'
  | '解表散寒'
  | '和解少阳';

// ==================== 注意事项 ====================

/**
 * 注意事项严重程度
 */
export type PrecautionSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 注意事项类型分类（扩展版）
 */
export type PrecautionCategory =
  | 'contraindication' // 禁忌症
  | 'warning' // 警告/慎用
  | 'dosage' // 用量注意
  | 'interaction' // 药物相互作用
  | 'pregnancy' // 孕期相关
  | 'allergy' // 过敏风险
  | 'special_pop'; // 特殊人群

/**
 * 触发条件接口
 * 定义注意事项的触发条件，用于智能提示系统
 */
export interface TriggerCondition {
  /** 条件类型 */
  type: 'age_range' | 'condition' | 'dosage_exceed' | 'combination' | 'duration';
  /** 条件描述 */
  description: string;
  /** 条件值（根据type不同而不同） */
  value: string | number | { min?: number; max?: number };
  /** 是否为硬性限制 */
  isHardLimit: boolean;
}

/**
 * 成分使用注意事项（扩展版）
 * 记录成分在使用过程中需要特别关注的安全信息
 *
 * @example
 * ```ts
 * const precaution: Precaution = {
 *   category: 'contraindication',
 *   content: '孕妇禁用',
 *   severity: 'high',
 *   triggerConditions: [{
 *     type: 'condition',
 *     description: '妊娠期',
 *     value: 'pregnant',
 *     isHardLimit: true
 *   }]
 * }
 * ```
 */
export interface Precaution {
  /** 注意事项分类 */
  category: PrecautionCategory;
  /** 注意事项具体内容 */
  content: string;
  /** 严重程度 */
  severity: PrecautionSeverity;
  /** 触发条件列表（可选） */
  triggerConditions?: TriggerCondition[];
  /** 参考来源（可选） */
  reference?: string;
  /** 建议措施（可选） */
  recommendation?: string;
}

// ==================== 来源分类 ====================

/**
 * 成分来源分类枚举
 * 标识成分的来源类别，用于配方归类与分析
 */
export enum IngredientSource {
  /** 药食同源 - 中药材及药食同源物质 */
  TCM = 'TCM',
  /** 食源性多肽 - 通过酶解等技术制备的功能性多肽 */
  PEPTIDE = 'PEPTIDE',
  /** 辅料 - 赋形剂、稳定剂等辅助材料 */
  EXCIPIENT = 'EXCIPIENT',
}

// ==================== 剂量计算 ====================

/**
 * 剂量计算结果接口
 * 用于存储和传递剂量换算的计算结果
 */
export interface DosageCalculationResult {
  /** 原始值 */
  originalValue: number;
  /** 原始单位 */
  originalUnit: string;
  /** 转换后值 */
  convertedValue: number;
  /** 转换后单位 */
  convertedUnit: string;
  /** 换算系数 */
  conversionFactor: number;
  /** 计算时间戳 */
  calculatedAt: Date;
}

// ==================== 核心成分 ====================

/**
 * 配方成分接口（扩展版）
 * 描述配方中单一成分的完整属性信息
 *
 * @example
 * ```ts
 * const ingredient: Ingredient = {
 *   name: '人参',
 *   latinName: 'Panax ginseng',
 *   amount: 500,
 *   unit: 'g',
 *   percentage: 25,
 *   efficacyTags: ['补气养血', '增强免疫', '抗疲劳'],
 *   precautions: [{ category: 'warning', content: '高血压患者慎用', severity: 'medium' }],
 *   source: IngredientSource.TCM,
 *   qualityScore: 85,
 *   sourceDatabase: 'TCMSP'
 * }
 * ```
 */
export interface Ingredient {
  /** 中文名称 */
  name: string;
  /** 拉丁学名（可选） */
  latinName?: string;
  /** 用量数值 */
  amount: number;
  /** 单位（g/ml 等） */
  unit: string;
  /** 在配方中的占比百分比（0-100，可选） */
  percentage?: number;
  /** 功效标签数组（可选） */
  efficacyTags?: EfficacyTag[];
  /** 注意事项数组（可选） */
  precautions?: Precaution[];
  /** 来源分类 */
  source: IngredientSource;
  /** 质量评分 (0-100，可选) */
  qualityScore?: number;
  /** 数据来源数据库（可选） */
  sourceDatabase?: string;
  /** 成分角色（可选，如主药/辅药/佐使） */
  role?: string;
}

/**
 * 增强型成分接口
 * 在基础成分信息之上，提供更丰富的分析数据
 */
export interface EnhancedIngredient extends Ingredient {
  /** 成分唯一ID */
  id: string;
  /** 化学成分列表 */
  activeCompounds?: string[];
  /** 药理作用机制 */
  mechanismOfAction?: string;
  /** 生物利用度 (%) */
  bioavailability?: number;
  /** 半衰期信息 */
  halfLife?: string;
  /** 相互作用成分列表 */
  interactions?: string[];
  /** 临床研究数量 */
  clinicalStudiesCount?: number;
  /** 推荐日用量范围 */
  recommendedDosage?: { min: number; max: number; unit: string };
  /** 毒性等级 */
  toxicityLevel?: 'safe' | 'low' | 'moderate' | 'high';
}

// ==================== 配方表格数据 ====================

/**
 * 配方表格数据结构
 * 用于展示和传递完整配方的结构化数据
 *
 * @example
 * ```ts
 * const formulaData: FormulaTableData = {
 *   title: '气血双补配方',
 *   ingredients: [ingredient1, ingredient2],
 *   totalAmount: 2000,
 *   description: '适用于气血两虚人群的调理配方',
 *   metadata: { creator: '张三', version: '1.0' }
 * }
 * ```
 */
export interface FormulaTableData {
  /** 配方标题 */
  title: string;
  /** 成分列表 */
  ingredients: Ingredient[];
  /** 总用量 */
  totalAmount: number;
  /** 配方描述（可选） */
  description?: string;
  /** 扩展元数据（可选） */
  metadata?: Record<string, any>;
  /** 置信度评分 (0-1，表示解析结果的可信程度) */
  confidence?: number;
  /** 本次解析识别到的候选配方数量 */
  parseCount?: number;
  /** AI评估的综合评分 (0-100) */
  score?: number;
  /** 加权总分 (考虑各维度权重的最终得分) */
  totalScore?: number;
}

// ==================== 协同维度 ====================

/**
 * 协同效应六维评估维度枚举
 * 用于多维度量化成分间的协同作用
 */
export enum SynergyDimension {
  /** 协同强度 - 成分间相互增强的整体程度 */
  SYNERGY_STRENGTH = 'SYNERGY_STRENGTH',
  /** 生物利用度 - 成分在体内的吸收与利用效率 */
  BIOAVAILABILITY = 'BIOAVAILABILITY',
  /** 功效倍增 - 组合后功效相对于单独使用的放大倍数 */
  EFFICACY_MULTIPLICATION = 'EFFICACY_MULTIPLICATION',
  /** 安全指数 - 组合后的安全性综合评价 */
  SAFETY_INDEX = 'SAFETY_INDEX',
  /** 稳定性改善 - 配方在储存和使用过程中的稳定性提升 */
  STABILITY_IMPROVEMENT = 'STABILITY_IMPROVEMENT',
  /** 口感平衡 - 多成分组合后的感官协调性 */
  TASTE_BALANCE = 'TASTE_BALANCE',
}

/**
 * 雷达图数据结构
 * 用于可视化展示成分组合在各协同维度上的评分表现
 *
 * @example
 * ```ts
 * const radarData: SynergyRadarData = {
 *   combinationName: '人参+黄芪',
 *   dimensions: {
 *     [SynergyDimension.SYNERGY_STRENGTH]: { score: 8.5, description: '强协同作用' },
 *     [SynergyDimension.BIOAVAILABILITY]: { score: 7.2, description: '吸收良好' },
 *     // ... 其他维度
 *   },
 *   mechanism: '补气相须为用',
 *   color: '#1890ff'
 * }
 * ```
 */
export interface SynergyRadarData {
  /** 成分组合名称 */
  combinationName: string;
  /** 各维度的评分与描述 */
  dimensions: Record<SynergyDimension, { score: number; description: string }>;
  /** 协同机制说明（可选） */
  mechanism?: string;
  /** 图表显示颜色（可选） */
  color?: string;
}

// ==================== 报告元数据 ====================

/**
 * 专业报告元数据
 * 记录报告的基本归属与标识信息
 *
 * @example
 * ```ts
 * const meta: ReportMetadata = {
 *   formulaId: 'formula_001',
 *   author: '李研究员',
 *   projectName: '功能性食品研发',
 *   tags: ['抗氧化', '中老年']
 * }
 * ```
 */
export interface ReportMetadata {
  /** 关联的配方 ID（可选） */
  formulaId?: string;
  /** 报告作者（可选） */
  author?: string;
  /** 所属项目名称（可选） */
  projectName?: string;
  /** 标签列表（可选） */
  tags?: string[];
  /** 分析引擎版本号 (用于追踪算法迭代) */
  analysisVersion?: string;
}

// ==================== 报告章节 ====================

/**
 * 报告章节类型枚举
 * 定义报告中各章节的分类标识
 */
export type ReportSectionType =
  | 'cover'
  | 'executive-summary'
  | 'formula-details'
  | 'ingredient-analysis'
  | 'synergy-assessment'
  | 'recommendations'
  | 'appendix';

/**
 * 报告章节接口
 * 描述报告中的一个独立章节单元
 *
 * @example
 * ```ts
 * const section: ReportSection = {
 *   type: 'executive-summary',
 *   title: '执行摘要',
 *   content: { summary: '本配方具有显著的抗氧化效果...', keyPoints: [...] },
 *   order: 1
 * }
 * ```
 */
export interface ReportSection {
  /** 章节ID（可选，用于标识和引用） */
  id?: string;
  /** 章节类型 */
  type: ReportSectionType;
  /** 章节标题 */
  title: string;
  /** 章节内容（支持文本、表格、图表等多种格式） */
  content: any;
  /** 排序序号 */
  order: number;
}

// ==================== 专业报告 ====================

/**
 * 专业报告接口
 * 完整的专业分析报告数据结构，包含多个章节与元数据
 *
 * @example
 * ```ts
 * const report: ProfessionalReport = {
 *   id: 'rpt_20260101_001',
 *   title: '复方抗氧化功能因子协同效应分析报告',
 *   generatedAt: new Date('2026-01-01'),
 *   version: '1.2.0',
 *   sections: [coverSection, summarySection, ...],
 *   metadata: { author: 'AI 分析引擎', projectName: '配方优化项目' }
 * }
 * ```
 */
export interface ProfessionalReport {
  /** 报告唯一标识 */
  id: string;
  /** 报告标题 */
  title: string;
  /** 生成时间 */
  generatedAt: Date;
  /** 报告版本号 */
  version: string;
  /** 报告章节列表 */
  sections: ReportSection[];
  /** 报告元数据 */
  metadata: ReportMetadata;
}

// ==================== 表格配置与导出格式 ====================

/**
 * 导出格式枚举（扩展版）
 * 支持的专业报告和数据导出文件格式
 */
export enum ExportFormat {
  /** PDF 文档格式 */
  PDF = 'PDF',
  /** Word 文档格式 */
  WORD = 'WORD',
  /** Excel 表格格式 */
  EXCEL = 'EXCEL',
  /** CSV 格式 */
  CSV = 'CSV',
  /** JSON 格式 */
  JSON = 'JSON',
}

/**
 * 列配置接口
 * 定义表格中单列的显示配置
 */
export interface ColumnConfig {
  /** 列标识符（字段名） */
  key: string;
  /** 列标题 */
  title: string;
  /** 列宽度（像素或百分比） */
  width?: number | string;
  /** 是否固定列 */
  fixed?: 'left' | 'right';
  /** 是否可排序 */
  sortable?: boolean;
  /** 是否可筛选 */
  filterable?: boolean;
  /** 是否默认可见 */
  visible?: boolean;
  /** 列对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 自定义渲染器名称 */
  renderer?: string;
}

/**
 * 分页配置接口
 */
export interface PaginationConfig {
  /** 当前页码 */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 可选的每页条数选项 */
  pageSizeOptions: number[];
  /** 是否显示分页 */
  showPagination: boolean;
  /** 是否显示总数 */
  showTotal: boolean;
  /** 是否显示快速跳转 */
  showQuickJumper: boolean;
  /** 是否显示页码选择器 */
  showSizeChanger: boolean;
}

/**
 * 表格配置接口
 * 完整的配方表格配置定义
 */
export interface TableConfig {
  /** 表格唯一标识 */
  id: string;
  /** 表格标题 */
  title: string;
  /** 列配置列表 */
  columns: ColumnConfig[];
  /** 默认排序列 */
  defaultSortKey?: string;
  /** 默认排序方向 */
  defaultSortOrder?: 'asc' | 'desc';
  /** 分页配置 */
  pagination: PaginationConfig;
  /** 是否支持行选择 */
  rowSelection?: boolean;
  /** 是否支持行展开 */
  expandable?: boolean;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 行高模式 */
  size?: 'small' | 'middle' | 'large';
  /** 滚动配置 */
  scroll?: { x?: number; y?: number };
}

// ==================== 消息类型扩展 ====================

/**
 * AI 对话消息类型扩展
 * 在基础文本消息之外，支持富媒体消息类型
 *
 * @example
 * ```ts
 * // 发送配方表格消息
 * const msg: AIMessage = {
 *   type: MessageType.FORMULA_TABLE,
 *   payload: formulaTableData
 * }
 * ```
 */
export enum MessageType {
  /** 纯文本消息 */
  TEXT = 'TEXT',
  /** 配方表格消息 */
  FORMULA_TABLE = 'FORMULA_TABLE',
  /** 协同雷达图消息 */
  RADAR_CHART = 'RADAR_CHART',
  /** 报告预览消息 */
  REPORT_PREVIEW = 'REPORT_PREVIEW',
}

// ==================== 解析后的配方数据 ====================

/**
 * 解析后的成分接口
 * 描述从原始数据中解析出的单一成分信息
 */
export interface ParsedIngredient {
  /** 成分名称 */
  name: string;
  /** 用量数值 */
  amount: number;
  /** 单位 */
  unit: string;
  /** 功效角色 */
  role: string;
  /** 是否药食同源 */
  is_food_homology: boolean;
}

/**
 * 解析后的配方接口
 * 用于 FormulaCounterBadge 等组件展示识别到的配方信息
 *
 * @example
 * ```ts
 * const formula: ParsedFormula = {
 *   id: 1,
 *   name: '气血双补配方',
 *   code: 'FORMULA_001',
 *   status: 'active',
 *   description: '适用于气血两虚人群',
 *   ingredients: [
 *     { name: '人参', amount: 500, unit: 'g', role: '主药', is_food_homology: true }
 *   ],
 *   safety_check: { passed: true },
 *   synergy_analysis: { score: 8.5 }
 * }
 * ```
 */
export interface ParsedFormula {
  /** 配方唯一标识 */
  id: number | string;
  /** 配方名称 */
  name: string;
  /** 配方编码 */
  code: string;
  /** 配方状态 */
  status: string;
  /** 配方描述（可选） */
  description: string | null;
  /** 成分列表 */
  ingredients: ParsedIngredient[];
  /** 安全检查结果（可选） */
  safety_check: Record<string, unknown> | null;
  /** 协同分析结果（可选） */
  synergy_analysis: Record<string, unknown> | null;
  /** 成分数量（计算属性，用于快速显示） */
  ingredientCount?: number;
}

// ==================== AI识别配方数据结构 ====================

/**
 * AI识别后的配方成分项
 * 描述从文本或表格中识别出的单一成分信息
 *
 * @example
 * ```ts
 * const ingredient: RecognizedFormulaIngredient = {
 *   name: '人参',
 *   dosage: '500',
 *   unit: 'g',
 *   efficacy: '补气养血',
 *   notes: '需先煎煮'
 * }
 * ```
 */
export interface RecognizedFormulaIngredient {
  /** 成分名称 */
  name: string;
  /** 用量/剂量值 */
  dosage: string;
  /** 单位（可选） */
  unit?: string;
  /** 功效说明（可选） */
  efficacy?: string;
  /** 备注信息（可选） */
  notes?: string;
}

/**
 * AI识别后的完整配方数据
 * 用于存储从AI对话中识别出的配方信息，包含元数据和原始解析结果
 *
 * @example
 * ```ts
 * const recognizedFormula: AIRecognizedFormula = {
 *   id: 'FMT-1a2b3c-xyz123',
 *   name: '气血双补配方',
 *   ingredientCount: 5,
 *   confidence: 0.92,
 *   sourceMessageId: 'msg_001',
 *   parsedAt: new Date(),
 *   rawData: formulaTableData,
 *   ingredients: [
 *     { name: '人参', dosage: '500', unit: 'g' },
 *     { name: '黄芪', dosage: '300', unit: 'g' }
 *   ]
 * }
 * ```
 */
export interface AIRecognizedFormula {
  /** 唯一标识符 (基于名称哈希 + 时间戳生成) */
  id: string;
  /** 配方名称 */
  name: string;
  /** 成分数量统计 */
  ingredientCount: number;
  /** 置信度评分 (0-1，越高表示识别越准确) */
  confidence: number;
  /** 来源消息ID (标识该配方来自哪条AI回复) */
  sourceMessageId: string;
  /** 解析识别的时间戳 */
  parsedAt: Date;
  /** 原始解析数据 (完整的表格数据结构) */
  rawData: FormulaTableData;
  /** 结构化的成分列表 */
  ingredients: RecognizedFormulaIngredient[];

  // ===== 新增字段 (v8.0 增强版) =====

  /** 自动生成的语义化名称（由formulaNamingEngine生成） */
  autoName?: string;

  /** 配方质量综合评分 (0-100) */
  qualityScore?: number;

  /** 质量等级 (A/B/C/D/F) */
  qualityGrade?: 'A' | 'B' | 'C' | 'D' | 'F';

  /** 功效标签数组（自动提取或手动添加） */
  tags?: string[];

  /** 功效描述文本 */
  efficacy?: string;

  /** 适用人群标签 */
  targetAudience?: string[];

  /** 推荐剂量范围 */
  recommendedDosage?: string;

  /** 禁忌症/注意事项 */
  contraindications?: string;

  /** 用户自定义备注 */
  userNotes?: string;

  /** 是否已收藏 */
  isFavorite?: boolean;

  /** 优先级（用于排序/强调） */
  priority?: 'high' | 'medium' | 'low';

  /** 创建时间戳 */
  createdAt?: number;

  /** 最后更新时间戳 */
  updatedAt?: number;

  /** 版本号（用于版本追踪） */
  version?: number;

  /** 原始文本内容（用于命名引擎提取关键词） */
  content?: string;

  /** 扩展元数据（功效、来源等） */
  metadata?: Record<string, unknown>;
}

/**
 * 配方索引类型
 * 使用Map结构存储和管理多个识别后的配方，以配方ID为键
 * 支持快速查找、更新和删除操作
 *
 * @example
 * ```ts
 * const formulaIndex: FormulaIndex = new Map()
 * formulaIndex.set(recognizedFormula.id, recognizedFormula)
 * const formula = formulaIndex.get('FMT-1a2b3c-xyz123')
 * ```
 */
export type FormulaIndex = Map<string, AIRecognizedFormula>;

// ==================== v8.0 新增：质量评分与筛选类型 ====================

/**
 * 配方质量评分详情
 * 提供多维度的配方质量评估结果
 *
 * @example
 * ```ts
 * const score: FormulaQualityScore = {
 *   overallScore: 85,
 *   confidenceScore: 92,
 *   completenessScore: 78,
 *   diversityScore: 85,
 *   qualityGrade: 'B',
 *   recommendations: ['建议补充成分信息', '可增加功效描述']
 * }
 * ```
 */
export interface FormulaQualityScore {
  /** 综合评分 (0-100) */
  overallScore: number;
  /** 置信度得分 (0-100) */
  confidenceScore: number;
  /** 完整性得分 (0-100) */
  completenessScore: number;
  /** 成分多样性得分 (0-100) */
  diversityScore: number;
  /** 质量等级 */
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 改进建议列表 */
  recommendations: string[];
}

/**
 * 配方筛选条件
 * 用于高级搜索和过滤功能
 *
 * @example
 * ```ts
 * const filters: FormulaFilters = {
 *   keyword: '抗氧化',
 *   minConfidence: 0.8,
 *   grade: ['A', 'B'],
 *   tags: ['免疫调节'],
 *   minIngredients: 3
 * }
 * ```
 */
export interface FormulaFilters {
  /** 搜索关键词 */
  keyword?: string;

  /** 质量等级筛选（多选） */
  qualityGrades?: ('A' | 'B' | 'C' | 'D' | 'F')[];

  /** 置信度范围（百分比） */
  confidenceRange?: {
    min: number;
    max: number;
  };

  /** 时间范围 */
  dateRange?: {
    start: number;
    end: number;
  };

  /** 成分数量范围 */
  ingredientCountRange?: {
    min: number;
    max: number;
  };

  /** 标签筛选（多选） */
  tags?: string[];

  /** @deprecated 使用 confidenceRange 替代 */
  minConfidence?: number;
  /** @deprecated 使用 confidenceRange 替代 */
  maxConfidence?: number;
  /** @deprecated 使用 qualityGrades 替代 */
  grade?: ('A' | 'B' | 'C' | 'D' | 'F')[];
  /** @deprecated 使用 dateRange 替代 */
  dateFrom?: number;
  /** @deprecated 使用 dateRange 替代 */
  dateTo?: number;
  /** @deprecated 使用 ingredientCountRange 替代 */
  minIngredients?: number;
  /** @deprecated 使用 ingredientCountRange 替代 */
  maxIngredients?: number;
}

/**
 * 排序字段枚举
 * 定义可用的排序维度
 */
export type FormulaSortField = 'createdAt' | 'updatedAt' | 'name' | 'confidence' | 'qualityScore' | 'ingredientCount';

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc';

// ==================== Phase 2: AI 智能化增强类型 ====================

/**
 * 聊天消息基础结构
 * 用于工作记忆和多轮对话管理
 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容（支持 Markdown） */
  content: string;
  /** 时间戳 (Unix ms) */
  timestamp: number;
  /** 关联的配方数据（可选） */
  formulas?: {
    name: string;
    value: number;
    unit?: string;
    confidence?: number;
  }[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 意图类型枚举
 * 定义 NLP 引擎可识别的用户意图分类
 */
export type IntentType =
  | 'greeting' // 问候
  | 'formula_inquiry' // 配方查询
  | 'ingredient_query' // 成分查询
  | 'dosage_inquiry' // 剂量咨询
  | 'safety_review' // 安全性审查
  | 'regulation_inquiry' // 法规咨询
  | 'cost_analysis' // 成本分析
  | 'synergy_analysis' // 协同效应分析
  | 'comparison' // 对比分析
  | 'optimization_request' // 优化请求
  | 'general_inquiry' // 一般性询问
  | 'feedback_positive' // 正面反馈
  | 'feedback_negative' // 负面反馈
  | 'clarification' // 澄清/追问
  | 'topic_change' // 话题切换
  | 'farewell'; // 告别

/**
 * 子意图类型
 * 提供更细粒度的意图分类
 */
export type SubIntent =
  | 'single_ingredient' // 单一成分
  | 'multi_ingredient' // 多成分组合
  | 'specific_dosage' // 特定剂量
  | 'dosage_range' // 剂量范围
  | 'toxicity_check' // 毒性检查
  | 'interaction_check' // 相互作用检查
  | 'pregnancy_safety' // 孕期安全
  | 'efficacy_enhancement' // 功效增强
  | 'taste_optimization' // 口感优化
  | 'stability_improvement' // 稳定性改善
  | 'cost_reduction' // 成本降低
  | 'regulatory_compliance' // 法规合规
  | 'general'; // 通用

/**
 * 置信度级别
 * 用于标注意图识别的置信程度
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/**
 * 意图检测结果
 * NLP 引擎输出的标准化结果结构
 */
export interface IntentDetectionResult {
  /** 主要意图 */
  primaryIntent: IntentType;
  /** 置信度分数 (0-1) */
  confidence: number;
  /** 子意图列表 */
  subIntents?: SubIntent[];
  /** 识别方法 ('rule-based' | 'semantic' | 'fallback') */
  method: string;
  /** 处理耗时 (ms) */
  processingTime?: number;
  /** 提取的实体列表 */
  entities?: {
    type: string;
    text: string;
    confidence: number;
    position?: [number, number];
  }[];
  /** 情感分析结果 */
  sentiment?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
  };
  /** 原始输入文本 */
  originalText?: string;
}

/**
 * 实体类型
 * 从用户输入中提取的结构化信息
 */
export interface Entity {
  /** 实体类型分类 */
  type: 'formula' | 'ingredient' | 'dosage' | 'regulation' | 'general';
  /** 实体值 */
  value: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 最后被提及的时间戳 */
  lastMentioned: number;
  /** 被提及次数 */
  mentionCount: number;
}

/**
 * 话题结构
 * 多轮对话管理器使用的话题定义
 */
export interface Topic {
  /** 话题唯一 ID */
  id: string;
  /** 话题标题 */
  title: string;
  /** 话题类型分类 */
  type: 'formula-design' | 'safety-review' | 'cost-analysis' | 'general-qna' | 'regulatory-query' | 'quality-control';
  /** 话题上下文 */
  context: TopicContext;
  /** 父话题 ID（用于嵌套话题） */
  parentTopicId?: string;
  /** 子话题 ID 列表 */
  childTopics: string[];
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
  /** 消息数量 */
  messageCount: number;
}

/**
 * 话题上下文
 */
export interface TopicContext {
  /** 主题关键词 */
  keywords: string[];
  /** 相关实体 */
  entities: string[];
  /** 话题摘要 */
  summary: string;
}

/**
 * 引用解析结果
 * 用于指代消解（"它"、"这个"等代词）
 */
export interface Reference {
  /** 原始代词文本 */
  originalText: string;
  /** 解析后的实际指向 */
  resolvedText: string;
  /** 解析的实体 ID */
  entityId?: string;
  /** 置信度 */
  confidence: number;
  /** 解析时间戳 */
  resolvedAt: number;
}

/**
 * 多轮对话处理结果
 */
export interface ProcessResult {
  /** 指代消解后的用户输入 */
  resolvedInput: string;
  /** 话题更新信息 */
  topicUpdate?: {
    topic: Topic;
    isTopicChange: boolean;
    previousTopic?: Topic;
  };
  /** 已解析的引用列表 */
  referencesResolved?: Reference[];
  /** 处理耗时 (ms) */
  processingTime: number;
}
