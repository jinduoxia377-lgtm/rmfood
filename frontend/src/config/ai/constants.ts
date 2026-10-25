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