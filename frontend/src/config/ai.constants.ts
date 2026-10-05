/**
 * AI模块常量定义
 *
 * 目的: 消除所有硬编码值，集中管理
 * 包含:
 * - 存储键名
 * - 默认值
 * - 边界限制
 * - 错误消息模板
 * - 正则表达式模式
 *
 * @version 4.0.0
 */

// ============================================================================
// 存储键名 (Storage Keys)
// ============================================================================

export const STORAGE_KEYS = {
  // 会话管理
  SESSIONS: 'rmfood_ai_sessions_v4',
  ACTIVE_SESSION: 'rmfood_ai_active_session_v4',
  SETTINGS: 'rmfood_ai_settings_v4',

  // 对话历史
  CHAT_HISTORY: 'rmfood_chat_history_v4',
  CHAT_PREFERENCES: 'rmfood_chat_preferences_v4',

  // 用户偏好
  THEME_PREFERENCE: 'rmfood_theme_preference',
  LANGUAGE: 'rmfood_language',
  SIDEBAR_COLLAPSED: 'rmfood_sidebar_collapsed',

  // 配方生成模块
  GENERATE_SELECTED_EFFECTS: 'rmfood_generate_selected_effects',
  GENERATE_USE_LLM: 'rmfood_generate_use_llm',
  GENERATE_ADVANCED_MODE: 'rmfood_generate_advanced_mode',
  GENERATE_VIEW_MODE: 'rmfood_generate_view_mode',
  GENERATE_ALGORITHM_CONFIG: 'rmfood_generate_algorithm_config',
  GENERATE_CONSTRAINTS: 'rmfood_generate_constraints',

  // 安全检查模块
  SAFETY_SELECTED_INGREDIENTS: 'rmfood_safety_selected_ingredients',
  SAFETY_CHECK_HISTORY: 'rmfood_safety_check_history',

  // 协同分析模块
  SYNERGY_SELECTED_COMBINATIONS: 'rmfood_synergy_selected_combbinations',
  SYNERGY_ANALYSIS_HISTORY: 'rmfood_synergy_analysis_history',

  // 肽分析模块
  PEPTIDE_ANALYSIS_SEQUENCE: 'rmfood_peptide_analysis_sequence',
  PEPTIDE_ANALYSIS_HISTORY: 'rmfood_peptide_analysis_history',

  // 肽设计模块
  PEPTIDE_DESIGN_PARAMS: 'rmfood_peptide_design_params',
  PEPTIDE_DESIGN_HISTORY: 'rmfood_peptide_design_history',
} as const

// ============================================================================
// 边界限制 (Limits)
// ============================================================================

export const LIMITS = {
  // 会话限制
  MAX_SESSIONS: 50,
  MAX_MESSAGES_PER_SESSION: 200,
  MIN_SESSIONS_TO_KEEP: 5,

  // 输入限制
  MAX_INPUT_LENGTH: 4000,
  MIN_INPUT_LENGTH: 1,
  MAX_TITLE_LENGTH: 100,

  // API限制
  MAX_RETRY_COUNT: 3,
  RETRY_BASE_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 30000,
  STREAM_TIMEOUT_MS: 60000,

  // UI限制
  VIRTUAL_SCROLL_THRESHOLD: 50,
  DEBOUNCE_DELAY_MS: 300,
  ANIMATION_DURATION_MS: 300,
  TOAST_DISPLAY_DURATION_MS: 5000,

  // 分页
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // 文件上传
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json'],
} as const

// ============================================================================
// 默认值 (Defaults)
// ============================================================================

export const DEFAULTS = {
  // 对话
  SYSTEM_PROMPT: 'You are a helpful AI assistant for RMFOOD formula platform.',
  TEMPERATURE: 0.7,
  MAX_TOKENS: 2000,
  CONTEXT_WINDOW: 10, // 最近N条消息作为上下文

  // 配方生成
  VARIANT_COUNT: 3,
  CREATIVITY_LEVEL: 'balanced' as const,
  MAX_INGREDIENTS: 12,
  DOSAGE_MODE: 'standard' as const,

  // 安全检查
  SAFETY_THRESHOLD_SAFE: 85,
  SAFETY_THRESHOLD_CAUTION: 60,
  SAFETY_THRESHOLD_DANGER: 30,

  // 协同分析
  SYNERGY_THRESHOLD_STRONG: 0.8,
  SYNERGY_THRESHOLD_MODERATE: 0.5,

  // 口感预测
  TASTE_SCALE_MAX: 10,
  TASTE_CONFIDENCE_THRESHOLD: 0.7,

  // 稳定性预测
  SHELF_LIFE_MONTHS_DEFAULT: 24,
  ACCELERATED_TEST_WEEKS: 12,

  // UI
  PLACEHOLDER_TEXTS: {
    // 通用
    LOADING_TEXT: '加载中...',
    CLOSE_NOTICE_BUTTON: '关闭提示',
    UNKNOWN_FORMULA: '未知配方',
    UNKNOWN_INGREDIENT: '未知药材',
    CATEGORY_CUSTOM: '自定义',
    BADGE_POPULAR: '热门',

    // 对话模块
    CHAT_INPUT: '输入您的问题... (Enter发送，Shift+Enter换行)',
    FORMULA_INPUT: '描述您的配方需求...',
    INGREDIENT_INPUT: '输入药材名称和剂量...',
    SEARCH: '搜索消息或内容...',

    // 配方生成模块
    PAGE_TITLE_GENERATE: '智能配方生成',
    PAGE_SUBTITLE_GENERATE: '基于功效需求，智能生成最优中药配方方案',
    BUTTON_SIMPLE_MODE: '简化模式',
    BUTTON_ADVANCED_MODE: '高级模式',
    BUTTON_REGENERATE: '重新生成',
    LABEL_ENABLE_AI_ENHANCEMENT: '启用 AI 增强',
    LABEL_INPUT_MODE: '输入模式：',
    BUTTON_SELECT_EFFECTS: '选择功效',
    BUTTON_MANUAL_INPUT: '手动输入',
    TITLE_SELECT_EFFECTS: '选择功效',
    GENERATION_PREPARING: '正在准备生成参数...',
    GENERATION_PARSING: '正在解析功效需求...',
    GENERATION_PROCESSING: '规则引擎正在生成配方方案...',
    GENERATION_OPTIMIZING: '正在优化配方参数...',
    GENERATION_VALIDATING: '正在进行安全性验证...',
    GENERATION_SUCCESS_TITLE: '配方生成成功',
    GENERATION_SUCCESS_MESSAGE_PREFIX: '生成了',
    GENERATION_SUCCESS_MESSAGE_SUFFIX: '个配方方案',
    GENERATION_ERROR_TITLE: '配方生成失败',
    BUTTON_AI_GENERATE: 'AI 智能生成',
    BUTTON_START_GENERATE: '开始生成',
    ERROR_NOTICE_TITLE: '操作提示',
    SAVE_SUCCESS_TITLE: '保存成功！',
    SAVE_SUCCESS_MESSAGE_PREFIX: '配方「',
    SAVE_SUCCESS_MESSAGE_SUFFIX: '」已成功保存',
    RESULT_COUNT_PREFIX: '生成',
    RESULT_COUNT_SUFFIX: '个配方方案',
    BADGE_AI_MODEL: 'AI 大模型',
    BADGE_NEURAL_NETWORK: '神经网络',
    BADGE_RULE_ENGINE: '规则引擎',
    RESULT_SUBTITLE: '查看、比较或保存您喜欢的配方方案',
    BUTTON_CARD_VIEW: '卡片视图',
    BUTTON_COMPARE_VIEW: '对比视图',
    BUTTON_OPTIMIZATION_ADVICE: '优化建议',
    BUTTON_SHARE_FORMULA: '分享配方',
    TITLE_VERSION_HISTORY: '配方历史版本',
    VERSION_COUNT_PREFIX: '共',
    VERSION_COUNT_SUFFIX: '个版本',
    SUCCESS_LOAD_VERSION: '已加载版本',
    SUCCESS_ROLLBACK_VERSION: '已回滚到版本',
    PREFIX_VERSION: '',
    INFO_VERSION_COMPARE: '版本对比',
    VERSION_REMARK_PREFIX: '基于功效需求生成',
    VERSION_REMARK_SUFFIX: '优化方案',
    DEFAULT_DOSAGE_RANGE: '1.0-3.0g',
    DEFAULT_ROLE_ASSISTANT: '辅助',

    // 安全检查模块
    SAFETY_CHECK_TITLE: '安全性检查',
    SAFETY_CHECK_SUBTITLE: '评估配方的安全性和潜在风险',
    SAFETY_INPUT_PLACEHOLDER: '如: 人参, 黄芪, 山楂, 枸杞子',
    BUTTON_SAFETY_CHECK: '检查',
    BUTTON_CLEAR_ALL: '清除全部',
    LABEL_COMPLIANCE_RATE: '合规率',
    SAFETY_PASSED_MESSAGE: '配方通过安全检查',
    SAFETY_FAILED_MESSAGE: '发现安全问题',
    SAFETY_ERROR_TITLE: '安全检查失败',
    SAFETY_NO_INPUT_TITLE: '输入为空',
    TITLE_ERRORS: '错误',
    TITLE_WARNINGS: '警告',
    BUTTON_RECHECK: '重新检查',
    INFO_EXPORT_REPORT: '导出报告',
    BUTTON_EXPORT_REPORT: '导出报告',
    TITLE_HISTORY: '历史记录',
    UNIT_RECORDS: '条记录',
    BUTTON_CLEAR_HISTORY: '清空',
    SAFETY_CHECK_COMPLETE_TITLE: '安全检查完成',

    // 协同分析模块
    SYNERGY_ANALYSIS_TITLE: '协同效应分析',
    SYNERGY_ANALYSIS_SUBTITLE: '分析成分间的协同作用机制',

    // 肽分析模块
    PEPTIDE_ANALYSIS_TITLE: '肽序列分析',
    PEPTIDE_ANALYSIS_SUBTITLE: '深度分析肽序列的理化性质和功能特性',

    // 肽设计模块
    PEPTIDE_DESIGN_TITLE: '肽设计优化',
    PEPTIDE_DESIGN_SUBTITLE: '基于目标功能设计优化的肽序列',

    // 学术报告模块
    ACADEMIC_REPORT_GENERATOR_TITLE: '学术报告生成器',
    ACADEMIC_REPORT_GENERATOR_SUBTITLE: '基于配方数据自动生成专业学术报告',
    SYNC_SUCCESS_TITLE: '同步成功',
    SYNC_SUCCESS_MESSAGE: '学术报告已同步到独立模块',
    SYNC_ERROR_TITLE: '同步失败',
    BUTTON_SYNCED: '已同步',
    BUTTON_SYNCING: '同步中...',
    BUTTON_SYNC_TO_MODULE: '同步到报告模块',
    TOOLTIP_GO_TO_REPORT: '跳转到学术报告模块',
    BUTTON_VIEW_REPORT: '查看报告',
    BUTTON_GENERATING: '生成中...',
    TAB_PREVIEW: '预览',
    TAB_EDIT: '编辑',
    TAB_ELEMENTS: '学术元素',
    TITLE_INSERT_ELEMENTS: '插入学术元素',
    LABEL_REPORT_TITLE: '报告标题',
    LABEL_AUTHORS: '作者',
    LABEL_KEYWORDS: '关键词',
    LABEL_ABSTRACT: '摘要',
    LABEL_CHAPTERS: '章节内容',
    SECTION_ABSTRACT: '摘要',
    SECTION_REFERENCES: '参考文献',
    PLACEHOLDER_AUTHORS: '多个作者用顿号分隔',
    PLACEHOLDER_KEYWORDS: '多个关键词用顿号分隔',
    MOCK_FORMULA_NAME: '黄芪姜黄复合肽固体饮料',
    MOCK_FORMULA_DESCRIPTION: '基于中医药君臣佐使配伍原则，结合现代营养学研究成果，开发的一款具有免疫调节和抗疲劳功效的药食同源复方产品。',
    MOCK_EFFECT_1: '增强免疫力',
    MOCK_EFFECT_2: '抗疲劳',
    MOCK_EFFECT_3: '调节气血',
    MOCK_EFFECT_4: '健脾养胃',

    // 对话模块（增强版）
    PAGE_TITLE_CHAT: 'AI 配方顾问',
    STATUS_CONNECTED: '已连接',
    STATUS_LLM_NOT_CONFIGURED: 'LLM 未配置（使用内置规则引擎）',
    EXPORT_TITLE_CHAT_HISTORY: 'AI 对话记录',
    LABEL_USER: '用户',
    EXPORT_TIME_PREFIX: '导出时间',
    EXPORT_FILENAME_PREFIX: 'AI对话',
    LABEL_SELECT_FORMAT: '选择导出格式',
    LABEL_SELECT_TEMPLATE: '选择模板',
    LABEL_REALTIME_PREVIEW: '实时预览',
    TOTAL_MESSAGES_PREFIX: '共',
    TOTAL_MESSAGES_SUFFIX: '条对话',
    MORE_EARLIER_MESSAGES: '还有',
    EARLIER_MESSAGES_SUFFIX: '条更早的对话...',
    EMPTY_STATE_MESSAGE: '向 AI 顾问提问，探讨配方设计、药食同源、功效成分等话题',
    ERROR_CONNECTION_FAILED: '连接出错',
    ERROR_APOLOGY: '抱歉，AI 服务暂时不可用。',
    ERROR_INFO_PREFIX: '错误信息：',
    SUGGESTION_RETRY: '建议：\n1. 请稍后重试\n2. 或在系统设置中配置 LLM API Key\n\n支持：OpenAI、DeepSeek、智谱AI、通义千问等。',
    BUTTON_EXPORT: '导出',
    BUTTON_CLEAR: '清空',
    MODAL_TITLE_EXPORT_DIALOG: '导出对话',
    OPTION_DEFAULT_TEMPLATE: '默认模板',
    OPTION_TCM_RECIPE: '中药配方报告',
    OPTION_EXPERIMENT_REPORT: '实验报告',
    CHAT_INPUT_PLACEHOLDER: '输入您的问题...（例如：如何设计一款抗氧化配方？）',
    HINT_ENTER_TO_SEND: '按 Enter 发送，Shift+Enter 换行',
    BUTTON_SEND: '发送',
    BADGE_LLM_CONFIGURED: 'LLM 已配置',
    BADGE_LLM_NOT_CONFIGURED: 'LLM 未配置',
    BUTTON_RETRY: '重试',
    BUTTON_CLOSE: '关闭',
  },

  // 默认评分
  DEFAULT_TASTE_SCORE: 0.6,
  DEFAULT_STABILITY_SCORE: 0.7,
  DEFAULT_SAFETY_SCORE: 0.8,
  DEFAULT_COST_SCORE: 0.7,

  // 其他默认值
  DEFAULT_DOSAGE_RANGE: '1.0-3.0g',

  // 时间格式
  DATE_FORMAT: 'zh-CN',
  TIME_FORMAT_SHORT: 'HH:mm',
  TIME_FORMAT_FULL: 'yyyy-MM-dd HH:mm:ss',
} as const

// ============================================================================
// 错误消息模板 (Error Messages)
// ============================================================================

export const ERROR_MESSAGES = {
  // 通用错误
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  SERVER_ERROR: '服务器内部错误，请联系管理员',
  UNKNOWN_ERROR: '发生未知错误，请稍后重试',

  // 认证错误
  UNAUTHORIZED: '未授权访问，请先登录',
  TOKEN_EXPIRED: '登录已过期，请重新登录',
  FORBIDDEN: '无权限执行此操作',

  // AI服务错误
  AI_SERVICE_UNAVAILABLE: 'AI服务暂时不可用',
  AI_MODEL_NOT_CONFIGURED: 'AI模型未配置，请在设置中配置API Key',
  AI_QUOTA_EXCEEDED: 'API调用额度已耗尽',
  AI_RESPONSE_EMPTY: 'AI返回空响应',
  AI_STREAMING_FAILED: '流式响应失败，已切换到普通模式',

  // 输入验证错误
  INPUT_TOO_LONG: `输入内容过长，最大允许${LIMITS.MAX_INPUT_LENGTH}个字符`,
  INPUT_EMPTY: '输入内容不能为空',
  INVALID_FORMAT: '输入格式不正确',

  // 业务逻辑错误
  SESSION_NOT_FOUND: '会话不存在或已过期',
  FORMULA_GENERATION_FAILED: '配方生成失败，请调整参数后重试',
  SAFETY_CHECK_FAILED: '安全检查失败，请检查输入数据',
  CONCURRENT_REQUEST_DETECTED: '检测到并发请求，上一次请求已被取消',

  // 友好提示
  SUGGESTION_RETRY: '建议：1. 稍后重试 2. 检查输入参数 3. 联系技术支持',
  SUGGESTION_CHECK_NETWORK: '建议：检查网络连接是否正常',
  SUGGESTION_CONTACT_ADMIN: '如问题持续存在，请联系管理员：support@rmfood.com',
} as const

// ============================================================================
// 正则表达式模式 (Regex Patterns)
// ============================================================================

export const PATTERNS = {
  // 输入验证
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^1[3-9]\d{9}$/,
  URL: /^https?:\/\/.+/,

  // 序列验证
  PEPTIDE_SEQUENCE: /^[ACDEFGHIKLMNPQRSTVWY]+$/i,
  DNA_SEQUENCE: /^[ACGT]+$/i,
  RNA_SEQUENCE: /^[ACGU]+$/i,
  SMILES: /^[A-Za-z0-9@+\-\[\]\(\)\\\/=#$]+$/,

  // 格式化
  CAMEL_CASE: /^[a-z][a-zA-Z0-9]*$/,
  SNAKE_CASE: /^[a-z][a-z0-9_]*$/,
  KEBAB_CASE: /^[a-z][a-z0-9-]*$/,

  // 特殊字符检测
  HAS_EMOJI: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u,
  HAS_CHINESE: /[\u4e00-\u9fff]/,
  HAS_SPECIAL_CHAR: /[!@#$%^&*(),.?":{}|<>]/,
} as const

// ============================================================================
// 状态码与类型 (Status Codes & Types)
// ============================================================================

export const STATUS = {
  // HTTP状态码
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // 自定义业务状态码
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',

  // 加载状态
  IDLE: 'idle',
  LOADING: 'loading',
} as const

// 向后兼容性别名：支持 PLACEHOLDER_TEXTs (小写s) 访问
// 注意：由于 DEFAULTS 是 as const，这里仅作类型说明，实际使用 PLACEHOLDER_TEXTS
type PlaceHolderTextsAlias = typeof DEFAULTS.PLACEHOLDER_TEXTS

// ============================================================================
// 风险等级定义 (Risk Levels)
// ============================================================================

export const RISK_LEVELS = {
  SAFE: { value: 'safe', label: '安全', color: 'green', minScore: 85 },
  CAUTION: { value: 'caution', label: '需注意', color: 'yellow', minScore: 60 },
  DANGEROUS: { value: 'dangerous', label: '危险', color: 'red', minScore: 30 },
  CONTRAINDICATED: { value: 'contraindicated', label: '禁忌', color: 'red', minScore: 0 },
} as const

// ============================================================================
// 优先级定义 (Priority Levels)
// ============================================================================

export const PRIORITIES = {
  CRITICAL: { value: 'critical', label: '关键', weight: 4, color: 'red' },
  HIGH: { value: 'high', label: '高', weight: 3, color: 'orange' },
  MEDIUM: { value: 'medium', label: '中', weight: 2, color: 'yellow' },
  LOW: { value: 'low', label: '低', weight: 1, color: 'blue' },
  SUGGESTION: { value: 'suggestion', label: '建议', weight: 0, color: 'gray' },
} as const

// ============================================================================
// 配方分类定义 (Formula Categories)
// ============================================================================

export const FORMULA_CATEGORIES = {
  IMMUNITY: { id: 'immunity', label: '免疫调节', icon: 'Shield', color: 'var(--color-primary-400)', description: '增强免疫力、调节免疫功能' },
  ANTI_FATIGUE: { id: 'anti_fatigue', label: '抗疲劳', icon: 'Zap', color: '#D97706', description: '缓解疲劳、提升精力' },
  DIGESTION: { id: 'digestion', label: '健脾养胃', icon: 'Apple', color: '#FF3B30', description: '调理脾胃、促进消化' },
  SLEEP: { id: 'sleep', label: '安神助眠', icon: 'Moon', color: 'var(--color-accent-500)', description: '改善睡眠、安神定志' },
  BEAUTY: { id: 'beauty', label: '美容养颜', icon: 'Sparkles', color: '#D946EF', description: '美容护肤、延缓衰老' },
  CARDIOVASCULAR: { id: 'cardiovascular', label: '心血管健康', icon: 'Heart', color: '#B91C1C', description: '保护心血管、调节血脂' },
  BONE_JOINT: { id: 'bone_joint', label: '骨骼关节', icon: 'Activity', color: 'var(--color-primary-500)', description: '强健筋骨、关节保健' },
  VISION: { id: 'vision', label: '明目护眼', icon: 'Eye', color: 'var(--color-secondary-500)', description: '保护视力、缓解眼疲劳' },
  RESPIRATORY: { id: 'respiratory', label: '呼吸系统', icon: 'Wind', color: '#6366F1', description: '润肺止咳、清咽利喉' },
  METABOLISM: { id: 'metabolism', label: '代谢调节', icon: 'RefreshCw', color: '#14B8A6', description: '调节代谢、控制体重' },
} as const

export type FormulaCategory = keyof typeof FORMULA_CATEGORIES

export const FORMULA_CATEGORY_LIST = Object.values(FORMULA_CATEGORIES)

// ============================================================================
// 角色定义 (User Roles)
// ============================================================================

export const ROLES = {
  ADMIN: { value: 'admin', label: '管理员', permissions: ['all'] },
  EXPERT: { value: 'expert', label: '专家', permissions: ['read', 'write', 'analyze'] },
  USER: { value: 'user', label: '用户', permissions: ['read', 'write'] },
  GUEST: { value: 'guest', label: '访客', permissions: ['read'] },
} as const

// ============================================================================
// 导出所有常量
// ============================================================================

export default {
  STORAGE_KEYS,
  LIMITS,
  DEFAULTS,
  ERROR_MESSAGES,
  PATTERNS,
  STATUS,
  RISK_LEVELS,
  PRIORITIES,
  ROLES,
}
