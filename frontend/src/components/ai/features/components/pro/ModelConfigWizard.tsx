/**
 * ModelConfigWizard — AI 模型配置向导
 *
 * 三步式向导：模板选择 → 参数编辑 → 预测试确认
 * 支持：
 * - 4 种预设模板（OpenAI / DeepSeek / 智谱 / Ollama）
 * - 实时表单验证（API Key / URL / 数字范围）
 * - API Key 脱敏显示与显隐切换
 * - 预测试集成 DiagnosticPanel
 * - 深色主题适配，Tailwind CSS
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Save,
  Bot,
  Server,
  WifiOff,
  Gift,
  Star,
} from 'lucide-react'
import type { DiagnosticReport } from './ModelDiagnosticPanel'

// ── 类型定义 ──────────────────────────────────────────────

export interface ModelConfigData {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  maxTokens: number
  temperature: number
}

export interface ModelConfigWizardProps {
  initialConfig?: Partial<ModelConfigData>
  onSave: (config: ModelConfigData) => Promise<void>
  onPreTest?: () => Promise<DiagnosticReport | null>
  isSaving?: boolean
}

type TemplateTier = 'recommended' | 'alternative' | 'free' | 'offline'

interface ProviderTemplate {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  description: string
  tier: TemplateTier
  icon: React.ReactNode
}

// ── 常量：预设模板 ─────────────────────────────────────────

const TEMPLATES: ProviderTemplate[] = [
  {
    id: 'openai-gpt4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    description: '高性能低成本，适合日常对话与配方生成',
    tier: 'recommended',
    icon: <Star className="h-5 w-5 text-amber-400" />,
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    description: '国产大模型，中文能力强，性价比高',
    tier: 'alternative',
    icon: <Bot className="h-5 w-5 text-blue-400" />,
  },
  {
    id: 'zhipu-glm4-flash',
    name: '智谱 GLM-4 Flash',
    provider: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    description: '免费额度充足，适合开发测试场景',
    tier: 'free',
    icon: <Gift className="h-5 w-5 text-emerald-400" />,
  },
  {
    id: 'ollama-local',
    name: 'Ollama 本地模型',
    provider: 'custom',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    description: '完全离线运行，隐私安全，需本地部署',
    tier: 'offline',
    icon: <WifiOff className="h-5 w-5 text-gray-400" />,
  },
]

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱 AI (Zhipu)' },
  { value: 'qwen', label: '通义千问 (Qwen)' },
  { value: 'custom', label: '自定义 (Custom)' },
] as const

const TIER_BADGE: Record<TemplateTier, { label: string; className: string }> = {
  recommended: { label: '推荐', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  alternative: { label: '备选', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  free: { label: '免费', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  offline: { label: '离线', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const STEPS = ['选择模板', '填写参数', '预测试确认'] as const

// ── 验证状态类型 ──────────────────────────────────────────

type ValidationStatus = 'idle' | 'valid' | 'warning' | 'error'

interface FieldValidation {
  status: ValidationStatus
  message: string
}

// ── 默认配置 ──────────────────────────────────────────────

const DEFAULT_CONFIG: ModelConfigData = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  maxTokens: 4096,
  temperature: 0.7,
}

// ── 子组件：步骤指示器 ────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          {/* 步骤圆点 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i < currentStep
                  ? 'bg-blue-600 text-white'
                  : i === currentStep
                    ? 'border-2 border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'border-2 border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800'
              }`}
            >
              {i < currentStep ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                i <= currentStep ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {label}
            </span>
          </div>
          {/* 连接线 */}
          {i < STEPS.length - 1 && (
            <ChevronRight className={`h-4 w-4 ${i < currentStep ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── 子组件：模板卡片 ──────────────────────────────────────

function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: ProviderTemplate
  isSelected: boolean
  onClick: () => void
}) {
  const badge = TIER_BADGE[template.tier]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-200 dark:border-blue-400 dark:bg-blue-900/20 dark:ring-blue-800/40'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
      }`}
    >
      {/* Tier 徽章 */}
      <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
        {badge.label}
      </span>

      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'
        }`}>
          {template.icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{template.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{template.provider}</p>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{template.description}</p>

      {/* 技术信息 */}
      <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
          <span className="text-gray-400 dark:text-gray-500">model:</span> {template.model}
        </p>
        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
          <span className="text-gray-400 dark:text-gray-500">base_url:</span> {template.baseUrl}
        </p>
      </div>
    </button>
  )
}

// ── 子组件：验证状态图标 ──────────────────────────────────

function ValidationIcon({ validation }: { validation: FieldValidation | null }) {
  if (!validation || validation.status === 'idle') return null

  switch (validation.status) {
    case 'valid':
      return <CheckCircle className="h-4 w-4 text-emerald-500" title={validation.message} />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" title={validation.message} />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" title={validation.message} />
  }
}

// ── 子组件：参数表单 ──────────────────────────────────────

function ParameterForm({
  config,
  validations,
  onChange,
}: {
  config: ModelConfigData
  validations: Record<string, FieldValidation>
  onChange: (key: keyof ModelConfigData, value: string | number) => void
}) {
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="space-y-5">
      {/* Provider 选择器 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
        <select
          value={config.provider}
          onChange={(e) => onChange('provider', e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-800/40"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={(e) => onChange('apiKey', e.target.value)}
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            className={`w-full rounded-lg border px-3 py-2.5 pr-20 text-sm font-mono transition-colors focus:outline-none focus:ring-2 ${
              validations.apiKey?.status === 'error'
                ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-200 dark:border-red-800 dark:bg-red-950/20 dark:focus:ring-red-800/40'
                : validations.apiKey?.status === 'warning'
                  ? 'border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950/20 dark:focus:ring-amber-800/40'
                  : validations.apiKey?.status === 'valid'
                    ? 'border-emerald-300 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/20 dark:focus:ring-emerald-800/40'
                    : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:focus:ring-blue-800/40'
            }`}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <ValidationIcon validation={validations.apiKey ?? null} />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {validations.apiKey?.message && validations.apiKey.status !== 'valid' && (
          <p className={`mt-1 text-xs ${
            validations.apiKey.status === 'error' ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {validations.apiKey.message}
          </p>
        )}
      </div>

      {/* Base URL */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Base URL <span className="font-normal text-gray-400">(可选)</span>
        </label>
        <div className="relative">
          <input
            type="url"
            value={config.baseUrl}
            onChange={(e) => onChange('baseUrl', e.target.value)}
            placeholder="https://api.example.com/v1"
            className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 ${
              validations.baseUrl?.status === 'error'
                ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-200 dark:border-red-800 dark:bg-red-950/20'
                : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:focus:ring-blue-800/40'
            }`}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <ValidationIcon validation={validations.baseUrl ?? null} />
          </div>
        </div>
        {validations.baseUrl?.message && validations.baseUrl.status !== 'valid' && (
          <p className="mt-1 text-xs text-red-500">{validations.baseUrl.message}</p>
        )}
      </div>

      {/* Model */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="gpt-4o-mini"
          className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm font-mono transition-colors focus:outline-none focus:ring-2 ${
            validations.model?.status === 'error'
              ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-200 dark:border-red-800 dark:bg-red-950/20'
              : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:focus:ring-blue-800/40'
          }`}
        />
        <div className="mt-1 flex items-center gap-1.5">
          <ValidationIcon validation={validations.model ?? null} />
          {validations.model?.message && validations.model.status !== 'valid' && (
            <span className="text-xs text-red-500">{validations.model.message}</span>
          )}
        </div>
      </div>

      {/* Max Tokens + Temperature 并排 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Max Tokens */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Max Tokens
          </label>
          <input
            type="number"
            min={256}
            max={128000}
            step={256}
            value={config.maxTokens}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value) || 4096)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:focus:ring-blue-800/40"
          />
          <p className="mt-0.5 text-[11px] text-gray-400">范围: 256 ~ 128000</p>
        </div>

        {/* Temperature */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Temperature: <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">{config.temperature.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature}
            onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 dark:bg-gray-700"
          />
          <div className="mt-0.5 flex justify-between text-[11px] text-gray-400">
            <span>精确 0.0</span>
            <span>平衡 0.7</span>
            <span>创意 2.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 子组件：预测试确认页 ──────────────────────────────────

function PreTestConfirmation({
  config,
  diagnosticReport,
  isPreTesting,
  hasPreTestPassed,
  onRunPreTest,
  onSave,
  onBack,
  isSaving,
}: {
  config: ModelConfigData
  diagnosticReport: DiagnosticReport | null
  isPreTesting: boolean
  hasPreTestPassed: boolean
  onRunPreTest: () => void
  onSave: () => void
  onBack: () => void
  isSaving: boolean
}) {
  // 脱敏 API Key
  const maskedApiKey = useMemo(() => {
    if (!config.apiKey) return '—'
    if (config.apiKey.length <= 12) return 'sk-***'
    return `${config.apiKey.slice(0, 6)}***${config.apiKey.slice(-4)}`
  }, [config.apiKey])

  const providerLabel = PROVIDER_OPTIONS.find((o) => o.value === config.provider)?.label ?? config.provider

  return (
    <div className="space-y-6">
      {/* 配置摘要卡片 */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">配置摘要</h4>
        </div>
        <dl className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {[
            { label: 'Provider', value: providerLabel },
            { label: 'API Key', value: maskedApiKey, mono: true },
            { label: 'Base URL', value: config.baseUrl || '(使用默认)', mono: true },
            { label: 'Model', value: config.model, mono: true },
            { label: 'Max Tokens', value: String(config.maxTokens) },
            { label: 'Temperature', value: String(config.temperature) },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-2.5">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{item.label}</dt>
              <dd className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${item.mono ? 'font-mono' : ''}`}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 预测试区域 */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 dark:border-gray-600 dark:bg-gray-800/80">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">连接预测试</h4>
        </div>

        {!diagnosticReport && !isPreTesting && (
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            运行预测试以验证配置是否正确，确保模型可正常调用。
          </p>
        )}

        {/* 预测试按钮 */}
        {!hasPreTestPassed && !isPreTesting && (
          <button
            type="button"
            onClick={onRunPreTest}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            运行预测试
          </button>
        )}

        {/* 测试中 */}
        {isPreTesting && (
          <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
            <Server className="h-4 w-4 animate-spin" />
            正在执行预测试...
          </div>
        )}

        {/* 测试结果摘要 */}
        {diagnosticReport && (
          <div className={`mt-3 rounded-lg p-3 ${
            diagnosticReport.overall === 'healthy'
              ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
              : diagnosticReport.overall === 'degraded'
                ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30'
                : 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30'
          }`}>
            <div className="flex items-center gap-2">
              {diagnosticReport.overall === 'healthy' ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : diagnosticReport.overall === 'degraded' ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {diagnosticReport.overall === 'healthy'
                  ? `预测试通过 — 健康度 ${diagnosticReport.score}/100`
                  : diagnosticReport.overall === 'degraded'
                    ? `预测试警告 — 健康度 ${diagnosticReport.score}/100`
                    : `预测试失败 — 健康度 ${diagnosticReport.score}/100`
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮区 */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          返回修改
        </button>

        {hasPreTestPassed ? (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '保存中...' : '保存并应用'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ── 主组件 ─────────────────────────────────────────────────

export function ModelConfigWizard({
  initialConfig,
  onSave,
  onPreTest,
  isSaving = false,
}: ModelConfigWizardProps) {
  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // 表单数据
  const [config, setConfig] = useState<ModelConfigData>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  })

  // 验证状态
  const [validations, setValidations] = useState<Record<string, FieldValidation>>({})

  // 预测试状态
  const [isPreTesting, setIsPreTesting] = useState(false)
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null)
  const [hasPreTestPassed, setHasPreTestPassed] = useState(false)

  // ── 验证逻辑 ──

  /** 验证 API Key */
  const validateApiKey = useCallback((value: string): FieldValidation => {
    if (!value.trim()) return { status: 'error', message: 'API Key 不能为空' }
    if (value.length < 20) return { status: 'warning', message: `长度偏短 (${value.length}/20+)` }
    if (!/^sk-[a-zA-Z0-9_-]+$/.test(value)) return { status: 'warning', message: '格式可能不正确，通常以 sk- 开头' }
    return { status: 'valid', message: '格式有效' }
  }, [])

  /** 验证 Base URL */
  const validateBaseUrl = useCallback((value: string): FieldValidation | null => {
    if (!value.trim()) return null
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { status: 'error', message: 'URL 必须以 http:// 或 https:// 开头' }
      }
      return { status: 'valid', message: 'URL 格式正确' }
    } catch {
      return { status: 'error', message: '无效的 URL 格式' }
    }
  }, [])

  /** 验证 Model */
  const validateModel = useCallback((value: string): FieldValidation => {
    if (!value.trim()) return { status: 'error', message: 'Model 名称不能为空' }
    if (value.includes(' ')) return { status: 'warning', message: 'Model 名称不应包含空格' }
    return { status: 'valid', message: '' }
  }, [])

  // ── 字段变更处理 ──

  const handleChange = useCallback(
    (key: keyof ModelConfigData, value: string | number) => {
      setConfig((prev) => ({ ...prev, [key]: value }))

      // 实时验证
      switch (key) {
        case 'apiKey':
          setValidations((prev) => ({ ...prev, apiKey: validateApiKey(String(value)) }))
          break
        case 'baseUrl':
          setValidations((prev) => ({ ...prev, baseUrl: validateBaseUrl(String(value)) }))
          break
        case 'model':
          setValidations((prev) => ({ ...prev, model: validateModel(String(value)) }))
          break
      }
    },
    [validateApiKey, validateBaseUrl, validateModel],
  )

  // ── 模板选择处理 ──

  const handleSelectTemplate = useCallback(
    (template: ProviderTemplate) => {
      setSelectedTemplateId(template.id)
      setConfig((prev) => ({
        ...prev,
        provider: template.provider,
        baseUrl: template.baseUrl,
        model: template.model,
      }))
      // 清除相关验证
      setValidations((prev) => {
        const next = { ...prev }
        delete next.baseUrl
        delete next.model
        return next
      })
    },
    [],
  )

  // ── 步骤导航 ──

  const canProceedToStep2 = useMemo(() => {
    return !!config.provider && !!config.model
  }, [config.provider, config.model])

  const goToNext = useCallback(() => {
    if (currentStep === 0 && canProceedToStep2) {
      setCurrentStep(1)
    } else if (currentStep === 1) {
      setCurrentStep(2)
    }
  }, [currentStep, canProceedToStep2])

  const goBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }, [currentStep])

  // ── 预测试 ──

  const handlePreTest = useCallback(async () => {
    if (!onPreTest) return
    setIsPreTesting(true)
    setDiagnosticReport(null)
    try {
      const report = await onPreTest()
      setDiagnosticReport(report)
      if (report && report.score >= 70) {
        setHasPreTestPassed(true)
      }
    } catch {
      setDiagnosticReport(null)
    } finally {
      setIsPreTesting(false)
    }
  }, [onPreTest])

  // ── 保存 ──

  const handleSave = useCallback(async () => {
    await onSave(config)
  }, [config, onSave])

  // ── 渲染 ──

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800/90">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 模型配置</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">三步完成模型接入配置</p>
      </div>

      {/* 步骤指示器 */}
      <StepIndicator currentStep={currentStep} />

      {/* Step 1: 模板选择 */}
      {currentStep === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                isSelected={selectedTemplateId === tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
              />
            ))}
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={goToNext}
              disabled={!canProceedToStep2}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一步
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 参数编辑 */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <ParameterForm
            config={config}
            validations={validations}
            onChange={handleChange}
          />

          {/* 底部按钮 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
              上一步
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              下一步
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 预测试确认 */}
      {currentStep === 2 && (
        <PreTestConfirmation
          config={config}
          diagnosticReport={diagnosticReport}
          isPreTesting={isPreTesting}
          hasPreTestPassed={hasPreTestPassed}
          onRunPreTest={handlePreTest}
          onSave={handleSave}
          onBack={goBack}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}

export default ModelConfigWizard
