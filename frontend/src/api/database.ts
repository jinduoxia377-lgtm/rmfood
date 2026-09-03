/**
 * 数据库检索 API
 * 直接调用后端真实数据，错误时抛出而非返回 mock 数据
 */
import api from './client'
import type { TCMHerb, SymMapHerb, BioactivePeptide, KnowledgeNode, PaginatedResponse } from '@/types'
import { logger } from '@/utils/safeLogger'

export const databaseApi = {
  /** TCMSP 中药材检索 */
  searchHerbs: (params: {
    keyword?: string
    category?: string
    food_homology_only?: boolean
    page?: number
    page_size?: number
  }) => api.get<PaginatedResponse<TCMHerb>>('/databases/herbs', { params }).then((r) => r.data),

  /** 中药材详情 */
  getHerb: (id: number) => api.get<TCMHerb>(`/databases/herbs/${id}`).then((r) => r.data),

  /** 药材分类列表 */
  getCategories: () =>
    api.get<{ categories: { category: string; count: number }[] }>('/databases/herbs/categories').then((r) => r.data),

  /** 药食同源药材列表 */
  getFoodHomologyHerbs: (params: { keyword?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<TCMHerb>>('/databases/herbs/food-homology', { params }).then((r) => r.data),

  /** 药食同源查询 */
  checkFoodHomology: (herbName: string) =>
    api.get('/databases/herbs/food-homology/check', { params: { herb_name: herbName } }).then((r) => r.data),

  /** ════════════════════════════════════════════
   * TCMSP 化合物 / 靶点 / 疾病 检索
   * ════════════════════════════════════════════ */

  /** 化合物检索 */
  searchCompounds: (params: {
    keyword?: string; min_ob?: number; max_ob?: number; min_dl?: number;
    page?: number; page_size?: number;
  }) => api.get<any>('/databases/compounds', { params }).then((r) => r.data),

  /** 化合物统计 */
  getCompoundStats: () => api.get<any>('/databases/compounds/stats').then((r) => r.data),

  /** 化合物详情 */
  getCompoundDetail: (id: number) => api.get<any>(`/databases/compounds/${id}`).then((r) => r.data),

  /** 靶点检索 */
  searchTargets: (params: { keyword?: string; page?: number; page_size?: number }) =>
    api.get<any>('/databases/targets', { params }).then((r) => r.data),

  /** 靶点统计 */
  getTargetStats: () => api.get<any>('/databases/targets/stats').then((r) => r.data),

  /** 疾病检索 */
  searchDiseases: (params: { keyword?: string; page?: number; page_size?: number }) =>
    api.get<any>('/databases/diseases', { params }).then((r) => r.data),

  /** 疾病统计 */
  getDiseaseStats: () => api.get<any>('/databases/diseases/stats').then((r) => r.data),

  /** SymMap 中药材检索 */
  searchSymmapHerbs: (params: {
    keyword?: string
    page?: number
    page_size?: number
  }) => api.get<PaginatedResponse<SymMapHerb>>('/databases/herbs/symmap', { params }).then((r) => r.data),

  /** DFBP 活性肽检索 */
  searchPeptides: (params: {
    keyword?: string
    activity_type?: string
    page?: number
    page_size?: number
  }) => api.get<PaginatedResponse<BioactivePeptide>>('/databases/peptides', { params }).then((r) => r.data),

  /** 活性肽详情 */
  getPeptide: (id: number) => api.get<BioactivePeptide>(`/databases/peptides/${id}`).then((r) => r.data),

  /** 活性肽类型列表 */
  getActivityTypes: () =>
    api.get<{ activity_types: { type_en: string; type_cn: string; count: number }[] }>('/databases/peptides/activity-types').then((r) => r.data),

  /** 知识图谱搜索 */
  searchKnowledge: (params: { keyword: string; node_type?: string; limit?: number }) =>
    api.get<{ items: KnowledgeNode[]; total: number }>('/databases/knowledge-graph/search', { params }).then((r) => r.data),

  /** 节点关系网络 */
  getNodeRelations: (params: { node_label: string; depth?: number }) =>
    api.get<{ center_node: string; nodes: any[]; edges: any[]; stats: { nodes: number; edges: number; type_breakdown?: Record<string, number> }; mode?: string }>('/databases/knowledge-graph/relations', { params }).then((r) => r.data),

  /** 全量知识图谱 */
  getFullGraph: (depth = 1) =>
    api.get('/databases/knowledge-graph/relations', { params: { node_label: '__full__', depth } }).then((r) => r.data),

  /** 药材-化合物-靶点路径 */
  getHerbCompoundTargets: (herbName: string) =>
    api.get('/databases/knowledge-graph/herb-path', { params: { herb_name: herbName } }).then((r) => r.data),

  /** 药材配伍网络 */
  getHerbInteractions: (herbs: string[]) =>
    api.get('/databases/knowledge-graph/interactions', { params: { herbs: herbs.join(',') } }).then((r) => r.data),

  /** 知识图谱统计 */
  getGraphStats: () =>
    api.get('/databases/knowledge-graph/stats').then((r) => r.data),

  /** 路径发现（两节点间最短路径） */
  findPath: (source: string, target: string, maxDepth?: number) =>
    api.get('/databases/knowledge-graph/path', { params: { source, target, max_depth: maxDepth ?? 5 } }).then((r) => r.data),

  /** 子图提取 */
  findSubgraph: (center: string, radius?: number) =>
    api.get('/databases/knowledge-graph/subgraph', { params: { center, radius: radius ?? 2 } }).then((r) => r.data),

  // ═══════════════════════════════════════════
  // v9.0: 知识图谱高级分析 API
  // ═══════════════════════════════════════════

  /** 图谱构建 — 从TCMSP数据重建知识图谱 */
  buildKnowledgeGraph: (rebuild = false) =>
    api.post<{ status: string; nodes_created: number; edges_created: number; nodes_updated: number; duration_ms: number }>('/databases/knowledge-graph/build', { rebuild }).then((r) => r.data),

  /** 中心性分析 — PageRank / Betweenness / Closeness */
  getCentrality: (mode: 'pageRank' | 'betweenness' | 'closeness' = 'pageRank', limit = 20) =>
    api.get('/databases/knowledge-graph/analytics/centrality', { params: { mode, limit } }).then((r) => r.data),

  /** Louvain社区检测 */
  getCommunities: () =>
    api.get('/databases/knowledge-graph/analytics/communities').then((r) => r.data),

  /** K-Core分解 */
  getKCore: (k = 2) =>
    api.get('/databases/knowledge-graph/analytics/kcore', { params: { k } }).then((r) => r.data),

  /** 相似药材推荐 */
  recommendHerbs: (herbName: string, topN = 10) =>
    api.get(`/databases/knowledge-graph/recommend/herb/${encodeURIComponent(herbName)}`, { params: { top_n: topN } }).then((r) => r.data),

  /** 通用相似节点推荐 */
  recommendSimilar: (nodeType: string, nodeLabel: string, topN = 10) =>
    api.get(`/databases/knowledge-graph/recommend/similar/${nodeType}/${encodeURIComponent(nodeLabel)}`, { params: { top_n: topN } }).then((r) => r.data),

  /** 关键桥梁节点识别 */
  getBridges: () =>
    api.get('/databases/knowledge-graph/bridges').then((r) => r.data),

  /** 跨数据源统一搜索 */
  unifiedSearch: (params: { keyword: string; sources?: string; limit?: number }) =>
    api.get('/databases/unified-search', { params }).then((r) => r.data),

  /** 同步 TCMSP 药材 */
  syncHerbs: () =>
    api.post<{ status: string; inserted: number; updated: number; total_kb: number }>('/databases/sync/herbs').then((r) => r.data),

  /** 同步 DFBP 肽 */
  syncPeptides: () =>
    api.post<{ status: string; inserted: number; updated: number; total_kb: number }>('/databases/sync/peptides').then((r) => r.data),

  /** 同步状态统计 */
  getSyncStats: () =>
    api.get('/databases/sync/stats').then((r) => r.data),

  /** 数据快照 */
  listSnapshots: () =>
    api.get<{ snapshots: { snapshot_id: string; source_db: string; total_records: number; is_active: boolean; created_at: string; metadata?: any }[] }>('/databases/snapshots').then((r) => r.data),

  // ═══════════════════════════════════════════
  // Phase 4 实时数据仪表盘
  // ═══════════════════════════════════════════

  /** 实时仪表盘概览 */
  getDashboardOverview: () =>
    api.get('/databases/dashboard/overview').then((r) => r.data as DashboardOverview),

  /** 数据趋势分析 */
  getDashboardTrends: () =>
    api.get('/databases/dashboard/trends').then((r) => r.data as DashboardTrends),

  /** 搜索自动补全建议 */
  getSearchSuggestions: (keyword: string, limit?: number) =>
    api.get('/databases/suggestions', { params: { keyword, limit } }).then((r) => r.data),

  /** 交叉检索（药材→活性肽关联） */
  crossSearch: (herbName: string) =>
    api.get('/databases/cross-search', { params: { herb_name: herbName } }).then((r) => r.data as CrossSearchResult),

  /** 数据质量报告 */
  getDataQuality: () =>
    api.get('/databases/data-quality').then((r) => r.data as DataQualityReport),

  /** 药食同源原料热度排行 */
  getFoodHomologyRanking: () =>
    api.get<FoodHomologyRankingResponse>('/databases/ranking/food-homology').then((r) => r.data),

  /** 高活性肽活性排行 */
  getActivePeptideRanking: () =>
    api.get<ActivePeptideRankingResponse>('/databases/ranking/active-peptides').then((r) => r.data),

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
