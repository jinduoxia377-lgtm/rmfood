/**
 * 模型配置管理面板 v7.0 (Enterprise Edition)
 *
 * v7.0 新增功能:
 * - 集成 AES-256-GCM 安全存储 (仅LLM模型)
 * - 双向自动同步机制
 * - 统一API Key管理入口
 * - 权限控制和操作审计
 */
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Input,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Slider,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Switch,
} from '@/components/ui';
import {
  Settings,
  Save,
  RefreshCw,
  Trash2,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Send,
  Download,
  Upload,
  Info,
  Shield,
  Key,
  History,
  Clock,
} from 'lucide-react';
import { ConfigManager } from '@/utils/configManager';
import type { ModelType, ModelConfig } from '@/utils/configManager';
import { unifiedApiKeyManager } from '@/utils/unifiedApiKeyManager';
import { secureApiKeyManager } from '@/utils/secureKeyManager';
import { ModelClient } from '@/api/modelClient';
import { logger } from '@/utils/safeLogger';
import { useAuthStore } from '@/stores/auth';

interface ModelConfigPanelProps {
  className?: string;
  onConfigChange?: (modelType: ModelType, config: ModelConfig) => void;
}

export function ModelConfigPanel({ className, onConfigChange }: ModelConfigPanelProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ModelType>('formula_gpt');
  const [configs, setConfigs] = useState<Record<ModelType, ModelConfig>>({} as Record<ModelType, ModelConfig>);
  // LLM 专属：Provider 和 Model 选择
  const [llmProvider, setLlmProvider] = useState<string>('deepseek');
  const [llmModel, setLlmModel] = useState<string>('deepseek-chat');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{
    timestamp: string;
    action: string;
    userId: string;
    userRole: string;
    details?: Record<string, unknown>;
  }>>([]);

  // 获取认证状态和 token
  const { user, isAuthenticated } = useAuthStore();

  // v7.0: 安全存储模式 (仅LLM模型支持AES-256-GCM加密)
  const [useSecureStorage, setUseSecureStorage] = useState(() => {
    try {
      return localStorage.getItem('rmfood_use_secure_storage') === 'true';
    } catch {
      return false;
    }
  });

  // v7.0: 权限控制和审计日志
  const checkPermission = (): boolean => {
    try {
      // Token 通过 HttpOnly Cookie 存储，不检查 localStorage
      // 只需确认用户已通过 Zustand store 认证
      if (!isAuthenticated) {
        setError('⚠️ 请先登录后再修改配置');
        logger.warn('未认证用户尝试访问配置管理');
        return false;
      }

      return true;
    } catch (e) {
      logger.error('权限检查失败:', e);
      return true; // 容错：允许继续操作
    }
  };

  const auditLog = (action: string, details: Record<string, unknown> = {}) => {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        userId: localStorage.getItem('user_id') || 'anonymous',
        userRole: localStorage.getItem('user_role') || 'unknown',
        ...details,
      };

      logger.info(`[审计日志] ${action}`, logEntry);

      const existingLogs = JSON.parse(localStorage.getItem('rmfood_config_audit_log') || '[]');
      existingLogs.push(logEntry);

      if (existingLogs.length > 100) {
        existingLogs.shift();
      }

      localStorage.setItem('rmfood_config_audit_log', JSON.stringify(existingLogs));
    } catch (e) {
      logger.warn('审计日志记录失败:', e);
    }
  };

  // 加载配置
  useEffect(() => {
    loadConfigs();
  }, []);

  // 从 localStorage 恢复 LLM Provider/Model 选择
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rmfood_llm_provider');
      if (stored && llmProviderPresets[stored]) {
        setLlmProvider(stored);
        const preset = llmProviderPresets[stored];
        const storedModel = localStorage.getItem('rmfood_llm_model');
        if (storedModel && preset.models.includes(storedModel)) {
          setLlmModel(storedModel);
        } else {
          setLlmModel(preset.models[0]);
        }
      }
    } catch {}
  }, []);

  // 保存 LLM Provider/Model 到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rmfood_llm_provider', llmProvider);
      localStorage.setItem('rmfood_llm_model', llmModel);
    } catch {}
  }, [llmProvider, llmModel]);

  // LLM Provider 预设（与后端 PROVIDER_PRESETS 保持一致）
  const llmProviderPresets: Record<string, { label: string; baseUrl: string; models: string[] }> = {
    deepseek: {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    },
    openai: {
      label: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    zhipu: {
      label: '智谱 AI',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    },
    qwen: {
      label: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    },
    anthropic: {
      label: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250514'],
    },
  };

  // 当 Provider 切换时，自动更新 baseUrl 和默认 Model
  const handleProviderChange = (provider: string) => {
    setLlmProvider(provider);
    const preset = llmProviderPresets[provider];
    if (preset) {
      // 更新 baseUrl 到 configs
      setConfigs(prev => ({
        ...prev,
        llm: {
          ...(prev.llm || ConfigManager.getDefaultModelConfig()),
          baseUrl: preset.baseUrl,
          apiKey: prev.llm?.apiKey || '',
        },
      }));
      // 如果当前 model 不在新 provider 的列表中，切换为第一个
      if (!preset.models.includes(llmModel)) {
        setLlmModel(preset.models[0]);
      }
    }
  };

  // 加载审计日志
  useEffect(() => {
    try {
      const logs = JSON.parse(localStorage.getItem('rmfood_config_audit_log') || '[]');
      setAuditLogs(logs);
    } catch {
      // ignore
    }
  }, [showAuditLog]);

  const clearAuditLog = useCallback(() => {
    localStorage.removeItem('rmfood_config_audit_log');
    setAuditLogs([]);
  }, []);

  // 自动隐藏成功/错误提示
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return;
  }, [success, error]);

  const loadConfigs = () => {
    try {
      const loadedConfigs = ConfigManager.getModelConfigs();
      logger.info('[ModelConfigPanel] 加载配置:', { llmKeyLength: loadedConfigs.llm?.apiKey?.length, hasLlmKey: !!loadedConfigs.llm?.apiKey });
      setConfigs(loadedConfigs);
      setError(null);
      setValidationErrors({});
    } catch (err: any) {
      logger.error('[ModelConfigPanel] 加载配置失败:', err);
      setError(`加载配置失败: ${err.message}`);
    }
  };

  const validateApiKey = (apiKey: string, showErrors = true): boolean => {
    logger.info('[validateApiKey] 开始验证', { length: apiKey?.length, hasValue: !!apiKey, prefix: apiKey?.substring(0, 6) });

    if (!apiKey || apiKey.trim() === '') {
      if (showErrors) {
        setValidationErrors((prev) => ({ ...prev, apiKey: 'API 密钥不能为空' }));
      }
      logger.warn('API密钥验证失败: 密钥为空');
      return false;
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 40) {
      if (showErrors) {
        setValidationErrors((prev) => ({
          ...prev,
          apiKey: `API 密钥长度不足 (${trimmedKey.length}/40+ 字符)。请确保完整复制密钥，通常以 "sk-" 开头`,
        }));
      }
      logger.warn(`API密钥验证失败: 长度不足 (${trimmedKey.length}/40)`);
      return false;
    }

    if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('Bearer ')) {
      logger.warn(`[validateApiKey] 密钥格式异常（不以 sk- 或 Bearer 开头）: ${trimmedKey.substring(0, 10)}...`);
    }

    if (showErrors) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.apiKey;
        return newErrors;
      });
    }

    logger.info('API密钥验证通过', { length: trimmedKey.length, prefix: trimmedKey.substring(0, 6) + '...' });
    return true;
  };

  const handleConfigChange = (modelType: ModelType, key: string, value: any) => {
    setConfigs((prev) => ({
      ...prev,
      [modelType]: {
        ...prev[modelType],
        [key]: value,
      },
    }));

    // 实时验证 API 密钥
    if (key === 'apiKey') {
      validateApiKey(value);
    }
  };

  const handleSaveConfig = async (modelType: ModelType) => {
    try {
      // v7.0: 权限检查
      if (!checkPermission()) {
        return;
      }

      // 验证 API 密钥
      const apiKey = configs[modelType]?.apiKey || '';
      if (!validateApiKey(apiKey)) {
        return;
      }

      setIsSaving(true);
      setError(null);

      auditLog('保存配置', { modelType, hasApiKey: !!apiKey, keyLength: apiKey?.length });
      setSuccess(null);

      const config = configs[modelType];

      // 保存到 ConfigManager (传统存储)
      logger.info('[ModelConfigPanel] 保存前配置:', { modelType, apiKeyLength: config.apiKey?.length, hasKey: !!config.apiKey });
      ConfigManager.setModelConfig(modelType, config);
      // 立即验证持久化
      const verify = ConfigManager.getModelConfig(modelType);
      logger.info('[ModelConfigPanel] 保存后验证:', { modelType, verifiedKeyLength: verify.apiKey?.length, hasKey: !!verify.apiKey });

      // v7.0: 当保存 LLM 模型配置时，根据安全模式决定是否同步到安全存储
      if (modelType === 'llm' && apiKey.length >= 20) {
        if (useSecureStorage) {
          try {
            const syncResults = await unifiedApiKeyManager.syncToAll(apiKey, 'deepseek');
            const successCount = syncResults.filter((r) => r.success).length;
            logger.info(`✅ API Key 已同步到 ${successCount}/2 个存储位置（安全模式已启用）`);

            if (successCount === 2) {
              setSuccess('配置已保存！API Key 已使用 AES-256-GCM 加密存储 🔒');
            } else if (successCount === 1) {
              setSuccess('配置已保存（部分同步成功）');
            }
          } catch (syncError) {
            logger.warn('⚠️ 同步到安全存储失败（已回退到传统存储）:', syncError);
            setSuccess('配置已保存（使用传统存储模式）');
          }
        } else {
          logger.info('ℹ️ 安全模式未启用，API Key 仅保存到传统存储');
          setSuccess('✅ 配置保存成功！（建议启用安全加密存储以获得更好保护）');
        }
      } else if (modelType === 'llm') {
        setSuccess('⚠️ 配置已保存，但 API Key 长度不足，可能无法正常使用');
      } else {
        setSuccess('配置保存成功');
      }

      // 当保存 LLM 或 FormulaGPT 模型配置时，尝试更新后端配置
      let backendSyncError: string | null = null;
      if (modelType === 'formula_gpt' || modelType === 'llm') {
        try {
          // 🔒 使用 Cookie 认证 + CSRF token（与 axios 客户端一致）
          const csrfToken = document.cookie.match(/(^| )csrf_token=([^;]+)/)?.[2] || '';
          const response = await fetch('/api/v1/ai/models/config', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            },
            body: JSON.stringify({
              provider: modelType === 'llm' ? llmProvider : 'deepseek',
              api_key: config.apiKey,
              base_url: config.baseUrl || (modelType === 'llm' ? llmProviderPresets[llmProvider]?.baseUrl : 'https://api.deepseek.com/v1'),
              model: modelType === 'llm' ? llmModel : 'deepseek-chat',
              max_tokens: 4096,
              temperature: 0.7,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            logger.info('✅ 更新后端配置成功:', data);
          } else if (response.status === 401) {
            backendSyncError = 'Token 已过期，请重新登录后再保存配置';
            logger.warn('[ModelConfigPanel] ⚠️ 后端配置更新失败 (401 认证失败)');
          } else {
            const errorData = await response.json().catch(() => ({}));
            backendSyncError = `后端配置更新失败 (${response.status}): ${errorData?.detail || '未知错误'}`;
            logger.warn('[ModelConfigPanel] ⚠️ 后端配置更新失败:', errorData);
          }
        } catch (apiError: any) {
          backendSyncError = `后端服务不可达 (${apiError?.message || '网络错误'})`;
          logger.warn('[ModelConfigPanel] ℹ️ 后端配置更新不可达，前端配置已成功保存');
        }
      }

      // 主动刷新模型状态，确保配置更新后能立即获取最新状态
      try {
        await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
      } catch {
        // 忽略刷新失败
      }

      if (onConfigChange) {
        onConfigChange(modelType, config);
      }

      // 构建清晰的保存结果信息
      const parts = [`✅ 本地配置已保存（${modelType}）`];
      if (backendSyncError) {
        if (backendSyncError.includes('403')) {
          parts.push('⚠️ 后端同步失败：当前用户无管理员权限，仅本地保存生效。请切换 admin 账号登录后重试。');
        } else {
          parts.push(`⚠️ 后端同步失败: ${backendSyncError}`);
        }
      } else {
        parts.push('✅ 后端配置已同步');
      }
      setSuccess(parts.join('\n'));
    } catch (err: any) {
      setError(`保存配置失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = (modelType: ModelType) => {
    try {
      auditLog('重置配置', { modelType });
      ConfigManager.resetModelConfig(modelType);
      loadConfigs();
      setError(null);
      setSuccess('配置已重置');
    } catch (err: any) {
      setError(`重置配置失败: ${err.message}`);
    }
  };

  const testModelConnection = async (modelType: ModelType) => {
    try {
      auditLog('测试连接', { modelType });
      logger.info(`开始测试模型连接: ${modelType}`);

      let apiKey = configs[modelType]?.apiKey || '';

      logger.debug('当前配置中的API密钥状态', {
        hasApiKey: !!apiKey,
        keyLength: apiKey?.length,
        configExists: !!configs[modelType],
      });

      if (!apiKey || apiKey.trim() === '') {
        try {
          const savedConfigs = ConfigManager.getModelConfigs();
          apiKey = savedConfigs[modelType]?.apiKey || '';
          logger.info('从ConfigManager获取密钥结果', { hasApiKey: !!apiKey, length: apiKey?.length });
        } catch (configError) {
          logger.error('从ConfigManager获取配置失败:', configError);
        }
      }

      if (!apiKey || apiKey.trim() === '') {
        const errorMsg =
          'API 密钥未配置。请在上方输入框中输入有效的 API 密钥，然后点击"保存配置"按钮后再测试连接。\n\n获取 DeepSeek API 密钥: https://platform.deepseek.com/';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const validationResult = validateApiKey(apiKey);
      if (!validationResult) {
        const currentError = validationErrors.apiKey || 'API 密钥格式无效';
        const detailedError = `API 密钥验证失败: ${currentError}\n\n请检查:\n1. 密钥是否完整复制（无多余空格）\n2. 密钥长度是否足够（通常20-60字符）\n3. 密钥格式是否正确（通常以 sk- 开头）`;
        setError(detailedError);
        throw new Error(detailedError);
      }

      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // 🔧 确保配置已同步到后端
      let syncError: string | null = null;
      if (modelType === 'llm') {
        try {
          const currentConfig = configs[modelType] || ConfigManager.getModelConfig('llm');

          if (!currentConfig?.apiKey || currentConfig.apiKey.trim() === '') {
            syncError = 'API Key 未配置，请先输入 API Key 后再测试。';
          } else {
            logger.info('🔄 同步配置到后端...');
            // 🔒 使用 Cookie 认证 + CSRF token
            const csrfToken = document.cookie.match(/(^| )csrf_token=([^;]+)/)?.[2] || '';
            const syncResponse = await fetch('/api/v1/ai/models/config', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
              },
              body: JSON.stringify({
                provider: llmProvider,
                api_key: currentConfig.apiKey,
                base_url: currentConfig.baseUrl || llmProviderPresets[llmProvider]?.baseUrl || 'https://api.deepseek.com/v1',
                model: llmModel,
                max_tokens: 4096,
                temperature: 0.7,
              }),
            });

            if (!syncResponse.ok) {
              syncError = `同步配置失败 (HTTP ${syncResponse.status})。请重新登录后重试。`;
              logger.warn('[ModelConfigPanel] 同步配置失败:', syncResponse.status);
            } else {
              logger.info('✅ 配置已同步到后端');
            }
          }
        } catch (syncErr) {
          syncError = `同步配置失败: ${syncErr instanceof Error ? syncErr.message : '未知错误'}`;
          logger.warn('同步配置到后端失败（将继续测试）:', syncErr);
        }
      }

      // 刷新模型状态
      try {
        await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
      } catch {
        // 忽略刷新失败
      }

      // 获取最新状态
      const status = await ModelClient.getModelStatus();
      const modelState = status[modelType];
      logger.info(`模型 ${modelType} 状态:`, modelState);

      if (syncError) {
        setError(`⚠️ ${syncError}\n\n本地配置已保存，但后端未更新。请检查网络连接或重新登录后重试。`);
        setIsLoading(false);
        return modelState;
      }

      if (modelState?.status === 'active') {
        setSuccess('✅ 连接测试成功！API 密钥有效，模型已激活');
        logger.info('连接测试成功');
      } else if (modelState?.status === 'unconfigured') {
        setError(`⚠️ 模型未配置。请确保已正确保存 API Key 配置。\n\n当前状态: ${modelState?.note || '未配置'}`);
        logger.warn('模型状态: unconfigured');
      } else if (modelState?.status === 'error') {
        setError(`❌ 后端服务错误\n\n${modelState?.note || ''}${modelState?.suggestion ? `\n建议: ${modelState.suggestion}` : ''}`);
      } else {
        setError(`⚠️ 连接测试完成但模型状态异常: ${modelState?.status || 'unknown'}\n详情: ${modelState?.note || '无'}`);
      }

      return modelState;
    } catch (err: any) {
      let errorMessage = err.message || '未知错误';

      // 确保 errorMessage 是字符串类型
      if (typeof errorMessage !== 'string') {
        errorMessage = String(errorMessage);
      }

      logger.error(`测试连接失败 [${modelType}]:`, errorMessage);

      if (!errorMessage.includes('API 密钥') && !errorMessage.includes('401') && !errorMessage.includes('429')) {
        setError(
          `❌ 测试连接失败: ${errorMessage}\n\n可能的原因:\n1. 网络连接问题\n2. API 服务暂时不可用\n3. 防火墙或代理设置阻止了请求`,
        );
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 导出配置
  const handleExportConfig = () => {
    try {
      const configStr = ConfigManager.exportConfig();
      const blob = new Blob([configStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rmfood-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('配置导出成功');
    } catch (err: any) {
      setError(`导出配置失败: ${err.message}`);
    }
  };

  // 导入配置
  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const configStr = event.target?.result as string;
            const success = ConfigManager.importConfig(configStr);
            if (success) {
              loadConfigs();
              setSuccess('配置导入成功');
            } else {
              setError('导入配置失败: 无效的配置文件');
            }
          } catch (err: any) {
            setError(`导入配置失败: ${err.message}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // 应用模型配置模板
  const applyModelTemplate = (modelType: ModelType) => {
    try {
      const template = modelTemplates[modelType as keyof typeof modelTemplates];
      if (template) {
        const currentConfig = configs[modelType] || ConfigManager.getDefaultModelConfig();
        const newConfig = {
          ...currentConfig,
          ...template.config,
        };

        setConfigs((prev) => ({
          ...prev,
          [modelType]: newConfig,
        }));

        setSuccess(`已应用 ${template.name} 配置模板`);
      } else {
        setError(`该模型类型暂无可应用的模板`);
      }
    } catch (err: any) {
      setError(`应用模板失败: ${err.message}`);
    }
  };

  // 模型配置模板
  const modelTemplates = {
    formula_gpt: {
      name: 'FormulaGPT',
      description: '配方生成模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 30000,
        maxRetries: 3,
        concurrencyLimit: 3,
      },
    },
    llm: {
      name: 'LLM',
      description: '大语言模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 60000,
        maxRetries: 3,
        concurrencyLimit: 3,
      },
    },
    synergy_net: {
      name: 'SynergyNet',
      description: '协同分析模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 45000,
        maxRetries: 3,
        concurrencyLimit: 2,
      },
    },
    safety_checker: {
      name: 'SafetyChecker',
      description: '安全检查模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 20000,
        maxRetries: 2,
        concurrencyLimit: 5,
      },
    },
    taste_predictor: {
      name: 'TastePredictor',
      description: '口感预测模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 30000,
        maxRetries: 3,
        concurrencyLimit: 3,
      },
    },
    stability_model: {
      name: 'StabilityModel',
      description: '稳定性预测模型',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        timeout: 60000,
        maxRetries: 3,
        concurrencyLimit: 2,
      },
    },
  };

  const modelTabs = [
    { value: 'formula_gpt', label: 'FormulaGPT', description: '配方生成模型' },
    { value: 'llm', label: 'LLM', description: '大语言模型' },
    { value: 'synergy_net', label: 'SynergyNet', description: '协同分析模型' },
    { value: 'safety_checker', label: 'SafetyChecker', description: '安全检查模型' },
    { value: 'taste_predictor', label: 'TastePredictor', description: '口感预测模型' },
    { value: 'stability_model', label: 'StabilityModel', description: '稳定性预测模型' },
  ] as const;

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            模型配置管理
          </h2>
          <p className="text-sm text-neutral-500 mt-1">配置模型的 API 密钥、参数和连接设置</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportConfig}
            icon={<Download className="w-4 h-4" />}
            title="导出配置"
          >
            导出
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportConfig}
            icon={<Upload className="w-4 h-4" />}
            title="导入配置"
          >
            导入
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadConfigs}
            icon={<RefreshCw className="w-4 h-4" />}
            title="刷新配置"
          >
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert
          variant="default"
          className="mb-6 bg-success-50 border-success-200 text-success-700 dark:bg-success-500/10 dark:border-success-500/20 dark:text-success-400"
        >
          <Check className="w-4 h-4 text-success-500" />
          <AlertTitle>成功</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* localStorage 状态指示器 */}
      {configs[activeTab]?.apiKey && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Check className="w-3 h-3" />
            本地存储中已保存 API 密钥（长度：{configs[activeTab].apiKey.length} 字符）
          </p>
        </div>
      )}
      {!configs[activeTab]?.apiKey && activeTab === 'llm' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ 当前 LLM 配置中无 API 密钥，请在上方输入框中输入并保存
          </p>
        </div>
      )}

      {/* 交叉引导文案 */}
      <div className="mb-6 p-4 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-amber-200 dark:border-amber-800/40">
        <p className="text-sm font-medium text-warning-700 dark:text-warning-300 mb-2 flex items-center gap-1">
          <Info className="w-4 h-4" />
          这是<strong>高级配置</strong>入口（适合开发者/高级用户）
        </p>
        <ul className="text-xs text-warning-600 dark:text-warning-400 space-y-1 list-disc list-inside mb-2">
          <li>✅ 支持多模型管理 (DeepSeek/OpenAI/智谱/通义等)</li>
          <li>✅ 可调整高级参数 (temperature/timeout/max_tokens)</li>
          <li>✅ 适合需要精细控制的场景</li>
        </ul>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/40">
          <p className="text-xs text-warning-500 dark:text-warning-400">
            📌 如果只是想快速开始使用，可在<strong>"智能对话"</strong>页面底部快速配置。
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const result = await unifiedApiKeyManager.migrateToSecureStorage();
              if (result.migrated) {
                setSuccess(result.message);
                loadConfigs(); // 刷新显示
              } else {
                setError(result.message);
              }
            }}
            icon={<Shield className="w-3 h-3" />}
          >
            升级为安全存储
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as ModelType);
          setValidationErrors({});
        }}
      >
        <TabsList className="mb-6">
          {modelTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-primary-500 data-[state=active]:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {modelTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800/40">
                <h3 className="font-medium text-primary-700 dark:text-primary-300 mb-2">{tab.label}</h3>
                <p className="text-sm text-neutral-500">{tab.description}</p>
              </div>

              <div className="space-y-4">
                {tab.value === 'llm' && (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                          启用 AES-256-GCM 安全加密存储
                        </label>
                      </div>
                      <Switch
                        checked={useSecureStorage}
                        onCheckedChange={(checked) => {
                          setUseSecureStorage(checked);
                          try {
                            localStorage.setItem('rmfood_use_secure_storage', String(checked));
                            logger.info(`安全存储模式: ${checked ? '已启用' : '已禁用'}`);
                          } catch (e) {
                            logger.error('保存安全存储设置失败:', e);
                          }
                        }}
                      />
                    </div>
                    {useSecureStorage && (
                      <p className="text-xs text-secondary-600 dark:text-secondary-400 mt-2 ml-7">
                        ✨ API Key 将使用军事级加密算法存储，即使浏览器缓存被窃取也无法解密。
                      </p>
                    )}
                  </div>
                )}

                {tab.value === 'llm' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Provider 选择 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Provider</label>
                        <select
                          value={llmProvider}
                          onChange={(e) => handleProviderChange(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {Object.entries(llmProviderPresets).map(([key, preset]) => (
                            <option key={key} value={key}>{preset.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* Model 选择 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Model</label>
                        <select
                          value={llmModel}
                          onChange={(e) => setLlmModel(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {llmProviderPresets[llmProvider]?.models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* API 密钥 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">API 密钥</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={configs[tab.value]?.apiKey || ''}
                          onChange={(e) => handleConfigChange(tab.value, 'apiKey', e.target.value)}
                          placeholder={`输入 ${llmProviderPresets[llmProvider]?.label || 'LLM'} API 密钥`}
                          className={`w-full ${validationErrors.apiKey ? 'border-danger-300 dark:border-danger-500' : ''}`}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      </div>
                      {validationErrors.apiKey && (
                        <p className="text-xs text-danger-600 dark:text-danger-400">{validationErrors.apiKey}</p>
                      )}
                      <p className="text-xs text-neutral-500">
                        {llmProvider === 'deepseek' && '获取 DeepSeek API 密钥: https://platform.deepseek.com'}
                        {llmProvider === 'openai' && '获取 OpenAI API 密钥: https://platform.openai.com/api-keys'}
                        {llmProvider === 'zhipu' && '获取智谱 AI API 密钥: https://open.bigmodel.cn'}
                        {llmProvider === 'qwen' && '获取通义千问 API 密钥: https://help.aliyun.com/zh/dashscope'}
                        {llmProvider === 'anthropic' && '获取 Anthropic API 密钥: https://console.anthropic.com'}
                      </p>
                    </div>
                    {/* Base URL */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">API 基础 URL</label>
                      <Input
                        value={configs[tab.value]?.baseUrl || llmProviderPresets[llmProvider]?.baseUrl || ''}
                        onChange={(e) => handleConfigChange(tab.value, 'baseUrl', e.target.value)}
                        placeholder="输入 API 基础 URL"
                        className="w-full"
                      />
                      <p className="text-xs text-neutral-500">
                        当前默认: {llmProviderPresets[llmProvider]?.baseUrl || 'https://api.deepseek.com/v1'}
                      </p>
                    </div>
                  </>
                )}
                {tab.value !== 'llm' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">API 密钥</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={configs[tab.value]?.apiKey || ''}
                          onChange={(e) => handleConfigChange(tab.value, 'apiKey', e.target.value)}
                          placeholder="输入 API 密钥"
                          className={`w-full ${validationErrors.apiKey ? 'border-danger-300 dark:border-danger-500' : ''}`}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      </div>
                      {validationErrors.apiKey && (
                        <p className="text-xs text-danger-600 dark:text-danger-400">{validationErrors.apiKey}</p>
                      )}
                      <p className="text-xs text-neutral-500">API 密钥（可选，部分模型无需密钥）</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">API 基础 URL</label>
                      <Input
                        value={configs[tab.value]?.baseUrl || ''}
                        onChange={(e) => handleConfigChange(tab.value, 'baseUrl', e.target.value)}
                        placeholder="输入 API 基础 URL"
                        className="w-full"
                      />
                      <p className="text-xs text-neutral-500">留空使用内置默认值</p>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">超时时间 (ms)</label>
                    <Input
                      type="number"
                      value={configs[tab.value]?.timeout || 30000}
                      onChange={(e) => handleConfigChange(tab.value, 'timeout', parseInt(e.target.value) || 30000)}
                      min="5000"
                      max="60000"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">最大重试次数</label>
                    <Input
                      type="number"
                      value={configs[tab.value]?.maxRetries || 3}
                      onChange={(e) => handleConfigChange(tab.value, 'maxRetries', parseInt(e.target.value) || 3)}
                      min="0"
                      max="10"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">并发限制</label>
                  <Slider
                    value={configs[tab.value]?.concurrencyLimit ?? 3}
                    min={1}
                    max={10}
                    step={1}
                    onChange={(value) => handleConfigChange(tab.value, 'concurrencyLimit', value)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>1</span>
                    <span>{configs[tab.value]?.concurrencyLimit ?? 3}</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleSaveConfig(tab.value)}
                  loading={isSaving}
                  icon={<Save className="w-4 h-4" />}
                  className="flex-1"
                >
                  保存配置
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => applyModelTemplate(tab.value)}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  应用模板
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleResetConfig(tab.value)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  重置
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => testModelConnection(tab.value)}
                  loading={isLoading}
                  icon={<Send className="w-4 h-4" />}
                >
                  测试连接
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 审计日志面板 */}
      <div className="mt-4">
        <button
          onClick={() => setShowAuditLog((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <History className="w-4 h-4" />
          配置变更审计日志
          {auditLogs.length > 0 && (
            <Badge variant="neutral" className="text-[10px]">{auditLogs.length}</Badge>
          )}
        </button>
        {showAuditLog && (
          <div className="mt-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/30 max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">暂无变更记录</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-neutral-500">最近 {auditLogs.length} 条记录</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={clearAuditLog}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    清空日志
                  </Button>
                </div>
                <div className="space-y-2">
                  {auditLogs.slice(0, 20).map((log, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 text-xs"
                    >
                      <Clock className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">{log.action}</span>
                          <span className="text-neutral-400">·</span>
                          <span className="text-neutral-500">{log.userId}</span>
                          <span className="text-neutral-400">·</span>
                          <Badge variant="neutral" className="text-[10px]">{log.userRole}</Badge>
                        </div>
                        <div className="text-neutral-400 mt-0.5">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-1 text-neutral-500 font-mono break-all">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default ModelConfigPanel;
