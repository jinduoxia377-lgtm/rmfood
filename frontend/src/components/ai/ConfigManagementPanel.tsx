/**
 * ConfigManagementPanel v8.0 — 专业字体层级升级（与 AI 主页面完全同步）
 *
 * 字体层级规范（严格遵循 Apple 设计体系 400/600/700 阶梯，禁用 500）：
 *   L1 Panel标题:  text-lg (18px) / font-semibold (600)
 *   L2 区块标题:   text-sm (14px) / font-semibold (600)
 *   L3 卡片内标题: text-sm (14px) / font-semibold (600)
 *   L4 数据标签:   text-xs (12px) / font-semibold (600)
 *   L5 数值展示:   text-base (16px) / font-semibold (600)
 *   L6 辅助说明:   text-xs (12px) / font-normal (400)
 *
 * 间距规范: gap-3 (12px) / p-4 (16px) — 紧凑 SaaS 仪表盘风格
 */
import { useState, useEffect, useCallback } from 'react';
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
import type { ModelStatus } from '@/api/modelClient';
import { ConfigManager } from '@/utils/configManager';
import type { ModelConfig } from '@/utils/configManager';
import { useModelHealthPolling } from './features/hooks/useModelHealthSSE';
import { compactionMonitor, getDashboardData } from './features/utils/compactionMonitor';
import { ErrorBoundary } from './features/components/ErrorBoundary';

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
const BUSINESS_MODELS: { value: ModelType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'formula_gpt',   label: 'FormulaGPT',  desc: '基于药食同源规则的配方推荐', icon: <Zap className="w-[18px] h-[18px]" /> },
  { value: 'synergy_net',   label: 'SynergyNet',  desc: '药材配伍协同效应分析',       icon: <Activity className="w-[18px] h-[18px]" /> },
  { value: 'safety_checker',label: 'SafetyChecker',desc: '配方安全性自动审查',        icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
  { value: 'taste_predictor',label: 'TastePredictor',desc: '风味特征智能预测',         icon: <TrendingUp className="w-[18px] h-[18px]" /> },
];

const ADVANCED_MODELS: { key: ModelType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'llm',           label: 'LLM',            desc: '大语言模型 API',           icon: <Zap className="w-[18px] h-[18px]" /> },
  { key: 'formula_gpt',   label: 'FormulaGPT',     desc: '配方生成引擎',             icon: <Cpu className="w-[18px] h-[18px]" /> },
  { key: 'synergy_net',   label: 'SynergyNet',     desc: '协同分析模型',             icon: <Database className="w-[18px] h-[18px]" /> },
  { key: 'safety_checker',label: 'SafetyChecker',  desc: '安全检测规则',             icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
  { key: 'taste_predictor',label: 'TastePredictor',desc: '口感预测器',               icon: <TrendingUp className="w-[18px] h-[18px]" /> },
  { key: 'stability_model',label: 'StabilityModel',desc: '稳定性模拟',               icon: <Lock className="w-[18px] h-[18px]" /> },
  { key: 'peptide_scorer', label: 'PeptideScorer', desc: '肽序列评分',               icon: <FileText className="w-[18px] h-[18px]" /> },
];

const SUB_MODELS = [
  { key: 'formula_gpt',   label: 'FormulaGPT',  desc: '配方生成' },
  { key: 'synergy_net',   label: 'SynergyNet',  desc: '协同分析' },
  { key: 'safety_checker',label: 'SafetyChecker',desc: '安全检查' },
  { key: 'taste_predictor',label: 'TastePredictor',desc: '口感预测' },
  { key: 'stability_model',label: 'StabilityModel',desc: '稳定性预测' },
  { key: 'peptide_scorer', label: 'PeptideScorer',desc: '肽序列评分' },
];

// ════════════════════════════════════════════════════════════
// 页面标题区（与 AIAssistantPage banner h2 风格一致: text-xl font-semibold）
// ════════════════════════════════════════════════════════════
function PageHeader() {
  return (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-200 dark:border-neutral-700">
      <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
        <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <h1 className="text-lg font-semibold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
          配置管理
        </h1>
        <p className="text-sm font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>
          管理 AI 模型连接、参数和技术指标
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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm font-normal mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 第 1 层：模型健康监控
// ════════════════════════════════════════════════════════════
function HealthDashboard() {
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

  // 组件挂载时初始化配置
  useEffect(() => {
    try {
      const cfg = ConfigManager.getModelConfig('llm');
      setLlmKey(cfg.apiKey || '');
      const storedProvider = localStorage.getItem('rmfood_llm_provider') || 'deepseek';
      setLlmProvider(storedProvider);
      const preset = LLM_PRESETS[storedProvider];
      setLlmBaseUrl(preset?.baseUrl || '');
      const storedModel = localStorage.getItem('rmfood_llm_model') || '';
      if (storedModel) setLlmModel(storedModel);
    } catch {}
  }, []);

  // 面板打开时：初始化 baseUrl / apiKey / 模型列表
  useEffect(() => {
    if (showLlmQuick) {
      try {
        const cfg = ConfigManager.getModelConfig('llm');
        setLlmKey(cfg.apiKey || '');
        const preset = LLM_PRESETS[llmProvider];
        setLlmBaseUrl(preset?.baseUrl || '');
      } catch {}
      fetchLlmModels(llmProvider, llmKey, llmBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLlmQuick]);

  // Provider 或自定义 baseUrl 变化时重新拉取模型
  useEffect(() => {
    if (showLlmQuick) {
      fetchLlmModels(llmProvider, llmKey, llmBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmProvider, llmBaseUrl]);

  const handleLlmSave = async () => {
    if (!llmKey.trim() || llmKey.trim().length < 20) {
      setLlmMsg({ type: 'error', text: 'API 密钥长度不足（需 20+ 字符）' }); return;
    }
    setLlmSaving(true); setLlmMsg(null);
    try {
      const effectiveBaseUrl = llmBaseUrl.trim() || LLM_PRESETS[llmProvider]?.baseUrl || 'https://api.deepseek.com/v1';
      
      // Step 1: 同步到后端数据库
      const backendSuccess = await ConfigManager.syncToBackend('llm', {
        apiKey: llmKey.trim(),
        baseUrl: effectiveBaseUrl,
        timeout: 60000,
        maxRetries: 3,
        concurrencyLimit: 3,
        model: llmModel,
        provider: llmProvider,
      });
      
      // Step 2: 本地持久化
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
      
      if (backendSuccess) {
        setLlmMsg({ type: 'success', text: '配置已保存到服务器和本地缓存' });
      } else {
        setLlmMsg({ type: 'error', text: '配置已保存到本地缓存，服务器保存失败' });
      }
      
      window.dispatchEvent(new Event('rmfood-config-sync'));
    } catch (error) {
      setLlmMsg({ type: 'error', text: '保存失败，请检查网络或后端服务' });
    } finally {
      setLlmSaving(false);
    }
  };


  return (
    <section aria-label="模型健康监控" className="mb-4">
      <SectionHeader
        icon={<Activity className="w-5 h-5" />}
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        iconColor="text-emerald-600 dark:text-emerald-400"
        title="模型健康监控"
        subtitle={`实时状态 · 自动刷新 · ${isConnected ? 'SSE 已连接' : '轮询模式'}`}
        action={
          <>
            {lastUpdated && (
              <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => queryClient.refetchQueries({ queryKey: ['ai-model-status'] })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
          </>
        }
      />

      {/* LLM 主卡 + 子模型列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* ── LLM 主卡（与 StatCard 风格一致: rounded-xl / shadow-sm / border-neutral-200 / p-5 pt-4 pb-5）── */}
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
          {/* 状态色带 */}
          <div className={`h-[3px] w-full ${isLlmActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div className="px-5 pt-4 pb-5">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isLlmActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                  {isLlmActive
                    ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    : <CircleAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  }
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>LLM 大语言模型</div>
                  <div className="text-sm font-normal mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {llmStatus?.provider || '未配置'} · {llmStatus?.model || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isLlmActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLlmActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isLlmActive ? '运行中' : '未配置'}
                </span>
                <button
                  onClick={() => setShowLlmQuick(!showLlmQuick)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
                >
                  {showLlmQuick ? <ChevronDown className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                  {showLlmQuick ? '收起' : '配置'}
                </button>
              </div>
            </div>

            {/* 快捷配置面板 */}
            {showLlmQuick && (
              <div className="mb-4 p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-400">
                  <Key className="w-3.5 h-3.5" />LLM API 配置
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">Provider</label>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Object.entries(LLM_PRESETS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">Model</label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      disabled={llmFetching}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {llmModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      {llmFetching && <option value="">加载中...</option>}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">请求地址</label>
                  <Input
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    placeholder="https://api.xxx.com/v1"
                    className="h-10 font-mono text-xs"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    留空则使用 Provider 默认地址
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">API 密钥</label>
                  <Input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-10"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    获取密钥: {LLM_PRESETS[llmProvider]?.keyHint}
                  </p>
                </div>
                {llmMsg && (
                  <p className={`text-sm ${llmMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {llmMsg.text}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowLlmQuick(false); setLlmMsg(null); }}
                    className="px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleLlmSave}
                    disabled={llmSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {llmSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    保存配置
                  </button>
                </div>
              </div>
            )}

            {/* 指标网格 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Server className="w-3.5 h-3.5" />, label: 'Provider', value: llmStatus?.provider || '—' },
                { icon: <Cpu className="w-3.5 h-3.5" />, label: 'Model', value: llmStatus?.model || '—' },
                { icon: <Clock className="w-3.5 h-3.5" />, label: '延迟', value: (() => { const h = healthData?.[0]; return h ? `${h.latency_ms}ms` : '—'; })() },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: '成功率', value: (() => { const h = healthData?.[0]; return h ? `${h.success_rate}%` : '—'; })() },
              ].map(({ icon, label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                    {icon}{label}
                  </div>
                  <div className="text-base font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* 备注 */}
            {llmStatus?.note && (
              <div className="mt-3 flex items-start gap-2.5 text-sm rounded-xl px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" style={{ color: 'var(--text-secondary)' }}>
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-400" />
                {llmStatus.note}
              </div>
            )}
            {!isLlmActive && llmStatus?.suggestion && (
              <div className="mt-3 flex items-start gap-2.5 text-sm rounded-xl px-3 py-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40" style={{ color: '#92400e' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {llmStatus.suggestion}
              </div>
            )}
          </div>
        </div>

        {/* ── 子模型状态列表 ── */}
        <div className="space-y-2">
          {SUB_MODELS.map(({ key, label, desc }) => {
            const s = statuses?.[key] as BackendModelStatus | undefined;
            const isActive = s?.status === 'active';
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all duration-150">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{label}</div>
                  <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {isActive ? '在线' : '规则模式'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 健康进度条 */}
      {healthData?.length > 0 && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>模型响应质量</span>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {isConnected
                ? <><Wifi className="w-3.5 h-3.5 text-emerald-500" /><span>SSE 实时</span></>
                : <><WifiOff className="w-3.5 h-3.5" /><span>轮询</span></>
              }
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {healthData.map((m) => (
              <div key={m.model}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.model}</span>
                  <span className={`text-sm font-semibold tabular-nums ${
                    m.success_rate >= 98 ? 'text-emerald-600 dark:text-emerald-400'
                    : m.success_rate >= 95 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>{m.success_rate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      m.success_rate >= 98 ? 'bg-emerald-500'
                      : m.success_rate >= 95 ? 'bg-amber-500'
                      : 'bg-red-500'
                    }`}
                    style={{ width: `${m.success_rate}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{m.latency_ms}ms</span>
                  <span>{m.error_count} 次错误</span>
                  <span>{m.uptime_percentage}% 在线</span>
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
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<ModelType>(() => {
    try { return (localStorage.getItem('rmfood_default_model') as ModelType) || 'formula_gpt'; } catch { return 'formula_gpt'; }
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleModelSelect = async (modelType: ModelType) => {
    setSelectedModel(modelType);
    setSaving(true); setSaveMsg(null);
    try {
      localStorage.setItem('rmfood_default_model', modelType);
      setSaveMsg(`${BUSINESS_MODELS.find((o: typeof BUSINESS_MODELS[0]) => o.value === modelType)?.label} 已设为默认模型`);
      await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
    } catch { setSaveMsg('保存失败，请重试'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(null), 3000); }
  };

  return (
    <section aria-label="默认模型选择" className="mb-4">
      <SectionHeader
        icon={<Settings className="w-5 h-5" />}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        title="默认模型"
        subtitle="选择各业务场景使用的默认 AI 模型"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ModelSelector modelType={selectedModel} onModelChange={handleModelSelect} onParamsChange={() => {}} />
          {saveMsg && (
            <div className="mt-3 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {saveMsg}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {BUSINESS_MODELS.map(({ value, label, desc, icon }: typeof BUSINESS_MODELS[0]) => {
            const isSelected = selectedModel === value;
            return (
              <button key={value} onClick={() => handleModelSelect(value)} disabled={saving}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold leading-none ${isSelected ? 'text-primary-700 dark:text-primary-300' : ''}`} style={{ color: isSelected ? 'var(--color-primary-700)' : 'var(--text-primary)' }}>{label}</div>
                    <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{desc}</div>
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
      setConfigs(ConfigManager.getModelConfigs());
      const llmCfg = ConfigManager.getModelConfig('llm');
      if (llmCfg?.apiKey) {
        const sp = localStorage.getItem('rmfood_llm_provider');
        if (sp && LLM_PRESETS[sp]) setLlmProvider(sp);
        const sm = localStorage.getItem('rmfood_llm_model');
        if (sm) setLlmModel(sm);
      }
    } catch {}
  }, []);

  // Fix 4: 监听 localStorage 变更，同步 configs state
  const syncFromStorage = useCallback(() => {
    try {
      const latest = ConfigManager.getModelConfigs();
      setConfigs(latest);
      const llmCfg = latest.llm;
      const sp = localStorage.getItem('rmfood_llm_provider');
      if (sp && LLM_PRESETS[sp]) setLlmProvider(sp);
      const sm = localStorage.getItem('rmfood_llm_model');
      if (sm) setLlmModel(sm);
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('rmfood-config-sync', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('rmfood-config-sync', syncFromStorage);
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
      if (key === 'llm') {
        const effectiveBaseUrl = (config.baseUrl || '').trim() || LLM_PRESETS[llmProvider]?.baseUrl || '';
        backendSuccess = await ConfigManager.syncToBackend('llm', {
          apiKey: config.apiKey || '',
          baseUrl: effectiveBaseUrl,
          timeout: config.timeout || 60000,
          maxRetries: config.maxRetries || 3,
          concurrencyLimit: config.concurrencyLimit || 3,
          model: llmModel,
          provider: llmProvider,
        });
      }
      
      await queryClient.refetchQueries({ queryKey: ['ai-model-status'] });
      syncFromStorage();
      window.dispatchEvent(new Event('rmfood-config-sync'));
      
      if (backendSuccess) {
        setMsg({ type: 'success', text: '配置已保存到服务器和本地缓存' });
      } else {
        setMsg({ type: 'error', text: '配置已保存到本地缓存，服务器保存失败' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: '保存失败，请检查网络或后端服务' });
      console.error('[ConfigManagementPanel] handleSave error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (key: ModelType) => {
    try { ConfigManager.resetModelConfig(key); setConfigs(ConfigManager.getModelConfigs()); setMsg({ type: 'success', text: '已重置' }); } catch {}
  };

  const isActive = status?.status === 'active';
  const isUnconfigured = status?.status === 'unconfigured';
  const hasKey = !!configs[modelKey]?.apiKey;
  const modelInfo = ADVANCED_MODELS.find(m => m.key === modelKey)!;

  return (
    <AccordionItem value={modelKey} className="border-b border-neutral-200 dark:border-neutral-700 last:border-0">
      <AccordionTrigger
        icon={<ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />}
        className="py-3 hover:no-underline"
      >
        <div className="flex items-center gap-4 w-full">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : isUnconfigured ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isActive ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : isUnconfigured ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-neutral-100 dark:bg-neutral-800'
          }`}>
            <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : isUnconfigured ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500'}>
              {modelInfo.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{modelInfo.label}</div>
            <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{modelInfo.desc}</div>
          </div>
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {modelKey === 'llm' && (
              <span className="text-xs flex items-center gap-1" style={{ color: hasKey ? 'var(--color-success)' : 'var(--text-muted)' }}>
                <Key className="w-3 h-3" />{hasKey ? '已配置' : '未配置'}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : isUnconfigured ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}>
              {isActive ? '活跃' : isUnconfigured ? '未配置' : '规则模式'}
            </span>
            {configs[modelKey]?.baseUrl && (
              <span className="text-xs font-mono hidden lg:inline" style={{ color: 'var(--text-muted)' }}>
                {configs[modelKey]!.baseUrl!.split('/')[2]}
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-5 pb-4">
        <div className="space-y-4 pt-3">
          {modelKey === 'llm' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">Provider</label>
                <select value={llmProvider} onChange={e => handleProviderChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500">
                  {Object.entries(LLM_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">Model</label>
                <select value={llmModel} onChange={e => setLlmModel(e.target.value)} disabled={llmFetching}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50">
                  {llmModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  {llmFetching && <option value="">加载中...</option>}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                API 密钥 {modelKey === 'llm' ? '' : '(可选)'}
              </label>
              {configs[modelKey]?.apiKey && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {modelKey === 'llm' && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                获取密钥: {LLM_PRESETS[llmProvider]?.keyHint}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">API 基础 URL</label>
            <Input
              value={configs[modelKey]?.baseUrl || (modelKey === 'llm' ? LLM_PRESETS[llmProvider]?.baseUrl || '' : '')}
              onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), baseUrl: e.target.value } }))}
              placeholder="https://api.example.com/v1"
              className="h-10 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">超时 (ms)</label>
              <Input type="number" value={configs[modelKey]?.timeout || 30000}
                onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), timeout: parseInt(e.target.value) || 30000 } }))}
                min={5000} max={60000} step={1000}
                className="h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">最大重试</label>
              <Input type="number" value={configs[modelKey]?.maxRetries ?? 3}
                onChange={(e) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), maxRetries: parseInt(e.target.value) || 3 } }))}
                min={0} max={10}
                className="h-10 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block">
                并发限制: {configs[modelKey]?.concurrencyLimit ?? 3}
              </label>
              <Slider value={configs[modelKey]?.concurrencyLimit ?? 3} min={1} max={10} step={1}
                onChange={(v) => setConfigs(prev => ({ ...prev, [modelKey]: { ...(prev[modelKey] || ConfigManager.getDefaultModelConfig()), concurrencyLimit: v } }))} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => handleSave(modelKey)} disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50">
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存配置
            </button>
            <button onClick={() => handleReset(modelKey)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />重置
            </button>
            {msg && (
              <span className={`text-sm ${msg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
        iconBg="bg-amber-100 dark:bg-amber-900/30"
        iconColor="text-amber-600 dark:text-amber-400"
        title="高级配置"
        subtitle="API 密钥、连接参数和技术指标"
      />

      {/* Accordion 容器 — 与 StatCard 风格一致 */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
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

// ─── Compaction 与事件溯源 ────────────────────────────────
function CompactionAndEventSourcing() {
  const [show, setShow] = useState(false);
  const [metrics, setMetrics] = useState<{ metrics: { totalCompactions: number; avgCompactionTime: number; avgLockWaitTime: number; lockTimeoutCount: number }; recentAlerts: { message: string; timestamp: number }[]; health: { status: string } }>(() => {
    try { return getDashboardData(); } catch { return { metrics: { totalCompactions: 0, avgCompactionTime: 0, avgLockWaitTime: 0, lockTimeoutCount: 0 }, recentAlerts: [], health: { status: 'healthy' } }; }
  });
  useEffect(() => {
    const unsub = compactionMonitor.onMetricsUpdate(() => { try { setMetrics(getDashboardData()); } catch {} });
    return unsub;
  }, []);

  const [esData, setEsData] = useState({ session_count: 0, total_events: 0, db_size_kb: 0 });
  const [esLoading, setEsLoading] = useState(false);
  useEffect(() => {
    setEsLoading(true);
    fetch('/api/v1/agent/session/stats')
      .then(r => r.ok ? r.json() : Promise.reject('加载失败'))
      .then(data => setEsData(data as { session_count: number; total_events: number; db_size_kb: number }))
      .catch(() => setEsData({ session_count: 0, total_events: 0, db_size_kb: 0 }))
      .finally(() => setEsLoading(false));
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      <button onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-purple-500" />
          <span>Compaction 与事件溯源</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">高级</span>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>
      {show && (
        <div className="px-5 pb-5 pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-4">
          <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            AI Agent 工作流的底层技术指标：锁竞争、压缩决策、会话事件统计。仅供开发者调试参考。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compaction 指标 */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Compaction 指标</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  metrics.health.status === 'healthy'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {metrics.health.status === 'healthy' ? '正常' : '告警'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '总压缩次数', value: metrics.metrics.totalCompactions, color: 'text-primary-600 dark:text-primary-400' },
                  { label: '平均耗时', value: `${Math.round(metrics.metrics.avgCompactionTime)}ms`, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: '锁等待', value: `${Math.round(metrics.metrics.avgLockWaitTime)}ms`, color: metrics.metrics.avgLockWaitTime > 500 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400' },
                  { label: '超时次数', value: metrics.metrics.lockTimeoutCount, color: metrics.metrics.lockTimeoutCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                    <div className={`text-lg font-semibold tabular-nums leading-none ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              {metrics.recentAlerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">最近告警</div>
                  {metrics.recentAlerts.slice(0, 3).map((alert, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{alert.message}</span>
                      <span className="text-xs flex-shrink-0 text-neutral-400 dark:text-neutral-500">
                        {new Date(alert.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 事件溯源 */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>事件溯源统计</span>
              </div>
              {esLoading ? (
                <div className="text-sm text-neutral-500 dark:text-neutral-400">加载中…</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '会话数', value: esData?.session_count ?? 0, color: 'text-primary-600 dark:text-primary-400' },
                      { label: '事件总数', value: esData?.total_events ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: '存储大小', value: `${(esData?.db_size_kb ?? 0).toFixed(1)} KB`, color: 'text-purple-600 dark:text-purple-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                        <div className={`text-lg font-semibold tabular-nums leading-none ${color}`}>{value}</div>
                        <div className="text-xs mt-1.5 leading-tight text-neutral-500 dark:text-neutral-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <Zap className="w-3 h-3" />
                    <span>IndexedDB 持久化 · Turn/Step 驱动</span>
                  </div>
                </>
              )}
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
