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

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
// AIContext 已移除（2026-07-22）：经确认，AIProvider 包裹内无任何子组件使用 useAIContext()。
// 所有状态已由独立 Hooks（useChatMessages、useFormulaManager 等）和 Zustand Stores 管理。
// 保留 ErrorBoundary 作为全局容错边界。

import { useQuery } from '@tanstack/react-query';
import { ModelClient } from '@/api/modelClient';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent, StatCard, Input } from '@/components/ui';
import { Skeleton as SkeletonComp } from '@/components/ui/Skeleton';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
// 全局 Toast 已由 App.tsx 提供，页面内不再重复渲染 ToastContainer（避免 toast 双重叠加）
// ModelConfigPanel 改用下方懒加载版本（ModelConfigPanelLazy），此前的即时导入从未被引用。
import { ConfigManagementPanel } from '@/components/ai/ConfigManagementPanel';
// ModelSelector 在本页从未使用，已移除（模型选择由各 Tab 内部自行持有）。
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
  Zap,
  Beaker,
  FlaskConical,
  FileText,
  Brain,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { logger } from '@/utils/safeLogger';
import { useFeedbackSystem, useAccessibility, useResponsive } from '@/utils/uiuxEnhancement';
import { useAISummaryStats } from '@/hooks/useAISummaryStats';
import { useKeyboardSearch } from '@/hooks/useKeyboardSearch';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { SearchModal } from '@/components/ai/SearchModal';
import { Menu, X } from 'lucide-react';
import { RequirePlan } from '@/utils/plan';

// 懒加载非首屏 Tab 组件 — 使用命名导出模式，兼容各组件的 export 方式
const GenerateTab = lazy(() => import('@/components/ai/features/GenerateTab').then(m => ({ default: m.GenerateTab })));
const SafetyTab = lazy(() => import('@/components/ai/features/SafetyTab').then(m => ({ default: m.SafetyTab })));
const SynergyTab = lazy(() => import('@/components/ai/features/SynergyTab').then(m => ({ default: m.SynergyTab })));
const TastePredictTab = lazy(() => import('@/components/ai/features/TastePredictTab').then(m => ({ default: m.TastePredictTab })));
const StabilityPredictTab = lazy(() => import('@/components/ai/features/StabilityPredictTab').then(m => ({ default: m.StabilityPredictTab })));
const AdvancedPeptideAnalyzer = lazy(() => import('@/components/ai/AdvancedPeptideAnalyzer').then(m => ({ default: m.AdvancedPeptideAnalyzer })));
const AdvancedPeptideDesign = lazy(() => import('@/components/ai/AdvancedPeptideDesign').then(m => ({ default: m.AdvancedPeptideDesign })));
const KnowledgeBasePanel = lazy(() => import('@/components/ai/rag/KnowledgeBasePanel').then(m => ({ default: m.KnowledgeBasePanel })));
const GeneticAlgorithmPanel = lazy(() => import('@/components/ai/features/GeneticAlgorithmPanel').then(m => ({ default: m.GeneticAlgorithmPanel })));
const MultiObjectivePanel = lazy(() => import('@/components/ai/features/MultiObjectivePanel').then(m => ({ default: m.MultiObjectivePanel })));
const FormulaInputWithOptimization = lazy(() => import('@/components/ai/features/FormulaInputWithOptimization').then(m => ({ default: m.FormulaInputWithOptimization })));

// Tab 分组导航专属主题色板 — 桌面/移动共用（原 L577/L672 两份逐字重复，抽成模块级常量 P3-10）
// 注：这些色族是分组导航的「标识色」（emerald/blue/amber 各自成套），属设计意图内的多色系装饰层。
const TAB_GROUP_ACCENTS = [
  { bar: 'bg-[var(--color-success)]',  bgActive: 'bg-[var(--color-success-container)]', textActive: 'text-[var(--color-success-text)]', ring: 'ring-[var(--color-success)]/20',       iconBg: 'bg-[var(--color-success-container)]', iconText: 'text-[var(--color-success-text)]', border: 'border-[var(--color-success-border)]', subtext: 'text-[var(--color-success-text)]/60', badge: 'bg-[var(--color-success-container)] text-[var(--color-success-text)]' },
  { bar: 'bg-[var(--color-secondary)]',     bgActive: 'bg-[var(--color-secondary-container)]',        textActive: 'text-[var(--color-secondary-text)]',      ring: 'ring-[var(--color-secondary)]/20',          iconBg: 'bg-[var(--color-secondary-container)]',    iconText: 'text-[var(--color-secondary-text)]',    border: 'border-[var(--color-secondary-border)]',   subtext: 'text-[var(--color-secondary-text)]/60',  badge: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)]' },
  { bar: 'bg-[var(--color-warning)]',    bgActive: 'bg-[var(--color-warning-container)]',      textActive: 'text-[var(--color-warning-text)]',    ring: 'ring-[var(--color-warning)]/20',         iconBg: 'bg-[var(--color-warning-container)]',   iconText: 'text-[var(--color-warning-text)]',  border: 'border-[var(--color-warning-border)]', subtext: 'text-[var(--color-warning-text)]/60', badge: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]' },
];

// Tab 加载骨架屏 — 使用 UI 库 Skeleton 组件
function TabLoadingSkeleton() {
  return (
    <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
      <SkeletonComp width="25%" height="2rem" radius={8} />
      <SkeletonComp width="50%" height="1rem" radius={4} />
      <SkeletonComp width="100%" height="10rem" radius={8} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

/** 内联搜索下拉结果项 */
interface GlobalSearchItem {
  type: string;
  title: string;
  to: string;
}

/** 将后端 /search/global 响应归一化为搜索下拉结果（参照仪表盘实现） */
function normalizeSearchResults(data: unknown): GlobalSearchItem[] {
  const payload = data as { types?: Record<string, { items?: Array<Record<string, unknown>> }> };
  const out: GlobalSearchItem[] = [];
  const seen = new Set<string>();
  for (const [bucket, value] of Object.entries(payload?.types ?? {})) {
    for (const raw of value?.items ?? []) {
      const id = String(raw.id ?? '');
      const title = String(raw.title ?? '');
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      const typeMeta: Record<string, { label: string; to: (i: string) => string }> = {
        formula: { label: '配方', to: (i) => `/formulas/${i}` },
        experiment: { label: '实验', to: (i) => `/experiments/${i}` },
        ingredient: { label: '原料', to: (i) => `/database?ingredient=${i}` },
      };
      const meta = typeMeta[bucket] ?? { label: bucket, to: () => `/ai` };
      out.push({ type: meta.label, title, to: meta.to(id) });
    }
  }
  return out.slice(0, 8);
}

export default function AIAssistantPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AITab>('chat');
  const [geneticMode, setGeneticMode] = useState<'single' | 'multi' | 'formula'>('single');

  // ===== 全局搜索（输入框内联搜索，仪表盘同款；Ctrl+K 另开模态框）=====
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!searchQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
       
      setHasSearched(false);
       
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `/api/v1/search/global?q=${encodeURIComponent(searchQuery)}&types=formula,experiment,ingredient&page_size=8`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(normalizeSearchResults(data));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ===== 搜索快捷键 =====
  const { isOpen: searchOpen, toggle: toggleSearch, close: closeSearch } = useKeyboardSearch();

  // ===== 统一全局快捷键注册 =====
  useGlobalShortcuts([
    { key: 'k', ctrl: true, meta: true, action: toggleSearch, scope: 'global', description: t('ai.page.announce.globalSearch'), priority: 10 },
    { key: 'Escape', action: closeSearch, scope: 'global', description: t('ai.page.announce.closeDialog') },
  ]);

  // ===== 移动端侧栏 =====
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMobileMenu = useCallback(() => setMobileMenuOpen((v) => !v), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // UI/UX Enhancement Hooks
  const { showError } = useFeedbackSystem();
  const { announceToScreenReader } = useAccessibility();
  const { isMobile } = useResponsive();

  // Data fetching with error handling (使用 useEffect 监听错误，符合 TanStack Query v5 规范)
  const {
    data: modelStatus,
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
      showError(t('ai.page.announce.modelStatusLoadFailed'), t('ai.page.announce.modelStatusLoadFailedDesc'));
    }
  }, [isModelStatusError, modelStatusError, showError, t]);

  // 安全访问 modelStatus.llm 属性，添加类型守卫
  const llmAvailable = modelStatus?.llm ? modelStatus.llm.status === 'active' : false;

  // ===== 真实统计数据 (useAISummaryStats hook) =====
  const {
    chatCount,
    generateCount,
    safetyChecks,
    synergyCount,
    tasteCount,
    peptideAnalyzeCount,
    peptideDesignCount,
    knowledgeDocCount,
    isError: statsIsError,
    errorMessage: statsErrorMessage,
  } = useAISummaryStats();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    announceToScreenReader(t('ai.page.announce.pageLoaded'));
  }, [announceToScreenReader, t]);

  const getTabLabel = useCallback((tab: AITab): string => {
    const labels: Record<AITab, string> = {
      chat: t('ai.page.tabs.chat'),
      generate: t('ai.page.tabs.generate'),
      genetic: t('ai.page.tabs.genetic'),
      safety: t('ai.page.tabs.safety'),
      synergy: t('ai.page.tabs.synergy'),
      taste: t('ai.page.tabs.taste'),
      stability: t('ai.page.tabs.stability'),
      'peptide-analyze': t('ai.page.tabs.peptideAnalyze'),
      'peptide-design': t('ai.page.tabs.peptideDesign'),
      knowledge: t('ai.page.tabs.knowledge'),
      config: t('ai.page.tabs.config'),
    };
    return labels[tab];
  }, [t]);

  const handleTabChange = useCallback(
    (newTab: AITab) => {
      setTab(newTab);
      announceToScreenReader(t('ai.page.announce.tabSwitched', { label: getTabLabel(newTab) }));
    },
    [announceToScreenReader, t, getTabLabel],
  );

  const handleStatCardClick = useCallback(
    (tabTarget: AITab, label: string) => {
      setTab(tabTarget);
      announceToScreenReader(t('ai.page.announce.moduleOpened', { label }));
    },
    [announceToScreenReader, t],
  );

  const handleError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      logger.error('[AIAssistantPage] 发生错误:', { error: error.message, errorInfo });
      showError(t('ai.page.announce.pageError'), error.message);
    },
    [showError, t],
  );

  // Tab 分组定义 — 遵循 nav-hierarchy 规范：核心/高级/管理 分层
  const tabGroups = useMemo(() => [
    {
      key: 'core',
      label: t('ai.page.tabGroups.core'),
      icon: Zap,
      tabs: [
        {
          value: 'chat' as AITab,
          label: t('ai.page.tabs.chat'),
          icon: MessageSquare,
          badge: chatCount,
          badgeVariant: 'primary' as const,
        },
        {
          value: 'generate' as AITab,
          label: t('ai.page.tabs.generate'),
          icon: Sparkles,
          badge: generateCount,
          badgeVariant: 'info' as const,
        },
        {
          value: 'safety' as AITab,
          label: t('ai.page.tabs.safety'),
          icon: Shield,
          badge: safetyChecks,
          badgeVariant: 'warning' as const,
        },
        {
          value: 'synergy' as AITab,
          label: t('ai.page.tabs.synergy'),
          icon: GitMerge,
          badge: synergyCount,
          badgeVariant: 'success' as const,
        },
      ],
    },
    {
      key: 'advanced',
      label: t('ai.page.tabGroups.advanced'),
      icon: Beaker,
      tabs: [
        {
          value: 'taste' as AITab,
          label: t('ai.page.tabs.taste'),
          icon: FlaskConical,
          badge: tasteCount,
          badgeVariant: 'neutral' as const,
        },
        { value: 'stability' as AITab, label: t('ai.page.tabs.stability'), icon: Activity },
        { value: 'genetic' as AITab, label: t('ai.page.tabs.genetic'), icon: Dna },
        {
          value: 'peptide-analyze' as AITab,
          label: t('ai.page.tabs.peptideAnalyze'),
          icon: Cpu,
          badge: peptideAnalyzeCount,
          badgeVariant: 'info' as const,
        },
        {
          value: 'peptide-design' as AITab,
          label: t('ai.page.tabs.peptideDesign'),
          icon: Dna,
          badge: peptideDesignCount,
          badgeVariant: 'success' as const,
        },
      ],
    },
    {
      key: 'manage',
      label: t('ai.page.tabGroups.manage'),
      icon: Wrench,
      tabs: [
        { value: 'knowledge' as AITab, label: t('ai.page.tabs.knowledge'), icon: Database },
        { value: 'config' as AITab, label: t('ai.page.tabs.config'), icon: Settings },
      ],
    },
  ], [t, chatCount, generateCount, safetyChecks, synergyCount, tasteCount, peptideAnalyzeCount, peptideDesignCount]);

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
      <div className="min-h-screen">
        {/* 移动端汉堡菜单遮罩 */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm sm:hidden"
             onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}
        {/* 移动端汉堡菜单抽屉 */}
        {isMobile && (
          <aside
            className={`fixed top-0 right-0 z-[500] h-full w-72 bg-[var(--bg-secondary)]/95 backdrop-blur-md border-l border-[var(--border-color)] shadow-2xl transition-all duration-300 ease-out sm:hidden ${
              mobileMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            role="navigation"
            aria-label={t('ai.page.featureNavAria')}
            aria-hidden={!mobileMenuOpen}
          >
            <div className="flex items-center justify-between p-[var(--space-apple-md)] border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50" style={{ paddingTop: 'calc(var(--space-apple-md, 17px) + var(--safe-area-inset-top, 0px))' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-text)] flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <span className="font-semibold text-[var(--text-primary)]">{t('ai.page.featureNav')}</span>
              </div>
              <button
                onClick={closeMobileMenu}
                className="p-1.5 min-w-[44px] min-h-[44px] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:rotate-90"
                aria-label={t('ai.page.closeMenu')}
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <nav className="p-[var(--space-apple-sm)] space-y-1 overflow-y-auto max-h-[calc(100vh-72px)]" style={{ maxHeight: 'calc(100dvh - 72px)' }}>
              {tabGroups.map((group) => (
                <div key={group.key} className="mb-[var(--space-apple-sm)]">
                  <div className="flex items-center gap-2 px-[var(--space-apple-sm)] py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    <group.icon className="w-3.5 h-3.5" aria-hidden="true" />
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
                          className={`w-full flex min-h-[44px] items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] text-sm font-medium transition-all duration-200 ${
                            tab === t.value
                              ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] shadow-sm scale-[1.02]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:scale-[1.01]'
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
          className="max-w-[1600px] mx-auto space-y-[var(--space-apple-md)] px-[var(--space-apple-md)] sm:px-[var(--space-apple-lg)] lg:px-[var(--space-apple-xl)] py-[var(--space-apple-lg)]"
          role="main"
          aria-label={t('ai.page.mainContentAria')}
        >
          {/* ── 页面横幅 — Dashboard 风格，DESIGN.md 规范 ── */}
          <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-xl font-semibold leading-snug tracking-tight">
                  {t('ai.page.pageTitle')}
                </h1>
                <p className="mt-1 text-sm text-white/90 dark:text-white/80">
                  {t('ai.page.pageSubtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* 汉堡菜单按钮（移动端） */}
                <button
                  onClick={toggleMobileMenu}
                  className="sm:hidden p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/90 dark:bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)] dark:hover:bg-[var(--bg-tertiary)]/20 text-[var(--color-primary-text)] dark:text-white transition-colors duration-150"
                  aria-label={mobileMenuOpen ? t('ai.page.closeMenu') : t('ai.page.openMenu')}
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="w-4 h-4" aria-hidden="true" />
                </button>
                {/* 模型状态指示器 — Dashboard 风格 pill */}
                <div className={`flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium ${
                  llmAvailable
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success-text)]'
                    : 'bg-[var(--color-error)]/20 text-[var(--color-error-text)]'
                }`}>
                  <span className={`relative flex h-2 w-2`}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-[var(--radius-pill)] opacity-75 ${llmAvailable ? 'bg-[var(--color-success-container)]' : 'bg-[var(--color-error-container)]'}`}></span>
                    <span className={`relative inline-flex rounded-[var(--radius-pill)] h-2 w-2 ${llmAvailable ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`}></span>
                  </span>
                  {llmAvailable ? t('ai.page.modelStatus.online') : t('ai.page.modelStatus.offline')}
                </div>
                {/* 快速操作 */}
                <button
                  onClick={() => handleStatCardClick('chat', t('ai.page.tabs.chat'))}
                  className="flex min-h-[44px] items-center gap-2 px-[var(--space-apple-md)] py-1.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/90 dark:bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)] dark:hover:bg-[var(--bg-tertiary)]/20 text-[var(--color-primary-text)] dark:text-white transition-colors duration-150 text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  {t('ai.page.actions.startChat')}
                </button>
              </div>
            </div>
          </div>

          {/* ── 搜索栏 — Dashboard 风格（输入即搜索，Ctrl+K 打开全局模态框）── */}
          <div className="relative">
            <Input
              type="search"
              placeholder={t('ai.page.searchPlaceholder')}
              aria-label={t('ai.page.searchAria')}
              focusRing={false}
              style={{ outline: 'none', boxShadow: 'none' }}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); setSelectedIndex(-1); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSelectedIndex(-1);
                  return;
                }
                if (e.key === 'ArrowDown' && searchResults.length > 0) {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
                  return;
                }
                if (e.key === 'ArrowUp' && searchResults.length > 0) {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
                  return;
                }
                if (e.key === 'Enter') {
                  const target = searchResults[selectedIndex] || searchResults[0];
                  if (target) {
                    navigate(target.to);
                    setShowSearch(false);
                    setSearchQuery('');
                    setSelectedIndex(-1);
                  }
                }
              }}
              prefix={
                searching ? (
                  <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" role="status" aria-label={t('ai.page.searching')} />
                ) : (
                  <Search size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" />
                )
              }
              className="h-10 pl-10 pr-16 sm:pr-20 rounded-[var(--radius-Apple-sm)] border-[var(--border-color)] transition-colors duration-150"
            />
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]"
              aria-label={t('ai.page.shortcutAria')}
            >
              ⌘K
            </kbd>
            {showSearch && hasSearched && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-[var(--card-bg)] rounded-[var(--radius-Apple-md)] shadow-lg border border-[var(--border-color)] py-2 z-[100]">
                {searchResults.length > 0 ? (
                  searchResults.map((r, idx) => (
                    <Link
                      key={`${r.type}-${r.title}`}
                      to={r.to}
                      onMouseDown={(e) => { e.preventDefault(); setShowSearch(false); setSearchQuery(''); navigate(r.to) }}
                      className={`flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 hover:bg-[var(--bg-secondary)] transition-colors ${selectedIndex === idx ? 'bg-[var(--bg-secondary)]' : ''}`}
                    >
                      <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-pill)] font-medium" style={r.type === '配方' ? { backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary-text)' } : { backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)' }}>{r.type}</span>
                      <span className="text-sm text-[var(--text-primary)] truncate">{r.title}</span>
                      <ArrowRight size={12} className="text-[var(--text-muted)] ml-auto shrink-0" aria-hidden="true" />
                    </Link>
                  ))
                ) : (
                  <div className="px-[var(--space-apple-md)] py-[var(--space-apple-sm)] text-sm text-[var(--text-muted)] text-center">{t('ai.page.noResults')}</div>
                )}
              </div>
            )}
          </div>

          {/* ── 统计卡片 — Dashboard 风格，DESIGN.md 规范 ── */}
          <section aria-label={t('ai.page.moduleStats')} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* 主卡（large） */}
            <StatCard
              label={t('ai.page.stats.chatLabel')}
              value={chatCount}
              icon={MessageSquare}
              variant="primary"
              size="large"
              subtitle={t('ai.page.stats.chatSubtitle', { count: chatCount > 0 ? chatCount.toLocaleString() : '0' })}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('chat', t('ai.page.tabs.chat'))}
            />
            <StatCard
              label={t('ai.page.stats.generateLabel')}
              value={generateCount}
              icon={Sparkles}
              variant="secondary"
              size="large"
              subtitle={t('ai.page.stats.generateSubtitle', { count: generateCount > 0 ? generateCount.toLocaleString() : '0' })}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('generate', t('ai.page.tabs.generate'))}
            />
            <StatCard
              label={t('ai.page.stats.safetyLabel')}
              value={safetyChecks}
              icon={Shield}
              variant="warning"
              size="large"
              subtitle={t('ai.page.stats.safetySubtitle', { count: safetyChecks > 0 ? safetyChecks.toLocaleString() : '0' })}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('safety', t('ai.page.tabs.safety'))}
            />
            <StatCard
              label={t('ai.page.stats.synergyLabel')}
              value={synergyCount}
              icon={GitMerge}
              variant="success"
              size="large"
              subtitle={t('ai.page.stats.synergySubtitle', { count: synergyCount > 0 ? synergyCount.toLocaleString() : '0' })}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('synergy', t('ai.page.tabs.synergy'))}
            />
            {/* 辅卡（default） */}
            <StatCard
              label={t('ai.page.stats.peptideAnalyzeLabel')}
              value={peptideAnalyzeCount}
              icon={Dna}
              variant="info"
              subtitle={t('ai.page.peptideSeqSubtitle')}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('peptide-analyze', t('ai.page.tabs.peptideAnalyze'))}
            />
            <StatCard
              label={t('ai.page.stats.peptideDesignLabel')}
              value={peptideDesignCount}
              icon={Dna}
              variant="success"
              subtitle={t('ai.page.peptideDesignSubtitle')}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('peptide-design', t('ai.page.tabs.peptideDesign'))}
            />
            <StatCard
              label={t('ai.page.stats.modelLabel')}
              value={llmAvailable ? t('ai.page.stats.modelValueOnline') : t('ai.page.stats.modelValueOffline')}
              icon={Bot}
              variant={llmAvailable ? 'success' : 'warning'}
              subtitle={llmAvailable ? t('ai.page.stats.modelSubtitleOk') : t('ai.page.stats.modelSubtitleCheck')}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('config', t('ai.page.tabs.config'))}
            />
            <StatCard
              label={t('ai.page.stats.knowledgeLabel')}
              value={knowledgeDocCount}
              icon={Database}
              variant="secondary"
              subtitle={t('ai.page.stats.knowledgeSubtitle', { count: knowledgeDocCount })}
              className="cursor-pointer"
              onClick={() => handleStatCardClick('knowledge', t('ai.page.tabs.knowledge'))}
            />
          </section>

          {/* 统计接口失败时必须显式提示，否则 9 张卡片会静默显示全 0 */}
          {statsIsError && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-[var(--radius-Apple-sm)] border-[var(--color-warning-border)] bg-[var(--color-warning-container)] px-[var(--space-apple-sm)] py-2 text-xs text-[var(--color-warning-text)]"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                {t('ai.page.announce.statsLoadFailed', { error: statsErrorMessage })}
              </span>
            </div>
          )}

          {/* ── Tab 导航 — 三列并排布局，Dashboard 风格 ── */}
          <nav aria-label={t('ai.page.featureTabsNavAria')} className="space-y-[var(--space-apple-md)]">
              {/* 桌面端：三列并排 */}
              <div className="hidden md:grid md:grid-cols-3 gap-4">
                {tabGroups.map((group, groupIdx) => {
                  const GroupIcon = group.icon;
                  const isActive = group.tabs.some((t) => t.value === tab);
                  // 每组的专属主题色
                  const c = TAB_GROUP_ACCENTS[groupIdx] ?? TAB_GROUP_ACCENTS[0];

                  return (
                    <div
                      key={group.key}
                      className={`relative rounded-[var(--radius-Apple-md)] border transition-all duration-200 ${
                        isActive
                          ? `${c.border} bg-[var(--bg-secondary)] shadow-sm ring-1 ${c.ring}`
                          : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--color-primary-border)]'
                      }`}
                    >
                      {/* 顶部主题色条 */}
                      <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-[var(--radius-pill)] transition-colors duration-200 ${isActive ? c.bar : 'bg-[var(--border-color)]'}`} />

                      {/* 分组标题 */}
                      <div className={`flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-[var(--space-apple-md)] border-b transition-colors duration-150 ${
                        isActive
                          ? c.border
                          : 'border-[var(--border-color)]'
                      }`}>
                        <div className={`w-8 h-8 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                          isActive ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]'
                        }`}>
                          <GroupIcon className={`w-4 h-4 transition-colors duration-150 ${
                            isActive ? c.iconText : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                          }`} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-semibold uppercase tracking-[0.08em] block transition-colors duration-150 ${
                            isActive ? c.textActive : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                          }`}>{group.label}</span>
                          <span className={`text-xs transition-colors duration-150 ${isActive ? c.subtext : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}>
                            {t('ai.page.tabGroups.featureCount', { count: group.tabs.length })}
                          </span>
                        </div>
                        {isActive && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-transparent ${c.textActive}`}>
                            <span className={`w-1.5 h-1.5 rounded-[var(--radius-pill)] ${c.bar}`} />
                            {t('ai.page.tabGroups.active')}
                          </span>
                        )}
                      </div>

                      {/* 分组内 Tab 按钮 */}
                      <div ref={(el) => { tabGroupRefs.current.set(group.key, el); }} className="p-[var(--space-apple-sm)] space-y-0.5">
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
                              className={`w-full flex min-h-[44px] items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] text-sm transition-all duration-150 text-left ${
                                isSelected
                                  ? `${c.bgActive} ${c.textActive} shadow-sm`
                                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 transition-colors duration-150 bg-transparent`}>
                                <TabIcon className={`w-3.5 h-3.5 transition-colors duration-150 ${
                                  isSelected ? c.iconText : 'text-[var(--text-muted)]'
                                }`} aria-hidden="true" />
                              </div>
                              <span className="flex-1 font-medium">{t.label}</span>
                              {t.badge != null && t.badge > 0 && (
                                <span className={`flex-shrink-0 inline-flex items-center justify-center h-5 px-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-semibold ${
                                  isSelected ? `bg-[var(--bg-tertiary)]/70 ${c.textActive}` : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
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
                  const c = TAB_GROUP_ACCENTS[groupIdx] ?? TAB_GROUP_ACCENTS[0];
                  return (
                    <div
                      key={group.key}
                      className={`relative rounded-[var(--radius-Apple-md)] border transition-all duration-200 ${
                        isActive
                          ? `${c.border} bg-[var(--bg-secondary)] shadow-sm ring-1 ${c.ring}`
                          : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {/* 顶部主题色条 */}
                      <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-[var(--radius-pill)] ${isActive ? c.bar : 'bg-[var(--border-color)]'}`} />

                      <div className={`flex items-center gap-2 px-[var(--space-apple-sm)] py-2.5 border-b ${
                        isActive ? c.border : 'border-[var(--border-color)]'
                      }`}>
                        <div className={`w-7 h-7 rounded-[var(--radius-Apple-sm)] flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]'}`}>
                          <GroupIcon className={`w-3.5 h-3.5 ${isActive ? c.iconText : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-semibold uppercase tracking-[0.08em] block ${isActive ? c.textActive : 'text-[var(--text-muted)]'}`}>{group.label}</span>
                          <span className={`text-xs ${isActive ? c.subtext : 'text-[var(--text-muted)]'}`}>{t('ai.page.tabGroups.featureCount', { count: group.tabs.length })}</span>
                        </div>
                        {isActive && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium bg-transparent ${c.textActive}`}>
                            <span className={`w-1.5 h-1.5 rounded-[var(--radius-pill)] ${c.bar}`} />
                            {t('ai.page.tabGroups.active')}
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
                              className={`flex min-h-[44px] items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                                isSelected
                                  ? `${c.bgActive} ${c.textActive}`
                                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
                              }`}
                            >
                              <TabIcon className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{t.label}</span>
                              {t.badge != null && t.badge > 0 && (
                                <span className={`h-4 px-1 rounded-[var(--radius-Apple-sm)] text-xs font-semibold ${isSelected ? `bg-[var(--bg-tertiary)]/70 ${c.textActive}` : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>{t.badge}</span>
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
            <div className="mt-[var(--space-apple-md)]">
              {tab === 'chat' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-chat" aria-label={t('ai.page.panelChat')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.chat')}>
                      <ChatStateProvider>
                        <ChatTab />
                      </ChatStateProvider>
                    </ErrorBoundary>
                  </div>
                </Suspense>
              )}
              {tab === 'generate' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-generate" aria-label={t('ai.page.panelGenerate')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.generate')}>
                    <RequirePlan feature="ai_formula_generation">
                      <GenerateTab llmAvailable={llmAvailable} modelStatus={modelStatus || {}} />
                    </RequirePlan>
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'genetic' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-genetic" aria-label={t('ai.page.panelGenetic')}>
                    <div className="mb-[var(--space-apple-md)]">
                    <Tabs
                      value={geneticMode}
                      onValueChange={(v) => {
                        setGeneticMode(v as 'single' | 'multi' | 'formula');
                        if (v === 'formula') {
                          announceToScreenReader(t('ai.page.genetic.announceFormula'));
                        } else {
                          announceToScreenReader(v === 'multi' ? t('ai.page.genetic.announceMulti') : t('ai.page.genetic.announceSingle'));
                        }
                      }}
                    >
                      <TabsList className="mb-[var(--space-apple-md)]" role="tablist" aria-label={t('ai.page.geneticModeSwitch')}>
                        <TabsTrigger value="single" role="tab" aria-selected={geneticMode === 'single'}>
                          <Dna className="w-3.5 h-3.5 mr-1.5 text-[var(--color-accent-text)]" aria-hidden="true" />
                          {t('ai.page.genetic.modeSingle')}
                        </TabsTrigger>
                        <TabsTrigger value="multi" role="tab" aria-selected={geneticMode === 'multi'}>
                          <GitBranch className="w-3.5 h-3.5 mr-1.5 text-[var(--color-accent-text)]" aria-hidden="true" />
                          {t('ai.page.genetic.modeMulti')}
                        </TabsTrigger>
                        <TabsTrigger value="formula" role="tab" aria-selected={geneticMode === 'formula'}>
                          <FileText className="w-3.5 h-3.5 mr-1.5 text-[var(--color-primary-text)]" aria-hidden="true" />
                          {t('ai.page.genetic.modeFormula')}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="single">
                        <RequirePlan feature="ai_formula_generation">
                          <GeneticAlgorithmPanel />
                        </RequirePlan>
                      </TabsContent>
                      <TabsContent value="multi">
                        <RequirePlan feature="ai_formula_generation">
                          <MultiObjectivePanel />
                        </RequirePlan>
                      </TabsContent>
                      <TabsContent value="formula">
                        <Suspense fallback={<TabLoadingSkeleton />}>
                          <RequirePlan feature="ai_formula_generation">
                            <FormulaInputWithOptimization />
                          </RequirePlan>
                        </Suspense>
                      </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </Suspense>
              )}
              {tab === 'safety' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-safety" aria-label={t('ai.page.panelSafety')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.safety')}>
                    <SafetyTab />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'synergy' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-synergy" aria-label={t('ai.page.panelSynergy')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.synergy')}>
                    <SynergyTab />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'taste' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-taste" aria-label={t('ai.page.panelTaste')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.taste')}>
                    <TastePredictTab />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'stability' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-stability" aria-label={t('ai.page.panelStability')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.stability')}>
                    <StabilityPredictTab />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'peptide-analyze' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-peptide-analyze" aria-label={t('ai.page.panelPeptideAnalyze')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.peptideAnalyze')}>
                    <AdvancedPeptideAnalyzer />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'peptide-design' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-peptide-design" aria-label={t('ai.page.panelPeptideDesign')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.peptideDesign')}>
                    <AdvancedPeptideDesign />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'knowledge' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-knowledge" aria-label={t('ai.page.panelKnowledge')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.knowledge')}>
                    <KnowledgeBasePanel isEmbedded />
                  </ErrorBoundary>

                  </div>
                </Suspense>
              )}
              {tab === 'config' && (
                <Suspense fallback={<TabLoadingSkeleton />}>

                  <div role="tabpanel" id="panel-config" aria-label={t('ai.page.panelConfig')}>
                    <ErrorBoundary moduleName={t('ai.page.tabs.config')}>
                    <ConfigManagementPanel />
                  </ErrorBoundary>

                  </div>
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
