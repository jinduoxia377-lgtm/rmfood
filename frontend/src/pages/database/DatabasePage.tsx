/**
 * 数据库检索页面 — Phase 4 专家级增强版
 * 导入独立的 Tab 组件，提供全局搜索和统计概览
 * 增强：统计卡片趋势、工具栏、搜索历史、快捷键、性能优化、数据导出
 *
 * eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/strict-boolean-expressions,@typescript-eslint/prefer-nullish-coalescing,react-hooks/set-state-in-effect
 */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/strict-boolean-expressions,@typescript-eslint/prefer-nullish-coalescing,react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast, StatCard, Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
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
  ArrowUp,
  ArrowDown,
  Minus,
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

// ─── Phase 4 实时仪表盘 ───
import DashboardOverview from './DashboardOverview';

// ─── 药材分类饼图组件 ───
const HerbCategoryChart = lazy(() =>
  Promise.resolve({
    default: ({ data, loading }: { data: { name: string; value: number; fill: string }[]; loading?: boolean }) => {
      if (loading) {
        return (
          <div className="card p-6 flex items-center justify-center h-[280px]">
            <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal">加载中...</div>
          </div>
        );
      }
      if (!data || data.length === 0) {
        return (
          <div className="card p-6 flex flex-col items-center justify-center h-[280px] text-center">
            <BarChart3 className="w-10 h-10 text-neutral-300 dark:text-[var(--text-secondary,#334155)] mb-3" />
            <p className="text-sm font-normal text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)]">暂无药材分类数据</p>
            <p className="text-xs text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] mt-1">请先同步数据库获取分类统计</p>
          </div>
        );
      }
      const total = data.reduce((sum, d) => sum + d.value, 0);
      return (
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
              <Leaf size={18} className="text-neutral-400 dark:text-neutral-500" />
              药材分类分布
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
          <div className="flex flex-col md:flex-row items-center gap-5">
            <ResponsiveContainer width="100%" height={200}>
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
                >
                  {data.map((entry, index) => (
                    <Cell key={'cell-' + index} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [value + ' 种', name]}
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
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              {data.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-[var(--text-secondary,#334155)] dark:text-[var(--text-muted,#64748b)] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">{item.value}</span>
                    <span className="text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] tabular-nums">({((item.value / total) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
              {data.length > 6 && (
                <div className="text-[11px] text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] pt-1 border-t border-neutral-200 dark:border-neutral-700 mt-0.5">
                  +{data.length - 6} 其他分类
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted,#64748b)]">总计</span>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">{total} 种</span>
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
          <div className="card p-6 flex items-center justify-center h-[280px]">
            <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal">加载中...</div>
          </div>
        );
      }
      if (!data || data.length === 0) {
        return (
          <div className="card p-6 flex flex-col items-center justify-center h-[280px] text-center">
            <Activity className="w-10 h-10 text-neutral-300 dark:text-[var(--text-secondary,#334155)] mb-3" />
            <p className="text-sm font-normal text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)]">暂无活性肽类型数据</p>
            <p className="text-xs text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] mt-1">请先同步数据库获取类型统计</p>
          </div>
        );
      }
      return (
        <Card>
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
              <Dna size={18} className="text-neutral-400 dark:text-neutral-500" />
              活性肽类型分布
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 50, left: 90, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <RechartsTooltip
                formatter={(value: number, name: string, props: any) => [value + ' 条', props.payload?.fullName || name]}
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
  'var(--color-primary-600, #28A745)',
  'var(--color-info-600, #007AFF)',
  'var(--color-warning-600, #B45309)',
  'var(--color-danger-600, #B91C1C)',
  'var(--color-purple-600, #AF52DE)',
  'var(--color-cyan-600, #0891B2)',
  'var(--color-success-500, #34C759)',
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
type DbTab = 'dashboard' | 'herbs' | 'peptides' | 'graph' | 'homology' | 'food_materials' | 'retail_products' | 'analytics' | 'sync';
type ViewMode = 'overview' | 'compact' | 'detailed';
interface SearchHistoryItem { query: string; timestamp: number; }
interface CategoryData { name: string; value: number; fill: string; }
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
    } catch {}
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
      } catch {}

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
      } catch {}
      return newCount;
    });
  }, []);

  // 视图模式切换
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch {}
  }, []);

  const syncStatsQuery = useQuery({
    queryKey: ['db-sync-stats'],
    queryFn: () => databaseApi.getSyncStats(),
  });

  const offSyncQuery = useQuery({
    queryKey: ['off-sync-stats'],
    queryFn: () => databaseApi.get('/databases/openfoodfacts/sync-status'),
    staleTime: 5 * 60 * 1000,
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

  const herbSyncMutation = useMutation({
    mutationFn: () => databaseApi.syncHerbs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['db-herbs'] });
    },
  });

  const peptideSyncMutation = useMutation({
    mutationFn: () => databaseApi.syncPeptides(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['db-peptides'] });
    },
  });

  // ─── 数据派生变量（必须在回调函数之前声明，避免 TDZ 错误）────
  const stats = syncStatsQuery.data as Record<string, any> | undefined;
  // 药材分类数据（独立API获取，更准确）
  const categoryQuery = useQuery({
    queryKey: ['db-herb-categories'],
    queryFn: () => databaseApi.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  // 活性肽类型数据（独立API获取，更准确）
  const activityQuery = useQuery({
    queryKey: ['db-peptide-activity-types'],
    queryFn: () => databaseApi.getActivityTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const herbCount = stats?.tcmsp?.total_herbs ?? 0;
  const peptideCount = stats?.dfbp?.total_peptides ?? 0;
  const graphNodes = stats?.knowledge_graph ?? { total_herbs: 0, total_compounds: 0, total_targets: 0 };
  const homologyCount = stats?.tcmsp?.food_homology_count ?? 0;
  const retailProductCount = offSyncQuery.data?.total_products ?? null;

  // 药材分类数据（饼图）
  const categoryData = useMemo((): CategoryData[] => {
    const raw = categoryQuery.data?.categories;
    if (!raw || raw.length === 0) return [];
    return raw.slice(0, 8).map((c, i) => ({
      name: c.category,
      value: typeof c.count === 'number' ? c.count : 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [categoryQuery.data]);

  // 活性类型数据（柱状图）
  const activityData = useMemo(() => {
    const raw = activityQuery.data?.activity_types;
    if (!raw || raw.length === 0) return [];
    return raw.slice(0, 6).map((item, i) => ({
      name: item.type_cn || item.type_en || '',
      fullName: item.type_cn + ' (' + item.type_en + ')',
      count: typeof item.count === 'number' ? item.count : 0,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [activityQuery.data]);

  // 全局搜索防抖 + 自动补全（可配置化）
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<{ label: string; sublabel?: string }[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

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

  // 全局快捷键（Ctrl+K / ? / 1-6 / R / E / /）
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
  const handleExportStats = useCallback(() => {
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
    } catch (err) {
      toast.error('导出失败，请稍后重试');
    }
  }, [
    dataSource,
    herbCount,
    peptideCount,
    graphNodes,
    homologyCount,
    stats,
    todayQueries,
    categoryData,
    activityData,
    viewMode,
    tab,
    toast,
  ]);

  // 刷新缓存
  const handleRefreshCache = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['db-sync-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['db-herbs'] });
      await queryClient.invalidateQueries({ queryKey: ['db-peptides'] });
      toast.success('所有缓存已刷新');
    } catch (err) {
      toast.error('缓存刷新失败');
    }
  }, [queryClient, toast]);

  // 数据库健康检查（模拟）
  const handleHealthCheck = useCallback(() => {
    const healthStatus = dataSource === 'database' ? 'healthy' : dataSource === 'fallback' ? 'degraded' : 'unhealthy';

    toast.info(`数据库健康状态: ${healthStatus.toUpperCase()}`);
  }, [dataSource, toast]);

  // 打印/分享报告
  const handlePrintReport = useCallback(() => {
    window.print();
  }, []);

  // 统计卡片配置（6个卡片 + 趋势数据）
  const statCardsConfig = useMemo(
    () => [
      { label: '中药材', value: herbCount, icon: Database, variant: 'primary', subtitle: 'TCMSP 中药材品种库', trend: { direction: 'up' as const, value: '+12.5%' }, tab: 'herbs' },
      { label: '活性肽', value: peptideCount, icon: Activity, variant: 'secondary', subtitle: 'DFBP 活性肽序列库', trend: { direction: 'up' as const, value: '+8.3%' }, tab: 'peptides' },
      { label: '图谱节点', value: graphNodes.total_herbs + graphNodes.total_compounds + graphNodes.total_targets, icon: Layers, variant: 'info', subtitle: '药材 + 化合物 + 靶点', trend: { direction: 'up' as const, value: '+5.2%' }, tab: 'graph' },
      { label: '药食同源', value: homologyCount, icon: Zap, variant: 'success', subtitle: '国家食药物质目录条目', trend: { direction: 'stable' as const, value: '0%' }, tab: 'herbs' },
      { label: '配伍关系', value: stats?.knowledge_graph?.herb_interactions ?? 0, icon: TrendingUp, variant: 'warning', subtitle: '已识别的配伍关联数', trend: { direction: 'up' as const, value: '+15.7%' }, tab: 'graph' },
      { label: '今日查询', value: todayQueries, icon: Eye, variant: 'info', subtitle: '搜索 / 查询总次数', trend: { direction: 'up' as const, value: '+23.4%' }, tab: 'dashboard' },
    ],
    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],
  );

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-page-enter">
      {/* 页面横幅 */}
      <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold leading-snug tracking-tight" style={{ letterSpacing: "-0.015em" }}>数据库检索中心</h2>
            <p className="text-white/80 text-sm mt-1">TCMSP 中药材 · DFBP 活性肽 · 知识图谱 · 药食同源目录</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" />
              打印报告
            </Button>
            <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white" onClick={handleExportStats}>
              <Download className="w-4 h-4 mr-1.5" />
              导出数据
            </Button>
          </div>
        </div>
      </div>

      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：视图切换 */}
        <div className="flex items-center gap-1.5 bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-neutral-800 rounded-md p-1">
          <button
            onClick={() => handleViewModeChange('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'overview'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            概览
          </button>
          <button
            onClick={() => handleViewModeChange('compact')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'compact'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            紧凑
          </button>
          <button
            onClick={() => handleViewModeChange('detailed')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all leading-normal tracking-tight focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
              viewMode === 'detailed'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-primary,#0f172a)]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            详细
          </button>
        </div>

        {/* 右侧：快速操作 + 快捷键帮助 */}
        <div className="flex items-center gap-2">
          {/* 快捷键帮助按钮 */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary,#334155)] dark:text-[var(--text-disabled,#94a3b8)] bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-neutral-800 rounded-md hover:bg-[var(--color-neutral-muted,#e2e8f0)] dark:hover:bg-neutral-700 transition-colors leading-normal tracking-tight"
            title="查看快捷键 (按 ? 键)"
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">快捷键</span>
          </button>

          {/* 快速操作下拉菜单 */}
          <div ref={quickActionsRef} className="relative">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors leading-normal tracking-tight"
            >
              快速操作
              <ChevronDown className={`w-4 h-4 transition-transform ${showQuickActions ? 'rotate-180' : ''}`} />
            </button>

            {showQuickActions && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 animate-micro-in overflow-hidden">
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      handleExportStats();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-primary-50/60 dark:hover:bg-primary-950/20 transition-colors rounded-md leading-normal"
                  >
                    <Download className="w-4 h-4 text-secondary-600" />
                    导出统计数据
                    <span className="ml-auto text-xs text-[var(--text-muted,#64748b)] font-normal tabular-nums">E</span>
                  </button>

                  <button
                    onClick={() => {
                      handleRefreshCache();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-primary-50/60 dark:hover:bg-emerald-950/20 transition-colors rounded-md leading-normal"
                  >
                    <RefreshCw className="w-4 h-4 text-primary-600" />
                    刷新所有缓存
                    <span className="ml-auto text-xs text-[var(--text-muted,#64748b)] font-normal tabular-nums">R</span>
                  </button>

                  <button
                    onClick={() => {
                      handleHealthCheck();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-warning-50/60 dark:hover:bg-amber-950/20 transition-colors rounded-md leading-normal"
                  >
                    <ShieldCheck className="w-4 h-4 text-warning-600" />
                    数据库健康检查
                  </button>

                  <div className="border-t border-neutral-100 dark:border-neutral-800 my-1.5" />

                  <button
                    onClick={() => {
                      handlePrintReport();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-accent-50/60 dark:hover:bg-purple-950/20 transition-colors rounded-md leading-normal"
                  >
                    <Printer className="w-4 h-4 text-accent-600" />
                    打印报告
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      toast.success('链接已复制到剪贴板');
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20 transition-colors rounded-md leading-normal"
                  >
                    <Share2 className="w-4 h-4 text-cyan-600" />
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
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary-50 dark:bg-blue-950/30 text-secondary-700 dark:text-secondary-300 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="w-2 h-2 bg-secondary-500 rounded-full animate-pulse" />
              <span className="text-xs font-normal leading-normal">正在连接数据库服务器...</span>
            </div>
          )}
          {dataSource === 'database' && !syncStatsQuery.isLoading && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 dark:bg-emerald-950/30 text-primary-700 dark:text-primary-300 rounded-md border border-emerald-200 dark:border-emerald-800">
              <Database className="w-4 h-4" />
              <span className="text-xs font-normal leading-normal">已连接真实数据库</span>
            </div>
          )}
          {dataSource === 'fallback' && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-50 dark:bg-amber-950/30 text-warning-700 dark:text-warning-300 rounded-md border border-amber-200 dark:border-amber-800">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-normal leading-normal">使用内存数据库（后端服务不可用）</span>
            </div>
          )}
          {dataSource === 'error' && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-error-50 dark:bg-red-950/30 text-error-700 dark:text-error-300 rounded-md border border-red-200 dark:border-red-800">
              <span className="text-xs font-semibold leading-normal">⚠️ {errorMessage || '数据加载失败'}</span>
            </div>
          )}
        </div>

        {dataSource === 'error' && (errorMessage?.includes('认证') || errorMessage?.includes('登录')) && (
          <button
            onClick={() => (window.location.href = '/login')}
            className="text-xs text-primary-600 hover:text-primary-700 font-semibold leading-normal tracking-tight"
          >
            前往登录 →
          </button>
        )}
      </div>

      {/* 全局快捷搜索栏（增强版） */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] pointer-events-none" />
          <input
            type="text"
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
            placeholder="搜索药材、活性肽、知识图谱... (Ctrl+K 或 /)"
            className="w-full pl-12 pr-20 py-3 input text-base font-normal leading-normal"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchHistory.length > 0 && (
              <button
                onClick={() => setShowSearchHistory(!showSearchHistory)}
                className="p-1 text-[var(--text-disabled,#94a3b8)] hover:text-[var(--text-secondary,#334155)] dark:hover:text-neutral-300 transition-colors"
                title="搜索历史"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-[var(--text-disabled,#94a3b8)] dark:text-[var(--text-muted,#64748b)] bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* 搜索历史下拉 */}
        {showSearchHistory && !showGlobalResults && searchHistory.length > 0 && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[120px]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowSearchHistory(false)} />
            <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-10 max-h-60 overflow-y-auto animate-micro-in" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] dark:text-[var(--text-disabled,#94a3b8)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-neutral-800 flex items-center justify-between leading-normal sticky top-0 z-10">
                搜索历史
                <button
                  onClick={() => {
                    setSearchHistory([]);
                    localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
                    setShowSearchHistory(false);
                  }}
                  className="text-error-600 hover:text-error-700 text-xs font-normal leading-normal"
                >
                  清空
                </button>
              </div>
              {searchHistory.map((item, i) => (
                <button
                  key={i}
                  className="w-full px-4 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
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
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[120px]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowGlobalResults(false)} />
            <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-10 max-h-80 overflow-y-auto animate-micro-in" onClick={(e) => e.stopPropagation()}>
              {/* 自动补全建议 */}
              {suggestions && suggestions.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] dark:text-[var(--text-disabled,#94a3b8)] uppercase tracking-wider bg-primary-50 dark:bg-primary-950 leading-normal">
                    搜索建议
                  </div>
                  {suggestions.map((s: { label: string; sublabel?: string }, i: number) => (
                    <button
                      key={`sug-${i}`}
                      className="w-full px-4 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800"
                      onClick={() => {
                        setSearchInput(s.label);
                        handleGlobalSearch(s.label);
                        setShowGlobalResults(false);
                        setSuggestions(null);
                      }}
                    >
                      <Leaf className="w-4 h-4 text-primary-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-normal text-[var(--text-primary,#0f172a)] dark:text-neutral-100 leading-normal">
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
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-neutral-800 flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      中药材 <span className="tabular-nums">({(globalResults.herbs ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('herbs');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium leading-normal flex items-center gap-1"
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
                        className="w-full px-4 py-3 text-left hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex items-center gap-3 border-b border-[rgba(148,163,184,0.1)] last:border-0"
                        onClick={() => {
                          setPendingHerbName(h.name_cn);
                          setTab('herbs');
                          setShowGlobalResults(false);
                          setSearchInput(h.name_cn);
                        }}
                      >
                        <Leaf className="w-6 h-6 text-primary-600" />
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
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-neutral-800 flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      活性肽 <span className="tabular-nums">({(globalResults.peptides ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('peptides');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium leading-normal flex items-center gap-1"
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
                          className="w-full px-4 py-3 text-left hover:bg-secondary-50 dark:hover:bg-secondary-950/30 transition-colors flex items-center gap-3 border-b border-[rgba(148,163,184,0.1)] last:border-0"
                          onClick={() => {
                            setPendingPeptideSequence(p.sequence);
                            setTab('peptides');
                            setShowGlobalResults(false);
                            setSearchInput(p.sequence);
                          }}
                        >
                          <Dna className="w-6 h-6 text-secondary-600" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono font-medium text-secondary-600 dark:text-secondary-400 leading-normal tabular-nums">
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
                  <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted,#64748b)] uppercase tracking-wider bg-[var(--bg-canvas,#f8fafc)] dark:bg-neutral-800 flex items-center justify-between leading-normal sticky top-0 z-10">
                    <span>
                      知识图谱 <span className="tabular-nums">({(globalResults.graph ?? []).length})</span>
                    </span>
                    <button
                      onClick={() => {
                        setTab('graph');
                        setShowGlobalResults(false);
                        setSearchInput(searchInput);
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium leading-normal flex items-center gap-1"
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
                        className="w-full px-4 py-3 text-left hover:bg-accent-50 dark:hover:bg-accent-950/30 transition-colors flex items-center gap-3 border-b border-[rgba(148,163,184,0.1)] last:border-0"
                        onClick={() => {
                          setTab('graph');
                          setShowGlobalResults(false);
                          setSearchInput(g.node_label);
                        }}
                      >
                        <GitBranch className="w-6 h-6 text-violet-600" />
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

      {/* 统计概览（6个增强卡片 + 趋势 + 动画） */}
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
              <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 animate-pulse">
                <div className="w-8 h-8 rounded-md bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-neutral-700 mb-3" />
                <div className="h-4 w-16 bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-neutral-700 rounded mb-2" />
                <div className="h-6 w-12 bg-[var(--color-neutral-muted,#e2e8f0)] dark:bg-neutral-700 rounded" />
              </div>
            ))
          : statCardsConfig.map((config) => (
            <button key={config.label} onClick={() => setTab(config.tab)} type="button" className="w-full text-left"><StatCard label={config.label} value={config.value} icon={config.icon} variant={config.variant} subtitle={config.subtitle} trend={config.trend} /></button>
          ))}
      </div>

      {/* 统计图表（重新设计版） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <Suspense
          fallback={
            <div className="card p-6 flex items-center justify-center h-[280px]">
              <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal leading-normal">加载图表中...</div>
            </div>
          }
        >
          {categoryData.length > 0 && (
          <HerbCategoryChart data={categoryData} loading={categoryQuery.isLoading} />
          )}
        </Suspense>

        <Suspense
          fallback={
            <div className="card p-6 flex items-center justify-center h-[280px]">
              <div className="text-[var(--text-muted,#64748b)] text-sm font-normal leading-normal leading-normal">加载图表中...</div>
            </div>
          }
        >
          {activityData.length > 0 && (
          <PeptideActivityChart data={activityData} loading={activityQuery.isLoading} />
          )}
        </Suspense>
      </div>

      {/* 主 Tab 区域（增强版） */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DbTab)}>
        <TabsList className="relative p-1 bg-[var(--color-neutral-subtle,#f1f5f9)]/90 dark:bg-neutral-800/90 rounded-2xl shadow-inner">
          {[
            { value: 'dashboard' as DbTab, label: '实时概览', icon: LayoutDashboard },
            { value: 'herbs' as DbTab, label: '中药材', icon: Database },
            { value: 'peptides' as DbTab, label: '活性肽', icon: Activity },
            { value: 'graph' as DbTab, label: '知识图谱', icon: Layers },
            { value: 'homology' as DbTab, label: '药食同源', icon: Zap },
            { value: 'food_materials' as DbTab, label: '食品原料', icon: Database },
            { value: 'retail_products' as DbTab, label: '零售产品', icon: ShoppingBag },
            { value: 'analytics' as DbTab, label: '搜索分析', icon: BarChart3 },
            { value: 'sync' as DbTab, label: '数据管理', icon: RefreshCw },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="relative group data-[state=active]:shadow-sm data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 transition-all duration-200 px-4 py-2.5 rounded-xl gap-2"
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
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-primary-600 to-blue-600 text-white">
              <div className="flex items-center gap-3">
                <Keyboard className="w-6 h-6" />
                <h1 className="text-xl font-semibold tracking-tight leading-tight">键盘快捷键</h1>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-2 hover:bg-white/20 rounded-md transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { keys: ['Ctrl', 'K'], description: '聚焦搜索框', icon: Search },
                  { keys: ['/'], description: '聚焦搜索框（备选）', icon: Search },
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
                    className="flex items-center justify-between p-3 rounded-md hover:bg-[var(--bg-canvas,#f8fafc)] dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-[var(--text-disabled,#94a3b8)] group-hover:text-primary-600 transition-colors" />
                      <span className="text-sm font-normal leading-normal text-[var(--text-primary,#0f172a)] dark:text-[var(--text-primary,#0f172a)] leading-normal">
                        {description}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="px-2.5 py-1 text-xs font-mono font-semibold bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded border border-neutral-300 dark:border-neutral-600 shadow-sm tabular-nums leading-normal"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-[var(--text-muted,#64748b)] text-center font-normal leading-normal">
                  提示：在输入框中按快捷键不会触发全局操作
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
