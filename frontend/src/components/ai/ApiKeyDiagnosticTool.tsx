/**
 * API Key 诊断工具 v7.1
 *
 * 用于快速定位和解决 401 Unauthorized 认证失败问题
 * 功能：
 * - 自动检测当前存储的 API Key
 * - 识别隐藏字符和格式问题
 * - 一键清洗和修复
 * - 实时验证 Key 有效性
 * - 详细的诊断报告生成
 */
import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Alert,
  AlertDescription,
} from '@/components/ui'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ClipboardCopy,
  ExternalLink,
  Shield,
  Bug,
  Terminal,
  Zap,
} from 'lucide-react'
import { unifiedApiKeyManager } from '@/utils/unifiedApiKeyManager'
import { logger } from '@/utils/safeLogger'

interface DiagnosticResult {
  timestamp: string
  source: string | null
  rawKey: string
  cleanedKey: string
  keyLength: number
  cleanedLength: number
  hiddenCharsRemoved: number
  isValidFormat: boolean
  issues: string[]
  suggestions: string[]
}

export default function ApiKeyDiagnosticTool() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRawKey, setShowRawKey] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: unknown
  } | null>(null)

  useEffect(() => {
    runDiagnostic()
  }, [])

  /**
   * 运行完整的 API Key 诊断
   */
  const runDiagnostic = async () => {
    setLoading(true)
    setTestResult(null)

    try {
      // Step 1: 从统一管理器获取 Key
      const keyResult = await unifiedApiKeyManager.getApiKey()
      const rawKey = keyResult.apiKey

      // Step 2: 清洗 Key（移除隐藏字符）
      const cleanedKey = sanitizeKey(rawKey)

      // Step 3: 分析问题
      const issues: string[] = []
      const suggestions: string[] = []

      if (!rawKey) {
        issues.push('❌ 未找到任何 API Key 配置')
        suggestions.push('请在"配置管理" → "LLM" Tab 中输入您的 DeepSeek API Key')
      } else {
        const trimmedKey = rawKey.trim()

        // 检查是否是有效的 DeepSeek API Key 格式
        const isValidDeepSeekKey = /^sk-[a-zA-Z0-9]{20,}$/.test(trimmedKey)

        // 检查长度
        if (trimmedKey.length < 20) {
          issues.push(`⚠️ Key 长度过短：${trimmedKey.length} 字符 (需要 ≥20)`)
          suggestions.push('请确认完整复制了 API Key，通常应为 40-60 字符')
        } else if (trimmedKey.length > 100) {
          issues.push(`⚠️ Key 长度过长：${trimmedKey.length} 字符 (通常 ≤100)`)
          suggestions.push('可能包含了多余的内容，请检查是否完整复制')
        }

        // 检查格式
        if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('Bearer ')) {
          issues.push('⚠️ Key 格式异常：不以 "sk-" 或 "Bearer " 开头')
          suggestions.push('DeepSeek API Key 通常以 "sk-" 开头，请检查是否复制正确')
        }

        // 如果是 sk- 开头，进行更详细的格式验证
        if (trimmedKey.startsWith('sk-')) {
          if (!isValidDeepSeekKey && trimmedKey.length >= 20) {
            issues.push('⚠️ DeepSeek API Key 格式可能不正确')
            suggestions.push('有效的DeepSeek Key应为: sk- + 字母数字组合（无特殊符号）')
          }
        }

        // 检查隐藏字符
        const hiddenCount = rawKey.length - cleanedKey.length
        if (hiddenCount > 0) {
          issues.push(`⚠️ 发现 ${hiddenCount} 个隐藏字符`)
          suggestions.push('点击"清洗并修复"按钮自动移除隐藏字符')
        }

        // 检查常见占位符（仅检测完整的占位符文本，不误判真实API Key）
        const fullPlaceholders = [
          'your-api-key',
          'your-api-key-here',
          'YOUR_API_KEY',
          '<your-api-key>',
          'your_api_key_here',
          'REPLACE_WITH_YOUR_KEY',
          'test',
          'demo',
          'example',
        ]

        const isExactPlaceholder = fullPlaceholders.some(
          p => trimmedKey.toLowerCase() === p.toLowerCase(),
        )

        // 只有当key很短且不是sk-开头时，才判定为可能的占位符
        const isLikelyPlaceholder = trimmedKey.length <= 15 &&
                                   !trimmedKey.startsWith('sk-') &&
                                   !trimmedKey.startsWith('Bearer ')

        if (isExactPlaceholder || isLikelyPlaceholder) {
          issues.push('❌ 检测到占位符文本，不是真实的 API Key')
          suggestions.push('请替换为从 https://platform.deepseek.com/ 获取的真实 API Key')
          suggestions.push('真实API Key通常以"sk-"开头，长度为32-60个字符')
        }

        // 如果没有问题
        if (issues.length === 0) {
          if (isValidDeepSeekKey) {
            suggestions.push('✅ API Key 格式完全符合 DeepSeek 规范')
          } else {
            suggestions.push('✅ API Key 格式看起来正常')
          }
          suggestions.push('如果仍然出现 401 错误，可能是 Key 已过期或账户余额不足')
          suggestions.push('请访问 https://platform.deepseek.com/ 检查您的API Key状态')
        }
      }

      const result: DiagnosticResult = {
        timestamp: new Date().toISOString(),
        source: keyResult.source,
        rawKey,
        cleanedKey,
        keyLength: rawKey.length,
        cleanedLength: cleanedKey.length,
        hiddenCharsRemoved: rawKey.length - cleanedKey.length,
        isValidFormat: issues.filter(i => i.includes('❌')).length === 0,
        issues,
        suggestions,
      }

      setDiagnostic(result)
      logger.info('API Key 诊断完成', result)
    } catch (error) {
      logger.error('API Key 诊断失败:', error)
      setDiagnostic({
        timestamp: new Date().toISOString(),
        source: null,
        rawKey: '',
        cleanedKey: '',
        keyLength: 0,
        cleanedLength: 0,
        hiddenCharsRemoved: 0,
        isValidFormat: false,
        issues: ['❌ 诊断过程发生错误'],
        suggestions: ['请刷新页面重试', '检查浏览器控制台是否有详细错误信息'],
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 清洗 API Key（移除隐藏字符）
   */
  const sanitizeKey = (key: string): string => {
    if (!key) return ''

    let cleaned = key.trim()
    cleaned = cleaned.replace(/[\s\r\n\t\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '')
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')

    return cleaned
  }

  /**
   * 一键清洗并更新存储
   */
  const handleCleanAndFix = async () => {
    if (!diagnostic?.rawKey) return

    try {
      const cleanedKey = diagnostic.cleanedKey

      if (cleanedKey.length >= 20) {
        // 同步到安全存储
        await unifiedApiKeyManager.syncToAll(cleanedKey, 'deepseek')

        setTestResult({
          success: true,
          message: `✅ 清洗完成！已移除 ${diagnostic.hiddenCharsRemoved} 个隐藏字符，Key 已更新`,
        })

        setTimeout(() => runDiagnostic(), 1000)
      } else {
        setTestResult({
          success: false,
          message: '❌ 清洗后 Key 仍然太短或为空，无法保存',
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ 更新失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
    }
  }

  /**
   * 复制到剪贴板
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setTestResult({ success: true, message: '✅ 已复制到剪贴板' })
      setTimeout(() => setTestResult(null), 2000)
    })
  }

  /**
   * 测试 API 连接
   */
  const testConnection = async () => {
    if (!diagnostic?.cleanedKey) return

    setTestResult({ success: false, message: '🔄 正在测试连接...' })

    try {
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'test',
          api_key: diagnostic.cleanedKey,
        }),
      })

      if (response.ok) {
        setTestResult({
          success: true,
          message: '✅ 连接成功！API Key 有效',
        })
      } else {
        const errorData = await response.json()
        setTestResult({
          success: false,
          message: `❌ 连接失败 (${response.status}): ${errorData.answer || response.statusText}`,
          details: errorData,
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ 网络错误: ${error instanceof Error ? error.message : '未知错误'}`,
      })
    }
  }

  if (!diagnostic) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-neutral-600">正在分析 API Key...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="w-5 h-5 text-secondary-600" />
              API Key 诊断工具 v7.1
            </CardTitle>
            <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              重新诊断
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 状态概览 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">存储来源</p>
              <Badge variant={diagnostic.source === 'none' ? 'danger' : 'neutral'}>
                {diagnostic.source || '未配置'}
              </Badge>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">原始长度</p>
              <p className="text-lg font-bold">{diagnostic.keyLength} 字符</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">隐藏字符</p>
              <p className={`text-lg font-bold ${diagnostic.hiddenCharsRemoved > 0 ? 'text-error-600' : 'text-success-600'}`}>
                {diagnostic.hiddenCharsRemoved} 个
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">格式有效性</p>
              {diagnostic.isValidFormat ? (
                <CheckCircle2 className="w-6 h-6 text-success-600" />
              ) : (
                <XCircle className="w-6 h-6 text-error-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key 详情 */}
      {diagnostic.rawKey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              API Key 详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* 原始 Key */}
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  原始值（可能包含隐藏字符）
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="!h-6 !px-2"
                  >
                    {showRawKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </label>
                <div className="mt-1 p-3 bg-neutral-900 text-success-400 rounded-md font-mono text-sm break-all relative group">
                  {showRawKey ? diagnostic.rawKey : maskKey(diagnostic.rawKey)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(diagnostic.rawKey)}
                    className="absolute top-2 right-2 !h-7 !px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ClipboardCopy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 清洗后 Key */}
              {diagnostic.hiddenCharsRemoved > 0 && (
                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    清洗后值（已移除隐藏字符）
                  </label>
                  <div className="mt-1 p-3 bg-success-900 text-success-300 rounded-md font-mono text-sm break-all">
                    {maskKey(diagnostic.cleanedKey)}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2">
                {diagnostic.hiddenCharsRemoved > 0 && (
                  <Button onClick={handleCleanAndFix} size="sm">
                    <Zap className="w-4 h-4 mr-2" />
                    清洗并修复
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={testConnection}
                  size="sm"
                  disabled={!diagnostic.cleanedKey}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  测试连接
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://platform.deepseek.com/', '_blank')
                  }
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  获取新 Key
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 问题列表 */}
      {diagnostic.issues.length > 0 && (
        <Alert variant={diagnostic.issues.some(i => i.includes('❌')) ? 'destructive' : 'warning'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1 mt-2">
              <p className="font-semibold">发现的问题：</p>
              {diagnostic.issues.map((issue, idx) => (
                <p key={idx}>{issue}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 建议 */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            💡 建议与解决方案
          </h4>
          <ul className="space-y-2">
            {diagnostic.suggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                <span className="text-secondary-500 mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}>
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}

      {/* 诊断时间戳 */}
      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-right">
        最后诊断时间: {new Date(diagnostic.timestamp).toLocaleString()}
      </p>
    </div>
  )
}

/**
 * 脱敏显示 API Key
 */
function maskKey(key: string): string {
  if (!key || key.length <= 12) return key || '(空)'
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
}
