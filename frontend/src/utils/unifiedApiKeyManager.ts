/**
 * 统一 API Key 管理器 v1.0
 *
 * 解决 ModelConfigPanel 和 ApiKeyConfigPanel 的双源冲突问题
 * 实现优先级读取 + 自动回退 + 双向同步机制
 */

import { secureApiKeyManager } from './secureKeyManager'
import { ConfigManager } from './configManager'
import type { ModelType } from './configManager'
import { logger } from './safeLogger'

// ══════════════════════════════════════
// 类型定义
// ══════════════════════════════════════

export interface UnifiedApiKeySource {
  source: 'secure' | 'configmanager' | 'none'
  apiKey: string
  provider: string
  timestamp: string
}

export interface SyncResult {
  success: boolean
  from: string
  to: string
  message: string
}

// ══════════════════════════════════════
// 主类：统一 API Key 管理器
// ══════════════════════════════════════

export class UnifiedApiKeyManager {
  private static instance: UnifiedApiKeyManager

  private constructor() {}

  static getInstance(): UnifiedApiKeyManager {
    if (!UnifiedApiKeyManager.instance) {
      UnifiedApiKeyManager.instance = new UnifiedApiKeyManager()
    }
    return UnifiedApiKeyManager.instance
  }

  /**
   * 获取 API Key (双源兼容策略)
   *
   * 优先级:
   * 1. SecureApiKeyManager (新系统，AES-256-GCM 加密)
   * 2. ConfigManager (旧系统，Base64 编码)
   *
   * @returns Promise<UnifiedApiKeySource> 包含来源和密钥信息
   */
  async getApiKey(): Promise<UnifiedApiKeySource> {
    // 策略 1: 优先从安全存储获取
    try {
      const isSecureConfigured = secureApiKeyManager.isConfigured()

      if (isSecureConfigured) {
        const secureKey = await secureApiKeyManager.getApiKey()

        if (secureKey && secureKey.length >= 20) {
          logger.info('✅ 从安全存储 (SecureApiKeyManager) 获取 API Key', { length: secureKey.length })

          return {
            source: 'secure',
            apiKey: secureKey,
            provider: secureApiKeyManager.getMetadata()?.provider || 'deepseek',
            timestamp: new Date().toISOString(),
          }
        }
      }
    } catch (error) {
      logger.warn('⚠️ 安全存储读取失败，回退到 ConfigManager:', error)
    }

    // 策略 2: 回退到旧系统
    try {
      const llmConfig = ConfigManager.getModelConfig('llm')
      const legacyKey = llmConfig?.apiKey || ''

      if (legacyKey && legacyKey.length >= 20) {
        logger.info('✅ 从配置管理器 (ConfigManager) 获取 API Key', { length: legacyKey.length })

        return {
          source: 'configmanager',
          apiKey: legacyKey,
          provider: 'deepseek',
          timestamp: new Date().toISOString(),
        }
      }
    } catch (error) {
      logger.warn('⚠️ ConfigManager 读取失败:', error)
    }

    // 策略 3: 都没有
    logger.warn('❌ 未找到有效的 API Key 配置 (需要 ≥ 20 字符)')

    return {
      source: 'none',
      apiKey: '',
      provider: '',
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 快速检查是否有可用的 API Key
   */
  async isAvailable(): Promise<boolean> {
    const result = await this.getApiKey()
    return result.source !== 'none' && result.apiKey.length > 0
  }

  /**
   * 获取配置状态摘要 (用于 UI 显示)
   */
  async getStatusSummary(): Promise<{
    available: boolean
    source: string
    maskedKey: string
    provider: string
    suggestion?: string
  }> {
    const result = await this.getApiKey()

    let maskedKey = ''
    if (result.apiKey) {
      if (result.apiKey.length <= 12) {
        maskedKey = '***'
      } else {
        maskedKey = `${result.apiKey.substring(0, 8)}...${result.apiKey.substring(result.apiKey.length - 4)}`
      }
    }

    let suggestion: string | undefined

    if (result.source === 'configmanager') {
      suggestion = '检测到您使用的是旧版配置方式，建议迁移到更安全的加密存储以获得更好的保护。'
    } else if (result.source === 'none') {
      suggestion = '尚未配置 API Key，请在下方配置面板中设置。'
    }

    return {
      available: result.source !== 'none',
      source: result.source === 'secure' ? '安全存储 (推荐)' :
             result.source === 'configmanager' ? '传统存储 (建议升级)' :
             '未配置',
      maskedKey,
      provider: result.provider,
      suggestion,
    }
  }

  /**
   * 将 API Key 同步到两个存储位置
   */
  async syncToAll(apiKey: string, provider = 'deepseek'): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    // 同步到安全存储
    try {
      await secureApiKeyManager.storeApiKey(apiKey, provider)
      results.push({
        success: true,
        from: 'user_input',
        to: 'SecureApiKeyManager (AES-256-GCM)',
        message: '已加密保存到安全存储',
      })
    } catch (error) {
      results.push({
        success: false,
        from: 'user_input',
        to: 'SecureApiKeyManager',
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
    }

    // 同步到 ConfigManager
    try {
      const currentConfig = ConfigManager.getModelConfig('llm')
      ConfigManager.setModelConfig('llm', {
        ...currentConfig,
        apiKey,
        baseUrl: currentConfig.baseUrl || 'https://api.deepseek.com/v1',
      })
      results.push({
        success: true,
        from: 'user_input',
        to: 'ConfigManager (传统存储)',
        message: '已同步到配置管理器',
      })
    } catch (error) {
      results.push({
        success: false,
        from: 'user_input',
        to: 'ConfigManager',
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
    }

    return results
  }

  /**
   * 从 ConfigManager 迁移到安全存储
   */
  async migrateToSecureStorage(): Promise<{
    migrated: boolean
    message: string
  }> {
    try {
      // 从旧系统读取
      const llmConfig = ConfigManager.getModelConfig('llm')
      const legacyKey = llmConfig?.apiKey || ''

      if (!legacyKey || legacyKey.length < 20) {
        return {
          migrated: false,
          message: '未找到有效的旧版 API Key (需要 ≥ 20 字符)，无需迁移',
        }
      }

      // 检查是否已经有安全存储的版本
      if (secureApiKeyManager.isConfigured()) {
        const existingKey = await secureApiKeyManager.getApiKey()
        if (existingKey && existingKey.length >= 20) {
          return {
            migrated: false,
            message: '已经存在安全存储的 API Key，跳过迁移',
          }
        }
      }

      // 执行迁移
      await secureApiKeyManager.storeApiKey(legacyKey, 'deepseek')

      logger.info('✅ API Key 已从传统存储迁移到安全存储')

      return {
        migrated: true,
        message: '迁移成功！您的 API Key 现在使用 AES-256-GCM 军事级加密保护。',
      }

    } catch (error) {
      logger.error('❌ 迁移失败:', error)
      return {
        migrated: false,
        message: `迁移失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  /**
   * 清除所有 API Key 配置
   */
  clearAll(): void {
    try {
      secureApiKeyManager.removeApiKey()

      // 清除 ConfigManager 中的 LLM 配置
      const defaultConfig = ConfigManager.getDefaultModelConfig()
      ConfigManager.setModelConfig('llm', defaultConfig)

      logger.info('🗑️ 已清除所有 API Key 配置')
    } catch (error) {
      logger.error('清除配置失败:', error)
    }
  }
}

// ══════════════════════════════════════
// 导出单例实例
// ══════════════════════════════════════

export const unifiedApiKeyManager = UnifiedApiKeyManager.getInstance()

export default unifiedApiKeyManager
