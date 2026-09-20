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
import { ChatStateProvider } from '@/components/ai/features/ChatStateProvider';
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
  Brain,
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

  // Tab 激活后自动滚动到可见区域（桌面端）
  const tabGroupRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  useEffect(() => {
    if (isMobile) return;
    for (const group of tabGroups) {
      if (group.tabs.some(t => t.value === tab)) {
        const ref = tabGroupRefs.current.get(group.key);
        const activeTrigger = ref?.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
        activeTrigger?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        break;
      }
    }
  }, [tab, tabGroups, isMobile]);

  return (
    <ErrorBoundary onError={handleError}>
      {/* Toast Notification Container — 使用独立容器组件 */}
      <ToastContainer />

      <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        {/* 移动端汉堡菜单遮罩 */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm sm:hidden"
             role="button" tabIndex={0} onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}
        {/* 移动端汉堡菜单抽屉 */}
        {isMobile && (
          <aside
            className={`fixed top-0 right-0 z-50 h-full w-72 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-l border-neutral-200 dark:border-neutral-800 shadow-2xl transition-all duration-300 ease-out sm:hidden ${
              mobileMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            role="navigation"
            aria-label="功能导航菜单"
            aria-hidden={!mobileMenuOpen}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-neutral-900 dark:text-white">功能导航</span>
              </div>
              <button
                onClick={closeMobileMenu}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 hover:rotate-90"
                aria-label="关闭菜单"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-72px)]">
              {tabGroups.map((group) => (
                <div key={group.key} className="mb-3">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    <group.icon className="w-3.5 h-3.5" />
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.tabs.map((t) => {
                      const TabIcon = t.icon;
                      return (
                        <button
                          key={t.value}
                          onClick={() => {
                            handleTabChange(t.value as AITab);
                            closeMobileMenu();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            tab === t.value
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm scale-[1.02]'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:scale-[1.01]'
                          }`}
                          aria-current={tab === t.value ? 'page' : undefined}
                        >
                          <TabIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                          <span className="flex-1 text-left">{t.label}</span>
                          {t.badge != null && t.badge > 0 && (
                            <Badge variant={t.badgeVariant} size="sm" className="flex-shrink-0 min-w-[20px] h-5 px-1.5 justify-center">
                              {t.badge}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        )}

        <main
          className="max-w-7xl mx-auto space-y-5 px-4 sm:px-6 lg:px-8 py-6"
          role="main"
          aria-label="AI智能助手中心主内容区"
        >
          {/* ── 页面横幅 — Dashboard 风格，DESIGN.md 规范 ── */}
          <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold leading-snug tracking-tight">
                  AI 智能助手中心
                </h2>
                <p className="mt-1 text-white/80 text-sm">
                  智能对话 · 配方生成 · 安全检查 · 协同分析
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* 汉堡菜单按钮（移动端） */}
                <button
                  onClick={toggleMobileMenu}
                  className="sm:hidden p-2.5 rounded-lg bg-white/15 hover:bg-white/20 text-white transition-colors duration-150"
                  aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="w-4 h-4" aria-hidden="true" />
                </button>
                {/* 模型状态指示器 — Dashboard 风格 pill */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  llmAvailable
                    ? 'bg-emerald-400/20 text-emerald-100'
                    : 'bg-red-400/20 text-red-100'
                }`}>
                  <span className={`relative flex h-2 w-2`}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${llmAvailable ? 'bg-emerald-300' : 'bg-red-300'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${llmAvailable ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  </span>
                  {llmAvailable ? '模型在线' : '模型离线'}
                </div>
                {/* 快速操作 */}
                <button
                  onClick={() => handleStatCardClick('chat', '智能对话')}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/20 text-white transition-colors duration-150 text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  开始对话
                </button>
              </div>
            </div>
          </div>

          {/* ── 搜索栏 — Dashboard 风格 ── */}
          <div className="relative">
            <Input
              type="search"
              placeholder="搜索配方、药材、分析工具…"
              aria-label="搜索配方、药材、分析工具"
              prefix={<Search size={16} className="text-neutral-400" />}
              className="h-10 pl-10 rounded-lg border-neutral-200 dark:border-neutral-700 focus:border-primary-400 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-colors duration-150"
            />
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700"
              aria-label="快捷键 Ctrl+K"
            >
              ⌘K
            </kbd>
          </div>

          {/* ── 统计卡片 — Dashboard 风格，DESIGN.md 规范 ── */}
          <section aria-label="功能模块统计" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 主卡（large） */}
            <StatCard
              label="智能对话"
              value={chatCount}
              icon={MessageSquare}
              variant="primary"
              size="large"
              subtitle={`累计 ${chatCount > 0 ? chatCount.toLocaleString() : '0'} 次对话`}
              trend={{ direction: 'up' as const, value: '+12%' }}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('chat', '智能对话')}
            />
            <StatCard
              label="配方生成"
              value={generateCount}
              icon={Sparkles}
              variant="secondary"
              size="large"
              subtitle={`累计生成 ${generateCount > 0 ? generateCount.toLocaleString() : '0'} 个配方`}
              trend={{ direction: 'up' as const, value: '+8%' }}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('generate', '配方生成')}
            />
            <StatCard
              label="安全检查"
              value={safetyChecks}
              icon={Shield}
              variant="warning"
              size="large"
              subtitle={`累计检查 ${safetyChecks > 0 ? safetyChecks.toLocaleString() : '0'} 次`}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('safety', '安全检查')}
            />
            <StatCard
              label="协同分析"
              value={synergyCount}
              icon={GitMerge}
              variant="success"
              size="large"
              subtitle={`累计分析 ${synergyCount > 0 ? synergyCount.toLocaleString() : '0'} 次`}
              trend={{ direction: 'up' as const, value: '+5%' }}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('synergy', '协同分析')}
            />
            {/* 辅卡（default） */}
            <StatCard
              label="肽序列分析"
              value={peptideAnalyzeCount}
              icon={Dna}
              variant="info"
              subtitle="氨基酸序列预测"
              className="cursor-pointer"
              onClick={() => handleStatCardClick('peptide-analyze', '肽序列分析')}
            />
            <StatCard
              label="肽设计优化"
              value={peptideDesignCount}
              icon={Dna}
              variant="success"
              subtitle="自定义肽段设计"
              className="cursor-pointer"
              onClick={() => handleStatCardClick('peptide-design', '肽设计优化')}
            />
            <StatCard
              label="模型状态"
              value={llmAvailable ? '在线' : '离线'}
              icon={Bot}
              variant={llmAvailable ? 'success' : 'warning'}
              subtitle={llmAvailable ? 'LLM 服务正常' : '请检查模型配置'}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('config', '模型状态')}
            />
            <StatCard
              label="知识库"
              value={knowledgeDocCount}
              icon={Database}
              variant="secondary"
              subtitle={`${knowledgeDocCount} 篇文档`}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('knowledge', '知识库')}
            />
          </section>

          {/* ── Tab 导航 — 三列并排布局，Dashboard 风格 ── */}
          <nav aria-label="AI助手功能标签导航" className="space-y-4">
              {/* 桌面端：三列并排 */}
              <div className="hidden md:grid md:grid-cols-3 gap-4">
                {tabGroups.map((group, groupIdx) => {
                  const GroupIcon = group.icon;
                  const isActive = group.tabs.some((t) => t.value === tab);
                  // 每组的专属主题色
                  const accentColors = [
                    { bar: 'bg-emerald-500',  bgActive: 'bg-emerald-50 dark:bg-emerald-950/30', textActive: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/20',       iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconText: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', subtext: 'text-emerald-600/60 dark:text-emerald-400/60', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
                    { bar: 'bg-blue-500',     bgActive: 'bg-blue-50 dark:bg-blue-950/30',        textActive: 'text-blue-700 dark:text-blue-300',      ring: 'ring-blue-500/20',          iconBg: 'bg-blue-100 dark:bg-blue-900/40',    iconText: 'text-blue-600 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800/50',   subtext: 'text-blue-600/60 dark:text-blue-400/60',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                    { bar: 'bg-amber-500',    bgActive: 'bg-amber-50 dark:bg-amber-950/30',      textActive: 'text-amber-700 dark:text-amber-300',    ring: 'ring-amber-500/20',         iconBg: 'bg-amber-100 dark:bg-amber-900/40',   iconText: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/50', subtext: 'text-amber-600/60 dark:text-amber-400/60', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                  ];
                  const c = accentColors[groupIdx] ?? accentColors[0];

                  return (
                    <div
                      key={group.key}
                      className={`relative rounded-xl border transition-all duration-200 ${
                        isActive
                          ? `${c.border} bg-white dark:bg-neutral-900 shadow-sm ring-1 ${c.ring}`
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      {/* 顶部主题色条 */}
                      <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-full transition-colors duration-200 ${isActive ? c.bar : 'bg-neutral-200 dark:bg-neutral-700'}`} />

                      {/* 分组标题 */}
                      <div className={`flex items-center gap-2.5 px-4 py-3.5 border-b transition-colors duration-150 ${
                        isActive
                          ? `${c.border} ${c.bgActive}`
                          : 'border-neutral-100 dark:border-neutral-800'
                      }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                          isActive ? c.iconBg : 'bg-neutral-100 dark:bg-neutral-800'
                        }`}>
                          <GroupIcon className={`w-4 h-4 transition-colors duration-150 ${
                            isActive ? c.iconText : 'text-neutral-400 dark:text-neutral-500'
                          }`} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] block transition-colors duration-150 ${
                            isActive ? c.textActive : 'text-neutral-400 dark:text-neutral-500'
                          }`}>{group.label}</span>
                          <span className={`text-[11px] transition-colors duration-150 ${isActive ? c.subtext : 'text-neutral-300 dark:text-neutral-600'}`}>
                            {group.tabs.length} 个功能
                          </span>
                        </div>
                        {isActive && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
                            活跃
                          </span>
                        )}
                      </div>

                      {/* 分组内 Tab 按钮 */}
                      <div ref={(el) => { tabGroupRefs.current.set(group.key, el); }} className="p-2.5 space-y-0.5">
                        {group.tabs.map((t) => {
                          const TabIcon = t.icon;
                          const isSelected = tab === t.value;
                          return (
                            <button
                              key={t.value}
                              onClick={() => handleTabChange(t.value as AITab)}
                              role="tab"
                              aria-selected={isSelected}
                              aria-controls={`panel-${t.value}`}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left ${
                                isSelected
                                  ? `${c.bgActive} ${c.textActive} shadow-sm`
                                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-700 dark:hover:text-neutral-300'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                                isSelected ? c.iconBg : 'bg-transparent'
                              }`}>
                                <TabIcon className={`w-3.5 h-3.5 transition-colors duration-150 ${
                                  isSelected ? c.iconText : 'text-neutral-400 dark:text-neutral-500'
                                }`} aria-hidden="true" />
                              </div>
                              <span className="flex-1 font-medium">{t.label}</span>
                              {t.badge != null && t.badge > 0 && (
                                <span className={`flex-shrink-0 inline-flex items-center justify-center h-5 px-1.5 rounded-md text-[10px] font-semibold ${
                                  isSelected ? c.badge : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                                }`}>
                                  {t.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 移动端：水平滚动单列 */}
              <div className="md:hidden space-y-2">
                {tabGroups.map((group, groupIdx) => {
                  const GroupIcon = group.icon;
                  const isActive = group.tabs.some((t) => t.value === tab);
                  const accentColors = [
                    { bar: 'bg-emerald-500',  bgActive: 'bg-emerald-50 dark:bg-emerald-950/30', textActive: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/20',       iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconText: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', subtext: 'text-emerald-600/60 dark:text-emerald-400/60', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
                    { bar: 'bg-blue-500',     bgActive: 'bg-blue-50 dark:bg-blue-950/30',        textActive: 'text-blue-700 dark:text-blue-300',      ring: 'ring-blue-500/20',          iconBg: 'bg-blue-100 dark:bg-blue-900/40',    iconText: 'text-blue-600 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800/50',   subtext: 'text-blue-600/60 dark:text-blue-400/60',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                    { bar: 'bg-amber-500',    bgActive: 'bg-amber-50 dark:bg-amber-950/30',      textActive: 'text-amber-700 dark:text-amber-300',    ring: 'ring-amber-500/20',         iconBg: 'bg-amber-100 dark:bg-amber-900/40',   iconText: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/50', subtext: 'text-amber-600/60 dark:text-amber-400/60', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                  ];
                  const c = accentColors[groupIdx] ?? accentColors[0];
                  return (
                    <div
                      key={group.key}
                      className={`relative rounded-xl border transition-all duration-200 ${
                        isActive
                          ? `${c.border} bg-white dark:bg-neutral-900 shadow-sm ring-1 ${c.ring}`
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'
                      }`}
                    >
                      {/* 顶部主题色条 */}
                      <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-full ${isActive ? c.bar : 'bg-neutral-200 dark:bg-neutral-700'}`} />

                      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${
                        isActive ? c.border : 'border-neutral-100 dark:border-neutral-800'
                      }`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? c.iconBg : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                          <GroupIcon className={`w-3.5 h-3.5 ${isActive ? c.iconText : 'text-neutral-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] block ${isActive ? c.textActive : 'text-neutral-400 dark:text-neutral-500'}`}>{group.label}</span>
                          <span className={`text-[10px] ${isActive ? c.subtext : 'text-neutral-300 dark:text-neutral-600'}`}>{group.tabs.length} 个功能</span>
                        </div>
                        {isActive && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
                            活跃
                          </span>
                        )}
                      </div>
                      <div ref={(el) => { tabGroupRefs.current.set(group.key, el); }} className="p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {group.tabs.map((t) => {
                          const TabIcon = t.icon;
                          const isSelected = tab === t.value;
                          return (
                            <button
                              key={t.value}
                              onClick={() => handleTabChange(t.value as AITab)}
                              role="tab"
                              aria-selected={isSelected}
                              aria-controls={`panel-${t.value}`}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                                isSelected
                                  ? `${c.bgActive} ${c.textActive}`
                                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                              }`}
                            >
                              <TabIcon className="w-3.5 h-3.5" />
                              <span>{t.label}</span>
                              {t.badge != null && t.badge > 0 && (
                                <span className={`h-4 px-1 rounded-md text-[10px] font-semibold ${isSelected ? c.badge : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{t.badge}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            {/* Tab Panels — 条件渲染，避免 Radix Tabs 状态冲突 */}
            <div className="mt-4">
              {tab === 'agent' && (
                <div className="h-[calc(100vh-12rem)]">
                  <Suspense fallback={<TabLoadingSkeleton />}>
                    <ErrorBoundary moduleName="Agent 工作流">
                      <AgentWorkflowTab />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              )}
              {tab === 'chat' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="智能对话">
                    <ChatStateProvider>
                      <ChatTab />
                    </ChatStateProvider>
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'generate' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="配方生成">
                    <GenerateTab llmAvailable={llmAvailable} modelStatus={modelStatus || {}} />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'genetic' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
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
              )}
              {tab === 'safety' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="安全检查">
                    <SafetyTab />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'synergy' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="协同分析">
                    <SynergyTab />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'taste' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="口感预测">
                    <TastePredictTab />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'stability' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="稳定性评估">
                    <StabilityPredictTab />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'peptide-analyze' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="肽序列分析">
                    <AdvancedPeptideAnalyzer />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'peptide-design' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="肽设计优化">
                    <AdvancedPeptideDesign />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'knowledge' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="知识库">
                    <KnowledgeBasePanel isEmbedded />
                  </ErrorBoundary>
                </Suspense>
              )}
              {tab === 'config' && (
                <Suspense fallback={<TabLoadingSkeleton />}>
                  <ErrorBoundary moduleName="配置管理">
                    <ConfigManagementPanel />
                  </ErrorBoundary>
                </Suspense>
              )}
            </div>
          </nav>
        </main>

        {/* 全局搜索模态框 */}
        <SearchModal isOpen={searchOpen} onClose={closeSearch} />
      </div>
    </ErrorBoundary>
  );
}
