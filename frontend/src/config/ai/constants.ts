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