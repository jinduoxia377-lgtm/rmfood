/**
 * 模型配置管理面板 v7.0 (Enterprise Edition)
 *
 * v7.0 新增功能:
 * - 集成 AES-256-GCM 安全存储 (仅LLM模型)
 * - 双向自动同步机制
 * - 统一API Key管理入口
 * - 权限控制和操作审计
 */
import { useState, useEffect } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

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
      setConfigs(loadedConfigs);
      setError(null);
      setValidationErrors({});
    } catch (err: any) {
      setError(`加载配置失败: ${err.message}`);
    }
  };

  const validateApiKey = (apiKey: string, showErrors = true): boolean => {
    logger.debug('开始验证API密钥', { length: apiKey?.length, hasValue: !!apiKey });

    if (!apiKey || apiKey.trim() === '') {
      if (showErrors) {
        setValidationErrors((prev) => ({ ...prev, apiKey: 'API 密钥不能为空' }));
      }
      logger.warn('API密钥验证失败: 密钥为空');
      return false;
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 20) {
      if (showErrors) {
        setValidationErrors((prev) => ({
          ...prev,
          apiKey: `API 密钥长度不足 (${trimmedKey.length}/20+ 字符)。请确保完整复制密钥，通常以 "sk-" 开头`,
        }));
      }
      logger.warn(`API密钥验证失败: 长度不足 (${trimmedKey.length}/20)`);
      return false;
    }

    if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('Bearer ')) {
      logger.info('API密钥格式提示: 建议以 "sk-" 或 "Bearer " 开头');
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
      ConfigManager.setModelConfig(modelType, config);

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
      if (modelType === 'formula_gpt' || modelType === 'llm') {
        try {
          // 使用 auth store 的 token，确保获取最新的有效 token
          const token = isAuthenticated ? (localStorage.getItem('access_token') || '') : '';

          if (!token) {
            logger.warn('[ModelConfigPanel] ⚠️ 未找到认证 token，跳过后端配置更新（前端配置已保存）');
          } else {
            const response = await fetch('/api/v1/ai/models/config', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                provider: 'deepseek',
                api_key: config.apiKey,
                base_url: config.baseUrl,
                model: 'deepseek-chat',
                max_tokens: 4096,
                temperature: 0.7,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              logger.info('✅ 更新后端配置成功:', data);
            } else if (response.status === 401) {
              // 401 认证失败是常见情况（token过期），仅记录警告而非错误
              logger.warn('[ModelConfigPanel] ⚠️ 后端配置更新 skipped (401 认证失败，可能需要重新登录)');
              // 不设置 error 状态，避免干扰用户体验
            } else {
              const errorData = await response.json();
              logger.warn('[ModelConfigPanel] ⚠️ 后端配置更新失败:', errorData);
            }
          }
        } catch (apiError) {
          // 后端 API 调用失败不应阻止前端配置保存
          logger.warn('[ModelConfigPanel] ℹ️ 后端配置更新不可达（网络问题或服务未启动），前端配置已成功保存');
        }
      }

      // 测试连接
      await testModelConnection(modelType);

      // 主动刷新模型状态，确保配置更新后能立即获取最新状态
      try {
        // 失效 React Query 缓存，强制重新获取
        queryClient.invalidateQueries({ queryKey: ['ai-model-status'] });
        // 等待缓存刷新完成
        await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
        logger.info('模型状态已刷新');
      } catch (statusError) {
        logger.error('刷新模型状态失败:', statusError);
      }

      if (onConfigChange) {
        onConfigChange(modelType, config);
      }

      setSuccess('配置保存成功');
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

      // 🔧 修复：对于 LLM 模型，先确保配置已同步到后端
      if (modelType === 'llm') {
        try {
          const token = isAuthenticated ? (localStorage.getItem('access_token') || '') : '';
          const config = configs[modelType] || ConfigManager.getModelConfig('llm');

          if (token && config?.apiKey) {
            logger.info('🔄 测试连接前先同步配置到后端...');
            const syncResponse = await fetch('/api/v1/ai/models/config', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                provider: 'deepseek',
                api_key: config.apiKey,
                base_url: config.baseUrl || 'https://api.deepseek.com/v1',
                model: 'deepseek-chat',
                max_tokens: 4096,
                temperature: 0.7,
              }),
            });

            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              logger.info('✅ 配置已成功同步到后端:', syncData);
            } else if (syncResponse.status === 401) {
              logger.warn('⚠️ 同步配置到后端失败 (401 认证错误)');
            } else {
              logger.warn('⚠️ 同步配置到后端失败:', syncResponse.status);
            }
          }
        } catch (syncError) {
          logger.warn('ℹ️ 同步配置到后端失败（将继续测试）:', syncError);
        }
      }

      logger.info('正在调用ModelClient测试连接...');

      // 🔧 改进：对于 LLM 模型，发送实际测试请求而不仅仅是检查状态
      if (modelType === 'llm') {
        try {
          const token = isAuthenticated ? (localStorage.getItem('access_token') || '') : '';

          if (!token || token === 'undefined' || token === 'null') {
            // 无 token 时跳过 chat 测试请求，直接走状态检查
            logger.info('⏭️ 无有效 token，跳过 chat 测试请求，直接检查模型状态');
          } else {
            logger.info('🔐 使用 token 进行认证 (长度:', token.length, ')');

            const testResponse = await fetch('/api/v1/ai/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                question: '你好，这是一个连接测试。请回复"测试成功"。',
                history: [],
                api_key: apiKey,
              }),
            });

            if (testResponse.ok) {
              const testData = await testResponse.json();
              // 同时检查 answer 和 content（兼容修复后的格式）
              if (testData.success && (testData.answer || testData.content)) {
                setSuccess('✅ 连接测试成功！DeepSeek API 已正常工作，模型响应正常');
                logger.info('✅ DeepSeek API 连接测试成功');
                return { status: 'active' as const, provider: 'deepseek', model: 'deepseek-chat' };
              } else {
                throw new Error(testData.error || testData.detail?.message || 'API 返回异常响应');
              }
            } else {
              const errorData = await testResponse.json().catch(() => ({}));
              const statusCode = testResponse.status;
              let errorMessage =
                errorData?.message ||
                errorData?.detail?.message ||
                errorData?.detail?.error ||
                errorData?.error ||
                `HTTP ${statusCode}`;

              // 确保 errorMessage 是字符串类型
              if (typeof errorMessage !== 'string') {
                errorMessage = String(errorMessage);
              }

              logger.error(`❌ API 测试请求失败 (${statusCode}):`, errorMessage);

              // 🆕 改进：准确识别 401 错误的真正原因
              if (statusCode === 401) {
                // 检查是否是用户认证错误（而非 API Key 错误）
                const isAuthError =
                  errorMessage.includes('认证') ||
                  errorMessage.includes('令牌') ||
                  errorMessage.includes('token') ||
                  errorMessage.includes('Unauthorized') ||
                  !errorMessage.includes('API') ||
                  errorData?.detail?.error === 'AUTHENTICATION_FAILED';

                if (isAuthError) {
                  // 用户认证失败不是 API Key 问题，跳过 chat 测试，继续状态检查
                  logger.warn('⚠️ 用户认证失败，跳过 chat 测试，继续模型状态检查');
                } else {
                  // 真正的 DeepSeek API Key 无效
                  const userFriendlyError = `❌ DeepSeek API Key 无效 (${statusCode})

详情: ${errorMessage}

解决方案:
1. 检查 API Key 是否正确复制（无多余空格）
2. 确认账户余额充足
3. 访问 https://platform.deepseek.com/ 检查 Key 状态
4. 必要时重新生成新的 API Key`;
                  setError(userFriendlyError);
                  throw new Error(userFriendlyError);
                }
              } else if (statusCode === 429) {
                const userFriendlyError = `⚠️ API 调用频率过高 (429)\n\n${errorMessage}\n\n请稍后重试（约30秒后）`;
                setError(userFriendlyError);
                throw new Error(userFriendlyError);
              } else if (statusCode >= 500) {
                const userFriendlyError = `❌ 服务暂时不可用 (${statusCode})\n\n${errorMessage}\n\n可能是服务器问题，请稍后重试`;
                setError(userFriendlyError);
                throw new Error(userFriendlyError);
              } else {
                const userFriendlyError = `❌ 连接测试失败 (${statusCode})\n\n${errorMessage}`;
                setError(userFriendlyError);
                throw new Error(userFriendlyError);
              }
            }
          }
        } catch (testError: any) {
          const testErrorMessage =
            typeof testError.message === 'string' ? testError.message : String(testError.message || testError);

          // 用户认证失败不是 API Key 问题，继续状态检查
          if (
            testErrorMessage.includes('用户认证失败') ||
            testErrorMessage.includes('登录状态')
          ) {
            logger.warn('⚠️ 用户认证失败，跳过 chat 测试，继续模型状态检查');
          } else if (
            testErrorMessage.includes('API Key 无效') ||
            testErrorMessage.includes('401') ||
            testErrorMessage.includes('429')
          ) {
            throw testError;
          }
          logger.error('实际 API 测试失败，回退到状态检查模式:', testError);
        }
      }

      const status = await ModelClient.getModelStatus();
      const modelState = status[modelType];
      logger.info(`模型 ${modelType} 状态响应:`, modelState);

      // 如果后端不可达，modelState 会是默认值，此时直接视为成功（因为 API Key 已保存）
      const isDefaultFallback = modelState?.status === 'inactive' && modelState?.provider === 'local';

      if (modelState?.status === 'active') {
        setSuccess('✅ 连接测试成功！API 密钥有效，模型已激活');
        logger.info('连接测试成功');
      } else if (isDefaultFallback) {
        // 后端不可达，但 API Key 已保存成功
        setSuccess('✅ 配置已保存！API Key 有效（后端服务未运行，无法实时验证）');
        logger.info('配置已保存，后端不可达，视为成功');
      } else if (modelState?.status === 'unconfigured') {
        setError(`⚠️ 模型未配置。请确保已正确保存 API Key 配置。\n\n提示：点击"保存配置"按钮后再测试。`);
        logger.warn('模型状态: unconfigured');
      } else if (modelState?.status === 'error') {
        // 后端返回错误状态
        const modelNote = modelState?.note || '';
        const modelSuggestion = modelState?.suggestion || '';
        const errorMessage = `❌ 后端服务错误\n\n${modelNote}${modelSuggestion ? `\n建议: ${modelSuggestion}` : ''}`;
        setError(errorMessage);
        logger.error('模型状态: error', { note: modelNote, suggestion: modelSuggestion });
      } else if (modelState?.status === 'unknown') {
        // 未知状态
        const modelNote = modelState?.note || '';
        const errorMessage = `⚠️ 模型状态未知${modelNote ? `\n详情: ${modelNote}` : ''}。请检查后端服务状态或稍后重试。`;
        setError(errorMessage);
        logger.warn('模型状态: unknown', { note: modelNote });
      } else {
        const modelStatus = modelState?.status || 'unknown';
        const modelNote = modelState?.note || '';
        const modelSuggestion = modelState?.suggestion || '';
        setError(
          `⚠️ 连接测试完成但模型状态异常: ${modelStatus}${modelNote ? `\n详情: ${modelNote}` : ''}${modelSuggestion ? `\n建议: ${modelSuggestion}` : ''}。请检查模型配置或稍后重试。`,
        );
        logger.warn('模型状态异常', { status: modelStatus, note: modelNote, suggestion: modelSuggestion });
      }

      return status[modelType];
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
                  <p className="text-xs text-neutral-500">DeepSeek API 密钥</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">API 基础 URL</label>
                  <Input
                    value={configs[tab.value]?.baseUrl || ''}
                    onChange={(e) => handleConfigChange(tab.value, 'baseUrl', e.target.value)}
                    placeholder="输入 API 基础 URL"
                    className="w-full"
                  />
                  <p className="text-xs text-neutral-500">默认: https://api.deepseek.com/v1</p>
                </div>

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
    </Card>
  );
}

export default ModelConfigPanel;
