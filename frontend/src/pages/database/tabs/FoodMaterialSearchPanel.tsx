/**
 * 食品原料搜索面板
 *
 * 对标 Potion AI VFT 的 Raw Material Search 界面。
 * 集成到 DatabasePage 的新 Tab 中。
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, CardHeader, CardContent,
  Button, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Badge,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Skeleton,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  Search, Filter, Star,
  CheckCircle, AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  searchFoodMaterials,
  listFoodMaterials,
  type FoodMaterialFilter,
  type FoodMaterialSearchResult,
  type FoodMaterialSearchResponse,
  normalizeName,
  checkMaterialCompliance,
  type NormalizeResult,
} from '../../../api/searchNew';
import { databaseApi } from '@/api/database';
import { logger } from '@/utils/safeLogger';

interface FoodMaterialSearchPanelProps {
  className?: string;
}

/**
 * 食品原料搜索结果卡片
 */
const MaterialCard: React.FC<{
  result: FoodMaterialSearchResult;
  onFavorite: (id: number) => void;
  isFavorite: boolean;
}> = ({ result, onFavorite, isFavorite }) => {
  const [complianceChecked, setComplianceChecked] = useState(false);
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null);

  const handleCheckCompliance = useCallback(async () => {
    try {
      const resp = await checkMaterialCompliance(result.id);
      const r = resp as any;
      setCompliancePassed(r?.passed);
      setComplianceChecked(true);
    } catch {
      setCompliancePassed(null);
    }
  }, [result.id]);

  const toxicityColor = (result.extra.toxicity_class as string) === '无毒' ? 'success' : 'warning';

  return (
    <div
      className="card card-hover cursor-pointer mb-3 p-4 rounded-lg border border-border hover:shadow-md transition-shadow"
      style={{ marginBottom: 12 }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold mb-1 truncate">
            {(result.extra.name_cn as string) || result.name}
            {(result.extra.name_latin as string) && (
              <span className="text-xs text-muted-foreground ml-2">
                ({result.extra.name_latin as string})
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(result.extra.category as string) && (
              <Badge variant="info">{result.extra.category as string}</Badge>
            )}
            {(result.extra.food_homology as boolean) && (
              <Badge variant="success">药食同源</Badge>
            )}
            {(result.extra.toxicity_class as string) && (
              <Badge variant={toxicityColor as "default" | "success" | "warning" | "error" | "info"}>
                {result.extra.toxicity_class as string}
              </Badge>
            )}
            {(result.extra.effects as string[])?.map((e: string) => (
              <Badge key={e} variant="secondary">{e}</Badge>
            ))}
          </div>
          {(result.extra.description as string) && (
            <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {(result.extra.description as string).substring(0, 120)}...
            </div>
          )}
        </div>
        <div className="text-right ml-4 shrink-0" style={{ minWidth: 80 }}>
          <div className="text-xs text-muted-foreground">相关度</div>
          <div className="text-xl font-bold text-primary">
            {(result.score * 100).toFixed(1)}%
          </div>
          {(result.extra.similarity as number | undefined) !== undefined && (
            <div className="text-[11px] text-muted-foreground mt-1">
              语义: {((((result.extra.similarity as number) ?? 0)) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      {/* 合规检查 */}
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
          variant={compliancePassed ? 'success' : 'destructive'}
          className="mt-2"
        >
          {compliancePassed ? '合规' : '不合规'}
        </Badge>
      )}
    </div>
  );
};

/**
 * 食品原料搜索面板主组件
 */
const FoodMaterialSearchPanel: React.FC<FoodMaterialSearchPanelProps> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodMaterialSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [filters, setFilters] = useState<Partial<FoodMaterialFilter>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchModes, setSearchModes] = useState({ bm25: 0.4, vector: 0.3, rule: 0.3 });
  const [normalized, setNormalized] = useState<NormalizeResult | null>(null);

  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // 名称标准化
      const normResult = await normalizeName(query.trim());
      setNormalized(normResult);

      const response: FoodMaterialSearchResponse = await searchFoodMaterials({
        query: normResult.canonical,
        filters: { ...filters, ...normResult },
        page: currentPage,
        per_page: 20,
        search_modes: searchModes,
      });
      setResults(response.results);
      setTotal(response.total);
      setSearchTime(response.search_time_ms);
    } catch (err) {
      logger.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  }, [query, filters, currentPage, searchModes]);

  // 添加到收藏
  const handleFavorite = useCallback(async (id: number) => {
    try {
      await databaseApi.post(`/search/pantry/food-materials/${id}`);
      logger.info('已添加到收藏:', id);
    } catch (err) {
      logger.error('添加收藏失败:', err);
    }
  }, []);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className={className}>
      {/* 搜索栏 */}
      <Card className="mb-4">
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
              onClick={handleSearch}
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
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">搜索中...</span>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="mb-3 text-xs text-muted-foreground">
            找到 {total} 条结果，耗时 {searchTime.toFixed(1)}ms
          </div>
          {results.map((result) => (
            <MaterialCard
              key={result.id}
              result={result}
              onFavorite={handleFavorite}
              isFavorite={false}
            />
          ))}
          {total > 20 && (
            <Pagination
              page={currentPage}
              pageSize={20}
              total={total}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
              className="mt-4"
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
    </div>
  );
};

export default FoodMaterialSearchPanel;
