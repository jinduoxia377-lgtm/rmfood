/**
 * 配置统一导出中心
 *
 * @version 4.0.0
 * @description 集中管理所有配置模块的导出，确保模块间依赖清晰
 */

// 环境配置
export {
  envConfig,
  getCurrentEnv,
  isDevelopment,
  isProduction,
  isStaging,
  type Environment,
  type EnvConfig,
  type ApiConfig,
  type WebSocketConfig,
  type AppConfig,
} from './env';

// API 端点配置
export { API_ENDPOINTS, getApiBaseUrl, type ApiEndpoint } from './apiEndpoints';

// AI 模块配置
export {
  AIIcons,
  StandardIcon,
  getAIIcon,
  renderIcon,
  type AIIconName,
  type IconProps,
  type IconSize,
  type IconVariant,
} from './ai.icons';
export {
  STORAGE_KEYS,
  LIMITS,
  DEFAULTS,
  ERROR_MESSAGES,
  PATTERNS,
  STATUS,
  RISK_LEVELS,
  PRIORITIES,
  ROLES,
  FORMULA_CATEGORIES,
  type FormulaCategory,
} from './ai.constants';

// GenerateTab 配置
export {
  GENERATE_TAB_CONFIG,
  VIEW_MODE,
  INPUT_MODE,
  HERB_ROLES,
  PLACEHOLDER_TEXTS as GENERATE_PLACEHOLDER_TEXTS,
  DEFAULT_DOSAGE_RANGE,
  VALIDATION,
  TIMEOUTS,
  STORAGE_KEYS as GENERATE_STORAGE_KEYS,
  DEFAULTS as GENERATE_DEFAULTS,
  CATEGORY_EFFECTS,
  FORMULA_CATEGORY_LIST,
  getCategoryEffects,
  type HerbRole,
  type InputMode,
  type ViewMode,
} from '@/components/ai/features/GenerateTab/config/generateTabConfig';

// 应用核心配置
export {
  BRAND_CONFIG,
  LOGIN_PAGE_CONFIG,
  RHINE_BRAND_CONFIG,
  RHINE_LOGIN_CONFIG,
  RHINE_FORGOT_CONFIG,
  RHINE_RESET_CONFIG,
  DASHBOARD_CONFIG,
  STATUS_CONFIG,
} from './app.config';

// 主题配置已迁移到 @/theme (Zustand 系统)
// export { PROFESSIONAL_THEMES } from './theme.config';

// 便捷导入
export { getAIConfig as config } from './ai.config';
export { LIMITS as limits } from './ai.constants';
export { DEFAULTS as defaults } from './ai.constants';
export { ERROR_MESSAGES as errors } from './ai.constants';
