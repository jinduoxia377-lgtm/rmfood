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
    // 使用简单的加密方法，实际生产环境应使用更安全的加密方式
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
    // 尝试多种解密方式，提高兼容性
    try {
      return decodeURIComponent(escape(atob(text)));
    } catch {
      // 如果解密失败，直接返回原始文本
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
export class ConfigManager {
  // 获取所有API密钥
  static getApiKeys(): ApiKey[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (!stored) return [];

      const encryptedKeys = JSON.parse(stored);
      // 解密API密钥
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
      // 加密API密钥
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
      // 解密API密钥
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
          // 解密所有API密钥并覆盖默认配置
          Object.entries(configs).forEach(([key, config]) => {
            if (Object.keys(decryptedConfigs).includes(key)) {
              try {
                decryptedConfigs[key as ModelType] = {
                  ...(config as object),
                  apiKey: decrypt((config as Record<string, unknown>).apiKey as string || ''),
                  baseUrl: (config as Record<string, unknown>).baseUrl as string || '',
                  timeout: (config as Record<string, unknown>).timeout as number || 30000,
                  maxRetries: (config as Record<string, unknown>).maxRetries as number || 3,
                  concurrencyLimit: (config as Record<string, unknown>).concurrencyLimit as number || 5,
                };
              } catch (error) {
                logger.error(`Failed to decrypt config for ${key}:`, error);
                // 保持默认配置
              }
            }
          });
        } catch (error) {
          logger.error('Failed to parse stored configs:', error);
          // 保持默认配置
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
      // 加密API密钥
      configs[modelType] = {
        ...config,
        apiKey: encrypt(config.apiKey),
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_CONFIGS, JSON.stringify(configs));
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
      // 加密API密钥
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
      // 只保留最近10个版本
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
          // 加密API密钥后存储
          const encryptedKeys = targetVersion.config.apiKeys.map((key: any) => ({
            ...key,
            key: encrypt(key.key),
          }));
          localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
        }
        if (targetVersion.config.modelConfigs) {
          // 加密API密钥后存储
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
        apiKeys: this.getApiKeys(), // 已解密
        modelConfigs: this.getModelConfigs(), // 已解密
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
        // 加密API密钥后存储
        const encryptedKeys = config.apiKeys.map((key: any) => ({
          ...key,
          key: encrypt(key.key),
        }));
        localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(encryptedKeys));
      }
      if (config.modelConfigs) {
        // 加密API密钥后存储
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
    return typeof apiKey === 'string' && apiKey.trim().length >= 20;
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
}
