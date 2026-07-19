/**
 * AI智能助手中心 v3.0 - 专业级 UI/UX 优化版
 *
 * 基于 UI/UX Pro Max 专业规范的全面优化
 *
 * 优化内容:
 * - ✅ WCAG 2.1 AA 可访问性合规 (对比度 4.5:1+)
 * - ✅ 微交互与动画效果 (150-300ms, ease-out)
 * - ✅ 错误处理与用户反馈系统
 * - ✅ 性能优化与懒加载
 * - ✅ 响应式设计 (Mobile-first, 375/768/1024/1440)
 * - ✅ 键盘导航与焦点管理
 * - ✅ 统计卡片 4 列布局 + 交错入场动画
 * - ✅ Tab 分组导航 (核心/高级/管理)
 * - ✅ 渐变装饰头部 + 玻璃态搜索栏
 * - ✅ prefers-reduced-motion 支持
 */

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AIProvider } from '@/contexts/AIContext';
import { useQuery } from '@tanstack/react-query';
import { ModelClient } from '@/api/modelClient';
import type { ModelType } from '@/api/modelClient';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Skeleton as SkeletonComp } from '@/components/ui/Skeleton';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { ModelConfigPanel } from '@/components/ai/ModelConfigPanel';
import { ConfigManagementPanel } from '@/components/ai/ConfigManagementPanel';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { ChatTab } from '@/components/ai/features';
import {
  Search,
  Settings,
  Activity,
  MessageSquare,
  Sparkles,
  Shield,
  GitMerge,
  Bot,
  Dna,
  Database,
  GitBranch,
  Brain,
  Cpu,
  Wrench,
  ChevronDown,
  Zap,
  Beaker,
  FlaskConical,
  FileText,
} from 'lucide-react';
import { logger } from '@/utils/safeLogger';
import { useFeedbackSystem, useAccessibility, useResponsive } from '@/utils/uiuxEnhancement';
import { useAISummaryStats } from '@/hooks/useAISummaryStats';
import { useKeyboardSearch } from '@/hooks/useKeyboardSearch';
import { SearchModal } from '@/components/ai/SearchModal';

// 懒加载非首屏 Tab 组件
const GenerateTab = lazy(() => import('@/components/ai/features').then((m) => ({ default: m.GenerateTab })));
const SafetyTab = lazy(() => import('@/components/ai/features').then((m) => ({ default: m.SafetyTab })));
const SynergyTab = lazy(() => import('@/components/ai/features').then((m) => ({ default: m.SynergyTab })));
const TastePredictTab = lazy(() => import('@/components/ai/features').then((m) => ({ default: m.TastePredictTab })));
const StabilityPredictTab = lazy(() =>
  import('@/components/ai/features').then((m) => ({ default: m.StabilityPredictTab })),
);
const AdvancedPeptideAnalyzer = lazy(() =>
  import('@/components/ai').then((m) => ({ default: m.AdvancedPeptideAnalyzer })),
);
const AdvancedPeptideDesign = lazy(() => import('@/components/ai').then((m) => ({ default: m.AdvancedPeptideDesign })));
const ModelConfigPanelLazy = lazy(() =>
  import('@/components/ai/ModelConfigPanel').then((m) => ({ default: m.ModelConfigPanel })),
);
const KnowledgeBasePanel = lazy(() => import('@/components/ai/rag').then((m) => ({ default: m.KnowledgeBasePanel })));
const GeneticAlgorithmPanel = lazy(() =>
  import('@/components/ai/features/GeneticAlgorithmPanel').then((m) => ({ default: m.GeneticAlgorithmPanel })),
);
const MultiObjectivePanel = lazy(() =>
  import('@/components/ai/features/MultiObjectivePanel').then((m) => ({ default: m.MultiObjectivePanel })),
);
const FormulaInputWithOptimization = lazy(() =>
  import('@/components/ai/features/FormulaInputWithOptimization').then((m) => ({ default: m.FormulaInputWithOptimization })),
);

// Tab 加载骨架屏 — 使用 UI 库 Skeleton 组件
function TabLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <SkeletonComp width="25%" height="2rem" radius={8} />
      <SkeletonComp width="50%" height="1rem" radius={4} />
      <SkeletonComp width="100%" height="10rem" radius={8} />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonComp width="100%" height="6rem" radius={8} />
        <SkeletonComp width="100%" height="6rem" radius={8} />
      </div>
    </div>
  );
}

type AITab =
  | 'chat'
  | 'generate'
  | 'genetic'
  | 'safety'
  | 'synergy'
  | 'taste'
  | 'stability'
  | 'peptide-analyze'
  | 'peptide-design'
  | 'knowledge'
  | 'config';

export default function AIAssistantPage() {
  const [tab, setTab] = useState<AITab>('chat');
  const [selectedModel, setSelectedModel] = useState<ModelType>('formula_gpt');
  const [geneticMode, setGeneticMode] = useState<'single' | 'multi' | 'formula'>('single');

  // ===== 搜索快捷键 =====
  const { isOpen: searchOpen, toggle: toggleSearch, close: closeSearch } = useKeyboardSearch();

  // UI/UX Enhancement Hooks
  const { feedbacks, showSuccess, showError } = useFeedbackSystem();
  const { announceToScreenReader } = useAccessibility();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Data fetching with error handling (使用 useEffect 监听错误，符合 TanStack Query v5 规范)
  const {
    data: modelStatus,
    refetch: refetchModelStatus,
    error: modelStatusError,
    isError: isModelStatusError,
  } = useQuery({
    queryKey: ['ai-model-status'],
    queryFn: () => ModelClient.getModelStatus(),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
  });

  // 使用 useEffect 处理错误（替代已废弃的 onError）
  useEffect(() => {
    if (isModelStatusError && modelStatusError) {
      logger.error('获取模型状态失败:', modelStatusError);
      showError('模型状态加载失败', '请检查网络连接后重试');
    }
  }, [isModelStatusError, modelStatusError, showError]);

  // 安全访问 modelStatus.llm 属性，添加类型守卫
  const llmAvailable = modelStatus?.llm ? modelStatus.llm.status === 'active' : false;

  // ===== 真实统计数据 (useAISummaryStats hook) =====
  const {
    chatCount,
    generateCount,
    safetyChecks,
    synergyCount,
    tasteCount,
    stabilityCount,
    peptideAnalyzeCount,
    peptideDesignCount,
    knowledgeDocCount,
  } = useAISummaryStats();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    announceToScreenReader('AI智能助手中心页面已加载');
  }, [announceToScreenReader]);

  const handleModelChange = useCallback(
    (modelType: ModelType) => {
      setSelectedModel(modelType);
      showSuccess('模型已切换', `当前使用 ${modelType} 模型`);
    },
    [showSuccess],
  );

  const handleConfigChange = useCallback(
    async (_modelType: ModelType, _config?: any) => {
      try {
        await refetchModelStatus();
        showSuccess('配置更新成功', '模型配置已保存并生效');
      } catch (error) {
        logger.error('刷新模型状态失败:', error);
        showError('配置更新失败', '请检查配置项后重试');
      }
    },
    [refetchModelStatus, showSuccess, showError],
  );

  const handleTabChange = useCallback(
    (newTab: AITab) => {
      setTab(newTab);
      announceToScreenReader(`切换到${getTabLabel(newTab)}标签页`);
    },
    [announceToScreenReader],
  );

  const handleStatCardClick = useCallback(
    (tabTarget: AITab, label: string) => {
      setTab(tabTarget);
      announceToScreenReader(`打开${label}模块`);
    },
    [announceToScreenReader],
  );

  const getTabLabel = (tab: AITab): string => {
    const labels: Record<AITab, string> = {
      chat: '智能对话',
      generate: '配方生成',
      genetic: '遗传优化',
      safety: '安全检查',
      synergy: '协同分析',
      taste: '口感预测',
      stability: '稳定性评估',
      'peptide-analyze': '肽序列分析',
      'peptide-design': '肽设计优化',
      knowledge: '知识库',
      config: '配置管理',
    };
    return labels[tab];
  };

  const handleError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      logger.error('[AIAssistantPage] 发生错误:', { error: error.message, errorInfo });
      showError('页面发生错误', error.message);
    },
    [showError],
  );

  // Tab 分组定义 — 遵循 nav-hierarchy 规范：核心/高级/管理 分层
  const tabGroups = [
    {
      key: 'core',
      label: '核心功能',
      icon: Zap,
      tabs: [
        {
          value: 'chat' as AITab,
          label: '智能对话',
          icon: MessageSquare,
          badge: chatCount,
          badgeVariant: 'primary' as const,
        },
        {
          value: 'generate' as AITab,
          label: '配方生成',
          icon: Sparkles,
          badge: generateCount,
          badgeVariant: 'info' as const,
        },
        {
          value: 'safety' as AITab,
          label: '安全检查',
          icon: Shield,
          badge: safetyChecks,
          badgeVariant: 'warning' as const,
        },
        {
          value: 'synergy' as AITab,
          label: '协同分析',
          icon: GitMerge,
          badge: synergyCount,
          badgeVariant: 'success' as const,
        },
      ],
    },
    {
      key: 'advanced',
      label: '高级分析',
      icon: Beaker,
      tabs: [
        {
          value: 'taste' as AITab,
          label: '口感预测',
          icon: FlaskConical,
          badge: tasteCount,
          badgeVariant: 'neutral' as const,
        },
        { value: 'stability' as AITab, label: '稳定性评估', icon: Activity },
        { value: 'genetic' as AITab, label: '遗传优化', icon: Dna },
        {
          value: 'peptide-analyze' as AITab,
          label: '肽序列分析',
          icon: Cpu,
          badge: peptideAnalyzeCount,
          badgeVariant: 'info' as const,
        },
        {
          value: 'peptide-design' as AITab,
          label: '肽设计优化',
          icon: Dna,
          badge: peptideDesignCount,
          badgeVariant: 'success' as const,
        },
      ],
    },
    {
      key: 'manage',
      label: '管理',
      icon: Wrench,
      tabs: [
        { value: 'knowledge' as AITab, label: '知识库', icon: Database },
        { value: 'config' as AITab, label: '配置管理', icon: Settings },
      ],
    },
  ];

  // 统计卡片配置 — 4 列布局，增大触摸目标 (min 44×44px)
  const statsConfig = [
    {
      label: '智能对话',
      value: chatCount,
      icon: MessageSquare,
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-50 dark:bg-primary-950/40',
      border: 'border-primary-200 dark:border-primary-800/40',
      tab: 'chat' as const,
      accent: 'from-primary-500/20 to-primary-600/5',
    },
    {
      label: '配方生成',
      value: generateCount,
      icon: Sparkles,
      color: 'text-secondary-600 dark:text-secondary-400',
      bg: 'bg-secondary-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800/40',
      tab: 'generate' as const,
      accent: 'from-blue-500/20 to-blue-600/5',
    },
    {
      label: '安全检查',
      value: safetyChecks,
      icon: Shield,
      color: 'text-warning-600 dark:text-warning-400',
      bg: 'bg-warning-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/40',
      tab: 'safety' as const,
      accent: 'from-amber-500/20 to-amber-600/5',
    },
    {
      label: '协同分析',
      value: synergyCount,
      icon: GitMerge,
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/40',
      tab: 'synergy' as const,
      accent: 'from-emerald-500/20 to-emerald-600/5',
    },
    {
      label: '肽序列分析',
      value: peptideAnalyzeCount,
      icon: Dna,
      color: 'text-accent-600 dark:text-accent-400',
      bg: 'bg-accent-50 dark:bg-purple-950/40',
      border: 'border-purple-200 dark:border-purple-800/40',
      tab: 'peptide-analyze' as const,
      accent: 'from-purple-500/20 to-purple-600/5',
    },
    {
      label: '肽设计优化',
      value: peptideDesignCount,
      icon: Dna,
      color: 'text-pink-600 dark:text-pink-400',
      bg: 'bg-pink-50 dark:bg-pink-950/40',
      border: 'border-pink-200 dark:border-pink-800/40',
      tab: 'peptide-design' as const,
      accent: 'from-pink-500/20 to-pink-600/5',
    },
    {
      label: '模型状态',
      value: llmAvailable ? '在线' : '离线',
      icon: Bot,
      color: llmAvailable ? 'text-primary-600 dark:text-primary-400' : 'text-error-600 dark:text-error-400',
      bg: llmAvailable ? 'bg-primary-50 dark:bg-emerald-950/40' : 'bg-error-50 dark:bg-red-950/40',
      border: llmAvailable ? 'border-emerald-200 dark:border-emerald-800/40' : 'border-red-200 dark:border-red-800/40',
      tab: 'config' as const,
      accent: llmAvailable ? 'from-emerald-500/20 to-emerald-600/5' : 'from-red-500/20 to-red-600/5',
    },
    {
      label: '知识库',
      value: knowledgeDocCount,
      icon: Database,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/40',
      border: 'border-cyan-200 dark:border-cyan-800/40',
      tab: 'knowledge' as const,
      accent: 'from-cyan-500/20 to-cyan-600/5',
    },
  ];

  return (
    <ErrorBoundary onError={handleError}>
      {/* Toast Notification Container — 使用独立容器组件 */}
      <ToastContainer />

      <AIProvider>
        <main
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter"
          role="main"
          aria-label="AI智能助手中心主内容区"
        >
          {/* ── 页面头部 — 渐变装饰 + 图标增强视觉冲击力 ── */}
          <header className="relative overflow-hidden rounded-2xl">
            {/* 渐变装饰背景 */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-accent-600/8 to-blue-600/10 dark:from-primary-500/15 dark:via-accent-500/10 dark:to-blue-500/15"
              aria-hidden="true"
            />
            <div
              className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-primary-400/20 to-accent-400/20 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-tr from-blue-400/15 to-primary-400/15 blur-xl"
              aria-hidden="true"
            />

            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-5 sm:px-8 sm:py-6">
              <div className="flex items-start gap-4">
                {/* 品牌图标 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                  <Brain className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="h1 text-neutral-900 dark:text-white">
                    AI 智能助手中心
                  </h1>
                  <p className="mt-1.5 text-sm sm:text-base text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    智能对话 · 配方生成 · 安全检查 · 协同分析 · 口感预测 · 稳定性评估
                  </p>
                </div>
              </div>
              {/* 模型状态指示器 */}
              <div
                className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                ${
                  llmAvailable
                    ? 'bg-primary-50 text-primary-700 dark:bg-emerald-950/50 dark:text-primary-300 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-error-50 text-error-700 dark:bg-red-950/50 dark:text-error-300 border border-red-200 dark:border-red-800/50'
                }
              `}
              >
                <span
                  className={`
                  w-2 h-2 rounded-full animate-pulse
                  ${llmAvailable ? 'bg-primary-500' : 'bg-error-500'}
                `}
                  aria-hidden="true"
                />
                {llmAvailable ? '模型在线' : '模型离线'}
              </div>
            </div>
          </header>

          {/* ── 搜索栏 — 玻璃态效果 + 增强视觉层级 ── */}
          <section aria-label="全局搜索" className="relative">
            <div className="relative glass-card !p-0 overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-blue-50/50 dark:from-primary-950/30 dark:via-transparent dark:to-blue-950/30"
                aria-hidden="true"
              />
              <div className="relative flex items-center">
                <Search
                  className="ml-4 w-5 h-5 text-neutral-400 dark:text-neutral-500 pointer-events-none flex-shrink-0"
                  aria-hidden="true"
                />
                <label htmlFor="ai-global-search" className="sr-only">
                  搜索配方、药材、分析工具
                </label>
                <input
                  id="ai-global-search"
                  type="search"
                  placeholder="搜索配方、药材、分析工具..."
                  className="w-full pl-3 pr-20 py-3.5 bg-transparent text-base focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  aria-label="搜索配方、药材、分析工具，按Ctrl+K快速访问"
                />
                <kbd
                  className="mr-3 hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-md border border-neutral-200 dark:border-neutral-700"
                  aria-label="快捷键 Ctrl+K"
                >
                  Ctrl+K
                </kbd>
              </div>
            </div>
          </section>

          {/* ── 统计卡片 — 4 列布局 + 交错入场动画 ── */}
          <section aria-label="功能模块统计" className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {statsConfig.map(({ label, value, icon: Icon, color, bg, border, tab: tabTarget, accent }, index) => (
              <button
                key={label}
                onClick={() => handleStatCardClick(tabTarget, label)}
                className={`
                  group relative overflow-hidden
                  card p-4 sm:p-5 text-left ${bg} ${border} border
                  hover:shadow-lg hover:-translate-y-0.5
                  active:scale-[0.97]
                  transition-all duration-200 ease-out
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                  min-h-[88px] sm:min-h-[100px] flex items-center gap-3 sm:gap-4
                  ${tab === tabTarget ? 'ring-2 ring-primary-500 shadow-md' : ''}
                  animate-[statCardEnter_0.4s_ease-out_both]
                `}
                style={{ animationDelay: `${index * 50}ms` }}
                aria-label={`${label}: ${typeof value === 'number' ? value.toLocaleString() : value}`}
                aria-current={tab === tabTarget ? 'page' : undefined}
              >
                {/* 渐变装饰角标 */}
                <div
                  className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${accent} rounded-bl-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-200`}
                  aria-hidden="true"
                />

                <div
                  className={`
                  relative flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl
                  flex items-center justify-center
                  bg-white/70 dark:bg-neutral-800/60
                  shadow-sm group-hover:shadow-md
                  transition-shadow duration-200
                `}
                >
                  <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${color}`} aria-hidden="true" />
                </div>
                <div className="relative min-w-0">
                  <div
                    className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tabular-nums"
                    aria-live="polite"
                  >
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{label}</div>
                </div>
              </button>
            ))}
          </section>

          {/* ── Tab 导航 — 分组布局 (核心/高级/管理) ── */}
          <Tabs value={tab} onValueChange={(v) => handleTabChange(v as AITab)}>
            <nav aria-label="AI助手功能标签导航" className="space-y-3">
              {tabGroups.map((group) => {
                const GroupIcon = group.icon;
                const isActive = group.tabs.some((t) => t.value === tab);
                return (
                  <div
                    key={group.key}
                    className={`
                    rounded-xl border transition-colors duration-200
                    ${
                      isActive
                        ? 'border-primary-200 dark:border-primary-800/50 bg-primary-50/30 dark:bg-primary-950/20'
                        : 'border-neutral-200 dark:border-neutral-700/50 bg-slate-50/50 dark:bg-neutral-800/20'
                    }
                  `}
                  >
                    {/* 分组标题 */}
                    <div
                      className={`
                      flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider
                      ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-400 dark:text-neutral-500'}
                    `}
                    >
                      <GroupIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      {group.label}
                    </div>
                    {/* 分组内 Tab 按钮 */}
                    <TabsList
                      role="tablist"
                      aria-label={`${group.label}标签`}
                      className="px-2 pb-2 border-0 bg-transparent shadow-none flex-wrap"
                    >
                      {group.tabs.map((t) => {
                        const TabIcon = t.icon;
                        return (
                          <TabsTrigger
                            key={t.value}
                            value={t.value}
                            role="tab"
                            aria-selected={tab === t.value}
                            aria-controls={`panel-${t.value}`}
                          >
                            <TabIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            {t.label}
                            {t.badge != null && t.badge > 0 && (
                              <Badge variant={t.badgeVariant} size="sm" className="ml-1.5" aria-label={`${t.badge}`}>
                                {t.badge}
                              </Badge>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>
                );
              })}
            </nav>

            {/* Tab Panels - Enhanced with Error Boundaries and Lazy Loading */}
            <TabsContent value="chat" id="panel-chat" role="tabpanel" aria-labelledby="tab-chat">
              <div>
                <ChatTab />
              </div>
            </TabsContent>

            <TabsContent value="generate" id="panel-generate" role="tabpanel" aria-labelledby="tab-generate">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <GenerateTab llmAvailable={llmAvailable} modelStatus={modelStatus || {}} />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="genetic" id="panel-genetic" role="tabpanel" aria-labelledby="tab-genetic">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  {/* 嵌套模式切换：单目标 GA / 多目标 NSGA-II */}
                  <div className="mb-4">
                    <Tabs
                      value={geneticMode}
                      onValueChange={(v) => {
                        setGeneticMode(v as 'single' | 'multi' | 'formula');
                        if (v === 'formula') {
                          announceToScreenReader('切换到配方优化模式');
                        } else {
                          announceToScreenReader(v === 'multi' ? '切换到多目标优化模式' : '切换到单目标遗传算法模式');
                        }
                      }}
                    >
                      <TabsList className="mb-4" role="tablist" aria-label="遗传优化模式切换">
                        <TabsTrigger value="single" role="tab" aria-selected={geneticMode === 'single'}>
                          <Dna className="w-3.5 h-3.5 mr-1.5 text-accent-500" />
                          单目标 (GA)
                        </TabsTrigger>
                        <TabsTrigger value="multi" role="tab" aria-selected={geneticMode === 'multi'}>
                          <GitBranch className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                          多目标 (NSGA-II)
                        </TabsTrigger>
                        <TabsTrigger value="formula" role="tab" aria-selected={geneticMode === 'formula'}>
                          <FileText className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                          配方优化
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="single">
                        <GeneticAlgorithmPanel />
                      </TabsContent>
                      <TabsContent value="multi">
                        <MultiObjectivePanel />
                      </TabsContent>
                      <TabsContent value="formula">
                        <Suspense fallback={<TabLoadingSkeleton />}>
                          <FormulaInputWithOptimization />
                        </Suspense>
                      </TabsContent>
                    </Tabs>
                  </div>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="safety" id="panel-safety" role="tabpanel" aria-labelledby="tab-safety">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <SafetyTab />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="synergy" id="panel-synergy" role="tabpanel" aria-labelledby="tab-synergy">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <SynergyTab />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="taste" id="panel-taste" role="tabpanel" aria-labelledby="tab-taste">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <TastePredictTab />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="stability" id="panel-stability" role="tabpanel" aria-labelledby="tab-stability">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <StabilityPredictTab />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent
              value="peptide-analyze"
              id="panel-peptide-analyze"
              role="tabpanel"
              aria-labelledby="tab-peptide-analyze"
            >
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <AdvancedPeptideAnalyzer />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent
              value="peptide-design"
              id="panel-peptide-design"
              role="tabpanel"
              aria-labelledby="tab-peptide-design"
            >
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <AdvancedPeptideDesign />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" id="panel-knowledge" role="tabpanel" aria-labelledby="tab-knowledge">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <KnowledgeBasePanel isEmbedded />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="config" id="panel-config" role="tabpanel" aria-labelledby="tab-config">
              <div>
                <ConfigManagementPanel />
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* 全局搜索模态框 */}
        <SearchModal isOpen={searchOpen} onClose={closeSearch} />
      </AIProvider>
    </ErrorBoundary>
  );
}
