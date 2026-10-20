/**
 * DeepSeek API 密钥配置面板 v2.0 (Enterprise Edition)
 *
 * 功能特性：
 * - 企业级安全存储（AES-256-GCM 加密）
 * - 实时表单验证与强度检测
 * - 可视化配置状态指示
 * - 一键测试连接功能
 * - 完整的错误处理和用户引导
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Input,
  Button,
  Alert,
  Badge,
} from '@/components/ui'
import {
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Copy,
  Trash2,
  Lock,
  Key,
  Zap,
  Info,
} from 'lucide-react'
import { secureApiKeyManager, type ApiKeyMetadata } from '@/utils/secureKeyManager'
import { unifiedApiKeyManager } from '@/utils/unifiedApiKeyManager'
import { ConfigManager } from '@/utils/configManager'
import { logger } from '@/utils/safeLogger'

// ══════════════════════════════════════
// 类型定义
// ══════════════════════════════════════

interface ApiKeyConfigPanelProps {
  className?: string
  onConfigSuccess?: (metadata: ApiKeyMetadata) => void
  onConfigError?: (error: string) => void
  showTestButton?: boolean
}

type ConfigStatus = 'idle' | 'validating' | 'saving' | 'testing' | 'success' | 'error'

// ══════════════════════════════════════
// 主组件
// ══════════════════════════════════════

export function ApiKeyConfigPanel({
  className,
  onConfigSuccess,
  onConfigError,
  showTestButton = true,
}: ApiKeyConfigPanelProps) {
  // 状态管理
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [status, setStatus] = useState<ConfigStatus>('idle')
  const [message, setMessage] = useState('')
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    error?: string
    warning?: string
    strength: 'weak' | 'medium' | 'strong'
  } | null>(null)

  // 配置状态
  const [isConfigured, setIsConfigured] = useState(false)
  const [configInfo, setConfigInfo] = useState<{
    maskedKey: string
    provider: string
    configuredAt: string
  } | null>(null)

  // 初始化：检查现有配置
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    checkExistingConfig()
  }, [])

  /**
   * 检查是否已有配置
   */
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const checkExistingConfig = useCallback(() => {
    try {
      const summary = secureApiKeyManager.getStatusSummary()
      setIsConfigured(summary.configured)

      if (summary.configured) {
        setConfigInfo({
          maskedKey: summary.maskedKey,
          provider: summary.provider,
          configuredAt: summary.configuredAt,
        })
        logger.info('检测到已有的 API Key 配置')
      }
    } catch (error) {
      logger.error('检查配置失败:', error)
    }
  }, [])

  /**
   * 实时验证输入
   */
  const handleInputChange = useCallback((value: string) => {
    setApiKey(value)

    if (!value || value.trim() === '') {
      setValidationResult(null)
      return
    }

    // 实时验证
    const result = secureApiKeyManager.validateApiKey(value)
    setValidationResult(result)

    // 如果之前有错误状态，清除它
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }, [status])

  /**
   * 处理提交
   */
  const handleSubmit = useCallback(async () => {
    // 前端验证
    const validation = secureApiKeyManager.validateApiKey(apiKey)

    if (!validation.isValid) {
      setStatus('error')
      setMessage(validation.error || 'API Key 格式无效')
      onConfigError?.(validation.error || '验证失败')
      return
    }

    // 开始保存
    setStatus('saving')
    setMessage('正在安全存储并同步...')

    try {
      // 使用统一管理器同步到两个存储位置 (安全存储 + 传统存储)
      const syncResults = await unifiedApiKeyManager.syncToAll(apiKey, 'deepseek')

      // 检查是否至少有一个成功
      const hasSuccess = syncResults.some(r => r.success)

      if (hasSuccess) {
        setStatus('success')
        const successMessages = syncResults
          .filter(r => r.success)
          .map(r => r.message)
          .join('; ')

        setMessage(`✅ ${successMessages}`)

        // 更新状态显示
        checkExistingConfig()

        // 回调通知
        const metadata = secureApiKeyManager.getMetadata()
        onConfigSuccess?.(metadata!)

        logger.info('API Key 配置并同步成功', syncResults)

        // 3秒后切换到已配置视图
        setTimeout(() => {
          setStatus('idle')
          setMessage('')
        }, 3000)
      } else {
        throw new Error(syncResults.map(r => r.message).join('; '))
      }

    } catch (error) {
      setStatus('error')
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      setMessage(`❌ 配置失败: ${errorMsg}`)
      onConfigError?.(errorMsg)
      logger.error('API Key 配置失败:', error)
    }
  }, [apiKey, checkExistingConfig, onConfigSuccess, onConfigError])

  /**
   * 测试 API 连接
   */
  const handleTestConnection = useCallback(async () => {
    if (!isConfigured) {
      setStatus('error')
      setMessage('请先配置 API Key')
      return
    }

    setStatus('testing')
    setMessage('正在测试连接到 DeepSeek API...')

    try {
      // 从安全存储获取密钥
      const storedKey = await secureApiKeyManager.getApiKey()

      if (!storedKey) {
        throw new Error('无法读取已存储的 API Key')
      }

      // 调用后端测试接口（D-3 收敛：改用不写库的验活端点，避免误写全局配置）
      const testResult = await ConfigManager.testUserLlmKey({
        provider: 'deepseek',
        apiKey: storedKey,
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
      })

      if (testResult.success) {
        setStatus('success')
        setMessage(`🎉 连接测试成功！模型: deepseek-chat`)

        setTimeout(() => {
          setStatus('idle')
          setMessage('')
        }, 3000)
      } else {
        throw new Error(testResult.detail || '验活失败')
      }

    } catch (error) {
      setStatus('error')
      const errorMsg = error instanceof Error ? error.message : '连接测试失败'
      setMessage(`❌ 连接失败: ${errorMsg}`)
      logger.error('API 连接测试失败:', error)
    }
  }, [isConfigured])

  /**
   * 重置/删除配置
   */
  const handleReset = useCallback(() => {
    if (!window.confirm('确定要删除当前 API Key 配置吗？删除后将无法使用 AI 功能。')) {
      return
    }

    const success = secureApiKeyManager.removeApiKey()

    if (success) {
      setApiKey('')
      setIsConfigured(false)
      setConfigInfo(null)
      setValidationResult(null)
      setStatus('idle')
      setMessage('⚠️ API Key 已删除，请重新配置')

      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
    } else {
      setStatus('error')
      setMessage('❌ 删除失败')
    }
  }, [])

  /**
   * 复制提示信息
   */
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setMessage('✅ 已复制到剪贴板')
      setTimeout(() => setMessage(''), 2000)
    })
  }, [])

  // ══════════════════════════════════════
  // 渲染部分
  // ══════════════════════════════════════

  return (
    <Card className={`p-6 ${className || ''}`}>
      {/* 标题区域 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            DeepSeek API 密钥配置
          </h2>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
            安全配置你的 API 密钥以启用 AI 智能对话功能
          </p>
        </div>

        {isConfigured && (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            已配置
          </Badge>
        )}
      </div>

      {/* 状态消息 */}
      {message && (
        <Alert
          variant={
            status === 'success' ? 'success' :
            status === 'error' ? 'destructive' :
            'default'
          }
          className="mb-4"
        >
          {status === 'success' && <CheckCircle className="w-4 h-4" />}
          {status === 'error' && <XCircle className="w-4 h-4" />}
          {(status === 'saving' || status === 'testing') && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{message}</span>
        </Alert>
      )}

      {/* 已配置状态视图 */}
      {isConfigured && !apiKey ? (
        <div className="space-y-4">
          {/* 配置信息卡片 */}
          <div className="p-4 rounded-lg bg-success-50 dark:bg-success-300/15 border border-success-200 dark:border-success-800/40">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-success-600" />
                  <span className="font-medium text-success-700 dark:text-success-600">
                    API Key 已安全存储
                  </span>
                </div>

                <div className="text-sm space-y-1">
                  <p className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium">脱敏显示：</span>
                    <code className="ml-2 px-2 py-1 bg-white dark:bg-neutral-800 rounded text-xs">
                      {configInfo?.maskedKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(configInfo?.maskedKey || '')}
                      className="ml-2 text-primary-500 hover:text-primary-700"
                    >
                      <Copy className="w-3 h-3 inline" />
                    </button>
                  </p>

                  <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">
                    <span>提供商：</span>{configInfo?.provider || 'deepseek'}
                    {' • '}
                    <span>配置时间：</span>
                    {configInfo?.configuredAt ? new Date(configInfo.configuredAt).toLocaleString('zh-CN') : '未知'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 ml-4">
                {showTestButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    loading={status === 'testing'}
                    icon={<Zap className="w-4 h-4" />}
                  >
                    测试连接
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsConfigured(false)
                    setApiKey('')
                  }}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  更新
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  icon={<Trash2 className="w-4 h-4 text-danger-500" />}
                >
                  删除
                </Button>
              </div>
            </div>
          </div>

          {/* 安全说明 */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-200 dark:border-secondary-800/40">
            <Info className="w-4 h-4 text-secondary-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-secondary-700 dark:text-secondary-700">
              <p className="font-medium">安全提示</p>
              <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
                <li>API Key 使用 AES-256-GCM 军事级加密存储在本地浏览器中</li>
                <li>密钥不会明文传输或暴露在网络请求日志中</li>
                <li>每次使用时动态解密，用完立即从内存清除</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* 输入表单 */
        <div className="space-y-4">
          {/* API Key 输入框 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
              <Key className="w-4 h-4" />
              API 密钥
              <span className="text-danger-500">*</span>
            </label>

            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (通常50+字符)"
                className={`pr-20 ${
                  validationResult?.isValid === false ? 'border-danger-300 focus:border-danger-500' :
                  validationResult?.isValid === true ? 'border-success-300 focus:border-success-500' :
                  ''
                }`}
                disabled={status === 'saving' || status === 'testing'}
                autoFocus
              />

              {/* 显示/隐藏按钮 */}
              <button
                type="button"
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                onClick={() => setShowApiKey(!showApiKey)}
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              {/* 强度指示器 */}
              {validationResult?.isValid && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Badge
                    variant={
                      validationResult.strength === 'strong' ? 'success' :
                      validationResult.strength === 'medium' ? 'warning' :
                      'danger'
                    }
                    className="text-xs"
                  >
                    {validationResult.strength === 'strong' ? '强' :
                     validationResult.strength === 'medium' ? '中' : '弱'}
                  </Badge>
                </div>
              )}
            </div>

            {/* 验证反馈 */}
            {validationResult && (
              <div className={`text-xs flex items-center gap-1 ${
                validationResult.isValid === false ? 'text-danger-600' :
                validationResult.warning ? 'text-warning-600' :
                'text-success-600'
              }`}>
                {validationResult.isValid === false && <XCircle className="w-3 h-3" />}
                {validationResult.isValid === true && !validationResult.warning && <CheckCircle className="w-3 h-3" />}
                {validationResult.warning && <AlertTriangle className="w-3 h-3" />}
                <span>
                  {validationResult.error ||
                   validationResult.warning ||
                   (validationResult.isValid ? '格式正确 ✓' : '')}
                </span>
              </div>
            )}
          </div>

          {/* 提交按钮组 */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!apiKey.trim() || !validationResult?.isValid || status === 'saving' || status === 'testing'}
              loading={status === 'saving'}
              icon={<Shield className="w-4 h-4" />}
              className="flex-1"
            >
              {status === 'saving' ? '正在加密保存...' : '安全保存配置'}
            </Button>

            {isConfigured && (
              <Button
                variant="ghost"
                onClick={() => {
                  setApiKey('')
                  setIsConfigured(true)
                }}
              >
                取消
              </Button>
            )}
          </div>

          {/* 帮助信息 */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
            {/* 交叉引导文案 */}
            <div className="mb-3 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-200 dark:border-secondary-800/40">
              <p className="text-xs text-secondary-700 dark:text-secondary-700 font-medium mb-1">
                💡 这是<strong>快速配置</strong>入口（推荐大多数用户使用）
              </p>
              <ul className="text-xs text-secondary-600 dark:text-secondary-700 space-y-1 list-disc list-inside">
                <li>✅ 适合首次配置或只想快速开始使用的用户</li>
                <li>✅ 使用 AES-256-GCM 军事级加密保护</li>
                <li>✅ 配置会自动同步到系统所有模块</li>
              </ul>
              <p className="text-xs text-secondary-500 dark:text-secondary-700 mt-2">
                📌 如需管理多个模型或调整高级参数（temperature/timeout等），
                请前往页面顶部的<strong>"配置管理"</strong>标签页。
              </p>
            </div>

            <details className="group">
              <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300">
                如何获取 DeepSeek API Key？
              </summary>

              <div className="mt-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-xs space-y-2">
                <ol className="list-decimal list-inside space-y-1 text-neutral-600 dark:text-neutral-400">
                  <li>访问 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">DeepSeek 开放平台</a></li>
                  <li>注册/登录账号</li>
                  <li>进入左侧菜单 <strong>"API Keys"</strong></li>
                  <li>点击 <strong>"Create API Key"</strong></li>
                  <li>复制完整的 API Key（以 sk- 开头）</li>
                  <li>粘贴到上方输入框并点击保存</li>
                </ol>

                <p className="text-warning-600 dark:text-warning-700 mt-2">
                  ⚠️ 请确保账户余额充足，API 调用可能产生费用
                </p>
              </div>
            </details>
          </div>
        </div>
      )}
    </Card>
  )
}

export default ApiKeyConfigPanel
