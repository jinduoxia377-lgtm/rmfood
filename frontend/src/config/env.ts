import { logger } from '@/utils/safeLogger'
/**
 * 统一环境配置管理
 * 集中管理所有环境变量，支持多环境配置（dev/staging/prod）
 *
 * 使用方法:
 * import { envConfig } from '@/config/env'
 * logger.log(envConfig.api.baseUrl)
 */

export type Environment = 'development' | 'staging' | 'production'

export interface ApiConfig {
  baseUrl: string
  timeout: number
  maxRetries: number
  retryDelay: number
}

export interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
}

export interface AppConfig {
  name: string
  version: string
  defaultUsername: string
  defaultPassword: string
}

export interface FeaturesConfig {
  enableCache: boolean
  enableWebSocket: boolean
  enableRealTimeSync: boolean
  cacheTTL: number
}

export interface EnvConfig {
  env: Environment
  api: ApiConfig
  ws: WebSocketConfig
  app: AppConfig
  features: FeaturesConfig
}

const getEnv = (): Environment => {
  const env = import.meta.env?.VITE_ENV as string
  if (env === 'production') return 'production'
  if (env === 'staging') return 'staging'
  return 'development'
}

const getBaseUrl = (): string => {
  const envUrl = import.meta.env?.VITE_API_BASE_URL as string
  if (envUrl) return envUrl

  if (import.meta.env?.DEV) {
    return '/api/v1'
  }

  return window.location.origin + '/api/v1'
}

const getBackendUrl = (): string => {
  const envUrl = import.meta.env?.VITE_BACKEND_URL as string
  if (envUrl) return envUrl

  return 'http://localhost:8000'
}

const getWebSocketUrl = (): string => {
  const envUrl = import.meta.env?.VITE_WS_URL as string
  if (envUrl) return envUrl

  const backendUrl = getBackendUrl()
  return `${backendUrl.replace('http://', 'ws://').replace('https://', 'wss://')}/api/v1/ws`
}

const getApiTimeout = (): number => {
  const timeout = import.meta.env?.VITE_API_TIMEOUT as string
  return timeout ? parseInt(timeout, 10) : 30000
}

const getMaxRetries = (): number => {
  const retries = import.meta.env?.VITE_MAX_RETRIES as string
  return retries ? parseInt(retries, 10) : 3
}

const getRetryDelay = (): number => {
  const delay = import.meta.env?.VITE_RETRY_DELAY as string
  return delay ? parseInt(delay, 10) : 1000
}

const getCacheTTL = (): number => {
  const ttl = import.meta.env?.VITE_CACHE_TTL as string
  return ttl ? parseInt(ttl, 10) : 300000
}

export const envConfig: EnvConfig = {
  env: getEnv(),

  api: {
    baseUrl: getBaseUrl(),
    timeout: getApiTimeout(),
    maxRetries: getMaxRetries(),
    retryDelay: getRetryDelay(),
  },

  ws: {
    url: getWebSocketUrl(),
    reconnectInterval: parseInt(import.meta.env?.VITE_WS_RECONNECT_INTERVAL || '5000', 10),
    maxReconnectAttempts: parseInt(import.meta.env?.VITE_WS_MAX_RECONNECT || '5', 10),
  },

  app: {
    name: import.meta.env?.VITE_APP_NAME || 'RMFOOD',
    version: import.meta.env?.VITE_APP_VERSION || '1.0.0',
    defaultUsername: import.meta.env?.VITE_DEFAULT_USERNAME || 'admin',
    defaultPassword: import.meta.env?.VITE_DEFAULT_PASSWORD || 'admin123',
  },

  features: {
    enableCache: import.meta.env?.VITE_ENABLE_CACHE !== 'false',
    enableWebSocket: import.meta.env?.VITE_ENABLE_WEBSOCKET === 'true',
    enableRealTimeSync: import.meta.env?.VITE_ENABLE_REALTIME_SYNC === 'true',
    cacheTTL: getCacheTTL(),
  },
}

export const getCurrentEnv = (): Environment => envConfig.env

export const isDevelopment = (): boolean => envConfig.env === 'development'

export const isProduction = (): boolean => envConfig.env === 'production'

export const isStaging = (): boolean => envConfig.env === 'staging'

export default envConfig
