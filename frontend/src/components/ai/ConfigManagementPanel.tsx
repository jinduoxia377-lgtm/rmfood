/**
 * ConfigManagementPanel v8.1 — 主题系统规范化（DESIGN.md §1.3 零硬编码原则）
 *
 * 字体层级（Apple HIG 400/600/700 阶梯，禁用 500）：
 *   L1 Panel 标题:  text-base (16px) / font-semibold (600) — 与 /ai 主页 StatCard 数值基线一致
 *   L2 区块标题:   text-sm / font-semibold (600)
 *   L3 卡片标题:   text-sm / font-semibold (600)
 *   L4 数据标签:   text-xs / font-semibold (600)
 *   L5 数值展示:   text-base / font-semibold (600)
 *   L6 辅助说明:   text-xs / font-normal (400)
 *
 * 色彩令牌（base.css 100% 覆盖，零硬编码 hex）：
 *   边框: var(--border-color)            替代 border-neutral-200
 *   文字: var(--text-primary/secondary/muted/disabled)
 *   容器: var(--card-bg-solid)          替代 bg-white / bg-neutral-900
 *   语义: var(--color-success/warning/error/info)-*  对应 10 级色阶
 *
 * 间距: gap-3 (12px) / p-4 (16px) / 卡片 p-5  — 紧凑 SaaS 仪表盘
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Activity, ShieldAlert, RefreshCw,
  AlertCircle, CheckCircle2, Server, Clock, TrendingUp,
  Lock, Database, Zap, FileText, Wifi, WifiOff, ChevronDown, ChevronUp,
  Cpu, CircleAlert, Eye, EyeOff, Save, Trash2, Key, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/shadcn/accordion';
import { Slider } from '@/components/ui/Slider';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { ModelClient } from '@/api/modelClient';
import type { ModelType } from '@/api/modelClient';
import { logger } from '@/utils/safeLogger';
import type { ModelStatus } from '@/api/modelClient';
import { ConfigManager, dispatchConfigSync, validateConfigSync, decryptKeyAsync } from '@/utils/configManager';
import type { ModelConfig } from '@/utils/configManager';
import { useModelHealthPolling } from './features/hooks/useModelHealthSSE';
import { compactionMonitor, getDashboardData } from './features/utils/compactionMonitor';
import { chatEventLog } from './features/capabilities/storage/ChatEventLog';
import { ErrorBoundary } from './features/components/ErrorBoundary';
import { fetchWithCsrf } from '@/utils/csrf';

// ════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════
interface BackendModelStatus {
  status: 'active' | 'inactive' | 'error' | 'unconfigured' | 'unknown';
  provider: string;
  model: string;
  base_url?: string;
  note?: string;
  api_key_configured?: boolean;
  api_key_length?: number;
  suggestion?: string;
  mode?: string;
}

interface LlmPreset {
  label: string; baseUrl: string; models: string[]; keyHint: string;
}

// ════════════════════════════════════════════════════════════
// LLM Provider 预设
// ════════════════════════════════════════════════════════════
const LLM_PRESETS: Record<string, LlmPreset> = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'], keyHint: 'https://platform.deepseek.com' },
  openai:   { label: 'OpenAI',   baseUrl: 'https://api.openai.com/v1',        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],            keyHint: 'https://platform.openai.com/api-keys' },
  zhipu:    { label: '智谱 AI',  baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],     keyHint: 'https://open.bigmodel.cn' },
  qwen:     { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'], keyHint: 'https://help.aliyun.com/zh/dashscope' },
  anthropic:{ label: 'Anthropic',baseUrl: 'https://api.anthropic.com/v1',      models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'], keyHint: 'https://console.anthropic.com' },
  agnes:    { label: 'Agnes AI', baseUrl: 'https://apihub.agnes-ai.com/v1',    models: [],                                       keyHint: 'https://agnes-ai.com' },
};

// ════════════════════════════════════════════════════════════
// 模型数据定义
// ════════════════════════════════════════════════════════════
const BUSINESS_MODELS: { value: ModelType; label: string; descKey: string; icon: React.ReactNode }[] = [
  { value: 'formula_gpt',   label: 'FormulaGPT',  descKey: 'descFormulaRule', icon: <Zap className="w-[18px] h-[18px]" /> },
  { value: 'synergy_net',   label: 'SynergyNet',  descKey: 'descSynergy',       icon: <Activity className="w-[18px] h-[18px]" /> },
  { value: 'safety_checker',label: 'SafetyChecker',descKey: 'descSafetyAuto',        icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
  { value: 'taste_predictor',label: 'TastePredictor',descKey: 'descTaste',         icon: <TrendingUp className="w-[18px] h-[18px]" /> },
];

const ADVANCED_MODELS: { key: ModelType; label: string; descKey: string; icon: React.ReactNode }[] = [
  { key: 'llm',           label: 'LLM',            descKey: 'descLlmApi',           icon: <Zap className="w-[18px] h-[18px]" /> },
  { key: 'formula_gpt',   label: 'FormulaGPT',     descKey: 'descFormulaEngine',             icon: <Cpu className="w-[18px] h-[18px]" /> },
  { key: 'synergy_net',   label: 'SynergyNet',     descKey: 'descSynergyModel',             icon: <Database className="w-[18px] h-[18px]" /> },
  { key: 'safety_checker',label: 'SafetyChecker',  descKey: 'descSafetyRule',             icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
  { key: 'taste_predictor',label: 'TastePredictor',descKey: 'descTastePredictor',               icon: <TrendingUp className="w-[18px] h-[18px]" /> },
  { key: 'stability_model',label: 'StabilityModel',descKey: 'descStabilitySim',               icon: <Lock className="w-[18px] h-[18px]" /> },
  { key: 'peptide_scorer', label: 'PeptideScorer', descKey: 'descPeptideScore',               icon: <FileText className="w-[18px] h-[18px]" /> },
];

const SUB_MODELS = [
  { key: 'formula_gpt',   label: 'FormulaGPT',  descKey: 'subFormula' },
  { key: 'synergy_net',   label: 'SynergyNet',  descKey: 'subSynergy' },
  { key: 'safety_checker',label: 'SafetyChecker',descKey: 'subSafety' },
  { key: 'taste_predictor',label: 'TastePredictor',descKey: 'subTaste' },
  { key: 'stability_model',label: 'StabilityModel',descKey: 'subStability' },
  { key: 'peptide_scorer', label: 'PeptideScorer',descKey: 'subPeptide' },
];

// ════════════════════════════════════════════════════════════
// 页面标题区（与 AIAssistantPage banner h2 风格一致: text-xl font-semibold）
// ════════════════════════════════════════════════════════════
function PageHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
      <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center flex-shrink-0">
        <Settings className="w-5 h-5 text-primary-700 dark:text-primary-700" />
      </div>
      <div>
        <h1 className="text-base font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('ai.config.title')}
        </h1>
        <p className="text-xs font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('ai.config.subtitle')}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 区块标题（层级低于 PageHeader: text-sm / 600）
// ════════════════════════════════════════════════════════════
function SectionHeader({
  icon, iconBg, iconColor, title, subtitle, action,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <p className="text-xs font-normal mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 第 1 层：模型健康监控
// ════════════════════════════════════════════════════════════
function HealthDashboard() {
  const { t } = useTranslation();
  const { healthData, isConnected, lastUpdated } = useModelHealthPolling(15_000);
  const queryClient = useQueryClient();
  const { data: statusesRaw } = useQuery<Record<string, ModelStatus | undefined>>({
    queryKey: ['ai-model-status'],
    queryFn: () => ModelClient.getModelStatus(),
    staleTime: 30_000,
    retry: 1,
  });
  const statuses: Record<string, BackendModelStatus | undefined> = statusesRaw as Record<string, BackendModelStatus | undefined>;
  const llmStatus = statuses?.llm;
  const isLlmActive = llmStatus?.status === 'active';

  const [showLlmQuick, setShowLlmQuick] = useState(false);
  const [llmKey, setLlmKey] = useState('');
  const [llmProvider, setLlmProvider] = useState('deepseek');
  const [llmModel, setLlmModel] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmMsg, setLlmMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [llmFetching, setLlmFetching] = useState(false);
  const [llmBackendLoading, setLlmBackendLoading] = useState(false);

  /** D-7 修复：从后端加载改为读当前用户的 user-key 状态（与 saveUserLlmKey 保存目标一致，闭环打通）。
   *  不再读全局 admin 配置，避免「加载全局、保存个人」的读写目标断裂。
   *  apiKey 为脱敏值，绝不写回本地，需用户重新填写后保存。 */
  const handleLlmLoadFromBackend = useCallback(async () => {
    setLlmBackendLoading(true);
    setLlmMsg(null);
    try {
      const status = await ConfigManager.getUserLlmKeyStatus();
      if (!status.success) {
        setLlmMsg({ type: 'error', text: '查询个人密钥状态失败（可能未登录）' });
        return;
      }
      if (!status.configured) {
        setLlmMsg({ type: 'success', text: '您尚未配置个人 LLM 密钥，请在下方填写后保存' });
        return;
      }
      if (status.base_url && status.base_url !== '(使用提供商默认)') setLlmBaseUrl(status.base_url);
      if (status.provider) setLlmProvider(status.provider);
      if (status.model) setLlmModel(status.model);
      setLlmMsg({
        type: 'success',
        text: `已加载您的个人密钥配置（provider=${status.provider || '—'}, model=${status.model || '—'}, 密钥 ${status.api_key_masked || '***'}），如需更换请重新填写密钥后保存`,
      });
    } finally {
      setLlmBackendLoading(false);
    }
  }, []);

  /** 实时获取 Provider 可用模型列表（OpenAI 兼容 API） */
  const fetchLlmModels = useCallback(async (provider: string, apiKey: string, baseUrl: string) => {
    const preset = LLM_PRESETS[provider];
    if (!preset) return;
    // 预设模型已硬编码，无需请求
    if (preset.models.length > 0) {
      setLlmModels(preset.models);
      return;
    }
    // 动态获取：调用 {baseUrl}/models
    setLlmFetching(true);
    setLlmModels([]);
    try {
      const url = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey || 'no-key'}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { data?: { id: string }[] };
      const models = data?.data?.map(m => m.id).filter(Boolean) || [];
      setLlmModels(models.length > 0 ? models : [`(请手动输入模型名)`]);
    } catch {
      setLlmModels([`无法获取模型列表，请手动输入模型名`]);
    } finally {
      setLlmFetching(false);
    }
  }, []);

  // P1 模型列表走网关：优先走后端代理端点 /models/list（避免浏览器直连 LLM，
  // 密钥不出后端、无 CORS 问题；旧直连逻辑保留为 fallback，代理失败时降级）。
  const fetchLlmModelsViaProxy = useCallback(async (provider: string, apiKey: string, baseUrl: string) => {
    try {
      const targetUrl = baseUrl || LLM_PRESETS[provider]?.baseUrl || '';
      const data = await fetchWithCsrf<{ models?: string[] }>('/api/v1/ai/models/list', {
        method: 'POST',
        body: JSON.stringify({ provider, api_key: apiKey, base_url: targetUrl, timeout_ms: 8000 }),
      });
      setLlmModels(data.models && data.models.length > 0 ? data.models : ['(请手动输入模型名)']);
    } catch {
      // 代理不可用，降级到浏览器直连（旧路径）
      fetchLlmModels(provider, apiKey, baseUrl);
    }
  }, [fetchLlmModels]);

  // 组件挂载时初始化配置
  useEffect(() => {
    try {
      const cfg = ConfigManager.getModelConfig('llm');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLlmKey(cfg.apiKey || '');
      const storedProvider = localStorage.getItem('rmfood_llm_provider') || 'deepseek';
      setLlmProvider(storedProvider);
      const preset = LLM_PRESETS[storedProvider];
      setLlmBaseUrl(preset?.baseUrl || '');
      const storedModel = localStorage.getItem('rmfood_llm_model') || '';
      if (storedModel) setLlmModel(storedModel);
    } catch { /* 初始化失败时静默 */ }
  }, []);

  // 面板打开时：初始化 baseUrl / apiKey / 模型列表
  useEffect(() => {
    if (showLlmQuick) {
      try {
        const cfg = ConfigManager.getModelConfig('llm');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLlmKey(cfg.apiKey || '');
        const preset = LLM_PRESETS[llmProvider];
        setLlmBaseUrl(preset?.baseUrl || '');
      } catch { /* 初始化失败时静默 */ }
      fetchLlmModelsViaProxy(llmProvider, llmKey, llmBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLlmQuick]);

  useEffect(() => {
    if (showLlmQuick) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchLlmModelsViaProxy(llmProvider, llmKey, llmBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmProvider, llmBaseUrl, showLlmQuick]);

  // 保存前验活（P0 功能 #3）：用填写的密钥做一次最小 LLM 调用，不写库
  const [llmTesting, setLlmTesting] = useState(false);
  const handleLlmTest = useCallback(async () => {
    if (!llmKey.trim()) {
      setLlmMsg({ type: 'error', text: '请先填写 API 密钥再验活' });
      return;
    }
    setLlmTesting(true);
    setLlmMsg(null);
    const effectiveBaseUrl = llmBaseUrl.trim() || LLM_PRESETS[llmProvider]?.baseUrl || 'https://api.deepseek.com/v1';
    const result = await ConfigManager.testUserLlmKey({
      provider: llmProvider,
      apiKey: llmKey.trim(),
      baseUrl: effectiveBaseUrl,
      model: llmModel,
    });
    setLlmTesting(false);
    if (result.success) {
      setLlmMsg({ type: 'success', text: `验活通过：${result.detail}` });
    } else {
      setLlmMsg({ type: 'error', text: `验活失败：${result.detail}` });
    }
  }, [llmKey, llmModel, llmBaseUrl, llmProvider]);

  const handleLlmSave = async () => {
    if (!llmKey.trim() || llmKey.trim().length < 20) {
      setLlmMsg({ type: 'error', text: 'API 密钥长度不足（需 20+ 字符）' }); return;
    }
    setLlmSaving(true); setLlmMsg(null);
    try {
      const effectiveBaseUrl = llmBaseUrl.trim() || LLM_PRESETS[llmProvider]?.baseUrl || 'https://api.deepseek.com/v1';

      // P0 功能 #1：普通用户保存走 user-key 通道（无需管理员），
      // 与全局管理员配置完全隔离，影响范围仅限当前用户。
      const userResult = await ConfigManager.saveUserLlmKey({
        provider: llmProvider,
        apiKey: llmKey.trim(),
        baseUrl: effectiveBaseUrl,
        model: llmModel,
      });

      // 本地缓存仍然更新（保留历史路径）
      ConfigManager.setModelConfig('llm', {
        apiKey: llmKey.trim(),
        baseUrl: effectiveBaseUrl,
        timeout: 60000,
        maxRetries: 3,
        concurrencyLimit: 3,
        model: llmModel,
        provider: llmProvider,
      });
      localStorage.setItem('rmfood_llm_provider', llmProvider);
      localStorage.setItem('rmfood_llm_model', llmModel);

      if (userResult.success) {
        setLlmMsg({ type: 'success', text: `个人密钥已保存${userResult.keyMasked ? `（${userResult.keyMasked}）` : ''}，/ai 对话将使用您自己的密钥` });
      } else {
        setLlmMsg({ type: 'error', text: userResult.message || '个人密钥保存失败，已同步本地缓存；可尝试下方"验活"排查密钥有效性' });
      }

      dispatchConfigSync();
    } catch {
      setLlmMsg({ type: 'error', text: '保存失败，请检查网络或后端服务' });
    } finally {
      setLlmSaving(false);
    }
  };


  return (
    <section aria-label={t('ai.config.modelHealth')} className="mb-4">
      <SectionHeader
        icon={<Activity className="w-5 h-5" />}
        iconBg="bg-success-100 dark:bg-success-300/25"
        iconColor="text-success-700 dark:text-success-600"
        title={t('ai.config.modelHealth')}
        subtitle={`${t('ai.config.realtimeStatus')} · ${isConnected ? t('ai.config.pollingNormal') : t('ai.config.pollingFailed')}`}
        action={
          <>
            {lastUpdated && (
              <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                {t('ai.config.updatedAt')} {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => queryClient.refetchQueries({ queryKey: ['ai-model-status'] })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
          </>
        }
      />

      {/* LLM 主卡 + 子模型列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* ── LLM 主卡（与 AIAssistantPage 统计卡风格一致: rounded-xl / shadow-sm / var(--border-color)）── */}
        <div className="lg:col-span-2 rounded-xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md"
          style={{ borderColor: 'var(--border-color)' }}>
          {/* 状态色带 — 与页面 Tab 分组顶部强调色条一致: h-[2px] + left-4 right-4 + rounded-full */}
          <div className={`h-[2px] mx-4 rounded-full transition-colors duration-200 ${isLlmActive ? 'bg-success-500' : 'bg-warning-500'}`} />
          <div className="px-5 pt-4 pb-5">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isLlmActive ? 'bg-success-100 dark:bg-success-300/25' : 'bg-warning-100 dark:bg-warning-300/25'
        }`}>
                  {isLlmActive
                    ? <CheckCircle2 className="w-5 h-5 text-success-700 dark:text-success-600" />
                    : <CircleAlert className="w-5 h-5 text-warning-600 dark:text-warning-700" />
                  }
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{t('ai.config.llm')}</div>
                  <div className="text-sm font-normal mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {llmStatus?.provider || t('ai.config.notConfigured')} · {llmStatus?.model || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isLlmActive
                    ? 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-700'
                    : 'bg-warning-100 dark:bg-warning-300/25 text-warning-700 dark:text-warning-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLlmActive ? 'bg-success-500 animate-pulse' : 'bg-warning-500'}`} />
                  {isLlmActive ? t('ai.config.modelStatusRunning') : t('ai.config.notConfigured')}
                </span>
                <button
                  onClick={() => setShowLlmQuick(!showLlmQuick)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
                >
                  {showLlmQuick ? <ChevronDown className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                  {showLlmQuick ? '收起' : '配置'}
                </button>
              </div>
            </div>

            {/* 快捷配置面板 */}
            {showLlmQuick && (
              <div className="mb-4 p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-300/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-700">
                    <Key className="w-3.5 h-3.5" />LLM API 配置
                  </div>
                  <button
                    type="button"
                    onClick={handleLlmLoadFromBackend}
                    disabled={llmBackendLoading}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150 disabled:opacity-50"
                  >
                    {llmBackendLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                    加载个人密钥
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[var(--text-secondary)] block">Provider</label>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-sm text-[var(--text-primary)] dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Object.entries(LLM_PRESETS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[var(--text-secondary)] block">Model</label>
                    <select
                      value={llmModels.includes(llmModel) ? llmModel : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom__') {
                          // 切到"自定义输入"：清空当前值让用户填写
                          setLlmModel('');
                        } else {
                          setLlmModel(v);
                        }
                      }}
                      disabled={llmFetching}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-sm text-[var(--text-primary)] dark:text-white outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="" disabled>{llmFetching ? '加载中...' : '选择模型'}</option>
                      {llmModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="__custom__">{t('ai.config.customInput')}</option>
                    </select>
                    {(!llmModels.includes(llmModel) || llmModel === '') && !llmFetching && (
                      <Input
                        type="text"
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        placeholder="手动输入模型名，如 qwen-max-0428"
                        className="h-9 font-mono text-xs"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[var(--text-secondary)] block">{t('ai.config.requestUrl')}</label>
                  <Input
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    placeholder="https://api.xxx.com/v1"
                    className="h-10 font-mono text-xs"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    留空则使用 Provider 默认地址
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[var(--text-secondary)] block">API 密钥</label>
                  <Input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-10"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    获取密钥: {LLM_PRESETS[llmProvider]?.keyHint}
                  </p>
                </div>
                {llmMsg && (
                  <p className={`text-sm ${llmMsg.type === 'success' ? 'text-success-700 dark:text-success-600' : 'text-error-600 dark:text-error-700'}`}>
                    {llmMsg.text}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowLlmQuick(false); setLlmMsg(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-normal border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleLlmTest}
                    disabled={llmTesting || llmSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-normal border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150 disabled:opacity-50"
                  >
                    {llmTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    验活
                  </button>
                  <button
                    onClick={handleLlmSave}
                    disabled={llmSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-container text-primary-main hover:bg-primary-container transition-colors duration-150 disabled:opacity-50"
                  >
                    {llmSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    保存配置
                  </button>
                </div>
              </div>
            )}

            {/* 指标网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Server className="w-3.5 h-3.5" />, label: 'Provider', value: llmStatus?.provider || '—' },
                { icon: <Cpu className="w-3.5 h-3.5" />, label: 'Model', value: llmStatus?.model || '—' },
                { icon: <Clock className="w-3.5 h-3.5" />, label: '延迟', value: (() => { const h = healthData?.[0]; return h ? `${h.latency_ms}ms` : '—'; })() },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: '成功率', value: (() => { const h = healthData?.[0]; return h ? `${h.success_rate}%` : '—'; })() },
              ].map(({ icon, label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-[var(--border-color)]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                    {icon}{label}
                  </div>
                  <div className="text-base font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* 备注 */}
            {llmStatus?.note && (
              <div className="mt-3 flex items-start gap-2.5 text-sm rounded-xl px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-[var(--border-color)]" style={{ color: 'var(--text-secondary)' }}>
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
                {llmStatus.note}
              </div>
            )}
            {!isLlmActive && llmStatus?.suggestion && (
              <div
                className="mt-3 flex items-start gap-2.5 text-sm rounded-xl px-3 py-2.5 bg-warning-50 dark:bg-warning-300/15 border border-warning-200 dark:border-warning-800/40 text-warning-800 dark:text-warning-700"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {llmStatus.suggestion}
              </div>
            )}
          </div>
        </div>

        {/* ── 子模型状态列表 ── */}
        <div className="space-y-2">
          {SUB_MODELS.map(({ key, label, descKey }) => {
            const s = statuses?.[key] as BackendModelStatus | undefined;
            const isActive = s?.status === 'active';
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-white dark:bg-neutral-900 hover:border-[var(--border-color)] hover:shadow-sm transition-all duration-150">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{label}</div>
                  <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{t(`ai.config.${descKey}`)}</div>
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {isActive ? t('ai.config.online') : t('ai.config.ruleMode')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 健康进度条 */}
      {healthData?.length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--border-color)] bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('ai.config.modelQuality')}</span>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {isConnected
                ? <><Wifi className="w-3.5 h-3.5 text-success-500" /><span>{t('ai.config.polling')}</span></>
                : <><WifiOff className="w-3.5 h-3.5" /><span>{t('ai.config.connectionFailed')}</span></>
              }
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {healthData.map((m) => (
              <div key={m.model}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{m.model}</span>
                  <span className={`text-sm font-semibold tabular-nums ${
                    m.success_rate >= 98 ? 'text-success-700 dark:text-success-600'
                    : m.success_rate >= 95 ? 'text-warning-600 dark:text-warning-700'
                    : 'text-error-600 dark:text-error-700'
                  }`}>{m.success_rate}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border-color)]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      m.success_rate >= 98 ? 'bg-success-500'
                      : m.success_rate >= 95 ? 'bg-warning-500'
                      : 'bg-error-500'
                    }`}
                    style={{ width: `${m.success_rate}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{m.latency_ms}ms</span>
                  <span>{m.error_count} 次错误</span>
                  <span>{m.uptime_percentage}% {t('ai.config.online')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// 第 2 层：默认模型选择
// ════════════════════════════════════════════════════════════
function DefaultModelSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<ModelType>(() => {
    try { return (localStorage.getItem('rmfood_default_model') as ModelType) || 'formula_gpt'; } catch { return 'formula_gpt'; }
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [backendSync, setBackendSync] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleModelSelect = async (modelType: ModelType) => {
    setSelectedModel(modelType);
    setSaving(true); setSaveMsg(null);
    setBackendSync('idle');
    try {
      localStorage.setItem('rmfood_default_model', modelType);
      setSaveMsg(`${BUSINESS_MODELS.find((o: typeof BUSINESS_MODELS[0]) => o.value === modelType)?.label} 已设为默认模型`);
      // P1 默认模型持久化：尽力同步到后端（/ai 页统计与跨设备一致）
      try {
        const res = await fetch('/api/v1/ai/models/default', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ model_type: modelType }),
        });
        setBackendSync(res.ok ? 'ok' : 'fail');
      } catch {
        setBackendSync('fail');
      }
      await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
    } catch { setSaveMsg('保存失败，请重试'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(null), 3000); }
  };

  return (
    <section aria-label={t('ai.config.defaultModel')} className="mb-4">
      <SectionHeader
        icon={<Settings className="w-5 h-5" />}
        iconBg="bg-secondary-100 dark:bg-secondary-300/25"
        iconColor="text-secondary-700 dark:text-secondary-700"
        title={t('ai.config.defaultModel')}
        subtitle="选择各业务场景使用的默认 AI 模型"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ModelSelector modelType={selectedModel} onModelChange={handleModelSelect} onParamsChange={() => {}} />
          {saveMsg && (
            <div className="mt-3 px-3 py-2 rounded-lg text-sm font-semibold bg-success-50 dark:bg-success-300/20 text-success-700 dark:text-success-700 border border-success-200 dark:border-success-800/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {saveMsg}
              {backendSync === 'fail' && <span className="ml-auto text-xs font-normal text-warning-600 dark:text-warning-700">{t('ai.config.notSyncedBackend')}</span>}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {BUSINESS_MODELS.map(({ value, label, descKey, icon }: typeof BUSINESS_MODELS[0]) => {
            const isSelected = selectedModel === value;
            return (
              <button key={value} onClick={() => handleModelSelect(value)} disabled={saving}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-300/20 shadow-sm ring-1 ring-primary-500/20'
                    : 'border-[var(--border-color)] bg-white dark:bg-neutral-900 hover:border-[var(--border-color)] hover:shadow-sm'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-300/30' : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold leading-none ${isSelected ? 'text-primary-700 dark:text-primary-700' : ''}`} style={{ color: isSelected ? 'var(--color-primary-700)' : 'var(--text-primary)' }}>{label}</div>
                    <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{t(`ai.config.${descKey}`)}</div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// 单模型配置行
// ════════════════════════════════════════════════════════════
function ModelConfigRow({ modelKey, status }: { modelKey: ModelType; status?: BackendModelStatus }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<Record<ModelType, ModelConfig>>({} as Record<ModelType, ModelConfig>);
  const [llmProvider, setLlmProvider] = useState('deepseek');
  const [llmModel, setLlmModel] = useState('deepseek-chat');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [llmFetching, setLlmFetching] = useState(false);

  /** 实时获取 Provider 可用模型列表（OpenAI 兼容 API） */
  const fetchLlmModels = useCallback(async (provider: string, apiKey: string, baseUrl?: string) => {
    const preset = LLM_PRESETS[provider];
    if (!preset) return;
    if (preset.models.length > 0) {
      setLlmModels(preset.models);
      return;
    }
    const targetUrl = baseUrl || preset.baseUrl;
    setLlmFetching(true);
    setLlmModels([]);
    try {
      const url = targetUrl.endsWith('/models') ? targetUrl : `${targetUrl}/models`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey || 'no-key'}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { data?: { id: string }[] };
      const models = data?.data?.map(m => m.id).filter(Boolean) || [];
      setLlmModels(models.length > 0 ? models : [`(请手动输入模型名)`]);
    } catch {
      setLlmModels([`无法获取模型列表，请手动输入模型名`]);
    } finally {
      setLlmFetching(false);
    }
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigs(ConfigManager.getModelConfigs());
      const llmCfg = ConfigManager.getModelConfig('llm');
      if (llmCfg?.apiKey) {
        const sp = localStorage.getItem('rmfood_llm_provider');
        if (sp && LLM_PRESETS[sp]) setLlmProvider(sp);
        const sm = localStorage.getItem('rmfood_llm_model');
        if (sm) setLlmModel(sm);
      }
    } catch { /* 初始化失败时静默 */ }
  }, []);

  // P1 密钥存储升级消费：LLM 密钥可能为 RMF:2: AES-GCM 加密，同步读 getModelConfigs 解不开，
  // 需在挂载时异步水合，把已升级密钥真正载入 UI 并更新 legacyUnencrypted 标记
  const hydrateLlmKeyAsync = useCallback(async () => {
    try {
      const stored = localStorage.getItem('rmfood_model_configs');
      if (!stored) return;
      const raw = JSON.parse(stored);
      const encKey = (raw?.llm?.apiKey as string) || '';
      if (!encKey.startsWith('RMF:2:')) return; // 非 AES 值，同步路径已可处理
      const { raw: decrypted } = await decryptKeyAsync(encKey);
      if (decrypted) {
        setConfigs(prev => ({ ...prev, llm: { ...(prev.llm || ConfigManager.getDefaultModelConfig()), apiKey: decrypted } }));
        // eslint-disable-next-line react-hooks/immutability
        setLlmLegacyKey(false);
      } else {
        // 跨会话 DPAPI 密钥丢失：密钥不可用，强制重输
        setConfigs(prev => ({ ...prev, llm: { ...(prev.llm || ConfigManager.getDefaultModelConfig()), apiKey: '' } }));
        setLlmLegacyKey(true);
      }
    } catch { /* 解密失败时静默 */ }
  }, []);

  // P1 legacyUnencrypted 消费：检测当前 LLM 密钥是否为历史明文（未经 base64 编码入库），
  // 若为明文则强制用户重新输入，避免把疑似明文当有效密钥继续使用
  const [llmLegacyKey, setLlmLegacyKey] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    hydrateLlmKeyAsync();
  }, [hydrateLlmKeyAsync]);
  const syncFromStorage = useCallback(() => {
    try {
      const latest = ConfigManager.getModelConfigs();
      setConfigs(latest);
      const sp = localStorage.getItem('rmfood_llm_provider');
      if (sp && LLM_PRESETS[sp]) setLlmProvider(sp);
      const sm = localStorage.getItem('rmfood_llm_model');
      if (sm) setLlmModel(sm);
    } catch { /* 同步失败时静默 */ }
  }, []);

  useEffect(() => {
    // P1 广播事件防护：仅接受带 token 签名的合法事件，拒绝外来脚本派发的裸事件
    const onSync = (e: Event) => {
      if (validateConfigSync(e)) syncFromStorage();
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('rmfood-config-sync', onSync);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('rmfood-config-sync', onSync);
    };
  }, [syncFromStorage]);

  const handleProviderChange = async (provider: string) => {
    setLlmProvider(provider);
    const preset = LLM_PRESETS[provider];
    if (preset) {
      setConfigs(prev => ({ ...prev, llm: { ...(prev.llm || ConfigManager.getDefaultModelConfig()), baseUrl: preset.baseUrl } }));
      if (!preset.models.includes(llmModel)) setLlmModel(preset.models[0] || '');
      await fetchLlmModels(provider, configs.llm?.apiKey || '', configs.llm?.baseUrl);
    }
    // P1 一致性 #12：provider 变更也派发同步事件，避免快捷面板读到旧 provider
    dispatchConfigSync();
  };

  const handleSave = async (key: ModelType) => {
    setIsSaving(true); setMsg(null);
    try {
      const config = configs[key] || ConfigManager.getDefaultModelConfig();
      
      // Step 1: 本地持久化
      ConfigManager.setModelConfig(key, config);
      if (key === 'llm') { 
        localStorage.setItem('rmfood_llm_provider', llmProvider); 
        localStorage.setItem('rmfood_llm_model', llmModel); 
      }
      
      // Step 2: 同步到后端数据库（仅 LLM 类型需要）
      let backendSuccess = true;
      let backendForbidden = false;
      if (key === 'llm') {
        const effectiveBaseUrl = (config.baseUrl || '').trim() || LLM_PRESETS[llmProvider]?.baseUrl || '';
        const r = await ConfigManager.syncToBackend('llm', {
          apiKey: config.apiKey || '',
          baseUrl: effectiveBaseUrl,
          timeout: config.timeout || 60000,
          maxRetries: config.maxRetries || 3,
          concurrencyLimit: config.concurrencyLimit || 3,
          model: llmModel,
          provider: llmProvider,
        });
        backendSuccess = r.success;
        backendForbidden = r.forbidden === true;
      }
      
      await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
      syncFromStorage();
      dispatchConfigSync();
      
      if (backendSuccess) {
        setMsg({ type: 'success', text: '配置已保存到服务器和本地缓存' });
      } else if (backendForbidden) {
        // P0 功能 #1：非管理员调用全局配置端点会被 403 拒绝，引导走个人密钥通道
        setMsg({ type: 'error', text: t('ai.config.noPermissionGlobal') });
      } else {
        setMsg({ type: 'error', text: '配置已保存到本地缓存，服务器保存失败' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: '保存失败，请检查网络或后端服务' });
      logger.error('[ConfigManagementPanel] handleSave error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (key: ModelType) => {
    try {
      ConfigManager.resetModelConfig(key);
      setConfigs(ConfigManager.getModelConfigs());
      setMsg({ type: 'success', text: '已重置本地缓存（后端全局配置不受影响）' });
    } catch { /* 重置失败时静默 */ }
  };

  const isActive = status?.status === 'active';
  const isUnconfigured = status?.status === 'unconfigured';
  const hasKey = !!configs[modelKey]?.apiKey;
  const modelInfo = ADVANCED_MODELS.find(m => m.key === modelKey)!;

  return (
    <AccordionItem value={modelKey} className="border-b border-[var(--border-color)] last:border-0">
      <AccordionTrigger
        icon={<ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />}
        className="py-3 hover:no-underline"
      >
        <div className="flex items-center gap-4 w-full">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-success-500' : isUnconfigured ? 'bg-warning-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isActive ? 'bg-success-100 dark:bg-success-300/25'
              : isUnconfigured ? 'bg-warning-100 dark:bg-warning-300/25'
              : 'bg-neutral-100 dark:bg-neutral-800'
          }`}>
            <span className={isActive ? 'text-success-700 dark:text-success-600' : isUnconfigured ? 'text-warning-600 dark:text-warning-700' : 'text-[var(--text-disabled)]'}>
              {modelInfo.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{modelInfo.label}</div>
            <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{t(`ai.config.${modelInfo.descKey}`)}</div>
          </div>
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {modelKey === 'llm' && (
              <span className="text-xs flex items-center gap-1" style={{ color: hasKey ? 'var(--color-success)' : 'var(--text-muted)' }}>
                <Key className="w-3 h-3" />{hasKey ? t('ai.config.configured') : t('ai.config.notConfigured')}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isActive ? 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-700'
                : isUnconfigured ? 'bg-warning-100 dark:bg-warning-300/25 text-warning-700 dark:text-warning-700'
                : 'bg-neutral-100 dark:bg-neutral-800 text-[var(--text-secondary)] dark:text-[var(--text-muted)]'
            }`}>
              {isActive ? t('ai.config.active') : isUnconfigured ? t('ai.config.notConfigured') : t('ai.config.ruleMode')}
            </span>
            {configs[modelKey]?.baseUrl && (
              <span className="text-xs font-mono hidden lg:inline" style={{ color: 'var(--text-muted)' }}>
                {configs[modelKey]!.baseUrl!.split('/')[2]}
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <div className="space-y-4 pt-1">
          {modelKey === 'llm' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--text-secondary)] block">Provider</label>
                <select value={llmProvider} onChange={e => handleProviderChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-sm text-[var(--text-primary)] dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
                  {Object.entries(LLM_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--text-secondary)] block">Model</label>
                <select
                  value={llmModels.includes(llmModel) ? llmModel : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__custom__') setLlmModel('');
                    else setLlmModel(v);
                  }}
                  disabled={llmFetching}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-sm text-[var(--text-primary)] dark:text-white outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <option value="" disabled>{llmFetching ? '加载中...' : '选择模型'}</option>
                  {llmModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="__custom__">{t('ai.config.customInput')}</option>
                </select>
                {(!llmModels.includes(llmModel) || llmModel === '') && !llmFetching && (
                  <Input
                    type="text"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="手动输入模型名"
                    className="h-9 font-mono text-xs"
                  />
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">
                API 密钥 {modelKey === 'llm' ? '' : '(可选)'}
              </label>
              {configs[modelKey]?.apiKey && (
                <span className="text-xs text-success-700 dark:text-success-600">
                  ✓ {configs[modelKey]!.apiKey!.length} 字符已保存
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={configs[modelKey]?.apiKey || ''}
                onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), apiKey: e.target.value } }))}
                placeholder={modelKey === 'llm' ? `输入 ${LLM_PRESETS[llmProvider]?.label || ''} API 密钥 (sk-...)` : '输入 API 密钥'}
                className="h-10 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)] transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {modelKey === 'llm' && llmLegacyKey && (
              <p className="text-xs text-warning-600 dark:text-warning-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                该密钥为历史明文存储（未经编码入库），请重新输入以启用安全编码保护
              </p>
            )}
            {modelKey === 'llm' && (
              <p className="text-xs text-[var(--text-muted)]">
                获取密钥: {LLM_PRESETS[llmProvider]?.keyHint}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[var(--text-secondary)] block">API 基础 URL</label>
            <Input
              value={configs[modelKey]?.baseUrl || (modelKey === 'llm' ? LLM_PRESETS[llmProvider]?.baseUrl || '' : '')}
              onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), baseUrl: e.target.value } }))}
              placeholder="https://api.example.com/v1"
              className="h-10 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[var(--text-secondary)] block">{t('ai.config.timeout')}</label>
              <Input type="number" value={configs[modelKey]?.timeout || 30000}
                onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), timeout: parseInt(e.target.value) || 30000 } }))}
                min={5000} max={60000} step={1000}
                className="h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[var(--text-secondary)] block">{t('ai.config.maxRetries')}</label>
              <Input type="number" value={configs[modelKey]?.maxRetries ?? 3}
                onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), maxRetries: parseInt(e.target.value) || 3 } }))}
                min={0} max={10}
                className="h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[var(--text-secondary)] block">
                并发限制: {configs[modelKey]?.concurrencyLimit ?? 3}
              </label>
              <Slider value={configs[modelKey]?.concurrencyLimit ?? 3} min={1} max={10} step={1}
                onChange={(v) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), concurrencyLimit: v } }))} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => handleSave(modelKey)} disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-container text-primary-main hover:bg-primary-container transition-colors duration-150 disabled:opacity-50">
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存配置
            </button>
            <button onClick={() => handleReset(modelKey)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-normal border border-[var(--border-color)] bg-white dark:bg-neutral-900 text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150">
              <Trash2 className="w-3.5 h-3.5" />{t('ai.config.reset')}
            </button>
            {msg && (
              <span className={`text-sm ${msg.type === 'success' ? 'text-success-700 dark:text-success-600' : 'text-error-600 dark:text-error-700'}`}>
                {msg.text}
              </span>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ════════════════════════════════════════════════════════════
// 第 3 层：高级配置
// ════════════════════════════════════════════════════════════
function AdvancedConfigSection() {
  const { t } = useTranslation()
  const { data: statusesRaw } = useQuery<Record<string, ModelStatus | undefined>>({
    queryKey: ['ai-model-status'],
    queryFn: () => ModelClient.getModelStatus(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const statuses: Record<string, BackendModelStatus | undefined> = statusesRaw as Record<string, BackendModelStatus | undefined>;

  return (
    <section aria-label="高级配置" className="mb-4">
      <SectionHeader
        icon={<ShieldAlert className="w-5 h-5" />}
        iconBg="bg-warning-100 dark:bg-warning-300/25"
        iconColor="text-warning-600 dark:text-warning-700"
        title={t('ai.config.advancedConfig')}
        subtitle={t('ai.config.advancedConfigDesc')}
      />

      {/* Accordion 容器 — 与 StatCard 风格一致 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <Accordion type="single" collapsible className="w-full">
          {ADVANCED_MODELS.map(({ key }) => (
            <ModelConfigRow key={key} modelKey={key} status={statuses?.[key] as BackendModelStatus | undefined} />
          ))}
        </Accordion>
      </div>

      <CompactionAndEventSourcing />
    </section>
  );
}

// 从本地事件日志单例采集真实统计（无后端端点可用）
function collectLocalEventStats() {
  const events = chatEventLog.length;
  return {
    session_count: 1,          // 当前前端只有一个活动会话日志
    total_events: events,
    db_size_kb: 0,             // 事件日志不持久化，无存储体积
    persisted: false,
  };
}

// ─── Compaction 与事件溯源 ────────────────────────────────
function CompactionAndEventSourcing() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [metrics, setMetrics] = useState<{ metrics: { totalCompactions: number; avgCompactionTime: number; avgLockWaitTime: number; lockTimeoutCount: number }; recentAlerts: { message: string; timestamp: number }[]; health: { status: string } }>(() => {
    try { return getDashboardData(); } catch { return { metrics: { totalCompactions: 0, avgCompactionTime: 0, avgLockWaitTime: 0, lockTimeoutCount: 0 }, recentAlerts: [], health: { status: 'healthy' } }; }
  });
  useEffect(() => {
    const unsub = compactionMonitor.onMetricsUpdate(() => { try { setMetrics(getDashboardData()); } catch { /* 指标更新失败时静默 */ } });
    return unsub;
  }, []);

  const [esData, setEsData] = useState(() => collectLocalEventStats());
  // 后端没有 /agent/session/stats 端点。此前 fetch 该地址必然 404，catch 后静默
  // 填 0，面板会显示"会话数 0 / 事件总数 0 / 存储 0.0 KB"并标注"IndexedDB 持久化"
  // —— 三个数字全假。改为从本地事件日志单例采集真实值。
  useEffect(() => chatEventLog.onChange(() => setEsData(collectLocalEventStats())), []);

  return (
    <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      <button onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-accent-500" />
          <span>{t('ai.config.compactionTitle')}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-neutral-100 dark:bg-neutral-800 text-[var(--text-muted)]">{t('ai.config.advanced')}</span>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {show && (
        <div className="px-5 pb-5 pt-3 border-t border-[var(--border-color)] space-y-4">
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            AI Agent 工作流的底层技术指标：锁竞争、压缩决策、会话事件统计。仅供开发者调试参考。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compaction 指标 */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-accent-500" />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('ai.config.compactionMetrics')}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  metrics.health.status === 'healthy'
                    ? 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-700'
                    : 'bg-warning-100 dark:bg-warning-300/25 text-warning-700 dark:text-warning-700'
                }`}>
                  {metrics.health.status === 'healthy' ? '正常' : '告警'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: t('ai.config.totalCompactions'), value: metrics.metrics.totalCompactions, color: 'text-primary-700 dark:text-primary-700' },
                  { label: t('ai.config.avgCompactionTime'), value: `${Math.round(metrics.metrics.avgCompactionTime)}ms`, color: 'text-success-700 dark:text-success-600' },
                  { label: '锁等待', value: `${Math.round(metrics.metrics.avgLockWaitTime)}ms`, color: metrics.metrics.avgLockWaitTime > 500 ? 'text-error-600 dark:text-error-700' : 'text-warning-600 dark:text-warning-700' },
                  { label: '超时次数', value: metrics.metrics.lockTimeoutCount, color: metrics.metrics.lockTimeoutCount > 0 ? 'text-error-600 dark:text-error-700' : 'text-success-700 dark:text-success-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-white dark:bg-neutral-900 border border-[var(--border-color)]">
                    <div className={`text-base font-semibold tabular-nums leading-none ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              {metrics.recentAlerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] dark:text-[var(--text-muted)]">{t('ai.config.recentAlerts')}</div>
                  {metrics.recentAlerts.slice(0, 3).map((alert, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg bg-warning-50 dark:bg-warning-300/15 border border-warning-200 dark:border-warning-800/40 text-warning-700 dark:text-warning-700">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{alert.message}</span>
                      <span className="text-xs flex-shrink-0 text-[var(--text-muted)] dark:text-[var(--text-muted)]">
                        {new Date(alert.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 事件溯源 */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-3.5 h-3.5 text-secondary-500" />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('ai.config.eventSourceStats')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: '会话数', value: esData?.session_count ?? 0, color: 'text-primary-700 dark:text-primary-700' },
                  { label: '事件总数', value: esData?.total_events ?? 0, color: 'text-success-700 dark:text-success-600' },
                  { label: '存储大小', value: `${(esData?.db_size_kb ?? 0).toFixed(1)} KB`, color: 'text-accent-600 dark:text-accent-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-white dark:bg-neutral-900 border border-[var(--border-color)]">
                    <div className={`text-base font-semibold tabular-nums leading-none ${color}`}>{value}</div>
                    <div className="text-xs mt-1.5 leading-tight text-[var(--text-muted)]">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Zap className="w-3 h-3" />
                <span>
                  本会话内存统计 · Turn/Step 驱动
                  {esData?.persisted === false && (
                    <span className="ml-1 text-warning-600 dark:text-warning-700">（不持久化，刷新页面即重置）</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主组件
// ════════════════════════════════════════════════════════════
export function ConfigManagementPanel() {
  return (
    <div>
      <PageHeader />
      <ErrorBoundary moduleName="模型健康监控">
        <HealthDashboard />
      </ErrorBoundary>
      <ErrorBoundary moduleName="默认模型">
        <DefaultModelSection />
      </ErrorBoundary>
      <ErrorBoundary moduleName="高级配置">
        <AdvancedConfigSection />
      </ErrorBoundary>
    </div>
  );
}
