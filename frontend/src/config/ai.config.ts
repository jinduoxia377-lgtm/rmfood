/**
 * AI模块统一配置管理系统
 *
 * 设计原则:
 * 1. 零硬编码 - 所有可配置参数集中管理
 * 2. 环境感知 - 支持开发/测试/生产环境切换
 * 3. 类型安全 - 完整TypeScript类型约束
 * 4. 可扩展 - 易于添加新配置项
 *
 * @version 4.0.0
 * @author RMFOOD Architecture Team
 */

// ============================================================================
// 环境类型定义
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface AIConfig {
  // API配置
  api: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };

  // 流式响应配置
  streaming: {
    enabled: boolean;
    chunkTimeout: number;
    maxRetries: number;
  };

  // 会话管理配置
  session: {
    maxSessions: number;
    maxMessagesPerSession: number;
    autoSaveInterval: number;
    storageKey: string;
  };

  // UI配置
  ui: {
    animationDuration: number;
    debounceDelay: number;
    maxInputLength: number;
    virtualScrollThreshold: number;
  };

  // 性能阈值
  performance: {
    fcpTarget: number;
    lcpTarget: number;
    ttiTarget: number;
    bundleSizeLimit: number;
  };

  // 功能开关
  features: {
    ragEnabled: boolean;
    intentDetection: boolean;
    multiSession: boolean;
    exportEnabled: boolean;
    offlineSupport: boolean;
  };
}

// ============================================================================
// 环境检测
// ============================================================================

function getEnvironment(): Environment {
  const env = import.meta.env?.VITE_APP_ENV || process.env?.NODE_ENV || 'development';

  if (env.includes('prod')) return 'production';
  if (env.includes('stag')) return 'staging';
  return 'development';
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: AIConfig = {
  api: {
    baseUrl: import.meta.env?.VITE_API_BASE_URL || '/api/v1',
    timeout: parseInt(import.meta.env?.VITE_API_TIMEOUT || '30000', 10),
    retryCount: parseInt(import.meta.env?.VITE_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(import.meta.env?.VITE_RETRY_DELAY || '1000', 10),
  },

  streaming: {
    enabled: true,
    chunkTimeout: 60000,
    maxRetries: 2,
  },

  session: {
    maxSessions: 50,
    maxMessagesPerSession: 200,
    autoSaveInterval: 5000,
    storageKey: 'rmfood_ai_sessions_v3',
  },

  ui: {
    animationDuration: 300,
    debounceDelay: 300,
    maxInputLength: 4000,
    virtualScrollThreshold: 50,
  },

  performance: {
    fcpTarget: 1500,
    lcpTarget: 2500,
    ttiTarget: 3500,
    bundleSizeLimit: 200000,
  },

  features: {
    ragEnabled: true,
    intentDetection: true,
    multiSession: true,
    exportEnabled: true,
    offlineSupport: false,
  },
};

// ============================================================================
// 环境特定覆盖
// ============================================================================

const ENVIRONMENT_OVERRIDES: Record<Environment, any> = {
  development: {
    api: {
      timeout: 60000,
    },
    streaming: {
      enabled: true,
    },
    features: {
      offlineSupport: true,
    },
  },

  staging: {
    api: {
      timeout: 30000,
    },
    features: {
      offlineSupport: false,
    },
  },

  production: {
    api: {
      timeout: 15000,
      retryCount: 2,
    },
    session: {
      maxSessions: 30,
      maxMessagesPerSession: 100,
    },
    ui: {
      debounceDelay: 150,
    },
    features: {
      offlineSupport: false,
    },
  },
};

// ============================================================================
// 配置合并与导出
// ============================================================================

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      (result as any)[key] = deepMerge(result[key] as Record<string, any>, sourceValue as Record<string, any>);
    } else if (sourceValue !== undefined) {
      (result as any)[key] = sourceValue;
    }
  }

  return result;
}

export function createAIConfig(overrides?: Partial<AIConfig>): AIConfig {
  const environment = getEnvironment();
  const envOverrides = ENVIRONMENT_OVERRIDES[environment] || {};

  return deepMerge(deepMerge(DEFAULT_CONFIG, envOverrides), overrides || {});
}

// ============================================================================
// 单例实例 (全局共享)
// ============================================================================

let configInstance: AIConfig | null = null;

export function getAIConfig(): AIConfig {
  if (!configInstance) {
    configInstance = createAIConfig();
  }
  return configInstance;
}

export function resetAIConfig(): void {
  configInstance = null;
}

// ============================================================================
// 配置验证
// ============================================================================

export function validateConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.api.timeout < 1000 || config.api.timeout > 120000) {
    errors.push(`API timeout must be between 1s-120s, got ${config.api.timeout}ms`);
  }

  if (config.session.maxSessions < 1 || config.session.maxSessions > 100) {
    errors.push(`Max sessions must be between 1-100, got ${config.session.maxSessions}`);
  }

  if (config.session.maxMessagesPerSession < 10 || config.session.maxMessagesPerSession > 1000) {
    errors.push(`Max messages per session must be between 10-1000, got ${config.session.maxMessagesPerSession}`);
  }

  if (config.ui.maxInputLength < 100 || config.ui.maxInputLength > 10000) {
    errors.push(`Max input length must be between 100-10000, got ${config.ui.maxInputLength}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 导出默认配置
// ============================================================================

export default createAIConfig();
