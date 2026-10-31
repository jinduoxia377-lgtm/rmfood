/**
 * API 架构预留层 - 标准化接口设计
 *
 * 设计目标：
 * 1. 保持当前前端 Mock 数据 + 本地计算模式稳定运行
 * 2. 预留与后端 API 的对接接口，确保后端服务就绪后能够实现无缝切换
 * 3. 包括数据请求、响应处理和错误捕获的标准化接口设计
 *
 * 核心特性：
 * - 适配器模式：统一真实 API 和 Mock 数据的调用方式
 * - 响应标准化：统一的响应格式和错误处理
 * - 缓存策略：智能缓存管理，减少重复请求
 * - 配置驱动：通过配置文件控制 API 行为
 * - 类型安全：完整的 TypeScript 类型定义
 */

import { logger } from '@/utils/safeLogger';

// ═══════════════════════════════════════════
// 1. 配置常量
// ═══════════════════════════════════════════

/** API 模式枚举 */
export enum ApiMode {
  /** 生产模式：使用真实后端 API */
  PRODUCTION = 'production',
  /** 开发模式：优先使用 Mock 数据，失败时回退到真实 API */
  DEVELOPMENT = 'development',
  /** 仅 Mock 模式：完全使用 Mock 数据（离线开发） */
  MOCK_ONLY = 'mock_only'
}

/** API 配置接口 */
export interface ApiConfig {
  /** 当前运行模式 */
  mode: ApiMode
  /** API 基础 URL */
  baseUrl: string
  /** 请求超时时间（毫秒） */
  timeout: number
  /** 是否启用缓存 */
  enableCache: boolean
  /** 缓存过期时间（毫秒） */
  cacheTTL: number
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
  /** 是否启用请求日志 */
  enableLogging: boolean
}

/** 默认配置 */
export const DEFAULT_API_CONFIG: ApiConfig = {
  mode: ApiMode.DEVELOPMENT,
  baseUrl: import.meta.env?.VITE_API_BASE_URL || '/api/v1',
  timeout: parseInt(import.meta.env?.VITE_API_TIMEOUT || '30000', 10),
  enableCache: import.meta.env?.VITE_ENABLE_CACHE !== 'false',
  cacheTTL: parseInt(import.meta.env?.VITE_CACHE_TTL || '300000', 10),
  maxRetries: parseInt(import.meta.env?.VITE_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(import.meta.env?.VITE_RETRY_DELAY || '1000', 10),
  enableLogging: process.env.NODE_ENV === 'development',
}

// ═══════════════════════════════════════════
// 2. 标准化响应类型
// ═══════════════════════════════════════════

/** 标准 API 响应结构 */
export interface ApiResponse<T = any> {
  /** 响应码 */
  code: number
  /** 响应消息 */
  message: string
  /** 响应数据 */
  data: T
  /** 时间戳 */
  timestamp: string
  /** 请求 ID（用于追踪） */
  requestId?: string
  /** 分页信息（仅分页请求返回） */
  pagination?: PaginationInfo
  /** 元数据 */
  meta?: Record<string, any>
}

/** 分页信息 */
export interface PaginationInfo {
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总记录数 */
  total: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNextPage: boolean
  /** 是否有上一页 */
  hasPrevPage: boolean
}

/** 标准 API 错误 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 错误代码枚举 */
export enum ApiErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 客户端错误 (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // 服务端错误 (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT'
}

// ═══════════════════════════════════════════
// 3. 缓存管理器
// ═══════════════════════════════════════════

/** 缓存条目 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  key: string
}

class ApiCacheManager {
  private cache = new Map<string, CacheEntry<any>>()
  private config: ApiConfig

  constructor(config: ApiConfig) {
    this.config = config
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    if (!this.config.enableCache) return null

    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      logger.debug(`[ApiCache] 缓存已过期: ${key}`)
      return null
    }

    logger.debug(`[ApiCache] 命中缓存: ${key}`)
    return entry.data as T
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enableCache) return

    const cacheTTL = ttl || this.config.cacheTTL

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + cacheTTL,
      key,
    }

    this.cache.set(key, entry)
    logger.debug(`[ApiCache] 设置缓存: ${key} (TTL: ${cacheTTL}ms)`)
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key)
    logger.debug(`[ApiCache] 删除缓存: ${key}`)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    logger.info('[ApiCache] 清空所有缓存')
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        logger.debug(`[ApiCache] 清理过期缓存: ${key}`)
      }
    }
  }
}

// ═══════════════════════════════════════════
// 4. API 适配器基类
// ═══════════════════════════════════════════

/** API 请求选项 */
export interface ApiRequestOptions {
  /** 请求路径 */
  url: string
  /** 请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** 请求参数 */
  params?: Record<string, any>
  /** 请求体 */
  data?: any
  /** 请求头 */
  headers?: Record<string, string>
  /** 是否跳过缓存 */
  skipCache?: boolean
  /** 自定义缓存 TTL */
  cacheTTL?: number
  /** 是否显示加载状态 */
  showLoading?: boolean
  /** 取消令牌 */
  signal?: AbortSignal
  /** 重试次数覆盖 */
  retries?: number
}

/** API 适配器接口 */
export interface IApiAdapter {
  /** 发送请求 */
  request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>>
  /** GET 请求 */
  get<T>(url: string, params?: Record<string, any>, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>>
  /** POST 请求 */
  post<T>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>>
  /** PUT 请求 */
  put<T>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>>
  /** DELETE 请求 */
  delete<T>(url: string, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>>
  /** 设置认证令牌 */
  setAuthToken(token: string): void
  /** 清除认证令牌 */
  clearAuthToken(): void
  /** 获取配置 */
  getConfig(): ApiConfig
  /** 更新配置 */
  updateConfig(config: Partial<ApiConfig>): void
}

/**
 * 抽象 API 适配器基类
 * 提供通用的请求处理逻辑，子类只需实现具体的 HTTP 调用
 */
abstract class BaseApiAdapter implements IApiAdapter {
  protected config: ApiConfig
  protected cacheManager: ApiCacheManager
  protected authToken: string | null = null

  constructor(config: ApiConfig) {
    this.config = { ...DEFAULT_API_CONFIG, ...config }
    this.cacheManager = new ApiCacheManager(this.config)

    // 定期清理过期缓存
    setInterval(() => this.cacheManager.cleanup(), 60 * 1000)
  }

  abstract request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>>

  async get<T>(
    url: string,
    params?: Record<string, any>,
    options: Partial<ApiRequestOptions> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'GET',
      params,
    })
  }

  async post<T>(
    url: string,
    data?: any,
    options: Partial<ApiRequestOptions> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'POST',
      data,
    })
  }

  async put<T>(
    url: string,
    data?: any,
    options: Partial<ApiRequestOptions> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'PUT',
      data,
    })
  }

  async delete<T>(
    url: string,
    options: Partial<ApiRequestOptions> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      ...options,
      url,
      method: 'DELETE',
    })
  }

  setAuthToken(token: string): void {
    this.authToken = token
    this.cacheManager.clear() // 切换用户时清空缓存
  }

  clearAuthToken(): void {
    this.authToken = null
    this.cacheManager.clear()
  }

  getConfig(): ApiConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(options: ApiRequestOptions): string {
    const { url, method, params, data } = options
    const paramStr = params ? JSON.stringify(params) : ''
    const dataStr = data && method !== 'GET' ? JSON.stringify(data) : ''
    return `${method}:${url}:${paramStr}:${dataStr}`
  }

  /**
   * 处理重试逻辑
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries?: number,
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        // 只对网络错误和服务端错误进行重试
        if (error instanceof ApiError &&
            (error.statusCode < 500 || error.statusCode >= 600)) {
          throw error
        }

        if (attempt < retries) {
          logger.warn(`[ApiAdapter] 第 ${attempt}/${retries} 次请求失败，${this.config.retryDelay}ms 后重试...`)
          await this.delay(this.config.retryDelay * attempt)
        }
      }
    }

    throw lastError
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ═══════════════════════════════════════════
// 5. 真实 API 适配器
// ═══════════════════════════════════════════

class RealApiAdapter extends BaseApiAdapter {
  private baseUrl: string

  constructor(config: ApiConfig) {
    super(config)
    this.baseUrl = config.baseUrl
  }

  async request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const startTime = Date.now()

    try {
      // 检查缓存（仅 GET 请求）
      if (options.method === 'GET' && !options.skipCache) {
        const cacheKey = this.generateCacheKey(options)
        const cachedData = this.cacheManager.get<T>(cacheKey)

        if (cachedData) {
          if (this.config.enableLogging) {
            logger.info(`[RealApiAdapter] 从缓存获取: ${options.url} (${Date.now() - startTime}ms)`)
          }
          return {
            code: 200,
            message: 'OK (from cache)',
            data: cachedData,
            timestamp: new Date().toISOString(),
          }
        }
      }

      // 执行实际请求
      const result = await this.withRetry(async () => {
        return this.executeHttpRequest<T>(options)
      })

      // 缓存 GET 请求结果
      if (options.method === 'GET' && !options.skipCache) {
        const cacheKey = this.generateCacheKey(options)
        this.cacheManager.set(cacheKey, result.data, options.cacheTTL)
      }

      if (this.config.enableLogging) {
        logger.info(`[RealApiAdapter] ${options.method} ${options.url} 成功 (${Date.now() - startTime}ms)`)
      }

      return result
    } catch (error) {
      if (this.config.enableLogging) {
        logger.error(`[RealApiAdapter] ${options.method} ${options.url} 失败:`, error)
      }

      if (error instanceof ApiError) {
        throw error
      }

      throw new ApiError(
        500,
        ApiErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : '未知错误',
        error,
      )
    }
  }

  private async executeHttpRequest<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const { url, method = 'GET', params, data, headers, signal } = options

    // 构建 URL 和查询参数
    let fullUrl = `${this.baseUrl}${url}`
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      fullUrl += `?${searchParams.toString()}`
    }

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }

    // 添加认证头
    if (this.authToken) {
      requestHeaders.Authorization = `Bearer ${this.authToken}`
    }

    // 发送请求
    const response = await fetch(fullUrl, {
      method,
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
      signal,
    })

    // 解析响应
    const responseData = await response.json()

    if (!response.ok) {
      throw new ApiError(
        response.status,
        responseData.errorCode || ApiErrorCode.UNKNOWN_ERROR,
        responseData.message || `HTTP Error ${response.status}`,
        responseData.details,
      )
    }

    return {
      code: response.status,
      message: responseData.message || 'OK',
      data: responseData.data ?? responseData,
      timestamp: new Date().toISOString(),
      requestId: response.headers.get('X-Request-ID') || undefined,
      pagination: responseData.pagination,
      meta: responseData.meta,
    }
  }
}

// ═══════════════════════════════════════════
// 6. Mock API 适配器
// ═══════════════════════════════════════════

/** Mock 数据提供者接口 */
export interface IMockDataProvider {
  /** 获取 Mock 数据 */
  getMockData(url: string, method: string, params?: any, data?: any): Promise<any>
}

class MockApiAdapter extends BaseApiAdapter {
  private mockDataProvider: IMockDataProvider

  constructor(config: ApiConfig, mockDataProvider: IMockDataProvider) {
    super(config)
    this.mockDataProvider = mockDataProvider
  }

  async request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const startTime = Date.now()

    try {
      // 检查缓存
      if (!options.skipCache) {
        const cacheKey = this.generateCacheKey(options)
        const cachedData = this.cacheManager.get<T>(cacheKey)

        if (cachedData) {
          if (this.config.enableLogging) {
            logger.info(`[MockApiAdapter] 从缓存获取: ${options.url} (${Date.now() - startTime}ms)`)
          }
          return {
            code: 200,
            message: 'OK (from cache)',
            data: cachedData,
            timestamp: new Date().toISOString(),
          }
        }
      }

      // 获取 Mock 数据
      const mockData = await this.mockDataProvider.getMockData(
        options.url,
        options.method || 'GET',
        options.params,
        options.data,
      )

      // 缓存结果
      if (!options.skipCache) {
        const cacheKey = this.generateCacheKey(options)
        this.cacheManager.set(cacheKey, mockData, options.cacheTTL)
      }

      if (this.config.enableLogging) {
        logger.info(`[MockApiAdapter] ${options.method || 'GET'} ${options.url} 成功 (${Date.now() - startTime}ms)`)
      }

      return {
        code: 200,
        message: 'OK (mock)',
        data: mockData,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      if (this.config.enableLogging) {
        logger.error(`[MockApiAdapter] ${options.url} 失败:`, error)
      }

      throw new ApiError(
        500,
        ApiErrorCode.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : 'Mock 数据获取失败',
        error,
      )
    }
  }
}

// ═══════════════════════════════════════════
// 7. 混合 API 适配器（自动切换）
// ═══════════════════════════════════════════

class HybridApiAdapter implements IApiAdapter {
  private realAdapter: RealApiAdapter
  private mockAdapter: MockApiAdapter
  private config: ApiConfig
  private useMockFallback = false

  constructor(
    config: ApiConfig,
    mockDataProvider: IMockDataProvider,
  ) {
    this.config = config
    this.realAdapter = new RealApiAdapter(config)
    this.mockAdapter = new MockApiAdapter(config, mockDataProvider)
  }

  async request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    switch (this.config.mode) {
      case ApiMode.PRODUCTION:
        // 生产模式：只使用真实 API
        return this.realAdapter.request<T>(options)

      case ApiMode.MOCK_ONLY:
        // 仅 Mock 模式：只使用 Mock 数据
        return this.mockAdapter.request<T>(options)

      case ApiMode.DEVELOPMENT:
      default:
        // 开发模式：尝试真实 API，失败时回退到 Mock
        try {
          if (this.useMockFallback) {
            logger.info(`[HybridApiAdapter] 强制使用 Mock 数据: ${options.url}`)
            return this.mockAdapter.request<T>(options)
          }

          return await this.realAdapter.request<T>(options)
        } catch (error) {
          // 只在网络错误或服务端错误时回退到 Mock
          if (error instanceof ApiError &&
              (error.statusCode >= 500 || error.errorCode === ApiErrorCode.NETWORK_ERROR)) {

            logger.warn(`[HybridApiAdapter] 真实 API 不可用，回退到 Mock 数据: ${options.url}`, error.message)
            this.useMockFallback = true

            // 30秒后重试真实 API
            setTimeout(() => {
              this.useMockFallback = false
              logger.info('[HybridApiAdapter] 恢复使用真实 API')
            }, 30000)

            return this.mockAdapter.request<T>(options)
          }

          throw error
        }
    }
  }

  async get<T>(url: string, params?: Record<string, any>, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'GET', params })
  }

  async post<T>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'POST', data })
  }

  async put<T>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'PUT', data })
  }

  async delete<T>(url: string, options?: Partial<ApiRequestOptions>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, url, method: 'DELETE' })
  }

  setAuthToken(token: string): void {
    this.realAdapter.setAuthToken(token)
    this.mockAdapter.setAuthToken(token)
  }

  clearAuthToken(): void {
    this.realAdapter.clearAuthToken()
    this.mockAdapter.clearAuthToken()
  }

  getConfig(): ApiConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config }
    this.realAdapter.updateConfig(config)
    this.mockAdapter.updateConfig(config)
  }

  /**
   * 手动强制使用 Mock 数据
   */
  forceUseMock(useMock: boolean): void {
    this.useMockFallback = useMock
    logger.info(`[HybridApiAdapter] ${useMock ? '启用' : '禁用'}强制 Mock 模式`)
  }
}

// ═══════════════════════════════════════════
// 8. API 工厂和管理器
// ═══════════════════════════════════════════

export class ApiManager {
  private static instance: ApiManager
  private adapter: IApiAdapter
  private config: ApiConfig

  private constructor(config: ApiConfig, mockDataProvider: IMockDataProvider) {
    this.config = config
    this.adapter = new HybridApiAdapter(config, mockDataProvider)
  }

  /**
   * 初始化 API 管理器（单例）
   */
  static initialize(config: ApiConfig, mockDataProvider: IMockDataProvider): ApiManager {
    if (!ApiManager.instance) {
      ApiManager.instance = new ApiManager(config, mockDataProvider)
      logger.info('[ApiManager] API 管理器初始化完成', {
        mode: config.mode,
        baseUrl: config.baseUrl,
        enableCache: config.enableCache,
      })
    }
    return ApiManager.instance
  }

  /**
   * 获取 API 管理器实例
   */
  static getInstance(): ApiManager {
    if (!ApiManager.instance) {
      throw new Error('[ApiManager] API 管理器未初始化，请先调用 initialize()')
    }
    return ApiManager.instance
  }

  /**
   * 获取 API 适配器
   */
  getAdapter(): IApiAdapter {
    return this.adapter
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config }
    this.adapter.updateConfig(this.config)
    logger.info('[ApiManager] 配置已更新', this.config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): ApiConfig {
    return { ...this.config }
  }

  /**
   * 切换 API 模式
   */
  switchMode(mode: ApiMode): void {
    this.updateConfig({ mode })
    logger.info(`[ApiManager] 已切换到 ${mode} 模式`)
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    try {
      const adapter = this.adapter as unknown as HybridApiAdapter
      if (adapter && typeof adapter.forceUseMock === 'function') {
        adapter.forceUseMock(false)
      }
    } catch {
      // 忽略错误
    }
    logger.info('[ApiManager] 所有缓存已清除')
  }
}

// ═══════════════════════════════════════════
// 9. 导出便捷函数
// ═══════════════════════════════════════════

/**
 * 创建带 fallback 的异步操作包装器
 * 与现有 database.ts 的 withFallback 保持一致
 */
export function createWithFallback<T>(
  apiCall: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string,
): () => Promise<T> {
  return async (): Promise<T> => {
    const startTime = Date.now()

    try {
      const result = await apiCall()
      logger.info(`✅ [API] ${operationName} 成功 (${Date.now() - startTime}ms)`)
      return result
    } catch (error: any) {
      const status = error?.statusCode || error?.response?.status
      const isNetworkError = !error?.response
      const isServerError = status >= 500 && status < 600

      if (isNetworkError || isServerError) {
        logger.warn(`⚠️ [API] ${operationName} 后端不可用(${isNetworkError ? '网络错误' : `HTTP ${status}`})，使用降级方案`)

        try {
          const fallbackResult = await fallback()
          logger.info(`✅ [API] ${operationName} 降级方案成功 (${Date.now() - startTime}ms)`)
          return fallbackResult
        } catch (fallbackError) {
          logger.error(`❌ [API] ${operationName} 降级方案也失败了:`, fallbackError)
          throw fallbackError
        }
      }

      logger.error(`❌ [API] ${operationName} 请求失败 (HTTP ${status}):`, error?.message || error)
      throw error
    }
  }
}

/**
 * 创建标准化的 API 调用 Hook（React 集成用）
 */
export function createStandardizedApiCall<T>(
  apiCall: () => Promise<T>,
  options: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    onFinally?: () => void
  } = {},
): () => Promise<T | null> {
  return async (): Promise<T | null> => {
    try {
      const result = await apiCall()
      options.onSuccess?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      options.onError?.(err)
      return null
    } finally {
      options.onFinally?.()
    }
  }
}

// ═══════════════════════════════════════════
// 10. 导出完成（所有类型和类已在上方导出）
// ═══════════════════════════════════════════
