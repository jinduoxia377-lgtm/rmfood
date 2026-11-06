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
  Search, Filter,
  ShieldCheck, Star, CheckSquare, X, AlertTriangle,
} from 'lucide-react';
import {
  searchFoodMaterials,
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
  result: FoodMaterialSearchResult;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (id: number) => void;
  isFavorited: boolean;
  onToggleFavorite: (id: number) => void;
  favoriteLoading: boolean;
}> = ({ result, selected, onToggleSelect, onOpenDetail, isFavorited, onToggleFavorite, favoriteLoading }) => {
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null);

  const handleCheckCompliance = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await checkMaterialCompliance(result.id);
      const r = resp as unknown as { passed?: boolean };
      setCompliancePassed(r?.passed ?? null);
      setComplianceChecked(true);
    } catch {
      // 检查失败/无数据 → 显式中性「待评估」，不误导为不合规
      setCompliancePassed(null);
      setComplianceChecked(true);
    }
  }, [result.id]);

  const toxicity = result.extra.toxicity_class as string | undefined;
  const toxicityColor: BadgeVariant = toxicity === '无毒' ? 'success' : 'warning';
  const category = result.extra.category as string | undefined;
  const nameCn = result.extra.name_cn as string | undefined;
  const nameLatin = result.extra.name_latin as string | undefined;
  const foodHomology = result.extra.food_homology as boolean | undefined;
  const effects = (result.extra.effects as string[] | undefined) ?? [];
  const description = result.extra.description as string | undefined;
  const similarity = result.extra.similarity as number | undefined;

  return (
    <div
      className="card card-hover cursor-pointer mb-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border border-border hover:shadow-md transition-shadow"
      style={{ marginBottom: 12 }}
      onClick={() => onOpenDetail(result.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(result.id); } }}
    >
      <div className="flex justify-between items-start gap-3">
        {/* 多选框 + 主体 */}
        <div className="flex-1 min-w-0 flex gap-3">
          <label
            className="flex items-center pt-0.5 cursor-pointer shrink-0"
            onClick={(e) => e.stopPropagation()}
            aria-label={`选择 ${nameCn || result.name}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary cursor-pointer"
              checked={selected}
              onChange={() => onToggleSelect(result.id)}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold mb-1 truncate">
              {nameCn || result.name}
              {nameLatin && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({nameLatin})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {category && <Badge variant="info">{category}</Badge>}
              {foodHomology === true && <Badge variant="success">药食同源</Badge>}
              {toxicity && <Badge variant={toxicityColor}>{toxicity}</Badge>}
              {effects.map((e: string) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
            </div>
            {description && (
              <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {description.substring(0, 120)}...
              </div>
            )}
          </div>
        </div>
        <div className="text-right ml-4 shrink-0" style={{ minWidth: 80 }}>
          <div className="text-xs text-muted-foreground">相关度</div>
          <div className="text-xl font-bold text-primary">
            {(result.score * 100).toFixed(1)}%
          </div>
          {similarity !== undefined && (
            <div className="text-xs text-muted-foreground mt-1">
              语义: {(similarity * 100).toFixed(1)}%
            </div>
          )}
          {/* 收藏按钮 */}
          <Button
            variant={isFavorited ? 'warning' : 'ghost'}
            size="sm"
            icon={<Star className={`h-3.5 w-3.5 ${isFavorited ? 'fill-current' : ''}`} />}
            loading={favoriteLoading}
            className="mt-2 h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(result.id); }}
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

  // 执行搜索
  const handleSearch = useCallback(async (page = 1) => {
    if (!query.trim()) return;
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

      {/* 搜索结果 */}
      {loading ? (
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
              result={result}
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
