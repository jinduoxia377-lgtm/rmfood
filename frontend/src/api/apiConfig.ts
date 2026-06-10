/**
 * API 架构配置
 * 集中管理所有 API 相关的配置项
 */

import { ApiMode } from './apiArchitecture'
import type { ApiConfig } from './apiArchitecture'

/**
 * 根据环境变量获取当前 API 模式
 */
function getApiModeFromEnv(): ApiMode {
  const envMode = import.meta.env?.VITE_API_MODE as string

  switch (envMode) {
    case 'production':
      return ApiMode.PRODUCTION
    case 'mock_only':
      return ApiMode.MOCK_ONLY
    case 'development':
    default:
      return ApiMode.DEVELOPMENT
  }
}

/**
 * 获取 API 基础 URL
 */
function getBaseUrl(): string {
  // 优先使用环境变量，否则使用默认值
  const envUrl = import.meta.env?.VITE_API_BASE_URL as string

  if (envUrl) {
    return envUrl
  }

  // 开发环境默认使用相对路径（由 Vite dev server 代理）
  if (import.meta.env?.DEV) {
    return '/api/v1'
  }

  // 生产环境使用完整 URL
  return window.location.origin + '/api/v1'
}

/**
 * 默认 API 配置
 */
export const apiConfig: ApiConfig = {
  mode: getApiModeFromEnv(),
  baseUrl: getBaseUrl(),
  timeout: parseInt(import.meta.env?.VITE_API_TIMEOUT || '30000'),
  enableCache: import.meta.env?.VITE_ENABLE_CACHE !== 'false',
  cacheTTL: parseInt(import.meta.env?.VITE_CACHE_TTL || '300000'), // 5分钟
  maxRetries: parseInt(import.meta.env?.VITE_MAX_RETRIES || '3'),
  retryDelay: parseInt(import.meta.env?.VITE_RETRY_DELAY || '1000'),
  enableLogging: import.meta.env?.DEV === true,
}

/**
 * 功能开关配置
 * 用于控制特定功能的启用/禁用
 */
export const featureFlags = {
  // 是否启用实时数据同步
  enableRealTimeSync: import.meta.env?.VITE_ENABLE_REALTIME_SYNC === 'true',

  // 是否启用 WebSocket 连接
  enableWebSocket: import.meta.env?.VITE_ENABLE_WEBSOCKET === 'true',

  // 是否启用数据导出功能
  enableDataExport: true, // 始终启用

  // 是否启用 PDF 导出
  enablePdfExport: true, // 始终启用

  // 是否启用图表可视化
  enableCharts: true, // 始终启用

  // 是否启用高级搜索功能
  enableAdvancedSearch: true,

  // 是否启用知识图谱功能
  enableKnowledgeGraph: true,

  // 是否启用数据质量报告
  enableDataQualityReport: true,
}

/**
 * API 端点配置
 * 集中管理所有 API 端点路径
 */
export const apiEndpoints = {
  // 认证相关
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },

  // 用户管理
  users: {
    list: '/users',
    detail: (id: number) => `/users/${id}`,
    create: '/users',
    update: (id: number) => `/users/${id}`,
    delete: (id: number) => `/users/${id}`,
  },

  // 配方管理
  formulas: {
    list: '/formulas',
    detail: (id: number) => `/formulas/${id}`,
    create: '/formulas',
    update: (id: number) => `/formulas/${id}`,
    delete: (id: number) => `/formulas/${id}`,
  },

  // AI 服务
  ai: {
    generate: '/ai/generate',
    analyze: '/ai/analyze',
    chat: '/ai/chat',
    suggestions: '/ai/suggestions',
  },

  // 数据库服务
  database: {
    herbs: {
      search: '/databases/herbs',
      detail: (id: number) => `/databases/herbs/${id}`,
      categories: '/databases/herbs/categories',
      foodHomology: '/databases/herbs/food-homology',
      checkFoodHomology: '/databases/herbs/food-homology/check',
    },
    peptides: {
      search: '/databases/peptides',
      detail: (id: number) => `/databases/peptides/${id}`,
      activityTypes: '/databases/peptides/activity-types',
    },
    knowledgeGraph: {
      search: '/databases/knowledge-graph/search',
      relations: '/databases/knowledge-graph/relations',
      stats: '/databases/knowledge-graph/stats',
      path: '/databases/knowledge-graph/path',
      subgraph: '/databases/knowledge-graph/subgraph',
      herbPath: '/databases/knowledge-graph/herb-path',
      interactions: '/databases/knowledge-graph/interactions',
    },
    unifiedSearch: '/databases/unified-search',
    crossSearch: '/databases/cross-search',
    sync: {
      herbs: '/databases/sync/herbs',
      peptides: '/databases/sync/peptides',
      stats: '/databases/sync/stats',
    },
    dashboard: {
      overview: '/databases/dashboard/overview',
      trends: '/databases/dashboard/trends',
    },
    dataQuality: '/databases/data-quality',
    suggestions: '/databases/suggestions',
    snapshots: '/databases/snapshots',
  },

  // 文件服务
  files: {
    upload: '/files/upload',
    download: (fileId: string) => `/files/download/${fileId}`,
    preview: (fileId: string) => `/files/preview/${fileId}`,
  },

  // 导出服务
  export: {
    csv: '/export/csv',
    excel: '/export/excel',
    pdf: '/export/pdf',
    json: '/export/json',
  },
} as const

/**
 * 错误消息映射
 * 将错误代码转换为用户友好的错误消息
 */
export const errorMessages: Record<string, string> = {
  // 网络错误
  NETWORK_ERROR: '网络连接失败，请检查网络设置后重试',
  TIMEOUT_ERROR: '请求超时，请稍后重试',

  // 客户端错误
  BAD_REQUEST: '请求参数有误，请检查输入内容',
  UNAUTHORIZED: '登录已过期，请重新登录',
  FORBIDDEN: '没有权限执行此操作',
  NOT_FOUND: '请求的资源不存在',
  VALIDATION_ERROR: '数据验证失败，请检查输入格式',

  // 服务端错误
  INTERNAL_SERVER_ERROR: '服务器内部错误，请联系管理员',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试',
  GATEWAY_TIMEOUT: '服务器响应超时，请稍后重试',

  // 业务错误
  DATA_NOT_FOUND: '未找到相关数据',
  DUPLICATE_DATA: '数据已存在，不能重复添加',
  INVALID_OPERATION: '操作无效，请检查业务逻辑',
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyErrorMessage(errorCode: string, fallback?: string): string {
  return errorMessages[errorCode] || fallback || '未知错误，请稍后重试'
}
