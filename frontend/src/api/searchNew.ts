/**
 * 食品原料和零售产品搜索 API 客户端
 *
 * 用于 Potion AI VFT x RMFOOD 深度融合方案。
 */
import { databaseApi } from './database';

// ── 类型定义 ──

export interface FoodMaterialFilter {
  category?: string;
  sub_category?: string;
  food_homology?: boolean;
  toxicity_class?: string;
  has_effects?: string[];
  regulatory_status?: string;
  min_ob?: number;
  min_dl?: number;
  min_data_quality?: number;
}

export interface FoodMaterialSearchRequest {
  query: string;
  filters?: FoodMaterialFilter;
  page?: number;
  per_page?: number;
  sort_by?: string;
  search_modes?: Record<string, number>;
}

export interface FoodMaterialSearchResult {
  id: number;
  item_type: string;
  name: string;
  category?: string;
  score: number;
  similarity?: number;
  extra: Record<string, unknown>;
}

export interface FoodMaterialSearchResponse {
  query: string;
  total: number;
  page: number;
  per_page: number;
  results: FoodMaterialSearchResult[];
  search_time_ms: number;
  search_modes_used: Record<string, number>;
}

export interface RetailProductFilter {
  category?: string;
  formulation_type?: string;
  brand?: string[];
  price_range?: { min?: number; max?: number };
  min_rating?: number;
  has_ingredient?: string[];
  effects?: string[];
}

export interface RetailProductSearchRequest {
  query: string;
  filters?: RetailProductFilter;
  page?: number;
  per_page?: number;
}

export interface RetailProductSearchResult extends RetailProductDetail {
  score?: number;
}

export interface RetailProductDetail {
  id: number;
  product_name: string;
  brand: string;
  category?: string;
  sub_category?: string;
  formulation_type?: string;
  price?: number | null;
  currency?: string;
  package_size?: string;
  volume_ml?: number | null;
  weight_g?: number | null;
  image_urls?: string[];
  full_ingredients?: string | null;
  key_ingredients?: Record<string, unknown>;
  effects?: string[];
  target_population?: string[];
  sales_channels?: string[];
  avg_rating?: number | null;
  review_count?: number | null;
  allergens_tags?: string[];
  additives_tags?: string[];
  ecoscore_grade?: string | null;
  traces_tags?: string[];
  contaminants?: string[];
  source?: string;
  data_quality?: number;
  [key: string]: unknown;
}

export interface RetailProductSearchResponse {
  query: string;
  total: number;
  page: number;
  per_page: number;
  results: RetailProductSearchResult[];
  search_time_ms: number;
}

export interface SearchSuggestion {
  text: string;
  type: string;
  score: number;
}

export interface NormalizeResult {
  original: string;
  canonical: string;
  aliases_found: string[];
  confidence: number;
}

// ── 食品原料搜索 ──

/**
 * 食品原料混合搜索 (BM25 + 向量 RRF 融合)
 * POST /databases/search/food-materials
 */
export async function searchFoodMaterials(
  request: FoodMaterialSearchRequest,
): Promise<FoodMaterialSearchResponse> {
  const response = await databaseApi.post('/search/food-materials', request);
  return response.data;
}

/**
 * 食品原料流式搜索 (SSE)
 * POST /databases/search/food-materials/stream
 */
export function searchFoodMaterialsStream(
  request: FoodMaterialSearchRequest,
  onEvent: (event: string, data: unknown) => void,
  onComplete?: () => void,
): EventSource | null {
  // SSE 使用 fetch + ReadableStream 实现
  const controller = new AbortController();

  fetch('/databases/search/food-materials/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            try {
              const data = JSON.parse(eventData);
              // 从 event 行获取事件类型
              onEvent('data', data);
            } catch {
              // 忽略非 JSON 行
            }
          }
        }
      }

      onComplete?.();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[FoodMaterialStream] SSE 错误:', err);
      }
    });

  return null; // 返回 controller 供取消使用
}

/**
 * 列出食品原料 (支持筛选和分页)
 * GET /databases/food-materials
 */
export async function listFoodMaterials(params?: {
  category?: string;
  food_homology?: boolean;
  name?: string;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  const response = await databaseApi.get('/food-materials', { params });
  return response.data;
}

/**
 * 获取单个食品原料详情
 * GET /databases/food-materials/:id
 */
export async function getFoodMaterial(id: number): Promise<unknown> {
  const response = await databaseApi.get(`/food-materials/${id}`);
  return response.data;
}

// ── 零售产品搜索 ──

/**
 * 零售产品混合搜索
 * POST /databases/search/retail-products
 */
export async function searchRetailProducts(
  request: RetailProductSearchRequest,
): Promise<RetailProductSearchResponse> {
  const response = await databaseApi.post('/search/retail-products', request);
  return response.data;
}

/**
 * 零售产品流式搜索 (SSE)
 * POST /databases/search/retail-products/stream
 */
export function searchRetailProductsStream(
  request: RetailProductSearchRequest,
  onEvent: (event: string, data: unknown) => void,
  onComplete?: () => void,
): AbortController {
  const controller = new AbortController();

  fetch('/databases/search/retail-products/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            try {
              const data = JSON.parse(eventData);
              onEvent('data', data);
            } catch {
              // ignore non-JSON
            }
          }
        }
      }

      onComplete?.();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('[RetailProductStream] SSE 错误:', err);
      }
    });

  return controller;
}

// ── 搜索建议 ──

/**
 * 搜索建议 (后端驱动)
 * POST /databases/search/suggest
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 10,
  searchTypes: string[] = ['herbs', 'peptides', 'food_materials', 'retail_products'],
): Promise<{ suggestions: SearchSuggestion[] }> {
  const response = await databaseApi.post('/search/suggest', {
    query,
    limit,
    search_types: searchTypes,
  });
  return response.data;
}

// ── OFF 实时数据查询 ──

/**
 * OFF 实时混合搜索 (DB 优先 + API 实时查询)
 * POST /databases/openfoodfacts/search
 */
export interface OFFSearchRequest {
  query: string;
  page?: number;
  page_size?: number;
  realtime?: boolean;
  brand?: string;          // Phase 4: 品牌筛选
  formulation_type?: string;  // Phase 4: 剂型筛选
  min_price?: number;       // Phase 4: 最低价格
  max_price?: number;       // Phase 4: 最高价格
}

export interface OFFSearchResponse {
  items: OFFRawProduct[];
  total: number;
  page: number;
  page_size: number;
  data_source: string;
  error?: string;
}

// OFF 原始数据接口（API 返回的原始格式）
export interface OFFRawProduct {
  id: number | string;
  product_name: string;
  brand: string;
  category: string;
  formulation_type: string | null;
  price: number | null;
  avg_rating: number | null;
  image_urls: string[];
  effects: string[];
  score: number;
  // ── 食品安全字段 (Phase 2) ──
  allergens_tags?: string[];
  additives_tags?: string[];
  ecoscore_grade?: string | null;
  traces_tags?: string[];
  contaminants?: string[];
}

export async function searchOpenFoodFacts(
  request: OFFSearchRequest,
): Promise<OFFSearchResponse> {
  const response = await databaseApi.post('/databases/openfoodfacts/search', request);
  return response.data;
}

/**
 * OFF 按条码查询产品
 * GET /databases/openfoodfacts/product/barcode/:barcode
 */
export async function getOpenFoodFactByBarcode(
  barcode: string,
  realtime: boolean = false,
): Promise<RetailProductSearchResult | null> {
  const response = await databaseApi.get(`/databases/openfoodfacts/product/barcode/${encodeURIComponent(barcode)}`, {
    params: { realtime },
  });
  return response.data;
}

/**
 * OFF 按 ID 查询产品
 * GET /databases/openfoodfacts/product/:id
 */
export async function getOpenFoodFactById(
  productId: number,
): Promise<RetailProductSearchResult | null> {
  const response = await databaseApi.get(`/databases/openfoodfacts/product/${productId}`);
  return response.data;
}

/**
 * OFF 按分类浏览
 * GET /databases/openfoodfacts/category/:category_tag
 */
export interface OFFCategoryResponse {
  items: RetailProductSearchResult[];
  total: number;
  page: number;
  page_size: number;
  category: string;
  category_tag: string;
  data_source: string;
}

export async function getProductsByCategory(
  categoryTag: string,
  params?: { page?: number; page_size?: number; realtime?: boolean },
): Promise<OFFCategoryResponse> {
  const response = await databaseApi.get(`/databases/openfoodfacts/category/${encodeURIComponent(categoryTag)}`, { params });
  return response.data;
}

/**
 * OFF 分类列表
 * GET /databases/openfoodfacts/categories
 */
export interface OFFCategoryInfo {
  category: string;
  category_tag?: string;
  count: number;
}

export async function getOpenFoodFactsCategories(): Promise<OFFCategoryInfo[]> {
  const response = await databaseApi.get('/databases/openfoodfacts/categories');
  return response.data;
}

/**
 * OFF 同步状态
 * GET /databases/openfoodfacts/sync-status
 */
export async function getOpenFoodFactsSyncStats(): Promise<Record<string, unknown>> {
  const response = await databaseApi.get('/databases/openfoodfacts/sync-status');
  return response.data;
}

/**
 * OFF 导入报告
 * GET /databases/openfoodfacts/report
 */
export async function getOpenFoodFactsReport(): Promise<Record<string, unknown>> {
  const response = await databaseApi.get('/databases/openfoodfacts/report');
  return response.data;
}

// ── 收藏/书架 (Pantry) API ────────────────────────────────

/**
 * 添加零售产品到收藏（用户书架）
 * POST /databases/pantry/retail-products/{product_id}
 */
export async function addToPantryRetailProduct(product_id: number): Promise<any> {
  return databaseApi.post(`/pantry/retail-products/${product_id}`).then((r) => r.data);
}

/**
 * 从收藏中移除零售产品
 * DELETE /databases/pantry/retail-products/{product_id}
 */
export async function removeFromPantryRetailProduct(product_id: number): Promise<any> {
  return databaseApi.delete(`/pantry/retail-products/${product_id}`).then((r) => r.data);
}

/**
 * 获取用户的收藏零售产品列表
 * GET /databases/pantry?item_type=retail_product
 */
export async function getPantryRetailProducts(): Promise<any[]> {
  const response = await databaseApi.get('/pantry', { params: { item_type: 'retail_product' } });
  return response.data.items || [];
}

// ── 名称标准化 ──

/**
 * 名称标准化 (别名归一)
 * POST /databases/search/normalize
 */
export async function normalizeName(
  name: string,
  searchType: string = 'food_material',
): Promise<NormalizeResult> {
  const response = await databaseApi.post('/search/normalize', {
    name,
    search_type: searchType,
  });
  return response.data;
}

// ── 合规检查 ──

/**
 * 检查单个食品原料合规性
 * GET /databases/search/compliance/check?material_id=:id
 */
export async function checkMaterialCompliance(materialId: number): Promise<unknown> {
  const response = await databaseApi.get('/search/compliance/check', {
    params: { material_id: materialId },
  });
  return response.data;
}

/**
 * 检查配方合规性
 * POST /databases/search/compliance/formula
 */
export async function checkFormulaCompliance(
  materialIds: number[],
): Promise<unknown> {
  const response = await databaseApi.post('/search/compliance/formula', {
    material_ids: materialIds,
  });
  return response.data;
}
