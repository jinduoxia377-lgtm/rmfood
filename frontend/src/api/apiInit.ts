/**
 * API 架构初始化
 * 在应用启动时调用此文件初始化整个 API 系统
 */

import { ApiManager, ApiMode } from './apiArchitecture'
import type { IApiAdapter, IMockDataProvider } from './apiArchitecture'
import { apiConfig } from './apiConfig'
import { mockDatabaseApi } from './database.mock'
import { logger } from '@/utils/safeLogger';

/**
 * Mock 数据提供者实现
 * 将现有的 mockDatabaseApi 包装为标准接口
 */
class DatabaseMockProvider implements IMockDataProvider {
  async getMockData(url: string, method: string, params?: any, _data?: any): Promise<any> {
    const startTime = Date.now()

    try {
      // 根据不同的 URL 路由到对应的 mock 函数
      if (url.includes('/databases/herbs') && !url.includes('/food-homology')) {
        if (method === 'GET' && url.includes('/categories')) {
          return mockDatabaseApi.getCategories()
        }
        if (method === 'GET' && params?.keyword || params?.category) {
          return mockDatabaseApi.searchHerbs(params)
        }
        // 获取药材详情
        const herbIdMatch = /\/databases\/herbs\/(\d+)/.exec(url)
        if (herbIdMatch && herbIdMatch[1]) {
          return mockDatabaseApi.getHerb(parseInt(herbIdMatch[1]) || 0)
        }
        return mockDatabaseApi.searchHerbs(params || {})
      }

      if (url.includes('/databases/peptides')) {
        if (method === 'GET' && url.includes('/activity-types')) {
          return mockDatabaseApi.getActivityTypes()
        }
        if (params?.keyword || params?.activity_type) {
          return mockDatabaseApi.searchPeptides(params)
        }
        // 获取肽详情
        const peptideIdMatch = /\/databases\/peptides\/(\d+)/.exec(url)
        if (peptideIdMatch && peptideIdMatch[1]) {
          return mockDatabaseApi.getPeptide(parseInt(peptideIdMatch[1]))
        }
        return mockDatabaseApi.searchPeptides(params || {})
      }

      if (url.includes('/databases/knowledge-graph')) {
        if (url.includes('/search')) {
          return mockDatabaseApi.searchKnowledge(params)
        }
        if (url.includes('/stats')) {
          // 使用类型断言来访问可能不存在的方法
          const mockApi = mockDatabaseApi as Record<string, unknown>
          return (mockApi['getGraphStats'] as (() => unknown) | undefined)?.() || { total_nodes: 0, total_edges: 0, node_types: {} }
        }
        return { items: [], total: 0 }
      }

      if (url.includes('/databases/unified-search')) {
        return mockDatabaseApi.unifiedSearch(params)
      }

      if (url.includes('/databases/dashboard/overview')) {
        return mockDatabaseApi.getDashboardOverview()
      }

      if (url.includes('/databases/dashboard/trends')) {
        return mockDatabaseApi.getDashboardTrends()
      }

      if (url.includes('/databases/cross-search')) {
        return mockDatabaseApi.crossSearch(params?.herb_name)
      }

      if (url.includes('/databases/data-quality')) {
        return mockDatabaseApi.getDataQuality()
      }

      if (url.includes('/databases/sync/stats')) {
        return mockDatabaseApi.getSyncStats()
      }

      if (url.includes('/databases/suggestions')) {
        return mockDatabaseApi.getSearchSuggestions(params?.keyword, params?.limit)
      }

      // 默认返回空数据
      logger.warn(`[MockProvider] 未找到 ${method} ${url} 的 Mock 数据，返回默认值`)
      return { data: [], total: 0, page: 1, page_size: 10 }

    } catch (error) {
      logger.error(`[MockProvider] 获取 Mock 数据失败: ${url}`, error)
      throw error
    } finally {
      logger.debug(`[MockProvider] ${method} ${url} 完成 (${Date.now() - startTime}ms)`)
    }
  }
}

/**
 * 初始化 API 系统
 * 应在应用启动时（如 main.tsx 或 App.tsx）调用一次
 */
export function initializeApiSystem(): IApiAdapter {
  try {
    // 创建 Mock 数据提供者
    const mockProvider = new DatabaseMockProvider()

    // 初始化 API 管理器
    const apiManager = ApiManager.initialize(apiConfig, mockProvider)

    logger.info('[API System] ✅ API 系统初始化成功', {
      mode: apiConfig.mode,
      baseUrl: apiConfig.baseUrl,
      enableCache: apiConfig.enableCache,
      cacheTTL: apiConfig.cacheTTL,
      maxRetries: apiConfig.maxRetries,
    })

    // 返回适配器实例供使用
    return apiManager.getAdapter()

  } catch (error) {
    logger.error('[API System] ❌ API 系统初始化失败:', error)

    // 降级：返回一个简单的错误处理适配器
    return createFallbackAdapter(error as Error)
  }
}

/**
 * 降级适配器
 * 当主系统初始化失败时使用
 */
function createFallbackAdapter(_initError: Error): IApiAdapter {
  logger.warn('[API System] 使用降级模式运行')

  return {
    async request(_options: any): Promise<any> {
      logger.warn('[FallbackAdapter] 请求被拦截')
      throw new Error('API 系统未正确初始化')
    },
    async get(url: string, params?: any, options?: any): Promise<any> {
      return this.request({ ...options, url, method: 'GET', params })
    },
    async post(url: string, data?: any, options?: any): Promise<any> {
      return this.request({ ...options, url, method: 'POST', data })
    },
    async put(url: string, data?: any, options?: any): Promise<any> {
      return this.request({ ...options, url, method: 'PUT', data })
    },
    async delete(url: string, options?: any): Promise<any> {
      return this.request({ ...options, url, method: 'DELETE' })
    },
    setAuthToken(_token: string): void {},
    clearAuthToken(): void {},
    getConfig(): any {
      return apiConfig
    },
    updateConfig(_config: any): void {},
  }
}

/**
 * 获取已初始化的 API 适配器
 * 如果系统尚未初始化，会自动初始化
 */
export function getApiAdapter(): IApiAdapter {
  try {
    return ApiManager.getInstance().getAdapter()
  } catch {
    logger.warn('[API System] 系统未初始化，正在自动初始化...')
    return initializeApiSystem()
  }
}

/**
 * 切换 API 模式
 * @example
 * ```typescript
 * import { switchApiMode, ApiMode } from '@/api/apiInit'
 *
 * // 切换到生产模式
 * switchApiMode(ApiMode.PRODUCTION)
 *
 * // 切换到仅 Mock 模式（离线开发）
 * switchApiMode(ApiMode.MOCK_ONLY)
 * ```
 */
export function switchApiMode(mode: ApiMode): void {
  try {
    ApiManager.getInstance().switchMode(mode)
    logger.info(`[API System] 已切换到 ${mode} 模式`)
  } catch (error) {
    logger.error('[API System] 切换模式失败:', error)
  }
}
