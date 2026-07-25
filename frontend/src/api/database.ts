/**
 * 数据库检索 API
 * Phase 2 增强: 知识图谱、数据同步、药食同源
 * Phase 4 增强: 添加模拟数据 fallback，支持后端服务不可用时使用
 */
import api from './client'
import type { TCMHerb, SymMapHerb, BioactivePeptide, KnowledgeNode, PaginatedResponse } from '@/types'
import { logger } from '@/utils/safeLogger';


/**
 * 创建带 fallback 的 API 调用函数
 * 仅在后端服务完全不可用时（网络错误/5xx）才使用模拟数据
 * 认证错误(401/403)和其他业务错误会直接抛出
 */
const withFallback = async <T>(
  apiCall: () => Promise<T>,
  _fallback: () => Promise<T>,
  apiName: string,
): Promise<T> => {
  try {
    const result = await apiCall()
    logger.info(`✅ [Database API] ${apiName} 成功获取真实数据`)
    return result
  } catch (error: any) {
    const status = error.response?.status
    logger.error(`❌ [Database API] ${apiName} 请求失败 (HTTP ${status}):`, error.message)
    throw error
  }
}

export const databaseApi = {
  /** TCMSP 中药材检索 */
  searchHerbs: (params: {
    keyword?: string
    category?: string
    food_homology_only?: boolean
    page?: number
    page_size?: number
  }) =>
    withFallback(
      () => api.get<PaginatedResponse<TCMHerb>>('/databases/herbs', { params }).then((r) => r.data),
      'searchHerbs',
    ),

  /** 中药材详情 */
  getHerb: (id: number) =>
    withFallback(
      () => api.get<TCMHerb>(`/databases/herbs/${id}`).then((r) => r.data),
      'getHerb',
    ),

  /** 药材分类列表 */
  getCategories: () =>
    withFallback(
      () => api.get<{ categories: { category: string; count: number }[] }>('/databases/herbs/categories').then((r) => r.data),
      'getCategories',
    ),

  /** 药食同源药材列表 */
  getFoodHomologyHerbs: (params: { keyword?: string; page?: number; page_size?: number }) =>
    withFallback(
      () => api.get<PaginatedResponse<TCMHerb>>('/databases/herbs/food-homology', { params }).then((r) => r.data),
      'getFoodHomologyHerbs',
    ),

  /** 药食同源查询 */
  checkFoodHomology: (herbName: string) =>
    withFallback(
      () => api.get('/databases/herbs/food-homology/check', { params: { herb_name: herbName } }).then((r) => r.data),
      'checkFoodHomology',
    ),

  /** SymMap 中药材检索 */
  searchSymmapHerbs: (params: {
    keyword?: string
    page?: number
    page_size?: number
  }) =>
    withFallback(
      () => api.get<PaginatedResponse<SymMapHerb>>('/databases/herbs/symmap', { params }).then((r) => r.data),
      'searchSymmapHerbs',
    ),

  /** DFBP 活性肽检索 */
  searchPeptides: (params: {
    keyword?: string
    activity_type?: string
    page?: number
    page_size?: number
  }) =>
    withFallback(
      () => api.get<PaginatedResponse<BioactivePeptide>>('/databases/peptides', { params }).then((r) => r.data),
      'searchPeptides',
    ),

  /** 活性肽详情 */
  getPeptide: (id: number) =>
    withFallback(
      () => api.get<BioactivePeptide>(`/databases/peptides/${id}`).then((r) => r.data),
      'getPeptide',
    ),

  /** 活性肽类型列表 */
  getActivityTypes: () =>
    withFallback(
      () => api.get<{ activity_types: { type_en: string; type_cn: string; count: number }[] }>('/databases/peptides/activity-types').then((r) => r.data),
      'getActivityTypes',
    ),

  /** 知识图谱搜索 */
  searchKnowledge: (params: { keyword: string; node_type?: string; limit?: number }) =>
    withFallback(
      () => api.get<{ items: KnowledgeNode[]; total: number }>('/databases/knowledge-graph/search', { params }).then((r) => r.data),
      'searchKnowledge',
    ),

  /** 节点关系网络 */
  getNodeRelations: (params: { node_label: string; depth?: number }) =>
    withFallback(
      () => api.get<{ center_node: string; nodes: any[]; edges: any[]; stats: { nodes: number; edges: number; type_breakdown?: Record<string, number> }; mode?: string }>('/databases/knowledge-graph/relations', { params }).then((r) => r.data),
      () => Promise.resolve({ center_node: params.node_label, nodes: [], edges: [], stats: { nodes: 0, edges: 0 } }),
      'getNodeRelations',
    ),

  /** 全量知识图谱 */
  getFullGraph: (depth = 1) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/relations', { params: { node_label: '__full__', depth } }).then((r) => r.data),
      () => Promise.resolve({ center_node: '', nodes: [], edges: [], stats: { nodes: 0, edges: 0 } }),
      'getFullGraph',
    ),

  /** 药材-化合物-靶点路径 */
  getHerbCompoundTargets: (herbName: string) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/herb-path', { params: { herb_name: herbName } }).then((r) => r.data),
      () => Promise.resolve({ herb: herbName, compounds: [], targets: [], pathways: [] }),
      'getHerbCompoundTargets',
    ),

  /** 药材配伍网络 */
  getHerbInteractions: (herbs: string[]) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/interactions', { params: { herbs: herbs.join(',') } }).then((r) => r.data),
      () => Promise.resolve({ herbs, interactions: [], stats: { total_pairs: 0, synergistic: 0, antagonistic: 0 } }),
      'getHerbInteractions',
    ),

  /** 知识图谱统计 */
  getGraphStats: () =>
    withFallback(
      () => api.get('/databases/knowledge-graph/stats').then((r) => r.data),
      () => Promise.resolve({ total_nodes: 0, total_edges: 0, node_types: {} }),
      'getGraphStats',
    ),

  /** 路径发现（两节点间最短路径） */
  findPath: (source: string, target: string, maxDepth?: number) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/path', { params: { source, target, max_depth: maxDepth ?? 5 } }).then((r) => r.data),
      () => Promise.resolve({ path: [], distance: -1 }),
      'findPath',
    ),

  /** 子图提取 */
  findSubgraph: (center: string, radius?: number) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/subgraph', { params: { center, radius: radius ?? 2 } }).then((r) => r.data),
      () => Promise.resolve({ center, nodes: [], edges: [], radius: radius ?? 2 }),
      'findSubgraph',
    ),

  // ═══════════════════════════════════════════
  // v9.0: 知识图谱高级分析 API
  // ═══════════════════════════════════════════

  /** 图谱构建 — 从TCMSP数据重建知识图谱 */
  buildKnowledgeGraph: (rebuild = false) =>
    api.post<{ status: string; nodes_created: number; edges_created: number; nodes_updated: number; duration_ms: number }>('/databases/knowledge-graph/build', { rebuild }).then((r) => r.data),

  /** 中心性分析 — PageRank / Betweenness / Closeness */
  getCentrality: (mode: 'pageRank' | 'betweenness' | 'closeness' = 'pageRank', limit = 20) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/analytics/centrality', { params: { mode, limit } }).then((r) => r.data),
      () => Promise.resolve({ mode, results: [], total_nodes: 0 }),
      'getCentrality',
    ),

  /** Louvain社区检测 */
  getCommunities: () =>
    withFallback(
      () => api.get('/databases/knowledge-graph/analytics/communities').then((r) => r.data),
      () => Promise.resolve({ communities: [], community_count: 0, modularity: 0 }),
      'getCommunities',
    ),

  /** K-Core分解 */
  getKCore: (k = 2) =>
    withFallback(
      () => api.get('/databases/knowledge-graph/analytics/kcore', { params: { k } }).then((r) => r.data),
      () => Promise.resolve({ k, core_nodes: [], coreness_distribution: {} }),
      'getKCore',
    ),

  /** 相似药材推荐 */
  recommendHerbs: (herbName: string, topN = 10) =>
    withFallback(
      () => api.get(`/databases/knowledge-graph/recommend/herb/${encodeURIComponent(herbName)}`, { params: { top_n: topN } }).then((r) => r.data),
      () => Promise.resolve({ source: herbName, recommendations: [] }),
      'recommendHerbs',
    ),

  /** 通用相似节点推荐 */
  recommendSimilar: (nodeType: string, nodeLabel: string, topN = 10) =>
    withFallback(
      () => api.get(`/databases/knowledge-graph/recommend/similar/${nodeType}/${encodeURIComponent(nodeLabel)}`, { params: { top_n: topN } }).then((r) => r.data),
      () => Promise.resolve({ source: { type: nodeType, label: nodeLabel }, recommendations: [] }),
      'recommendSimilar',
    ),

  /** 关键桥梁节点识别 */
  getBridges: () =>
    withFallback(
      () => api.get('/databases/knowledge-graph/bridges').then((r) => r.data),
      () => Promise.resolve({ bridges: [] }),
      'getBridges',
    ),

  /** 跨数据源统一搜索 */
  unifiedSearch: (params: { keyword: string; sources?: string; limit?: number }) =>
    withFallback(
      () => api.get('/databases/unified-search', { params }).then((r) => r.data),
      'unifiedSearch',
    ),

  /** 同步 TCMSP 药材 */
  syncHerbs: () =>
    withFallback(
      () => api.post<{ status: string; inserted: number; updated: number; total_kb: number }>('/databases/sync/herbs').then((r) => r.data),
      () => Promise.resolve({ status: 'success', inserted: 0, updated: 0, total_kb: 0 }),
      'syncHerbs',
    ),

  /** 同步 DFBP 肽 */
  syncPeptides: () =>
    withFallback(
      () => api.post<{ status: string; inserted: number; updated: number; total_kb: number }>('/databases/sync/peptides').then((r) => r.data),
      () => Promise.resolve({ status: 'success', inserted: 0, updated: 0, total_kb: 0 }),
      'syncPeptides',
    ),

  /** 同步状态统计 */
  getSyncStats: () =>
    withFallback(
      () => api.get('/databases/sync/stats').then((r) => r.data),
      'getSyncStats',
    ),

  /** 数据快照 */
  listSnapshots: () =>
    withFallback(
      () => api.get<{ snapshots: { snapshot_id: string; source_db: string; total_records: number; is_active: boolean; created_at: string; metadata?: any }[] }>('/databases/snapshots').then((r) => r.data),
      () => Promise.resolve({ snapshots: [] }),
      'listSnapshots',
    ),

  // ═══════════════════════════════════════════
  // Phase 4 实时数据仪表盘
  // ═══════════════════════════════════════════

  /** 实时仪表盘概览 */
  getDashboardOverview: () =>
    withFallback(
      () => api.get('/databases/dashboard/overview').then((r) => r.data as DashboardOverview),
      'getDashboardOverview',
    ),

  /** 数据趋势分析 */
  getDashboardTrends: () =>
    withFallback(
      () => api.get('/databases/dashboard/trends').then((r) => r.data as DashboardTrends),
      'getDashboardTrends',
    ),

  /** 搜索自动补全建议 */
  getSearchSuggestions: (keyword: string, limit?: number) =>
    withFallback(
      () => api.get('/databases/suggestions', { params: { keyword, limit } }).then((r) => r.data),
      'getSearchSuggestions',
    ),

  /** 交叉检索（药材→活性肽关联） */
  crossSearch: (herbName: string) =>
    withFallback(
      () => api.get('/databases/cross-search', { params: { herb_name: herbName } }).then((r) => r.data as CrossSearchResult),
      'crossSearch',
    ),

  /** 数据质量报告 */
  getDataQuality: () =>
    withFallback(
      () => api.get('/databases/data-quality').then((r) => r.data as DataQualityReport),
      'getDataQuality',
    ),

  /** 药食同源原料热度排行 */
  getFoodHomologyRanking: () =>
    withFallback(
      () => api.get<FoodHomologyRankingResponse>('/databases/ranking/food-homology').then((r) => r.data),
      () => Promise.resolve({ items: [], total: 0, generated_at: new Date().toISOString() }),
      'getFoodHomologyRanking',
    ),

  /** 高活性肽活性排行 */
  getActivePeptideRanking: () =>
    withFallback(
      () => api.get<ActivePeptideRankingResponse>('/databases/ranking/active-peptides').then((r) => r.data),
      () => Promise.resolve({ items: [], total: 0, generated_at: new Date().toISOString() }),
      'getActivePeptideRanking',
    ),

  /** 通用 GET 请求（用于未预定义的路由） */
  get: (url: string, config?: Record<string, unknown>) =>
    api.get(url, config).then((r) => r.data),

  /** 通用 POST 请求（用于未预定义的路由） */
  post: (url: string, data?: unknown, config?: Record<string, unknown>) =>
    api.post(url, data, config).then((r) => r.data),

  // ═══════════════════════════════════════════
  // 收藏架 (Pantry) — Phase 2 增强
  // ═══════════════════════════════════════════

  /** 获取用户收藏列表 */
  getPantry: (item_type?: string) =>
    api.get<{ items: any[]; total: number }>(`/databases/pantry`, { params: { item_type } }).then((r) => r.data),

  /** 添加食品原料到收藏 */
  addToPantryFoodMaterial: (material_id: number) =>
    api.post(`/databases/pantry/food-materials/${material_id}`).then((r) => r.data),

  /** 从收藏中移除食品原料 */
  removeFromPantryFoodMaterial: (material_id: number) =>
    api.delete(`/databases/pantry/food-materials/${material_id}`).then((r) => r.data),

  /** 添加零售产品到收藏 */
  addToPantryRetailProduct: (product_id: number) =>
    api.post(`/databases/pantry/retail-products/${product_id}`).then((r) => r.data),

  /** 从收藏中移除零售产品 */
  removeFromPantryRetailProduct: (product_id: number) =>
    api.delete(`/databases/pantry/retail-products/${product_id}`).then((r) => r.data),

  /** 添加中药材到收藏 */
  addToPantryHerb: (herb_id: string) =>
    api.post(`/databases/pantry/herbs/${herb_id}`).then((r) => r.data),

  /** 从收藏中移除中药材 */
  removeFromPantryHerb: (herb_id: string) =>
    api.delete(`/databases/pantry/herbs/${herb_id}`).then((r) => r.data),

  /** 添加活性肽到收藏 */
  addToPantryPeptide: (peptide_id: number) =>
    api.post(`/databases/pantry/peptides/${peptide_id}`).then((r) => r.data),

  /** 从收藏中移除活性肽 */
  removeFromPantryPeptide: (peptide_id: number) =>
    api.delete(`/databases/pantry/peptides/${peptide_id}`).then((r) => r.data),
}

// ═══════════════════════════════════════════
// Phase 4 新增类型定义
// ═══════════════════════════════════════════

export interface DashboardOverview {
  timestamp: string
  summary: {
    total_herbs: number
    total_peptides: number
    food_homology_count: number
    total_graph_nodes: number
    high_quality_herbs: number
    high_activity_peptides: number
    category_count: number
    activity_type_count: number
  }
  ob_distribution: Record<string, number>
  dl_distribution: Record<string, number>
  seq_length_distribution: Record<string, number>
  categories: { category: string; count: number }[]
  activity_types: { type: string; count: number }[]
  enzymes: { enzyme: string; count: number }[]
  source_organisms: { organism: string; count: number }[]
  top_herbs_by_ob: { name_cn: string; ob_percent: number; dl_value: number; compound_count: number; category: string; is_food_homology: boolean }[]
  top_active_peptides: { sequence: string; activity_value: string | number; activity_unit: string; source_protein: string; molecular_weight: number; hydrolysis_enzyme: string }[]
  graph_stats: Record<string, any>
}

export interface DashboardTrends {
  ob_dl_scatter: { x: number; y: number; name: string; category: string; is_food_homology: boolean }[]
  compound_target_correlation: { x: number; y: number; name: string }[]
  mw_activity_scatter: { x: number; y: number; seq_len: number; source: string }[]
  category_effect_heatmap: { category: string; effect: string; value: number }[]
  analysis_notes: Record<string, string>
}

export interface CrossSearchResult {
  herb: { name_cn: string; name_latin: string; effects: string; category: string; ob_percent: number; compound_count: number }
  compounds: any[]
  related_peptides: (any & { relevance_score: number })[]
  match_summary: { total_compounds: number; matched_peptides: number; high_relevance_peptides: number }
}

export interface DataQualityReport {
  generated_at: string
  herb_data: { total_records: number; quality_score: number; grade: string; field_completeness: Record<string, any>; health_indicators: Record<string, any> }
  peptide_data: { total_records: number; quality_score: number; grade: string; field_completeness: Record<string, any>; health_indicators: Record<string, any> }
  overall_score: number
  recommendations: string[]
}

// 热门排行 - 药食同源原料
export interface FoodHomologyRankItem {
  rank: number
  name_cn: string
  name_latin: string
  ob_percent: number
  dl_value: number
  compound_count: number
  target_count: number
  category: string
  effects: string
  is_food_homology: boolean
  heat_score: number
}

export interface FoodHomologyRankingResponse {
  items: FoodHomologyRankItem[]
  total: number
  generated_at: string
}

// 热门排行 - 高活性肽
export interface ActivePeptideRankItem {
  rank: number
  sequence: string
  activity_value: number | string
  activity_unit: string
  source_protein: string
  molecular_weight: number
  hydrolysis_enzyme: string
  activity_type: string
  seq_length: number
  activity_score: number
}

export interface ActivePeptideRankingResponse {
  items: ActivePeptideRankItem[]
  total: number
  generated_at: string
}
