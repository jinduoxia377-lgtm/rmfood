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