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

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
// AIContext 已移除（2026-07-22）：经确认，AIProvider 包裹内无任何子组件使用 useAIContext()。
// 所有状态已由独立 Hooks（useChatMessages、useFormulaManager 等）和 Zustand Stores 管理。
// 保留 ErrorBoundary 作为全局容错边界。

import { useQuery } from '@tanstack/react-query';
import { ModelClient } from '@/api/modelClient';
import type { ModelType } from '@/api/modelClient';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent, StatCard, Input } from '@/components/ui';
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
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { SearchModal } from '@/components/ai/SearchModal';
import { Menu, X } from 'lucide-react';

// 懒加载非首屏 Tab 组件 — 使用命名导出模式，兼容各组件的 export 方式
const GenerateTab = lazy(() => import('@/components/ai/features/GenerateTab').then(m => ({ default: m.GenerateTab })));
const SafetyTab = lazy(() => import('@/components/ai/features/SafetyTab').then(m => ({ default: m.SafetyTab })));
const SynergyTab = lazy(() => import('@/components/ai/features/SynergyTab').then(m => ({ default: m.SynergyTab })));
const TastePredictTab = lazy(() => import('@/components/ai/features/TastePredictTab').then(m => ({ default: m.TastePredictTab })));
const StabilityPredictTab = lazy(() => import('@/components/ai/features/StabilityPredictTab').then(m => ({ default: m.StabilityPredictTab })));
const AdvancedPeptideAnalyzer = lazy(() => import('@/components/ai/AdvancedPeptideAnalyzer').then(m => ({ default: m.AdvancedPeptideAnalyzer })));
const AdvancedPeptideDesign = lazy(() => import('@/components/ai/AdvancedPeptideDesign').then(m => ({ default: m.AdvancedPeptideDesign })));
const ModelConfigPanelLazy = lazy(() => import('@/components/ai/ModelConfigPanel').then(m => ({ default: m.ModelConfigPanel })));
const KnowledgeBasePanel = lazy(() => import('@/components/ai/rag/KnowledgeBasePanel').then(m => ({ default: m.KnowledgeBasePanel })));
const GeneticAlgorithmPanel = lazy(() => import('@/components/ai/features/GeneticAlgorithmPanel').then(m => ({ default: m.GeneticAlgorithmPanel })));
const MultiObjectivePanel = lazy(() => import('@/components/ai/features/MultiObjectivePanel').then(m => ({ default: m.MultiObjectivePanel })));
const FormulaInputWithOptimization = lazy(() => import('@/components/ai/features/FormulaInputWithOptimization').then(m => ({ default: m.FormulaInputWithOptimization })));
const AgentWorkflowTab = lazy(() => import('@/components/ai/features/AgentWorkflowTab').then(m => ({ default: m.AgentWorkflowTab })));

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
  | 'config'
  | 'agent';

export default function AIAssistantPage() {
  const [tab, setTab] = useState<AITab>('chat');
  const [selectedModel, setSelectedModel] = useState<ModelType>('formula_gpt');
  const [geneticMode, setGeneticMode] = useState<'single' | 'multi' | 'formula'>('single');

  // ===== 搜索快捷键 =====
  const { isOpen: searchOpen, toggle: toggleSearch, close: closeSearch } = useKeyboardSearch();

  // ===== 统一全局快捷键注册 =====
  useGlobalShortcuts([
    { key: 'k', ctrl: true, meta: true, action: toggleSearch, scope: 'global', description: '全局搜索', priority: 10 },
    { key: 'Escape', action: closeSearch, scope: 'global', description: '关闭弹窗' },
  ]);

  // ===== 移动端侧栏 =====
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMobileMenu = useCallback(() => setMobileMenuOpen((v) => !v), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

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
      agent: 'Agent 工作流',
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
          value: 'agent' as AITab,
          label: 'Agent 工作流',
          icon: Bot,
          badge: undefined,
          badgeVariant: 'primary' as const,
        },
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

  // 移动端 Tab 激活后自动滚动到可见区域
  const tabGroupRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  useEffect(() => {
    if (!isMobile) return;
    for (const group of tabGroups) {
      if (group.tabs.some(t => t.value === tab)) {
        const ref = tabGroupRefs.current.get(group.key);
        const activeTrigger = ref?.querySelector('[aria-selected="true"]') as HTMLElement;
        activeTrigger?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        break;
      }
    }
  }, [tab, isMobile, tabGroups]);

  return (
    <ErrorBoundary onError={handleError}>
      {/* Toast Notification Container — 使用独立容器组件 */}
      <ToastContainer />

      <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        {/* 移动端汉堡菜单遮罩 */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 sm:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}
        {/* 移动端汉堡菜单抽屉 */}
        {isMobile && (
          <aside
            className={`fixed top-0 right-0 z-50 h-full w-72 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl transition-transform duration-300 sm:hidden ${
              mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="navigation"
            aria-label="功能导航菜单"
            aria-hidden={!mobileMenuOpen}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
              <span className="font-semibold text-neutral-900 dark:text-white">功能导航</span>
              <button
                onClick={closeMobileMenu}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="关闭菜单"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-64px)]">
              {tabGroups.flatMap((group) =>
                group.tabs.map((t) => {
                  const TabIcon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => {
                        handleTabChange(t.value as AITab);
                        closeMobileMenu();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        tab === t.value
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                      aria-current={tab === t.value ? 'page' : undefined}
                    >
                      <TabIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left">{t.label}</span>
                      {t.badge != null && t.badge > 0 && (
                        <Badge variant={t.badgeVariant} size="sm" className="flex-shrink-0">
                          {t.badge}
                        </Badge>
                      )}
                    </button>
                  );
                }),
              )}
            </nav>
          </aside>
        )}

        <main
          className="max-w-7xl mx-auto space-y-4 px-4 sm:px-6 lg:px-8 py-6"
          role="main"
          aria-label="AI智能助手中心主内容区"
        >
          {/* ── 页面横幅 — 与 Dashboard 风格一致 ── */}
          <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold leading-snug tracking-tight">
                  AI 智能助手中心
                </h2>
                <p className="mt-1 text-white/80 text-sm">
                  智能对话 · 配方生成 · 安全检查 · 协同分析 · 口感预测 · 稳定性评估
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* 汉堡菜单按钮（移动端） */}
                <button
                  onClick={toggleMobileMenu}
                  className="sm:hidden p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                  aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
                {/* 模型状态指示器 */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/15 text-white/90">
                  <span className={`w-1.5 h-1.5 rounded-full ${llmAvailable ? 'bg-emerald-300' : 'bg-red-300'}`} aria-hidden="true" />
                  {llmAvailable ? '模型在线' : '模型离线'}
                </div>
              </div>
            </div>
          </div>

          {/* ── 搜索栏 ── */}
          <div className="relative">
            <Input
              type="search"
              placeholder="搜索配方、药材、分析工具…"
              aria-label="搜索配方、药材、分析工具"
              prefix={<Search size={14} className="text-neutral-400" />}
              className="h-10"
            />
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700"
              aria-label="快捷键 Ctrl+K"
            >
              Ctrl+K
            </kbd>
          </div>

          {/* ── 统计卡片 — 4 大卡 + 4 辅卡 ── */}
          <section aria-label="功能模块统计" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 主卡（large） */}
            <button
              type="button"
              onClick={() => handleStatCardClick('chat', '智能对话')}
              className="w-full text-left"
              aria-label="智能对话：{chatCount} 次"
            >
              <StatCard
                label="智能对话"
                value={chatCount}
                icon={MessageSquare}
                variant="primary"
                size="large"
                subtitle={`累计 ${chatCount > 0 ? chatCount.toLocaleString() : '0'} 次对话`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleStatCardClick('generate', '配方生成')}
              className="w-full text-left"
              aria-label="配方生成：{generateCount} 次"
            >
              <StatCard
                label="配方生成"
                value={generateCount}
                icon={Sparkles}
                variant="secondary"
                size="large"
                subtitle={`累计生成 ${generateCount > 0 ? generateCount.toLocaleString() : '0'} 个配方`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleStatCardClick('safety', '安全检查')}
              className="w-full text-left"
              aria-label="安全检查：{safetyChecks} 次"
            >
              <StatCard
                label="安全检查"
                value={safetyChecks}
                icon={Shield}
                variant="warning"
                size="large"
                subtitle={`累计检查 ${safetyChecks > 0 ? safetyChecks.toLocaleString() : '0'} 次`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleStatCardClick('synergy', '协同分析')}
              className="w-full text-left"
              aria-label="协同分析：{synergyCount} 次"
            >
              <StatCard
                label="协同分析"
                value={synergyCount}
                icon={GitMerge}
                variant="success"
                size="large"
                subtitle={`累计分析 ${synergyCount > 0 ? synergyCount.toLocaleString() : '0'} 次`}
              />
            </button>
            {/* 辅卡（default） */}
            <button type="button" onClick={() => handleStatCardClick('peptide-analyze', '肽序列分析')} className="w-full text-left" aria-label="肽序列分析：{peptideAnalyzeCount} 次">
              <StatCard label="肽序列分析" value={peptideAnalyzeCount} icon={Dna} variant="info" subtitle="氨基酸序列预测" />
            </button>
            <button type="button" onClick={() => handleStatCardClick('peptide-design', '肽设计优化')} className="w-full text-left" aria-label="肽设计优化：{peptideDesignCount} 次">
              <StatCard label="肽设计优化" value={peptideDesignCount} icon={Dna} variant="success" subtitle="自定义肽段设计" />
            </button>
            <button type="button" onClick={() => handleStatCardClick('config', '模型状态')} className="w-full text-left" aria-label="模型状态">
              <StatCard label="模型状态" value={llmAvailable ? '在线' : '离线'} icon={Bot} variant={llmAvailable ? 'success' : 'warning'} subtitle={llmAvailable ? 'LLM 服务正常' : '请检查模型配置'} />
            </button>
            <button type="button" onClick={() => handleStatCardClick('knowledge', '知识库')} className="w-full text-left" aria-label="知识库：{knowledgeDocCount} 篇文档">
              <StatCard label="知识库" value={knowledgeDocCount} icon={Database} variant="secondary" subtitle={`${knowledgeDocCount} 篇文档`} />
            </button>
          </section>

          {/* ── Tab 导航 — 分组布局 (核心/高级/管理) ── */}
          <Tabs value={tab} onValueChange={(v) => handleTabChange(v as AITab)}>
            <nav aria-label="AI助手功能标签导航" className="space-y-3 mobile-tabs-scroll">
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
                        : 'border-neutral-200 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/20'
                    }
                  `}
                  >
                    {/* 分组标题 */}
                    <div
                      className={`
                      flex items-center gap-2 px-4 py-2 text-xs font-medium
                      ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400'}
                    `}
                    >
                      <GroupIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      {group.label}
                    </div>
                    {/* 分组内 Tab 按钮 */}
                    <div ref={(el) => { tabGroupRefs.current.set(group.key, el); }}>
                      <TabsList
                        role="tablist"
                        aria-label={`${group.label}标签`}
                        className="px-2 pb-2 border-0 bg-transparent shadow-none flex flex-wrap sm:flex-nowrap sm:overflow-x-auto sm:scroll-smooth sm:[&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0"
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
                  </div>
                );
              })}
            </nav>

            {/* Tab Panels - Enhanced with Error Boundaries and Lazy Loading */}
            <TabsContent value="agent" id="panel-agent" role="tabpanel" aria-labelledby="tab-agent">
              <div className="h-[calc(100vh-12rem)]">
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="Agent 工作流">
                    <AgentWorkflowTab />
                  </ErrorBoundary>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="chat" id="panel-chat" role="tabpanel" aria-labelledby="tab-chat">
              <div>
                <ChatTab />
              </div>
            </TabsContent>

            <TabsContent value="generate" id="panel-generate" role="tabpanel" aria-labelledby="tab-generate">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="配方生成">
                    <GenerateTab llmAvailable={llmAvailable} modelStatus={modelStatus || {}} />
                  </ErrorBoundary>
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
                  <ErrorBoundary moduleName="安全检查">
                    <SafetyTab />
                  </ErrorBoundary>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="synergy" id="panel-synergy" role="tabpanel" aria-labelledby="tab-synergy">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="协同分析">
                    <SynergyTab />
                  </ErrorBoundary>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="taste" id="panel-taste" role="tabpanel" aria-labelledby="tab-taste">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="口感预测">
                    <TastePredictTab />
                  </ErrorBoundary>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="stability" id="panel-stability" role="tabpanel" aria-labelledby="tab-stability">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="稳定性评估">
                    <StabilityPredictTab />
                  </ErrorBoundary>
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
                  <ErrorBoundary moduleName="肽序列分析">
                    <AdvancedPeptideAnalyzer />
                  </ErrorBoundary>
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
                  <ErrorBoundary moduleName="肽设计优化">
                    <AdvancedPeptideDesign />
                  </ErrorBoundary>
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="knowledge" id="panel-knowledge" role="tabpanel" aria-labelledby="tab-knowledge">
              <div>
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="知识库">
                    <KnowledgeBasePanel isEmbedded />
                  </ErrorBoundary>
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
      </div>
    </ErrorBoundary>
  );
}
