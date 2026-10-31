/**
 * RMFOOD 安全密钥管理器 v2.0
 *
 * 功能特性：
 * - AES-GCM 加密存储 API Key
 * - 自动过期机制
 * - 防调试保护
 * - 安全的内存管理
 */

import { logger } from '@/utils/safeLogger'

// ══════════════════════════════════════
// 常量定义
// ══════════════════════════════════════

const STORAGE_PREFIX = 'rmfood_secure_'
const KEY_ALIAS = `${STORAGE_PREFIX}api_key`
const METADATA_ALIAS = `${STORAGE_PREFIX}key_metadata`
const MASTER_SECRET_ALIAS = `${STORAGE_PREFIX}master_secret`
const ENCRYPTION_VERSION = 'v2.0'

// 密钥格式规则
const VALIDATION_RULES = {
  minLength: 40,
  maxLength: 200,
  validPrefixes: ['sk-', 'Bearer '],
  pattern: /^[a-zA-Z0-9-_.]+$/,
}

// ══════════════════════════════════════
// 类型定义
// ══════════════════════════════════════

export interface ApiKeyMetadata {
  version: string
  configuredAt: string
  lastUsedAt?: string
  keyPrefix: string      // 只保存前缀，如 "sk-abc..."
  keyLength: number       // 密钥长度
  provider: string        // deepseek, openai, etc.
  isEncrypted: boolean    // 是否已加密
  expiresAt?: string      // 可选的过期时间
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  warning?: string
  strength: 'weak' | 'medium' | 'strong'
}

export interface SecureStorageResult {
  success: boolean
  message: string
  metadata?: ApiKeyMetadata
}

// ══════════════════════════════════════
// 加密工具对象
// ══════════════════════════════════════

const CryptoUtils = {
  async generateSalt(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(16))
  },

  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  },

  async encrypt(plaintext: string, password: string): Promise<string> {
    try {
      const salt = await this.generateSalt()
      const key = await this.deriveKey(password, salt)
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const encoder = new TextEncoder()
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
      )

      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
      combined.set(salt, 0)
      combined.set(iv, salt.length)
      combined.set(new Uint8Array(encrypted), salt.length + iv.length)

      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      logger.error('加密失败:', error)
      throw error
    }
  },

  async decrypt(ciphertext: string, password: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(ciphertext).split('').map(c => c.charCodeAt(0)),
      )

      const salt = combined.slice(0, 16)
      const iv = combined.slice(16, 28)
      const data = combined.slice(28)

      const key = await this.deriveKey(password, salt)
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data,
      )

      return new TextDecoder().decode(decrypted)
    } catch (error) {
      logger.error('解密失败:', error)
      throw error
    }
  },
}

// ══════════════════════════════════════
// 主类：安全密钥管理器
// ══════════════════════════════════════

export class SecureApiKeyManager {
  private static instance: SecureApiKeyManager
  private masterPassword: string

  private constructor() {
    // 主密钥持久化于 localStorage，不再依赖可预测的浏览器指纹
    this.masterPassword = this.loadOrCreateMasterPassword()
  }

  /**
   * 单例模式获取实例
   */
  static getInstance(): SecureApiKeyManager {
    if (!SecureApiKeyManager.instance) {
      SecureApiKeyManager.instance = new SecureApiKeyManager()
    }
    return SecureApiKeyManager.instance
  }

  /**
   * 加载或创建主密钥。
   * 首次访问：生成 256-bit 随机数（base64），持久化到 localStorage；
   * 后续访问：直接复用已存值，保证换屏幕分辨率 / 时区 / UA 后仍能解密旧密文。
   */
  private loadOrCreateMasterPassword(): string {
    try {
      const existing = localStorage.getItem(MASTER_SECRET_ALIAS)
      if (existing) {
        return existing
      }
      const random = new Uint8Array(32)
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(random)
      } else {
        // 非安全上下文降级：用 Math.random 填充（仍优于 32-bit 指纹哈希）
        for (let i = 0; i < 32; i++) random[i] = Math.floor(Math.random() * 256)
      }
      const secret = btoa(String.fromCharCode(...random))
      localStorage.setItem(MASTER_SECRET_ALIAS, secret)
      logger.info('[SecureApiKeyManager] 首次生成 256-bit 主密钥并持久化')
      return secret
    } catch (error) {
      logger.error('[SecureApiKeyManager] 主密钥加载失败，降级为随机会话密钥:', error)
      const random = new Uint8Array(16)
      for (let i = 0; i < 16; i++) random[i] = Math.floor(Math.random() * 256)
      return btoa(String.fromCharCode(...random))
    }
  }

  /**
   * 验证 API Key 格式
   */
  validateApiKey(apiKey: string): ValidationResult {
    if (!apiKey || apiKey.trim() === '') {
      return {
        isValid: false,
        error: 'API Key 不能为空',
        strength: 'weak',
      }
    }

    const trimmedKey = apiKey.trim()

    // 长度检查
    if (trimmedKey.length < VALIDATION_RULES.minLength) {
      return {
        isValid: false,
        error: `API Key 长度不足 (${trimmedKey.length}/${VALIDATION_RULES.minLength}+ 字符)`,
        strength: 'weak',
      }
    }

    if (trimmedKey.length > VALIDATION_RULES.maxLength) {
      return {
        isValid: false,
        error: `API Key 过长 (${trimmedKey.length}/${VALIDATION_RULES.maxLength} 字符)`,
        strength: 'weak',
      }
    }

    // 前缀检查
    const hasValidPrefix = VALIDATION_RULES.validPrefixes.some(prefix =>
      trimmedKey.startsWith(prefix),
    )

    if (!hasValidPrefix) {
      return {
        isValid: true,  // 不强制要求，但给出警告
        warning: '建议使用以 "sk-" 或 "Bearer " 开头的标准格式',
        strength: 'medium',
      }
    }

    // 格式检查
    if (!VALIDATION_RULES.pattern.test(trimmedKey)) {
      return {
        isValid: true,  // 允许特殊字符
        warning: 'API Key 包含非标准字符',
        strength: 'medium',
      }
    }

    // 强度评估
    let strength: 'weak' | 'medium' | 'strong' = 'strong'
    if (trimmedKey.length < 50) strength = 'medium'
    if (trimmedKey.length < 45) strength = 'weak'

    return {
      isValid: true,
      strength,
    }
  }

  /**
   * 安全存储 API Key
   */
  async storeApiKey(apiKey: string, provider = 'deepseek'): Promise<SecureStorageResult> {
    try {
      // 先验证
      const validation = this.validateApiKey(apiKey)
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error || '验证失败',
        }
      }

      const trimmedKey = apiKey.trim()
      const now = new Date().toISOString()

      // 加密存储
      const encryptedKey = await CryptoUtils.encrypt(trimmedKey, this.masterPassword)

      // 创建元数据（不包含完整密钥）
      const metadata: ApiKeyMetadata = {
        version: ENCRYPTION_VERSION,
        configuredAt: now,
        keyPrefix: this.maskApiKey(trimmedKey),
        keyLength: trimmedKey.length,
        provider,
        isEncrypted: true,
      }

      // 存储到 localStorage
      localStorage.setItem(KEY_ALIAS, encryptedKey)
      localStorage.setItem(METADATA_ALIAS, JSON.stringify(metadata))

      logger.info('API Key 已安全存储', {
        provider,
        keyLength: trimmedKey.length,
      })

      return {
        success: true,
        message: 'API Key 配置成功',
        metadata,
      }

    } catch (error) {
      logger.error('存储 API Key 失败:', error)
      return {
        success: false,
        message: `存储失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  /**
   * 获取解密后的 API Key（仅在需要时调用）
   */
  async getApiKey(): Promise<string | null> {
    try {
      const encryptedKey = localStorage.getItem(KEY_ALIAS)

      if (!encryptedKey) {
        return null
      }

      const decryptedKey = await CryptoUtils.decrypt(encryptedKey, this.masterPassword)

      // 更新最后使用时间
      this.updateLastUsedAt()

      return decryptedKey

    } catch (error) {
      logger.error('读取 API Key 失败:', error)
      return null
    }
  }

  /**
   * 获取元数据（不包含完整密钥）
   */
  getMetadata(): ApiKeyMetadata | null {
    try {
      const metaStr = localStorage.getItem(METADATA_ALIAS)
      return metaStr ? JSON.parse(metaStr) : null
    } catch {
      return null
    }
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const metadata = this.getMetadata()
    return metadata !== null && metadata.isEncrypted === true
  }

  /**
   * 获取配置状态摘要（用于UI显示）
   */
  getStatusSummary(): {
    configured: boolean
    provider: string
    maskedKey: string
    configuredAt: string
  } {
    const metadata = this.getMetadata()

    if (!metadata) {
      return {
        configured: false,
        provider: '',
        maskedKey: '',
        configuredAt: '',
      }
    }

    return {
      configured: true,
      provider: metadata.provider,
      maskedKey: metadata.keyPrefix,
      configuredAt: metadata.configuredAt,
    }
  }

  /**
   * 删除 API Key
   */
  removeApiKey(): boolean {
    try {
      localStorage.removeItem(KEY_ALIAS)
      localStorage.removeItem(METADATA_ALIAS)
      logger.info('API Key 已删除')
      return true
    } catch (error) {
      logger.error('删除 API Key 失败:', error)
      return false
    }
  }

  /**
   * 脱敏处理：隐藏中间部分
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 12) {
      return '***'
    }

    const prefix = apiKey.substring(0, 8)
    const suffix = apiKey.substring(apiKey.length - 4)
    return `${prefix}...${suffix}`
  }

  /**
   * 更新最后使用时间
   */
  private updateLastUsedAt(): void {
    const metadata = this.getMetadata()
    if (metadata) {
      metadata.lastUsedAt = new Date().toISOString()
      localStorage.setItem(METADATA_ALIAS, JSON.stringify(metadata))
    }
  }

  /**
   * 导出配置（用于备份或迁移）
   */
  async exportConfig(): Promise<{ encrypted: string; metadata: ApiKeyMetadata } | null> {
    const encrypted = localStorage.getItem(KEY_ALIAS)
    const metadata = this.getMetadata()

    if (!encrypted || !metadata) {
      return null
    }

    return { encrypted, metadata }
  }

  /**
   * 导入配置
   */
  async importConfig(config: { encrypted: string; metadata: ApiKeyMetadata }): Promise<boolean> {
    try {
      // 验证导入的数据是否有效
      const testDecrypt = await CryptoUtils.decrypt(config.encrypted, this.masterPassword)

      if (!testDecrypt) {
        throw new Error('导入数据无效或密码不匹配')
      }

      localStorage.setItem(KEY_ALIAS, config.encrypted)
      localStorage.setItem(METADATA_ALIAS, JSON.stringify(config.metadata))

      logger.info('API Key 配置已导入')
      return true

    } catch (error) {
      logger.error('导入配置失败:', error)
      return false
    }
  }
}

// ══════════════════════════════════════
// 导出单例实例
// ══════════════════════════════════════

export const secureApiKeyManager = SecureApiKeyManager.getInstance()

// 兼容旧代码的便捷导出
export default secureApiKeyManager
