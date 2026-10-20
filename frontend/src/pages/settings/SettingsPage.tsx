/**
 * 设置页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard 风格统一
 *   - 横排药丸 Tab 导航（桌面自动显示，移动端自动折叠）
 *   - 宽卡片布局，去除 max-w-sm 限制，充分利用空间
 *   - 全页面间距宽松（space-y-6、card p-6、section gap-5）
 *   - 去除侧边栏，内容全宽展开
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import {
  User, KeyRound, Shield, CheckCircle, AlertCircle,
  Mail, Bell, Clock, Smartphone,
  ShieldAlert, RefreshCw, Key, Copy, Plus, Download, Upload,
  Globe, MapPin, CheckCircle2,
  QrCode, Info, ShieldCheck, BellRing,
  SmartphoneIcon, Trash, Palette,
  Brain, Server, Loader2,
} from 'lucide-react'
import {
  Button, Input,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import {
  use2FAStatus, useEnable2FA, useDisable2FA, useVerify2FA,
  useDevices, useRemoveDevice,
  usePreferences, useUpdatePreferences,
  useExportData, useImportData,
  useLoginHistory, useClearUserData,
} from '@/hooks/useUserSettings'
import { ThemePanel } from '@/components/theme/ThemePanel'
import i18n from '@/i18n'
import { PersonalInfoSection } from './components/PersonalInfoSection'
import { AccountDeactivationSection } from './components/AccountDeactivationSection'
import { McpServersPanel } from './components/McpServersPanel'
import { ConfigManager } from '@/utils/configManager'
import { unifiedApiKeyManager } from '@/utils/unifiedApiKeyManager'
import ModelClient from '@/api/modelClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAPIKeys, revokeAPIKey, type APIKeySummary,
} from '@/api/integrations'
import ApiKeyCreateDialog from '@/components/integrations/ApiKeyCreateDialog'

// ─── Tab 定义 ─────────────────────────────────────────────────────
type TabId = 'account' | 'security' | 'api' | 'data' | 'locale' | 'theme' | 'notifications' | 'llm' | 'mcp'

// 语言模块支持的语言（与全局 i18n 资源保持一致；日语已按需求剔除，替换为德语）
const SUPPORTED_LOCALE_OPTIONS = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
]

const TABS: { id: TabId; labelKey: string; icon: typeof User; descKey: string }[] = [
  { id: 'account',  labelKey: 'pages.settings.tabAccount',  icon: User,  descKey: 'pages.settings.accountDesc' },
  { id: 'security', labelKey: 'pages.settings.tabSecurity',  icon: Shield, descKey: 'pages.settings.securityDesc' },
  { id: 'api',      labelKey: 'pages.settings.tabApi',   icon: Key,   descKey: 'pages.settings.apiDesc' },
  { id: 'data',     labelKey: 'pages.settings.tabData',  icon: Download, descKey: 'pages.settings.dataDesc' },
  { id: 'locale',   labelKey: 'pages.settings.tabLocale',  icon: Globe, descKey: 'pages.settings.localeDesc' },
  { id: 'theme',    labelKey: 'pages.settings.tabTheme',  icon: Palette, descKey: 'pages.settings.themeDesc' },
  { id: 'notifications', labelKey: 'pages.settings.tabNotifications', icon: Bell, descKey: 'pages.settings.notificationsDesc' },
  { id: 'llm', labelKey: 'pages.settings.tabLlm', icon: Brain, descKey: 'pages.settings.llmDesc' },
  { id: 'mcp', labelKey: 'pages.settings.tabMcp', icon: Server, descKey: 'pages.settings.mcpDesc' },
]

// ─── 角色显示映射（账户信息卡片） ──────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  reviewer: '审核员',
  researcher: '研究员',
  formulator: '配方师',
  guest: '访客',
}

// ─── 工具函数 ─────────────────────────────────────────────────────
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })

// ─── LLM 配置面板（独立组件，hooks 归属自身 fiber，避免 Rules of Hooks 违规）────
// provider 预设 — 与后端 PROVIDER_PRESETS（ai_model_config_service.py）对齐
const LLM_PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string; defaultModel: string; models: string[] }> = {
  deepseek:  { label: 'DeepSeek（深度求索）', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
  openai:    { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  zhipu:     { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-plus', models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'] },
  qwen:      { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  anthropic: { label: 'Anthropic（Claude）', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-sonnet', models: ['claude-3-5-sonnet', 'claude-3-opus'] },
}

function LlmPanel() {
  // 初始化：从真实数据通道（rmfood_model_configs.llm）读取，而非孤立的 api_keys 列表
  const initial = ConfigManager.getModelConfig('llm')
  const [apiKey, setApiKey] = useState(initial.apiKey ?? '')
  const [model, setModel] = useState(initial.model ?? LLM_PROVIDER_PRESETS[initial.provider || 'deepseek']?.defaultModel ?? 'deepseek-chat')
  const [temperature, setTemperature] = useState(initial.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(initial.maxTokens ?? 4096)
  const [provider, setProvider] = useState(initial.provider || 'deepseek')
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? LLM_PROVIDER_PRESETS.deepseek.baseUrl)
  const [syncToBackend, setSyncToBackend] = useState(true)

  // 保存后反馈：successMsg / errorMsg 两个独立 state，避免"成功文案"复用错误文案变量
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // 测试连接：先对**当前填写的密钥**做验活（POST /ai/models/config/test，不写库），
  // 再回读后端 /ai/models/status 的真实运行时状态，两段信息都如实展示
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [statusNote, setStatusNote] = useState<{ ok: boolean; detail: string } | null>(null)

  // key 校验
  const keyValid = apiKey.length >= 40
  const maskedKey = apiKey.length > 12 ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : (apiKey ? '***' : '')
  // 历史遗留明文密钥警示（未加密入库，保存时会被 encrypt() 正确加密）
  const legacyKeyWarning = Boolean((initial as { legacyUnencrypted?: boolean }).legacyUnencrypted)

  // ── 我的密钥（用户级，服务端存储）──────────────────────────────
  const [myKeyProvider, setMyKeyProvider] = useState(provider)
  const [myKeyApi, setMyKeyApi] = useState('')
  const [myKeyModel, setMyKeyModel] = useState(model)
  const [myKeyStatus, setMyKeyStatus] = useState<{ configured: boolean; provider?: string; model?: string; keyMasked?: string; note?: string } | null>(null)
  const [myKeyLoading, setMyKeyLoading] = useState(false)
  const [myKeyDeleting, setMyKeyDeleting] = useState(false)
  const [myKeyTestResult, setMyKeyTestResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [myKeyTestTesting, setMyKeyTestTesting] = useState(false)

  // 初始化时查询用户是否已配置个人密钥
  useEffect(() => {
    let cancelled = false
    ModelClient.getUserLlmKeyStatus().then(s => {
      if (!cancelled) setMyKeyStatus(s)
    })
    return () => { cancelled = true }
  }, [])

  // provider 不在预设中时（如手改过的字符串 / 已废弃的 openai-compat），baseUrl 不自动更新，
  // 展示 warning 提示用户手动核对地址，避免切服务商后 baseUrl 仍指向旧服务商
  const [providerWarning, setProviderWarning] = useState('')

  const handleProviderChange = (p: string) => {
    setProvider(p)
    const preset = LLM_PROVIDER_PRESETS[p]
    if (preset) {
      setBaseUrl(preset.baseUrl)
      setProviderWarning('')
      if (!preset.models.includes(model)) setModel(preset.defaultModel)
    } else {
      setProviderWarning(`服务商「${p}」不在预设列表中，Base URL 与模型需手动填写`)
    }
  }

  const handleSave = async () => {
    if (!keyValid) {
      setErrorMsg(`API 密钥长度不足（${apiKey.length}/40+ 字符），请完整复制以 "sk-" 开头的密钥`)
      setSuccessMsg('')
      return
    }
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const llmConfig = {
        ...ConfigManager.getModelConfig('llm'),
        apiKey,
        baseUrl,
        provider,
        model,
        temperature,
        maxTokens,
      }
      // ① 主通道：写入 rmfood_model_configs.llm（AI 对话实际读取的数据源）
      ConfigManager.setModelConfig('llm', llmConfig)
      // ② 双通道同步：secure(AES-256-GCM) + legacy，保证 unifiedApiKeyManager 读得到
      //    传入完整 llmConfig，消除"必须先 setModelConfig 再 syncToAll"的顺序依赖
      await unifiedApiKeyManager.syncToAll(apiKey, provider, llmConfig)
      // ③ 可选：同步到后端数据库（仅管理员可写，会即时更新运行时 LLM 服务）
      let backendNote = ''
      if (syncToBackend) {
        const r = await ConfigManager.syncToBackend('llm', llmConfig)
        if (r.success && r.llmActive !== undefined) {
          backendNote = r.llmActive && r.llmKeyConfigured
            ? '，已同步到后端数据库且密钥已生效'
            : '，已写入数据库但后端 LLM 运行时未激活（密钥未实际生效，请检查后端日志）'
        } else if (r.success) {
          backendNote = '，已同步到后端数据库'
        } else {
          // 失败时区分"权限不足"（HTTP 403）与"后端未启动"，给普通用户明确指引
          backendNote = '（后端同步失败：403 需管理员权限——当前 /ai 对话仍使用服务器已配置的密钥，您的本地配置不会影响对话功能；或后端服务未启动。本地已保存）'
        }
      }
      setSuccessMsg(`配置已保存${backendNote}`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: unknown) {
      setErrorMsg(`保存失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  // 测试连接：两段式——先验活当前填写的密钥（不写库），再回读后端运行时真实状态
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    setStatusNote(null)

    // ① 验活当前填写的密钥（POST /ai/models/config/test，不写库）
    if (apiKey.length >= 20) {
      try {
        const r = await ModelClient.testLlmConfig({ provider, apiKey, baseUrl, model })
        setTestResult({ ok: r.success, detail: r.detail })
      } catch (err: unknown) {
        setTestResult({ ok: false, detail: `验活请求失败：${err instanceof Error ? err.message : '网络错误'}` })
      }
    } else {
      setTestResult({ ok: false, detail: '请先填写有效密钥（≥ 20 字符）再验活' })
    }

    // ② 回读后端 /ai/models/status 的真实运行时状态（测的是后端当前密钥，不是刚填的）
    try {
      const status = await ModelClient.getModelStatus()
      const llm = status.llm
      if (llm && typeof llm === 'object' && 'status' in llm) {
        const st = llm as { status?: string; provider?: string; model?: string; note?: string; suggestion?: string; api_key_configured?: boolean; key_source?: string }
        const ok = st.status === 'active'
        const keySourceLabel = st.key_source === 'user'
          ? '（密钥来源：您的个人密钥）'
          : st.key_source === 'db'
            ? '（密钥来源：服务器数据库）'
            : st.key_source === 'env'
              ? '（密钥来源：服务器环境变量）'
              : st.key_source === 'none'
                ? '（服务器暂无密钥，/ai 对话将走降级推理引擎）'
                : ''
        setStatusNote({
          ok,
          detail: ok
            ? `后端当前 LLM 运行中：服务商 ${st.provider || provider}，模型 ${st.model || model}${keySourceLabel}`
            : `后端当前 LLM 未就绪（${st.status}）：${st.note || st.suggestion || '请保存配置后重试，或检查后端服务日志'}${keySourceLabel}`,
        })
      } else {
        setStatusNote({ ok: false, detail: '后端未返回 LLM 状态，请确认后端服务已启动' })
      }
    } catch (err: unknown) {
      setStatusNote({ ok: false, detail: `状态回读失败：${err instanceof Error ? err.message : '网络错误'}` })
    } finally {
      setTesting(false)
    }
  }

  // ── 我的密钥：保存 / 删除 / 验活 ─────────────────────────────
  const handleMyKeySave = async () => {
    if (myKeyApi.length < 20) {
      setMyKeyTestResult({ ok: false, detail: `密钥长度不足（${myKeyApi.length}/20 字符），请填写完整的 API 密钥` })
      return
    }
    setMyKeyLoading(true)
    setMyKeyTestResult(null)
    try {
      const r = await ModelClient.saveUserLlmKey({ provider: myKeyProvider, apiKey: myKeyApi, baseUrl, model: myKeyModel })
      if (r.success) {
        setMyKeyStatus({ configured: true, provider: myKeyProvider, model: myKeyModel, keyMasked: r.keyMasked })
        setMyKeyTestResult({ ok: true, detail: `您的个人密钥已保存（${r.keyMasked}），/ai 对话将使用您自己的密钥` })
        setMyKeyApi('')
      } else {
        setMyKeyTestResult({ ok: false, detail: r.error || '保存失败' })
      }
    } finally {
      setMyKeyLoading(false)
    }
  }

  const handleMyKeyDelete = async () => {
    setMyKeyDeleting(true)
    try {
      const r = await ModelClient.deleteUserLlmKey()
      if (r.success) {
        setMyKeyStatus({ configured: false, note: '已删除' })
        setMyKeyTestResult({ ok: true, detail: '您的个人密钥已删除，/ai 对话将回退到服务器密钥' })
      } else {
        setMyKeyTestResult({ ok: false, detail: r.message || '删除失败' })
      }
    } finally {
      setMyKeyDeleting(false)
    }
  }

  const handleMyKeyTest = async () => {
    if (myKeyApi.length < 20) {
      setMyKeyTestResult({ ok: false, detail: '请先填写有效密钥（≥ 20 字符）再验活' })
      return
    }
    setMyKeyTestTesting(true)
    setMyKeyTestResult(null)
    try {
      const r = await ModelClient.testUserLlmKey({ provider: myKeyProvider, apiKey: myKeyApi, baseUrl, model: myKeyModel })
      setMyKeyTestResult({ ok: r.success, detail: r.detail })
    } catch (err: unknown) {
      setMyKeyTestResult({ ok: false, detail: `验活请求失败：${err instanceof Error ? err.message : '网络错误'}` })
    } finally {
      setMyKeyTestTesting(false)
    }
  }

  return (
    <div className="space-y-[var(--space-apple-lg)]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">AI 模型配置</CardTitle>
              <CardDescription>设置 LLM 服务商、模型与密钥，保存后可用于 AI 对话、配方生成等功能</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-[var(--space-apple-md)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">服务商</label>
                <select value={provider} onChange={e => handleProviderChange(e.target.value)}
                  className="w-full h-9 px-[var(--space-apple-sm)] text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {Object.entries(LLM_PROVIDER_PRESETS).map(([value, preset]) => (
                    <option key={value} value={value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">模型</label>
                <Input value={model} onChange={e => setModel(e.target.value)}
                  placeholder={LLM_PROVIDER_PRESETS[provider]?.defaultModel ?? 'deepseek-chat'} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">API 接口地址（Base URL）</label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
              {providerWarning && (
                <p className="mt-1 text-xs text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {providerWarning}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">API 密钥</label>
                {maskedKey && <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">当前已存：{maskedKey}</span>}
              </div>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..." error={keyValid ? undefined : (apiKey ? `长度不足（${apiKey.length}/40 字符）` : 'API 密钥不能为空')} />
              {legacyKeyWarning && (
                <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/20 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 px-[var(--space-apple-sm)] py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] leading-relaxed">
                    <span className="font-medium">检测到历史遗留的未加密密钥</span>
                    <span className="ml-1">（脱敏显示：{maskedKey}）。该密钥此前未经加密入库，请重新粘贴完整密钥后保存，保存后将自动转为加密存储。</span>
                  </div>
                  <button type="button" onClick={() => setApiKey('')}
                    className="ml-auto shrink-0 text-xs font-medium text-[var(--color-warning-text)] hover:underline">
                    清空重新输入
                  </button>
                </div>
              )}
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                本地以加密方式存储；开启后端同步后仅写入您自己的服务器数据库，不会上传到第三方。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="llm-temperature">温度参数：{temperature}</label>
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">0 – 2</span>
                </div>
                <input id="llm-temperature" type="range" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' } as React.CSSProperties}
                  aria-valuemin={0} aria-valuemax={2} aria-valuenow={temperature} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">最大 Token 数</label>
                <Input type="number" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)}
                  min={1} max={32768} step={1} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50 px-[var(--space-apple-md)] py-[var(--space-apple-md)] border border-[var(--border-color)]">
              <div>
                <p className="text-sm font-medium">同步到后端数据库</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">保存时写入服务器 ai_model_configs 表并即时更新运行时 LLM 服务。该操作仅限管理员；普通用户开关不会造成损失，失败时本地配置仍完整保留</p>
              </div>
              <Switch checked={syncToBackend} onCheckedChange={setSyncToBackend} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-[var(--space-apple-sm)]">
            <Button variant="primary" size="md" loading={saving}
              icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}
              onClick={handleSave}>
              保存配置
            </Button>
            <Button variant="outline" size="md" loading={testing}
              icon={<Key className="w-4 h-4" aria-hidden="true" />}
              onClick={handleTestConnection}>
              测试连接
            </Button>
            {successMsg && (
              <span className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {successMsg}
              </span>
            )}
          </div>
          {errorMsg && <p className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{errorMsg}</p>}
          {testResult && (
            <div className={cn(
              'mt-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs leading-relaxed',
              testResult.ok
                ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 border-[var(--color-success-border)] dark:border-[var(--color-success)]/20 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                : 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/20 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]',
            )}>
              <p className="font-medium mb-1 flex items-center gap-1.5">
                {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                密钥验活结果（不写库）
              </p>
              {testResult.detail}
            </div>
          )}
          {statusNote && (
            <div className={cn(
              'mt-2 rounded-[var(--radius-Apple-sm)] border px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs leading-relaxed',
              statusNote.ok
                ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 border-[var(--color-success-border)] dark:border-[var(--color-success)]/20 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                : 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/20 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]',
            )}>
              <p className="font-medium mb-1 flex items-center gap-1.5">
                {statusNote.ok ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                后端运行时状态（回读 /ai/models/status）
              </p>
              {statusNote.detail}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 我的密钥（用户级，服务端存储，不影响全局配置） */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">我的密钥（个人）</CardTitle>
              <CardDescription>
                {myKeyStatus?.configured
                  ? `已配置：服务商 ${myKeyStatus.provider}，模型 ${myKeyStatus.model}，密钥 ${myKeyStatus.keyMasked}`
                  : '尚未配置个人密钥，/ai 对话使用服务器密钥'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-[var(--space-apple-md)]">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              保存后 /ai 对话将使用您自己的密钥驱动 LLM，与服务器全局配置相互独立。
              删除后回退到服务器密钥。密钥以 AES-256-GCM 加密存储，不会明文展示。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">服务商</label>
                <select value={myKeyProvider} onChange={e => setMyKeyProvider(e.target.value)}
                  className="w-full h-9 px-[var(--space-apple-sm)] text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {Object.entries(LLM_PROVIDER_PRESETS).map(([value, preset]) => (
                    <option key={value} value={value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">模型</label>
                <Input value={myKeyModel} onChange={e => setMyKeyModel(e.target.value)}
                  placeholder={LLM_PROVIDER_PRESETS[myKeyProvider]?.defaultModel ?? 'deepseek-chat'} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">API 密钥</label>
                {myKeyStatus?.configured && <span className="text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">当前已存：{myKeyStatus.keyMasked}</span>}
              </div>
              <Input type="password" value={myKeyApi} onChange={e => setMyKeyApi(e.target.value)}
                placeholder={myKeyStatus?.configured ? '留空则保留当前密钥' : 'sk-...'}
                error={myKeyApi && myKeyApi.length < 20 ? `长度不足（${myKeyApi.length}/20 字符）` : undefined} />
            </div>

            <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
              <Button variant="primary" size="md" loading={myKeyLoading}
                icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}
                onClick={handleMyKeySave}
                disabled={myKeyStatus?.configured && !myKeyApi}>
                {myKeyStatus?.configured ? '更新密钥' : '保存我的密钥'}
              </Button>
              <Button variant="outline" size="md" loading={myKeyTestTesting}
                icon={<Key className="w-4 h-4" aria-hidden="true" />}
                onClick={handleMyKeyTest}>
                验活密钥
              </Button>
              {myKeyStatus?.configured && (
                <Button variant="danger" size="md" loading={myKeyDeleting}
                  onClick={handleMyKeyDelete}>
                  删除我的密钥
                </Button>
              )}
            </div>

            {myKeyTestResult && (
              <div className={cn(
                'rounded-[var(--radius-Apple-sm)] border px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs leading-relaxed',
                myKeyTestResult.ok
                  ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 border-[var(--color-success-border)] dark:border-[var(--color-success)]/20 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                  : 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/20 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]',
              )}>
                <p className="font-medium mb-1 flex items-center gap-1.5">
                  {myKeyTestResult.ok ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                  我的密钥验活 / 操作结果
                </p>
                {myKeyTestResult.detail}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-[var(--color-secondary-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">配置说明</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)]">
            <li>保存后本地即时生效；AI 对话（/ai）由后端 LLM 服务驱动。密钥优先级：您的个人密钥（服务端存储）&gt; 服务器数据库 &gt; 服务器环境变量（测试连接可查 key_source）</li>
            <li>「我的密钥」卡片中的个人密钥由您自行管理，删除后立即回退到服务器密钥，两者互不影响</li>
            <li>开启后端同步后配置由管理员写入数据库并即时更新运行时 LLM 服务；普通用户同步失败不影响本地配置</li>
            <li>「测试连接」分两步：先用当前填写的密钥验活（不写库），再回读后端 <code className="font-mono">/ai/models/status</code> 的真实运行时状态与密钥来源</li>
            <li>密钥校验要求 ≥ 40 字符，通常以 sk- 开头；脱敏显示仅保留前 8 后 4 位</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── API 密钥管理面板（独立组件，hooks 归属自身 fiber，避免 Rules of Hooks 违规）────
// v2.0：从 localStorage 伪密钥升级为对接真实后端 /api/v1/integrations/api-keys，
// 密钥写入 api_keys 表，创建时仅返回一次明文，撤销走后端 is_active 置否。
function ApiKeyPanel() {
  const { addToast } = useToast()
  const qc = useQueryClient()

  // ── 密钥列表（后端真实数据，仅前缀不返回明文）──────────────────────
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ['integrations-api-keys'],
    queryFn: listAPIKeys,
    staleTime: 30_000,
  })
  const apiKeys: APIKeySummary[] = apiKeysData?.keys ?? []

  // 创建密钥 Dialog（共享组件统一处理创建 + 一次性明文展示）
  const [createOpen, setCreateOpen] = useState(false)
  const refreshApiKeys = () => qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })

  const revokeKeyMutation = useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })
      addToast({ type: 'success', message: 'API 密钥已撤销' })
    },
    onError: () => addToast({ type: 'error', message: '撤销失败，请重试' }),
  })

  // 过期状态（后端 expires_at 判定）
  const statusOf = (k: APIKeySummary): { label: string; variant: 'success' | 'warning' | 'danger' } => {
    if (k.is_revoked) return { label: '已撤销', variant: 'danger' }
    if (k.expires_at) {
      // eslint-disable-next-line react-hooks/purity -- 过期判断需要当前时间，属有意使用
      const d = (new Date(k.expires_at).getTime() - Date.now()) / 86400000
      if (d < 0) return { label: '已过期', variant: 'danger' }
      if (d <= 7) return { label: '即将过期', variant: 'warning' }
    }
    return { label: '活跃', variant: 'success' }
  }

  return (
    <div className="space-y-[var(--space-apple-lg)]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/10 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" aria-hidden="true" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">API 密钥</CardTitle>
                <CardDescription>用于程序化访问系统的凭证（服务端存储）</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="刷新列表"
                onClick={() => qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })}
                disabled={keysLoading}>
                <RefreshCw className={cn('w-4 h-4', keysLoading && 'animate-spin', 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]')} aria-hidden="true" />
              </Button>
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={() => setCreateOpen(true)}>
                创建密钥
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {keysLoading && apiKeys.length === 0 ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] animate-spin mx-auto mb-[var(--space-apple-md)]" aria-hidden="true" />
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">正在加载密钥…</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-[var(--space-apple-md)]">
                <Key className="w-6 h-6 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">暂无 API 密钥</p>
              <p className="text-xs text-[var(--text-muted)]">点击右上角按钮创建第一个密钥</p>
            </div>
          ) : (
            <div className="space-y-[var(--space-apple-sm)]">
              {apiKeys.map(key => {
                const st = statusOf(key)
                return (
                  <div key={key.id} className="p-5 rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-tertiary)]/30">
                    <div className="flex items-start justify-between gap-4 mb-[var(--space-apple-sm)]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[var(--text-primary)]">{key.name}</span>
                          <Badge variant={st.variant} size="sm">{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span>创建于 {key.created_at ? fmtDate(key.created_at) : '—'}</span>
                          {key.expires_at && (<><span>·</span><span>过期于 {fmtDate(key.expires_at)}</span></>)}
                          {key.last_used_at && (<><span>·</span><span>最后使用 {new Date(key.last_used_at).toLocaleString('zh-CN')}</span></>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="复制前缀"
                          onClick={() => { navigator.clipboard.writeText(key.key_prefix); addToast({ type: 'success', message: '密钥前缀已复制' }) }}>
                          <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/30" title="撤销密钥"
                          onClick={() => revokeKeyMutation.mutate(key.id)}>
                          <Trash className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-[var(--space-apple-sm)]">
                      <code className="text-sm font-mono px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] border border-[var(--border-color)] flex-1 truncate text-[var(--text-muted)]">
                        {key.key_prefix}
                      </code>
                    </div>
                    {key.scopes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-[var(--space-apple-sm)]">
                        {key.scopes.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] font-mono">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0">
          <p className="text-xs text-[var(--text-muted)]">
            <Info className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
            密钥明文仅在创建时展示一次，请妥善保存；列表仅显示前缀，便于识别。撤销后不可恢复。
          </p>
        </CardFooter>
      </Card>

      {/* 创建密钥 Dialog（共享组件统一处理创建 + 一次性明文展示） */}
      <ApiKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshApiKeys}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { addToast } = useToast()

  // ── Hooks ─────────────────────────────────────────────────────
  const { data: twoFaStatus } = use2FAStatus()
  const enable2FAMutation = useEnable2FA()
  const disable2FAMutation = useDisable2FA()
  const verify2FAMutation = useVerify2FA()
  const { data: devicesData } = useDevices()
  const removeDeviceMutation = useRemoveDevice()
  const updatePrefsMutation = useUpdatePreferences()
  const exportDataMutation = useExportData()
  const importDataMutation = useImportData()
  const { data: loginHistoryData } = useLoginHistory()
  const clearDataMutation = useClearUserData()
  const { data: preferencesData } = usePreferences()

  // ── State ─────────────────────────────────────────────────────
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || 'account'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!twoFaStatus?.enabled)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步 2FA 状态加载后同步到本地状态
  useEffect(() => { if (twoFaStatus) setTwoFactorEnabled(!!twoFaStatus.enabled) }, [twoFaStatus])

  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [show2FAModal, setShow2FAModal] = useState(false)
  // 2FA 启用响应（真实 secret + 备用码），弹窗内渲染真实二维码；
  // 旧实现弹静态 QrCode 占位图 + 硬编码备用码 "ABCD-..."，与后端完全脱节
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null)
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([])
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaVerifyMsg, setTwoFaVerifyMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [loadingSecurity, setLoadingSecurity] = useState(false)
  const modal2FARef = useRef<HTMLDivElement>(null)
  useFocusTrap(modal2FARef, show2FAModal, () => setShow2FAModal(false))

  // 设备/登录历史 — 直接消费后端 /users/me/settings 真实字段，
  // 旧实现用 useState(假数据) 捕获初始值，API 成功后永不刷新（"当前设备/厦门"假数据）
  const devices = devicesData?.devices ?? []
  const loginHistory = loginHistoryData?.history ?? []

  // ── 安全评分（基于 2FA/设备数/登录审计的启发式评估） ──
  const securityScore = (() => {
    let s = 0
    if (twoFactorEnabled) s += 50
    const dc = devices.length
    if (dc <= 1) s += 15
    else if (dc <= 4) s += 10
    else s += 5
    if (loginHistory.length > 0) s += 15
    s += 20 // 基础分（账户已配置密码）
    return Math.min(100, s)
  })()
  const securityGrade = securityScore >= 85
    ? { label: '优秀', desc: '您的账户安全防护水平很高', bg: 'var(--color-success-container)', text: 'var(--color-success-text)', bar: 'var(--color-success-text)' }
    : securityScore >= 60
      ? { label: '良好', desc: '账户安全状态良好，可进一步开启两步验证加固', bg: 'var(--color-success-container)', text: 'var(--color-success-text)', bar: 'var(--color-success-text)' }
      : securityScore >= 40
        ? { label: '一般', desc: '建议开启两步验证并定期更换密码', bg: 'var(--color-warning-container)', text: 'var(--color-warning-text)', bar: 'var(--color-warning-text)' }
        : { label: '需加强', desc: '请尽快开启两步验证以提高账户安全性', bg: 'var(--color-error-container)', text: 'var(--color-error-text)', bar: 'var(--color-error-text)' }

  

  const [exportOptions, setExportOptions] = useState({
    profile: true, formulas: true, experiments: false, preferences: false,
    format: 'json' as 'json' | 'csv' | 'excel',
  })
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const clearConfirmRef = useRef<HTMLDivElement>(null)
  useFocusTrap(clearConfirmRef, showClearConfirm, () => setShowClearConfirm(false))

  // 语言：以全局 i18n 实例的实际语言为准（i18n.ts 已从 localStorage 恢复上次选择），
  // 确保与 /settings 语言模块、AI 语言切换器保持同步
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => i18n.language || 'zh-CN')
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Shanghai')
  const [loadingLocale, setLoadingLocale] = useState(false)

  const [notifPrefs, setNotifPrefs] = useState<{
    formula_review: boolean; experiment_complete: boolean; ai_task_done: boolean;
    system_updates: boolean; email_notifications: boolean; browser_push: boolean;
    notification_frequency: 'realtime' | 'daily' | 'weekly';
    notification_priority: 'high' | 'medium' | 'low';
  }>(() => {
    const saved = localStorage.getItem('notif-prefs')
    return saved ? JSON.parse(saved) : {
      formula_review: true, experiment_complete: true,
      ai_task_done: false, system_updates: false,
      email_notifications: false, browser_push: true,
      notification_frequency: 'realtime' as 'realtime' | 'daily' | 'weekly',
      notification_priority: 'high' as 'high' | 'medium' | 'low',
    }
  })

  // 从后端加载已保存的通知偏好（优先于 localStorage）
   
  useEffect(() => {
    if (preferencesData?.notifications && typeof preferencesData.notifications === 'object') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 从后端合并通知偏好，属数据同步意图
      setNotifPrefs(prev => {
        const merged = { ...prev, ...preferencesData.notifications }
        localStorage.setItem('notif-prefs', JSON.stringify(merged))
        return merged
      })
    }
  }, [preferencesData])

  // 从后端已保存的偏好恢复语言/时区（跨设备同步），并真实应用到全局 i18n
   
  useEffect(() => {
    if (preferencesData?.language) {
      const lang = String(preferencesData.language)
      if (SUPPORTED_LOCALE_OPTIONS.some(l => l.code === lang)) {
        // 仅在本地没有语言记忆（新设备/首次访问）时应用后端偏好，
        // 避免用户已有本地语言选择时打开设置页被强制切回后端旧偏好（如英文）
        const localLang = localStorage.getItem('rmfood-language')
        if (!localLang) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- 从后端恢复语言偏好，属数据同步意图
          setSelectedLanguage(lang)
          if (i18n.language !== lang) {
            i18n.changeLanguage(lang)
          }
        }
      }
    }
    if (preferencesData?.timezone) {
      setSelectedTimezone(String(preferencesData.timezone))
    }
  }, [preferencesData])

  // 监听全局 i18n 语言变化（例如 AI 语言切换器），保持设置页选中态同步
  useEffect(() => {
    const onLngChanged = (lng: string) => setSelectedLanguage(lng)
    i18n.on('languageChanged', onLngChanged)
    return () => {
      i18n.off('languageChanged', onLngChanged)
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────
  const saveNotifPrefs = (prefs: typeof notifPrefs) => {
    setNotifPrefs(prefs)
    localStorage.setItem('notif-prefs', JSON.stringify(prefs))
    // 落库到后端用户偏好（跨设备同步）
    updatePrefsMutation.mutate({ notifications: prefs })
    addToast({ type: 'success', message: '通知偏好已保存（已同步到云端）' })
  }
  const toggleNotifPref = (key: keyof typeof notifPrefs) =>
    saveNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })

  // P1-5: 强度判定与提交校验使用同一套规则，视觉条与提交结果严格一致。
  // 规则（共 6 项）：长度≥8、长度≥12、大写、小写、数字、特殊字符
  //   ≥5 项 = 强；4 项 = 中；≤3 项 = 弱（弱则拒绝提交）
  const computeStrength = (pwd: string) => {
    if (!pwd) return 'weak' as const
    let s = 0
    if (pwd.length >= 8) s++
    if (pwd.length >= 12) s++
    if (/[A-Z]/.test(pwd)) s++
    if (/[a-z]/.test(pwd)) s++
    if (/[0-9]/.test(pwd)) s++
    if (/[^A-Za-z0-9]/.test(pwd)) s++
    return s >= 5 ? 'strong' as const : s === 4 ? 'medium' as const : 'weak' as const
  }

  const handlePasswordChange = async () => {
    if (pw.new_password.length < 8) { setPwMsg({ type: 'error', msg: '新密码至少 8 位' }); return }
    const strength = computeStrength(pw.new_password)
    if (strength === 'weak') { setPwMsg({ type: 'error', msg: '密码强度不足：建议至少 8 位并包含大小写字母、数字与特殊字符' }); return }
    if (pw.new_password !== pw.confirm) { setPwMsg({ type: 'error', msg: '两次输入的新密码不一致' }); return }
    setPwSaving(true); setPwMsg(null)
    try {
      await authApi.changePassword(pw.old_password, pw.new_password)
      setPwMsg({ type: 'success', msg: '密码修改成功' })
      setPw({ old_password: '', new_password: '', confirm: '' })
      addToast({ type: 'success', message: '密码修改成功' })
    } catch { setPwMsg({ type: 'error', msg: '旧密码错误或修改失败' }) }
    finally { setPwSaving(false) }
  }

  const passwordStrength = pw.new_password ? computeStrength(pw.new_password) : 'weak'

  const handleToggle2FA = async () => {
    if (!twoFactorEnabled) {
      // 打开弹窗前先调用真实启用端点，拿到 secret + 备用码再展示；
      // 注意：后端 enable 端点只生成密钥，不立即启用（two_factor_enabled=False），
      // 必须在弹窗内输入验证码并 verify 成功后才会真正启用，避免未绑定就锁死账户。
      setLoadingSecurity(true)
      setTwoFaSecret(null); setTwoFaBackupCodes([]); setTwoFaCode(''); setTwoFaVerifyMsg(null)
      try {
        const data: any = await enable2FAMutation.mutateAsync()
        setTwoFaSecret(data?.secret || null)
        setTwoFaBackupCodes(data?.backup_codes || [])
        // 不设置 twoFactorEnabled=true —— 等 verify 成功后才启用
        setShow2FAModal(true)
      }
      catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '启用失败' }) }
      finally { setLoadingSecurity(false) }
    }
    else {
      setLoadingSecurity(true)
      try { await disable2FAMutation.mutateAsync(); setTwoFactorEnabled(false); setTwoFaSecret(null); setTwoFaBackupCodes([]); addToast({ type: 'success', message: '两步验证已禁用' }) }
      catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '操作失败' }) }
      finally { setLoadingSecurity(false) }
    }
  }
  // 确认启用（输入 6 位验证码调用后端 /2fa/verify 验证，验证通过后端才真正启用）
  const handleEnable2FA = async () => {
    if (twoFaCode.trim().length !== 6) {
      setTwoFaVerifyMsg({ type: 'error', msg: '请输入 6 位验证码' })
      return
    }
    setLoadingSecurity(true)
    setTwoFaVerifyMsg(null)
    try {
      await verify2FAMutation.mutateAsync(twoFaCode.trim())
      setTwoFactorEnabled(true)
      setTwoFaVerifyMsg({ type: 'success', msg: '验证码正确，两步验证已启用' })
      setShow2FAModal(false)
      setTwoFaCode('')
      addToast({ type: 'success', message: '两步验证已启用，请妥善保存备用验证码' })
    } catch (e: any) {
      setTwoFaVerifyMsg({ type: 'error', msg: e?.response?.data?.detail || '验证码错误，请重试' })
    } finally {
      setLoadingSecurity(false)
    }
  }
  const handleRemoveDevice = async (id: number) => {
    setLoadingSecurity(true)
    try { await removeDeviceMutation.mutateAsync(id); addToast({ type: 'success', message: '设备已移除' }) }
    catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '移除失败' }) }
    finally { setLoadingSecurity(false) }
  }

  const handleExportData = async () => {
    setLoadingData(true)
    try {
      // 收集勾选的数据范围（排除 format 键）并传给后端
      const scope = Object.entries(exportOptions)
        .filter(([k, v]) => k !== 'format' && v)
        .map(([k]) => k)
        .join(',')
      const blob = await exportDataMutation.mutateAsync({ format: exportOptions.format, scope })
      const url = URL.createObjectURL(blob)
      const ext = exportOptions.format === 'json' ? 'zip' : exportOptions.format === 'csv' ? 'csv' : 'xlsx'
      const a = document.createElement('a'); a.href = url; a.download = `rmfood_export_${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      addToast({ type: 'success', message: '数据导出成功' })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '导出失败' }) }
    finally { setLoadingData(false) }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) processImportFile(f[0]) }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) processImportFile(e.target.files[0]) }
  const processImportFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (ext !== '.json') { addToast({ type: 'error', message: '仅支持 JSON 备份文件（由数据导出生成）' }); return }
    if (file.size > 10 * 1024 * 1024) { addToast({ type: 'error', message: '文件过大，最大支持 10MB' }); return }
    setImportFile(file); addToast({ type: 'info', message: `已选择: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` })
  }
  const handleImportData = async () => {
    if (!importFile) { addToast({ type: 'error', message: '请先选择要导入的文件' }); return }
    setLoadingData(true)
    try { await importDataMutation.mutateAsync(importFile); setImportFile(null); addToast({ type: 'success', message: '数据导入成功！页面将刷新以应用更改...' }); setTimeout(() => window.location.reload(), 1500) }
    catch { addToast({ type: 'error', message: '导入过程出错，请重试' }) }
    finally { setLoadingData(false) }
  }
  const handleClearAllData = async () => {
    setLoadingData(true)
    try { await clearDataMutation.mutateAsync('CLEAR ALL'); setShowClearConfirm(false); addToast({ type: 'success', message: '所有数据已清除' }) }
    catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '操作失败' }) }
    finally { setLoadingData(false) }
  }
  const handleLanguageChange = async (lang: string) => {
    setLoadingLocale(true)
    try {
      setSelectedLanguage(lang)
      // 真实切换全局 i18n 语言：所有使用 t() 的界面立即生效，
      // 持久化（localStorage + <html lang>）由 i18n languageChanged 监听完成
      await i18n.changeLanguage(lang)
      // 同步后端用户偏好（跨设备）
      await updatePrefsMutation.mutateAsync({ language: lang, timezone: selectedTimezone })
      addToast({ type: 'success', message: '语言已切换' })
    } catch {
      addToast({ type: 'error', message: '切换失败' })
    } finally {
      setLoadingLocale(false)
    }
  }
  const handleTimezoneChange = async (tz: string) => {
    setLoadingLocale(true)
    try { setSelectedTimezone(tz); await updatePrefsMutation.mutateAsync({ language: selectedLanguage, timezone: tz }); addToast({ type: 'success', message: '时区已更新' }) }
    catch { addToast({ type: 'error', message: '更新失败' }) }
    finally { setLoadingLocale(false) }
  }

  // ── Panel renderers ───────────────────────────────────────────

  const renderAccountPanel = () => (
    <div className="space-y-[var(--space-apple-lg)]">
      {/* 账户信息 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.accountInfo')}</CardTitle>
              <CardDescription>{t('pages.settings.accountInfoDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{t('pages.settings.username')}</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                @{user?.username}
                <span className="ml-1 text-xs font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.settings.usernameImmutable')}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{t('pages.settings.role')}</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {user?.role ? <Badge variant="info" size="sm">{ROLE_LABELS[String(user.role)] || String(user.role)}</Badge> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{t('pages.settings.registeredAt')}</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {user?.createdAt ? fmtDate(user.createdAt) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{t('pages.settings.lastLogin')}</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {user?.lastLoginAt ? fmtDate(user.lastLoginAt) : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* 个人资料 */}
      <PersonalInfoSection />

      {/* 密码修改 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.changePassword')}</CardTitle>
              <CardDescription>{t('pages.settings.changePasswordDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-md)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">{t('pages.settings.currentPassword')}</label>
              <Input type="password" value={pw.old_password}
                onChange={e => setPw(p => ({ ...p, old_password: e.target.value }))}
                placeholder={t('pages.settings.currentPasswordPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-primary)]">{t('pages.settings.newPassword')}</label>
              <Input type="password" value={pw.new_password}
                onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))}
                placeholder={t('pages.settings.newPasswordPlaceholder')} />
              {pw.new_password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.settings.passwordStrength')}</span>
                    <span className={cn('text-xs font-medium',
                      passwordStrength === 'weak' ? 'text-[var(--color-error-text)]' :
                      passwordStrength === 'medium' ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-success-text)]')}>
                      {passwordStrength === 'weak' ? t('pages.settings.strengthWeak') : passwordStrength === 'medium' ? t('pages.settings.strengthMedium') : t('pages.settings.strengthStrong')}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
                    <div className={cn('h-full rounded-[var(--radius-pill)] transition-all duration-300',
                      passwordStrength === 'weak' ? 'bg-[var(--color-error-text)] w-1/3' :
                      passwordStrength === 'medium' ? 'bg-[var(--color-warning-container)] w-2/3' : 'bg-[var(--color-success-container)] w-full')} />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">{t('pages.settings.confirmNewPassword')}</label>
              <Input type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                placeholder={t('pages.settings.confirmNewPasswordPlaceholder')} />
            </div>
          </div>
          {pwMsg && (
            <div className={cn('flex items-center gap-2 text-sm px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)]',
              pwMsg.type === 'success'
                ? 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/10 dark:text-[var(--color-success-text)]'
                : 'bg-[var(--color-error-container)] text-[var(--color-error-text)] dark:bg-[var(--color-error-container)]/10 dark:text-[var(--color-error-text)]')}>
              {pwMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />}
              {pwMsg.msg}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between pt-0">
          {/* 忘记密码入口 — 旧实现完全缺失，用户只能走 /forgot-password 页面 */}
          <Link to="/forgot-password" className="inline-flex items-center min-h-[44px] text-xs text-[var(--text-muted)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors">
            {t('pages.settings.forgotPassword')}
          </Link>
          <Button variant="amber" loading={pwSaving} disabled={!pw.old_password || !pw.new_password}
            icon={<KeyRound className="w-4 h-4" aria-hidden="true" />} onClick={handlePasswordChange}>
            {t('pages.settings.updatePassword')}
          </Button>
        </CardFooter>
      </Card>

      {/* 账户注销（GDPR/个保法数据可携权）— 旧实现完全缺失 */}
      <AccountDeactivationSection />
    </div>
  )

  const renderSecurityPanel = () => (
    <div className="space-y-[var(--space-apple-lg)]">
      {/* 安全评分卡 */}
      <Card>
        <CardContent className="p-[var(--space-apple-md)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
            <div className="flex items-center gap-[var(--space-apple-sm)] min-w-0">
              <div className="w-10 h-10 rounded-[var(--radius-pill)] flex items-center justify-center shrink-0"
                style={{ background: securityGrade.bg, color: securityGrade.text }}>
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('pages.settings.securityScore')}：{securityScore}<span className="text-[var(--text-muted)] font-normal">/100</span> · {securityGrade.label}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{securityGrade.desc}</p>
              </div>
            </div>
            <div className="w-full sm:w-44 h-2 bg-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden shrink-0">
              <div className="h-full rounded-[var(--radius-pill)] transition-all duration-500" style={{ width: `${securityScore}%`, background: securityGrade.bar }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 两步验证 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" aria-hidden="true" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.twoFactorAuth')}</CardTitle>
                <CardDescription>{twoFactorEnabled ? t('pages.settings.twoFactorEnabledDesc') : t('pages.settings.twoFactorDisabledDesc')}</CardDescription>
              </div>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={handleToggle2FA}
              disabled={loadingSecurity} />
          </div>
        </CardHeader>
        {twoFactorEnabled && (
          <CardContent>
            <div className="flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 rounded-[var(--radius-Apple-md)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]/20">
              <ShieldCheck className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-text)] leading-relaxed">
                {t('pages.settings.twoFactorActiveHint')}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 登录历史 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]/50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.loginHistory')}</CardTitle>
                <CardDescription>{t('pages.settings.loginHistoryDesc')}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
              onClick={() => addToast({ type: 'info', message: '列表已刷新' })}>{t('pages.settings.refresh')}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-[var(--space-apple-lg)] text-center">{t('pages.settings.noLoginHistory')}</p>
          ) : (
          <div className="space-y-2" role="list">
            {loginHistory.map((s: any, idx: number) => {
              // 后端 /users/me/settings/login-history 真实字段:
              // { id, ip_address, created_at, user_agent, details: { device_type }, is_current }
              // is_current 由后端按 UA 匹配计算（当前会话仅标记一行）
              const d: any = s.details || {}
              const isCurrent = !!s.is_current
              return (
              <div key={s.id ?? idx} role="listitem"
                className={cn('flex items-center justify-between p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border transition-colors',
                  isCurrent
                    ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 bg-[var(--color-primary-container)]/50 dark:bg-[var(--color-primary-container)]/15'
                    : 'border-[var(--border-color)]/60 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/40')}>
                <div className="flex items-center gap-[var(--space-apple-sm)] min-w-0">
                  <div className={cn('w-10 h-10 rounded-[var(--radius-pill)] flex items-center justify-center shrink-0',
                    isCurrent ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/40' : 'bg-[var(--bg-tertiary)]/60')}>
                    <Smartphone className={cn('w-5 h-5', isCurrent ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]')} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {s.user_agent || d.user_agent || d.device_type || '未知设备'}
                      </span>
                      {isCurrent && <Badge variant="success" size="sm">最近</Badge>}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {s.ip_address || 'IP 未记录'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {s.created_at ? new Date(s.created_at).toLocaleString('zh-CN') : '时间未知'}
                    </p>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* 设备管理 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/10 flex items-center justify-center shrink-0">
              <SmartphoneIcon className="w-5 h-5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.deviceManagement')}</CardTitle>
              <CardDescription>已在用的登录设备</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-[var(--space-apple-lg)] text-center">暂无已注册设备</p>
          ) : (
          <div className="space-y-2" role="list">
            {devices.map((d: any) => (
              <div key={String(d.id)} role="listitem"
                className={cn('flex items-center justify-between p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border transition-colors',
                  d.is_current
                    ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 bg-[var(--color-primary-container)]/50 dark:bg-[var(--color-primary-container)]/15'
                    : 'border-[var(--border-color)]/60 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/40')}>
                <div className="flex items-center gap-[var(--space-apple-sm)] min-w-0">
                  <div className={cn('w-10 h-10 rounded-[var(--radius-pill)] flex items-center justify-center shrink-0',
                    d.is_current ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/40' : 'bg-[var(--bg-tertiary)]/60')}>
                    <Smartphone className={cn('w-5 h-5', d.is_current ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]')} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {d.device_name || d.name || '未知设备'}
                      </span>
                      {d.is_current && <Badge variant="success" size="sm">本机</Badge>}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {(d.device_type || d.type || '未知类型')}
                      {d.last_active || d.lastActive
                        ? ` · 上次活跃：${new Date(d.last_active || d.lastActive).toLocaleString('zh-CN')}`
                        : ''}
                    </p>
                  </div>
                </div>
                {d.is_active !== false && !d.is_current && (
                  <Button variant="ghost" size="sm" className="text-[var(--text-muted)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/30 min-h-[44px] text-xs"
                    disabled={loadingSecurity} onClick={() => handleRemoveDevice(Number(d.id))}>
                    <Trash className="w-3.5 h-3.5 mr-1" aria-hidden="true" />移除
                  </Button>
                )}
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderApiPanel = () => <ApiKeyPanel />

  const renderDataPanel = () => (
    <div className="space-y-[var(--space-apple-lg)]">
      {/* 数据导出 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]/50 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导出</CardTitle>
              <CardDescription>将您的账户数据打包下载</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="p-5 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)]/60">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-md)]">选择导出数据范围</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
              {([
                { key: 'profile' as const, label: '个人资料', desc: '账号与个人信息' },
                { key: 'formulas' as const, label: '配方数据', desc: '所有配方及相关数据' },
                { key: 'experiments' as const, label: '实验数据', desc: '实验记录与结果' },
                { key: 'preferences' as const, label: '偏好设置', desc: '界面与通知配置' },
              ]).map(item => (
                <label key={item.key}
                  className={cn('flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border cursor-pointer transition-all',
                    exportOptions[item.key]
                      ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)] bg-[var(--color-primary-container)]/60 dark:bg-[var(--color-primary-container)]/20'
                      : 'border-[var(--border-color)]/60 hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)]')}>
                  <input type="checkbox" checked={exportOptions[item.key]}
                    onChange={e => setExportOptions(p => ({ ...p, [item.key]: e.target.checked }))}
                    className="rounded-[var(--radius-Apple-sm)] border-[var(--border-color)] dark:border-[var(--border-color)] text-[var(--color-primary-text)] focus:outline-none focus-visible:ring-0 w-4 h-4" />
                  <div>
                    <p className={cn('text-sm font-medium', exportOptions[item.key] ? 'text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]')}>{item.label}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)]">导出格式</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]" role="radiogroup" aria-label="导出格式">
              {(['json', 'csv', 'excel'] as const).map(format => (
                <button key={format} onClick={() => setExportOptions(p => ({ ...p, format }))}
                  role="radio" aria-checked={exportOptions.format === format}
                  className={cn('p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border text-center transition-all',
                    exportOptions.format === format
                      ? 'border-[var(--color-primary)] dark:border-[var(--color-primary)] bg-[var(--color-primary-container)] shadow-sm'
                      : 'border-[var(--border-color)]/60 hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)]')}>
                  <p className={cn('text-sm font-medium', exportOptions.format === format ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]')}>
                    {format === 'json' ? 'JSON' : format === 'csv' ? 'CSV' : 'Excel'}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                    {format === 'json' ? '结构化数据' : format === 'csv' ? '表格格式' : '电子表格'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Download className="w-4 h-4" aria-hidden="true" />} loading={loadingData}
            disabled={loadingData || (!exportOptions.profile && !exportOptions.formulas && !exportOptions.experiments && !exportOptions.preferences)}
            onClick={handleExportData}>
            {loadingData ? '导出中...' : '导出数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据导入 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导入</CardTitle>
              <CardDescription>从备份文件或他处导入数据</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-md)]">
          <div
            className={cn('relative p-8 border-2 border-dashed rounded-[var(--radius-Apple-md)] text-center transition-all cursor-pointer',
              isDragging ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]' : 'border-[var(--border-color)] hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)]')}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('import-file-input')?.click()}>
            <input id="import-file-input" type="file" accept=".json"
              onChange={handleFileSelect} className="hidden" aria-hidden="true" />
            {importFile ? (
              <div>
                <div className="w-12 h-12 rounded-[var(--radius-pill)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 flex items-center justify-center mx-auto mb-[var(--space-apple-md)]">
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{importFile.name}</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                <Button variant="ghost" size="sm" className="mt-[var(--space-apple-md)] text-xs"
                  onClick={e => { e.stopPropagation(); setImportFile(null) }}>更换文件</Button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mx-auto mb-[var(--space-apple-md)]" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">拖放文件到此处</p>
                <p className="text-xs text-[var(--text-muted)]">或点击选择文件</p>
                <p className="text-xs text-[var(--text-muted)] mt-[var(--space-apple-sm)]">支持 JSON 备份文件（由数据导出生成），最大 10MB</p>
              </div>
            )}
          </div>
          <div className="flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 rounded-[var(--radius-Apple-md)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/20">
            <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] leading-relaxed">
              导入操作将覆盖现有数据，建议先导出当前数据作为备份。
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Upload className="w-4 h-4" aria-hidden="true" />} loading={loadingData}
            disabled={loadingData || !importFile} onClick={handleImportData}>
            {loadingData ? '导入中...' : '导入数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据清除 */}
      <Card className="border-[var(--color-error-border)] dark:border-[var(--color-error-border)]/40">
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">危险操作区</CardTitle>
              <CardDescription className="text-[var(--color-error-text)]/70 dark:text-[var(--color-error-text)]/70">以下操作不可撤销，请谨慎执行</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-5 rounded-[var(--radius-Apple-md)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/10 border border-[var(--color-error-border)] dark:border-[var(--color-error-border)]/20">
            <div className="flex items-start gap-[var(--space-apple-sm)]">
              <ShieldAlert className="w-5 h-5 text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mb-1">清除所有账户数据</p>
                <p className="text-xs text-[var(--color-error-text)]/80 dark:text-[var(--color-error-text)]/80 leading-relaxed">
                  永久删除您的全部配方、实验记录、个人资料及界面配置，此操作无法恢复。
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" className="mt-5" icon={<Trash className="w-4 h-4" aria-hidden="true" />}
              disabled={loadingData} onClick={() => setShowClearConfirm(true)}>
              清除所有数据
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderLocalePanel = () => (
    <div className="space-y-[var(--space-apple-lg)]">
      {/* 语言 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-info-50 dark:bg-info-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-info-600 dark:text-info-700" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.settings.language')}</CardTitle>
              <CardDescription>{t('pages.settings.languageDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SUPPORTED_LOCALE_OPTIONS.map(lang => (
              <button key={lang.code} onClick={() => handleLanguageChange(lang.code)} disabled={loadingLocale}
                aria-checked={selectedLanguage === lang.code} role="radio"
                className={cn('flex items-center gap-[var(--space-apple-sm)] p-5 rounded-[var(--radius-Apple-md)] border text-left transition-all',
                  selectedLanguage === lang.code
                    ? 'border-[var(--color-primary)] dark:border-[var(--color-primary)] bg-[var(--color-primary-container)] shadow-sm'
                    : 'border-[var(--border-color)]/60 hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)]')}>
                <span className="text-2xl" aria-hidden="true">{lang.flag}</span>
                <span className={cn('text-sm font-medium', selectedLanguage === lang.code ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]')}>
                  {lang.name}
                </span>
                {selectedLanguage === lang.code && <CheckCircle2 className="w-5 h-5 text-[var(--color-primary-text)] ml-auto shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="mt-[var(--space-apple-md)] text-xs text-[var(--text-muted)]">
            {t('pages.settings.currentLanguage', { language: SUPPORTED_LOCALE_OPTIONS.find(l => l.code === selectedLanguage)?.name || selectedLanguage })}
          </p>
        </CardContent>
      </Card>

      {/* 时区 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">时区设置</CardTitle>
              <CardDescription>设置时间显示所使用的时区</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-md)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 w-full">
              <Select value={selectedTimezone} onValueChange={handleTimezoneChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择时区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Shanghai">中国标准时间 (UTC+8)</SelectItem>
                  <SelectItem value="Asia/Tokyo">日本标准时间 (UTC+9)</SelectItem>
                  <SelectItem value="America/New_York">美国东部时间 (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London">格林威治标准时间 (UTC+0)</SelectItem>
                  <SelectItem value="Europe/Berlin">欧洲中部时间 (UTC+1)</SelectItem>
                  <SelectItem value="Australia/Sydney">澳大利亚东部时间 (UTC+10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-5 py-[var(--space-apple-md)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 shrink-0">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">当前时间</p>
              <p className="text-base font-mono font-medium text-[var(--text-primary)]">
                {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日期时间格式 */}
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[var(--text-secondary)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">日期时间格式</CardTitle>
              <CardDescription>自定义日期与时间的显示方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-lg)]">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)]">日期格式</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
              {([
                { format: 'YYYY-MM-DD', example: '2024-12-31' },
                { format: 'DD/MM/YYYY', example: '31/12/2024' },
                { format: 'MM/DD/YYYY', example: '12/31/2024' },
              ] as const).map(item => (
                <div key={item.format} className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 text-center hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)] cursor-pointer transition-colors">
                  <p className="text-sm font-mono font-medium text-[var(--text-primary)]">{item.format}</p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1.5">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)]">时间格式</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
              {([
                { format: '24h' as const, example: '13:45', label: '24小时制' },
                { format: '12h' as const, example: '1:45 PM', label: '12小时制' },
              ]).map(item => (
                <div key={item.format} className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 text-center hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)] cursor-pointer transition-colors">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1.5 font-mono">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderThemePanel = () => (
    <ThemePanel />
  )

  const renderNotificationsPanel = () => (
    <div className="space-y-[var(--space-apple-lg)]">
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">通知偏好</CardTitle>
              <CardDescription>管理消息推送渠道与触发规则</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-lg)]">
          {/* 触发事件 */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">触发事件</p>
            <div className="space-y-[var(--space-apple-sm)]">
              {([
                { key: 'formula_review' as const, label: '配方审核', desc: '配方提交审核、审核通过或驳回时' },
                { key: 'experiment_complete' as const, label: '实验完成', desc: '关联实验完成或失败时' },
                { key: 'ai_task_done' as const, label: 'AI 任务完成', desc: '配方生成、分析任务结束时' },
                { key: 'system_updates' as const, label: '系统更新', desc: '维护公告、版本发布等' },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <Bell className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)]/60 pt-6">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">推送渠道</p>
            <div className="space-y-[var(--space-apple-sm)]">
              {([
                { key: 'browser_push' as const, label: '浏览器推送', desc: '在浏览器中接收实时通知', icon: BellRing },
                { key: 'email_notifications' as const, label: '邮件通知', desc: '将重要消息发送到邮箱', icon: Mail },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    <item.icon className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)]/60 pt-6">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">频率与优先级</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">发送频率</p>
                <Select value={notifPrefs.notification_frequency} onValueChange={(v: any) => saveNotifPrefs({ ...notifPrefs, notification_frequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">实时推送</SelectItem>
                    <SelectItem value="daily">每日摘要</SelectItem>
                    <SelectItem value="weekly">每周摘要</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">消息优先级</p>
                <Select value={notifPrefs.notification_priority} onValueChange={(v: any) => saveNotifPrefs({ ...notifPrefs, notification_priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">高 — 全部显示</SelectItem>
                    <SelectItem value="medium">中 — 仅重要消息</SelectItem>
                    <SelectItem value="low">低 — 仅紧急消息</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ── Dialogs ───────────────────────────────────────────────────
  // 2FA 真实二维码：用项目已装的 qrcode 库把 otpauth:// URI 渲染成 canvas，
  // 旧实现只有静态 QrCode 占位图标 + 硬编码 "ABCD-..." 备用码，与后端完全脱节
  useEffect(() => {
    if (!show2FAModal || !twoFaSecret) return
    let cancelled = false
    const renderQr = async () => {
      try {
        const QRCode = await import('qrcode')
        if (cancelled) return
        // 与服务端 TOTP 密钥对齐：issuer 用平台名，accountName 用当前用户名
        const uri = `otpauth://totp/RMFOOD:${user?.username || 'user'}?secret=${twoFaSecret}&issuer=RMFOOD&algorithm=SHA1&digits=6&period=30`
        await QRCode.toCanvas(document.getElementById('two-factor-qrcode') as HTMLCanvasElement, uri, {
          width: 192, margin: 1, color: { dark: '#000000', light: '#ffffff' },
        })
      } catch {
        /* 渲染失败时用户仍可用下方手动密钥输入 */
      }
    }
    renderQr()
    return () => { cancelled = true }
  }, [show2FAModal, twoFaSecret, user?.username])

  const render2FADialog = () => (
    <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
      <DialogContent ref={modal2FARef} size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[var(--radius-pill)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-[var(--color-success-text)]" aria-hidden="true" />
            </div>
            启用两步验证
          </DialogTitle>
          <DialogDescription>完成以下两步绑定后，两步验证才正式启用</DialogDescription>
        </DialogHeader>

        <div className="space-y-[var(--space-apple-md)]">
          {/* 步骤 1：添加验证器 */}
          <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)]">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold shrink-0">1</span>
              在验证器应用中添加账户
            </p>
            {twoFaSecret ? (
              <div className="flex flex-col items-center gap-[var(--space-apple-sm)]">
                <canvas id="two-factor-qrcode" className="rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] p-2 border border-[var(--border-color)]" />
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)] mb-1">无法扫码？手动输入密钥</p>
                  <code className="text-xs font-mono bg-[var(--bg-tertiary)] px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] select-all">
                    {twoFaSecret}
                  </code>
                </div>
              </div>
            ) : (
              <div className="flex justify-center p-[var(--space-apple-lg)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)] border-2 border-dashed border-[var(--border-color)]">
                <div className="text-center">
                  <QrCode className="w-14 h-14 mx-auto text-[var(--text-muted)] mb-[var(--space-apple-sm)]" aria-hidden="true" />
                  <p className="text-xs text-[var(--text-muted)]">正在获取密钥…</p>
                </div>
              </div>
            )}
          </div>

          {/* 步骤 2：输入验证码 */}
          <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)]">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold shrink-0">2</span>
              输入 6 位动态验证码完成绑定
            </p>
            <input
              id="twofa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={twoFaCode}
              onChange={(e) => { setTwoFaCode(e.target.value.replace(/\D/g, '')); setTwoFaVerifyMsg(null) }}
              placeholder="123456"
              className="w-full h-11 px-[var(--space-apple-md)] text-base tracking-[0.3em] text-center font-mono rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-0"
              aria-label="两步验证码"
            />
            {twoFaVerifyMsg && (
              <p className={`mt-2 text-xs ${twoFaVerifyMsg.type === 'success' ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'}`}>
                {twoFaVerifyMsg.msg}
              </p>
            )}
          </div>

          {/* 备用验证码 */}
          {twoFaBackupCodes.length > 0 && (
            <div className="rounded-[var(--radius-Apple-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-container)]/30 dark:bg-[var(--color-warning-container)]/10 p-[var(--space-apple-md)]">
              <p className="text-xs font-medium text-[var(--color-warning-text)] mb-2">
                备用验证码（{twoFaBackupCodes.length} 个，每个只能用一次，请立即保存）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {twoFaBackupCodes.map((code, i) => (
                  <code key={i} className="text-xs font-mono px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] select-all text-[var(--text-primary)]">
                    {code.toUpperCase()}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setShow2FAModal(false)} disabled={loadingSecurity}>稍后再说</Button>
          <Button variant="primary" onClick={handleEnable2FA} disabled={loadingSecurity || twoFaCode.length !== 6}
            icon={loadingSecurity ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}>
            {loadingSecurity ? '验证中…' : '确认绑定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderClearConfirmDialog = () => (
    <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
      <DialogContent ref={clearConfirmRef} size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
            <ShieldAlert className="w-4 h-4" aria-hidden="true" />确认清除所有数据？
          </DialogTitle>
          <DialogDescription>此操作不可撤销，请仔细阅读以下说明</DialogDescription>
        </DialogHeader>
        <div className="space-y-[var(--space-apple-md)]">
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] list-disc list-inside">
            <li>所有配方数据和实验记录</li>
            <li>个人资料和账户设置</li>
            <li>界面偏好与通知配置</li>
            <li>API 密钥与访问令牌</li>
          </ul>
          <div className="p-[var(--space-apple-md)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/10 rounded-[var(--radius-Apple-md)] border border-[var(--color-error-border)] dark:border-[var(--color-error-border)]/20">
            <p className="text-xs text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mb-2">
              请输入 <strong className="font-mono">DELETE ALL</strong> 以确认：
            </p>
            <Input value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)}
              placeholder="输入 DELETE ALL 确认" className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowClearConfirm(false)} disabled={loadingData}>取消</Button>
          <Button variant="danger" onClick={handleClearAllData} loading={loadingData}
            disabled={clearConfirmText !== 'DELETE ALL'} icon={<Trash className="w-4 h-4" aria-hidden="true" />}>
            确认清除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── LLM 配置面板 ─────────────────────────────────────────────
  const renderLlmPanel = () => <LlmPanel />

  // ── 面板映射 ─────────────────────────────────────────────────
  const PANELS: Record<TabId, () => React.ReactNode> = {
    account: renderAccountPanel,
    security: renderSecurityPanel,
    api: renderApiPanel,
    data: renderDataPanel,
    locale: renderLocalePanel,
    theme: renderThemePanel,
    notifications: renderNotificationsPanel,
    llm: renderLlmPanel,
    mcp: () => <McpServersPanel />,
  }

  // ── 主布局 ────────────────────────────────────────────────────
  return (
    <div className="space-y-[var(--space-apple-lg)] max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">

      {/* 顶部横幅 — 与 Dashboard 一致 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">{t('pages.settings.title')}</h1>
            <p className="mt-1 text-white/90 text-sm">{t('pages.settings.subtitle')}</p>
          </div>
          <div className="flex items-center gap-[var(--space-apple-sm)] w-full sm:w-auto">
            <Button
              variant="secondary" size="sm"
              icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
              onClick={() => { setTab('data'); addToast({ type: 'info', message: t('pages.settings.dataExportReady') }) }}
            >
              {t('pages.settings.exportData')}
            </Button>
            <Button
              variant="glass" size="sm"
              icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
              onClick={() => setTab('security')}
            >
              {t('pages.settings.securityDiagnosis')}
            </Button>
          </div>
        </div>
      </div>

      {/* 横向 Tab — 与 Dashboard 快捷操作栏一致风格 */}
      <div className="overflow-x-auto pb-1 -mx-4 px-[var(--space-apple-md)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="inline-flex items-center gap-1 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-md)] p-1 min-w-max">
          {TABS.map(({ id, labelKey, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 px-[var(--space-apple-md)] py-2 min-h-[44px] rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : /* A-26：dark:text-[var(--text-muted)] 在 rgb(19,27,45) 底上只有 3.79:1（需 4.5）。
                         提到 neutral-300 后为 11.6:1。 */
                      'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/60 dark:hover:bg-[var(--bg-secondary)]/50',
                )}
                aria-current={active ? 'true' : undefined}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]')} aria-hidden="true" />
                {t(labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="min-h-[400px]">
        {PANELS[tab]?.()}
      </div>

      {render2FADialog()}
      {renderClearConfirmDialog()}
    </div>
  )
}
