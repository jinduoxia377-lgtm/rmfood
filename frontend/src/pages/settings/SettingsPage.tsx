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
import { Link } from 'react-router-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import {
  User, KeyRound, Shield, CheckCircle, AlertCircle,
  Mail, Bell, Clock, Smartphone,
  ChevronRight, ShieldAlert, RefreshCw, Key, Copy, Plus, Download, Upload,
  Globe, MapPin, CheckCircle2, Eye,
  QrCode, Info, ShieldCheck, Sun, Moon, BellRing,
  LogOut, SmartphoneIcon, Trash, Palette, Keyboard,
  Brain,
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
import { useTheme, type ThemeMode } from '@/theme'
import { ThemePanel } from '@/components/theme/ThemePanel'
import { PersonalInfoSection } from './components/PersonalInfoSection'
import { AccountDeactivationSection } from './components/AccountDeactivationSection'
import { ConfigManager } from '@/utils/configManager'
import type { ApiKey } from '@/utils/configManager'
import { unifiedApiKeyManager } from '@/utils/unifiedApiKeyManager'
import ModelClient from '@/api/modelClient'

// ─── Tab 定义 ─────────────────────────────────────────────────────
type TabId = 'account' | 'security' | 'api' | 'data' | 'locale' | 'theme' | 'notifications' | 'llm'

const TABS: { id: TabId; label: string; icon: typeof User; desc: string }[] = [
  { id: 'account',  label: '账户',  icon: User,  desc: '个人资料 · 密码' },
  { id: 'security', label: '安全',  icon: Shield, desc: '两步验证 · 会话' },
  { id: 'api',      label: 'API',   icon: Key,   desc: '密钥管理' },
  { id: 'data',     label: '数据',  icon: Download, desc: '导入导出' },
  { id: 'locale',   label: '语言',  icon: Globe, desc: '时区 · 格式' },
  { id: 'theme',    label: '主题',  icon: Palette, desc: '外观' },
  { id: 'notifications', label: '通知', icon: Bell, desc: '推送偏好' },
  { id: 'llm', label: 'LLM', icon: Brain, desc: '模型配置 · API Key' },
]

// ─── 工具函数 ─────────────────────────────────────────────────────
const maskKey = (key: string, visible = false) =>
  visible || key.length <= 8 ? key : `${key.slice(0, 8)}••••${key.slice(-4)}`

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">AI 模型配置</CardTitle>
              <CardDescription>设置 LLM 服务商、模型与密钥，保存后可用于 AI 对话、配方生成等功能</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">服务商</label>
                <select value={provider} onChange={e => handleProviderChange(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {Object.entries(LLM_PROVIDER_PRESETS).map(([value, preset]) => (
                    <option key={value} value={value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">模型</label>
                <Input value={model} onChange={e => setModel(e.target.value)}
                  placeholder={LLM_PROVIDER_PRESETS[provider]?.defaultModel ?? 'deepseek-chat'} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">API 接口地址（Base URL）</label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
              {providerWarning && (
                <p className="mt-1 text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {providerWarning}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">API 密钥</label>
                {maskedKey && <span className="text-xs font-mono text-neutral-400">当前已存：{maskedKey}</span>}
              </div>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..." error={keyValid ? undefined : (apiKey ? `长度不足（${apiKey.length}/40 字符）` : 'API 密钥不能为空')} />
              {legacyKeyWarning && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning-200 dark:border-warning-500/20 bg-warning-50 dark:bg-warning-500/10 px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-warning-800 dark:text-warning-300 leading-relaxed">
                    <span className="font-medium">检测到历史遗留的未加密密钥</span>
                    <span className="ml-1">（脱敏显示：{maskedKey}）。该密钥此前未经加密入库，请重新粘贴完整密钥后保存，保存后将自动转为加密存储。</span>
                  </div>
                  <button type="button" onClick={() => setApiKey('')}
                    className="ml-auto shrink-0 text-xs font-medium text-warning-700 dark:text-warning-400 hover:underline">
                    清空重新输入
                  </button>
                </div>
              )}
              <p className="text-xs text-neutral-400 mt-1">
                本地以加密方式存储；开启后端同步后仅写入您自己的服务器数据库，不会上传到第三方。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400" htmlFor="llm-temperature">温度参数：{temperature}</label>
                  <span className="text-xs text-neutral-400">0 – 2</span>
                </div>
                <input id="llm-temperature" type="range" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full" style={{ accentColor: 'var(--color-accent)' } as React.CSSProperties}
                  aria-valuemin={0} aria-valuemax={2} aria-valuenow={temperature} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">最大 Token 数</label>
                <Input type="number" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)}
                  min={1} max={32768} step={1} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border border-neutral-200 dark:border-neutral-700">
              <div>
                <p className="text-sm font-medium">同步到后端数据库</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">保存时写入服务器 ai_model_configs 表并即时更新运行时 LLM 服务。该操作仅限管理员；普通用户开关不会造成损失，失败时本地配置仍完整保留</p>
              </div>
              <Switch checked={syncToBackend} onCheckedChange={setSyncToBackend} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md" loading={saving}
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={handleSave}>
              保存配置
            </Button>
            <Button variant="outline" size="md" loading={testing}
              icon={<Key className="w-4 h-4" />}
              onClick={handleTestConnection}>
              测试连接
            </Button>
            {successMsg && (
              <span className="text-xs text-success-600 dark:text-success-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {successMsg}
              </span>
            )}
          </div>
          {errorMsg && <p className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{errorMsg}</p>}
          {testResult && (
            <div className={cn(
              'mt-3 rounded-lg border px-4 py-3 text-xs leading-relaxed',
              testResult.ok
                ? 'bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/20 text-success-800 dark:text-success-300'
                : 'bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/20 text-warning-800 dark:text-warning-300',
            )}>
              <p className="font-medium mb-1 flex items-center gap-1.5">
                {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                密钥验活结果（不写库）
              </p>
              {testResult.detail}
            </div>
          )}
          {statusNote && (
            <div className={cn(
              'mt-2 rounded-lg border px-4 py-3 text-xs leading-relaxed',
              statusNote.ok
                ? 'bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/20 text-success-800 dark:text-success-300'
                : 'bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/20 text-warning-800 dark:text-warning-300',
            )}>
              <p className="font-medium mb-1 flex items-center gap-1.5">
                {statusNote.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center shrink-0">
              <Key className="w-5 h-5 text-success-600 dark:text-success-400" />
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
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              保存后 /ai 对话将使用您自己的密钥驱动 LLM，与服务器全局配置相互独立。
              删除后回退到服务器密钥。密钥以 AES-256-GCM 加密存储，不会明文展示。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">服务商</label>
                <select value={myKeyProvider} onChange={e => setMyKeyProvider(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {Object.entries(LLM_PROVIDER_PRESETS).map(([value, preset]) => (
                    <option key={value} value={value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">模型</label>
                <Input value={myKeyModel} onChange={e => setMyKeyModel(e.target.value)}
                  placeholder={LLM_PROVIDER_PRESETS[myKeyProvider]?.defaultModel ?? 'deepseek-chat'} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">API 密钥</label>
                {myKeyStatus?.configured && <span className="text-xs font-mono text-neutral-400">当前已存：{myKeyStatus.keyMasked}</span>}
              </div>
              <Input type="password" value={myKeyApi} onChange={e => setMyKeyApi(e.target.value)}
                placeholder={myKeyStatus?.configured ? '留空则保留当前密钥' : 'sk-...'}
                error={myKeyApi && myKeyApi.length < 20 ? `长度不足（${myKeyApi.length}/20 字符）` : undefined} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md" loading={myKeyLoading}
                icon={<CheckCircle className="w-4 h-4" />}
                onClick={handleMyKeySave}
                disabled={myKeyStatus?.configured && !myKeyApi}>
                {myKeyStatus?.configured ? '更新密钥' : '保存我的密钥'}
              </Button>
              <Button variant="outline" size="md" loading={myKeyTestTesting}
                icon={<Key className="w-4 h-4" />}
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
                'rounded-lg border px-4 py-3 text-xs leading-relaxed',
                myKeyTestResult.ok
                  ? 'bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/20 text-success-800 dark:text-success-300'
                  : 'bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/20 text-warning-800 dark:text-warning-300',
              )}>
                <p className="font-medium mb-1 flex items-center gap-1.5">
                  {myKeyTestResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-50 dark:bg-secondary-500/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">配置说明</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
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

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  // ── Hooks ─────────────────────────────────────────────────────
  const { data: twoFaStatus } = use2FAStatus()
  const enable2FAMutation = useEnable2FA()
  const disable2FAMutation = useDisable2FA()
  const { data: devicesData } = useDevices()
  const removeDeviceMutation = useRemoveDevice()
  const updatePrefsMutation = useUpdatePreferences()
  const exportDataMutation = useExportData()
  const importDataMutation = useImportData()
  const { data: loginHistoryData } = useLoginHistory()
  const clearDataMutation = useClearUserData()
  const { mode, setThemeMode } = useTheme()

  // ── State ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabId>('account')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!twoFaStatus?.enabled)
  useEffect(() => { if (twoFaStatus) setTwoFactorEnabled(!!twoFaStatus.enabled) }, [twoFaStatus])

  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [show2FAModal, setShow2FAModal] = useState(false)
  // 2FA 启用响应（真实 secret + 备用码），弹窗内渲染真实二维码；
  // 旧实现弹静态 QrCode 占位图 + 硬编码备用码 "ABCD-..."，与后端完全脱节
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null)
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([])
  const [loadingSecurity, setLoadingSecurity] = useState(false)
  const modal2FARef = useRef<HTMLDivElement>(null)
  useFocusTrap(modal2FARef, show2FAModal, () => setShow2FAModal(false))

  // 设备/登录历史 — 直接消费后端 /users/me/settings 真实字段，
  // 旧实现用 useState(假数据) 捕获初始值，API 成功后永不刷新（"当前设备/厦门"假数据）
  const devices = devicesData?.devices ?? []
  const loginHistory = loginHistoryData?.history ?? []

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write'])
  const [expirationDays, setExpirationDays] = useState(30)
  const [revealKeyIds, setRevealKeyIds] = useState<Set<string>>(new Set())
  const createKeyDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(createKeyDialogRef, isCreatingKey, () => setIsCreatingKey(false))
  useEffect(() => { setApiKeys(ConfigManager.getApiKeys()) }, [])

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

  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN')
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Shanghai')
  const [loadingLocale, setLoadingLocale] = useState(false)

  const [notifPrefs, setNotifPrefs] = useState(() => {
    const saved = localStorage.getItem('notif-prefs')
    return saved ? JSON.parse(saved) : {
      formula_review: true, experiment_complete: true,
      ai_task_done: false, system_updates: false,
      email_notifications: false, browser_push: true,
      notification_frequency: 'realtime' as 'realtime' | 'daily' | 'weekly',
      notification_priority: 'high' as 'high' | 'medium' | 'low',
    }
  })

  // ── Handlers ──────────────────────────────────────────────────
  const saveNotifPrefs = (prefs: typeof notifPrefs) => {
    setNotifPrefs(prefs)
    localStorage.setItem('notif-prefs', JSON.stringify(prefs))
    addToast({ type: 'success', message: '通知偏好已保存' })
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
      // 旧实现先弹静态占位图，点"确认启用"才调 API，用户看到的备用码是硬编码假数据
      setLoadingSecurity(true)
      setTwoFaSecret(null); setTwoFaBackupCodes([])
      try {
        const data: any = await enable2FAMutation.mutateAsync()
        setTwoFaSecret(data?.secret || null)
        setTwoFaBackupCodes(data?.backup_codes || [])
        setTwoFactorEnabled(true)
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
  // 确认启用（扫码绑定完成后）：仅关闭弹窗，secret 已由 toggle 时写入
  const handleEnable2FA = async () => {
    setShow2FAModal(false)
    addToast({ type: 'success', message: '两步验证已启用，请妥善保存备用验证码' })
  }
  const handleRemoveDevice = async (id: number) => {
    setLoadingSecurity(true)
    try { await removeDeviceMutation.mutateAsync(id); addToast({ type: 'success', message: '设备已移除' }) }
    catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '移除失败' }) }
    finally { setLoadingSecurity(false) }
  }
  const handleLogoutSession = async (deviceId: number) => {
    setLoadingSecurity(true)
    try {
      // 与"移除设备"同一后端端点（DELETE /users/me/settings/devices/{id}），
      // 后端会把该设备会话标记失效；旧实现用 setTimeout 模拟 600ms，无真实效果
      await removeDeviceMutation.mutateAsync(deviceId)
      addToast({ type: 'success', message: '该设备会话已退出' })
    }
    catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail || '操作失败' }) }
    finally { setLoadingSecurity(false) }
  }

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) { addToast({ type: 'error', message: '请输入密钥名称' }); return }
    try {
      const newKey = ConfigManager.addApiKey({
        name: newKeyName,
        key: `sk_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
        status: 'active', expires_at: new Date(Date.now() + expirationDays * 86400000).toISOString(),
        permissions: newKeyPermissions,
      })
      setApiKeys(prev => [...prev, newKey])
      setNewKeyName(''); setNewKeyPermissions(['read', 'write']); setExpirationDays(30); setIsCreatingKey(false)
      addToast({ type: 'success', message: 'API 密钥创建成功' })
    } catch { addToast({ type: 'error', message: '创建 API 密钥失败' }) }
  }
  const handleDeleteApiKey = (id: string) => {
    try { ConfigManager.deleteApiKey(id); setApiKeys(prev => prev.filter(k => k.id !== id)); addToast({ type: 'success', message: 'API 密钥删除成功' }) }
    catch { addToast({ type: 'error', message: '删除 API 密钥失败' }) }
  }
  const handleCopyApiKey = (key: string) => { navigator.clipboard.writeText(key); addToast({ type: 'success', message: 'API 密钥已复制到剪贴板' }) }
  const toggleRevealKey = (id: string) =>
    setRevealKeyIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleExportData = async () => {
    setLoadingData(true)
    try {
      const blob = await exportDataMutation.mutateAsync()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `rmfood_export_${new Date().toISOString().split('T')[0]}.zip`
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
    if (!['.json', '.csv', '.xls', '.xlsx'].includes(ext)) { addToast({ type: 'error', message: '不支持的文件格式，请选择 JSON、CSV 或 Excel 文件' }); return }
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
    try { setSelectedLanguage(lang); await updatePrefsMutation.mutateAsync({ language: lang, timezone: selectedTimezone }); addToast({ type: 'success', message: '语言已切换' }) }
    catch (e: any) { addToast({ type: 'error', message: '切换失败' }) }
    finally { setLoadingLocale(false) }
  }
  const handleTimezoneChange = async (tz: string) => {
    setLoadingLocale(true)
    try { setSelectedTimezone(tz); await updatePrefsMutation.mutateAsync({ language: selectedLanguage, timezone: tz }); addToast({ type: 'success', message: '时区已更新' }) }
    catch (e: any) { addToast({ type: 'error', message: '更新失败' }) }
    finally { setLoadingLocale(false) }
  }

  // ── Panel renderers ───────────────────────────────────────────

  const renderAccountPanel = () => (
    <div className="space-y-6">
      {/* 个人资料 */}
      <PersonalInfoSection />

      {/* 密码修改 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">修改密码</CardTitle>
              <CardDescription>定期更换密码有助于保护账户安全</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">当前密码</label>
              <Input type="password" value={pw.old_password}
                onChange={e => setPw(p => ({ ...p, old_password: e.target.value }))}
                placeholder="请输入当前密码" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">新密码</label>
              <Input type="password" value={pw.new_password}
                onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))}
                placeholder="至少 8 位，包含大小写字母、数字和特殊字符" />
              {pw.new_password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-neutral-500">密码强度</span>
                    <span className={cn('text-xs font-medium',
                      passwordStrength === 'weak' ? 'text-rose-500' :
                      passwordStrength === 'medium' ? 'text-amber-500' : 'text-emerald-500')}>
                      {passwordStrength === 'weak' ? '弱' : passwordStrength === 'medium' ? '中等' : '强'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300',
                      passwordStrength === 'weak' ? 'bg-rose-500 w-1/3' :
                      passwordStrength === 'medium' ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full')} />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">确认新密码</label>
              <Input type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                placeholder="再次输入新密码" />
            </div>
          </div>
          {pwMsg && (
            <div className={cn('flex items-center gap-2 text-sm px-4 py-3 rounded-lg',
              pwMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400')}>
              {pwMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {pwMsg.msg}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between pt-0">
          {/* 忘记密码入口 — 旧实现完全缺失，用户只能走 /forgot-password 页面 */}
          <Link to="/forgot-password" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            忘记密码？
          </Link>
          <Button variant="amber" loading={pwSaving} disabled={!pw.old_password || !pw.new_password}
            icon={<KeyRound className="w-4 h-4" />} onClick={handlePasswordChange}>
            更新密码
          </Button>
        </CardFooter>
      </Card>

      {/* 账户注销（GDPR/个保法数据可携权）— 旧实现完全缺失 */}
      <AccountDeactivationSection />
    </div>
  )

  const renderSecurityPanel = () => (
    <div className="space-y-6">
      {/* 两步验证 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">两步验证</CardTitle>
                <CardDescription>{twoFactorEnabled ? '已启用 · 登录时需要额外验证' : '尚未启用 · 建议开启以提升账户安全'}</CardDescription>
              </div>
            </div>
            <Switch checked={twoFactorEnabled} onCheckedChange={handleToggle2FA}
              disabled={loadingSecurity} />
          </div>
        </CardHeader>
        {twoFactorEnabled && (
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
                两步验证已生效。每次登录需输入密码及手机验证码，有效防止未经授权的访问。
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 登录历史 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">登录历史</CardTitle>
                <CardDescription>最近的登录会话记录</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => addToast({ type: 'info', message: '列表已刷新' })}>刷新</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center">暂无登录历史（审计日志未记录到登录事件）</p>
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
                className={cn('flex items-center justify-between p-4 rounded-xl border transition-colors',
                  isCurrent
                    ? 'border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isCurrent ? 'bg-primary-100 dark:bg-primary-800/40' : 'bg-neutral-100 dark:bg-neutral-700/60')}>
                    <Smartphone className={cn('w-5 h-5', isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500')} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {s.user_agent || d.user_agent || d.device_type || '未知设备'}
                      </span>
                      {isCurrent && <Badge variant="success" size="sm">最近</Badge>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {s.ip_address || 'IP 未记录'}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
              <SmartphoneIcon className="w-5 h-5 text-violet-600 dark:text-violet-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">设备管理</CardTitle>
              <CardDescription>已在用的登录设备</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center">暂无已注册设备</p>
          ) : (
          <div className="space-y-2" role="list">
            {devices.map((d: any) => (
              <div key={String(d.id)} role="listitem"
                className={cn('flex items-center justify-between p-4 rounded-xl border transition-colors',
                  d.is_current
                    ? 'border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    d.is_current ? 'bg-primary-100 dark:bg-primary-800/40' : 'bg-neutral-100 dark:bg-neutral-700/60')}>
                    <Smartphone className={cn('w-5 h-5', d.is_current ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {d.device_name || d.name || '未知设备'}
                      </span>
                      {d.is_current && <Badge variant="success" size="sm">本机</Badge>}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {(d.device_type || d.type || '未知类型')}
                      {d.last_active || d.lastActive
                        ? ` · 上次活跃：${new Date(d.last_active || d.lastActive).toLocaleString('zh-CN')}`
                        : ''}
                    </p>
                  </div>
                </div>
                {d.is_active !== false && !d.is_current && (
                  <Button variant="ghost" size="sm" className="text-neutral-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8 text-xs"
                    disabled={loadingSecurity} onClick={() => handleRemoveDevice(Number(d.id))}>
                    <Trash className="w-3.5 h-3.5 mr-1" />移除
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

  const renderApiPanel = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
              </div>
              <div>
                <CardTitle as="h2" className="text-base font-semibold tracking-tight">API 密钥</CardTitle>
                <CardDescription>用于程序化访问系统的凭证</CardDescription>
              </div>
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreatingKey(true)}>创建密钥</Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <Key className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">暂无 API 密钥</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">点击右上角按钮创建第一个密钥</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(key => {
                const isRevealed = revealKeyIds.has(key.id)
                return (
                  <div key={key.id} className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/30">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{key.name}</span>
                          <Badge variant={key.status === 'active' ? 'success' : key.status === 'expiring' ? 'warning' : 'danger'} size="sm">
                            {key.status === 'active' ? '活跃' : key.status === 'expiring' ? '即将过期' : '已过期'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>创建于 {fmtDate(key.created_at)}</span>
                          <span>·</span>
                          <span>过期于 {fmtDate(key.expires_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={isRevealed ? '隐藏密钥' : '显示密钥'} onClick={() => toggleRevealKey(key.id)}>
                          <Eye className={cn('w-4 h-4', isRevealed ? 'text-primary-500' : 'text-neutral-400')} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="复制密钥" onClick={() => handleCopyApiKey(key.key)}>
                          <Copy className="w-4 h-4 text-neutral-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="删除密钥" onClick={() => handleDeleteApiKey(key.id)}>
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className={cn('text-sm font-mono px-4 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex-1 truncate',
                        isRevealed ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500')}>
                        {maskKey(key.key, isRevealed)}
                      </code>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <Info className="w-3.5 h-3.5 inline mr-1.5" />
            密钥仅在创建时完整展示一次，请妥善保存。建议使用独立的密钥管理工具。
          </p>
        </CardFooter>
      </Card>

      {/* 创建密钥 Dialog */}
      <Dialog open={isCreatingKey} onOpenChange={setIsCreatingKey}>
        <DialogContent ref={createKeyDialogRef} size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-500" />创建新 API 密钥
            </DialogTitle>
            <DialogDescription>为应用程序生成访问凭证</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">密钥名称</label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="例如：生产环境、测试工具" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">过期天数</label>
              <Input type="number" min={1} max={365} value={expirationDays}
                onChange={e => setExpirationDays(parseInt(e.target.value) || 30)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">权限</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newKeyPermissions.includes('read')}
                    onChange={e => setNewKeyPermissions(p => e.target.checked ? [...p, 'read'] : p.filter(x => x !== 'read'))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">读取</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newKeyPermissions.includes('write')}
                    onChange={e => setNewKeyPermissions(p => e.target.checked ? [...p, 'write'] : p.filter(x => x !== 'write'))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">写入</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreatingKey(false)}>取消</Button>
            <Button variant="primary" onClick={handleCreateApiKey}>创建密钥</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderDataPanel = () => (
    <div className="space-y-6">
      {/* 数据导出 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导出</CardTitle>
              <CardDescription>将您的账户数据打包下载</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="p-5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-4">选择导出数据范围</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'profile' as const, label: '个人资料', desc: '账号与个人信息' },
                { key: 'formulas' as const, label: '配方数据', desc: '所有配方及相关数据' },
                { key: 'experiments' as const, label: '实验数据', desc: '实验记录与结果' },
                { key: 'preferences' as const, label: '偏好设置', desc: '界面与通知配置' },
              ]).map(item => (
                <label key={item.key}
                  className={cn('flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all',
                    exportOptions[item.key]
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                  <input type="checkbox" checked={exportOptions[item.key]}
                    onChange={e => setExportOptions(p => ({ ...p, [item.key]: e.target.checked }))}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 w-4 h-4" />
                  <div>
                    <p className={cn('text-sm font-medium', exportOptions[item.key] ? 'text-primary-800 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-300')}>{item.label}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">导出格式</p>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="导出格式">
              {(['json', 'csv', 'excel'] as const).map(format => (
                <button key={format} onClick={() => setExportOptions(p => ({ ...p, format }))}
                  role="radio" aria-checked={exportOptions.format === format}
                  className={cn('p-4 rounded-xl border text-center transition-all',
                    exportOptions.format === format
                      ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                  <p className={cn('text-sm font-medium', exportOptions.format === format ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-700 dark:text-neutral-300')}>
                    {format === 'json' ? 'JSON' : format === 'csv' ? 'CSV' : 'Excel'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {format === 'json' ? '结构化数据' : format === 'csv' ? '表格格式' : '电子表格'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Download className="w-4 h-4" />} loading={loadingData}
            disabled={loadingData || (!exportOptions.profile && !exportOptions.formulas && !exportOptions.experiments && !exportOptions.preferences)}
            onClick={handleExportData}>
            {loadingData ? '导出中...' : '导出数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据导入 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">数据导入</CardTitle>
              <CardDescription>从备份文件或他处导入数据</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn('relative p-8 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer',
              isDragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-300 dark:hover:border-primary-700')}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('import-file-input')?.click()}>
            <input id="import-file-input" type="file" accept=".json,.csv,.xls,.xlsx"
              onChange={handleFileSelect} className="hidden" aria-hidden="true" />
            {importFile ? (
              <div>
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{importFile.name}</p>
                <p className="text-xs text-neutral-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                <Button variant="ghost" size="sm" className="mt-4 text-xs"
                  onClick={e => { e.stopPropagation(); setImportFile(null) }}>更换文件</Button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-neutral-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">拖放文件到此处</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">或点击选择文件</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3">支持 JSON、CSV、Excel，最大 10MB</p>
              </div>
            )}
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              导入操作将覆盖现有数据，建议先导出当前数据作为备份。
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-0">
          <Button variant="primary" icon={<Upload className="w-4 h-4" />} loading={loadingData}
            disabled={loadingData || !importFile} onClick={handleImportData}>
            {loadingData ? '导入中...' : '导入数据'}
          </Button>
        </CardFooter>
      </Card>

      {/* 数据清除 */}
      <Card className="border-rose-200 dark:border-rose-800/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight text-rose-800 dark:text-rose-300">危险操作区</CardTitle>
              <CardDescription className="text-rose-600/70 dark:text-rose-400/70">以下操作不可撤销，请谨慎执行</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-800 dark:text-rose-300 mb-1">清除所有账户数据</p>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
                  永久删除您的全部配方、实验记录、个人资料及界面配置，此操作无法恢复。
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" className="mt-5" icon={<Trash className="w-4 h-4" />}
              disabled={loadingData} onClick={() => setShowClearConfirm(true)}>
              清除所有数据
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderLocalePanel = () => (
    <div className="space-y-6">
      {/* 语言 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-sky-600 dark:text-sky-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">界面语言</CardTitle>
              <CardDescription>选择应用的显示语言</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
              { code: 'en-US', name: 'English', flag: '🇺🇸' },
              { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
            ]).map(lang => (
              <button key={lang.code} onClick={() => handleLanguageChange(lang.code)} disabled={loadingLocale}
                aria-checked={selectedLanguage === lang.code} role="radio"
                className={cn('flex items-center gap-3 p-5 rounded-xl border text-left transition-all',
                  selectedLanguage === lang.code
                    ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600')}>
                <span className="text-2xl" aria-hidden="true">{lang.flag}</span>
                <span className={cn('text-sm font-medium', selectedLanguage === lang.code ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-700 dark:text-neutral-300')}>
                  {lang.name}
                </span>
                {selectedLanguage === lang.code && <CheckCircle2 className="w-5 h-5 text-primary-500 ml-auto shrink-0" />}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            语言切换即时生效，部分翻译内容可能仍在完善中。
          </p>
        </CardContent>
      </Card>

      {/* 时区 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-violet-600 dark:text-violet-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">时区设置</CardTitle>
              <CardDescription>设置时间显示所使用的时区</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700/60 shrink-0">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">当前时间</p>
              <p className="text-base font-mono font-medium text-neutral-900 dark:text-neutral-100">
                {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日期时间格式 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">日期时间格式</CardTitle>
              <CardDescription>自定义日期与时间的显示方式</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">日期格式</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { format: 'YYYY-MM-DD', example: '2024-12-31' },
                { format: 'DD/MM/YYYY', example: '31/12/2024' },
                { format: 'MM/DD/YYYY', example: '12/31/2024' },
              ] as const).map(item => (
                <div key={item.format} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/60 text-center hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer transition-colors">
                  <p className="text-sm font-mono font-medium text-neutral-700 dark:text-neutral-300">{item.format}</p>
                  <p className="text-xs text-neutral-500 mt-1.5">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">时间格式</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { format: '24h' as const, example: '13:45', label: '24小时制' },
                { format: '12h' as const, example: '1:45 PM', label: '12小时制' },
              ]).map(item => (
                <div key={item.format} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700/60 text-center hover:border-neutral-300 dark:hover:border-neutral-600 cursor-pointer transition-colors">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{item.label}</p>
                  <p className="text-xs text-neutral-500 mt-1.5 font-mono">{item.example}</p>
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">通知偏好</CardTitle>
              <CardDescription>管理消息推送渠道与触发规则</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 触发事件 */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">触发事件</p>
            <div className="space-y-3">
              {([
                { key: 'formula_review' as const, label: '配方审核', desc: '配方提交审核、审核通过或驳回时' },
                { key: 'experiment_complete' as const, label: '实验完成', desc: '关联实验完成或失败时' },
                { key: 'ai_task_done' as const, label: 'AI 任务完成', desc: '配方生成、分析任务结束时' },
                { key: 'system_updates' as const, label: '系统更新', desc: '维护公告、版本发布等' },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700/60 pt-6">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">推送渠道</p>
            <div className="space-y-3">
              {([
                { key: 'browser_push' as const, label: '浏览器推送', desc: '在浏览器中接收实时通知', icon: BellRing },
                { key: 'email_notifications' as const, label: '邮件通知', desc: '将重要消息发送到邮箱', icon: Mail },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={notifPrefs[item.key]} onCheckedChange={() => toggleNotifPref(item.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700/60 pt-6">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">频率与优先级</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">发送频率</p>
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
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">消息优先级</p>
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
            <ShieldCheck className="w-4 h-4 text-emerald-500" />启用两步验证
          </DialogTitle>
          <DialogDescription>按以下步骤完成身份验证器绑定</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-sky-50 dark:bg-sky-500/10 rounded-xl border border-sky-200 dark:border-sky-500/20">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-500 mt-0.5 shrink-0" />
              <ol className="text-sm text-sky-800 dark:text-sky-300 space-y-1.5 list-decimal list-inside">
                <li>下载验证器应用（Google Authenticator 或 Microsoft Authenticator）</li>
                <li>扫描下方二维码或手动输入密钥</li>
                <li>输入 6 位验证码完成绑定</li>
              </ol>
            </div>
          </div>
          {twoFaSecret ? (
            <div className="flex flex-col items-center gap-3">
              <canvas id="two-factor-qrcode" className="rounded-lg bg-white p-2 border border-neutral-200 dark:border-neutral-700" />
              <div className="text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">手动输入密钥</p>
                <code className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg select-all">
                  {twoFaSecret}
                </code>
              </div>
            </div>
          ) : (
            <div className="flex justify-center p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
              <div className="text-center">
                <QrCode className="w-14 h-14 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">正在获取密钥…</p>
              </div>
            </div>
          )}
          {twoFaBackupCodes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                备用验证码（共 {twoFaBackupCodes.length} 个，每个只能用一次，请妥善保存）
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {twoFaBackupCodes.map((code, i) => (
                  <code key={i} className="text-xs font-mono px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 select-all text-neutral-700 dark:text-neutral-300">
                    {code.toUpperCase()}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShow2FAModal(false)} disabled={loadingSecurity}>关闭</Button>
          <Button variant="primary" onClick={handleEnable2FA} icon={<ShieldCheck className="w-4 h-4" />}>
            我已完成绑定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderClearConfirmDialog = () => (
    <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
      <DialogContent ref={clearConfirmRef} size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />确认清除所有数据？
          </DialogTitle>
          <DialogDescription>此操作不可撤销，请仔细阅读以下说明</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400 list-disc list-inside">
            <li>所有配方数据和实验记录</li>
            <li>个人资料和账户设置</li>
            <li>界面偏好与通知配置</li>
            <li>API 密钥与访问令牌</li>
          </ul>
          <div className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/20">
            <p className="text-xs text-rose-700 dark:text-rose-400 mb-2">
              请输入 <strong className="font-mono">DELETE ALL</strong> 以确认：
            </p>
            <Input value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)}
              placeholder="输入 DELETE ALL 确认" className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowClearConfirm(false)} disabled={loadingData}>取消</Button>
          <Button variant="danger" onClick={handleClearAllData} loading={loadingData}
            disabled={clearConfirmText !== 'DELETE ALL'} icon={<Trash className="w-4 h-4" />}>
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
  }

  // ── 主布局 ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter">

      {/* 顶部横幅 — 与 Dashboard 一致 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">设置</h1>
            <p className="mt-1 text-white/90 text-sm">管理账户信息、安全策略与个性化偏好</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary" size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => { setTab('data'); addToast({ type: 'info', message: '数据导出功能已就绪' }) }}
            >
              导出数据
            </Button>
            <Button
              variant="glass" size="sm"
              icon={<ShieldAlert className="w-4 h-4" />}
              onClick={() => setTab('security')}
            >
              安全诊断
            </Button>
          </div>
        </div>
      </div>

      {/* 横向 Tab — 与 Dashboard 快捷操作栏一致风格 */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl p-1 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50',
                )}
                aria-current={active ? 'true' : undefined}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500')} />
                {label}
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
