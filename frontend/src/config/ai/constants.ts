/**
 * AI 对话模块集中配置常量（P1-b：消除散落各处的硬编码阈值）
 *
 * 集中管理便于 A/B 测试与灰度调整；修改此处即可全局生效。
 */
export const MAX_MESSAGES = 100
export const COMPACT_TRIGGER_THRESHOLD = 0.85
export const DEFAULT_MAX_TOKENS = 6000
export const TYPEWRITER_SPEED_MS = 30
export const TYPEWRITER_CHUNK_SIZE = 3
export const VIRTUALIZE_THRESHOLD = 40

// ===== feedbackLoopSystem：推荐新颖度评分阈值 =====
export const FEEDBACK_ADOPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 最近 7 天计为“近期采纳”
export const FEEDBACK_OVERUSE_THRESHOLD = 10 // 近期采纳 > 10 视为过度使用
export const FEEDBACK_OVERUSE_SCORE = 40
export const FEEDBACK_FREQUENT_THRESHOLD = 5 // 近期采纳 > 5 视为频繁使用
export const FEEDBACK_FREQUENT_SCORE = 60
export const FEEDBACK_NEW_SUGGESTION_SCORE = 80 // 新建议默认分
export const FEEDBACK_NORMAL_SCORE = 75 // 正常使用分

// ===== contextManager：话题连续性与实体置信度 =====
export const TOPIC_CONTINUITY_BOOST = 10
export const TOPIC_CONTINUITY_DECAY = 20
export const ENTITY_CONFIDENCE_STEP = 0.02
export const ENTITY_CONFIDENCE_MAX = 0.99
export const MAX_RECENT_INTENTS = 5
export const MAX_RECENT_TOPICS = 5

// ===== deepThinkingService：深度思考置信度评分 =====
export const DTS_BASE_SCORE = 0.3
export const DTS_ENTITY_TYPE_BONUS = 0.1
export const DTS_ENTITY_TYPE_MAX = 0.3
export const DTS_INGREDIENT_BONUS = 0.12
export const DTS_DOSAGE_FORM_BONUS = 0.08
export const DTS_REGULATION_BONUS = 0.1
export const DTS_PROCESS_BONUS = 0.1
export const DTS_LENGTH_THRESHOLD_1 = 30
export const DTS_LENGTH_THRESHOLD_2 = 50
export const DTS_LENGTH_30_BONUS = 0.08
export const DTS_LENGTH_50_BONUS = 0.07

// ===== sentimentEngine：情感强度评分 =====
export const SENTI_BASE_SCORE_CAP = 70 // 基础分上限
export const SENTI_WEIGHT_RATIO = 60 // 主类别权重占比基数
export const SENTI_KEYWORD_SCORE = 3 // 每个匹配关键词加分
export const SENTI_DENSITY_MIN = 1.0
export const SENTI_DENSITY_MAX = 1.5
export const SENTI_DENSITY_FACTOR = 0.15
export const SENTI_EXCLAMATION_BOOST_CAP = 30 // 感叹号/重复加强上限
export const SENTI_EXCLAMATION_SCORE = 5
export const SENTI_QUESTION_SCORE = 2
export const SENTI_REPEATED_WORD_SCORE = 3
export const SENTI_REPEAT_COUNT_THRESHOLD = 1 // 词频超过此值视为重复

// ===== formulaDesignEngine：配伍与评分 =====
export const FDE_MERIDIAN_BONUS = 0.08 // 共同归经加分
export const FDE_FLAVOR_BONUS = 0.05 // 共同五味加分
export const FDE_COMPAT_SCORE_MIN = -0.5 // 配伍分截断下限
export const FDE_COMPAT_SCORE_MAX = 0.5 // 配伍分截断上限
export const FDE_DEFAULT_WEIGHTS = { efficacy: 0.3, safety: 0.25, taste: 0.15, stability: 0.15, cost: 0.15 } as const

// ===== promptOptimizer：质量分级与复杂度判定 =====
export const PROMPT_GRADE_EXCELLENT = 90
export const PROMPT_GRADE_GOOD = 78
export const PROMPT_GRADE_MEDIUM = 68
export const PROMPT_GRADE_BASIC = 55
export const PROMPT_COMPLEX_SIMPLE_SENTENCES = 2
export const PROMPT_COMPLEX_SIMPLE_CLAUSES = 3
export const PROMPT_COMPLEX_SIMPLE_AVG_LEN = 30
export const PROMPT_COMPLEX_MODERATE_SENTENCES = 4
export const PROMPT_COMPLEX_MODERATE_CLAUSES = 8
export const PROMPT_COMPLEX_MODERATE_AVG_LEN = 60

// ===== expertIntelligenceEngine：专家建议置信度阈值 =====
export const EXPERT_LOW_CONFIDENCE = 0.15 // 低于此置信度且输入过短 → 跳过建议
export const EXPERT_MIN_INPUT_LEN = 6
export const EXPERT_RECOMMEND_CONFIDENCE = 0.4 // 生成成分推荐所需最低置信度
export const EXPERT_LONG_INPUT_LEN = 15 // 长输入无监管上下文 → 补监管建议
export const EXPERT_DEGRADE_CONFIDENCE = 0.3 // 低置信度降级判定
export const EXPERT_DEGRADE_MIN_INPUT_LEN = 8

// ===== knowledgeGraphUpdater：知识图谱健康状态阈值 =====
export const KGU_DEGRADED_SUCCESS_RATE = 80 // 成功率低于此值 → degraded
export const KGU_CRITICAL_SUCCESS_RATE = 50 // 成功率低于此值 → critical

// ===== intelligentSuggestionGenerator：智能建议生成器阈值 =====
export const ISG_MIN_KEYWORD_LEN = 2 // 关键词最短长度
export const ISG_INITIAL_SUCCESS_RATE = 0.5 // 建议初始成功率
export const ISG_SUCCESS_STEP = 0.1 // 采纳后成功率增量
export const ISG_FAILURE_STEP = 0.05 // 拒绝后成功率减量
export const ISG_CACHE_KEY_TRUNCATE = 100 // 缓存 key 输入截断长度
export const ISG_CACHE_MAX_SIZE = 50 // 缓存上限
export const ISG_CACHE_CLEANUP_BATCH = 25 // 超限后单次清理数量

// ===== promptEngineeringFramework：提示词评分与等级阈值 =====
export const PEF_CONCISE_LEN_EXCELLENT = 80
export const PEF_CONCISE_LEN_GOOD = 120
export const PEF_CONCISE_LEN_MEDIUM = 150
export const PEF_CONCISE_LEN_BASIC = 170
export const PEF_GRADE_S = 95
export const PEF_GRADE_APLUS = 90
export const PEF_GRADE_A = 80
export const PEF_GRADE_BPLUS = 72
export const PEF_GRADE_B = 65
export const PEF_GRADE_C = 55
export const PEF_GRADE_D = 40

// ===== professionalIntelligenceEngineV4：专家级别判定 =====
export const PIE_DOMAIN_DIVERSITY_MIN = 3
export const PIE_DOMAIN_DIVERSITY_BONUS = 8
export const PIE_EXPERT_COMPLEXITY = 75
export const PIE_EXPERT_TERMS = 5
export const PIE_ADVANCED_COMPLEXITY = 55
export const PIE_ADVANCED_TERMS = 3
export const PIE_INTERMEDIATE_COMPLEXITY = 40
export const PIE_INTERMEDIATE_TERMS = 2

// ===== FormulaInferenceEngine：配方推断阈值 =====
export const FIE_STRONG_SYNERGY_WEIGHT = 0.8 // 强协同组合权重阈值
export const FIE_SAFETY_BASE_SCORE = 0.9 // 无禁忌时安全分
export const FIE_SAFETY_MIN_SCORE = 0.3 // 安全分下限
export const FIE_SAFETY_PENALTY_PER_CONTRA = 0.2 // 每个配伍禁忌扣分
export const FIE_MAX_RECOMMENDATIONS = 5 // 推荐建议上限

// ===== FormulaKnowledgeGraph：知识图谱兼容性阈值 =====
export const FKG_SIMILARITY_MIN = 0.3 // 相似成分推荐阈值
export const FKG_IMPLICIT_ENHANCE_MIN = 0.4 // 隐式增强阈值
export const FKG_IMPLICIT_CONTRADICT_MAX = 0.1 // 隐式禁忌阈值
export const FKG_NEUTRAL_STRENGTH = 0.3 // 中性配伍强度
export const FKG_MERIDIAN_BONUS = 0.05 // 共同归经加分
export const FKG_FLAVOR_BONUS = 0.03 // 共同五味加分
export const FKG_SCORE_MIN = -0.3 // 隐式兼容分下限
export const FKG_SCORE_MAX = 0.7 // 隐式兼容分上限