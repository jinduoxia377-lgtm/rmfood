/**
 * API 端点配置 - 统一管理所有后端 API 路径
 *
 * 使用方法:
 * import { API_ENDPOINTS, getApiBaseUrl } from '@/config/apiEndpoints'
 * fetch(getApiBaseUrl() + API_ENDPOINTS.AI.CHAT, { ... })
 */

import { envConfig } from './env'

const API_BASE_URL = envConfig.api.baseUrl

export const API_ENDPOINTS = {
  // ===== AI 智能服务模块 (/api/v1/ai/*) =====
  AI: {
    BASE: `${API_BASE_URL}/ai`,
    CHAT: `${API_BASE_URL}/ai/chat`,
    CHAT_STREAM: `${API_BASE_URL}/ai/chat/stream`,
    GENERATE: `${API_BASE_URL}/ai/generate`,
    GENERATE_NEURAL: `${API_BASE_URL}/ai/generate/neural`,
    SAFETY_CHECK: `${API_BASE_URL}/ai/safety-check`,
    SYNERGY_ANALYSIS: `${API_BASE_URL}/ai/synergy-analysis`,
    TASTE_PREDICT: `${API_BASE_URL}/ai/taste-predict`,
    STABILITY_PREDICT: `${API_BASE_URL}/ai/stability`,
    PEPTIDE_SCORE: `${API_BASE_URL}/ai/peptide-score`,
    MODELS_STATUS: `${API_BASE_URL}/ai/models/status`,
    MODELS_CONFIG: `${API_BASE_URL}/ai/models/config`,
  },

  // ===== 认证模块 (/api/v1/auth/*) =====
  AUTH: {
    BASE: `${API_BASE_URL}/auth`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
  },

  // ===== 用户模块 (/api/v1/users/*) =====
  USERS: {
    BASE: `${API_BASE_URL}/users`,
    PROFILE: `${API_BASE_URL}/users/profile`,
    SETTINGS: `${API_BASE_URL}/users/settings`,
  },

  // ===== 配方模块 (/api/v1/formulas/*) =====
  FORMULAS: {
    BASE: `${API_BASE_URL}/formulas`,
    LIST: `${API_BASE_URL}/formulas`,
    DETAIL: (id: string) => `${API_BASE_URL}/formulas/${id}`,
    CREATE: `${API_BASE_URL}/formulas`,
  },
} as const

export const getApiBaseUrl = (): string => API_BASE_URL

/**
 * 类型安全的 API 端点类型定义
 */
export type ApiEndpoint = typeof API_ENDPOINTS
