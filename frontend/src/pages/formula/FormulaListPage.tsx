/**
 * 配方列表页 - 三栏式深度重构版（Phase 5 UI/UX 优化）
 * 左侧筛选面板 + 中间主内容区（统计+表格）+ 右侧快捷操作
 * 支持双视图模式、虚拟滚动、URL参数同步、服务端排序
 *
 * UI/UX 优化要点：
 * 1. 简洁标题栏（去除渐变色块和装饰性光晕，减少 AI 感）
 * 2. 扁平化快捷操作栏（柔和背景色而非渐变按钮）
 * 3. 统计卡片用实心配色（无透明渐变文字，可读性更好）
 * 4. 移除无意义动画（Sparkles pulse、scale-110 hover）
 * 5. 右侧新增「最近更新」预览卡片
 * 6. 表格行精致 hover / 选中态
 * 7. 空状态更有引导性
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  FlaskConical,
  ArrowUpDown,
  CheckCircle2,
  SlidersHorizontal,
  X,
  List,
  Download,
  Star,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ArrowRightLeft,
  MoreVertical,
  FileText,
  Edit3,
  Copy,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Clock,
  Keyboard,
  ShieldOff,
  TestTubes,
  Brain,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formulaApi } from '@/api/formula';
import type { FormulaListQueryParams, FormulaStatistics, FormulaStatus, Formula } from '@/types/formula';
import type { SortField, SortDir, ViewMode } from './types';
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Checkbox,
  Tooltip,
  Modal,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui';
import { Highlight } from '@/components/common';
import { CategoryTree } from '@/components/formula/CategoryTree';
import { TagMultiSelect } from '@/components/formula/TagMultiSelect';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useMobile';
import { useAuthStore } from '@/stores/auth';
import { logger } from '@/utils/safeLogger';
import { usePermission, PermissionGate, FormulaPermission } from '@/utils/permissions';
import { FormulaQuickView } from './components/FormulaQuickView';
import { FormulaCard } from './components/FormulaCard';
import { FormulaListSkeleton } from './components/FormulaListSkeleton';
import { useOperationLogger } from '@/utils/operationLogger';
import OperationLogPanel from './components/OperationLogPanel';
import { useToastStore } from '@/stores/toastStore';
import { StatCard } from '@/components/ui/StatCard';

// ── 类型定义 ──
type TableSortField = 'name' | 'status' | 'created_at' | 'updated_at' | 'version';
type TableSortDir = 'asc' | 'desc';

// ── 常量配置 ──
const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿', color: 'bg-neutral-100 text-neutral-700' },
  { value: 'pending_review', label: '待审核', color: 'bg-warning-100 text-warning-700' },
  { value: 'approved', label: '已通过', color: 'bg-primary-100 text-primary-700' },
  { value: 'rejected', label: '已驳回', color: 'bg-error-100 text-error-700' },
  { value: 'archived', label: '已归档', color: 'bg-neutral-100 text-neutral-600' },
  { value: 'cancelled', label: '已取消', color: 'bg-neutral-100 text-neutral-600' },
];

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
];

const EFFECT_CATEGORIES = [
  '补气养血',
  '滋阴润燥',
  '清热解毒',
  '健脾益胃',
  '补肾壮阳',
  '疏肝理气',
  '活血化瘀',
  '安神助眠',
];

// ── 快捷操作定义 ──
const QUICK_ACTIONS = [
  {
    to: '/formulas/new',
    icon: Plus,
    title: '新建配方',
    bgLight: 'bg-primary-50 dark:bg-primary-900/20',
    textColor: 'text-primary-600 dark:text-primary-400',
  },
  {
    to: '/formulas?status=pending_review',
    icon: Clock,
    title: '待审核',
    bgLight: 'bg-warning-50 dark:bg-warning-900/20',
    textColor: 'text-warning-600 dark:text-warning-400',
  },
  {
    to: '/experiments',
    icon: TestTubes,
    title: '实验管理',
    bgLight: 'bg-violet-50 dark:bg-violet-900/20',
    textColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    to: '/ai',
    icon: Brain,
    title: 'AI 助手',
    bgLight: 'bg-teal-50 dark:bg-teal-900/20',
    textColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    to: '/databases',
    icon: Database,
    title: '数据库',
    bgLight: 'bg-sky-50 dark:bg-sky-900/20',
    textColor: 'text-sky-600 dark:text-sky-400',
  },
];

// ── 工具函数 ──
const FAVORITES_KEY = 'rmfood_formula_favorites';

function getFavorites(): Set<number> {
  try {
    return new Set<number>(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function toggleFavorite(id: number): boolean {
  const favs = getFavorites();
  const has = favs.has(id);
  if (has) favs.delete(id);
  else favs.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  return !has;
}

function exportFormulasCSV(formulas: Formula[]) {
  const BOM = '\uFEFF';
  const headers = ['编号', '名称', '状态', '版本', '目标功效', '描述', '创建时间', '更新时间'];
  const rows = formulas.map((f) => [
    f.code,
    f.name,
    getStatusLabel(f.status),
    `v${f.version}`,
    f.targetEffects?.join('; ') || '',
    f.description || '',
    new Date(f.createdAt).toLocaleDateString('zh-CN'),
    new Date(f.updatedAt).toLocaleDateString('zh-CN'),
  ]);
  const csv =
    BOM +
    [headers, ...rows].map((r) => r.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `配方列表_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getStatusLabel(status: FormulaStatus): string {
  const map: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审核',
    in_review: '审核中',
    approved: '已通过',
    rejected: '已驳回',
    archived: '已归档',
    deprecated: '已弃用',
  };
  return map[status as string] || (status as string);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ── Debounce Hook ──
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ── 排序图标组件 ──
function SortIcon({
  field,
  primaryField,
  primaryDir,
  secondaryField,
  secondaryDir,
}: {
  field: TableSortField;
  primaryField: TableSortField;
  primaryDir: TableSortDir;
  secondaryField: TableSortField | null;
  secondaryDir: TableSortDir;
}) {
  const isPrimary = field === primaryField;
  const isSecondary = field === secondaryField;

  if (!isPrimary && !isSecondary) {
    return <ArrowUpDown size={12} className="text-neutral-300" />;
  }

  return (
    <span className="inline-flex items-center gap-[2px] ml-1">
      {isPrimary && (
        <span
          className="text-primary-600 dark:text-primary-400"
          title={`主排序: ${primaryDir === 'asc' ? '升序' : '降序'}`}
        >
          {primaryDir === 'asc' ? (
            <ChevronUp size={12} strokeWidth={2.5} />
          ) : (
            <ChevronDown size={12} strokeWidth={2.5} />
          )}
        </span>
      )}
      {isSecondary && (
        <span
          className="text-neutral-400 dark:text-neutral-500"
          title={`次排序: ${secondaryDir === 'asc' ? '升序' : '降序'}`}
        >
          {secondaryDir === 'asc' ? (
            <ChevronUp size={11} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={11} strokeWidth={1.5} />
          )}
        </span>
      )}
    </span>
  );
}

export default function FormulaListPage() {
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { has, hasAny } = usePermission();
  const { log } = useOperationLogger();
  const { addToast } = useToastStore();
  const [showLogPanel, setShowLogPanel] = useState(false);
  const deletedItemsRef = useRef<Map<number, { data: Formula; timer: ReturnType<typeof setTimeout> }>>(new Map());

  // ── URL 参数同步状态 ──
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('page_size') ?? '10');
  const urlSearch = searchParams.get('search') ?? '';
  const urlStatuses = (searchParams.get('statuses')?.split(',').filter(Boolean) as FormulaStatus[]) || [];
  const urlCreatedStart = searchParams.get('created_start') ?? '';
  const urlCreatedEnd = searchParams.get('created_end') ?? '';
  const urlTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const urlEffectCategory = searchParams.get('effect_category') ?? '';
  const urlCategory = searchParams.get('category') ?? '';
  const urlSortField = (searchParams.get('sort_field') ?? 'updated_at') as TableSortField;
  const urlSortDir = (searchParams.get('sort_dir') ?? 'desc') as TableSortDir;
  const urlSortField2 = (searchParams.get('sort_field2') ?? null) as TableSortField | null;
  const urlSortDir2 = (searchParams.get('sort_dir2') ?? 'asc') as TableSortDir;
  const urlCreatorId = searchParams.get('creator_id') ?? '';
  const [creatorId, setCreatorId] = useState(urlCreatorId);

  // ── 本地 UI 状态 ──
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(urlStatuses));
  const [createdStart, setCreatedStart] = useState(urlCreatedStart);
  const [createdEnd, setCreatedEnd] = useState(urlCreatedEnd);
  const [selectedTags, setSelectedTags] = useState<number[]>(urlTags.map(Number));
  const [effectCategory, setEffectCategory] = useState(urlEffectCategory);
  const [categoryIds, setCategoryIds] = useState<number[]>(urlCategory ? urlCategory.split(',').map(Number) : []);
  const [sortField, setSortField] = useState<TableSortField>(urlSortField);
  const [sortDir, setSortDir] = useState<TableSortDir>(urlSortDir);
  const [secondarySort, setSecondarySort] = useState<{ field: TableSortField | null; dir: TableSortDir }>({
    field: urlSortField2,
    dir: urlSortDir2,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(getFavorites);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(actionMenuRef, !!actionMenuId, () => setActionMenuId(null));

  // ── API 查询：配方列表 ──
  const queryParams: FormulaListQueryParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status: selectedStatuses.size > 0 ? (Array.from(selectedStatuses) as FormulaStatus[]) : undefined,
      created_start: createdStart || undefined,
      created_end: createdEnd || undefined,
      tags: selectedTags.length > 0 ? selectedTags.map(String) : undefined,
      effect_category: effectCategory || undefined,
      category: categoryIds.length > 0 ? categoryIds.join(',') : undefined,
      sort_field: sortField,
      sort_order: sortDir,
      ...(secondarySort.field
        ? {
            sort_field2: secondarySort.field,
            sort_order2: secondarySort.dir,
          }
        : {}),
      ...(creatorId ? { researcher_id: Number(creatorId) } : {}),
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      selectedStatuses,
      createdStart,
      createdEnd,
      selectedTags,
      effectCategory,
      categoryIds,
      sortField,
      sortDir,
      secondarySort,
      creatorId,
    ],
  );

  const {
    data: listData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['formulas-list', queryParams],
    queryFn: () => formulaApi.list(queryParams),
  });

  // ── API 查询：统计数据 ──
  const { data: statistics } = useQuery({
    queryKey: ['formula-statistics'],
    queryFn: () => formulaApi.getStatistics(),
  });

  // ── API 查询：最近配方（用于右侧预览）──
  const { data: recentData } = useQuery({
    queryKey: ['formulas-recent'],
    queryFn: () => formulaApi.list({ page: 1, page_size: 5, sort_field: 'updated_at', sort_order: 'desc' }),
    staleTime: 60_000,
  });
  const recentFormulas = recentData?.items ?? [];

  // ── 数据提取 ──
  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.total_pages ?? 0;

  // 负责人选项 — 从已创建的配方中聚合
  const creatorOptions = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((f) => {
      const name = f.creator_name || `ID:${f.creatorId}`;
      map.set(name, f.creatorId as number);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value: String(value) }));
  }, [items]);

  // ── 同步搜索参数到 URL ──
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (page !== 1) params.set('page', String(page));
    else params.delete('page');
    if (pageSize !== 10) params.set('page_size', String(pageSize));
    else params.delete('page_size');
    if (selectedStatuses.size > 0) params.set('statuses', Array.from(selectedStatuses).join(','));
    else params.delete('statuses');
    if (createdStart) params.set('created_start', createdStart);
    else params.delete('created_start');
    if (createdEnd) params.set('created_end', createdEnd);
    else params.delete('created_end');
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    else params.delete('tags');
    if (effectCategory) params.set('effect_category', effectCategory);
    else params.delete('effect_category');
    if (categoryIds.length > 0) params.set('category', categoryIds.join(','));
    else params.delete('category');
    params.set('sort_field', sortField);
    params.set('sort_dir', sortDir);
    if (creatorId) params.set('creator_id', creatorId);
    else params.delete('creator_id');
    if (secondarySort.field) {
      params.set('sort_field2', secondarySort.field);
      params.set('sort_dir2', secondarySort.dir);
    } else {
      params.delete('sort_field2');
      params.delete('sort_dir2');
    }
    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    page,
    pageSize,
    selectedStatuses,
    createdStart,
    createdEnd,
    selectedTags,
    effectCategory,
    categoryIds,
    sortField,
    sortDir,
    secondarySort,
    creatorId,
  ]);

  // ── 点击外部关闭菜单 ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── 键盘快捷键（桌面端）──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/formulas/new');
      }
      if (e.key === 'Escape') {
        setShowMobileFilter(false);
        setActionMenuId(null);
        setDeleteConfirmId(null);
        setPreviewId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // ── 组件卸载时清除所有删除定时器 ──
  useEffect(() => {
    return () => {
      deletedItemsRef.current.forEach((item) => clearTimeout(item.timer));
      deletedItemsRef.current.clear();
    };
  }, []);

  // ── 事件处理函数 ──
  const handleSort = useCallback(
    (field: TableSortField) => {
      if (sortField === field && sortDir === 'asc') {
        setSortDir('desc');
      } else if (sortField === field && sortDir === 'desc') {
        if (secondarySort.field && secondarySort.field !== field) {
          setSecondarySort({ field, dir: 'asc' });
          setSortField(secondarySort.field);
          setSortDir(secondarySort.dir);
        } else {
          setSecondarySort({ field: null, dir: 'asc' });
          setSortField('updated_at');
          setSortDir('desc');
        }
      } else {
        setSortField(field);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortField, sortDir, secondarySort],
  );

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(p));
      setSearchParams(params);
    },
    [searchParams],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page_size', String(size));
      params.set('page', '1');
      setSearchParams(params);
    },
    [searchParams],
  );

  const toggleStatusFilter = useCallback((status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    setSelectedStatuses(new Set());
    setCreatedStart('');
    setCreatedEnd('');
    setSelectedTags([]);
    setEffectCategory('');
    setCategoryIds([]);
    setFavoritesOnly(false);
    setSearchParams({});
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((f) => f.id)));
    }
  }, [selectedIds.size, items]);

  const toggleFavoriteItem = useCallback((id: number) => {
    const isFav = toggleFavorite(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleUndoDelete = useCallback(
    (id: number) => {
      const deleted = deletedItemsRef.current.get(id);
      if (!deleted) return;
      clearTimeout(deleted.timer);
      deletedItemsRef.current.delete(id);
      qc.setQueryData(
        ['formulas-list', queryParams],
        (old: { items: Formula[]; total: number; total_pages?: number } | undefined) => {
          if (!old) return old;
          return { ...old, items: [deleted.data, ...old.items], total: old.total + 1 };
        },
      );
      qc.invalidateQueries({ queryKey: ['formula-statistics'] });
      addToast({ type: 'info', title: '已撤销删除', message: `${deleted.data.name} 已恢复到列表`, duration: 3000 });
      log({
        action: 'undo_delete',
        target_type: 'formula',
        target_id: String(id),
        target_name: deleted.data.name,
        result: 'success',
      });
    },
    [qc, queryParams, addToast, log],
  );

  const handleDelete = useCallback(
    (id: number) => {
      const formula = items.find((f) => f.id === id);
      if (!formula) return;
      const timer = setTimeout(async () => {
        try {
          await formulaApi.delete(id);
          qc.invalidateQueries({ queryKey: ['formulas-list'] });
          qc.invalidateQueries({ queryKey: ['formula-statistics'] });
          deletedItemsRef.current.delete(id);
          logger.info('删除配方成功', { target_id: String(id), target_name: formula.name });
        } catch (err) {
          logger.error('删除配方失败:', err);
          qc.invalidateQueries({ queryKey: ['formulas-list'] });
          deletedItemsRef.current.delete(id);
          addToast({ type: 'error', title: '删除失败', message: err instanceof Error ? err.message : '未知错误' });
        }
      }, 5000);
      deletedItemsRef.current.set(id, { data: formula, timer });
      qc.setQueryData(
        ['formulas-list', queryParams],
        (old: { items: Formula[]; total: number; total_pages?: number } | undefined) => {
          if (!old) return old;
          return { ...old, items: old.items.filter((f) => f.id !== id), total: Math.max(0, old.total - 1) };
        },
      );
      setDeleteConfirmId(null);
      setActionMenuId(null);
      addToast({
        type: 'warning',
        title: `已删除「${formula.name}」`,
        message: '5 秒后将永久删除，可点击撤销',
        duration: 5000,
      });
    },
    [items, qc, queryParams, addToast, log],
  );

  const handleBatchDelete = useCallback(() => {
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个配方吗？5秒内可撤销。`)) return;
    const idsToDelete = Array.from(selectedIds);
    const formulasToDelete = items.filter((f) => selectedIds.has(f.id));
    const timer = setTimeout(async () => {
      try {
        await formulaApi.batchDelete(idsToDelete);
        qc.invalidateQueries({ queryKey: ['formulas-list'] });
        qc.invalidateQueries({ queryKey: ['formula-statistics'] });
        idsToDelete.forEach((id) => deletedItemsRef.current.delete(id));
        logger.info('批量删除成功', { count: idsToDelete.length });
      } catch (err) {
        logger.error('批量删除失败:', err);
        qc.invalidateQueries({ queryKey: ['formulas-list'] });
        idsToDelete.forEach((id) => deletedItemsRef.current.delete(id));
        addToast({ type: 'error', title: '批量删除失败', message: err instanceof Error ? err.message : '未知错误' });
      }
    }, 5000);
    formulasToDelete.forEach((f) => {
      deletedItemsRef.current.set(f.id, { data: f, timer });
    });
    qc.setQueryData(
      ['formulas-list', queryParams],
      (old: { items: Formula[]; total: number; total_pages?: number } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((f) => !selectedIds.has(f.id)),
          total: Math.max(0, old.total - selectedIds.size),
        };
      },
    );
    setSelectedIds(new Set());
    addToast({
      type: 'warning',
      title: `已删除 ${formulasToDelete.length} 个配方`,
      message: '5 秒后将永久删除，可点击撤销',
      duration: 5000,
    });
  }, [selectedIds, items, qc, queryParams, addToast, log]);

  // ── 批量状态变更 ──
  const handleBatchStatusChange = useCallback(
    (targetStatus: FormulaStatus) => {
      if (!window.confirm(`确定要将选中的 ${selectedIds.size} 个配方状态变更为"${getStatusLabel(targetStatus)}"吗？`)) return;
      const ids = Array.from(selectedIds);

      formulaApi.batchUpdateStatus(ids, targetStatus).then(() => {
        qc.invalidateQueries({ queryKey: ['formulas-list'] });
        qc.invalidateQueries({ queryKey: ['formula-statistics'] });
        setSelectedIds(new Set());
        addToast({ type: 'success', title: '批量更新成功', message: `${ids.length} 个配方已变更为"${getStatusLabel(targetStatus)}"` });
        log({
          action: 'batch_operation',
          target_type: 'formula',
          target_id: ids.join(','),
          target_name: `${ids.length} 个配方`,
          details: { metadata: { target_status: targetStatus, count: ids.length } },
          result: 'success',
        });
      }).catch((err) => {
        logger.error('批量状态变更失败:', err);
        addToast({ type: 'error', title: '批量状态变更失败', message: err?.response?.data?.detail || '未知错误' });
      });
    },
    [selectedIds, qc, addToast, log],
  );

  const handleBatchExport = useCallback(() => {
    const selectedFormulas = items.filter((f) => selectedIds.has(f.id));
    exportFormulasCSV(selectedFormulas);

    log({
      action: 'export',
      target_type: 'formula',
      target_id: Array.from(selectedIds).join(','),
      target_name: `${selectedFormulas.length} 个配方`,
      details: {
        metadata: { format: 'csv', count: selectedFormulas.length },
      },
      result: 'success',
    });
  }, [items, selectedIds, log]);

  const handleDuplicate = useCallback(
    (formula: Formula) => {
      navigate('/formulas/new', { state: { duplicateFrom: formula } });
    },
    [navigate],
  );

  const handleExportSingle = useCallback((formula: Formula) => {
    exportFormulasCSV([formula]);
  }, []);

  // ── 计算属性 ──
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearch ||
      selectedStatuses.size > 0 ||
      createdStart ||
      createdEnd ||
      selectedTags.length > 0 ||
      effectCategory ||
      categoryIds.length > 0 ||
      favoritesOnly
    );
  }, [
    debouncedSearch,
    selectedStatuses,
    createdStart,
    createdEnd,
    selectedTags,
    effectCategory,
    categoryIds,
    favoritesOnly,
  ]);

  const activeFilterTags = useMemo(() => {
    const tags: { label: string; onRemove: () => void }[] = [];
    if (debouncedSearch) tags.push({ label: `搜索: ${debouncedSearch}`, onRemove: () => setSearchInput('') });
    selectedStatuses.forEach((s) => {
      const opt = STATUS_OPTIONS.find((o) => o.value === s);
      if (opt) tags.push({ label: `状态: ${opt.label}`, onRemove: () => toggleStatusFilter(s) });
    });
    if (createdStart && createdEnd) {
      tags.push({
        label: `日期: ${createdStart} ~ ${createdEnd}`,
        onRemove: () => {
          setCreatedStart('');
          setCreatedEnd('');
        },
      });
    }
    if (effectCategory) tags.push({ label: `功效: ${effectCategory}`, onRemove: () => setEffectCategory('') });
    if (favoritesOnly) tags.push({ label: '只看收藏', onRemove: () => setFavoritesOnly(false) });
    return tags;
  }, [debouncedSearch, selectedStatuses, createdStart, createdEnd, effectCategory, favoritesOnly]);

  // ── 虚拟滚动配置 ──
  const shouldUseVirtualizer = total > 100;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowMeasureRef = useRef<Map<number, number>>(new Map());

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (viewMode === 'table') return 56;
      const cachedHeight = rowMeasureRef.current.get(index);
      if (cachedHeight) return cachedHeight;
      return 180;
    },
    overscan: 5,
  });

  // ── ResizeObserver ──
  useEffect(() => {
    if (!shouldUseVirtualizer || !parentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rows = entry.target.querySelectorAll('[data-virtual-row]');
        rows.forEach((row) => {
          const index = Number(row.getAttribute('data-virtual-row'));
          if (!isNaN(index)) {
            rowMeasureRef.current.set(index, (row as HTMLElement).offsetHeight);
          }
        });
        virtualizer.measure();
      }
    });

    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, [shouldUseVirtualizer, virtualizer, viewMode]);

  // ── 统计数据计算 ──
  const statsData = useMemo(() => {
    if (!statistics) {
      return {
        total,
        draft: 0,
        pendingReview: 0,
        approved: 0,
        monthlyNew: 0,
        trend: 'up' as 'up' | 'down' | 'stable',
      };
    }
    return {
      total: statistics.total_formulas || total,
      draft: statistics.status_distribution?.draft || 0,
      pendingReview: statistics.status_distribution?.in_review || 0,
      approved: statistics.status_distribution?.approved || 0,
      monthlyNew: statistics.recent_creations?.reduce((sum, item) => sum + item.count, 0) || 0,
      trend:
        (statistics.trend_data?.[0]?.created || 0) > (statistics.trend_data?.[1]?.created || 0)
          ? 'up'
          : (statistics.trend_data?.[0]?.created || 0) < (statistics.trend_data?.[1]?.created || 0)
            ? 'down'
            : 'stable',
    };
  }, [statistics, total]);

  if (!has(FormulaPermission.VIEW)) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 px-4 lg:px-6">
        <div className="py-24">
          <EmptyState
            icon={<ShieldOff size={48} />}
            title="无权限访问"
            description="您没有查看配方列表的权限，请联系管理员申请相关权限"
          />
        </div>
      </div>
    );
  }

  // ── 骨架屏加载态 ──
  if (isLoading) {
    return <FormulaListSkeleton />;
  }

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto space-y-6 px-4 lg:px-6 py-6">

      {/* 顶部横幅 — 与 Dashboard 风格一致 */}
      <div className="rounded-xl bg-primary-600 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight">配方管理</h2>
              <span className="text-xs font-medium text-white/75 bg-white/15 px-2.5 py-0.5 rounded-full tabular-nums">
                {total} 条
              </span>
            </div>
            <p className="text-white/80 text-sm">
              {statsData.approved > 0 && (
                <span>
                  <span className="font-medium">{statsData.approved}</span> 已通过
                  {statsData.pendingReview > 0 && (
                    <span className="ml-4">
                      <span className="font-medium">{statsData.pendingReview}</span> 待审核
                    </span>
                  )}
                </span>
              )}
              {!statsData.approved && !statsData.pendingReview && <span>创建您的第一个药食同源配方</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* 视图切换 */}
          <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'px-3 py-2 transition-colors min-h-[44px] flex items-center justify-center',
                viewMode === 'card'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              )}
              title="卡片视图"
              aria-label="卡片视图"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'table'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
              )}
              title="表格视图"
              aria-label="表格视图"
            >
              <List size={16} />
            </button>
          </div>

          {/* 收藏筛选 */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              'p-2 rounded-lg border transition-all min-h-[44px] min-w-[44px]',
              favoritesOnly
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
            )}
            title={favoritesOnly ? '显示全部' : '只看收藏'}
            aria-label={favoritesOnly ? '显示全部配方' : '只看收藏'}
          >
            <Star size={16} className={favoritesOnly ? 'fill-amber-400' : ''} />
          </button>

          {/* 操作日志 */}
          <button
            onClick={() => setShowLogPanel(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-sm"
            aria-label="操作日志"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">日志</span>
          </button>

          <Link to="/formulas/new">
            <Button icon={<Plus size={16} />} size="md">
              新建配方
            </Button>
          </Link>
        </div>
      </div>
      </div>

      {/* 统计概览 — 主卡 + 3 辅卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="总配方数"
          value={statsData.total}
          icon={FlaskConical}
          variant="primary"
          size="large"
          subtitle={`本月新增 ${statsData.monthlyNew} 个配方`}
          trend={statsData.trend !== 'stable' ? { direction: statsData.trend as 'up' | 'down' | 'stable', value: `${statsData.monthlyNew} 本月` } : undefined}
        />
        <StatCard
          label="草稿"
          value={statsData.draft}
          icon={FileText}
          variant="secondary"
          subtitle="等待提交审核"
        />
        <StatCard
          label="待审核"
          value={statsData.pendingReview}
          icon={Clock}
          variant="warning"
          subtitle="需审批处理"
        />
        <StatCard
          label="已通过"
          value={statsData.approved}
          icon={CheckCircle2}
          variant="success"
          subtitle="可投入使用"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          主内容区域（三栏布局）
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ═══════════════ 移动端/平板端：顶部搜索栏 ═══════════════ */}
        <div className="lg:hidden col-span-12 space-y-3">
          <div className="relative">
            <Input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索配方名称或编号..."
              prefix={<Search size={14} className="text-neutral-400" />}
              className="h-11 w-full"
            />
            <button
              onClick={() => setShowMobileFilter(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="打开筛选面板"
            >
              <SlidersHorizontal size={18} />
            </button>
            <Modal open={showMobileFilter} onClose={() => setShowMobileFilter(false)} title="筛选条件">
              <div className="space-y-5 overflow-y-auto pb-4 max-h-[60vh]">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">状态</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleStatusFilter(opt.value)}
                        className={cn(
                          'px-4 py-3 rounded-xl text-sm font-medium transition-all border min-h-[44px]',
                          selectedStatuses.has(opt.value)
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">创建日期</label>
                  <div className="space-y-2">
                    <input type="date" value={createdStart} onChange={(e) => setCreatedStart(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-200 outline-none min-h-[44px]" />
                    <input type="date" value={createdEnd} onChange={(e) => setCreatedEnd(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-200 outline-none min-h-[44px]" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">标签</label>
                  <TagMultiSelect value={selectedTags} onChange={(ids) => { setSelectedTags(ids); setPage(1); }} placeholder="选择标签..." />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">功效分类</label>
                  <Select value={effectCategory} onValueChange={(v) => { setEffectCategory(v); setPage(1); }} className="w-full">
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="全部分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部分类</SelectItem>
                      {EFFECT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">配方分类</label>
                  <CategoryTree value={categoryIds} onChange={(ids) => { setCategoryIds(ids); setPage(1); }} placeholder="选择分类..." />
                </div>
                <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <Button variant="secondary" onClick={() => setShowMobileFilter(false)} className="flex-1 min-h-[48px]">应用筛选</Button>
                  <Button variant="outline" onClick={() => { clearAllFilters(); setShowMobileFilter(false); }} className="flex-1 min-h-[48px]">清除全部</Button>
                </div>
              </div>
            </Modal>
          </div>

          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <span className="text-xs font-medium text-neutral-500 shrink-0">已选：</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {activeFilterTags.slice(0, 3).map((tag, idx) => (
                  <Badge key={idx} variant="primary" size="sm" className="gap-1 cursor-pointer hover:bg-primary-200 transition-colors">
                    {tag.label.length > 10 ? `${tag.label.slice(0, 10)}...` : tag.label}
                    <button onClick={tag.onRemove} className="hover:text-error-500" aria-label="移除筛选"><X size={10} /></button>
                  </Badge>
                ))}
                {activeFilterTags.length > 3 && <Badge variant="neutral" size="sm">+{activeFilterTags.length - 3}</Badge>}
              </div>
              <button onClick={clearAllFilters} className="text-xs text-error-600 hover:text-error-700 font-medium shrink-0 ml-auto">清除</button>
            </div>
          )}
        </div>

        {/* ═══════════════ 左侧：筛选面板（桌面端）═══════════════ */}
        <Card className="hidden lg:block lg:col-span-3 transition-all duration-300 hover:shadow-md border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm h-fit overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {/* 卡片顶部色条 */}
          <div className="h-[3px] bg-gradient-to-r from-primary-500 via-primary-400 to-emerald-400 shrink-0" />
          <CardContent className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">筛选条件</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-neutral-400 hover:text-error-600 dark:hover:text-error-400 transition-colors px-2 py-1 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20"
                  aria-label="清除所有筛选"
                >
                  清除全部
                </button>
              )}
            </div>

            {/* 名称搜索 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">名称搜索</label>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索配方名称或编号…"
                prefix={<Search size={14} className="text-neutral-400" />}
                size="sm"
              />
            </div>

            {/* 状态多选 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">状态</label>
              <div className="space-y-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group py-1">
                    <Checkbox checked={selectedStatuses.has(opt.value)} onChange={() => toggleStatusFilter(opt.value)} />
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 日期范围 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">创建日期</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={createdStart} onChange={(e) => setCreatedStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-all" />
                <input type="date" value={createdEnd} onChange={(e) => setCreatedEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-all" />
              </div>
            </div>

            {/* 标签选择 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">标签</label>
              <TagMultiSelect value={selectedTags} onChange={(ids) => { setSelectedTags(ids); setPage(1); }} placeholder="选择标签…" />
            </div>

            {/* 功效分类 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">功效分类</label>
              <Select value={effectCategory} onValueChange={(v) => { setEffectCategory(v); setPage(1); }} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部分类</SelectItem>
                  {EFFECT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* 配方分类 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">配方分类</label>
              <CategoryTree value={categoryIds} onChange={(ids) => { setCategoryIds(ids); setPage(1); }} placeholder="选择分类…" />
            </div>

            {/* 创建者筛选 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">创建者</label>
              <Select value={creatorId} onValueChange={(v) => { setCreatorId(v); setPage(1); }} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="全部创建者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部创建者</SelectItem>
                  {creatorOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 显示设置 */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">每页数量</label>
              <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 快捷统计 */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3">当前筛选结果</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">总数</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white tabular-nums">{total}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
                  <p className="text-xs text-primary-600 dark:text-primary-400 mb-0.5">已通过</p>
                  <p className="text-lg font-semibold text-primary-700 dark:text-primary-300 tabular-nums">{statsData.approved}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-0.5">待审核</p>
                  <p className="text-lg font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{statsData.pendingReview}</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">收藏</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white tabular-nums">{favorites.size}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ 中间：主内容区 ═══════════════ */}
        <div className="lg:col-span-9 space-y-5">

          {/* ── 筛选条件 Tag 展示栏 ── */}
          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 animate-in fade-in duration-200">
              <span className="text-xs font-medium text-neutral-500">当前筛选：</span>
              {activeFilterTags.map((tag, idx) => (
                <Badge key={idx} variant="primary" size="sm" className="gap-1 cursor-pointer hover:bg-primary-200 transition-colors">
                  {tag.label}
                  <button onClick={tag.onRemove} className="hover:text-error-500" aria-label={`移除筛选: ${tag.label}`}><X size={10} /></button>
                </Badge>
              ))}
              <button onClick={clearAllFilters} className="text-xs text-error-600 hover:text-error-700 font-medium ml-auto">清除全部</button>
            </div>
          )}

          {/* ── 批量操作提示条 ── */}
          {selectedIds.size > 0 && (
            <Alert className="rounded-xl border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/20 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
              <AlertTitle className="text-sm font-medium">
                已选择 <strong className="text-primary-700 dark:text-primary-300">{selectedIds.size}</strong> 个配方
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2 mt-2">
                {has(FormulaPermission.EXPORT) && (
                  <Button size="md" variant="outline" className="min-h-[44px]" onClick={handleBatchExport}>
                    <Download className="w-3.5 h-3.5 mr-1" /> 导出选中
                  </Button>
                )}
                {has(FormulaPermission.DELETE) && (
                  <Button size="md" variant="danger" className="min-h-[44px]" onClick={handleBatchDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 批量删除
                  </Button>
                )}
                {has(FormulaPermission.EDIT) && (
                  <div className="relative inline-block">
                    <Button size="md" variant="outline" icon={<ArrowRightLeft className="w-3.5 h-3.5 mr-1" />} className="min-h-[44px]" aria-haspopup="listbox">
                      批量改状态
                    </Button>
                    <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50" role="listbox">
                      {STATUS_OPTIONS.map((opt) => (
                        <button key={opt.value} className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          onClick={() => { handleBatchStatusChange(opt.value as FormulaStatus); }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Button size="md" variant="ghost" className="text-neutral-500 min-h-[44px]" onClick={() => setSelectedIds(new Set())}>
                  取消选择
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── 错误状态 ── */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription className="flex items-center gap-2 mt-1.5">
                <span>无法获取配方数据，请检查网络连接后重试</span>
                <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['formulas-list'] })}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> 重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── 主内容区域（响应式：移动端强制卡片视图）── */}
          <Card className="transition-shadow duration-200 border-neutral-200 dark:border-neutral-700 overflow-visible bg-white dark:bg-neutral-900 shadow-sm">
            {isLoading ? (
              viewMode === 'card' || isMobile ? (
                <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 md:p-5">
                        <Skeleton className="h-5 w-1/3 mb-3" />
                        <Skeleton className="h-3 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )
            ) : items.length === 0 ? (
              /* 空状态 — 更精致的引导 */
              <div className="py-16 md:py-20">
                <EmptyState
                  icon={
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                      <FlaskConical size={24} className="text-primary-500 dark:text-primary-400" />
                    </div>
                  }
                  title={hasActiveFilters ? '没有匹配的配方' : '暂无配方'}
                  titleClassName="text-xl md:text-2xl font-semibold text-neutral-900 dark:text-white"
                  description={
                    hasActiveFilters
                      ? '尝试调整搜索关键词或筛选条件，让数据重新显现'
                      : '创建您的第一个配方，开始智能配方设计之旅'
                  }
                  descriptionClassName="text-sm md:text-base text-neutral-500 dark:text-neutral-400 mt-2"
                  action={
                    hasActiveFilters ? (
                      <Button variant="secondary" onClick={clearAllFilters} className="min-h-[44px]">
                        清除筛选条件
                      </Button>
                    ) : (
                      <Link to="/formulas/new">
                        <Button icon={<Plus size={16} />} size="md" className="min-h-[44px] shadow-md hover:shadow-lg">
                          新建配方
                        </Button>
                      </Link>
                    )
                  }
                />
              </div>
            ) : viewMode === 'card' || isMobile ? (
              /* 卡片视图（移动端自动启用） */
              <div ref={parentRef} className="overflow-auto" style={{ maxHeight: '60vh', minHeight: '400px' }}>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 p-4 md:p-5"
                  style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                >
                  {shouldUseVirtualizer
                    ? virtualizer.getVirtualItems().map((virtualRow) => {
                        const formula = items[virtualRow.index];
                        return (
                          <div
                            key={formula.id}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <FormulaCard
                              formula={formula}
                              search={debouncedSearch}
                              isFavorite={favorites.has(formula.id)}
                              isSelected={selectedIds.has(formula.id)}
                              onToggleFavorite={() => toggleFavoriteItem(formula.id)}
                              onToggleSelect={() => toggleSelect(formula.id)}
                              onPreview={() => setPreviewId(formula.id)}
                            />
                          </div>
                        );
                      })
                    : items.map((formula) => (
                        <FormulaCard
                          key={formula.id}
                          formula={formula}
                          search={debouncedSearch}
                          isFavorite={favorites.has(formula.id)}
                          isSelected={selectedIds.has(formula.id)}
                          onToggleFavorite={() => toggleFavoriteItem(formula.id)}
                          onToggleSelect={() => toggleSelect(formula.id)}
                          onPreview={() => setPreviewId(formula.id)}
                        />
                      ))}
                </div>
              </div>
            ) : (
              /* 表格视图 */
              <>
                <div ref={parentRef} className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
                  <table className="w-full text-sm" role="table" aria-label="配方列表">
                    <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-[13px] font-medium">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <Checkbox
                            checked={selectedIds.size === items.length && items.length > 0}
                            indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                            onChange={toggleSelectAll}
                            aria-label="全选"
                          />
                        </th>
                        <th
                          className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors group"
                          onClick={() => handleSort('name')}
                          aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            名称{' '}
                            <SortIcon field="name" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th
                          className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors"
                          onClick={() => handleSort('status')}
                          aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            状态{' '}
                            <SortIcon field="status" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 hidden lg:table-cell">成分数量</th>
                        <th className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 hidden xl:table-cell">创建者</th>
                        <th className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 hidden xl:table-cell">关联实验</th>
                        <th
                          className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 hidden xl:table-cell cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors"
                          onClick={() => handleSort('created_at')}
                          aria-sort={sortField === 'created_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            创建日期{' '}
                            <SortIcon field="created_at" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th
                          className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors"
                          onClick={() => handleSort('updated_at')}
                          aria-sort={sortField === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            更新日期{' '}
                            <SortIcon field="updated_at" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-neutral-600 dark:text-neutral-400 w-20">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                      {items.map((formula, idx) => {
                        const isSelected = selectedIds.has(formula.id);
                        const showMenu = actionMenuId === formula.id;
                        return (
                          <tr
                            key={formula.id}
                            className={cn(
                              'group transition-all duration-150 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40',
                              isSelected && 'bg-primary-50/60 dark:bg-primary-950/20 ring-1 ring-primary-200 dark:ring-primary-800',
                            )}
                            style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleSelect(formula.id)}
                                aria-label={`选择配方 ${formula.name}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleFavoriteItem(formula.id)} className="shrink-0" aria-label={favorites.has(formula.id) ? '取消收藏' : '收藏'} aria-pressed={favorites.has(formula.id)}>
                                  <Star size={14} className={favorites.has(formula.id) ? 'fill-amber-400 text-warning-400' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400 transition-colors'} />
                                </button>
                                <Link to={`/formulas/${formula.id}`} className="font-medium text-neutral-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[180px]">
                                  <Highlight text={formula.name} keyword={debouncedSearch} />
                                </Link>
                                <Badge variant="neutral" size="sm" className="text-[10px]">v{formula.version}</Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={formula.status} />
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 hidden xl:table-cell">
                              {formula.ingredients?.length ?? 0}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 hidden xl:table-cell truncate max-w-[120px]">
                              {formula.creator_name || '-'}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 hidden xl:table-cell">
                              {formatDate(formula.createdAt || formula.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                              {formula.experimentIds && formula.experimentIds.length > 0 ? (
                                <Link to={`/experiments?formula_id=${formula.id}`} className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                                  <TestTubes size={12} />
                                  {formula.experimentIds.length} 个实验
                                </Link>
                              ) : (
                                <span className="text-xs text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                              {formatDate(formula.updatedAt || formula.updatedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative inline-block" ref={showMenu ? actionMenuRef : undefined}>
                                <button
                                  onClick={() => setActionMenuId(showMenu ? null : formula.id)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                                  aria-label={`${formula.name} 的操作菜单`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMenu && (
                                  <div
                                    ref={actionMenuRef}
                                    role="menu"
                                    aria-label={`${formula.name || '配方'} 的操作菜单`}
                                    className="absolute right-0 w-44 bg-white dark:bg-neutral-800 rounded-lg shadow-md border border-neutral-200/80 dark:border-neutral-700 py-1 z-[60] min-w-[176px]"
                                    style={{ top: 'calc(100% + 6px)', maxHeight: 'none' }}
                                  >
                                    <div className="absolute -top-1.5 right-3 w-2.5 h-2.5 bg-white dark:bg-neutral-800 border-l border-t border-neutral-200 dark:border-neutral-700 rotate-45 shadow-sm" />

                                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                      onClick={() => { navigate(`/formulas/${formula.id}`); setActionMenuId(null); }}>
                                      <FileText className="w-4 h-4 text-neutral-400" /> 查看详情
                                    </button>

                                    {has(FormulaPermission.EDIT) && (
                                      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                                        onClick={() => { navigate(`/formulas/${formula.id}/edit`); setActionMenuId(null); }}>
                                        <Edit3 className="w-4 h-4 text-neutral-400" /> 编辑
                                      </button>
                                    )}

                                    {has(FormulaPermission.CREATE) && (
                                      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                                        onClick={() => { handleDuplicate(formula); setActionMenuId(null); }}>
                                        <Copy className="w-4 h-4 text-neutral-400" /> 复制
                                      </button>
                                    )}

                                    {has(FormulaPermission.EXPORT) && (
                                      <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                                        onClick={() => { handleExportSingle(formula); setActionMenuId(null); }}>
                                        <Download className="w-4 h-4 text-neutral-400" /> 导出单个
                                      </button>
                                    )}

                                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                                      onClick={() => { navigate(`/experiments/new?formula_id=${formula.id}`); setActionMenuId(null); }}>
                                      <TestTubes className="w-4 h-4 text-neutral-400" /> 关联实验
                                    </button>

                                    {has(FormulaPermission.DELETE) && (
                                      <>
                                        <div className="my-1 mx-3 border-t border-neutral-100 dark:border-neutral-700" />
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                                          onClick={() => { setDeleteConfirmId(formula.id); setActionMenuId(null); }}>
                                          <Trash2 className="w-4 h-4" /> 删除
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── 分页组件 ── */}
                {totalPages > 1 && (
                  <div className="px-4 md:px-6 py-3 md:py-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-800">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 order-2 sm:order-1">
                      <span className="sm:hidden">第 {page}/{totalPages} 页</span>
                      <span className="hidden sm:inline">
                        显示第<span className="font-medium text-neutral-700 dark:text-neutral-300">{(page - 1) * pageSize + 1}</span>
                        -<span className="font-medium text-neutral-700 dark:text-neutral-300">{Math.min(page * pageSize, total)}</span>
                        {' '}条，共<span className="font-medium text-neutral-700 dark:text-neutral-300">{total}</span> 条
                      </span>
                    </p>
                    <div className="flex items-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex sm:hidden items-center gap-2 w-full">
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="flex-1 min-h-[44px]" icon={<ChevronLeft size={16} />}>
                          上一页
                        </Button>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 min-w-[60px] text-center tabular-nums">
                          {page}/{totalPages}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="flex-1 min-h-[44px]" icon={<ChevronRight size={16} />}>
                          下一页
                        </Button>
                      </div>
                      <div className="hidden sm:flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2">
                          <span className="text-xs text-neutral-500">跳至</span>
                          <input type="number" min={1} max={totalPages} value={page}
                            onChange={(e) => { const val = Math.min(Math.max(1, Number(e.target.value)), totalPages); if (!isNaN(val)) setPage(val); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { const val = Math.min(Math.max(1, Number(e.currentTarget.value)), totalPages); if (!isNaN(val)) setPage(val); } }}
                            className="w-14 px-2 py-1 text-xs border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-center focus:ring-2 focus:ring-primary-200 outline-none"
                          />
                          <span className="text-xs text-neutral-500">/{totalPages}</span>
                        </div>
                        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* ═══════════════ 右侧：最近配方预览 + 导入导出 ═══════════════ */}
        <div className="lg:col-span-3 space-y-4">
          {/* 最近配方 */}
          <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm h-fit">
            {/* 顶部色条 */}
            <div className="h-[3px] bg-gradient-to-r from-primary-500 to-emerald-400" />
            <CardHeader className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Clock size={14} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <CardTitle as="h3" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">最近更新</CardTitle>
                </div>
                <Link to="/formulas" className="text-xs font-medium text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  全部 <ArrowRight size={11} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-4 pt-0">
              {recentFormulas.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <FlaskConical size={16} className="text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">暂无最近配方</p>
                </div>
              ) : (
                <div className="px-3 py-1">
                  {recentFormulas.slice(0, 5).map((f, idx) => (
                    <Link
                      key={f.id}
                      to={`/formulas/${f.id}`}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all cursor-pointer mb-0.5 last:mb-0"
                    >
                      {/* 序号指示 */}
                      <span className={cn(
                        'w-5 h-5 rounded-md text-[10px] font-semibold flex items-center justify-center shrink-0',
                        idx === 0 ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : idx === 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : idx === 2 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400',
                      )}>{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          <Highlight text={f.name} keyword={debouncedSearch} />
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">
                          {f.code} · {formatDate(f.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge status={f.status} size="sm" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 导入导出 */}
          <Card className="overflow-hidden border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm h-fit">
            {/* 顶部色条 */}
            <div className="h-[3px] bg-gradient-to-r from-violet-500 to-purple-400" />
            <CardHeader className="px-6 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Download size={14} className="text-violet-600 dark:text-violet-400" />
                </div>
                <CardTitle as="h3" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">导入导出</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json,.csv';
                  input.onchange = async (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files?.[0]) {
                      try {
                        await formulaApi.importFormulas({ file: target.files[0], mode: 'all' });
                        qc.invalidateQueries({ queryKey: ['formulas-list'] });
                      } catch (err) {
                        logger.error('导入失败:', err);
                      }
                    }
                  };
                  input.click();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/60 dark:hover:bg-primary-900/15 transition-all text-left group min-h-[48px]"
              >
                <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download size={16} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">导入配方</p>
                  <p className="text-xs text-neutral-400 mt-0.5">JSON / CSV 格式</p>
                </div>
                <ArrowRight size={14} className="text-neutral-300 group-hover:text-primary-500 transition-colors shrink-0" />
              </button>

              <button
                onClick={() => {
                  const selected = items.filter((f) => selectedIds.has(f.id));
                  exportFormulasCSV(selected.length > 0 ? selected : items);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/60 dark:hover:bg-violet-900/15 transition-all text-left group min-h-[48px]"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">导出 CSV</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {selectedIds.size > 0 ? `已选 ${selectedIds.size} 条` : '全部数据'}
                  </p>
                </div>
                <ArrowRight size={14} className="text-neutral-300 group-hover:text-violet-500 transition-colors shrink-0" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 快速预览 Modal ── */}
      <FormulaQuickView
        formulaId={previewId}
        onClose={() => setPreviewId(null)}
        onNavigate={(id) => navigate(`/formulas/${id}`)}
      />

      {/* ── 删除确认对话框 ── */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="确认删除">
        {deleteConfirmId && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              确定要删除该配方吗？此操作将永久删除该配方及其相关数据，删除后无法恢复。
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="danger" size="sm" onClick={() => handleDelete(deleteConfirmId)} className="flex-1 min-h-[44px]">
                <Trash2 className="w-4 h-4 mr-1.5" /> 确认删除
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} className="flex-1 min-h-[44px]">
                取消
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── 键盘快捷键提示（桌面端）── */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-40">
        <Tooltip
          content={
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span>聚焦搜索</span>
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">Ctrl+F</kbd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>新建配方</span>
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">Ctrl+N</kbd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>关闭弹窗</span>
                <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded text-[10px] font-mono">Esc</kbd>
              </div>
            </div>
          }
        >
          <button className="p-2.5 rounded-xl bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/80 dark:border-neutral-700/60 shadow-lg hover:shadow-xl transition-all text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" aria-label="键盘快捷键">
            <Keyboard size={16} />
          </button>
        </Tooltip>
      </div>

      <OperationLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />
      </div>
    </div>
  );
}



