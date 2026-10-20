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
import { useTranslation } from 'react-i18next';
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
  RefreshCw,
  AlertTriangle,
  Clock,
  Keyboard,
  ShieldOff,
  TestTubes,
  ArrowRight,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formulaApi } from '@/api/formula';
import type { FormulaListQueryParams, FormulaStatus, Formula } from '@/types/formula';
import type { ViewMode } from './types';
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
import { logger } from '@/utils/safeLogger';
import i18n from '@/i18n';
import { usePermission, FormulaPermission } from '@/utils/permissions';
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
  { value: 'draft', label: '草稿', color: 'bg-[var(--bg-secondary)]/50 text-[var(--text-primary)]' },
  { value: 'pending_review', label: '待审核', color: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]' },
  { value: 'approved', label: '已通过', color: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]' },
  { value: 'rejected', label: '已驳回', color: 'bg-[var(--color-error-container)] text-[var(--color-error-text)]' },
  { value: 'archived', label: '已归档', color: 'bg-[var(--bg-secondary)]/50 text-[var(--text-primary)]' },
  { value: 'cancelled', label: '已取消', color: 'bg-[var(--bg-secondary)]/50 text-[var(--text-primary)]' },
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
  const headers = [
    i18n.t('pages.formula.exportCsv.code'),
    i18n.t('pages.formula.exportCsv.name'),
    i18n.t('pages.formula.exportCsv.status'),
    i18n.t('pages.formula.exportCsv.version'),
    i18n.t('pages.formula.exportCsv.targetEffects'),
    i18n.t('pages.formula.exportCsv.description'),
    i18n.t('pages.formula.exportCsv.createdAt'),
    i18n.t('pages.formula.exportCsv.updatedAt'),
  ];
  const rows = formulas.map((f) => [
    f.code,
    f.name,
    getStatusLabel(f.status),
    `v${f.version}`,
    f.targetEffects?.join('; ') || '',
    f.description || '',
    new Date(f.createdAt).toLocaleDateString(i18n.language),
    new Date(f.updatedAt).toLocaleDateString(i18n.language),
  ]);
  const csv =
    BOM +
    [headers, ...rows].map((r) => r.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${i18n.t('pages.formula.exportCsv.fileName')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getStatusLabel(status: FormulaStatus): string {
  const key = status as string;
  return i18n.exists(`common.statusLabels.${key}`) ? i18n.t(`common.statusLabels.${key}`) : key;
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
    return <ArrowUpDown size={12} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />;
  }

  return (
    <span className="inline-flex items-center gap-[2px] ml-1">
      {isPrimary && (
        <span
          className="text-[var(--color-primary-text)]"
          title={i18n.t('pages.formula.primarySort', { dir: primaryDir === 'asc' ? i18n.t('pages.formula.asc') : i18n.t('pages.formula.desc') })}
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
          className="text-[var(--text-muted)]"
          title={i18n.t('pages.formula.secondarySort', { dir: secondaryDir === 'asc' ? i18n.t('pages.formula.asc') : i18n.t('pages.formula.desc') })}
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
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { has } = usePermission();
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
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const batchMenuRef = useRef<HTMLDivElement>(null);
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
    staleTime: 5 * 60_000,
  });
  const recentFormulas = recentData?.items ?? [];

  // ── 数据提取（去重：避免重复/undefined id 导致 React key 冲突） ──
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (listData?.items ?? []).filter((item) => {
      if (!item || item.id == null || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [listData]);
  const total = listData?.total ?? 0;
  const totalPages = listData?.total_pages ?? 0;

  // 负责人选项 — 从已创建的配方中聚合
  const creatorOptions = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((f) => {
      // 兼容后端 snake_case（creator_id）与前端 camelCase（creatorId）字段
      const rawId = (f as unknown as Record<string, unknown>).creator_id ?? f.creatorId;
      if (rawId == null) return;
      const id = Number(rawId);
      if (Number.isNaN(id)) return;
      const name = f.creator_name || `ID:${id}`;
      map.set(name, id);
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
      if (batchMenuRef.current && !batchMenuRef.current.contains(e.target as Node)) {
        setBatchMenuOpen(false);
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
        setBatchMenuOpen(false);
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
    if (!window.confirm(i18n.t('pages.formula.confirmBatchDelete', { count: selectedIds.size }))) return;
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
      if (!window.confirm(i18n.t('pages.formula.confirmBatchStatusChange', { count: selectedIds.size, status: getStatusLabel(targetStatus) }))) return;
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
    if (favoritesOnly) tags.push({ label: i18n.t('pages.formula.favoritesOnly'), onRemove: () => setFavoritesOnly(false) });
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
      <div className="max-w-[1600px] mx-auto space-y-8 px-[var(--space-apple-md)] lg:px-[var(--space-apple-lg)]">
        <div className="py-24">
          <EmptyState
            icon={<ShieldOff size={48} />}
            title={t('pages.formula.noPermissionTitle')}
            description={t('pages.formula.noPermissionDesc')}
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
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-[var(--space-apple-lg)] px-[var(--space-apple-md)] lg:px-[var(--space-apple-lg)] py-[var(--space-apple-lg)]">

      {/* 顶部横幅 — 与 Dashboard 风格一致 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.formula.title')}</h1>
              {/* A-23：页面此前只有 h1 + h3，「最近更新」卡片标题直接从 1 跳到 3。
                  补一个屏幕阅读器可见的 h2 承接正文区，大纲恢复 h1 → h2 → h3。 */}
              <h2 className="sr-only">{t('pages.formula.listTitle')}</h2>
              <span className="text-xs font-medium bg-[var(--bg-secondary)]/90 text-[var(--text-primary)] px-2.5 py-0.5 rounded-[var(--radius-pill)] tabular-nums">
                {t('pages.formula.totalCount', { total })}
              </span>
            </div>
            <p className="text-white/80 text-sm hidden sm:block">
              {statsData.approved > 0 && (
                <span>
                  <span className="font-medium">{statsData.approved}</span> {t('pages.formula.approved')}
                  {statsData.pendingReview > 0 && (
                    <span className="ml-4">
                      <span className="font-medium">{statsData.pendingReview}</span> {t('pages.formula.pendingReview')}
                    </span>
                  )}
                </span>
              )}
              {!statsData.approved && !statsData.pendingReview && <span>{t('pages.formula.firstFormulaCta')}</span>}
            </p>
          </div>
          {/* D-60：该工具栏位于 .surface-primary（品牌实底绿色横幅）内部，
              但内部控件全部使用浅色卡片配色（text-[var(--text-secondary)] / border-[var(--border-color)] dark:border-neutral-700 /
              bg-[var(--color-primary-container)] …），直接压在绿底上最低仅 1.38:1。
              给工具栏独立浅色容器，使控件回到其设计底色上，一举修复整组控件。 */}
          {/* D-69：暗色下 /40 的 neutral-900 蒙版压在品牌实底横幅上只得到
              rgb(10,66,59)，工具条内的 dark:text-[var(--text-muted)] (#94a3b8) 为 4.41:1，
              差一点不达 AA。把暗色蒙版提到 /80（得到 rgb(13,37,48) 的深色容器）
              后同一文字为 6.16:1；亮色 /95 原本就达标，保持不变。 */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto bg-[var(--bg-secondary)]/95 rounded-[var(--radius-Apple-md)] p-2">
          {/* 视图切换 */}
          <div className="flex items-center border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'px-[var(--space-apple-sm)] py-2 min-w-[44px] min-h-[44px] transition-colors flex items-center justify-center',
                viewMode === 'card'
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
              title={t('pages.formula.cardView')}
              aria-label={t('pages.formula.cardView')}
            >
              <LayoutGrid size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                /* A-20：与卡片视图按钮对称，补 44×44 触控区（原 32×32）。 */
                'p-2 min-w-[44px] min-h-[44px] transition-colors flex items-center justify-center',
                viewMode === 'table'
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
              title={t('pages.formula.tableView')}
              aria-label={t('pages.formula.tableView')}
            >
              <List size={16} aria-hidden="true" />
            </button>
          </div>

          {/* 收藏筛选 */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              'p-2 rounded-[var(--radius-Apple-sm)] border transition-all min-h-[44px] min-w-[44px]',
              favoritesOnly
                ? 'bg-[var(--color-warning-container)] border-[var(--color-warning-border)] text-[var(--color-warning-text)]'
                : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
            title={favoritesOnly ? t('pages.formula.showAll') : t('pages.formula.favoritesOnly')}
            aria-label={favoritesOnly ? t('pages.formula.showAllFavorites') : t('pages.formula.favoritesOnly')}
          >
            <Star size={16} aria-hidden="true" className={favoritesOnly ? 'fill-[var(--color-warning-text)] text-[var(--color-warning-text)]' : ''} />
          </button>

          {/* 操作日志 */}
          <button
            onClick={() => setShowLogPanel(true)}
            className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 min-h-[44px] min-w-[44px] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all text-sm"
            aria-label={t('pages.formula.operationLog')}
          >
            <FileText size={14} />
            <span className="hidden sm:inline">{t('pages.formula.log')}</span>
          </button>

          <Link to="/formulas/new">
            <Button icon={<Plus size={16} />} size="md">
              {t('pages.formula.newFormula')}
            </Button>
          </Link>
        </div>
      </div>
      </div>

      {/* 统计概览 — 主卡 + 3 辅卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t('pages.formula.totalFormulas')}
          value={statsData.total}
          icon={FlaskConical}
          variant="primary"
          size="large"
          subtitle={t('pages.formula.monthlyNew', { count: statsData.monthlyNew })}
          trend={statsData.trend !== 'stable' ? { direction: statsData.trend as 'up' | 'down' | 'stable', value: t('pages.formula.monthly', { count: statsData.monthlyNew }) } : undefined}
        />
        <StatCard
          label={t('pages.formula.draft')}
          value={statsData.draft}
          icon={FileText}
          variant="secondary"
          subtitle={t('pages.formula.draftSubtitle')}
        />
        <StatCard
          label={t('pages.formula.pendingReview')}
          value={statsData.pendingReview}
          icon={Clock}
          variant="warning"
          subtitle={t('pages.formula.pendingReviewSubtitle')}
        />
        <StatCard
          label={t('pages.formula.approved')}
          value={statsData.approved}
          icon={CheckCircle2}
          variant="success"
          subtitle={t('pages.formula.approvedSubtitle')}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          主内容区域（三栏布局）
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ═══════════════ 移动端/平板端：顶部搜索栏 ═══════════════ */}
        <div className="lg:hidden col-span-12 space-y-[var(--space-apple-md)]">
          <div className="relative">
            {/* A-24：移动端顶部的搜索框（lg:hidden 分支）——placeholder 不是可访问名称，
                它与筛选面板里那个搜索框是两个独立实例，需要各自带 aria-label。 */}
            <Input
              ref={searchInputRef}
              aria-label={t('pages.formula.searchAria')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('pages.formula.searchPlaceholder')}
              prefix={<Search size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
              className="h-11 w-full"
            />
            <button
              onClick={() => setShowMobileFilter(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('pages.formula.openFilter')}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </button>
            <Modal open={showMobileFilter} onClose={() => setShowMobileFilter(false)} title={t('pages.formula.filterConditions')}>
              <div className="space-y-[var(--space-apple-lg)] overflow-y-auto pb-[var(--space-apple-md)] max-h-[60vh]">
                <div className="space-y-[var(--space-apple-md)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.status')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleStatusFilter(opt.value)}
                        className={cn(
                          'px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] text-sm font-medium transition-all border min-h-[44px]',
                          selectedStatuses.has(opt.value)
                            ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                            : 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--border-color)]',
                        )}
                      >
                        {t(`common.statusLabels.${opt.value}`, { defaultValue: opt.label })}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-[var(--space-apple-md)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.createdDate')}</label>
                  <div className="space-y-[var(--space-apple-sm)]">
                    <input type="date" value={createdStart} onChange={(e) => setCreatedStart(e.target.value)}
                      className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-sm border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--color-primary-container)] outline-none min-h-[44px]"
        aria-label={t('pages.formula.dateStart')}
      />
                    <input type="date" value={createdEnd} onChange={(e) => setCreatedEnd(e.target.value)}
                      className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-sm border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--color-primary-container)] outline-none min-h-[44px]"
        aria-label={t('pages.formula.dateEnd')}
      />
                  </div>
                </div>
                <div className="space-y-[var(--space-apple-md)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.tags')}</label>
                  <TagMultiSelect value={selectedTags} onChange={(ids) => { setSelectedTags(ids); setPage(1); }} placeholder={t('pages.formula.selectTagsPlaceholder')} />
                </div>
                <div className="space-y-[var(--space-apple-md)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.effectCategory')}</label>
                  <Select value={effectCategory} onValueChange={(v) => { setEffectCategory(v); setPage(1); }} className="w-full">
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder={t('pages.formula.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('pages.formula.allCategories')}</SelectItem>
                      {EFFECT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-[var(--space-apple-md)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.formulaCategory')}</label>
                  <CategoryTree value={categoryIds} onChange={(ids) => { setCategoryIds(ids); setPage(1); }} placeholder={t('pages.formula.selectCategoryPlaceholder')} />
                </div>
                <div className="flex gap-4 pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
                  <Button variant="secondary" onClick={() => setShowMobileFilter(false)} className="flex-1 min-h-[48px]">{t('pages.formula.applyFilters')}</Button>
                  <Button variant="outline" onClick={() => { clearAllFilters(); setShowMobileFilter(false); }} className="flex-1 min-h-[48px]">{t('pages.formula.clearAll')}</Button>
                </div>
              </div>
            </Modal>
          </div>

          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]">
              <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">{t('pages.formula.currentFilters')}</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {activeFilterTags.slice(0, 3).map((tag, idx) => (
                  <Badge key={idx} variant="primary" size="sm" className="gap-1 cursor-pointer hover:bg-[var(--color-primary-container)] transition-colors">
                    {tag.label.length > 10 ? `${tag.label.slice(0, 10)}...` : tag.label}
                    <button onClick={tag.onRemove} className="hover:text-[var(--color-error-text)]" aria-label={t('pages.formula.removeFilter', { label: tag.label })}><X size={10} /></button>
                  </Badge>
                ))}
                {activeFilterTags.length > 3 && <Badge variant="neutral" size="sm">+{activeFilterTags.length - 3}</Badge>}
              </div>
              <button onClick={clearAllFilters} className="text-xs text-[var(--color-error-text)] hover:text-[var(--color-error-text)] font-medium shrink-0 ml-auto">{t('pages.formula.clearAll')}</button>
            </div>
          )}
        </div>

        {/* ═══════════════ 左侧：筛选面板（桌面端）═══════════════ */}
        <Card className="hidden lg:block lg:col-span-3 transition-all duration-300 hover:shadow-md border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm h-fit overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {/* 卡片顶部色条 */}
          <div className="h-[3px] bg-[var(--color-primary-text)] shrink-0" />
          <CardContent className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-lg)] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <div className="flex items-center justify-between pb-[var(--space-apple-md)] border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] flex items-center justify-center">
                  <Filter className="w-4 h-4 text-[var(--color-primary-text)]" />
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.filterConditions')}</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--color-error-text)] transition-colors px-2 py-1 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-error-container)]"
                  aria-label={t('pages.formula.clearAllFilters')}
                >
                  {t('pages.formula.clearAll')}
                </button>
              )}
            </div>

            {/* 名称搜索 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.nameSearch')}</label>
              <Input
                /* A-23：placeholder 不算可访问名称（WCAG 4.1.2 / 1.3.1）。
                   该输入框的 <label> 是兄弟节点且没有 htmlFor，无法形成关联。 */
                aria-label={t('pages.formula.searchAria')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('pages.formula.searchPlaceholder')}
                prefix={<Search size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
              />
            </div>

            {/* 状态多选 */}
            <div className="space-y-[var(--space-apple-sm)]">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.status')}</label>
              <div className="space-y-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  /* A-23：原 192×28，未达 WCAG 2.5.5 的 44×44 —— 整行 label 就是
                     命中区，给它 min-h-[44px]；同时给 Checkbox 补 aria-label，
                     因为 Radix 渲染的是 <button role=checkbox>，外层 <label>
                     并不会为它提供可访问名称。 */
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group py-1 min-h-[44px]">
                    <Checkbox checked={selectedStatuses.has(opt.value)} onCheckedChange={() => toggleStatusFilter(opt.value)} aria-label={`${t('pages.formula.status')}: ${t(`common.statusLabels.${opt.value}`, { defaultValue: opt.label })}`} />
                    <span className="text-sm text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {t(`common.statusLabels.${opt.value}`, { defaultValue: opt.label })}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 日期范围 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.createdDate')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* A-23：原 92×34（<44），且日期输入框没有可访问名称 */}
                <input type="date" value={createdStart} onChange={(e) => setCreatedStart(e.target.value)} aria-label={t('pages.formula.dateStart')}
                  className="w-full px-[var(--space-apple-sm)] py-2 min-h-[44px] text-xs border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--color-primary-container)] focus:border-[var(--color-primary-text)] outline-none transition-all" />
                <input type="date" value={createdEnd} onChange={(e) => setCreatedEnd(e.target.value)} aria-label={t('pages.formula.dateEnd')}
                  className="w-full px-[var(--space-apple-sm)] py-2 min-h-[44px] text-xs border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--color-primary-container)] focus:border-[var(--color-primary-text)] outline-none transition-all" />
              </div>
            </div>

            {/* 标签选择 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.tags')}</label>
              <TagMultiSelect value={selectedTags} onChange={(ids) => { setSelectedTags(ids); setPage(1); }} placeholder={t('pages.formula.selectTagsPlaceholder')} />
            </div>

            {/* 功效分类 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.effectCategory')}</label>
              <Select value={effectCategory} onValueChange={(v) => { setEffectCategory(v); setPage(1); }} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('pages.formula.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('pages.formula.allCategories')}</SelectItem>
                  {EFFECT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* 配方分类 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.formulaCategory')}</label>
              <CategoryTree value={categoryIds} onChange={(ids) => { setCategoryIds(ids); setPage(1); }} placeholder={t('pages.formula.selectCategoryPlaceholder')} />
            </div>

            {/* 创建者筛选 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.creator')}</label>
              <Select value={creatorId} onValueChange={(v) => { setCreatorId(v); setPage(1); }} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('pages.formula.allCreators')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('pages.formula.allCreators')}</SelectItem>
                  {creatorOptions.map((opt, idx) => (
                    <SelectItem key={`${opt.value}-${idx}`} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 显示设置 */}
            <div className="pt-[var(--space-apple-md)] border-t border-[var(--border-color)] space-y-[var(--space-apple-sm)]">
              <label className="text-xs font-medium text-[var(--text-primary)]">{t('pages.formula.pageSize')}</label>
              <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))} className="w-full">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{t('pages.formula.pageSizeOptions', { size: opt.value })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 快捷统计 */}
            <div className="pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-[var(--space-apple-md)]">{t('pages.formula.currentFilterResults')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]">
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('pages.formula.total')}</p>
                  <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">{total}</p>
                </div>
                <div className="px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] border border-[var(--color-primary-border)]">
                  <p className="text-xs text-[var(--color-primary-text)] mb-0.5">{t('pages.formula.approved')}</p>
                  <p className="text-base font-semibold text-[var(--color-primary-text)] tabular-nums">{statsData.approved}</p>
                </div>
                <div className="px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] border border-[var(--color-warning-border)]">
                  {/* A-35：原 text-[var(--color-warning-text)](#d97706) 压 bg-[var(--color-warning-container)](#fffbeb) 仅 3.07:1；
                      同张卡的数值已是 700 档，标签却是 600 档，本来就不一致。 */}
                  <p className="text-xs text-[var(--color-warning-text)] mb-0.5">{t('pages.formula.pendingReview')}</p>
                  <p className="text-base font-semibold text-[var(--color-warning-text)] tabular-nums">{statsData.pendingReview}</p>
                </div>
                <div className="px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]">
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('pages.formula.favorites')}</p>
                  <p className="text-base font-semibold text-[var(--text-primary)] tabular-nums">{favorites.size}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ 中间：主内容区 ═══════════════ */}
        <div className="lg:col-span-9 space-y-[var(--space-apple-lg)]">

          {/* ── 筛选条件 Tag 展示栏 ── */}
          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] animate-in fade-in duration-200">
              <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.formula.currentFilters')}</span>
              {activeFilterTags.map((tag, idx) => (
                <Badge key={idx} variant="primary" size="sm" className="gap-1 cursor-pointer hover:bg-[var(--color-primary-container)] transition-colors">
                  {tag.label}
                  <button onClick={tag.onRemove} className="hover:text-[var(--color-error-text)]" aria-label={t('pages.formula.removeFilter', { label: tag.label })}><X size={10} /></button>
                </Badge>
              ))}
              <button onClick={clearAllFilters} className="text-xs text-[var(--color-error-text)] hover:text-[var(--color-error-text)] font-medium ml-auto">{t('pages.formula.clearAll')}</button>
            </div>
          )}

          {/* ── 批量操作提示条 ── */}
          {selectedIds.size > 0 && (
            <Alert className="rounded-[var(--radius-Apple-md)] border-[var(--color-primary-border)] bg-[var(--color-primary-container)] shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-primary-text)]" />
              <AlertTitle className="text-sm font-medium">
                {t('pages.formula.selectedCountPrefix')} <strong className="text-[var(--color-primary-text)]">{selectedIds.size}</strong> {t('pages.formula.selectedCountSuffix')}
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2 mt-2">
                {has(FormulaPermission.EXPORT) && (
                  <Button size="md" variant="outline" className="min-h-[44px]" onClick={handleBatchExport}>
                    <Download className="w-3.5 h-3.5 mr-1" /> {t('pages.formula.exportSelected')}
                  </Button>
                )}
                {has(FormulaPermission.DELETE) && (
                  <Button size="md" variant="danger" className="min-h-[44px]" onClick={handleBatchDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> {t('pages.formula.batchDelete')}
                  </Button>
                )}
                {has(FormulaPermission.EDIT) && (
                  <div className="relative inline-block" ref={batchMenuRef}>
                    <Button
                      size="md"
                      variant="outline"
                      icon={<ArrowRightLeft className="w-3.5 h-3.5 mr-1" />}
                      className="min-h-[44px]"
                      aria-haspopup="listbox"
                      aria-expanded={batchMenuOpen}
                      onClick={() => setBatchMenuOpen(!batchMenuOpen)}
                    >
                      {t('pages.formula.batchChangeStatus')}
                    </Button>
                    {batchMenuOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-lg border border-[var(--border-color)] py-1 z-50" role="listbox">
                        {STATUS_OPTIONS.map((opt) => (
                          <button key={opt.value} className="w-full text-left px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--color-primary-container)] transition-colors"
                            onClick={() => { handleBatchStatusChange(opt.value as FormulaStatus); setBatchMenuOpen(false); }}>
                            {t(`common.statusLabels.${opt.value}`, { defaultValue: opt.label })}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button size="md" variant="ghost" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] min-h-[44px]" onClick={() => setSelectedIds(new Set())}>
                  {t('pages.formula.cancelSelect')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── 错误状态 ── */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>{t('pages.formula.loadFailed')}</AlertTitle>
              <AlertDescription className="flex items-center gap-2 mt-1.5">
                <span>{t('pages.formula.loadFailedDesc')}</span>
                <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['formulas-list'] })}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('pages.formula.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── 主内容区域（响应式：移动端强制卡片视图）── */}
          <Card className="transition-shadow duration-200 border-[var(--border-color)] overflow-visible bg-[var(--bg-secondary)] shadow-sm">
            {isLoading ? (
              viewMode === 'card' || isMobile ? (
                <div className="p-[var(--space-apple-md)] md:p-[var(--space-apple-lg)] grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-[var(--space-apple-md)] md:p-5">
                        <Skeleton className="h-5 w-1/3 mb-[var(--space-apple-md)]" />
                        <Skeleton className="h-3 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-[var(--space-apple-md)] md:p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-Apple-sm)]" />
                  ))}
                </div>
              )
            ) : items.length === 0 ? (
              /* 空状态 — 更精致的引导 */
              <div className="py-16 md:py-20">
                <EmptyState
                  icon={
                    <div className="w-12 h-12 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] flex items-center justify-center mx-auto mb-4">
                      <FlaskConical size={24} className="text-[var(--color-primary-text)]" />
                    </div>
                  }
                  title={hasActiveFilters ? t('pages.formula.noMatchingFormulas') : t('pages.formula.noFormulas')}
                  titleClassName="text-base font-semibold text-[var(--text-primary)]"
                  description={
                    hasActiveFilters
                      ? t('pages.formula.noMatchingDesc')
                      : t('pages.formula.noFormulasDesc')
                  }
                  descriptionClassName="text-xs text-[var(--text-muted)] mt-2"
                  action={
                    hasActiveFilters ? (
                      <Button variant="secondary" onClick={clearAllFilters} className="min-h-[44px]">
                        {t('pages.formula.clearFilters')}
                      </Button>
                    ) : (
                      <Link to="/formulas/new">
                        <Button icon={<Plus size={16} />} size="md" className="min-h-[44px] shadow-md hover:shadow-lg">
                          {t('pages.formula.newFormula')}
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
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 p-[var(--space-apple-md)] md:p-5"
                  style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                >
                  {shouldUseVirtualizer
                    ? virtualizer.getVirtualItems().map((virtualRow) => {
                        const formula = items[virtualRow.index];
                        return (
                          <div
                            key={virtualRow.key}
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
                  <table className="w-full text-sm" role="table" aria-label={t('pages.formula.listTitle')}>
                    <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs font-semibold">
                      <tr>
                        <th className="w-10 px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                          <Checkbox
                            checked={selectedIds.size === items.length && items.length > 0}
                            indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                            onChange={toggleSelectAll}
                            aria-label={t('pages.formula.selectAll')}
                          />
                        </th>
                        <th
                          className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors group"
                          onClick={() => handleSort('name')}
                          aria-sort={sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            {t('pages.formula.tableName')}{' '}
                            <SortIcon field="name" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th
                          className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors"
                          onClick={() => handleSort('status')}
                          aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            {t('pages.formula.tableStatus')}{' '}
                            <SortIcon field="status" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] hidden lg:table-cell">{t('pages.formula.tableIngredients')}</th>
                        <th className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] hidden xl:table-cell">{t('pages.formula.tableCreator')}</th>
                        <th className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] hidden xl:table-cell">{t('pages.formula.tableExperiments')}</th>
                        <th
                          className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] hidden xl:table-cell cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors"
                          onClick={() => handleSort('created_at')}
                          aria-sort={sortField === 'created_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            {t('pages.formula.tableCreatedAt')}{' '}
                            <SortIcon field="created_at" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th
                          className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left font-semibold text-[var(--text-primary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors"
                          onClick={() => handleSort('updated_at')}
                          aria-sort={sortField === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <span className="inline-flex items-center">
                            {t('pages.formula.tableUpdatedAt')}{' '}
                            <SortIcon field="updated_at" primaryField={sortField} primaryDir={sortDir} secondaryField={secondarySort.field} secondaryDir={secondarySort.dir} />
                          </span>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center font-semibold text-[var(--text-primary)] w-20">{t('pages.formula.tableActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {items.map((formula) => {
                        const isSelected = selectedIds.has(formula.id);
                        const showMenu = actionMenuId === formula.id;
                        return (
                          <tr
                            key={formula.id}
                            className={cn(
                              'group transition-all duration-150 hover:bg-[var(--bg-secondary)]',
                              isSelected && 'bg-[var(--color-primary-container)] ring-1 ring-[var(--color-primary-border)]',
                            )}
                          >
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(formula.id)}
                                aria-label={t('pages.formula.selectFormula', { name: formula.name })}
                              />
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                              <div className="flex items-center gap-2">
                                {/* A-23：14×14 的星标图标远低于 44×44。撑成 44×44 命中区，
                                    用 -mx-3.5 抵消外框尺寸变化，视觉位置与间距不变。 */}
                                <button onClick={() => toggleFavoriteItem(formula.id)} className="shrink-0 inline-flex items-center justify-center w-11 h-11 -mx-3.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] transition-colors" aria-label={favorites.has(formula.id) ? t('pages.formula.unfavorite') : t('pages.formula.favorite')} aria-pressed={favorites.has(formula.id)}>
                                  <Star size={14} aria-hidden="true" className={favorites.has(formula.id) ? 'fill-[var(--color-warning-text)] text-[var(--color-warning-text)]' : 'text-[var(--text-muted)] hover:text-[var(--color-warning-text)] transition-colors'} />
                                </button>
                                <Link to={`/formulas/${formula.id}`} className="inline-flex items-center min-h-[44px] font-medium text-[var(--text-primary)] hover:text-[var(--color-primary-text)] transition-colors truncate max-w-[180px]">
                                  <Highlight text={formula.name} keyword={debouncedSearch} />
                                </Link>
                                <Badge variant="neutral" size="sm" className="text-xs">v{formula.version}</Badge>
                              </div>
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                              <StatusBadge status={formula.status} />
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-muted)] hidden xl:table-cell">
                              {formula.ingredients?.length ?? 0}
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-muted)] hidden xl:table-cell truncate max-w-[120px]">
                              {formula.creator_name || '-'}
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-muted)] hidden xl:table-cell">
                              {formatDate(formula.createdAt || formula.createdAt)}
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-muted)]">
                              {formula.experimentIds && formula.experimentIds.length > 0 ? (
                                <Link to={`/experiments?formula_id=${formula.id}`} className="inline-flex items-center gap-1 text-xs text-[var(--color-secondary-text)] hover:underline" onClick={(e) => e.stopPropagation()}>
                                  <TestTubes size={12} />
                                  {t('pages.formula.experimentsCount', { count: formula.experimentIds.length })}
                                </Link>
                              ) : (
                                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">-</span>
                              )}
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-muted)]">
                              {formatDate(formula.updatedAt || formula.updatedAt)}
                            </td>
                            <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                              <div className="relative inline-block" ref={showMenu ? actionMenuRef : undefined}>
                                <button
                                  onClick={() => setActionMenuId(showMenu ? null : formula.id)}
                                  className="p-1.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:outline-none"
                                  aria-label={t('pages.formula.actionMenu', { name: formula.name })}
                                >
                                  <MoreVertical className="w-4 h-4" aria-hidden="true" />
                                </button>
                                {showMenu && (
                                  <div
                                    ref={actionMenuRef}
                                    role="menu"
                                    aria-label={t('pages.formula.actionMenu', { name: formula.name || t('pages.formula.title') })}
                                    className="absolute right-0 w-44 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] shadow-md border border-[var(--border-color)] py-1 z-[60] min-w-[176px]"
                                    style={{ top: 'calc(100% + 6px)', maxHeight: 'none' }}
                                  >
                                    <div className="absolute -top-1.5 right-3 w-2.5 h-2.5 bg-[var(--bg-secondary)] border-l border-t border-[var(--border-color)] rotate-45 shadow-sm" />

                                    <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--color-primary-container)] transition-colors"
                                      onClick={() => { navigate(`/formulas/${formula.id}`); setActionMenuId(null); }}>
                                      <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> {t('pages.formula.viewDetail')}
                                    </button>

                                    {has(FormulaPermission.EDIT) && (
                                      <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                                        onClick={() => { navigate(`/formulas/${formula.id}/edit`); setActionMenuId(null); }}>
                                        <Edit3 className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> {t('pages.formula.edit')}
                                      </button>
                                    )}

                                    {has(FormulaPermission.CREATE) && (
                                      <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                                        onClick={() => { handleDuplicate(formula); setActionMenuId(null); }}>
                                        <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> {t('pages.formula.duplicate')}
                                      </button>
                                    )}

                                    {has(FormulaPermission.EXPORT) && (
                                      <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                                        onClick={() => { handleExportSingle(formula); setActionMenuId(null); }}>
                                        <Download className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> {t('pages.formula.exportSingle')}
                                      </button>
                                    )}

                                    <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                                      onClick={() => { navigate(`/experiments/new?formula_id=${formula.id}`); setActionMenuId(null); }}>
                                      <TestTubes className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> {t('pages.formula.linkExperiment')}
                                    </button>

                                    {has(FormulaPermission.DELETE) && (
                                      <>
                                        <div className="my-1 mx-3 border-t border-[var(--border-color)]" />
                                        <button className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] transition-colors"
                                          onClick={() => { setDeleteConfirmId(formula.id); setActionMenuId(null); }}>
                                          <Trash2 className="w-4 h-4" /> {t('pages.formula.delete')}
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
                  <div className="px-[var(--space-apple-md)] md:px-[var(--space-apple-lg)] py-[var(--space-apple-md)] md:py-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] order-2 sm:order-1">
                      <span className="sm:hidden">{t('pages.formula.mobilePage', { page, totalPages })}</span>
                      <span className="hidden sm:inline">
                        {t('pages.formula.showingRange', {
                          from: (page - 1) * pageSize + 1,
                          to: Math.min(page * pageSize, total),
                          total,
                        })}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 sm:gap-4 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex sm:hidden items-center gap-2 w-full">
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="flex-1 min-h-[44px]" icon={<ChevronLeft size={16} />}>
                          {t('pages.formula.prevPage')}
                        </Button>
                        <span className="text-sm font-medium text-[var(--text-primary)] min-w-[60px] text-center tabular-nums">
                          {page}/{totalPages}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="flex-1 min-h-[44px]" icon={<ChevronRight size={16} />}>
                          {t('pages.formula.nextPage')}
                        </Button>
                      </div>
                      <div className="hidden sm:flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2">
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.formula.pageJump')}</span>
                          <input type="number" min={1} max={totalPages} value={page}
                            onChange={(e) => { const val = Math.min(Math.max(1, Number(e.target.value)), totalPages); if (!isNaN(val)) setPage(val); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { const val = Math.min(Math.max(1, Number(e.currentTarget.value)), totalPages); if (!isNaN(val)) setPage(val); } }}
                            className="w-14 px-2 py-1 text-xs border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-center focus:ring-2 focus:ring-[var(--color-primary-container)] outline-none"
        aria-label={t('pages.formula.pageJumpAria')}
      />
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">/{totalPages}</span>
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
          <Card className="overflow-hidden border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm h-fit">
            {/* 顶部色条 */}
            <div className="h-[3px] bg-[var(--color-primary-text)]" />
            <CardHeader className="px-[var(--space-apple-lg)] pt-5 pb-[var(--space-apple-md)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                    <Clock size={14} className="text-[var(--color-primary-text)]" />
                  </div>
                  <CardTitle as="h3" className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.recentUpdates')}</CardTitle>
                </div>
                <Link to="/formulas" className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--color-primary-text)] inline-flex items-center gap-1 min-h-[44px] transition-colors px-2 py-1 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-primary-container)]">
                  {t('pages.formula.all')} <ArrowRight size={11} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-[var(--space-apple-md)] pt-0">
              {recentFormulas.length === 0 ? (
                <div className="px-[var(--space-apple-lg)] py-10 text-center">
                  <div className="w-10 h-10 rounded-[var(--radius-pill)] bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-[var(--space-apple-md)]">
                    <FlaskConical size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">{t('pages.formula.noRecentFormulas')}</p>
                </div>
              ) : (
                <div className="px-[var(--space-apple-sm)] py-1">
                  {recentFormulas.slice(0, 5).map((f, idx) => (
                    <Link
                      key={f.id}
                      to={`/formulas/${f.id}`}
                      className="group flex items-center gap-4 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-md)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer mb-0.5 last:mb-0"
                    >
                      {/* 序号指示 */}
                      <span className={cn(
                        'w-5 h-5 rounded-md text-xs font-semibold flex items-center justify-center shrink-0',
                        /* D-67：序号徽章只有 20×20，底色是 100/900 档实色蒙版，
                           文字必须是 700 档才够 AA。原写法
                             light  secondary-600 #2563eb on #dbeafe = 4.24 ✗
                             dark   secondary-600 #60a5fa on rgb(76,86,106) = 2.89 ✗
                                    primary-600  #6ee7b7 on rgb(81,92,103) = 4.47 ✗
                                    warning-600  #fbbf24 on rgb(87,89,89)  = 4.23 ✗
                           暗色蒙版同时从 /30 降到 /20（与快捷入口 chip 一致），
                           700 档文字对比度提升到 5.7 / 7.6 / 6.9。 */
                        idx === 0 ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                      : idx === 1 ? 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)]'
                      : idx === 2 ? 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
                      )}>{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--color-primary-text)] transition-colors">
                          <Highlight text={f.name} keyword={debouncedSearch} />
                        </p>
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 truncate">
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
          <Card className="overflow-hidden border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm h-fit">
            {/* 顶部色条 */}
            <div className="h-[3px] bg-[var(--color-accent-text)]" />
            <CardHeader className="px-[var(--space-apple-lg)] pt-5 pb-[var(--space-apple-md)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-[var(--color-accent-container)] flex items-center justify-center">
                  <Download size={14} className="text-[var(--color-accent-text)]" />
                </div>
                <CardTitle as="h3" className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.importExport')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-[var(--space-apple-md)] pb-[var(--space-apple-md)] pt-0 space-y-[var(--space-apple-sm)]">
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
                className="w-full flex items-center gap-4 px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] hover:border-[var(--color-primary-border)] hover:bg-[var(--color-primary-container)] transition-all text-left group min-h-[48px]"
              >
                <div className="w-9 h-9 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download size={16} className="text-[var(--color-primary-text)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.importFormulas')}</p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">{t('pages.formula.jsonCsvFormat')}</p>
                </div>
                <ArrowRight size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-[var(--color-primary-text)] transition-colors shrink-0" />
              </button>

              <button
                onClick={() => {
                  const selected = items.filter((f) => selectedIds.has(f.id));
                  exportFormulasCSV(selected.length > 0 ? selected : items);
                }}
                className="w-full flex items-center gap-4 px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] hover:border-[var(--color-accent-text)] hover:bg-[var(--color-accent-container)] transition-all text-left group min-h-[48px]"
              >
                <div className="w-9 h-9 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download size={16} className="text-[var(--color-secondary-text)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.formula.exportCSV')}</p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                    {selectedIds.size > 0 ? t('pages.formula.selectedCountSmall', { count: selectedIds.size }) : t('pages.formula.allData')}
                  </p>
                </div>
                <ArrowRight size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-[var(--color-accent-text)] transition-colors shrink-0" />
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
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title={t('pages.formula.confirmDelete')}>
        {deleteConfirmId && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
              {t('pages.formula.confirmDeleteDesc')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="danger" size="sm" onClick={() => handleDelete(deleteConfirmId)} className="flex-1 min-h-[44px]">
                <Trash2 className="w-4 h-4 mr-1.5" /> {t('pages.formula.confirmDeleteBtn')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} className="flex-1 min-h-[44px]">
                {t('pages.formula.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── 键盘快捷键提示（桌面端）── */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-40">
        <Tooltip
          /* A-23：asChild 让 Trigger 直接复用内层 button，不再多包一层无名 button */
          asChild
          content={
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span>{t('pages.formula.focusSearch')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] text-xs font-mono">Ctrl+F</kbd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('pages.formula.newFormula')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] text-xs font-mono">Ctrl+N</kbd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>{t('pages.formula.closeDialog')}</span>
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] text-xs font-mono">Esc</kbd>
              </div>
            </div>
          }
        >
          <button className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/90 backdrop-blur-sm border border-[var(--border-color)] shadow-lg hover:shadow-xl transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={t('pages.formula.keyboardShortcuts')}>
            <Keyboard size={16} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <OperationLogPanel open={showLogPanel} onClose={() => setShowLogPanel(false)} />
      </div>
    </div>
  );
}

