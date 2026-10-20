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
import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useToast } from '@/components/ui';
import { logger } from '@/utils/safeLogger';

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
    allersens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [],
    additives_tags: Array.isArray(raw.additives_tags) ? raw.additives_tags : [],
    ecoscore_grade: raw.ecoscore_grade ?? null,
    traces_tags: Array.isArray(raw.traces_tags) ? raw.traces_tags : [],
    contaminants: Array.isArray(raw.contaminants) ? raw.contaminants : [],
  };
}

type ViewMode = 'card' | 'table';
type SortField = 'brand' | 'price' | 'product_name';
type SortDir = 'asc' | 'desc';

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
  const hasImage = product.image_urls && product.image_urls.length > 0;
  const hasSafetyInfo = (product.allergens_tags?.length ?? 0) > 0
    || (product.additives_tags?.length ?? 0) > 0
    || product.ecoscore_grade;

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
            <Tooltip content={isFav ? '取消收藏' : '收藏'} position="top">
              <button
                type="button"
                aria-label={isFav ? '取消收藏' : '收藏'}
                onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
                className="cursor-pointer text-lg leading-none border-0 bg-transparent p-0 rounded"
              >
                {isFav ? <Flame className="h-4 w-4 text-warning fill-warning" /> : <Star className="h-4 w-4 text-muted-foreground" />}
              </button>
            </Tooltip>
            <Tooltip content={isSelected ? '取消选择' : '选择对比'} position="top">
              <button
                type="button"
                aria-label={isSelected ? '取消选择' : '选择对比'}
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
          </div>
          {hasSafetyInfo && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {product.allergens_tags?.map((a) => (<Badge key={a} variant="destructive">{a}</Badge>))}
              {product.additives_tags?.map((a) => (<Badge key={a} variant="warning">{a}</Badge>))}
              {product.ecoscore_grade && (
                <Badge variant={getEcoscoreColor(product.ecoscore_grade) as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "danger" | "neutral" | "primary"}>
                  生态评分: {product.ecoscore_grade.toUpperCase()}
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
  const { success, error: toastError, warning, info } = useToast()
  // toast helper alias for compatibility
  const toast = { success, error: toastError, warning, info };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetailProductDetail[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<import('../../../api/searchNew').SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [categories, setCategories] = useState<OFFCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<RetailProductDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
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
        const favoriteIds = pantryProducts.map((p: any) => p.id);
        setFavorites(new Set(favoriteIds));
      } catch (err) {
        logger.error('[RetailProductSearch] 加载收藏失败:', err);
        toast.info('收藏列表未加载，请检查网络连接');
      }
    };
    loadFavorites();
  }, [toast]);

  // 加载分类列表
  useEffect(() => {
    getOpenFoodFactsCategories()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  // 处理搜索
  const handleSearch = useCallback(async (page: number = 1) => {
    if (!query.trim() && !selectedCategory && !brandFilter && !formulationType && !priceRange.min && !priceRange.max) return;
    setLoading(true);
    setError('');
    try {
      let transformed: RetailProductDetail[] = [];
      let source = '';

      if (selectedCategory) {
        const m = await import('../../../api/searchNew');
        const categoryResp = await m.getProductsByCategory(selectedCategory, { page, page_size: 20, realtime });
        transformed = (categoryResp.items as OFFRawProduct[]).map(mapOFFProduct);
        source = categoryResp.data_source || 'unknown';
        setTotalResults(categoryResp.total ?? transformed.length);
      } else {
        const response = await searchOpenFoodFacts({
          query: query.trim(),
          page,
          page_size: 20,
          realtime,
          brand: brandFilter,
          formulation_type: formulationType,
          min_price: priceRange.min,
          max_price: priceRange.max,
          nova_group: novaGroup ? Number(novaGroup) : undefined,
          min_completeness: minCompleteness ? parseFloat(minCompleteness) : undefined,
          sort_by: sortBy,
        });
        if (!response) throw new Error('搜索请求失败，请稍后重试');
        transformed = (response.items as OFFRawProduct[]).map(mapOFFProduct);
        source = response.data_source || 'unknown';
        setTotalResults(response.total ?? transformed.length);
      }

      setResults(transformed);
      setDataSource(source);
      setCurrentPage(page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, realtime, brandFilter, formulationType, priceRange, novaGroup, minCompleteness, sortBy]);

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
        toast.success('已取消收藏');
      } catch (err) {
        logger.error('[RetailProductSearch] 取消收藏失败:', err);
        toast.error('取消收藏失败');
      }
    } else {
      try {
        await addToPantryRetailProduct(id);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        toast.success('已添加到收藏');
      } catch (err) {
        logger.error('[RetailProductSearch] 收藏失败:', err);
        toast.error('收藏失败');
      }
    }
  }, [favorites, setFavorites, toast]);

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
    const headers = ['产品名称', '品牌', '分类', '子分类', '剂型', '价格(CNY)', '评分', '规格', '过敏原', '添加剂', '生态评分', '收藏', '对比'];
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
  }, [filteredAndSortedItems, favorites, selectedProducts]);

  // 排序切换
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  

  // 表格列定义（DataTable / ColumnDef 格式）
  const tableColumns = useMemo<ColumnDef<RetailProductDetail, any>[]>(() => [
    {
      accessorKey: '_select',
      header: '选择',
      size: 60,
      cell: ({ row }: { row: { original: RetailProductDetail } }) => (
        <span
           role="button" tabIndex={0} onClick={() => toggleSelect(row.original.id)}
          style={{ cursor: 'pointer', fontSize: 16, color: selectedProducts.has(row.original.id) ? '#1890ff' : '#ccc' }}
          title={selectedProducts.has(row.original.id) ? '取消选择' : '选择对比'}
        >
          {selectedProducts.has(row.original.id) ? '✓' : '☐'}
        </span>
      ),
    },
    {
      accessorKey: 'product_name',
      header: '名称',
      cell: ({ row }: { row: { original: RetailProductDetail } }) => (
        <a
          onClick={() => { setSelectedProduct(row.original); setDetailVisible(true); }}
          className="text-primary hover:underline cursor-pointer"
        >
          {row.original.product_name}
        </a>
      ),
    },
    {
      accessorKey: 'brand',
      header: '品牌',
      size: 150,
    },
    {
      accessorKey: 'category',
      header: '分类',
      size: 120,
    },
    {
      accessorKey: 'price',
      header: '价格',
      size: 100,
      cell: ({ row }: { row: { original: RetailProductDetail } }) => {
        const v = row.original.price;
        return v != null ? `¥${Number(v).toFixed(2)}` : '-';
      },
    },
    {
      accessorKey: 'avg_rating',
      header: '评分',
      size: 100,
      cell: ({ row }) => {
        const v = row.original.avg_rating;
        return v != null ? <StarRating value={v} size={12} /> : '-';
      },
    },
    {
      accessorKey: 'ecoscore_grade',
      header: '生态评分',
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
      header: '收藏',
      size: 50,
      cell: ({ row }) => (
        <span
           role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggleFavorite(row.original.id); }}
          style={{ cursor: 'pointer', fontSize: 16, color: favorites.has(row.original.id) ? '#faad14' : '#d9d9d9' }}
          title={favorites.has(row.original.id) ? '取消收藏' : '收藏'}
        >
          {favorites.has(row.original.id) ? '★' : '☆'}
        </span>
      ),
    },
  ], [favorites, selectedProducts, toggleFavorite, toggleSelect]);

  return (
    <div className={className}>
      {/* 搜索控制区 */}
      <Card className="mb-[var(--space-apple-md)]">
        <div className="flex flex-col gap-4">
          {/* 搜索栏 */}
          <div className="relative">
            <Input
              placeholder="搜索零售产品 (如: 胶原蛋白肽口服液、益生菌胶囊)... "
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); handleSearch(1); } }}
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              suffix={
                <span
                  className="cursor-pointer text-muted-foreground hover:text-primary"
                   role="button" tabIndex={0} onClick={() => { setCurrentPage(1); handleSearch(1); }}
                  title="搜索"
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
                    onMouseDown={() => { setQuery(s.text); setShowSuggestions(false); }}
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
              分类筛选
            </Button>

            {/* 品牌筛选 (Phase 4) */}
            {results.length > 0 && (
              <Input
                placeholder="品牌"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-[100px]"
              />
            )}

            {/* 剂型筛选 (Phase 4) */}
            <Input
              placeholder="剂型"
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
                <SelectValue placeholder="NOVA分组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
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
              placeholder="完整度≥"
              value={minCompleteness}
              onChange={(e) => setMinCompleteness(e.target.value)}
              className="w-[80px]"
            />

            {/* 排序 (Phase 5) */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">相关度</SelectItem>
                <SelectItem value="quality">完整度</SelectItem>
                <SelectItem value="name">名称</SelectItem>
                <SelectItem value="date">日期</SelectItem>
                <SelectItem value="nova">NOVA分组</SelectItem>
              </SelectContent>
            </Select>

            {/* 价格范围筛选 (Phase 4) */}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="价"
                value={priceRange.min ?? ''}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value ? Number(e.target.value) : undefined })}
                className="w-[60px]"
              />
              <span className="text-muted-foreground">~</span>
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
                content="开启后直接调用 OpenFoodFacts REST API，获取最新数据"
                position="top"
                className="max-w-xs"
              >
                <Switch
                  checked={realtime}
                  onCheckedChange={setRealtime}
                  aria-label="实时数据源"
                />
              </Tooltip>
            </div>

            {dataSource && (
              <Badge variant={dataSource.includes('api') ? 'warning' : 'info'}>
                数据源: {dataSource}
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => { setCurrentPage(1); handleSearch(1); }}
              loading={loading}
            >
              刷新
            </Button>
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive" title="搜索失败" description={error} />
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
                  <SelectValue placeholder="选择分类浏览" />
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
            {realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品'}
          </Button>
        </div>
      </Card>

      {/* 结果工具栏（Phase 3+4） */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 mb-[var(--space-apple-sm)] flex-wrap">
          <span className="text-xs text-muted-foreground">
            找到 {totalResults} 款产品
            {realtime && <Badge variant="warning" className="ml-2">实时数据</Badge>}
            {!realtime && dataSource.includes('postgresql') && (
              <Badge variant="info" className="ml-2">数据库缓存</Badge>
            )}
          </span>

          <div className="flex-1" />

          {/* 收藏过滤 */}
          <Button
            variant={showFavOnly ? 'primary' : 'outline'}
            size="sm"
            icon={<Star className="h-3.5 w-3.5" />}
            onClick={() => setShowFavOnly(!showFavOnly)}
          >
            收藏{favorites.size > 0 ? ` (${favorites.size})` : ''}
          </Button>

          {/* 对比操作 */}
          {selectedProducts.size > 0 && (
            <>
              <Button variant="default" size="sm" icon={<Check className="h-3.5 w-3.5" />}>
                对比 ({selectedProducts.size})
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                清除选择
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
            {sortField === 'price' ? (sortDir === 'asc' ? '价格↑' : '价格↓') : '价格'}
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
            {sortField === 'brand' ? (sortDir === 'asc' ? '品牌↑' : '品牌↓') : '品牌'}
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
            导出 CSV
          </Button>
        </div>
      )}

      {/* 搜索结果 */}
      {loading ? (
        <Alert
          variant="info"
          title={realtime ? '正在查询 OpenFoodFacts...' : '正在搜索...'}
          description="请稍候"
        />
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
        <div className="text-center py-10 text-destructive">搜索失败: {error}</div>
      ) : query || selectedCategory ? (
        <EmptyState title="未找到匹配的产品" description="请尝试更换关键词或调整筛选条件" />
      ) : (
        <EmptyState
          title="请输入关键词搜索零售产品"
          description="或选择分类浏览 OpenFoodFacts 产品库"
        />
      )}

      {/* 详情弹窗（保留原组件引用，当前为 Modal 占位） */}
      {selectedProduct && detailVisible && (
        <RetailProductSearchPanel
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        />
      )}
    </div>
  );
};

export default RetailProductSearchPanel;
