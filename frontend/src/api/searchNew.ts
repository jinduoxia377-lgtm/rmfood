/**
 * 食品原料和零售产品搜索 API 客户端
 *
 * 用于 Potion AI VFT x RMFOOD 深度融合方案。
 */
import { databaseApi } from './database';
import api from './client';


import { logger } from '@/utils/safeLogger';

/**
 * databaseApi 的 get/post 已在 database.ts 内通过 `.then((r) => r.data)` 解包 axios 响应体。
 * 本文件部分历史函数仍按 axios 风格读取 `response.data`，导致返回值变成 undefined。
 * 此辅助函数做兼容归一：
 * - 若返回值是 axios 风格 `{ data: ... }`（测试 mock 或未来 databaseApi 变更），解包 data；
 * - 若返回值本身就是业务响应体，原样返回。
 */
function unwrapResponse<T>(response: unknown): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    'data' in response &&
    (response as { data?: unknown }).data !== undefined &&
    (response as { data?: unknown }).data !== null
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

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

/** 食品原料详情 — 安全信息子对象（字段可 optional，后端 to_dict() 口径） */
export interface FoodMaterialSafety {
  safe_dose_min?: number;
  safe_dose_max?: number;
  /** 禁忌：后端可能返回 string[] 或长字符串，用 unknown + asArray 归一 */
  contraindications?: unknown;
  /** 相互作用：同上 */
  interactions?: unknown;
}

/** 食品原料详情 — 法规信息子对象 */
export interface FoodMaterialRegulatory {
  status?: string;
  approved_regions?: unknown;
  max_daily_intake?: string;
}

/**
 * 食品原料详情（FoodMaterial.to_dict()）
 * 数组字段后端存在 string[] / string / 缺失 等多种形态，统一用 unknown + asArray 归一渲染。
 */
export interface FoodMaterialDetail {
  id?: number;
  name_cn?: string;
  name_latin?: string;
  name_en?: string;
  aliases?: unknown;
  category?: string;
  sub_category?: string;
  food_homology?: boolean;
  toxicity_class?: string;
  active_ingredients?: unknown;
  effects?: unknown;
  indications?: unknown;
  ob_percent?: number;
  dl_value?: number;
  bioavailability_score?: number;
  safety?: FoodMaterialSafety;
  regulatory?: FoodMaterialRegulatory;
  description?: string;
  image_url?: string | null;
  source_db?: string;
  data_quality?: number;
  review_status?: string;
  /** 后端合规判定辅助字段：数据是否足以支撑合规结论 */
  data_sufficient?: boolean;
}

/** 批量配方合规检查 — 单条结果（violations/warnings/info 共用结构） */
export interface ComplianceViolation {
  code?: string;
  message?: string;
  severity?: string;
}

/** 批量配方合规检查响应 */
export interface FormulaComplianceResult {
  violations?: ComplianceViolation[];
  warnings?: ComplianceViolation[];
  info?: ComplianceViolation[];
  [key: string]: unknown;
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
  /** 数据来源标识：internet_realtime / internet_cache / local_reference（后端 task-21） */
  data_origin?: string;
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

/** 收藏（Pantry）中的零售产品条目（后端返回的最小字段集合） */
export interface PantryRetailProduct {
  id: number;
  product_name?: string;
  brand?: string;
  [key: string]: unknown;
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
 * POST /databases/food-materials
 */
export async function searchFoodMaterials(
  request: FoodMaterialSearchRequest,
): Promise<FoodMaterialSearchResponse> {
  const response = await databaseApi.post('/databases/food-materials', request);
  return unwrapResponse<FoodMaterialSearchResponse>(response);
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
  // SSE 使用 fetch + ReadableStream 实现（原生 fetch 不走 axios baseURL，需带 /api/v1 全路径）
  const controller = new AbortController();

  fetch('/api/v1/databases/food-materials/stream', {
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
        logger.error('[FoodMaterialStream] SSE 错误:', err);
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
  const response = await databaseApi.get('/databases/food-materials', { params });
  return unwrapResponse<unknown[]>(response);
}

/**
 * 获取单个食品原料详情
 * GET /databases/food-materials/:id
 */
export async function getFoodMaterial(id: number): Promise<FoodMaterialDetail> {
  const response = await databaseApi.get(`/databases/food-materials/${id}`);
  return unwrapResponse<FoodMaterialDetail>(response);
}

// ── 零售产品搜索 ──

/**
 * 零售产品混合搜索
 * POST /databases/retail-products
 * 注意：后端混合搜索端点在 /databases/retail-products（food_materials.py 注册），
 * 无 /search 中间段。原路径 /databases/search/retail-products 不存在会 404。
 */
export async function searchRetailProducts(
  request: RetailProductSearchRequest,
): Promise<RetailProductSearchResponse> {
  const response = await databaseApi.post('/databases/retail-products', request);
  return unwrapResponse<RetailProductSearchResponse>(response);
}

/**
 * 零售产品流式搜索 (SSE)
 * POST /api/v1/databases/retail-products/stream
 * 注意：原生 fetch 不走 axios baseURL，须手补 /api/v1 全路径；且后端为
 * /databases/retail-products/stream，无 /search 中间段。
 */
export function searchRetailProductsStream(
  request: RetailProductSearchRequest,
  onEvent: (event: string, data: unknown) => void,
  onComplete?: () => void,
): AbortController {
  const controller = new AbortController();

  fetch('/api/v1/databases/retail-products/stream', {
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
        logger.error('[RetailProductStream] SSE 错误:', err);
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
  const response = await databaseApi.post('/databases/search/suggest', {
    query,
    limit,
    search_types: searchTypes,
  });
  return unwrapResponse<{ suggestions: SearchSuggestion[] }>(response);
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
  /** 数据来源过滤：all / internet / local（默认 all） */
  origin?: 'all' | 'internet' | 'local';
  brand?: string;          // Phase 4: 品牌筛选（单品牌）
  brands?: string[];       // Phase 5: 多品牌筛选
  formulation_type?: string;  // Phase 4: 剂型筛选
  min_price?: number;       // Phase 4: 最低价格
  max_price?: number;       // Phase 4: 最高价格
  nova_group?: number;      // Phase 5: NOVA分组过滤 1-4
  min_completeness?: number; // Phase 5: 最低数据完整度 0-1
  sort_by?: string;         // Phase 5: 排序（relevance|name|date|quality|nova）
}

export interface OFFSearchResponse {
  items: OFFRawProduct[];
  total: number;
  page: number;
  page_size: number;
  data_source: string;
  error?: string;
  /** 后端回退路径附加字段：OFF 实时查询失败时的错误描述 */
  off_error?: string;
  /** OFF 实时命中的原始总数（截断前） */
  off_total?: number;
  /** 本地数据库命中数 */
  db_total?: number;
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
  /** 数据来源：manual / openfoodfacts */
  source?: string;
  /** 数据来源标识：internet_realtime / internet_cache / local_reference */
  data_origin?: string;
}

export async function searchOpenFoodFacts(
  request: OFFSearchRequest,
): Promise<OFFSearchResponse> {
  // OFF 实时搜索可能跨公网访问 OpenFoodFacts，默认 30s 超时不够，这里单独放宽到 60s。
  const response = await databaseApi.post('/databases/openfoodfacts/search', request, { timeout: 60000 });
  const body = unwrapResponse<OFFSearchResponse | null>(response);
  // 客户端响应拦截器对 ERR_ABORTED / canceled 返回 { data: null, status: 0 }，
  // databaseApi.post 解包后为 null；这里统一转成可读的网络错误，避免上层误报“搜索请求失败”。
  if (
    !body ||
    (typeof body === 'object' && 'status' in body && (body as { status?: number }).status === 0)
  ) {
    throw new Error('网络请求失败（超时/连接中断），请重试');
  }
  return body;
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
  return unwrapResponse<RetailProductSearchResult | null>(response);
}

/**
 * OFF 按 ID 查询产品
 * GET /databases/openfoodfacts/product/:id
 */
export async function getOpenFoodFactById(
  productId: number,
): Promise<RetailProductSearchResult | null> {
  const response = await databaseApi.get(`/databases/openfoodfacts/product/${productId}`);
  return unwrapResponse<RetailProductSearchResult | null>(response);
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
  return unwrapResponse<OFFCategoryResponse>(response);
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
  const body = unwrapResponse<{ categories?: OFFCategoryInfo[] } | OFFCategoryInfo[]>(response);
  return Array.isArray(body) ? body : (body?.categories ?? []);
}

/**
 * OFF 同步状态
 * GET /databases/openfoodfacts/sync-status
 */
export async function getOpenFoodFactsSyncStats(): Promise<Record<string, unknown>> {
  const response = await databaseApi.get('/databases/openfoodfacts/sync-status');
  return unwrapResponse<Record<string, unknown>>(response);
}

/**
 * OFF 导入报告
 * GET /databases/openfoodfacts/report
 */
export async function getOpenFoodFactsReport(): Promise<Record<string, unknown>> {
  const response = await databaseApi.get('/databases/openfoodfacts/report');
  return unwrapResponse<Record<string, unknown>>(response);
}

// ── 收藏/书架 (Pantry) API ────────────────────────────────

/**
 * 添加零售产品到收藏（用户书架）
 * POST /databases/pantry/retail-products/{product_id}
 */
export async function addToPantryRetailProduct(product_id: number): Promise<Record<string, unknown>> {
  return databaseApi.post(`/databases/pantry/retail-products/${product_id}`).then((r) => unwrapResponse<Record<string, unknown>>(r));
}

/**
 * 从收藏中移除零售产品
 * DELETE /databases/pantry/retail-products/{product_id}
 */
export async function removeFromPantryRetailProduct(product_id: number): Promise<Record<string, unknown>> {
  return api
    .delete<Record<string, unknown>>(`/databases/pantry/retail-products/${product_id}`)
    .then((r) => r.data);
}

/**
 * 获取用户的收藏零售产品列表
 * GET /databases/pantry?item_type=retail_product
 */
export async function getPantryRetailProducts(): Promise<PantryRetailProduct[]> {
  const response = await databaseApi.get('/databases/pantry', { params: { item_type: 'retail_product' } });
  const body = unwrapResponse<{ items?: PantryRetailProduct[] }>(response);
  return body?.items ?? [];
}

// ── 名称标准化 ──

/**
 * 名称标准化 (别名归一)
 * POST /databases/normalize
 */
export async function normalizeName(
  name: string,
  searchType: string = 'food_material',
): Promise<NormalizeResult> {
  const response = await databaseApi.post('/databases/normalize', {
    name,
    search_type: searchType,
  });
  return unwrapResponse<NormalizeResult>(response);
}

// ── 合规检查 ──

/**
 * 检查单个食品原料合规性
 * GET /databases/compliance/check?material_id=:id
 */
export async function checkMaterialCompliance(materialId: number): Promise<unknown> {
  const response = await databaseApi.get('/databases/compliance/check', {
    params: { material_id: materialId },
  });
  return unwrapResponse<unknown>(response);
}

/**
 * 检查配方合规性
 * POST /databases/compliance/formula  (body 为裸 List[int]，非 {material_ids})
 */
export async function checkFormulaCompliance(
  materialIds: number[],
): Promise<FormulaComplianceResult> {
  const response = await databaseApi.post('/databases/compliance/formula', materialIds);
  return unwrapResponse<FormulaComplianceResult>(response);
}
