/**
 * 零售产品搜索面板 — OFF 实时数据集成（Phase 4 增强版）
 *
 * 功能包括：
 * - 关键词搜索 + 分类浏览（DB缓存/实时API双模式）
 * - 持久化收藏（连接到后端pantry API）
 * - 产品对比选择
 * - 高级筛选（品牌、剂型、价格范围）
 * - 卡片/表格双视图切换
 * - 排序 + 分页
 * - 导出CSV（含收藏标记和选择标记）
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Badge,
  Switch,
  Tooltip,
  EmptyState,
  Alert,
  Pagination,
  DataTable,
  ListSkeleton,
} from '@/components/ui';
import {
  Search, Filter, Zap, RefreshCw, Download,
  Grid, List, ArrowDownAZ, ArrowDownZA,
  Check, Flame, Star,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  searchOpenFoodFacts,
  getOpenFoodFactsCategories,
  getSearchSuggestions,
  addToPantryRetailProduct,
  removeFromPantryRetailProduct,
  getPantryRetailProducts,
  type RetailProductDetail,
  type OFFCategoryInfo,
} from '../../../api/searchNew';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/safeLogger';
import RetailProductDetailModal from './RetailProductDetailModal';
import RetailProductCompareModal from './RetailProductCompareModal';
import RetailProductSyncPanel from './RetailProductSyncPanel';

// ── OFF 原始数据 → 前端统一格式 ──

interface OFFRawProduct {
  id?: number | string;
  product_name?: string;
  brand?: string;
  category?: string;
  formulation_type?: string | null;
  price?: number | null;
  avg_rating?: number | null;
  image_urls?: string[];
  effects?: string[];
  score?: number;
  allergens_tags?: string[];
  additives_tags?: string[];
  ecoscore_grade?: string | null;
  traces_tags?: string[];
  contaminants?: string[];
  source?: string;
  data_origin?: string;
  package_size?: string;
  volume_ml?: number | null;
  weight_g?: number | null;
  currency?: string;
  full_ingredients?: string | null;
  key_ingredients?: Record<string, unknown>;
  target_population?: string[];
  sales_channels?: string[];
  review_count?: number | null;
  data_quality?: number;
}

function mapOFFProduct(raw: OFFRawProduct): RetailProductDetail {
  return {
    id: Number(raw.id ?? 0),
    product_name: raw.product_name || '',
    brand: raw.brand || 'Unknown',
    category: raw.category || '',
    sub_category: undefined,
    formulation_type: raw.formulation_type || '',
    price: raw.price != null ? Number(raw.price) : 0,
    avg_rating: raw.avg_rating != null ? Number(raw.avg_rating) : 0,
    image_urls: Array.isArray(raw.image_urls) ? raw.image_urls : [],
    effects: Array.isArray(raw.effects) ? raw.effects : [],
    score: raw.score != null ? Number(raw.score) : 0,
    allergens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [],
    additives_tags: Array.isArray(raw.additives_tags) ? raw.additives_tags : [],
    ecoscore_grade: raw.ecoscore_grade ?? null,
    traces_tags: Array.isArray(raw.traces_tags) ? raw.traces_tags : [],
    contaminants: Array.isArray(raw.contaminants) ? raw.contaminants : [],
    source: raw.source,
    data_origin: raw.data_origin,
    package_size: raw.package_size,
    volume_ml: raw.volume_ml,
    weight_g: raw.weight_g,
    currency: raw.currency,
    full_ingredients: raw.full_ingredients,
    key_ingredients: raw.key_ingredients,
    target_population: raw.target_population,
    sales_channels: raw.sales_channels,
    review_count: raw.review_count,
    data_quality: raw.data_quality,
  };
}

// ── 数据来源徽标 ──
type OriginBadgeVariant = 'warning' | 'info' | 'neutral' | 'default';

function getOriginBadge(origin?: string, source?: string): { labelKey: string; tooltipKey: string; variant: OriginBadgeVariant } | null {
  const o = (origin ?? '').toLowerCase();
  const s = (source ?? '').toLowerCase();
  if (o === 'internet_realtime') {
    return { labelKey: 'originRealtimeBadge', tooltipKey: 'originRealtimeTooltip', variant: 'warning' };
  }
  if (o === 'internet_cache') {
    return { labelKey: 'originCacheBadge', tooltipKey: 'originCacheTooltip', variant: 'info' };
  }
  if (o === 'local_reference' || s === 'manual') {
    return { labelKey: 'originLocalBadge', tooltipKey: 'originLocalTooltip', variant: 'neutral' };
  }
  return null;
}

type ViewMode = 'card' | 'table';
type SortField = 'brand' | 'price' | 'product_name';
type SortDir = 'asc' | 'desc';

// 热门搜索词引导（i18n 键；点击即搜索）
const HOT_SEARCH_KEYS = [
  'hotSearchProteinPowder',
  'hotSearchCollagenPeptide',
  'hotSearchVitaminC',
  'hotSearchProbiotic',
  'hotSearchFishOil',
] as const;

// ── 星级评分组件 ──
const StarRating: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-warning text-warning' : 'text-muted-foreground'}
        />
      ))}
    </div>
  );
};

// ── 生态评分色 ──
function getEcoscoreColor(grade?: string): string {
  switch (grade) {
    case 'a': return 'success';
    case 'b': return 'info';
    case 'c': return 'primary';
    case 'd': return 'warning';
    default: return 'neutral';
  }
}

// ── 产品结果卡片 ──

const ProductCard: React.FC<{
  product: RetailProductDetail;
  onClick?: () => void;
  onToggleFav: () => void;
  isFav: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}> = ({ product, onClick, onToggleFav, isFav, isSelected, onToggleSelect }) => {
  const { t } = useTranslation();
  const hasImage = product.image_urls && product.image_urls.length > 0;
  const hasSafetyInfo = (product.allergens_tags?.length ?? 0) > 0
    || (product.additives_tags?.length ?? 0) > 0
    || product.ecoscore_grade;
  const favLabel = isFav
    ? t('pages.database.retailProduct.removeFavorite')
    : t('pages.database.retailProduct.addFavorite');
  const selectLabel = isSelected
    ? t('pages.database.retailProduct.deselect')
    : t('pages.database.retailProduct.selectCompare');
  const originInfo = getOriginBadge(product.data_origin, product.source);

  return (
    <div
      className="card card-hover mb-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border border-border"
    >
      {hasImage && (
        <img
          src={product.image_urls?.[0]}
          alt={product.product_name}
          className="max-h-[120px] object-contain mb-[var(--space-apple-sm)] rounded"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-semibold mb-1.5 flex items-center gap-1.5">
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                className="truncate text-left font-semibold cursor-pointer hover:underline rounded-none px-0"
              >
                {product.product_name}
              </button>
            ) : (
              <span className="truncate">{product.product_name}</span>
            )}
            {/* 用 wrapper 原生 API：Tooltip 自带 Provider，Trigger 以 asChild 合并到
                <button> 上，不再多渲染一层 <button>（见文件顶部同型注释）。 */}
            <Tooltip content={favLabel} position="top">
              <button
                type="button"
                aria-label={favLabel}
                onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
                className="cursor-pointer text-lg leading-none border-0 bg-transparent p-0 rounded"
              >
                {isFav ? <Flame className="h-4 w-4 text-warning fill-warning" /> : <Star className="h-4 w-4 text-muted-foreground" />}
              </button>
            </Tooltip>
            <Tooltip content={selectLabel} position="top">
              <button
                type="button"
                aria-label={selectLabel}
                aria-pressed={isSelected}
                onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                className="cursor-pointer text-lg leading-none ml-2 border-0 bg-transparent p-0 rounded"
              >
                {isSelected ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <span className="text-muted-foreground">☐</span>
                )}
              </button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="info">{product.brand}</Badge>
            {product.category && <Badge variant="secondary">{product.category}</Badge>}
            {product.formulation_type && <Badge variant="success">{product.formulation_type}</Badge>}
            {originInfo && (
              <Tooltip
                content={t(`pages.database.retailProduct.${originInfo.tooltipKey}`)}
                position="top"
                className="max-w-xs"
              >
                <Badge variant={originInfo.variant as "warning" | "info" | "neutral" | "default"}>
                  {t(`pages.database.retailProduct.${originInfo.labelKey}`)}
                </Badge>
              </Tooltip>
            )}
          </div>
          {hasSafetyInfo && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {product.allergens_tags?.map((a) => (<Badge key={a} variant="destructive">{a}</Badge>))}
              {product.additives_tags?.map((a) => (<Badge key={a} variant="warning">{a}</Badge>))}
              {product.ecoscore_grade && (
                <Badge variant={getEcoscoreColor(product.ecoscore_grade) as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "danger" | "neutral" | "primary"}>
                  {t('pages.database.retailProduct.ecoscore')}: {product.ecoscore_grade.toUpperCase()}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="text-right ml-4 shrink-0" style={{ minWidth: 80 }}>
          {product.price && product.price > 0 ? (
            <div className="text-lg font-bold text-destructive">
              ¥{Number(product.price).toFixed(2)}
            </div>
          ) : null}
          {product.avg_rating && product.avg_rating > 0 ? (
            <StarRating value={product.avg_rating} size={12} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── 主搜索面板 ──

const RetailProductSearchPanel: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  // 翻译键快捷方式：retailProduct 命名空间（支持 i18next 插值参数）
  const rp = useCallback(
    (key: string, options?: Record<string, unknown>) => t(`pages.database.retailProduct.${key}`, options),
    [t],
  );
  const addToast = useToastStore((s) => s.addToast);
  // toast helper alias for compatibility（基于 store 的稳定引用，避免 effect 依赖导致重复请求）
  const toast = useMemo(() => ({
    success: (message: string, options?: { duration?: number; title?: string }) =>
      addToast({ type: 'success', message, ...options }),
    error: (message: string, options?: { duration?: number; title?: string }) =>
      addToast({ type: 'error', message, ...options }),
    warning: (message: string, options?: { duration?: number; title?: string }) =>
      addToast({ type: 'warning', message, ...options }),
    info: (message: string, options?: { duration?: number; title?: string }) =>
      addToast({ type: 'info', message, ...options }),
  }), [addToast]);

  // 搜索框建议列表的关闭定时器（组件卸载时清理，避免测试/开发环境下的定时器泄漏）
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetailProductDetail[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<import('../../../api/searchNew').SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [internetOnly, setInternetOnly] = useState(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [offError, setOffError] = useState<string>('');
  const [offTotal, setOffTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<OFFCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RetailProductDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [compareVisible, setCompareVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Phase 3: 新增状态
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Phase 4: 新增状态
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [formulationType, setFormulationType] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('');
  // Phase 5: 新增状态
  const [novaGroup, setNovaGroup] = useState<string>('');        // '' = 未选择
  const [minCompleteness, setMinCompleteness] = useState<string>(''); // '' = 未设置
  const [sortBy, setSortBy] = useState<string>('relevance');

  // 从服务器加载用户收藏（持久化）
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const pantryProducts = await getPantryRetailProducts();
        const favoriteIds = pantryProducts.map((p) => p.id);
        setFavorites(new Set(favoriteIds));
      } catch (err) {
        logger.error('[RetailProductSearch] 加载收藏失败:', err);
        toast.info(rp('favListLoadFailed'));
      }
    };
    loadFavorites();
  }, [toast, rp]);

  // 加载分类列表
  useEffect(() => {
    getOpenFoodFactsCategories()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  // 处理搜索
  const handleSearch = useCallback(async (
    page: number = 1,
    overrideQuery?: string,
    overrideOrigin?: 'all' | 'internet' | 'local',
  ) => {
    const keyword = (overrideQuery ?? query).trim();
    if (!keyword && !selectedCategory && !brandFilter && !formulationType && !priceRange.min && !priceRange.max) return;
    const origin = overrideOrigin ?? (internetOnly ? 'internet' : 'all');
    setLoading(true);
    setError('');
    setOffError('');
    setOffTotal(null);
    try {
      let transformed: RetailProductDetail[] = [];
      let source = '';
      let fallbackError = '';

      if (selectedCategory) {
        const m = await import('../../../api/searchNew');
        const categoryResp = await m.getProductsByCategory(selectedCategory, { page, page_size: 20, realtime });
        if (!categoryResp || !Array.isArray(categoryResp.items)) {
          setError(rp('serviceUnavailable'));
          setResults([]);
          setTotalResults(0);
          setDataSource('');
          return;
        }
        transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
        source = categoryResp.data_source || 'unknown';
        setTotalResults(categoryResp.total ?? transformed.length);
      } else {
        const response = await searchOpenFoodFacts({
          query: keyword,
          page,
          page_size: 20,
          realtime,
          origin,
          brand: brandFilter,
          formulation_type: formulationType,
          min_price: priceRange.min,
          max_price: priceRange.max,
          nova_group: novaGroup ? Number(novaGroup) : undefined,
          min_completeness: minCompleteness ? parseFloat(minCompleteness) : undefined,
          sort_by: sortBy,
        });
        // response 为空（如请求被中止/拦截器返回 data:null）或 items 非数组时，
        // 给出明确可操作的中文错误，而不是笼统的“搜索请求失败”。
        if (!response || !Array.isArray(response.items)) {
          setError(rp('serviceUnavailable'));
          setResults([]);
          setTotalResults(0);
          setDataSource('');
          return;
        }
        transformed = (response.items as OFFRawProduct[]).map(mapOFFProduct);
        source = response.data_source || 'unknown';
        fallbackError = response.off_error || response.error || '';
        setTotalResults(response.total ?? transformed.length);
        setOffTotal(response.off_total ?? null);
      }

      setResults(transformed);
      setDataSource(source);
      setOffError(fallbackError);
      setCurrentPage(page);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const isNetworkError = /网络请求失败|超时|timeout|ECONNABORTED|Network Error|ERR_ABORTED|canceled/i.test(rawMsg);
      setError(
        isNetworkError
          ? rp('networkError')
          : rawMsg || rp('serviceUnavailable'),
      );
      setResults([]);
      setTotalResults(0);
      setDataSource('');
      setOffError('');
      setOffTotal(null);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, realtime, internetOnly, brandFilter, formulationType, priceRange, novaGroup, minCompleteness, sortBy, rp]);

  // 搜索建议
  const handleInputChange = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length >= 1) {
      try {
        const resp = await getSearchSuggestions(value, 10);
        setSuggestions(resp.suggestions.filter((s) => s.type === 'retail_product'));
        setShowSuggestions(true);
      } catch { /* 忽略建议请求错误 */ }
    } else {
      setShowSuggestions(false);
    }
  }, []);

  

  // 收藏切换（持久化到后端）
  const toggleFavorite = useCallback(async (id: number) => {
    const isCurrentlyFav = favorites.has(id);

    if (isCurrentlyFav) {
      try {
        await removeFromPantryRetailProduct(id);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success(rp('favRemoved'));
      } catch (err) {
        logger.error('[RetailProductSearch] 取消收藏失败:', err);
        toast.error(rp('favRemoveFailed'));
      }
    } else {
      try {
        await addToPantryRetailProduct(id);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        toast.success(rp('favAdded'));
      } catch (err) {
        logger.error('[RetailProductSearch] 收藏失败:', err);
        toast.error(rp('favAddFailed'));
      }
    }
  }, [favorites, setFavorites, toast, rp]);

  // 选择用于对比的产品
  const toggleSelect = useCallback((id: number) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 排序 + 收藏过滤 + 选择过滤
  const filteredAndSortedItems = useMemo(() => {
    let arr = [...results];
    if (showFavOnly) arr = arr.filter((p) => favorites.has(p.id));
    arr.sort((a, b) => {
      const va = a[sortField] ?? '';
      const vb = b[sortField] ?? '';
      if (typeof va === 'number') return sortDir === 'asc' ? va - Number(vb) : Number(vb) - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [results, showFavOnly, favorites, sortField, sortDir]);

  // 导出 CSV
  const exportCSV = useCallback(() => {
    const items = filteredAndSortedItems;
    if (!items.length) return;
    const headers = [
      rp('csvProductName'), rp('csvBrand'), rp('csvCategory'), rp('csvSubCategory'),
      rp('csvFormulation'), rp('csvPrice'), rp('csvRating'), rp('csvSpec'),
      rp('csvAllergens'), rp('csvAdditives'), rp('csvEcoscore'),
      rp('csvFavorite'), rp('csvCompare'),
    ];
    const rows = items.map((p) => [
      p.product_name || '',
      p.brand || '',
      p.category || '',
      p.sub_category || '',
      p.formulation_type || '',
      p.price ?? '',
      p.avg_rating ?? '',
      p.package_size || '',
      (p.allergens_tags || []).join(';'),
      (p.additives_tags || []).join(';'),
      p.ecoscore_grade || '',
      favorites.has(p.id) ? '★' : '',
      selectedProducts.has(p.id) ? '✓' : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retail_products_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSortedItems, favorites, selectedProducts, rp]);

  // 排序切换
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  // 用于对比弹窗的已选产品列表
  const compareProducts = useMemo(
    () => results.filter((p) => selectedProducts.has(p.id)),
    [results, selectedProducts],
  );

  // 结果是否来自 OFF 实时/回退/缓存路径（相关度过滤后的 total 才有意义）
  const isApiSource =
    dataSource.includes('api') || dataSource.includes('fallback') || dataSource.includes('cache');

  // 来源统计：互联网真实/缓存产品 vs 平台参考数据
  const originCounts = useMemo(() => {
    let internet = 0;
    let local = 0;
    for (const p of results) {
      const o = (p.data_origin ?? '').toLowerCase();
      const s = (p.source ?? '').toLowerCase();
      if (o === 'internet_realtime' || o === 'internet_cache' || s === 'openfoodfacts') {
        internet += 1;
      } else if (o === 'local_reference' || s === 'manual') {
        local += 1;
      }
    }
    return { internet, local, total: internet + local };
  }, [results]);

  

  // 表格列定义（DataTable / ColumnDef 格式）
  const tableColumns = useMemo<ColumnDef<RetailProductDetail, unknown>[]>(() => [
    {
      accessorKey: '_select',
      header: rp('colSelect'),
      size: 60,
      cell: ({ row }: { row: { original: RetailProductDetail } }) => (
        <span
          role="button"
          tabIndex={0}
          aria-label={selectedProducts.has(row.original.id) ? rp('deselect') : rp('selectCompare')}
          aria-pressed={selectedProducts.has(row.original.id)}
          onClick={() => toggleSelect(row.original.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSelect(row.original.id);
            }
          }}
          className={`cursor-pointer text-base select-none rounded ${
            selectedProducts.has(row.original.id) ? 'text-primary' : 'text-muted-foreground'
          }`}
          title={selectedProducts.has(row.original.id) ? rp('deselect') : rp('selectCompare')}
        >
          {selectedProducts.has(row.original.id) ? '✓' : '☐'}
        </span>
      ),
    },
    {
      accessorKey: 'product_name',
      header: rp('colName'),
      cell: ({ row }: { row: { original: RetailProductDetail } }) => {
        const originInfo = getOriginBadge(row.original.data_origin, row.original.source);
        return (
          <div className="flex flex-col items-start gap-1">
            <a
              onClick={() => { setSelectedProduct(row.original); setDetailVisible(true); }}
              className="text-primary hover:underline cursor-pointer"
            >
              {row.original.product_name}
            </a>
            {originInfo && (
              <Badge variant={originInfo.variant as "warning" | "info" | "neutral" | "default"}>
                {rp(originInfo.labelKey)}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'brand',
      header: rp('colBrand'),
      size: 150,
    },
    {
      accessorKey: 'category',
      header: rp('colCategory'),
      size: 120,
    },
    {
      accessorKey: 'price',
      header: rp('colPrice'),
      size: 100,
      cell: ({ row }: { row: { original: RetailProductDetail } }) => {
        const v = row.original.price;
        return v != null ? `¥${Number(v).toFixed(2)}` : '-';
      },
    },
    {
      accessorKey: 'avg_rating',
      header: rp('colRating'),
      size: 100,
      cell: ({ row }) => {
        const v = row.original.avg_rating;
        return v != null ? <StarRating value={v} size={12} /> : '-';
      },
    },
    {
      accessorKey: 'ecoscore_grade',
      header: rp('colEcoscore'),
      size: 100,
      cell: ({ row }) => {
        const v = row.original.ecoscore_grade;
        return v ? (
          <Badge variant={getEcoscoreColor(v) as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "danger" | "neutral" | "primary"}>{v.toUpperCase()}</Badge>
        ) : '-';
      },
    },
    {
      accessorKey: '_fav',
      header: rp('colFavorite'),
      size: 50,
      cell: ({ row }) => (
        <span
          role="button"
          tabIndex={0}
          aria-label={favorites.has(row.original.id) ? rp('removeFavorite') : rp('addFavorite')}
          aria-pressed={favorites.has(row.original.id)}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(row.original.id); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleFavorite(row.original.id);
            }
          }}
          className={`cursor-pointer text-base select-none rounded ${
            favorites.has(row.original.id) ? 'text-warning' : 'text-muted-foreground'
          }`}
          title={favorites.has(row.original.id) ? rp('removeFavorite') : rp('addFavorite')}
        >
          {favorites.has(row.original.id) ? '★' : '☆'}
        </span>
      ),
    },
  ], [favorites, selectedProducts, toggleFavorite, toggleSelect, rp]);

  return (
    <div className={className}>
      {/* 搜索控制区 */}
      <Card className="mb-[var(--space-apple-md)]">
        <div className="flex flex-col gap-4">
          {/* 搜索栏 */}
          <div className="relative">
            <Input
              placeholder={rp('searchPlaceholder')}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => {
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); handleSearch(1); } }}
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              suffix={
                <span
                  className="cursor-pointer text-muted-foreground hover:text-primary"
                  role="button"
                  tabIndex={0}
                  aria-label={rp('searchAria')}
                  onClick={() => { setCurrentPage(1); handleSearch(1); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCurrentPage(1);
                      handleSearch(1);
                    }
                  }}
                  title={rp('searchAria')}
                >
                  <Search className="h-4 w-4" />
                </span>
              }
              className="w-full"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-[var(--radius-Apple-sm)] shadow-md z-50 max-h-48 overflow-auto">
                {suggestions.map((s) => (
                  <div
                    key={s.text}
                    className="px-[var(--space-apple-sm)] py-2 cursor-pointer text-sm hover:bg-accent"
                    onMouseDown={(e) => {
                      // 阻止 mousedown 默认行为，避免输入框先触发 blur 导致建议列表在点击前关闭
                      e.preventDefault();
                      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                      setQuery(s.text);
                      setShowSuggestions(false);
                    }}
                  >
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 筛选工具栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Filter className="h-3.5 w-3.5" />}
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            >
              {rp('categoryFilter')}
            </Button>

            {/* 品牌筛选 (Phase 4) */}
            {results.length > 0 && (
              <Input
                placeholder={rp('brandPlaceholder')}
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-[100px]"
              />
            )}

            {/* 剂型筛选 (Phase 4) */}
            <Input
              placeholder={rp('formulationPlaceholder')}
              value={formulationType}
              onChange={(e) => setFormulationType(e.target.value)}
              className="w-[100px]"
            />

            {/* NOVA 分组筛选 (Phase 5) */}
            <Select
              value={novaGroup}
              onValueChange={(v) => {
                setNovaGroup(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={rp('novaGroupLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{rp('all')}</SelectItem>
                <SelectItem value="1">NOVA 1</SelectItem>
                <SelectItem value="2">NOVA 2</SelectItem>
                <SelectItem value="3">NOVA 3</SelectItem>
                <SelectItem value="4">NOVA 4</SelectItem>
              </SelectContent>
            </Select>

            {/* 数据完整度 (Phase 5) */}
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              placeholder={rp('completenessMin')}
              value={minCompleteness}
              onChange={(e) => setMinCompleteness(e.target.value)}
              className="w-[80px]"
            />

            {/* 排序 (Phase 5) */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder={rp('sortByLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">{rp('sortRelevance')}</SelectItem>
                <SelectItem value="quality">{rp('sortQuality')}</SelectItem>
                <SelectItem value="name">{rp('sortName')}</SelectItem>
                <SelectItem value="date">{rp('sortDate')}</SelectItem>
                <SelectItem value="nova">{rp('sortNova')}</SelectItem>
              </SelectContent>
            </Select>

            {/* 价格范围筛选 (Phase 4) */}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder={rp('priceMinPlaceholder')}
                value={priceRange.min ?? ''}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value ? Number(e.target.value) : undefined })}
                className="w-[60px]"
              />
              <span className="text-muted-foreground">{rp('priceRangeSeparator')}</span>
              <Input
                type="number"
                placeholder=""
                value={priceRange.max ?? ''}
                onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value ? Number(e.target.value) : undefined })}
                className="w-[60px]"
              />
            </div>

            {/* 注意：@/components/ui 把 TooltipWrapper 导出为 Tooltip，它内部自带一层
                TooltipTrigger。因此不能用 <Tooltip><TooltipTrigger>…</TooltipTrigger>
                的标准 shadcn 嵌套写法 —— 那会再包一层 <button>，与 Switch（也是
                <button>）形成 button 套 button 的无效 HTML。
                用 wrapper 原生 API：<Tooltip content="…"> 直接包裹 Switch，
                asChild 默认开启，Trigger 行为合并到 Switch 自身，只留一个交互元素。 */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded">
              <Zap className={`h-4 w-4 ${realtime ? 'text-warning' : 'text-muted-foreground'}`} aria-hidden="true" />
              <Tooltip
                content={rp('realtimeTooltip')}
                position="top"
                className="max-w-xs"
              >
                <Switch
                  checked={realtime}
                  onCheckedChange={setRealtime}
                  aria-label={rp('realtimeLabel')}
                />
              </Tooltip>
            </div>

            {dataSource && (
              <Badge variant={dataSource.includes('api') ? 'warning' : 'info'}>
                {rp('dataSourceLabel')}: {dataSource}
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => { setCurrentPage(1); handleSearch(1); }}
              loading={loading}
            >
              {rp('refresh')}
            </Button>
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive" title={rp('searchFailed')} description={error}>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => { setCurrentPage(1); handleSearch(1); }}
                >
                  {rp('retry')}
                </Button>
              </div>
            </Alert>
          )}

          {/* 高级筛选面板 (Phase 4) */}
          {showCategoryFilter && (
            <Card style={{ background: 'hsl(var(--accent))' }}>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  setCurrentPage(1);
                  handleSearch(1);
                }}
                disabled={categories.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={rp('browseCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_tag || c.category} value={c.category_tag || c.category}>
                      {c.category} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          )}

          {/* 搜索按钮 */}
          <Button
            variant="primary"
            size="lg"
            icon={<Search className="h-4 w-4" />}
            loading={loading}
            onClick={() => { setCurrentPage(1); handleSearch(1); }}
            className="w-full"
          >
            {realtime ? rp('searchRealtimeButton') : rp('searchButton')}
          </Button>
        </div>
      </Card>

      {/* 结果工具栏（Phase 3+4） */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 mb-[var(--space-apple-sm)] flex-wrap">
          <span className="text-xs text-muted-foreground">
            {isApiSource ? (
              <>
                {rp('relevanceFiltered', { count: totalResults })}
                {offTotal != null && offTotal > totalResults && (
                  <Badge variant="outline" className="ml-2">
                    {rp('offRawMatches', { count: offTotal })}
                  </Badge>
                )}
              </>
            ) : (
              t('pages.database.retailProduct.foundProducts', { count: totalResults })
            )}
            {isApiSource && <Badge variant="warning" className="ml-2">{rp('realtimeBadge')}</Badge>}
            {!isApiSource && dataSource.includes('postgresql') && (
              <Badge variant="info" className="ml-2">{rp('localMatchBadge')}</Badge>
            )}
          </span>

          {/* 来源统计：共 N 款（X 互联网 / Y 平台参考） */}
          {originCounts.total > 0 && (
            <span className="text-xs text-muted-foreground">
              {rp('originStats', {
                total: totalResults,
                internet: originCounts.internet,
                local: originCounts.local,
              })}
            </span>
          )}

          {/* 仅看互联网产品开关 */}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={internetOnly}
              onCheckedChange={(v) => {
                setInternetOnly(v);
                setCurrentPage(1);
                handleSearch(1, undefined, v ? 'internet' : 'all');
              }}
              aria-label={rp('originInternetOnly')}
            />
            <span className="text-xs text-muted-foreground">{rp('originInternetOnly')}</span>
          </div>

          <div className="flex-1" />

          {/* 收藏过滤 */}
          <Button
            variant={showFavOnly ? 'primary' : 'outline'}
            size="sm"
            icon={<Star className="h-3.5 w-3.5" />}
            onClick={() => setShowFavOnly(!showFavOnly)}
          >
            {rp('favoritesButton')}{favorites.size > 0 ? ` (${favorites.size})` : ''}
          </Button>

          {/* 对比操作 */}
          {selectedProducts.size > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                icon={<Check className="h-3.5 w-3.5" />}
                onClick={() => setCompareVisible(true)}
              >
                {rp('compareButton')} ({selectedProducts.size})
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                {rp('clearSelection')}
              </Button>
            </>
          )}

          {/* 排序 */}
          <Button
            variant="outline"
            size="sm"
            icon={
              sortField === 'price'
                ? sortDir === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowDownZA className="h-3.5 w-3.5" />
                : null
            }
            onClick={() => toggleSort('price')}
          >
            {sortField === 'price' ? (sortDir === 'asc' ? rp('priceAsc') : rp('priceDesc')) : rp('priceSort')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={
              sortField === 'brand'
                ? sortDir === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowDownZA className="h-3.5 w-3.5" />
                : null
            }
            onClick={() => toggleSort('brand')}
          >
            {sortField === 'brand' ? (sortDir === 'asc' ? rp('brandAsc') : rp('brandDesc')) : rp('brandSort')}
          </Button>

          {/* 视图切换 */}
          <div className="flex rounded-[var(--radius-Apple-sm)] overflow-hidden border border-border">
            <Button
              variant={viewMode === 'table' ? 'primary' : 'ghost'}
              size="sm"
              icon={<List className="h-3.5 w-3.5" />}
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            />
            <Button
              variant={viewMode === 'card' ? 'primary' : 'ghost'}
              size="sm"
              icon={<Grid className="h-3.5 w-3.5" />}
              onClick={() => setViewMode('card')}
              className="rounded-l-none"
            />
          </div>

          {/* 导出 */}
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCSV}>
            {rp('exportCsv')}
          </Button>
        </div>
      )}

      {/* OFF 数据同步状态面板（结果工具栏下方、搜索结果上方） */}
      {results.length > 0 && (
        <RetailProductSyncPanel className="mb-[var(--space-apple-md)]" />
      )}

      {/* 搜索结果 */}
      {loading ? (
        <div className="space-y-4" role="status" aria-label={rp('loadingResults')}>
          <ListSkeleton items={4} hasAvatar={false} hasArrow={false} />
        </div>
      ) : filteredAndSortedItems.length > 0 ? (
        <>
          {viewMode === 'card' ? (
            filteredAndSortedItems.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => { setSelectedProduct(product); setDetailVisible(true); }}
                onToggleFav={() => toggleFavorite(product.id)}
                isFav={favorites.has(product.id)}
                isSelected={selectedProducts.has(product.id)}
                onToggleSelect={() => toggleSelect(product.id)}
              />
            ))
          ) : (
            <DataTable
              columns={tableColumns}
              data={filteredAndSortedItems}
              pageSizeOptions={[20]}
            />
          )}

          {/* OFF 实时回退失败提示（本地结果仍在展示） */}
          {offError && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning"
            >
              <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{rp('offUnavailable')}</span>
            </div>
          )}

          {/* 分页 */}
          {totalResults > 20 && (
            <Pagination
              page={currentPage}
              pageSize={20}
              total={totalResults}
              onPageChange={(page) => { setCurrentPage(page); handleSearch(page); }}
              className="mt-[var(--space-apple-md)]"
            />
          )}
        </>
      ) : error ? (
        <div className="text-center py-10">
          <div className="text-destructive">{rp('searchFailed')}: {error}</div>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => { setCurrentPage(1); handleSearch(1); }}
            className="mt-4"
          >
            {rp('retry')}
          </Button>
        </div>
      ) : query || selectedCategory ? (
        <div className="space-y-4">
          {/* 按 data_source / realtime / off_error 区分空结果文案 */}
          {realtime ? (
            <EmptyState
              title={rp('noRelevantTitle', { query })}
              description={rp('noRelevantDescription')}
            />
          ) : dataSource === 'postgresql_ilike_empty' && !realtime ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm text-info"
            >
              <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{rp('emptyLocalGuide')}</span>
            </div>
          ) : dataSource.includes('api') || dataSource === 'empty' || dataSource === 'openfoodfacts_api' || dataSource === 'openfoodfacts_api_fallback' ? (
            <EmptyState title={rp('emptyApiTitle')} description={rp('emptyApiDescription')} />
          ) : (
            <EmptyState title={rp('noMatchTitle')} description={rp('noMatchDescription')} />
          )}

          {/* 热门搜索词引导：点击即搜索 */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">{rp('hotSearchesTitle')}:</span>
            {HOT_SEARCH_KEYS.map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => {
                  const term = rp(key);
                  setQuery(term);
                  setCurrentPage(1);
                  handleSearch(1, term);
                }}
              >
                {rp(key)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title={rp('initialTitle')}
          description={rp('initialDescription')}
        />
      )}

      {/* 详情弹窗 */}
      <RetailProductDetailModal
        visible={detailVisible}
        product={selectedProduct}
        onClose={() => setDetailVisible(false)}
      />
      {/* 产品对比弹窗 */}
      <RetailProductCompareModal
        visible={compareVisible}
        products={compareProducts}
        onClose={() => setCompareVisible(false)}
      />
    </div>
  );
};

export default RetailProductSearchPanel;
