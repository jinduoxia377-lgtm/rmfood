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
  static getModelConfig(modelType: ModelType): ModelConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIGS);
      if (!stored) return this.getDefaultModelConfig();
      const configs = JSON.parse(stored);
      const config = configs[modelType] || this.getDefaultModelConfig();
      return {
        ...config,
        apiKey: decrypt(config.apiKey),
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
  static importConfig(configStr: string): boolean {
    try {
      const config = JSON.parse(configStr);
      if (config.apiKeys) {
        const encryptedKeys = config.apiKeys.map((key: any) => ({
          ...key,
          key: encrypt(key.key),
        }));
        localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
      }
      if (config.modelConfigs) {
        const encryptedConfigs: Record<ModelType, any> = {} as Record<ModelType, any>;
        Object.entries(config.modelConfigs).forEach(([key, modelConfig]) => {
          encryptedConfigs[key as ModelType] = {
            ...(modelConfig as object),
            apiKey: encrypt((modelConfig as Record<string, unknown>).apiKey as string),
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

  // 将配置同步到后端数据库
  static async syncToBackend(modelType: ModelType, config: ModelConfig): Promise<boolean> {
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
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      logger.error('[ConfigManager] 后端同步失败:', error);
      return false;
    }
  }

  // 从后端数据库加载配置
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
          apiKey: config.api_key || '',
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
              apiKey: (config as ModelConfigRaw).api_key || '',
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
}
