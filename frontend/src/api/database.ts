/**
 * 数据库检索 API
 * 直接调用后端真实数据，错误时抛出而非返回 mock 数据
 */
import api from './client'
import type { TCMHerb, SymMapHerb, BioactivePeptide, KnowledgeNode, PaginatedResponse } from '@/types'

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
    api.get<{ categories: { category: string; count: number; food_homology_count: number }[]; total_food_homology: number }>('/databases/herbs/categories').then((r) => r.data),

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

  /** DFBP 活性肽检索（支持 provenance 溯源过滤 / 按食品原料查肽） */
  searchPeptides: (params: {
    keyword?: string
    activity_type?: string
    page?: number
    page_size?: number
    /** 'literature_confirmed' 只返回真食源肽（逐条 PMID/DOI 溯源）；默认 all 向后兼容 */
    provenance?: string
    /** 按食品原料 ID 查其关联肽 */
    food_material_id?: number
    /** 按载体/来源蛋白精确过滤（品类筛选；值用 DB 真实 source_protein 全称） */
    source_protein?: string
    /** 排序字段：sequence | activity_type | molecular_weight */
    sort?: string
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

  /** 介数中心性(异步) — 提交任务返回 task_id（B表全谱 ~161s，同步会超时） */
  submitBetweennessAsync: (limit = 20) =>
    api.post<{ success: boolean; cached: boolean; task_id: string | null; status: string; result?: any }>('/databases/knowledge-graph/analytics/betweenness/async', null, { params: { limit } }).then((r) => r.data),

  /** 轮询异步任务状态/结果（复用 /core/tasks） */
  getTaskResult: (taskId: string) =>
    api.get<{ success: boolean; data: { task_id: string; status: string; result?: any; error?: string; processing_time_ms?: number } }>(`/core/tasks/${taskId}`).then((r) => r.data),

  /** Louvain社区检测(异步) — 提交任务返回 task_id */
  submitCommunitiesAsync: (limitPerCommunity = 10) =>
    api.post<{ success: boolean; cached: boolean; task_id: string | null; status: string; result?: any }>('/databases/knowledge-graph/analytics/communities/async', null, { params: { limit_per_community: limitPerCommunity } }).then((r) => r.data),

  /** K-Core分解(异步) — 提交任务返回 task_id */
  submitKCoreAsync: () =>
    api.post<{ success: boolean; cached: boolean; task_id: string | null; status: string; result?: any }>('/databases/knowledge-graph/analytics/kcore/async').then((r) => r.data),

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

  // ═══════════════════════════════════════════
  // RMCHM / CFAM 数据检索中心扩展
  // ═══════════════════════════════════════════

  /** RMCHM 中药材检索 */
  searchRmchmHerbs: (params: {
    keyword?: string
    category?: string
    food_homology?: boolean
    page?: number
    page_size?: number
  }) => api.get<PaginatedResponse<RMCHMHerb>>('/databases/rmchm/herbs', { params }).then((r) => r.data),

  /** RMCHM 药材详情（含化合物/靶点/疾病） */
  getRmchmHerb: (id: number) => api.get<{ success: boolean; data: RMCHMHerbDetail }>(`/databases/rmchm/herbs/${id}`).then((r) => r.data),

  /** RMCHM 统计 */
  getRmchmStats: () => api.get<RMCHMStats>('/databases/rmchm/stats').then((r) => r.data),

  /** CFAM 官方药食同源目录检索 */
  searchCfamHerbs: (params: {
    keyword?: string
    announcement_id?: string
    page?: number
    page_size?: number
  }) => api.get<PaginatedResponse<CFAMHerb>>('/databases/cfam/herbs', { params }).then((r) => r.data),

  /** CFAM 药材详情 */
  getCfamHerb: (id: number) => api.get<{ success: boolean; data: CFAMHerb }>(`/databases/cfam/herbs/${id}`).then((r) => r.data),

  /** CFAM 统计 */
  getCfamStats: () => api.get<CFAMStats>('/databases/cfam/stats').then((r) => r.data),

  /** 获取药材图片 URL（RMCHM/CFAM 统一） */
  getHerbImageUrl: (name: string, source?: 'rmchm' | 'cfam') =>
    api.get<{ name: string; source: string; image_url: string | null; found: boolean }>('/databases/herb-image', { params: { name, source: source ?? 'rmchm' } }).then((r) => r.data),
}

// ═══════════════════════════════════════════
// RMCHM / CFAM 类型定义
// ═══════════════════════════════════════════

export interface RMCHMHerb {
  id: number
  rmchm_id: string
  rmchm_code?: string
  name_cn: string
  name_pinyin?: string
  name_latin?: string
  name_eng?: string
  nature_cn?: string
  nature_eng?: string
  meridians_cn?: string
  meridians_eng?: string
  category_cn?: string
  category_eng?: string
  use_part?: string
  alias?: string
  function_cn?: string
  ob_percent?: number
  dl_value?: number
  is_food_homology: boolean
  is_toxic: boolean
  tcmsp_id?: string
  symmap_id?: string
  compounds_count: number
  targets_count: number
  diseases_count: number
  image_path?: string
  image_source?: string
  image_url?: string | null
  data_quality_score?: number
  created_at?: string
}

export interface RMCHMHerbDetail extends RMCHMHerb {
  compounds?: unknown[]
  targets?: unknown[]
  diseases?: unknown[]
}

export interface RMCHMStats {
  total_herbs: number
  food_homology_count: number
  toxic_count: number
  category_distribution: { category: string; count: number }[]
  source: string
}

export interface CFAMHerb {
  id: number
  name_cn: string
  name_latin?: string
  name_en?: string
  nature?: string
  flavor?: string
  category?: string
  announcement_id?: string
  announcement_source?: string
  usage_restriction?: string
  special_notice?: string
  image_path?: string
  image_url?: string | null
  is_food_homology: boolean
  pdf_page?: number
  created_at?: string
}

export interface CFAMStats {
  total_herbs: number
  announcement_distribution: { announcement_id: string; count: number }[]
  source: string
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

// ═══════════════════════════════════════════
// 知识图谱探索面板（KnowledgeGraphPanel）专用接口
// ═══════════════════════════════════════════

/**
 * 知识图谱节点联想搜索。
 * 后端 `/databases/knowledge-graph/nodes/search` 返回 `{ query, total, nodes }`，
 * 每个节点为 `{ id, type, label, description? }`（id 为 KGNode 主键）。
 *
 * @param q        搜索关键词（至少 1 个字符）
 * @param nodeType 可选的节点类型过滤：herb / compound / target / disease
 */
export const searchGraphNodes = (q: string, nodeType?: string) =>
  api.get<{
    query: string
    node_type_filter?: string | null
    total: number
    nodes: Array<{ id: number | string; type: string; label: string; description?: string | null }>
  }>('/databases/knowledge-graph/nodes/search', {
    params: { q, node_type: nodeType || undefined, limit: 8 },
  }).then((r) => r.data)

/**
 * 指定节点的子图（多跳邻居 + 连接边）。
 *
 * 注意：后端 `/databases/knowledge-graph/nodes/{node_id}/subgraph` 的 `nodes`
 * **不包含根节点本身**（`total_nodes = nodes.length + 1`），前端需要按
 * `root_node_id` 补齐根节点后再渲染。
 */
export const getNodeSubgraph = (nodeId: number | string, depth = 2) =>
  api.get<{
    root_node_id: number | string
    depth: number
    total_nodes: number
    total_edges: number
    nodes: Array<{ id: number | string; type: string; label: string; description?: string | null }>
    edges: Array<{
      id: number | string
      source_id: number | string
      target_id: number | string
      type: string
      strength?: number | null
    }>
  }>(`/databases/knowledge-graph/nodes/${encodeURIComponent(String(nodeId))}/subgraph`, {
    params: { depth },
  }).then((r) => r.data)
