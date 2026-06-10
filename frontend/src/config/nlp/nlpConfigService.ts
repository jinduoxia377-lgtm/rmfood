import { logger } from '@/utils/safeLogger'
/**
 * NLP配置服务 - 管理NLP处理相关的所有外部化配置
 *
 * 核心功能：
 * - 统一的配置加载和管理
 * - 配置缓存机制（避免重复加载）
 * - 支持动态配置更新
 * - 错误处理和降级机制
 */

export type ConfigLoader<T = any> = () => Promise<T>

interface ConfigEntry<T = any> {
  data: T | null
  loader: ConfigLoader<T>
  lastLoaded: number | null
  isLoading: boolean
  loadPromise: Promise<T> | null
}

/**
 * NLP配置服务类
 */
export class NLPConfigService {
  private configMap: Map<string, ConfigEntry>
  private defaultTTL: number

  constructor(defaultTTL: number = 30 * 60 * 1000) {
    this.configMap = new Map()
    this.defaultTTL = defaultTTL
  }

  /**
   * 注册配置加载器
   */
  registerLoader<T>(key: string, loader: ConfigLoader<T>): void {
    if (this.configMap.has(key)) {
      logger.warn(`[NLPConfigService] ⚠️ 配置 "${key}" 已存在，将被覆盖`)
    }

    this.configMap.set(key, {
      data: null,
      loader,
      lastLoaded: null,
      isLoading: false,
      loadPromise: null,
    })
  }

  /**
   * 获取配置（支持缓存和并发控制）
   */
  async getConfig<T>(key: string): Promise<T> {
    const entry = this.configMap.get(key)

    if (!entry) {
      throw new Error(`[NLPConfigService] 未找到配置: ${key}`)
    }

    // 检查缓存是否有效
    if (entry.data !== null && entry.lastLoaded !== null) {
      const age = Date.now() - entry.lastLoaded
      if (age < this.defaultTTL) {
        return entry.data as T
      }
    }

    // 如果正在加载中，返回现有的Promise（避免重复加载）
    if (entry.isLoading && entry.loadPromise) {
      return entry.loadPromise as Promise<T>
    }

    // 开始加载
    entry.isLoading = true
    entry.loadPromise = this.loadConfig(entry, key)

    try {
      const result = await entry.loadPromise
      return result as T
    } finally {
      entry.isLoading = false
      entry.loadPromise = null
    }
  }

  /**
   * 同步获取配置（仅从缓存，可能返回null）
   */
  getConfigSync<T>(key: string): T | null {
    const entry = this.configMap.get(key)

    if (!entry?.data) {
      return null
    }

    const age = Date.now() - (entry.lastLoaded || 0)
    if (age >= this.defaultTTL) {
      return null
    }

    return entry.data as T
  }

  /**
   * 强制重新加载配置
   */
  async reloadConfig<T>(key: string): Promise<T> {
    const entry = this.configMap.get(key)

    if (!entry) {
      throw new Error(`[NLPConfigService] 未找到配置: ${key}`)
    }

    // 清除缓存
    entry.data = null
    entry.lastLoaded = null

    // 重新加载
    return this.getConfig<T>(key)
  }

  /**
   * 清除指定配置的缓存
   */
  clearCache(key?: string): void {
    if (key) {
      const entry = this.configMap.get(key)
      if (entry) {
        entry.data = null
        entry.lastLoaded = null
      }
    } else {
      // 清除所有缓存
      this.configMap.forEach(entry => {
        entry.data = null
        entry.lastLoaded = null
      })
    }
  }

  /**
   * 检查配置是否已注册
   */
  hasConfig(key: string): boolean {
    return this.configMap.has(key)
  }

  /**
   * 获取所有已注册的配置键
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.configMap.keys())
  }

  /**
   * 获取配置状态信息
   */
  getConfigStatus(key: string): {
    isRegistered: boolean
    isLoaded: boolean
    isCached: boolean
    lastLoaded: number | null
  } | null {
    const entry = this.configMap.get(key)

    if (!entry) {
      return { isRegistered: false, isLoaded: false, isCached: false, lastLoaded: null }
    }

    const isCached = entry.data !== null &&
                     entry.lastLoaded !== null &&
                     (Date.now() - entry.lastLoaded) < this.defaultTTL

    return {
      isRegistered: true,
      isLoaded: entry.data !== null,
      isCached,
      lastLoaded: entry.lastLoaded,
    }
  }

  private async loadConfig<T>(entry: ConfigEntry, key: string): Promise<T> {
    try {
      logger.log(`[NLPConfigService] 📥 正在加载配置: ${key}`)

      const data = await entry.loader()

      entry.data = data
      entry.lastLoaded = Date.now()

      logger.log(`[NLPConfigService] ✅ 配置加载成功: ${key}`)

      return data as T

    } catch (error) {
      logger.error(`[NLPConfigService] ❌ 配置加载失败: ${key}`, error)
      throw new Error(`配置加载失败 [${key}]: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// 全局单例实例
let globalInstance: NLPConfigService | null = null

/**
 * 获取全局NLP配置服务实例
 */
export function getNLPConfigService(): NLPConfigService {
  if (!globalInstance) {
    globalInstance = new NLPConfigService()
    logger.log('[NLPConfigService] 🚀 创建全局配置服务实例')
  }
  return globalInstance
}

/**
 * 重置全局实例（主要用于测试）
 */
export function resetNLPConfigService(): void {
  if (globalInstance) {
    globalInstance.clearCache()
    globalInstance = null
    logger.log('[NLPConfigService] 🗑️ 全局配置服务实例已重置')
  }
}
