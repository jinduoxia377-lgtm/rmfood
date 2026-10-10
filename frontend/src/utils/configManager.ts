import { logger } from '@/utils/safeLogger';

/**
 * 统一配置管理模块
 * 用于管理API密钥和模型配置的集中存储和管理
 */

// 配置类型定义
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: 'active' | 'expired' | 'expiring';
  created_at: string;
  expires_at: string;
  permissions: string[];
}

// 加密工具函数
const encrypt = (text: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch (error) {
    logger.error('Encryption failed:', error);
    return text;
  }
};

const decrypt = (text: string): string => {
  try {
    if (!text || typeof text !== 'string') {
      return '';
    }
    try {
      return decodeURIComponent(escape(atob(text)));
    } catch {
      return text;
    }
  } catch (error) {
    logger.error('Decryption failed:', error);
    return '';
  }
};

export interface SyncToBackendResult {
  success: boolean
  /** 后端运行时 LLM 服务是否已激活（密钥真正生效的标志） */
  llmActive?: boolean
  /** 后端运行时是否检测到密钥 */
  llmKeyConfigured?: boolean
  /** 403 权限不足（非管理员调用全局端点） */
  forbidden?: boolean
  /** 401 未认证 / token 过期 */
  unauthorized?: boolean
}

// 检测存储值是否已是 base64 编码（用于区分加密数据与旧版明文数据）
const isLikelyBase64 = (value: string): boolean => {
  if (!value || value.length < 4) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
};

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  concurrencyLimit: number;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export type ModelType = 'formula_gpt' | 'synergy_net' | 'safety_checker' | 'taste_predictor' | 'stability_model' | 'llm' | 'peptide_scorer';

export interface ConfigVersion {
  version: string;
  timestamp: string;
  changes: string;
  config: any;
}

// 配置存储键名
const STORAGE_KEYS = {
  API_KEYS: 'rmfood_api_keys',
  MODEL_CONFIGS: 'rmfood_model_configs',
  CONFIG_VERSIONS: 'rmfood_config_versions',
};

// ─────────────────────────────────────────────────────────────
// P1 密钥本地存储升级：WebCrypto AES-GCM（RMF:2: 前缀）
//   - 写入值形如 RMF:2:<salt_b64>:<iv_b64>:<cipher_b64>
//   - 读取时识别 RMF:2: 前缀走 WebCrypto 解密；解不开返回空串 + legacyUnencrypted=true
//   - WebCrypto 不可用（非安全上下文）时降级到 base64 路径，保持数据可读
// D-6：DPAPI 密钥由账号 ID / token 派生（HKDF-SHA256 → AES-256-GCM），
//   同账号跨会话/换标签页得到相同密钥，实现跨会话免重输。
// ─────────────────────────────────────────────────────────────
const FORMAT_V2_PREFIX = 'RMF:2:';
const DPAPI_KEY_STORAGE = 'rmfood_dpapi_key';
const RMF_HKDF_INFO = 'rmfood-llm-key';
const RMF_HKDF_SALT = 'rmfood-rmf-v3';

/** 模块级 AES 派生输入：由面板层注入（保持 configManager 无 auth store 依赖） */
let _aesDerivationInput: { userId?: number | string; token?: string } = {};
/** 注入 AES 密钥派生输入（面板层在挂载/保存前调用，传入当前用户 id 与 token） */
export function setAesKeyDerivationInput(userId?: number | string, token?: string) {
  _aesDerivationInput = { userId, token };
}

/** 派生输入自动兜底：模块级为空时从 localStorage 读持久化账号 ID，消除注入时序依赖 */
function getEffectiveDerivationInput(): { userId?: number | string; token?: string } {
  if (_aesDerivationInput.userId !== undefined || _aesDerivationInput.token) return _aesDerivationInput;
  try {
    const storedId = localStorage.getItem('rmfood_current_user_id');
    if (storedId) return { ..._aesDerivationInput, userId: storedId };
  } catch {}
  return _aesDerivationInput;
}

async function deriveAesKey(cryptoObj: Crypto, input: { userId?: number | string; token?: string }): Promise<CryptoKey | null> {
  try {
    if (!cryptoObj?.subtle) return null;
    // 优先：账号 ID 派生（稳定，不随 token 换发变化）
    if (input.userId !== undefined && input.userId !== null && input.userId !== '') {
      const baseKey = await cryptoObj.subtle.importKey('raw', new TextEncoder().encode(`rmfood-user-${input.userId}`), { name: 'HKDF' }, false, ['deriveKey']);
      return await cryptoObj.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode(RMF_HKDF_SALT), info: new TextEncoder().encode(RMF_HKDF_INFO) },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    // 次选：token 派生（兼容旧值；项目已迁 HttpOnly Cookie，localStorage token 仅遗留场景）
    let token = input.token || '';
    try {
      token = token || localStorage.getItem('rmfood_access_token') || localStorage.getItem('access_token') || '';
    } catch {}
    if (token) {
      const baseKey = await cryptoObj.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HKDF' }, false, ['deriveKey']);
      return await cryptoObj.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode(RMF_HKDF_SALT), info: new TextEncoder().encode(RMF_HKDF_INFO) },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    return null;
  } catch {
    return null;
  }
}

async function getOrCreateDpapiKey(): Promise<CryptoKey | null> {
  try {
    const cryptoObj = (globalThis.crypto || (self as any).crypto);
    if (!cryptoObj?.subtle) return null;
    const derived = await deriveAesKey(cryptoObj, getEffectiveDerivationInput());
    if (derived) return derived;
    // 未注入派生输入且无账号 ID/token：sessionStorage 随机 256-bit 密钥兜底
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(DPAPI_KEY_STORAGE); } catch {}
    if (!raw) {
      const bytes = cryptoObj.getRandomValues(new Uint8Array(32));
      raw = btoa(String.fromCharCode(...bytes));
      try { sessionStorage.setItem(DPAPI_KEY_STORAGE, raw); } catch {}
    }
    const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    return cryptoObj.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

/** 异步加密（优先 AES-GCM RMF:2:，WebCrypto 不可用时降级 base64） */
export async function encryptKeyAsync(raw: string): Promise<string> {
  if (!raw) return '';
  const key = await getOrCreateDpapiKey();
  if (!key) return encrypt(raw);
  try {
    const cryptoObj = (globalThis.crypto || (self as any).crypto);
    const salt = cryptoObj.getRandomValues(new Uint8Array(16));
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(raw);
    const cipher = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const enc = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
    return `${FORMAT_V2_PREFIX}${enc(salt.buffer)}:${enc(iv.buffer)}:${enc(cipher)}`;
  } catch {
    return encrypt(raw);
  }
}

/** 异步解密 RMF:2: 值；非 RMF:2: 或解密失败返回 legacyUnencrypted 标记 */
export async function decryptKeyAsync(stored: string): Promise<{ raw: string; legacyUnencrypted: boolean }> {
  if (!stored) return { raw: '', legacyUnencrypted: false };
  if (stored.startsWith(FORMAT_V2_PREFIX)) {
    try {
      const key = await getOrCreateDpapiKey();
      if (!key) return { raw: '', legacyUnencrypted: true };
      const cryptoObj = (globalThis.crypto || (self as any).crypto);
      const [saltB64, ivB64, cipherB64] = stored.slice(FORMAT_V2_PREFIX.length).split(':');
      const dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
      const salt = dec(saltB64);
      const iv = dec(ivB64);
      const cipherU8 = dec(cipherB64);
      const plain = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherU8.buffer as ArrayBuffer,
      );
      return { raw: new TextDecoder().decode(plain), legacyUnencrypted: false };
    } catch {
      // 解不开（跨会话密钥变化）：标记需重输，不泄露残留明文
      return { raw: '', legacyUnencrypted: true };
    }
  }
  return { raw: decrypt(stored), legacyUnencrypted: false };
}

// ─────────────────────────────────────────────────────────────
// P1 配置广播事件（跨组件/跨标签页同步，带 token 签名防护）
// 仅接受通过 dispatchConfigSync 派发的合法事件，拒绝外来裸事件
// ─────────────────────────────────────────────────────────────
const CONFIG_SYNC_EVENT = 'rmfood-config-sync';
const CONFIG_SYNC_TOKEN_KEY = 'rmfood_config_sync_token';

function generateConfigSyncToken(): string {
  try {
    const cryptoObj = (globalThis.crypto || (self as any).crypto);
    const b = cryptoObj.getRandomValues ? cryptoObj.getRandomValues(new Uint8Array(16)) : null;
    if (b) return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {}
  return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** 派发配置同步事件（每次生成一次性 token 存入 sessionStorage 供监听方校验） */
export function dispatchConfigSync(): void {
  try {
    const token = generateConfigSyncToken();
    sessionStorage.setItem(CONFIG_SYNC_TOKEN_KEY, token);
    window.dispatchEvent(new CustomEvent(CONFIG_SYNC_EVENT, { detail: { token } }));
  } catch {}
}

/** 校验广播事件是否为合法派发（token 匹配），拒绝外来脚本派发的裸事件 */
export function validateConfigSync(event: Event): boolean {
  try {
    if (!event || event.type !== CONFIG_SYNC_EVENT) return false;
    const detail = (event as CustomEvent).detail as { token?: string } | undefined;
    if (!detail || typeof detail.token !== 'string') return false;
    return detail.token === sessionStorage.getItem(CONFIG_SYNC_TOKEN_KEY);
  } catch {
    return false;
  }
}

// 配置管理类

interface ModelConfigRaw {
  api_key?: string
  base_url?: string
  timeout_ms?: number
  max_retries?: number
  concurrency_limit?: number
  model?: string
  provider?: string
}

export class ConfigManager {
  // 获取所有API密钥
  static getApiKeys(): ApiKey[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (!stored) return [];
      const encryptedKeys = JSON.parse(stored);
      return encryptedKeys.map((key: any) => ({
        ...key,
        key: decrypt(key.key),
      }));
    } catch (error) {
      logger.error('Failed to get API keys:', error);
      return [];
    }
  }

  // 保存API密钥
  static setApiKeys(keys: ApiKey[]): void {
    try {
      const encryptedKeys = keys.map(key => ({
        ...key,
        key: encrypt(key.key),
      }));
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
      this.createConfigVersion('Updated API keys');
    } catch (error) {
      logger.error('Failed to save API keys:', error);
    }
  }

  // 添加API密钥
  static addApiKey(key: Omit<ApiKey, 'id' | 'created_at'>): ApiKey {
    const newKey: ApiKey = {
      ...key,
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      created_at: new Date().toISOString(),
    };
    const keys = this.getApiKeys();
    keys.push(newKey);
    this.setApiKeys(keys);
    return newKey;
  }

  // 删除API密钥
  static deleteApiKey(id: string): void {
    const keys = this.getApiKeys().filter(key => key.id !== id);
    this.setApiKeys(keys);
  }

  // 获取模型配置
  // 返回 ModelConfig & { legacyUnencrypted?: boolean }；
  // legacyUnencrypted=true 表示该 key 是历史遗留的明文（未经 base64 加密入库），
  // UI 层应据此强制要求用户重新输入，避免把"疑似明文"当作有效密钥写回。
  static getModelConfig(modelType: ModelType): ModelConfig & { legacyUnencrypted?: boolean } {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIGS);
      if (!stored) return this.getDefaultModelConfig();
      const configs = JSON.parse(stored);
      const config = configs[modelType] || this.getDefaultModelConfig();
      const rawKey = (config as { apiKey?: string }).apiKey || '';
      const legacyUnencrypted = !!rawKey && !isLikelyBase64(rawKey);
      return {
        ...config,
        apiKey: legacyUnencrypted ? rawKey : decrypt(rawKey),
        legacyUnencrypted,
      };
    } catch (error) {
      logger.error(`Failed to get model config for ${modelType}:`, error);
      return this.getDefaultModelConfig();
    }
  }

  // 获取所有模型配置
  static getModelConfigs(): Record<ModelType, ModelConfig> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIGS);
      const defaultConfig = this.getDefaultModelConfig();
      const decryptedConfigs: Record<ModelType, ModelConfig> = {
        formula_gpt: defaultConfig,
        synergy_net: defaultConfig,
        safety_checker: defaultConfig,
        taste_predictor: defaultConfig,
        stability_model: defaultConfig,
        llm: defaultConfig,
        peptide_scorer: defaultConfig,
      };
      if (stored) {
        try {
          const configs = JSON.parse(stored);
          Object.entries(configs).forEach(([key, config]) => {
            if (Object.keys(decryptedConfigs).includes(key)) {
              try {
                const encryptedApiKey = (config as Record<string, unknown>).apiKey as string || '';
                const decrypted = decrypt(encryptedApiKey);
                decryptedConfigs[key as ModelType] = {
                  ...(config as object),
                  apiKey: decrypted,
                  baseUrl: ((config as Record<string, unknown>).baseUrl as string) || '',
                  timeout: (config as Record<string, unknown>).timeout as number || 30000,
                  maxRetries: (config as Record<string, unknown>).maxRetries as number || 3,
                  concurrencyLimit: (config as Record<string, unknown>).concurrencyLimit as number || 5,
                };
              } catch (error) {
                logger.error(`Failed to decrypt config for ${key}:`, error);
              }
            }
          });
        } catch (error) {
          logger.error('Failed to parse stored configs:', error);
        }
      }
      return decryptedConfigs;
    } catch (error) {
      logger.error('Failed to get model configs:', error);
      const defaultConfig = this.getDefaultModelConfig();
      return {
        formula_gpt: defaultConfig,
        synergy_net: defaultConfig,
        safety_checker: defaultConfig,
        taste_predictor: defaultConfig,
        stability_model: defaultConfig,
        llm: defaultConfig,
        peptide_scorer: defaultConfig,
      };
    }
  }

  // 保存模型配置
  static setModelConfig(modelType: ModelType, config: ModelConfig): void {
    try {
      const configs = this.getModelConfigs();
      configs[modelType] = {
        ...config,
        apiKey: encrypt(config.apiKey),
      };
      const serialized = JSON.stringify(configs);
      localStorage.setItem(STORAGE_KEYS.MODEL_CONFIGS, serialized);
      this.createConfigVersion(`Updated ${modelType} config`);
    } catch (error) {
      logger.error(`Failed to save model config for ${modelType}:`, error);
    }
  }

  // 重置模型配置
  static resetModelConfig(modelType: ModelType): void {
    try {
      const configs = this.getModelConfigs();
      const defaultConfig = this.getDefaultModelConfig();
      configs[modelType] = {
        ...defaultConfig,
        apiKey: encrypt(defaultConfig.apiKey),
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_CONFIGS, JSON.stringify(configs));
      this.createConfigVersion(`Reset ${modelType} config`);
    } catch (error) {
      logger.error(`Failed to reset model config for ${modelType}:`, error);
    }
  }

  // 获取默认模型配置
  static getDefaultModelConfig(): ModelConfig {
    return {
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      timeout: 30000,
      maxRetries: 3,
      concurrencyLimit: 3,
    };
  }

  // 创建配置版本
  static createConfigVersion(changes: string): void {
    try {
      const versions = this.getConfigVersions();
      const newVersion: ConfigVersion = {
        version: `v${versions.length + 1}`,
        timestamp: new Date().toISOString(),
        changes,
        config: {
          apiKeys: this.getApiKeys(),
          modelConfigs: this.getModelConfigs(),
        },
      };
      versions.push(newVersion);
      const trimmedVersions = versions.slice(-10);
      localStorage.setItem(STORAGE_KEYS.CONFIG_VERSIONS, JSON.stringify(trimmedVersions));
    } catch (error) {
      logger.error('Failed to create config version:', error);
    }
  }

  // 获取配置版本历史
  static getConfigVersions(): ConfigVersion[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG_VERSIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Failed to get config versions:', error);
      return [];
    }
  }

  // 恢复配置版本
  static restoreConfigVersion(version: string): void {
    try {
      const versions = this.getConfigVersions();
      const targetVersion = versions.find(v => v.version === version);
      if (targetVersion) {
        if (targetVersion.config.apiKeys) {
          const encryptedKeys = targetVersion.config.apiKeys.map((key: any) => ({
            ...key,
            key: encrypt(key.key),
          }));
          localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
        }
        if (targetVersion.config.modelConfigs) {
          const encryptedConfigs: Record<ModelType, any> = {} as Record<ModelType, any>;
          Object.entries(targetVersion.config.modelConfigs).forEach(([key, modelConfig]) => {
            encryptedConfigs[key as ModelType] = {
              ...(modelConfig as object),
              apiKey: encrypt((modelConfig as Record<string, unknown>).apiKey as string),
            };
          });
          localStorage.setItem(STORAGE_KEYS.MODEL_CONFIGS, JSON.stringify(encryptedConfigs));
        }
        this.createConfigVersion(`Restored to version ${version}`);
      }
    } catch (error) {
      logger.error(`Failed to restore config version ${version}:`, error);
    }
  }

  // 导出配置
  static exportConfig(): string {
    try {
      const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        apiKeys: this.getApiKeys(),
        modelConfigs: this.getModelConfigs(),
        versions: this.getConfigVersions(),
      };
      return JSON.stringify(config, null, 2);
    } catch (error) {
      logger.error('Failed to export config:', error);
      return '{}';
    }
  }

  // 导入配置
  // 幂等加密：导入 JSON 可能来自本系统 exportConfig()（值已 base64 编码），
  // 直接再次 encrypt() 会产生双重编码，读取时 decrypt() 一次只能解回"半解码串"。
  // 处理：先用 isLikelyBase64 检测，已编码则跳过加密，避免导出→导入循环损坏密钥。
  static importConfig(configStr: string): boolean {
    try {
      const config = JSON.parse(configStr);
      const safeEncrypt = (raw: unknown): string => {
        const s = typeof raw === 'string' ? raw : '';
        return s && isLikelyBase64(s) ? s : encrypt(s);
      };
      if (config.apiKeys) {
        const encryptedKeys = config.apiKeys.map((key: any) => ({
          ...key,
          key: safeEncrypt(key.key),
        }));
        localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
      }
      if (config.modelConfigs) {
        const encryptedConfigs: Record<ModelType, any> = {} as Record<ModelType, any>;
        Object.entries(config.modelConfigs).forEach(([key, modelConfig]) => {
          encryptedConfigs[key as ModelType] = {
            ...(modelConfig as object),
            apiKey: safeEncrypt((modelConfig as Record<string, unknown>).apiKey),
          };
        });
        localStorage.setItem(STORAGE_KEYS.MODEL_CONFIGS, JSON.stringify(encryptedConfigs));
      }
      if (config.versions) {
        localStorage.setItem(STORAGE_KEYS.CONFIG_VERSIONS, JSON.stringify(config.versions));
      }
      this.createConfigVersion('Imported config');
      return true;
    } catch (error) {
      logger.error('Failed to import config:', error);
      return false;
    }
  }

  // 验证API密钥
  static validateApiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.trim().length >= 40;
  }

  // 检查API密钥是否过期
  static isApiKeyExpired(key: ApiKey): boolean {
    return new Date(key.expires_at) < new Date();
  }

  // 检查API密钥是否即将过期（7天内）
  static isApiKeyExpiring(key: ApiKey): boolean {
    const expiresAt = new Date(key.expires_at);
    const now = new Date();
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  }

  // 将配置同步到后端数据库。
  // 返回 { success, llmActive?, llmKeyConfigured? }；旧调用方如需布尔值可取 .success。
  // llmActive/llmKeyConfigured 来自后端回显的运行时 LLM 状态（密钥是否真正生效）。
  static async syncToBackend(modelType: ModelType, config: ModelConfig): Promise<SyncToBackendResult> {
    try {
      const response = await fetch('/api/v1/ai/models/config/' + modelType, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model_type: modelType,
          provider: config.provider || 'deepseek',
          api_key: config.apiKey,
          base_url: config.baseUrl,
          model: config.model || '',
          max_tokens: config.maxTokens || 4096,
          temperature: config.temperature || 0.7,
        }),
      });
      if (response.status === 403) {
        return { success: false, forbidden: true };
      }
      if (response.status === 401) {
        return { success: false, unauthorized: true };
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      const runtime = result.llm_runtime;
      return {
        success: result.success === true,
        llmActive: runtime ? runtime.active === true : undefined,
        llmKeyConfigured: runtime ? runtime.api_key_configured === true : undefined,
      };
    } catch (error) {
      logger.error('[ConfigManager] 后端同步失败:', error);
      return { success: false };
    }
  }

  // 从后端数据库加载配置
  // 注意：后端 GET /models/config/{model_type} 返回的 api_key 字段是脱敏串（如 "sk-ab..." 或 "***"），
  // 不是明文密钥。若被写回 localStorage 会导致密钥损坏（P2-3 安全保护）。
  // 返回结果中的 apiKey 永远为空字符串，调用方必须用本地已加密存储的密钥回填，
  // 或用用户重新输入的明文密钥通过 syncToBackend 写回后端。
  static async loadFromBackend(modelType: ModelType): Promise<ModelConfig | null> {
    try {
      const response = await fetch('/api/v1/ai/models/config/' + modelType, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (result.success && result.config) {
        const config = result.config;
        return {
          // 脱敏串绝不写回本地存储，固定返回空串
          apiKey: '',
          baseUrl: config.base_url || '',
          timeout: config.timeout_ms || 30000,
          maxRetries: config.max_retries || 3,
          concurrencyLimit: config.concurrency_limit || 3,
          model: config.model || '',
          provider: config.provider || '',
        };
      }
      return null;
    } catch (error) {
      logger.error('[ConfigManager] 后端加载失败:', error);
      return null;
    }
  }

  // 批量从后端加载所有配置
  // 批量从后端加载所有配置
  // 同 loadFromBackend：api_key 是后端脱敏串，绝不写回本地
  static async loadAllFromBackend(): Promise<Record<ModelType, ModelConfig>> {
    try {
      const response = await fetch('/api/v1/ai/models/configs', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (result.success && result.configs) {
        const configs: Record<ModelType, ModelConfig> = {
          formula_gpt: this.getDefaultModelConfig(),
          synergy_net: this.getDefaultModelConfig(),
          safety_checker: this.getDefaultModelConfig(),
          taste_predictor: this.getDefaultModelConfig(),
          stability_model: this.getDefaultModelConfig(),
          llm: this.getDefaultModelConfig(),
          peptide_scorer: this.getDefaultModelConfig(),
        };
        Object.entries(result.configs).forEach(([type, config]) => {
          const mt = type as ModelType;
          if (config && typeof config === 'object') {
            configs[mt] = {
              // 脱敏串绝不写回本地存储，固定返回空串
              apiKey: '',
              baseUrl: (config as ModelConfigRaw).base_url || '',
              timeout: (config as ModelConfigRaw).timeout_ms || 30000,
              maxRetries: (config as ModelConfigRaw).max_retries || 3,
              concurrencyLimit: (config as ModelConfigRaw).concurrency_limit || 3,
              model: (config as ModelConfigRaw).model || '',
              provider: (config as ModelConfigRaw).provider || '',
            };
          }
        });
        return configs;
      }
      return this.getDefaultConfigs();
    } catch (error) {
      logger.error('[ConfigManager] 批量后端加载失败:', error);
      return this.getDefaultConfigs();
    }
  }

  // 获取默认配置
  private static getDefaultConfigs(): Record<ModelType, ModelConfig> {
    const defaultConfig = this.getDefaultModelConfig();
    return {
      formula_gpt: defaultConfig,
      synergy_net: defaultConfig,
      safety_checker: defaultConfig,
      taste_predictor: defaultConfig,
      stability_model: defaultConfig,
      llm: defaultConfig,
      peptide_scorer: defaultConfig,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 用户级 LLM 密钥通道（普通用户保存入口，P0 功能 #1）
  // 后端端点：/api/v1/ai/models/user-key（POST/GET/DELETE）与
  // /api/v1/ai/models/user-key/test（验活）。与全局管理员配置完全隔离。
  // ─────────────────────────────────────────────────────────────

  /** 保存当前用户的个人 LLM 密钥（走 user-key 通道，无需管理员权限） */
  static async saveUserLlmKey(params: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }): Promise<{ success: boolean; message?: string; keyMasked?: string }> {
    try {
      const response = await fetch('/api/v1/ai/models/user-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: params.provider,
          api_key: params.apiKey,
          base_url: params.baseUrl || '',
          model: params.model || '',
        }),
      });
      if (!response.ok) {
        return { success: false, message: `保存失败（HTTP ${response.status}）` };
      }
      const result = await response.json();
      return {
        success: result.success === true,
        message: result.message,
        keyMasked: result.key_masked,
      };
    } catch (error) {
      logger.error('[ConfigManager] 用户级密钥保存失败:', error);
      return { success: false, message: '保存失败：后端服务不可达' };
    }
  }

  /** 查询当前用户的个人 LLM 密钥状态（只返回脱敏信息，不含明文） */
  static async getUserLlmKeyStatus(): Promise<{
    success: boolean;
    configured: boolean;
    provider?: string;
    model?: string;
    base_url?: string;
    api_key_masked?: string;
    note?: string;
  }> {
    try {
      const response = await fetch('/api/v1/ai/models/user-key', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        return { success: false, configured: false };
      }
      const result = await response.json();
      return result as {
        success: boolean;
        configured: boolean;
        provider?: string;
        model?: string;
        base_url?: string;
        api_key_masked?: string;
        note?: string;
      };
    } catch (error) {
      logger.error('[ConfigManager] 查询用户级密钥状态失败:', error);
      return { success: false, configured: false };
    }
  }

  /** 删除当前用户的个人密钥，回退到服务器全局密钥 */
  static async deleteUserLlmKey(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch('/api/v1/ai/models/user-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        return { success: false, message: `HTTP ${response.status}` };
      }
      const result = await response.json();
      return { success: result.success === true, message: result.message };
    } catch (error) {
      logger.error('[ConfigManager] 删除用户级密钥失败:', error);
      return { success: false, message: '删除失败：后端服务不可达' };
    }
  }

  /** 验活当前填写的用户级 LLM 密钥（不写库，后端直连 LLM 做最小调用） */
  static async testUserLlmKey(params: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }): Promise<{ success: boolean; detail: string }> {
    try {
      const response = await fetch('/api/v1/ai/models/user-key/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: params.provider,
          api_key: params.apiKey,
          base_url: params.baseUrl || '',
          model: params.model || '',
        }),
      });
      if (!response.ok) {
        return { success: false, detail: `验活请求失败（HTTP ${response.status}）` };
      }
      const result = await response.json();
      return { success: result.success === true, detail: result.detail || (result.success ? '密钥可用' : '验证失败') };
    } catch (error) {
      logger.error('[ConfigManager] 用户级密钥验活失败:', error);
      return { success: false, detail: '验活请求失败：后端服务不可达' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 异步读取：识别 RMF:2: AES 加密值并解密，供需要完整明文的场景使用
  // ─────────────────────────────────────────────────────────────
  static async getModelConfigsAsync(): Promise<Record<ModelType, ModelConfig & { legacyUnencrypted?: boolean }>> {
    const out: Record<ModelType, ModelConfig & { legacyUnencrypted?: boolean }> = {
      formula_gpt: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      synergy_net: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      safety_checker: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      taste_predictor: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      stability_model: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      llm: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
      peptide_scorer: { ...this.getDefaultModelConfig(), legacyUnencrypted: false },
    };
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIGS);
      if (!stored) return out;
      const raw = JSON.parse(stored);
      await Promise.all(Object.entries(raw).map(async ([key, cfg]) => {
        if (!Object.prototype.hasOwnProperty.call(out, key)) return;
        const mt = key as ModelType;
        const c = cfg as Record<string, unknown>;
        const encKey = (c.apiKey as string) || '';
        const { raw: decrypted, legacyUnencrypted } = await decryptKeyAsync(encKey);
        out[mt] = {
          ...(this.getModelConfig(mt) as ModelConfig),
          ...(c as object),
          apiKey: decrypted,
          legacyUnencrypted,
        } as ModelConfig & { legacyUnencrypted?: boolean };
      }));
    } catch (error) {
      logger.error('[ConfigManager] getModelConfigsAsync failed:', error);
    }
    return out;
  }
}
