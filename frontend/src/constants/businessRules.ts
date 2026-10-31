/**
 * 业务规则常量定义
 *
 * 目的: 消除代码中的魔法数字和硬编码阈值
 * 原则: 所有业务相关的阈值、限制、超时等配置都应在此文件中定义
 *
 * 使用方式:
 * import { MAX_RETRY_COUNT, API_TIMEOUT_MS } from '@/constants/businessRules'
 *
 * @version 1.0.0
 */

// ============================================================================
// API 与网络配置
// ============================================================================

export const API = {
  /** API 请求超时时间（毫秒）- 对齐后端非流式 /chat 的 120s 总超时（150s 留有裕量） */
  TIMEOUT_MS: 150_000,

  /** 流式请求超时时间（毫秒）- 后端流式总上限 120s（含首包 60s + 空闲 30s），180s 留有裕量 */
  STREAM_TIMEOUT_MS: 180_000,  // 180秒 — 保持不变式：后端总超时 120s < 前端 180s

  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,

  /** 重试基础延迟（毫秒）- 指数退避：2^attempt * RETRY_BASE_DELAY_MS */
  RETRY_BASE_DELAY_MS: 1000,

  /** 防抖延迟（毫秒） */
  DEBOUNCE_DELAY_MS: 300,
} as const

// ============================================================================
// Excel 导出配置
// ============================================================================

export const EXCEL = {
  /** 单个单元格最大字符数 - Excel 限制 */
  MAX_CELL_LENGTH: 32767,

  /** 列宽最小值（字符数） */
  MIN_COLUMN_WIDTH: 8,

  /** 列宽最大值（字符数） */
  MAX_COLUMN_WIDTH: 50,

  /** 默认列宽（字符数） */
  DEFAULT_COLUMN_WIDTH: 16,

  /** 中文字符宽度（用于计算列宽） */
  CHINESE_CHAR_WIDTH: 2.0,

  /** ASCII 字符宽度 */
  ASCII_CHAR_WIDTH: 1.0,

  /** 控制字符宽度 */
  CONTROL_CHAR_WIDTH: 0.5,

  /** 默认字体大小 */
  DEFAULT_FONT_SIZE: 11,

  /** 默认字体名称 */
  DEFAULT_FONT_NAME: '微软雅黑',

  /** 列宽计算时增加的边距 */
  COLUMN_WIDTH_PADDING: 2,

  /** 文本截断时添加的后缀 */
  TEXT_TRUNCATION_SUFFIX: '...',

  /** 截断时保留的字符数（MAX_CELL_LENGTH - 3） */
  TEXT_TRUNCATION_RESERVE: 3,
} as const

// ============================================================================
// 存储与缓存配置
// ============================================================================

export const STORAGE = {
  /** 配方生成历史最大条数 */
  MAX_HISTORY_SIZE: 20,

  /** 收藏配方最大条数 */
  MAX_FAVORITES: 50,

  /** 配方版本最大条数 */
  MAX_FORMULA_VERSIONS: 10,

  /** 配方列表虚拟滚动阈值 */
  VIRTUAL_SCROLL_THRESHOLD: 50,

  /** 缓存有效期（毫秒）- 5 分钟 */
  CACHE_EXPIRY_MS: 5 * 60 * 1000,
} as const

// ============================================================================
// 字符串长度限制
// ============================================================================

export const STRING_LIMITS = {
  /** 引用预览最大长度 */
  QUOTE_PREVIEW_MAX_LENGTH: 50,

  /** 请求 ID 截断长度 */
  REQUEST_ID_TRUNCATE_LENGTH: 50,

  /** 配方名称最大长度 */
  FORMULA_NAME_MAX_LENGTH: 100,

  /** 输入最大长度 */
  INPUT_MAX_LENGTH: 4000,

  /** 输入最小长度 */
  INPUT_MIN_LENGTH: 1,

  /** 摘要预览最大长度 */
  ABSTRACT_PREVIEW_MAX_LENGTH: 100,

  /** 描述最大长度 */
  DESCRIPTION_MAX_LENGTH: 500,
} as const

// ============================================================================
// 会话与消息配置
// ============================================================================

export const SESSION = {
  /** 最大会话数 */
  MAX_SESSIONS: 50,

  /** 单个会话最大消息数 */
  MAX_MESSAGES_PER_SESSION: 200,

  /** 最少保留会话数 */
  MIN_SESSIONS_TO_KEEP: 5,

  /** 上下文窗口（最近 N 条消息） */
  CONTEXT_WINDOW: 10,

  /** 自动保存间隔（每 N 条消息保存一次） */
  AUTO_SAVE_INTERVAL: 10,

  /** 最大消息预览长度 */
  MESSAGE_PREVIEW_MAX_LENGTH: 100,
} as const

// ============================================================================
// 配方生成配置
// ============================================================================

export const FORMULA = {
  /** 配方候选数量 */
  VARIANT_COUNT: 3,

  /** 最大成分数量 */
  MAX_INGREDIENTS: 12,

  /** 剂量精度（小数位数） */
  DOSAGE_PRECISION: 2,

  /** 配伍角色列表索引循环 */
  HERB_ROLE_CYCLE_LENGTH: 5,
} as const

// ============================================================================
// 评分阈值配置
// ============================================================================

export const SCORE_THRESHOLDS = {
  /** 口感评分量表最大值 */
  TASTE_SCALE_MAX: 10,

  /** 口感置信度阈值 */
  TASTE_CONFIDENCE_THRESHOLD: 0.7,

  /** 协同效应强阈值 */
  SYNERGY_STRONG: 0.8,

  /** 协同效应中等阈值 */
  SYNERGY_MODERATE: 0.5,

  /** 安全阈值 - 安全 */
  SAFETY_SAFE: 85,

  /** 安全阈值 - 注意 */
  SAFETY_CAUTION: 60,

  /** 安全阈值 - 危险 */
  SAFETY_DANGER: 30,

  /** 默认口感评分 */
  DEFAULT_TASTE_SCORE: 0.6,

  /** 默认稳定性评分 */
  DEFAULT_STABILITY_SCORE: 0.7,

  /** 默认安全评分 */
  DEFAULT_SAFETY_SCORE: 0.8,

  /** 默认成本评分 */
  DEFAULT_COST_SCORE: 0.7,
} as const

// ============================================================================
// 稳定性与保质期配置
// ============================================================================

export const STABILITY = {
  /** 默认保质期（月） */
  SHELF_LIFE_MONTHS_DEFAULT: 24,

  /** 加速稳定性测试周期（周） */
  ACCELERATED_TEST_WEEKS: 12,
} as const

// ============================================================================
// 性能指标阈值
// ============================================================================

export const PERFORMANCE = {
  /** LCP (Largest Contentful Paint) - 最大内容绘制阈值（秒） */
  LCP_THRESHOLD_S: 2.5,

  /** FID (First Input Delay) - 首次输入延迟阈值（毫秒） */
  FID_THRESHOLD_MS: 100,

  /** CLS (Cumulative Layout Shift) - 累积布局偏移阈值 */
  CLS_THRESHOLD: 0.1,

  /** 性能监控采样率 */
  MONITORING_SAMPLE_RATE: 0.1,
} as const

// ============================================================================
// UI 与动画配置
// ============================================================================

export const UI = {
  /** 动画时长（毫秒） */
  ANIMATION_DURATION_MS: 300,

  /** Toast 显示时长（毫秒） */
  TOAST_DURATION_MS: 5000,

  /** 加载指示器延迟（毫秒）- 避免闪烁 */
  LOADING_INDICATOR_DELAY_MS: 200,

  /** 滚动到底部延迟（毫秒） */
  SCROLL_TO_BOTTOM_DELAY_MS: 100,
} as const

// ============================================================================
// 文件上传配置
// ============================================================================

export const FILE_UPLOAD = {
  /** 最大文件大小（MB） */
  MAX_FILE_SIZE_MB: 10,

  /** 允许的文件类型 */
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json'] as const,

  /** 导出文件过期清理时间（毫秒） */
  EXPORT_CLEANUP_DELAY_MS: 1000,
} as const

// ============================================================================
// 分页配置
// ============================================================================

export const PAGINATION = {
  /** 默认每页条数 */
  DEFAULT_PAGE_SIZE: 20,

  /** 最大每页条数 */
  MAX_PAGE_SIZE: 100,

  /** 分页选项 */
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
} as const

// ============================================================================
// 导出所有常量
// ============================================================================

export default {
  API,
  EXCEL,
  STORAGE,
  STRING_LIMITS,
  SESSION,
  FORMULA,
  SCORE_THRESHOLDS,
  STABILITY,
  PERFORMANCE,
  UI,
  FILE_UPLOAD,
  PAGINATION,
}
