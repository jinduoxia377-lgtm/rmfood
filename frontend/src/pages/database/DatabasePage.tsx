/**
 * 数据库检索页面 — Phase 4 专家级增强版
 * 导入独立的 Tab 组件，提供全局搜索和统计概览
 * 增强：统计卡片趋势、工具栏、搜索历史、快捷键、性能优化、数据导出
 *
 * eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/strict-boolean-expressions,@typescript-eslint/prefer-nullish-coalescing,react-hooks/set-state-in-effect
 */
/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { databaseApi } from '@/api/database';
import { complianceApi } from '@/api/compliance';
import { Badge, Tabs, TabsList, TabsTrigger, TabsContent, useToast, StatCard, Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  Search,
  BarChart3,
  TrendingUp,
  Activity,
  Database,
  Zap,
  Layers,
  RefreshCw,
  Download,
  Keyboard,
  X,
  ShoppingBag,
  Eye,
  LayoutDashboard,
  LayoutList,
  LayoutGrid,
  ChevronDown,
  Filter,
  History,
  Printer,
  Share2,
  ShieldCheck,
  Leaf,
  Dna,
  GitBranch,
  LucideIcon,
} from 'lucide-react';

// ─── 模块化 Tab 组件 ───
import HerbsTab from './tabs/HerbsTab';
import PeptidesTab from './tabs/PeptidesTab';
import GraphTab from './tabs/GraphTab';
import HomologyTab from './tabs/HomologyTab';
import DataManagementTab from './tabs/DataManagementTab';
import FoodMaterialSearchPanel from './tabs/FoodMaterialSearchPanel';
import RetailProductSearchPanel from './tabs/RetailProductSearchPanel';
import SearchAnalyticsDashboard from './tabs/SearchAnalyticsDashboard';
import ExtDatabaseTab from './tabs/ExtDatabaseTab';

// ─── Phase 4 实时仪表盘 ───
import DashboardOverview from './DashboardOverview';

// ─── 药材分类饼图组件 ───
const HerbCategoryChart = lazy(() =>
  Promise.resolve({
    default: ({ data, loading, totalFoodHomology }: { data: { name: string; value: number; fill: string; foodHomology?: number }[]; loading?: boolean; totalFoodHomology?: number }) => {
      if (loading) {
        return (
          <div className="card p-[var(--space-apple-lg)] flex items-center justify-center h-[280px]">
            <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal">加载中...</div>
          </div>
        );
      }
      if (!data || data.length === 0) {
        return (
          <div className="card p-[var(--space-apple-lg)] flex flex-col items-center justify-center h-[280px] text-center">
            <BarChart3 aria-hidden="true" className="w-10 h-10 text-[var(--text-muted)] mb-[var(--space-apple-sm)]" />
            <p className="text-sm font-normal text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)]">暂无药材分类数据</p>
            <p className="text-xs text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] mt-1">请先同步数据库获取分类统计</p>
          </div>
        );
      }
      const total = data.reduce((sum, d) => sum + d.value, 0);
      return (
        <Card>
          <CardHeader className="px-6 pt-6 pb-[var(--space-apple-md)]">
            <CardTitle as="h3" className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-[var(--space-apple-sm)]">
              <Leaf aria-hidden="true" size={18} className="text-[var(--text-muted)]" />
              药材分类分布
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
          <div className="flex flex-col md:flex-row items-center gap-5">
            {/* A-24：recharts 默认给饼图根 <g> 加 tabindex="0"，但它没有任何可访问名称
                （WCAG 4.1.2）。这里用 rootTabIndex={-1} 把它移出 Tab 序列，
                并由外层容器以 role="img" + aria-label 向屏幕阅读器整体描述图表。 */}
            <div role="img" aria-label="药材分类分布饼图" className="w-full min-w-0 md:flex-1">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                  label={false}
                  rootTabIndex={-1}
                >
                  {data.map((entry, index) => (
                    <Cell key={'cell-' + index} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [value + ' \u79cd', name]}
                  contentStyle={{
                    backgroundColor: 'var(--card-bg-solid, #ffffff)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    padding: '8px 12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              {data.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-[var(--radius-pill)] shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-[var(--text-secondary,#334155)] dark:text-[var(--text-muted,#64748b)] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">{item.value}</span>
                    <span className="text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] tabular-nums">({((item.value / total) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
              {data.length > 6 && (
                <div className="text-xs text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] pt-1 border-t border-[var(--border-color)] mt-0.5">
                  +{data.length - 6} 其他分类
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-[var(--border-color)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted,#64748b)]">总计</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{total} 种</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted,#64748b)] flex items-center gap-1">药食同源</span>
                  <span className="text-xs font-semibold text-[var(--color-success-text)] dark:text-[var(--color-success-text)] tabular-nums">{totalFoodHomology ?? 0} 种</span>
                </div>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      );
    },
  }),
);

// ─── 活性肽类型柱状图组件 ───
const PeptideActivityChart = lazy(() =>
  Promise.resolve({
    default: ({ data, loading }: { data: { name: string; count: number; fill: string }[]; loading?: boolean }) => {
      if (loading) {
        return (
          <div className="card p-[var(--space-apple-lg)] flex items-center justify-center h-[280px]">
            <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal">加载中...</div>
          </div>
        );
      }
      if (!data || data.length === 0) {
        return (
          <div className="card p-[var(--space-apple-lg)] flex flex-col items-center justify-center h-[280px] text-center">
            <Activity aria-hidden="true" className="w-10 h-10 text-[var(--text-muted)] mb-[var(--space-apple-sm)]" />
            <p className="text-sm font-normal text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)]">暂无活性肽类型数据</p>
            <p className="text-xs text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] mt-1">请先同步数据库获取类型统计</p>
          </div>
        );
      }
      return (
        <Card>
          <CardHeader className="px-6 pt-6 pb-[var(--space-apple-md)]">
            <CardTitle as="h3" className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-[var(--space-apple-sm)]">
              <Dna size={18} className="text-[var(--text-muted)]" />
              活性肽类型分布
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 50, left: 110, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <RechartsTooltip
                formatter={(value: number) => [value + ' 条', '']}
                contentStyle={{
                  backgroundColor: 'var(--card-bg-solid, #ffffff)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  padding: '8px 12px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={22}>
                {data.map((entry, index) => (
                  <Cell key={'cell-' + index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    },
  }),
);

// ─── 常量配置 ───
const PIE_COLORS = [
  'var(--color-primary-600, var(--color-primary-500))',
  'var(--color-info-600, var(--color-secondary-500))',
  'var(--color-warning-600, #B45309)',
  'var(--color-danger-600, #B91C1C)',
  'var(--color-accent-600, var(--color-accent-500))',
  'var(--color-info-600, var(--color-info-600))',
  'var(--color-success-500, var(--color-primary-400))',
  'var(--color-warning-500, #D97706)',
];

const NODE_TYPE_BADGE: Record<string, 'primary' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  herb: 'primary',
  compound: 'info',
  target: 'warning',
  disease: 'danger',
};
const NODE_TYPE_LABEL: Record<string, string> = {
  herb: '药材',
  compound: '化合物',
  target: '靶点',
  disease: '疾病',
};

// ─── 类型定义 ───
type DbTab = 'dashboard' | 'herbs' | 'peptides' | 'graph' | 'homology' | 'food_materials' | 'retail_products' | 'analytics' | 'sync' | 'ext';
type ViewMode = 'overview' | 'compact' | 'detailed';
interface SearchHistoryItem { query: string; timestamp: number; }
interface CategoryData { name: string; value: number; fill: string; foodHomology?: number; }
const STORAGE_KEY_VIEW_MODE = 'rmfood_db_view_mode';
const STORAGE_KEY_SEARCH_HISTORY = 'rmfood_search_history';
const STORAGE_KEY_TODAY_QUERIES = 'rmfood_today_queries';
const MAX_SEARCH_HISTORY = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface UnifiedSearchResults {
  herbs: { id: number; name_cn: string; name_latin: string | null; category: string | null }[];
  peptides: { id: number; sequence: string; source_protein: string | null; activity_type: string | null }[];
  graph: { node_label: string; node_type: string }[];
  total: number;
}
export default function DatabasePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<DbTab>('dashboard');
  const [searchInput, setSearchInput] = useState('');
  const [pendingHerbName, setPendingHerbName] = useState<string | null>(null);
  const [pendingPeptideSequence, setPendingPeptideSequence] = useState<string | null>(null);
  const [globalResults, setGlobalResults] = useState<UnifiedSearchResults | null>(null);
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [dataSource, setDataSource] = useState<'database' | 'fallback' | 'error' | 'loading'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_VIEW_MODE) as ViewMode) || 'overview';
    } catch {
      return 'overview';
    }
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [todayQueries, setTodayQueries] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TODAY_QUERIES);
      const parsed = stored ? JSON.parse(stored) : { date: new Date().toDateString(), count: 0 };
      if (parsed.date === new Date().toDateString()) return parsed.count;
      return 0;
    } catch {
      return 0;
    }
  });
  const searchRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  // 加载搜索历史
  useEffect(() => {
    try {
      const history = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      if (history) setSearchHistory(JSON.parse(history));
    } catch { /* 忽略本地存储读取错误 */ }
  }, []);

  // 保存搜索历史
  const saveToSearchHistory = useCallback((query: string) => {
    if (!query.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.query !== query);
      const newItem = { query: query.trim(), timestamp: Date.now() };
      const updated = [newItem, ...filtered].slice(0, MAX_SEARCH_HISTORY);

      try {
        localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(updated));
      } catch { /* 忽略本地存储写入错误 */ }

      return updated;
    });

    // 更新今日查询次数
    setTodayQueries((prev) => {
      const newCount = prev + 1;
      try {
        localStorage.setItem(
          STORAGE_KEY_TODAY_QUERIES,
          JSON.stringify({
            date: new Date().toDateString(),
            count: newCount,
          }),
        );
      } catch { /* 忽略本地存储写入错误 */ }
      return newCount;
    });
  }, []);

  // 视图模式切换
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch { /* 忽略本地存储写入错误 */ }
  }, []);

  const syncStatsQuery = useQuery({
    queryKey: ['db-sync-stats'],
    queryFn: () => databaseApi.getSyncStats(),
  });

  

  useEffect(() => {
    if (syncStatsQuery.isSuccess) {
      setDataSource('database');
    }
    if (syncStatsQuery.isError) {
      const err: any = syncStatsQuery.error;
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setDataSource('error');
        setErrorMessage(`认证失败 (HTTP ${status})，请先登录`);
      } else if (!err?.response || (status >= 500 && status < 600)) {
        setDataSource('fallback');
        setErrorMessage('');
      } else {
        setDataSource('error');
        setErrorMessage(err?.message || '数据加载失败');
      }
    }
  }, [syncStatsQuery.isSuccess, syncStatsQuery.isError, syncStatsQuery.error]);

  

  // ─── 数据派生变量\uff08必须在回调函数之前声明，避免 TDZ 错误\uff09────
  const stats = syncStatsQuery.data as Record<string, any> | undefined;
  // 药材分类数据\uff08独立API获取，更准确\uff09
  const categoryQuery = useQuery({
    queryKey: ['db-herb-categories'],
    queryFn: () => databaseApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  // 活性肽类型数据\uff08独立API获取，更准确\uff09
  const activityQuery = useQuery({
    queryKey: ['db-peptide-activity-types'],
    queryFn: () => databaseApi.getActivityTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const herbCount = stats?.tcmsp?.total_herbs ?? 0;
  const peptideCount = stats?.dfbp?.total_peptides ?? 0;
  const graphNodes = stats?.knowledge_graph ?? { total_herbs: 0, total_compounds: 0, total_targets: 0 };
  // 药食同源合规API\uff08获取官方106\u79cd目录\uff09
  const homologyComplianceQuery = useQuery({
    queryKey: ['db-homology-compliance'],
    queryFn: () => complianceApi.getFoodHomology(),
    staleTime: 5 * 60 * 1000,
  });

  const homologyCount = homologyComplianceQuery.data?.data?.count ?? stats?.tcmsp?.food_homology_count ?? 0;

  // 药材分类数据\uff08饼图\uff09
  const categoryData = useMemo((): CategoryData[] => {
    const raw = categoryQuery.data?.categories;
    if (!raw || raw.length === 0) return [];
    return raw.slice(0, 8).map((c, i) => ({
      name: c.category,
      value: typeof c.count === 'number' ? c.count : 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [categoryQuery.data]);

  // 药食同源总数
  const totalFoodHomology = categoryQuery.data?.total_food_homology ?? 0;

  // 活性类型数据\uff08柱状图\uff09
  const activityData = useMemo(() => {
    const raw = activityQuery.data?.activity_types;
    if (!raw || raw.length === 0) return [];
    const sorted = [...raw].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    const threshold = 10;
    const displayed = sorted.filter((item) => (item.count ?? 0) >= threshold);
    const others = sorted.filter((item) => (item.count ?? 0) < threshold);
    const totalOthers = others.reduce((s, item) => s + (typeof item.count === 'number' ? item.count : 0), 0);
    const result: { name: string; count: number; fill: string }[] = displayed.map((item, i) => ({
      name: item.type_cn || item.type_en || '',
      count: typeof item.count === 'number' ? item.count : 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
    if (others.length > 0) {
      result.push({
        name: `\u5176\u4ed6\u6d3b\u6027\u7c7b\u578b\uff08${others.length}\u79cd\uff09`,
        count: totalOthers,
        fill: PIE_COLORS[displayed.length % PIE_COLORS.length],
      });
    }
    return result;
  }, [activityQuery.data]);

  

  // 全局搜索防抖 + 自动补全\uff08可配置化\uff09
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<{ label: string; sublabel?: string }[] | null>(null);
  const [, setSuggestionsLoading] = useState(false);

  const handleGlobalSearch = useCallback(
    (keyword: string) => {
      if (searchTimer) clearTimeout(searchTimer);
      if (!keyword.trim()) {
        setGlobalResults(null);
        setShowGlobalResults(false);
        setSuggestions(null);
        return;
      }

      // 触发自动补全 (直接调用 API, 不使用 disabled query)
      if (keyword.length >= 1) {
        setSuggestionsLoading(true);
        databaseApi
          .getSearchSuggestions(keyword, 5)
          .then((data) => setSuggestions(data?.herbs?.slice(0, 5) || data?.peptides?.slice(0, 5) || []))
          .catch(() => setSuggestions(null))
          .finally(() => setSuggestionsLoading(false));
      }

      const timer = setTimeout(async () => {
        try {
          const raw = await databaseApi.unifiedSearch({ keyword, sources: 'herbs,peptides,graph', limit: 10 });
          // 将后端平铺结果转换为前端期望的分组结构
          const herbs: { id: number; name_cn: string; name_latin: string | null; category: string | null }[] = [];
          const peptides: { id: number; sequence: string; source_protein: string | null; activity_type: string | null }[] = [];
          const graph: { node_label: string; node_type: string }[] = [];
          const items = raw?.results ?? [];
          for (const item of items) {
            if (item.source === 'herb') {
              herbs.push({
                id: item.id,
                name_cn: item.name,
                name_latin: item.name_latin || null,
                category: item.category || null,
              });
            } else if (item.source === 'peptide') {
              peptides.push({
                id: item.id,
                sequence: item.name,
                source_protein: item.extra?.source_protein || null,
                activity_type: item.extra?.activity_type || null,
              });
            } else if (item.source === 'graph') {
              graph.push({
                node_label: item.name,
                node_type: item.category || '',
              });
            }
          }
          setGlobalResults({ herbs, peptides, graph, total: raw?.total ?? items.length });
          setShowGlobalResults(true);
          saveToSearchHistory(keyword);
        } catch (err) {
          const msg = err instanceof Error ? err.message : '搜索失败，请稍后重试';
          toast.error(msg);
          setGlobalResults(null);
          setShowGlobalResults(false);
        }
      }, SEARCH_DEBOUNCE_MS);
      setSearchTimer(timer);
    },
    [searchTimer, toast, saveToSearchHistory],
  );

  // Enter 键直接跳转到第一个结果
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && globalResults) {
        e.preventDefault();
        const firstHerb = globalResults.herbs?.[0];
        const firstPeptide = globalResults.peptides?.[0];
        const firstGraph = globalResults.graph?.[0];

        if (firstHerb) {
          setTab('herbs');
          setShowGlobalResults(false);
          setSearchInput('');
        } else if (firstPeptide) {
          setTab('peptides');
          setShowGlobalResults(false);
          setSearchInput('');
        } else if (firstGraph) {
          setTab('graph');
          setShowGlobalResults(false);
          setSearchInput('');
        }
      }

      // Escape 关闭搜索结果
      if (e.key === 'Escape') {
        setShowGlobalResults(false);
        setShowSearchHistory(false);
      }
    },
    [globalResults],
  );

  // 全局快捷键\uff08Ctrl+K / ? / 1-6 / R / E / /\uff09
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 聚焦搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector<HTMLInputElement>('input')?.focus();
        setShowSearchHistory(true);
      }

      // ? 键显示快捷键帮助
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
        }
      }

      // 数字键 1-6 切换 Tab
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-6]$/.test(e.key)) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          const tabs: DbTab[] = ['dashboard', 'herbs', 'peptides', 'graph', 'homology', 'food_materials', 'retail_products', 'analytics', 'sync'];
          const index = parseInt(e.key) - 1;
          if (tabs[index]) {
            setTab(tabs[index]);
          }
        }
      }

      // R 刷新数据
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          queryClient.invalidateQueries({ queryKey: ['db-sync-stats'] });
          toast.success('数据已刷新');
        }
      }

      // E 导出数据
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          handleExportStats();
        }
      }

      // / 聚焦搜索
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchRef.current?.querySelector<HTMLInputElement>('input')?.focus();
          setShowSearchHistory(true);
        }
      }

      // ESC 关闭所有弹层
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowQuickActions(false);
        setShowSearchHistory(false);
        setShowGlobalResults(false);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [queryClient, toast]);

  // 点击外部关闭搜索结果、快捷键面板、快速操作菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowGlobalResults(false);
        setShowSearchHistory(false);
      }
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 数据导出功能
  function handleExportStats() {
    try {
      const exportData = {
        exportTime: new Date().toISOString(),
        dataSource,
        statistics: {
          herbCount,
          peptideCount,
          graphNodes: {
            total: graphNodes.total_herbs + graphNodes.total_compounds + graphNodes.total_targets,
            herbs: graphNodes.total_herbs,
            compounds: graphNodes.total_compounds,
            targets: graphNodes.total_targets,
          },
          homologyCount,
          interactions: stats?.knowledge_graph?.herb_interactions ?? 0,
          todayQueries,
        },
        categoryData,
        activityData,
        metadata: {
          viewMode,
          currentTab: tab,
          generatedBy: 'RMFOOD Database Platform',
          version: '4.0.0',
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database-stats-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('统计数据已导出为 JSON 文件');
    } catch {
      toast.error('导出失败，请稍后重试');
    }
  }

  // 刷新缓存
  const handleRefreshCache = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['db-sync-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['db-herbs'] });
      await queryClient.invalidateQueries({ queryKey: ['db-peptides'] });
      toast.success('所有缓存已刷新');
    } catch {
      toast.error('缓存刷新失败');
    }
  }, [queryClient, toast]);

  // 数据库健康检查\uff08模拟\uff09
  const handleHealthCheck = useCallback(() => {
    const healthStatus = dataSource === 'database' ? 'healthy' : dataSource === 'fallback' ? 'degraded' : 'unhealthy';

    toast.info(`${t('pages.database.databaseHealthCheck')}: ${healthStatus.toUpperCase()}`);
  }, [dataSource, toast]);

  // 打印/分享报告
  const handlePrintReport = useCallback(() => {
    window.print();
  }, []);

  // 统计卡片配置（6个卡片 + 趋势数据）
  const statCardsConfig = useMemo<{ label: string; value: number | string; icon: LucideIcon; variant: string; subtitle: string; trend: { direction: 'up' | 'down' | 'stable'; value: string }; tab: DbTab }[]>(
    () => [
      { label: t('pages.database.statHerbs'), value: herbCount, icon: Database, variant: 'primary', subtitle: t('pages.database.statHerbsSubtitle'), trend: { direction: 'up' as const, value: '+12.5%' }, tab: 'herbs' },
      { label: t('pages.database.statPeptides'), value: peptideCount, icon: Activity, variant: 'secondary', subtitle: t('pages.database.statPeptidesSubtitle'), trend: { direction: 'up' as const, value: '+8.3%' }, tab: 'peptides' },
      { label: t('pages.database.statGraphNodes'), value: graphNodes.total_herbs + graphNodes.total_compounds + graphNodes.total_targets, icon: Layers, variant: 'info', subtitle: t('pages.database.statGraphNodesSubtitle'), trend: { direction: 'up' as const, value: '+5.2%' }, tab: 'graph' },
      { label: t('pages.database.statHomology'), value: homologyCount, icon: Zap, variant: 'success', subtitle: t('pages.database.statHomologySubtitle'), trend: { direction: 'stable' as const, value: '0%' }, tab: 'homology' },
      { label: t('pages.database.statCompatibility'), value: stats?.knowledge_graph?.herb_interactions ?? 0, icon: TrendingUp, variant: 'warning', subtitle: t('pages.database.statCompatibilitySubtitle'), trend: { direction: 'up' as const, value: '+15.7%' }, tab: 'graph' },
      { label: t('pages.database.statTodayQueries'), value: todayQueries, icon: Eye, variant: 'info', subtitle: t('pages.database.statTodayQueriesSubtitle'), trend: { direction: 'up' as const, value: '+23.4%' }, tab: 'dashboard' },
    ],
    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],
  );

  return (
    <div className="min-h-screen">
      <div className="space-y-[var(--space-apple-md)] max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">
      {/* 页面横幅 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight" style={{ letterSpacing: "-0.015em" }}>{t('pages.database.title')}</h1>
            {/* A-24：补一个屏幕阅读器可见的 h2 作为内容区标题。 */}
            <h2 className="sr-only">{t('pages.database.srSubtitle')}</h2>
            <p className="text-white/80 text-sm mt-1">{t('pages.database.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-black/15 dark:bg-[var(--bg-secondary)]/10 text-white border-white/30 hover:bg-black/25 dark:hover:bg-[var(--bg-secondary)]/20 hover:text-white" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" />
              {t('pages.database.printReport')}
            </Button>
            <Button variant="outline" size="sm" className="bg-black/15 dark:bg-[var(--bg-secondary)]/10 text-white border-white/30 hover:bg-black/25 dark:hover:bg-[var(--bg-secondary)]/20 hover:text-white" onClick={handleExportStats}>
              <Download className="w-4 h-4 mr-1.5" />
              {t('pages.database.exportData')}
            </Button>
          </div>
        </div>
      </div>

      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：视图切换 */}
        <div className="flex items-center gap-1.5 bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-1">
          <button
            onClick={() => handleViewModeChange('overview')}
            className={`flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 min-h-[44px] text-xs font-semibold rounded-[var(--radius-Apple-sm)] transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'overview'
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            {t('pages.database.viewOverview')}
          </button>
          <button
            onClick={() => handleViewModeChange('compact')}
            className={`flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 min-h-[44px] text-xs font-semibold rounded-[var(--radius-Apple-sm)] transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'compact'
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            {t('pages.database.viewCompact')}
          </button>
          <button
            onClick={() => handleViewModeChange('detailed')}
            className={`flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 min-h-[44px] text-xs font-semibold rounded-[var(--radius-Apple-sm)] transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'detailed'
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            {t('pages.database.viewDetailed')}
          </button>
        </div>

        {/* 右侧：快速操作 + 快捷键帮助 */}
        <div className="flex items-center gap-2">
          {/* 快捷键帮助按钮 */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 min-h-[44px] text-xs font-semibold text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-neutral-muted,#e2e8f0)] dark:hover:bg-[var(--bg-secondary)] transition-colors leading-normal tracking-tight"
            title={t('pages.database.shortcutTitle')}
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">{t('pages.database.shortcuts')}</span>
          </button>

          {/* 快速操作下拉菜单 */}
          <div ref={quickActionsRef} className="relative">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 min-h-[44px] text-xs font-semibold text-[var(--color-primary)] bg-primary-container hover:bg-primary-container rounded-[var(--radius-Apple-sm)] transition-colors leading-normal tracking-tight"
            >
              {t('pages.database.quickActions')}
              <ChevronDown className={`w-4 h-4 transition-transform ${showQuickActions ? 'rotate-180' : ''}`} />
            </button>

            {showQuickActions && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-xl border border-[var(--border-color)] z-50 animate-micro-in overflow-hidden">
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      handleExportStats();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-[var(--color-primary-container)]/60 dark:hover:bg-[var(--color-primary-container)]/20 transition-colors rounded-[var(--radius-Apple-sm)] leading-normal"
                  >
                    <Download className="w-4 h-4 text-[var(--color-secondary-text)]" />
                    {t('pages.database.exportStatistics')}
                    <span className="ml-auto text-xs text-[var(--text-muted,#64748b)] font-normal tabular-nums">E</span>
                  </button>

                  <button
                    onClick={() => {
                      handleRefreshCache();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-[var(--color-primary-container)]/60 dark:hover:bg-[var(--color-success-container)]/20 transition-colors rounded-[var(--radius-Apple-sm)] leading-normal"
                  >
                    <RefreshCw className="w-4 h-4 text-[var(--color-primary-text)]" />
                    {t('pages.database.refreshAllCaches')}
                    <span className="ml-auto text-xs text-[var(--text-muted,#64748b)] font-normal tabular-nums">R</span>
                  </button>

                  <button
                    onClick={() => {
                      handleHealthCheck();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-[var(--color-warning-container)]/60 dark:hover:bg-[var(--color-warning-container)]/20 transition-colors rounded-[var(--radius-Apple-sm)] leading-normal"
                  >
                    <ShieldCheck className="w-4 h-4 text-[var(--color-warning-text)]" />
                    {t('pages.database.databaseHealthCheck')}
                  </button>

                  <div className="border-t border-[var(--border-color)] my-1.5" />

                  <button
                    onClick={() => {
                      handlePrintReport();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-[var(--color-accent-container)]/60 dark:hover:bg-[var(--color-accent-container)]/20 transition-colors rounded-[var(--radius-Apple-sm)] leading-normal"
                  >
                    <Printer className="w-4 h-4 text-[var(--color-accent-text)]" />
                    打印报告
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      toast.success('链接已复制到剪贴板');
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-info-50/60 dark:hover:bg-info-950/20 transition-colors rounded-[var(--radius-Apple-sm)] leading-normal"
                  >
                    <Share2 className="w-4 h-4 text-info-600" />
                    分享此页面
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 数据源状态指示器 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-normal leading-normal leading-normal">
          {syncStatsQuery.isLoading && (
            <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/30 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] rounded-[var(--radius-Apple-sm)] border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]">
              <div className="w-2 h-2 bg-[var(--color-secondary-container)]0 rounded-[var(--radius-pill)] animate-pulse" />
              <span className="text-xs font-normal leading-normal">{t('pages.database.connectingDb')}</span>
            </div>
          )}
          {dataSource === 'database' && !syncStatsQuery.isLoading && (
            <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 bg-[var(--color-primary-container)] dark:bg-[var(--color-success-container)]/30 text-[var(--color-primary-text)] rounded-[var(--radius-Apple-sm)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
              <Database className="w-4 h-4" />
              <span className="text-xs font-normal leading-normal">{t('pages.database.connectedRealDb')}</span>
            </div>
          )}
          {dataSource === 'fallback' && (
            <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/30 text-[var(--color-warning-text)] rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-normal leading-normal">{t('pages.database.usingMemoryDb')}</span>
            </div>
          )}
          {dataSource === 'error' && (
            <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/30 text-[var(--color-error-text)] dark:text-[var(--color-error-text)] rounded-[var(--radius-Apple-sm)] border border-[var(--color-error-border)] dark:border-[var(--color-error)]">
              <span className="text-xs font-semibold leading-normal">⚠️ {errorMessage || '数据加载失败'}</span>
            </div>
          )}
        </div>

        {dataSource === 'error' && (errorMessage?.includes('认证') || errorMessage?.includes('登录')) && (
          <button
            onClick={() => (window.location.href = '/login')}
            className="text-xs text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] font-semibold leading-normal tracking-tight"
          >
            前往登录 →
          </button>
        )}
      </div>

      {/* 全局快捷搜索栏\uff08增强版\uff09 */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] pointer-events-none" />
          <input
            type="text"
            /* A-20：WCAG 2.5.5 —— 搜索框实测 1216×40，补到 44px 高；
               同时补 aria-label（此前仅靠 placeholder，屏幕阅读器无可读名称）。 */
            aria-label="全局搜索：药材、活性肽、知识图谱"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              handleGlobalSearch(e.target.value);
            }}
            onFocus={() => {
              if (globalResults) setShowGlobalResults(true);
              if (searchHistory.length > 0) setShowSearchHistory(true);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('pages.database.searchPlaceholder')}
            className="w-full pl-12 pr-20 py-[var(--space-apple-md)] min-h-[44px] input text-base font-normal leading-normal"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchHistory.length > 0 && (
              <button
                onClick={() => setShowSearchHistory(!showSearchHistory)}
                className="p-1 text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-secondary,#334155)] dark:hover:text-[var(--text-primary)] transition-colors"
                title={t('pages.database.searchHistory')}
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* 搜索历史下拉 */}
        {showSearchHistory && !showGlobalResults && searchHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-[60]">
            <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl border border-[var(--border-color)] max-h-60 overflow-y-auto animate-micro-in">
              <div className="px-[var(--space-apple-md)] py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] dark:text-[var(--text-disabled,#94a3b8)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-[var(--bg-tertiary)] flex items-center justify-between leading-normal sticky top-0 z-10">
                {t('pages.database.searchHistory')}
                <button
                  onClick={() => {
                    setSearchHistory([]);
                    localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
                    setShowSearchHistory(false);
                  }}
                  className="text-[var(--color-error-text)] hover:text-[var(--color-error-text)] text-xs font-normal leading-normal"
                >
                  {t('pages.database.clearHistory')}
                </button>
              </div>
              {searchHistory.map((item, i) => (
                <button
                  key={i}
                  className="w-full px-[var(--space-apple-md)] py-2 text-left hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/30 transition-colors flex items-center gap-[var(--space-apple-sm)] border-b border-[var(--border-color)] last:border-0"
                  onClick={() => {
                    setSearchInput(item.query);
                    handleGlobalSearch(item.query);
                    setShowSearchHistory(false);
                  }}
                >
                  <History className="w-4 h-4 text-[var(--text-disabled,#94a3b8)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] truncate leading-normal">
                      {item.query}
                    </div>
                    <div className="text-xs text-[var(--text-muted,#64748b)] font-normal leading-normal tabular-nums">
                      {new Date(item.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 搜索结果下拉 */}
        {showGlobalResults && globalResults && (
          <div className="absolute top-full left-0 right-0 mt-2 z-[60]">
            <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl border border-[var(--border-color)] max-h-80 overflow-y-auto animate-micro-in">
              {/* 自动补全建议 */}
              {suggestions && suggestions.length > 0 && (
                <div>
                  <div className="px-[var(--space-apple-md)] py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] dark:text-[var(--text-disabled,#94a3b8)] uppercase tracking-wider bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)] leading-normal">
                    搜索建议
                  </div>
                  {suggestions.map((s: { label: string; sublabel?: string }, i: number) => (
                    <button
                      key={`sug-${i}`}
                      className="w-full px-[var(--space-apple-md)] py-2 text-left hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/30 transition-colors flex items-center gap-[var(--space-apple-sm)] border-b border-[var(--border-color)]"
                      onClick={() => {
                        setSearchInput(s.label);
                        handleGlobalSearch(s.label);
                        setShowGlobalResults(false);
                        setSuggestions(null);
                      }}
                    >
                      <Leaf className="w-4 h-4 text-[var(--color-primary-text)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary)] leading-normal">
                          {s.label}
                        </div>
                        {s.sublabel && (
                          <div className="text-xs text-[var(--text-muted,#64748b)] dark:text-[var(--text-disabled,#94a3b8)] italic font-normal leading-normal">
                            {s.sublabel}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {(globalResults.herbs ?? [])?.length > 0 && (
                <div>
                  <div className="px-[var(--space-apple-md)] py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-[var(--bg-tertiary)] flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      中药材 <span className="tabular-nums">({(globalResults.herbs ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('herbs');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] font-medium leading-normal flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3" />
                      在此Tab筛选
                    </button>
                  </div>
                  {(globalResults.herbs ?? [])
                    .slice(0, 5)
                    .map((h: { id: number; name_cn: string; name_latin: string | null; category: string | null }) => (
                      <button
                        key={h.id}
                        className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/30 transition-colors flex items-center gap-[var(--space-apple-sm)] border-b border-[rgba(148,163,184,0.1)] last:border-0"
                        onClick={() => {
                          setPendingHerbName(h.name_cn);
                          setTab('herbs');
                          setShowGlobalResults(false);
                          setSearchInput(h.name_cn);
                        }}
                      >
                        <Leaf className="w-6 h-6 text-[var(--color-primary-text)]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] leading-normal">
                            {h.name_cn}
                          </div>
                          {h.name_latin && (
                            <div className="text-xs text-[var(--text-muted,#64748b)] italic font-mono leading-normal">{h.name_latin}</div>
                          )}
                        </div>
                        <Badge variant="info" size="sm" className="font-medium leading-normal">
                          {h.category || '未分类'}
                        </Badge>
                      </button>
                    ))}
                </div>
              )}
              {(globalResults.peptides ?? [])?.length > 0 && (
                <div>
                  <div className="px-[var(--space-apple-md)] py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-[var(--bg-tertiary)] flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      活性肽 <span className="tabular-nums">({(globalResults.peptides ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('peptides');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] font-medium leading-normal flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3" />
                      在此Tab筛选
                    </button>
                  </div>
                  {(globalResults.peptides ?? [])
                    .slice(0, 5)
                    .map(
                      (p: {
                        id: number;
                        sequence: string;
                        source_protein: string | null;
                        activity_type: string | null;
                      }) => (
                        <button
                          key={p.id}
                          className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/30 transition-colors flex items-center gap-[var(--space-apple-sm)] border-b border-[rgba(148,163,184,0.1)] last:border-0"
                          onClick={() => {
                            setPendingPeptideSequence(p.sequence);
                            setTab('peptides');
                            setShowGlobalResults(false);
                            setSearchInput(p.sequence);
                          }}
                        >
                          <Dna className="w-6 h-6 text-[var(--color-secondary-text)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono font-medium text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] leading-normal tabular-nums">
                              {p.sequence}
                            </div>
                            <div className="text-xs text-[var(--text-muted,#64748b)] font-normal leading-normal">{p.source_protein}</div>
                          </div>
                          <Badge variant="primary" size="sm" className="font-medium leading-normal">
                            {p.activity_type || '-'}
                          </Badge>
                        </button>
                      ),
                    )}
                </div>
              )}
              {(globalResults.graph ?? [])?.length > 0 && (
                <div>
                  <div className="px-[var(--space-apple-md)] py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-[var(--bg-tertiary)] flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      知识图谱 <span className="tabular-nums">({(globalResults.graph ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('graph');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] font-medium leading-normal flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3" />
                      在此Tab筛选
                    </button>
                  </div>
                  {(globalResults.graph ?? [])
                    .slice(0, 5)
                    .map((g: { node_label: string; node_type: string }, i: number) => (
                      <button
                        key={i}
                        className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left hover:bg-[var(--color-accent-container)] dark:hover:bg-[var(--color-accent-container)]/30 transition-colors flex items-center gap-[var(--space-apple-sm)] border-b border-[rgba(148,163,184,0.1)] last:border-0"
                        onClick={() => {
                          setTab('graph');
                          setShowGlobalResults(false);
                          setSearchInput(g.node_label);
                        }}
                      >
                        <GitBranch className="w-6 h-6 text-[var(--color-accent-text)]" />
                        <div className="flex-1 text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] leading-normal">
                          {g.node_label}
                        </div>
                        <Badge
                          variant={NODE_TYPE_BADGE[g.node_type] || 'neutral'}
                          size="sm"
                          className="font-medium leading-normal"
                        >
                          {NODE_TYPE_LABEL[g.node_type] || g.node_type}
                        </Badge>
                      </button>
                    ))}
                </div>
              )}
              {(globalResults.herbs ?? []).length === 0 &&
                (globalResults.peptides ?? []).length === 0 &&
                (globalResults.graph ?? []).length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal">
                    未找到相关结果
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* 统计概览\uff086个增强卡片 + 趋势 + 动画\uff09 */}
      <div
        className={`grid gap-2.5 ${
          viewMode === 'overview'
            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
            : viewMode === 'compact'
              ? 'grid-cols-3 md:grid-cols-6'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {syncStatsQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] animate-pulse">
                <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-[var(--bg-secondary)] mb-[var(--space-apple-sm)]" />
                <div className="h-4 w-16 bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] mb-2" />
                <div className="h-6 w-12 bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)]" />
              </div>
            ))
          : statCardsConfig.map((config) => (
            <button key={config.label} onClick={() => setTab(config.tab as DbTab)} type="button" className="w-full text-left"><StatCard label={config.label} value={config.value} icon={config.icon} variant={config.variant as "primary" | "secondary" | "info" | "success" | "warning" | undefined} subtitle={config.subtitle} trend={config.trend} /></button>
          ))}
      </div>

      {/* 统计图表\uff08重新设计版\uff09 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <Suspense
          fallback={
            <div className="card p-[var(--space-apple-lg)] flex items-center justify-center h-[280px]">
              <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal leading-normal">加载图表中...</div>
            </div>
          }
        >
          {categoryData.length > 0 && (
          <HerbCategoryChart data={categoryData} loading={categoryQuery.isLoading} totalFoodHomology={totalFoodHomology} />
          )}
        </Suspense>

        <Suspense
          fallback={
            <div className="card p-[var(--space-apple-lg)] flex items-center justify-center h-[280px]">
              <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal leading-normal">加载图表中...</div>
            </div>
          }
        >
          {activityData.length > 0 && (
          <PeptideActivityChart data={activityData} loading={activityQuery.isLoading} />
          )}
        </Suspense>
      </div>

      {/* 主 Tab 区域\uff08增强版\uff09 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DbTab)}>
        <TabsList className="relative p-1 bg-[var(--color-neutral-subtle,#f1f5f9)]/90 dark:bg-[var(--bg-tertiary)]/90 rounded-2xl shadow-inner">
          {[
            { value: 'dashboard' as DbTab, label: t('pages.database.tabDashboard'), icon: LayoutDashboard },
            { value: 'herbs' as DbTab, label: t('pages.database.tabHerbs'), icon: Database },
            { value: 'peptides' as DbTab, label: t('pages.database.tabPeptides'), icon: Activity },
            { value: 'graph' as DbTab, label: t('pages.database.tabGraph'), icon: Layers },
            { value: 'homology' as DbTab, label: t('pages.database.tabHomology'), icon: Zap },
            { value: 'food_materials' as DbTab, label: t('pages.database.tabFoodMaterials'), icon: Database },
            { value: 'retail_products' as DbTab, label: t('pages.database.tabRetailProducts'), icon: ShoppingBag },
            { value: 'ext' as DbTab, label: t('pages.database.tabOfficialCatalog'), icon: Leaf },
            { value: 'analytics' as DbTab, label: t('pages.database.tabSearchAnalytics'), icon: BarChart3 },
            { value: 'sync' as DbTab, label: t('pages.database.tabDataManagement'), icon: RefreshCw },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="relative group data-[state=active]:shadow-sm data-[state=active]:bg-[var(--bg-secondary)] dark:data-[state=active]:bg-neutral-700 transition-all duration-200 px-[var(--space-apple-md)] py-2.5 rounded-[var(--radius-Apple-md)] gap-2"
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="text-[13.5px] font-semibold leading-none tracking-tight">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="animate-fade-in">
          <DashboardOverview
            onHerbClick={(name) => {
              setTab('herbs');
              setSearchInput(name);
              setPendingHerbName(name);
            }}
            onPeptideClick={(sequence) => {
              setTab('peptides');
              setSearchInput(sequence);
              setPendingPeptideSequence(sequence);
            }}
          />
        </TabsContent>
        <TabsContent value="herbs" className="animate-fade-in">
          <HerbsTab
            initKeyword={searchInput}
            initialSelectedHerbName={pendingHerbName}
            onInitKwConsumed={() => {}}
            onHerbSelectionConsumed={() => setPendingHerbName(null)}
          />
        </TabsContent>
        <TabsContent value="peptides" className="animate-fade-in">
          <PeptidesTab
            initKeyword={tab === 'peptides' ? searchInput : ''}
            initialSelectedSequence={pendingPeptideSequence}
            onSequenceConsumed={() => setPendingPeptideSequence(null)}
          />
        </TabsContent>
        <TabsContent value="graph" className="animate-fade-in">
          <GraphTab />
        </TabsContent>
        <TabsContent value="homology" className="animate-fade-in">
          <HomologyTab />
        </TabsContent>
        <TabsContent value="food_materials" className="animate-fade-in">
          <FoodMaterialSearchPanel />
        </TabsContent>
        <TabsContent value="retail_products" className="animate-fade-in">
          <RetailProductSearchPanel />
        </TabsContent>
        <TabsContent value="ext" className="animate-fade-in">
          <ExtDatabaseTab />
        </TabsContent>
        <TabsContent value="analytics" className="animate-fade-in">
          <SearchAnalyticsDashboard />
        </TabsContent>
        <TabsContent value="sync" className="animate-fade-in">
          <DataManagementTab />
        </TabsContent>
      </Tabs>

      {/* 键盘快捷键帮助浮层 */}
      {showShortcuts && (
        <div
          ref={shortcutsRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border-color)] w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-secondary-surface-deep)] text-white">
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                <Keyboard className="w-6 h-6" />
                <h1 className="text-xl font-semibold tracking-tight leading-tight">{t('pages.database.keyboardShortcuts')}</h1>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-2 hover:bg-[var(--bg-secondary)]/20 rounded-[var(--radius-Apple-sm)] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)] max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { keys: ['Ctrl', 'K'], description: '聚焦搜索框', icon: Search },
                  { keys: ['/'], description: '聚焦搜索框\uff08备选\uff09', icon: Search },
                  { keys: ['1'], description: '切换到「实时概览」Tab', icon: LayoutDashboard },
                  { keys: ['2'], description: '切换到「中药材」Tab', icon: Database },
                  { keys: ['3'], description: '切换到「活性肽」Tab', icon: Activity },
                  { keys: ['4'], description: '切换到「知识图谱」Tab', icon: Layers },
                  { keys: ['5'], description: '切换到「药食同源」Tab', icon: Zap },
                  { keys: ['6'], description: '切换到「食品原料」Tab', icon: Database },
                  { keys: ['7'], description: '切换到「零售产品」Tab', icon: ShoppingBag },
                  { keys: ['8'], description: '切换到「搜索分析」Tab', icon: BarChart3 },
                  { keys: ['9'], description: '切换到「数据管理」Tab', icon: RefreshCw },
                  { keys: ['R'], description: '刷新所有数据缓存', icon: RefreshCw },
                  { keys: ['E'], description: '导出统计数据为 JSON', icon: Download },
                  { keys: ['?'], description: '显示/隐藏此快捷键面板', icon: Keyboard },
                  { keys: ['ESC'], description: '关闭所有弹层/面板', icon: X },
                ].map(({ keys, description, icon: Icon }, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-canvas,#f8fafc)] dark:hover:bg-[var(--bg-tertiary)]/50 transition-colors group"
                  >
                    <div className="flex items-center gap-[var(--space-apple-sm)]">
                      <Icon className="w-6 h-6 text-[var(--text-disabled,#94a3b8)] group-hover:text-[var(--color-primary-text)] transition-colors" />
                      <span className="text-sm font-normal leading-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] leading-normal">
                        {description}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="px-2.5 py-1 text-xs font-mono font-semibold bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] shadow-sm tabular-nums leading-normal"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted,#64748b)] text-center font-normal leading-normal">
                  {t('pages.database.shortcutHint')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ═════════════════════════════════════════
// 导出详情组件供 Tab 组件使用
// ═════════════════════════════════════════
export { HerbDetailContent } from './HerbDetailContent';
export { PeptideDetailContent } from './PeptideDetailContent';
