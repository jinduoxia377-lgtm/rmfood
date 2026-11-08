/**
 * 食品原料搜索面板
 *
 * 对标 Potion AI VFT 的 Raw Material Search 界面。
 * 集成到 DatabasePage 的新 Tab 中。
 *
 * 能力：
 * - 搜索 + 名称标准化 + 筛选
 * - 结果卡片 → 详情抽屉（FoodMaterialDetailDrawer）
 * - Pantry 收藏 / 取消收藏（乐观更新 + toast）
 * - 多选 + 批量配方合规检查（弹窗分组展示 violations/warnings/info）
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Button, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Badge,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  EmptyState,
  Pagination,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  useToast,
} from '@/components/ui';
import {
  Search, Filter, List,
  ShieldCheck, Star, CheckSquare, X, AlertTriangle,
} from 'lucide-react';
import {
  searchFoodMaterials,
  listFoodMaterials,
  type FoodMaterialFilter,
  type FoodMaterialSearchResult,
  type FoodMaterialSearchResponse,
  type FormulaComplianceResult,
  type ComplianceViolation,
  normalizeName,
  checkMaterialCompliance,
  checkFormulaCompliance,
  type NormalizeResult,
} from '../../../api/searchNew';
import { databaseApi } from '@/api/database';
import { logger } from '@/utils/safeLogger';
import FoodMaterialDetailDrawer from './FoodMaterialDetailDrawer';

interface FoodMaterialSearchPanelProps {
  className?: string;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

/**
 * 卡片统一展示模型 —— 把「搜索结果」与「浏览全部列表」两种来源归一到此，
 * 让 MaterialCard 复用同一渲染。score 仅搜索模式有值；浏览模式 undefined → 隐藏相关度。
 */
interface DisplayMaterial {
  id: number;
  nameCn: string;
  nameLatin?: string;
  category?: string;
  foodHomology?: boolean;
  toxicity?: string;
  effects: string[];
  description?: string;
  /** 相关度（0~1）。浏览模式无此值 → 不显示相关度块 */
  score?: number;
  similarity?: number;
}

/** 搜索结果 → 展示模型 */
function searchResultToDisplay(r: FoodMaterialSearchResult): DisplayMaterial {
  return {
    id: r.id,
    nameCn: (r.extra.name_cn as string | undefined) ?? r.name,
    nameLatin: r.extra.name_latin as string | undefined,
    category: r.extra.category as string | undefined,
    foodHomology: r.extra.food_homology as boolean | undefined,
    toxicity: r.extra.toxicity_class as string | undefined,
    effects: (r.extra.effects as string[] | undefined) ?? [],
    description: r.extra.description as string | undefined,
    score: r.score,
    similarity: r.extra.similarity as number | undefined,
  };
}

/** 浏览列表项（FoodMaterial.to_dict()，扁平结构）→ 展示模型（无相关度） */
function listItemToDisplay(m: unknown): DisplayMaterial {
  const rec = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
  return {
    id: typeof rec.id === 'number' ? rec.id : Number(rec.id),
    nameCn: (rec.name_cn as string | undefined) ?? (rec.name_en as string | undefined) ?? `原料 #${String(rec.id)}`,
    nameLatin: rec.name_latin as string | undefined,
    category: rec.category as string | undefined,
    foodHomology: rec.food_homology as boolean | undefined,
    toxicity: rec.toxicity_class as string | undefined,
    effects: Array.isArray(rec.effects) ? (rec.effects as string[]) : [],
    description: rec.description as string | undefined,
  };
}

/** 单条合规结果徽章配色 */
function severityVariant(severity: string | undefined): BadgeVariant {
  const s = (severity ?? '').toLowerCase();
  if (s.includes('critical') || s.includes('high') || s.includes('error') || s.includes('danger') || s.includes('violation')) {
    return 'destructive';
  }
  if (s.includes('warn') || s.includes('medium')) {
    return 'warning';
  }
  return 'info';
}

/**
 * 食品原料搜索结果卡片
 */
const MaterialCard: React.FC<{
  material: DisplayMaterial;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (id: number) => void;
  isFavorited: boolean;
  onToggleFavorite: (id: number) => void;
  favoriteLoading: boolean;
}> = ({ material, selected, onToggleSelect, onOpenDetail, isFavorited, onToggleFavorite, favoriteLoading }) => {
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null);

  const handleCheckCompliance = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await checkMaterialCompliance(material.id);
      const r = resp as unknown as { passed?: boolean };
      setCompliancePassed(r?.passed ?? null);
      setComplianceChecked(true);
    } catch {
      // 检查失败/无数据 → 显式中性「待评估」，不误导为不合规
      setCompliancePassed(null);
      setComplianceChecked(true);
    }
  }, [material.id]);

  const toxicityColor: BadgeVariant = material.toxicity === '无毒' ? 'success' : 'warning';
  const hasRelevance = material.score !== undefined;

  return (
    <div
      className="card card-hover cursor-pointer mb-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border border-border hover:shadow-md transition-shadow"
      style={{ marginBottom: 12 }}
      onClick={() => onOpenDetail(material.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(material.id); } }}
    >
      <div className="flex justify-between items-start gap-3">
        {/* 多选框 + 主体 */}
        <div className="flex-1 min-w-0 flex gap-3">
          <label
            className="flex items-center pt-0.5 cursor-pointer shrink-0"
            onClick={(e) => e.stopPropagation()}
            aria-label={`选择 ${material.nameCn}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary cursor-pointer"
              checked={selected}
              onChange={() => onToggleSelect(material.id)}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold mb-1 truncate">
              {material.nameCn}
              {material.nameLatin && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({material.nameLatin})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {material.category && <Badge variant="info">{material.category}</Badge>}
              {material.foodHomology === true && <Badge variant="success">药食同源</Badge>}
              {material.toxicity && <Badge variant={toxicityColor}>{material.toxicity}</Badge>}
              {material.effects.map((e: string) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
            </div>
            {material.description && (
              <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {material.description.substring(0, 120)}...
              </div>
            )}
          </div>
        </div>
        <div className="text-right ml-4 shrink-0" style={{ minWidth: 80 }}>
          {hasRelevance && (
            <>
              <div className="text-xs text-muted-foreground">相关度</div>
              <div className="text-xl font-bold text-primary">
                {((material.score ?? 0) * 100).toFixed(1)}%
              </div>
              {material.similarity !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  语义: {(material.similarity * 100).toFixed(1)}%
                </div>
              )}
            </>
          )}
          {/* 收藏按钮 */}
          <Button
            variant={isFavorited ? 'warning' : 'ghost'}
            size="sm"
            icon={<Star className={`h-3.5 w-3.5 ${isFavorited ? 'fill-current' : ''}`} />}
            loading={favoriteLoading}
            className={`h-7 text-xs ${hasRelevance ? 'mt-2' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(material.id); }}
          >
            {isFavorited ? '已收藏' : '收藏'}
          </Button>
        </div>
      </div>
      {/* 合规检查（单条） */}
      {!complianceChecked ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          onClick={handleCheckCompliance}
          className="mt-2 h-7 text-xs"
        >
          合规检查
        </Button>
      ) : (
        <Badge
          variant={compliancePassed === null ? 'neutral' : compliancePassed ? 'success' : 'destructive'}
          className="mt-2"
        >
          {compliancePassed === null ? '待评估·数据不足' : compliancePassed ? '合规' : '不合规'}
        </Badge>
      )}
    </div>
  );
};

/**
 * 批量合规结果分组渲染
 */
const ComplianceGroup: React.FC<{
  title: string;
  variant: BadgeVariant;
  items: ComplianceViolation[];
}> = ({ title, variant, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-[var(--space-apple-md)]">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={variant}>{title}</Badge>
        <span className="text-xs text-muted-foreground">{items.length} 条</span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={`${item.code ?? 'c'}-${idx}`}
            className="rounded-[var(--radius-Apple-sm)] border border-border p-[var(--space-apple-sm)] bg-background/50"
          >
            <div className="flex items-start gap-2">
              <Badge variant={severityVariant(item.severity)} className="shrink-0">
                {item.code ?? item.severity ?? '提示'}
              </Badge>
              <span className="text-sm break-words">{item.message ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 食品原料搜索面板主组件
 */
const FoodMaterialSearchPanel: React.FC<FoodMaterialSearchPanelProps> = ({ className }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodMaterialSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [filters, setFilters] = useState<Partial<FoodMaterialFilter>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchModes] = useState({ bm25: 0.4, vector: 0.3, rule: 0.3 });
  const [normalized, setNormalized] = useState<NormalizeResult | null>(null);

  // ── 详情抽屉 ──
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Pantry 收藏（本地 Set + 乐观更新）──
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<number | null>(null);

  // ── 多选 + 批量合规 ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<FormulaComplianceResult | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  // 初次加载已收藏列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pantry = await databaseApi.getPantry('food_material');
        if (cancelled) return;
        const items = (pantry?.items ?? []) as Array<{ type?: string; data?: { id?: number } }>;
        const ids = new Set<number>();
        for (const it of items) {
          if (it?.type === 'food_material' && typeof it?.data?.id === 'number') {
            ids.add(it.data.id);
          }
        }
        setFavoriteIds(ids);
      } catch (err) {
        logger.error('[FoodMaterial] 加载收藏列表失败:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 浏览全部模式（默认）──
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [browseCategory, setBrowseCategory] = useState<string>('all');
  const [browseHomology, setBrowseHomology] = useState<string>('all'); // all | true | false
  const [browsePage, setBrowsePage] = useState(1);
  const BROWSE_PER_PAGE = 50;
  // 后端 list 端点 limit 上限 200；当前 128 条（含 106 药食同源）一次可全量返回。
  // 一次取全量后做客户端筛选 + 分页：分类下拉用真实数据 distinct 得到，总数 = 筛选后长度，
  // 用户明确看到「共 128 条」，不会再误以为「只有 40 条」。
  const BROWSE_FETCH_LIMIT = 200;

  // 全量目录（真实后端数据，不伪造）；react-query 承载加载态，避免 setState-in-effect
  const {
    data: browseRaw,
    isLoading: browseLoading,
    error: browseError,
  } = useQuery<unknown[], Error>({
    queryKey: ['foodMaterialsBrowse'],
    queryFn: () => listFoodMaterials({ limit: BROWSE_FETCH_LIMIT, offset: 0 }),
  });

  const browseAll = useMemo<DisplayMaterial[]>(
    () => (Array.isArray(browseRaw) ? browseRaw : []).map(listItemToDisplay),
    [browseRaw],
  );

  // 分类下拉选项：从真实数据 distinct（不硬编码、不伪造）
  const browseCategories = useMemo(() => {
    const set = new Set<string>();
    for (const m of browseAll) {
      if (m.category) set.add(m.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }, [browseAll]);

  // 客户端筛选
  const browseFiltered = useMemo(() => browseAll.filter((m) => {
    if (browseCategory !== 'all' && m.category !== browseCategory) return false;
    if (browseHomology === 'true' && m.foodHomology !== true) return false;
    if (browseHomology === 'false' && m.foodHomology !== false) return false;
    return true;
  }), [browseAll, browseCategory, browseHomology]);

  const browseTotal = browseFiltered.length;
  const browsePageCount = Math.max(1, Math.ceil(browseTotal / BROWSE_PER_PAGE));
  const browsePageItems = browseFiltered.slice((browsePage - 1) * BROWSE_PER_PAGE, browsePage * BROWSE_PER_PAGE);

  const enterBrowseMode = useCallback(() => {
    setMode('browse');
    setQuery('');
    setResults([]);
    setNormalized(null);
    setTotal(0);
    setSelectedIds(new Set());
    setBrowsePage(1);
  }, []);

  // 执行搜索
  const handleSearch = useCallback(async (page = 1) => {
    if (!query.trim()) return;
    setMode('search');
    setLoading(true);
    try {
      // 名称标准化
      const normResult = await normalizeName(query.trim());
      setNormalized(normResult);

      const response: FoodMaterialSearchResponse = await searchFoodMaterials({
        query: normResult.canonical,
        filters: { ...filters, ...normResult },
        page,
        per_page: 20,
        search_modes: searchModes,
      });
      setResults(response.results);
      setTotal(response.total);
      setSearchTime(response.search_time_ms);
      setCurrentPage(page);
      // 换页/换词时清空多选，避免误操作不可见项
      setSelectedIds(new Set());
    } catch (err) {
      logger.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  }, [query, filters, searchModes]);

  // ── 多选 ──
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── 详情抽屉 ──
  const openDetail = useCallback((id: number) => {
    setDetailId(id);
    setDetailOpen(true);
  }, []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);

  // ── 收藏 / 取消收藏（乐观更新）──
  const toggleFavorite = useCallback(async (id: number) => {
    const wasFavorited = favoriteIds.has(id);
    // 乐观更新
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(id); else next.add(id);
      return next;
    });
    setFavoriteLoadingId(id);
    try {
      if (wasFavorited) {
        await databaseApi.removeFromPantryFoodMaterial(id);
        toast.success('已取消收藏');
      } else {
        await databaseApi.addToPantryFoodMaterial(id);
        toast.success('已加入收藏');
      }
    } catch (err) {
      // 回滚
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(id); else next.delete(id);
        return next;
      });
      toast.error(wasFavorited ? '取消收藏失败' : '收藏失败');
      logger.error('[FoodMaterial] 收藏操作失败:', err);
    } finally {
      setFavoriteLoadingId(null);
    }
  }, [favoriteIds, toast]);

  // ── 批量合规检查 ──
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const runBatchCompliance = useCallback(async () => {
    if (selectedArray.length === 0) return;
    setBatchLoading(true);
    try {
      const result = await checkFormulaCompliance(selectedArray);
      setBatchResult(result ?? {});
      setBatchModalOpen(true);
    } catch (err) {
      toast.error('批量合规检查失败');
      logger.error('[FoodMaterial] 批量合规检查失败:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedArray, toast]);

  const batchGroups: Array<{ key: string; title: string; variant: BadgeVariant; items: ComplianceViolation[] }> = useMemo(() => [
    { key: 'violations', title: '配伍禁忌 Violations', variant: 'destructive', items: batchResult?.violations ?? [] },
    { key: 'warnings', title: '警告 Warnings', variant: 'warning', items: batchResult?.warnings ?? [] },
    { key: 'info', title: '提示 Info', variant: 'info', items: batchResult?.info ?? [] },
  ], [batchResult]);

  const batchHasAny = batchGroups.some((g) => g.items.length > 0);

  return (
    <div className={className}>
      {/* 搜索栏 */}
      <Card className="mb-[var(--space-apple-md)]">
        <div className="flex flex-col gap-4">
          {/* 搜索输入行 */}
          <div className="flex gap-2">
            <Input
              placeholder="搜索食品原料 (如: 黄芪、胶原蛋白肽)... "
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="lg"
              icon={<Search className="h-4 w-4" />}
              loading={loading}
              onClick={() => handleSearch()}
            >
              搜索
            </Button>
            <Button
              variant={mode === 'browse' ? 'secondary' : 'outline'}
              size="lg"
              icon={<List className="h-4 w-4" />}
              onClick={enterBrowseMode}
            >
              浏览全部
            </Button>
          </div>

          {/* 模式提示 */}
          <div className="text-xs text-muted-foreground">
            {mode === 'browse'
              ? '当前：浏览全部目录（默认）。可按分类 / 药食同源筛选，点击卡片查看详情。'
              : '当前：搜索结果。点击「浏览全部」可回到完整目录。'}
          </div>

          {/* 名称标准化提示 */}
          {normalized && normalized.canonical !== normalized.original && (
            <Badge variant="info" className="self-start">
              已标准化: {normalized.original} → {normalized.canonical}
              {normalized.aliases_found.length > 0 && (
                <span className="ml-2 opacity-70">
                  ({normalized.aliases_found.length} 个别名)
                </span>
              )}
            </Badge>
          )}

          {/* 筛选器 (Accordion 替代 Collapse) */}
          <Accordion type="single" collapsible>
            <AccordionItem value="filters">
              <AccordionTrigger>筛选条件</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={filters.category}
                    onValueChange={(v: string) => setFilters((f) => ({ ...f, category: v }))}
                    placeholder="分类"
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="中药材">中药材</SelectItem>
                      <SelectItem value="食品添加剂">食品添加剂</SelectItem>
                      <SelectItem value="普通食品">普通食品</SelectItem>
                      <SelectItem value="保健食品">保健食品</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.toxicity_class}
                    onValueChange={(v: string) => setFilters((f) => ({ ...f, toxicity_class: v }))}
                    placeholder="毒性等级"
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="无毒">无毒</SelectItem>
                      <SelectItem value="小毒">小毒</SelectItem>
                      <SelectItem value="有毒">有毒</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.food_homology != null ? String(filters.food_homology) : undefined}
                    onValueChange={(v: string) => setFilters((f) => ({ ...f, food_homology: v === 'true' }))}
                    placeholder="药食同源"
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">是</SelectItem>
                      <SelectItem value="false">否</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Filter className="h-3.5 w-3.5" />}
                    onClick={() => setFilters({})}
                  >
                    重置筛选
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* 搜索模式权重 */}
          <div className="text-xs text-muted-foreground">
            搜索模式: BM25: {searchModes.bm25} | 向量: {searchModes.vector} | 规则: {searchModes.rule}
          </div>
        </div>
      </Card>

      {/* ── 浏览全部模式 ── */}
      {mode === 'browse' ? (
        <>
          {/* 浏览筛选：分类 + 药食同源（客户端筛选，全量已加载） */}
          <div className="flex flex-wrap items-center gap-2 mb-[var(--space-apple-sm)]">
            <Select
              value={browseCategory}
              onValueChange={(v: string) => { setBrowseCategory(v); setBrowsePage(1); }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {browseCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={browseHomology}
              onValueChange={(v: string) => { setBrowseHomology(v); setBrowsePage(1); }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部原料</SelectItem>
                <SelectItem value="true">药食同源</SelectItem>
                <SelectItem value="false">非药食同源</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              共 <b className="text-foreground">{browseTotal}</b> 条原料
              {browseCategory !== 'all' || browseHomology !== 'all' ? '（已筛选）' : ''}
            </span>
          </div>

          {browseLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-[var(--space-apple-sm)]">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-[var(--radius-pill)]" />
              <span className="text-sm text-muted-foreground">加载目录...</span>
            </div>
          ) : browseError ? (
            <EmptyState
              title="目录加载失败"
              description={browseError.message || '请稍后重试'}
            />
          ) : browsePageItems.length === 0 ? (
            <EmptyState
              title="该筛选下暂无原料"
              description="请调整分类或药食同源筛选条件"
            />
          ) : (
            <>
              <div className="mb-[var(--space-apple-sm)] text-xs text-muted-foreground">
                共 {browseTotal} 条 · 第 {browsePage}/{browsePageCount} 页 · 每页 {BROWSE_PER_PAGE} 条 · 点击卡片查看详情 · 勾选可批量合规检查
              </div>
              {browsePageItems.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  selected={selectedIds.has(material.id)}
                  onToggleSelect={toggleSelect}
                  onOpenDetail={openDetail}
                  isFavorited={favoriteIds.has(material.id)}
                  onToggleFavorite={toggleFavorite}
                  favoriteLoading={favoriteLoadingId === material.id}
                />
              ))}
              {browsePageCount > 1 && (
                <Pagination
                  page={browsePage}
                  pageSize={BROWSE_PER_PAGE}
                  total={browseTotal}
                  onPageChange={(page) => setBrowsePage(page)}
                  className="mt-[var(--space-apple-md)]"
                />
              )}
            </>
          )}
        </>
      ) : (
        /* ── 搜索结果模式 ── */
        loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-[var(--space-apple-sm)]">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-[var(--radius-pill)]" />
            <span className="text-sm text-muted-foreground">搜索中...</span>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="mb-[var(--space-apple-sm)] text-xs text-muted-foreground">
              找到 {total} 条结果，耗时 {searchTime.toFixed(1)}ms · 点击卡片查看详情 · 勾选可批量合规检查
            </div>
            {results.map((result) => (
              <MaterialCard
                key={result.id}
                material={searchResultToDisplay(result)}
                selected={selectedIds.has(result.id)}
                onToggleSelect={toggleSelect}
                onOpenDetail={openDetail}
                isFavorited={favoriteIds.has(result.id)}
                onToggleFavorite={toggleFavorite}
                favoriteLoading={favoriteLoadingId === result.id}
              />
            ))}
            {total > 20 && (
              <Pagination
                page={currentPage}
                pageSize={20}
                total={total}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  handleSearch(page);
                }}
                className="mt-[var(--space-apple-md)]"
              />
            )}
          </>
        ) : query ? (
          <EmptyState
            title="未找到匹配的原料"
            description="请尝试更换关键词或调整筛选条件"
          />
        ) : (
          <EmptyState
            title="请输入关键词开始搜索"
            description="支持按名称、分类、药食同源属性搜索食品原料"
          />
        )
      )}

      {/* 批量操作浮条 */}
      {selectedArray.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-[var(--radius-Apple-md)] border border-border bg-background/95 backdrop-blur px-[var(--space-apple-md)] py-3 shadow-xl"
          role="toolbar"
          aria-label="批量操作"
        >
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">已选 {selectedArray.length} 项</span>
          <Button
            variant="primary"
            size="sm"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            loading={batchLoading}
            onClick={runBatchCompliance}
          >
            批量合规检查
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="取消选择"
            onClick={clearSelection}
            className="h-8 w-8 min-w-[32px] min-h-[32px]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 批量合规结果弹窗 */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              批量配方合规检查结果
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-[var(--space-apple-sm)]">
            检查原料 {selectedArray.length} 项
          </div>
          {!batchHasAny ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <ShieldCheck className="h-10 w-10 text-success" />
              <div className="text-base font-medium text-success">未发现配伍禁忌</div>
              <div className="text-xs text-muted-foreground">所选原料组合未检出违规项</div>
            </div>
          ) : (
            <>
              {batchGroups.map((g) => (
                <ComplianceGroup
                  key={g.key}
                  title={g.title}
                  variant={g.variant}
                  items={g.items}
                />
              ))}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                <AlertTriangle className="h-3 w-3" />
                结果基于后端配伍规则引擎，仅供配方设计参考，不替代专业医师判断。
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 详情抽屉 */}
      <FoodMaterialDetailDrawer
        open={detailOpen}
        materialId={detailId}
        onClose={closeDetail}
        isFavorited={detailId != null && favoriteIds.has(detailId)}
        onToggleFavorite={toggleFavorite}
        favoriteLoading={detailId != null && favoriteLoadingId === detailId}
      />
    </div>
  );
};

export default FoodMaterialSearchPanel;
