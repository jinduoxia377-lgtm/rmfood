/**
 * useGraphState — consolidates ALL useState / useRef declarations from
 * KnowledgeGraph.tsx (lines ~662-779) into a single useReducer-based hook.
 *
 * Every original useState/setter pair becomes:
 *   state.xxx  +  dispatch({ type: 'SET_XXX', payload })
 *
 * Refs are stored as plain properties on state (they survive re-renders via
 * useReducer's referential identity). The consumer should attach them to a
 * ref-like object or read .current at render time.
 *
 * This file intentionally does NOT import KnowledgeGraph.tsx.
 */

import { useCallback, useReducer, useMemo } from 'react'
import type { Reducer } from 'react'
import * as d3 from 'd3'
import type { LayoutType, ThemeConfig, GraphNode, GraphEdge } from '../types'
import { TYPE_ORDER, TYPE_CONFIG, EDGE_TYPE_LABELS } from '../types'
import type { SmartPathResult } from '../analytics'
import { findSmartPath, findPathBFS } from '../analytics/stats'
import type { GraphEngine } from '../engine/forceSimulation'
import { computeCentralityMetrics } from '../utils/centrality'
import { useGraphHandlers } from './useGraphHandlers'

// 稳定的空数组常量 —— 避免每次渲染重建引用导致 useMemo 依赖失效
const EMPTY_NODES: GraphNode[] = []
const EMPTY_EDGES: GraphEdge[] = []

// ── INSIGHT_TEMPLATES：AI 洞察模板（原 KnowledgeGraph.tsx 中定义，重构后丢失）──
type InsightTemplateFn = {
  highDegreeHub: (node: GraphNode, degree: number, maxDeg: number) => AIInsight
  isolatedNode: (node: GraphNode) => AIInsight
  bridgeNode: (node: GraphNode, betweenness: number) => AIInsight
  denseCluster: (type: string, count: number, avgDegree: number) => AIInsight
  synergyPair: (source: string, target: string, edgeType: string) => AIInsight
}

const INSIGHT_TEMPLATES: InsightTemplateFn = {
  highDegreeHub: (node, degree, maxDeg) => ({
    id: `hub-${node.id || node.label}`,
    type: 'keyFinding',
    title: '高度枢纽节点',
    description: `节点 ${node.label || node.id} 的度为 ${degree}，接近全图最高值 ${maxDeg}，是信息流通的关键枢纽。`,
    confidence: 0.85,
    severity: 'info',
    relatedNodeIds: [node.id || node.label],
  }),
  isolatedNode: (node) => ({
    id: `iso-${node.id || node.label}`,
    type: 'anomaly',
    title: '孤立节点',
    description: `节点 ${node.label || node.id} 的关联较少，可能代表稀缺成分或尚未建立连接的数据。`,
    confidence: 0.7,
    severity: 'warning',
    relatedNodeIds: [node.id || node.label],
  }),
  bridgeNode: (node, betweenness) => ({
    id: `bridge-${node.id || node.label}`,
    type: 'topology',
    title: '桥梁节点',
    description: `节点 ${node.label || node.id} 的介数中心性为 ${betweenness.toFixed(3)}，连接多个社区，删除它可能显著影响连通性。`,
    confidence: 0.8,
    severity: 'info',
    relatedNodeIds: [node.id || node.label],
  }),
  denseCluster: (type, count, avgDegree) => ({
    id: `cluster-${type}-${count}`,
    type: 'summary',
    title: '密集簇',
    description: `检测到 ${count} 个「${type}」类型节点构成密集簇，平均度为 ${avgDegree.toFixed(1)}，可能存在强关联成分组合。`,
    confidence: 0.75,
  }),
  synergyPair: (source, target, edgeType) => ({
    id: `synergy-${source}-${target}`,
    type: 'recommendation',
    title: '协同关系',
    description: `「${source}」与「${target}」通过「${edgeType}」关系相连，可能具有协同增效潜力。`,
    confidence: 0.65,
    relatedNodeIds: [source, target],
  }),
}

// ── MOCK_EXTERNAL_DB：外部数据库模拟（原 KnowledgeGraph.tsx 中的 MOCK_EXTERNAL_DB）──
const MOCK_EXTERNAL_DB: Record<string, ExternalData> = {
  人参: { source: 'tcmsp', description: '人参皂苷 Rg1、Rb1 等活性成分，补气固脱。', molecularFormula: 'C42H72O14', targets: ['PIK3CA', 'AKT1'], literatureCount: 120 },
  黄芪: { source: 'tcmsp', description: '黄芪甲苷 IV，增强免疫。', molecularFormula: 'C41H68O14', targets: ['STAT3', 'JAK2'], literatureCount: 98 },
  枸杞: { source: 'tcmsp', description: '枸杞多糖，抗氧化。', targets: ['SOD2', 'CAT'], literatureCount: 76 },
  当归: { source: 'tcmsp', description: '阿魏酸，活血补血。', molecularFormula: 'C10H10O4', targets: ['HIF1A'], literatureCount: 54 },
}

// ── LOD 分级阈值（节点数硬上限）─────────────────────────────
// 超过 MAX_RENDER_NODES 时前端只渲染度数最高的子集，防止 SVG 冻结。
export const MAX_RENDER_NODES = 900
const LOD_FULL_MAX = 150
const LOD_REDUCED_MAX = 500

// ════════════════════════════════════════════════════════════
// Inline type definitions (mirrored from KnowledgeGraph.tsx)
// ════════════════════════════════════════════════════════════

export interface AIInsight {
  id: string
  type: 'summary' | 'keyFinding' | 'anomaly' | 'recommendation' | 'topology'
  title: string
  description: string
  confidence: number
  severity?: 'info' | 'warning' | 'critical'
  relatedNodeIds?: string[]
  actionLabel?: string
}

export interface ExternalData {
  source: 'pubchem' | 'tcmsp' | 'uniprot' | 'ctd' | 'local'
  molecularFormula?: string
  molecularWeight?: number
  smiles?: string
  inchiKey?: string
  targets?: string[]
  pathways?: string[]
  diseases?: string[]
  literatureCount?: number
  lastUpdated?: string
  description?: string
  properties?: Record<string, string | number>
}

export interface ImportState {
  status: 'idle' | 'dragging' | 'parsing' | 'validating' | 'importing' | 'done' | 'error'
  fileName?: string
  fileType?: 'csv' | 'json' | 'sdf' | 'unknown'
  progress: number
  previewRows?: Record<string, unknown>[]
  error?: string
  importedCount?: number
}

export interface GraphComparison {
  id: string
  timestamp: number
  labelA: string
  labelB: string
  nodesOnlyInA: string[]
  nodesOnlyInB: string[]
  edgesOnlyInA: string[]
  edgesOnlyInB: string[]
  commonNodes: string[]
  similarityScore: number
}

export interface GraphSnapshot {
  id: string
  timestamp: number
  label: string
  nodeCount: number
  edgeCount?: number
  selectedNode?: string
  filterTypes: string[]
  searchQuery: string
  layoutType?: string
  zoomLevel?: number
  panOffset?: { x: number; y: number }
}

export interface ShareLink {
  id: string
  url: string
  shortCode: string
  createdAt: Date
  expiresAt?: Date
  viewCount: number
  snapshot: GraphSnapshot
}

export interface NodeAnnotation {
  id: string
  nodeId: string
  author: string
  avatar?: string
  content: string
  createdAt: Date
  mentions?: string[]
  replies?: NodeAnnotation[]
  resolved: boolean
}

export interface HistoryEntry {
  id: string
  timestamp: Date
  type: 'filter' | 'search' | 'select' | 'layout' | 'theme' | 'zoom' | 'focus' | 'export' | 'annotate' | 'bookmark' | 'import' | 'share'
  description: string
  detail?: Record<string, unknown>
  reversible: boolean
}

export interface GraphBookmark {
  id: string
  name: string
  icon: string
  createdAt: Date
  snapshot: {
    selectedNode?: string
    highlightPath?: string[]
    filterTypes: string[]
    searchQuery: string
    layoutType: string
    zoomLevel: number
    panOffset: { x: number; y: number }
  }
}

export interface ReportConfig {
  title: string
  author: string
  format: 'pdf' | 'word' | 'html'
  includeScreenshot: boolean
  includeStatistics: boolean
  includeAIInsights: boolean
  includeCentrality: boolean
  includeComparison?: boolean
  customSections?: { title: string; content: string }[]
}

export interface GraphStatistics {
  nodeCount: number
  edgeCount: number
  density: number
  avgDegree: number
  maxDegree: number
  diameter: number
  avgPathLength: number
  clusteringCoeff: number
  componentCount: number
  largestComponentSize: number
  degreeDistribution: { degree: number; count: number }[]
  typeDistribution: { type: string; count: number; percentage: number }[]
}

export interface CommunityResult {
  communities: { id: number; nodes: string[]; labels: string[]; color: string }[]
  modularity: number
  algorithm: 'louvain' | 'label-prop' | 'connected'
}

export interface KCoreResult {
  cores: { k: number; nodeIds: string[]; labels: string[] }[]
  maxK: number
  coreness: Record<string, number>
}

export interface CentralityMetrics {
  pageRank: Record<string, number>
  betweenness: Record<string, number>
  closeness: Record<string, number>
  hits: { authority: Record<string, number>; hub: Record<string, number> }
  degree: Record<string, number>
}

export interface SubGraphResult {
  id: string
  name: string
  type: 'kcore' | 'community' | 'ego' | 'path' | 'custom'
  nodeIds: string[]
  edgeIds: { source: string; target: string }[]
  metadata: Record<string, unknown>
}

export interface AIQARecord {
  id: string
  question: string
  answer: string
  timestamp: Date
  referencedNodes: string[]
  referencedEdges: { source: string; target: string }[]
}

export interface NodeAIAnalysis {
  nodeId: string
  summary: string
  relationships: { type: string; count: string; interpretation: string }[]
  suggestions: string[]
  potentialLinks: string[]
  synergyScore: number
}

type AnnotationEntry = {
  id: string
  x: number
  y: number
  text: string
  type: 'note' | 'arrow'
  targetId?: string
}

export type AnimationPreset = 'fadeIn' | 'expand' | 'converge' | 'none'

// ════════════════════════════════════════════════════════════
// State shape — mirrors every useState / useRef declaration
// ════════════════════════════════════════════════════════════

export interface GraphState {
  // ── Core refs (useRef in KnowledgeGraph) ──
  svgRef: { current: SVGSVGElement | null }
  containerRef: { current: HTMLDivElement | null }
  zoomBehaviorRef: { current: d3.ZoomBehavior<SVGSVGElement, unknown> | null }
  prevLayoutRef: { current: LayoutType | undefined }
  prevDataRef: { current: { nodeCount: number; edgeCount: number; nodeIds: string } }
  perfFrameTimesRef: { current: number[] }
  lastFrameTimeRef: { current: number }
  perfRafIdRef: { current: number | null }
  engineRef: { current: GraphEngine | null }

  // ── Interaction state ──
  tooltip: { x: number; y: number; content: string } | null
  activeFilter: string | null
  selectedNode: GraphNode | null
  selectedNodes: Set<string>
  zoomTransform: d3.ZoomTransform | null
  legendOpen: boolean
  detailTab: 'info' | 'connections' | 'properties'
  searchQuery: string
  searchResults: GraphNode[]
  searchHistory: string[]
  focusedNodeIndex: number
  isSelecting: boolean
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null
  contextMenu: { x: number; y: number; node?: GraphNode } | null

  // ── Community & performance ──
  communities: Map<string, number>
  communityColors: Record<number, string>
  perfStats: { fps: number; frameTime: number; memoryEst: string; lodLevel: string; rating: 'excellent' | 'good' | 'fair' | 'poor' }
  showPerfPanel: boolean

  // ── Export & minimap ──
  showExportMenu: boolean
  exportStatus: string | null
  showMinimap: boolean
  pathAnimation: { source: string; target: string; pathNodes: string[]; pathEdges: [string, string][] } | null

  // ── Group / panel / sort / pin / annotation ──
  collapsedGroups: Set<string>
  showCentralityPanel: boolean
  sortBy: 'degree' | 'label' | 'type'
  pinnedNodes: Set<string>
  showPinnedPanel: boolean
  annotations: AnnotationEntry[]
  isAddingAnnotation: boolean

  // ── Theme / layout / animation ──
  activeTheme: ThemeConfig
  showThemePanel: boolean
  animationPreset: AnimationPreset
  showLayoutMenu: boolean
  localLayout: LayoutType

  // ── AI insights / path / analysis / snapshots ──
  aiInsights: AIInsight[]
  showAIPanel: boolean
  smartPathResult: SmartPathResult | null
  showPathPanel: boolean
  pathSourceId: string
  pathTargetId: string
  nodeAIAnalysis: NodeAIAnalysis | null
  graphSnapshots: Array<{ id: string; timestamp: number; label: string; nodeCount: number }>
  isGeneratingInsight: boolean

  // ── External data / import / compare / sync / drag ──
  externalDataCache: Map<string, ExternalData>
  showExternalPanel: boolean
  externalLoadingId: string | null
  importState: ImportState
  showImportDialog: boolean
  showCompareMode: boolean
  compareResult: GraphComparison | null
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error'
  lastSyncTime: Date
  dragOver: boolean

  // ── Sharing / collaboration / history / bookmarks / reports ──
  shareLink: ShareLink | null
  showSharePanel: boolean
  nodeAnnotations: Map<string, NodeAnnotation[]>
  showAnnotationPanel: boolean
  newAnnotationText: string
  historyEntries: HistoryEntry[]
  historyIndex: number
  showHistoryPanel: boolean
  bookmarks: GraphBookmark[]
  showBookmarkPanel: boolean
  reportConfig: ReportConfig
  showReportDialog: boolean
  reportGenerating: boolean

  // ── Advanced analysis ──
  graphStats: GraphStatistics | null
  showStatsPanel: boolean
  communityResult: CommunityResult | null
  kcoreResult: KCoreResult | null
  centralityMetrics: CentralityMetrics | null
  centralityMode: 'pageRank' | 'betweenness' | 'closeness' | 'degree'
  savedSubGraphs: SubGraphResult[]
  activeSubGraph: SubGraphResult | null
  showSubGraphPanel: boolean
  aiQAHistory: AIQARecord[]
  aiQuestion: string
  aiAnswering: boolean
}

// ════════════════════════════════════════════════════════════
// Action types (discriminated union)
// ════════════════════════════════════════════════════════════

export type GraphAction =
  // ── Interaction ──────────────────────────────────────────────
  | { type: 'SET_TOOLTIP'; payload: { x: number; y: number; content: string } | null }
  | { type: 'SET_FILTER'; payload: string | null }
  | { type: 'SELECT_NODE'; payload: GraphNode | null }
  | { type: 'SET_SELECTED_NODES'; payload: Set<string> }
  | { type: 'TOGGLE_PIN'; payload: string }
  | { type: 'CLEAR_ALL_PINS' }
  | { type: 'SET_ZOOM_TRANSFORM'; payload: d3.ZoomTransform | null }
  | { type: 'SET_LEGEND_OPEN'; payload: boolean }
  | { type: 'SET_DETAIL_TAB'; payload: 'info' | 'connections' | 'properties' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: GraphNode[] }
  | { type: 'ADD_SEARCH_HISTORY_ITEM'; payload: string }
  | { type: 'SET_FOCUSED_NODE_INDEX'; payload: number }
  | { type: 'SET_IS_SELECTING'; payload: boolean }
  | { type: 'SET_SELECTION_BOX'; payload: { x1: number; y1: number; x2: number; y2: number } | null }
  | { type: 'SET_CONTEXT_MENU'; payload: { x: number; y: number; node?: GraphNode } | null }

  // ── Community / perf ─────────────────────────────────────────
  | { type: 'SET_COMMUNITIES'; payload: Map<string, number> }
  | { type: 'SET_COMMUNITY_COLORS'; payload: Record<number, string> }
  | { type: 'SET_PERF_STATS'; payload: GraphState['perfStats'] }
  | { type: 'SET_SHOW_PERF_PANEL'; payload: boolean }

  // ── Export / minimap / path ──────────────────────────────────
  | { type: 'SET_SHOW_EXPORT_MENU'; payload: boolean }
  | { type: 'SET_EXPORT_STATUS'; payload: string | null }
  | { type: 'SET_SHOW_MINIMAP'; payload: boolean }
  | { type: 'SET_PATH_ANIMATION'; payload: GraphState['pathAnimation'] }

  // ── Group / panel / sort / pin / annotation ──────────────────
  | { type: 'TOGGLE_GROUP_COLLAPSE'; payload: string }
  | { type: 'SET_SHOW_CENTRALITY_PANEL'; payload: boolean }
  | { type: 'SET_SORT_BY'; payload: 'degree' | 'label' | 'type' }
  | { type: 'SET_PINNED_NODES'; payload: Set<string> }
  | { type: 'SET_SHOW_PINNED_PANEL'; payload: boolean }
  | { type: 'ADD_ANNOTATION_ENTRY'; payload: Omit<AnnotationEntry, 'id'> }
  | { type: 'REMOVE_ANNOTATION_ENTRY'; payload: string }
  | { type: 'CLEAR_ALL_ANNOTATIONS' }
  | { type: 'SET_IS_ADDING_ANNOTATION'; payload: boolean }

  // ── Theme / layout / animation ───────────────────────────────
  | { type: 'SET_THEME'; payload: ThemeConfig }
  | { type: 'SET_SHOW_THEME_PANEL'; payload: boolean }
  | { type: 'SET_ANIMATION_PRESET'; payload: AnimationPreset }
  | { type: 'SET_SHOW_LAYOUT_MENU'; payload: boolean }
  | { type: 'SET_LAYOUT'; payload: LayoutType }

  // ── AI / insights / path / analysis / snapshots ──────────────
  | { type: 'SET_AI_INSIGHTS'; payload: AIInsight[] }
  | { type: 'SET_SHOW_AI_PANEL'; payload: boolean }
  | { type: 'SET_SMART_PATH_RESULT'; payload: SmartPathResult | null }
  | { type: 'SET_SHOW_PATH_PANEL'; payload: boolean }
  | { type: 'SET_PATH_SOURCE_ID'; payload: string }
  | { type: 'SET_PATH_TARGET_ID'; payload: string }
  | { type: 'SET_NODE_AI_ANALYSIS'; payload: NodeAIAnalysis | null }
  | { type: 'APPEND_GRAPH_SNAPSHOT'; payload: { id: string; timestamp: number; label: string; nodeCount: number } }
  | { type: 'SET_GENERATING_INSIGHT'; payload: boolean }

  // ── External data / import / compare / sync / drag ───────────
  | { type: 'SET_EXTERNAL_DATA_CACHE'; payload: Map<string, ExternalData> }
  | { type: 'SET_SHOW_EXTERNAL_PANEL'; payload: boolean }
  | { type: 'SET_EXTERNAL_LOADING_ID'; payload: string | null }
  | { type: 'SET_IMPORT_STATE_PARTIAL'; payload: Partial<ImportState> }
  | { type: 'SET_SHOW_IMPORT_DIALOG'; payload: boolean }
  | { type: 'SET_SHOW_COMPARE_MODE'; payload: boolean }
  | { type: 'SET_COMPARE_RESULT'; payload: GraphComparison | null }
  | { type: 'SET_SYNC_STATUS'; payload: 'connected' | 'disconnected' | 'syncing' | 'error' }
  | { type: 'SET_LAST_SYNC_TIME'; payload: Date }
  | { type: 'SET_DRAG_OVER'; payload: boolean }

  // ── Sharing / history / bookmarks / reports ──────────────────
  | { type: 'SET_SHARE_LINK'; payload: ShareLink | null }
  | { type: 'SET_SHOW_SHARE_PANEL'; payload: boolean }
  | { type: 'SET_NODE_ANNOTATIONS_MAP'; payload: Map<string, NodeAnnotation[]> }
  | { type: 'SET_SHOW_ANNOTATION_PANEL'; payload: boolean }
  | { type: 'SET_NEW_ANNOTATION_TEXT'; payload: string }
  | { type: 'ADD_HISTORY_ENTRY'; payload: { type: HistoryEntry['type']; description: string; detail?: Record<string, unknown> } }
  | { type: 'UNDO_HISTORY' }
  | { type: 'REDO_HISTORY' }
  | { type: 'SET_SHOW_HISTORY_PANEL'; payload: boolean }
  | { type: 'APPEND_BOOKMARK'; payload: GraphBookmark }
  | { type: 'REMOVE_BOOKMARK_ENTRY'; payload: string }
  | { type: 'SET_SHOW_BOOKMARK_PANEL'; payload: boolean }
  | { type: 'SET_REPORT_CONFIG_PARTIAL'; payload: Partial<ReportConfig> }
  | { type: 'SET_SHOW_REPORT_DIALOG'; payload: boolean }
  | { type: 'SET_REPORT_GENERATING'; payload: boolean }

  // ── Advanced analysis ────────────────────────────────────────
  | { type: 'SET_GRAPH_STATS'; payload: GraphStatistics | null }
  | { type: 'SET_SHOW_STATS_PANEL'; payload: boolean }
  | { type: 'SET_COMMUNITY_RESULT'; payload: CommunityResult | null }
  | { type: 'SET_KCORE_RESULT'; payload: KCoreResult | null }
  | { type: 'SET_CENTRALITY_METRICS'; payload: CentralityMetrics | null }
  | { type: 'SET_CENTRALITY_MODE'; payload: 'pageRank' | 'betweenness' | 'closeness' | 'degree' }
  | { type: 'APPEND_SAVED_SUBGRAPH'; payload: SubGraphResult }
  | { type: 'SET_ACTIVE_SUBGRAPH'; payload: SubGraphResult | null }
  | { type: 'SET_SHOW_SUBGRAPH_PANEL'; payload: boolean }
  | { type: 'APPEND_AI_QA_RECORD'; payload: AIQARecord }
  | { type: 'SET_AI_QUESTION'; payload: string }
  | { type: 'SET_AI_ANSWERING'; payload: boolean }

  // ── Setter actions（补齐原空桩 setter 的真实 dispatch）──────────
  | { type: 'SET_COLLAPSED_GROUPS'; payload: Set<string> }
  | { type: 'SET_ANNOTATIONS'; payload: AnnotationEntry[] }
  | { type: 'SET_GRAPH_SNAPSHOTS'; payload: Array<{ id: string; timestamp: number; label: string; nodeCount: number }> }
  | { type: 'SET_IMPORT_STATE'; payload: ImportState }
  | { type: 'SET_NODE_ANNOTATIONS'; payload: Map<string, NodeAnnotation[]> }
  | { type: 'SET_HISTORY_ENTRIES'; payload: HistoryEntry[] }
  | { type: 'SET_HISTORY_INDEX'; payload: number }
  | { type: 'SET_BOOKMARKS'; payload: GraphBookmark[] }
  | { type: 'SET_REPORT_CONFIG'; payload: ReportConfig }
  | { type: 'SET_SAVED_SUBGRAPHS'; payload: SubGraphResult[] }
  | { type: 'SET_AI_QA_HISTORY'; payload: AIQARecord[] }

// ════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════

const graphReducer: Reducer<GraphState, GraphAction> = (state, action) => {
  switch (action.type) {
    case 'SET_TOOLTIP':
      return { ...state, tooltip: action.payload }

    case 'SET_FILTER':
      return { ...state, activeFilter: action.payload }

    case 'SELECT_NODE':
      return { ...state, selectedNode: action.payload }

    case 'SET_SELECTED_NODES':
      return { ...state, selectedNodes: action.payload }

    case 'TOGGLE_PIN': {
      const next = new Set(state.pinnedNodes)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, pinnedNodes: next }
    }

    case 'CLEAR_ALL_PINS':
      return { ...state, pinnedNodes: new Set() }

    case 'SET_ZOOM_TRANSFORM':
      return { ...state, zoomTransform: action.payload }

    case 'SET_LEGEND_OPEN':
      return { ...state, legendOpen: action.payload }

    case 'SET_DETAIL_TAB':
      return { ...state, detailTab: action.payload }

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, focusedNodeIndex: -1 }

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload }

    case 'ADD_SEARCH_HISTORY_ITEM': {
      const q = action.payload
      const exists = state.searchHistory.includes(q)
      const next = exists ? state.searchHistory : [q, ...state.searchHistory].slice(0, 8)
      return { ...state, searchHistory: next }
    }

    case 'SET_FOCUSED_NODE_INDEX':
      return { ...state, focusedNodeIndex: action.payload }

    case 'SET_IS_SELECTING':
      return { ...state, isSelecting: action.payload }

    case 'SET_SELECTION_BOX':
      return { ...state, selectionBox: action.payload }

    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload }

    case 'SET_COMMUNITIES':
      return { ...state, communities: action.payload }

    case 'SET_COMMUNITY_COLORS':
      return { ...state, communityColors: action.payload }

    case 'SET_PERF_STATS':
      return { ...state, perfStats: action.payload }

    case 'SET_SHOW_PERF_PANEL':
      return { ...state, showPerfPanel: action.payload }

    case 'SET_SHOW_EXPORT_MENU':
      return { ...state, showExportMenu: action.payload }

    case 'SET_EXPORT_STATUS':
      return { ...state, exportStatus: action.payload }

    case 'SET_SHOW_MINIMAP':
      return { ...state, showMinimap: action.payload }

    case 'SET_PATH_ANIMATION':
      return { ...state, pathAnimation: action.payload }

    case 'TOGGLE_GROUP_COLLAPSE': {
      const next = new Set(state.collapsedGroups)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, collapsedGroups: next }
    }

    case 'SET_SHOW_CENTRALITY_PANEL':
      return { ...state, showCentralityPanel: action.payload }

    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload }

    case 'SET_PINNED_NODES':
      return { ...state, pinnedNodes: action.payload }

    case 'SET_SHOW_PINNED_PANEL':
      return { ...state, showPinnedPanel: action.payload }

    case 'ADD_ANNOTATION_ENTRY': {
      const entry: AnnotationEntry = {
        ...action.payload,
        id: `anno_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      }
      return { ...state, annotations: [...state.annotations, entry] }
    }

    case 'REMOVE_ANNOTATION_ENTRY':
      return { ...state, annotations: state.annotations.filter(a => a.id !== action.payload) }

    case 'CLEAR_ALL_ANNOTATIONS':
      return { ...state, annotations: [] }

    case 'SET_IS_ADDING_ANNOTATION':
      return { ...state, isAddingAnnotation: action.payload }

    case 'SET_THEME':
      return { ...state, activeTheme: action.payload }

    case 'SET_SHOW_THEME_PANEL':
      return { ...state, showThemePanel: action.payload }

    case 'SET_ANIMATION_PRESET':
      return { ...state, animationPreset: action.payload }

    case 'SET_SHOW_LAYOUT_MENU':
      return { ...state, showLayoutMenu: action.payload }

    case 'SET_LAYOUT':
      return {
        ...state,
        localLayout: action.payload,
        prevLayoutRef: { current: action.payload },
      }

    case 'SET_AI_INSIGHTS':
      return { ...state, aiInsights: action.payload }

    case 'SET_SHOW_AI_PANEL':
      return { ...state, showAIPanel: action.payload }

    case 'SET_SMART_PATH_RESULT':
      return { ...state, smartPathResult: action.payload }

    case 'SET_SHOW_PATH_PANEL':
      return { ...state, showPathPanel: action.payload }

    case 'SET_PATH_SOURCE_ID':
      return { ...state, pathSourceId: action.payload }

    case 'SET_PATH_TARGET_ID':
      return { ...state, pathTargetId: action.payload }

    case 'SET_NODE_AI_ANALYSIS':
      return { ...state, nodeAIAnalysis: action.payload }

    case 'APPEND_GRAPH_SNAPSHOT':
      return { ...state, graphSnapshots: [...state.graphSnapshots, action.payload] }

    case 'SET_GENERATING_INSIGHT':
      return { ...state, isGeneratingInsight: action.payload }

    case 'SET_EXTERNAL_DATA_CACHE':
      return { ...state, externalDataCache: action.payload }

    case 'SET_SHOW_EXTERNAL_PANEL':
      return { ...state, showExternalPanel: action.payload }

    case 'SET_EXTERNAL_LOADING_ID':
      return { ...state, externalLoadingId: action.payload }

    case 'SET_IMPORT_STATE_PARTIAL':
      return { ...state, importState: { ...state.importState, ...action.payload } }

    case 'SET_SHOW_IMPORT_DIALOG':
      return { ...state, showImportDialog: action.payload }

    case 'SET_SHOW_COMPARE_MODE':
      return { ...state, showCompareMode: action.payload }

    case 'SET_COMPARE_RESULT':
      return { ...state, compareResult: action.payload }

    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload }

    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload }

    case 'SET_DRAG_OVER':
      return { ...state, dragOver: action.payload }

    case 'SET_SHARE_LINK':
      return { ...state, shareLink: action.payload }

    case 'SET_SHOW_SHARE_PANEL':
      return { ...state, showSharePanel: action.payload }

    case 'SET_NODE_ANNOTATIONS_MAP':
      return { ...state, nodeAnnotations: action.payload }

    case 'SET_SHOW_ANNOTATION_PANEL':
      return { ...state, showAnnotationPanel: action.payload }

    case 'SET_NEW_ANNOTATION_TEXT':
      return { ...state, newAnnotationText: action.payload }

    case 'ADD_HISTORY_ENTRY': {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: action.payload.type,
        description: action.payload.description,
        detail: action.payload.detail,
        reversible: ['filter', 'search', 'select', 'layout', 'theme', 'zoom'].includes(action.payload.type),
      }
      const trimmed = state.historyEntries.slice(0, state.historyIndex + 1)
      const next = [...trimmed, entry].slice(-50)
      return { ...state, historyEntries: next, historyIndex: Math.min(state.historyIndex + 1, 49) }
    }

    case 'UNDO_HISTORY': {
      if (state.historyIndex < 0) return state
      return { ...state, historyIndex: state.historyIndex - 1 }
    }

    case 'REDO_HISTORY': {
      if (state.historyIndex >= state.historyEntries.length - 1) return state
      return { ...state, historyIndex: state.historyIndex + 1 }
    }

    case 'SET_SHOW_HISTORY_PANEL':
      return { ...state, showHistoryPanel: action.payload }

    case 'APPEND_BOOKMARK': {
      const next = [...state.bookmarks, action.payload].slice(-10)
      return { ...state, bookmarks: next }
    }

    case 'REMOVE_BOOKMARK_ENTRY':
      return { ...state, bookmarks: state.bookmarks.filter(b => b.id !== action.payload) }

    case 'SET_SHOW_BOOKMARK_PANEL':
      return { ...state, showBookmarkPanel: action.payload }

    case 'SET_REPORT_CONFIG_PARTIAL':
      return { ...state, reportConfig: { ...state.reportConfig, ...action.payload } }

    case 'SET_SHOW_REPORT_DIALOG':
      return { ...state, showReportDialog: action.payload }

    case 'SET_REPORT_GENERATING':
      return { ...state, reportGenerating: action.payload }

    case 'SET_GRAPH_STATS':
      return { ...state, graphStats: action.payload }

    case 'SET_SHOW_STATS_PANEL':
      return { ...state, showStatsPanel: action.payload }

    case 'SET_COMMUNITY_RESULT':
      return { ...state, communityResult: action.payload }

    case 'SET_KCORE_RESULT':
      return { ...state, kcoreResult: action.payload }

    case 'SET_CENTRALITY_METRICS':
      return { ...state, centralityMetrics: action.payload }

    case 'SET_CENTRALITY_MODE':
      return { ...state, centralityMode: action.payload }

    case 'APPEND_SAVED_SUBGRAPH':
      return { ...state, savedSubGraphs: [...state.savedSubGraphs.slice(-9), action.payload] }

    case 'SET_ACTIVE_SUBGRAPH':
      return { ...state, activeSubGraph: action.payload }

    case 'SET_SHOW_SUBGRAPH_PANEL':
      return { ...state, showSubGraphPanel: action.payload }

    case 'APPEND_AI_QA_RECORD':
      return { ...state, aiQAHistory: [action.payload, ...state.aiQAHistory].slice(0, 20) }

    case 'SET_AI_QUESTION':
      return { ...state, aiQuestion: action.payload }

    case 'SET_AI_ANSWERING':
      return { ...state, aiAnswering: action.payload }

    case 'SET_COLLAPSED_GROUPS':
      return { ...state, collapsedGroups: action.payload }

    case 'SET_ANNOTATIONS':
      return { ...state, annotations: action.payload }

    case 'SET_GRAPH_SNAPSHOTS':
      return { ...state, graphSnapshots: action.payload }

    case 'SET_IMPORT_STATE':
      return { ...state, importState: action.payload }

    case 'SET_NODE_ANNOTATIONS':
      return { ...state, nodeAnnotations: action.payload }

    case 'SET_HISTORY_ENTRIES':
      return { ...state, historyEntries: action.payload }

    case 'SET_HISTORY_INDEX':
      return { ...state, historyIndex: action.payload }

    case 'SET_BOOKMARKS':
      return { ...state, bookmarks: action.payload }

    case 'SET_REPORT_CONFIG':
      return { ...state, reportConfig: action.payload }

    case 'SET_SAVED_SUBGRAPHS':
      return { ...state, savedSubGraphs: action.payload }

    case 'SET_AI_QA_HISTORY':
      return { ...state, aiQAHistory: action.payload }

    default: {
      // TypeScript exhaustive check — add `: never` below if we miss a case
      const _: never = action
      return _ satisfies never
    }
  }
}

// ════════════════════════════════════════════════════════════
// Initial state factory
// ════════════════════════════════════════════════════════════

function createInitialState(initialLayout: LayoutType): GraphState {
  const layout = initialLayout ?? 'force'
  return {
    // Core refs
    svgRef: { current: null },
    containerRef: { current: null },
    zoomBehaviorRef: { current: null },
    prevLayoutRef: { current: layout },
    prevDataRef: { current: { nodeCount: 0, edgeCount: 0, nodeIds: '' } },
    perfFrameTimesRef: { current: [] },
    lastFrameTimeRef: { current: 0 },
    perfRafIdRef: { current: null },
    engineRef: { current: null },

    // Interaction
    tooltip: null,
    activeFilter: null,
    selectedNode: null,
    selectedNodes: new Set<string>(),
    zoomTransform: null,
    legendOpen: false,
    detailTab: 'info',
    searchQuery: '',
    searchResults: [],
    searchHistory: [],
    focusedNodeIndex: -1,
    isSelecting: false,
    selectionBox: null,
    contextMenu: null,

    // Community / perf
    communities: new Map<string, number>(),
    communityColors: {} as Record<number, string>,
    perfStats: { fps: 0, frameTime: 0, memoryEst: '0 KB', lodLevel: 'full', rating: 'excellent' },
    showPerfPanel: false,

    // Export / minimap
    showExportMenu: false,
    exportStatus: null,
    showMinimap: true,
    pathAnimation: null,

    // Group / panel / sort / pin / annotation
    collapsedGroups: new Set<string>(),
    showCentralityPanel: false,
    sortBy: 'degree',
    pinnedNodes: new Set<string>(),
    showPinnedPanel: false,
    annotations: [],
    isAddingAnnotation: false,

    // Theme / layout / animation
    activeTheme: {
      id: 'academic', name: '学术经典', icon: '📚',
      bgGradient: 'linear-gradient(135deg, #f0f4f8 0%, #E5E7EB 100%)',
      nodeColors: {
        herb: { color: '#1E8E3E', glow: 'rgba(4,120,87,0.35)' },
        compound: { color: '#0052AE', glow: 'rgba(29,78,216,0.35)' },
        target: { color: '#D97706', glow: 'rgba(180,83,9,0.35)' },
        disease: { color: '#DC2626', glow: 'rgba(185,28,28,0.35)' },
        peptide: { color: '#8B5CF6', glow: 'rgba(109,40,217,0.35)' },
        protein: { color: '#9D174D', glow: 'rgba(190,24,93,0.35)' },
        food: { color: '#C2410C', glow: 'rgba(194,65,12,0.35)' },
      },
      edgeBaseColor: 'var(--color-knowledge-text, #6B7280)',
      canvasBg: '#ffffff',
      panelBg: 'rgba(255,255,255,0.95)',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
      accentColor: 'var(--color-secondary-500)',
    },
    showThemePanel: false,
    animationPreset: 'fadeIn',
    showLayoutMenu: false,
    localLayout: layout,

    // AI / insights / path / analysis / snapshots
    aiInsights: [],
    showAIPanel: false,
    smartPathResult: null,
    showPathPanel: false,
    pathSourceId: '',
    pathTargetId: '',
    nodeAIAnalysis: null,
    graphSnapshots: [],
    isGeneratingInsight: false,

    // External data / import / compare / sync / drag
    externalDataCache: new Map<string, ExternalData>(),
    showExternalPanel: false,
    externalLoadingId: null,
    importState: { status: 'idle', progress: 0 },
    showImportDialog: false,
    showCompareMode: false,
    compareResult: null,
    syncStatus: 'connected',
    lastSyncTime: new Date(),
    dragOver: false,

    // Sharing / history / bookmarks / reports
    shareLink: null,
    showSharePanel: false,
    nodeAnnotations: new Map<string, NodeAnnotation[]>(),
    showAnnotationPanel: false,
    newAnnotationText: '',
    historyEntries: [],
    historyIndex: -1,
    showHistoryPanel: false,
    bookmarks: [] as GraphBookmark[],
    showBookmarkPanel: false,
    reportConfig: {
      title: '知识图谱分析报告',
      author: '研究员',
      format: 'pdf',
      includeScreenshot: true,
      includeStatistics: true,
      includeAIInsights: true,
      includeCentrality: true,
    },
    showReportDialog: false,
    reportGenerating: false,

    // Advanced analysis
    graphStats: null,
    showStatsPanel: false,
    communityResult: null,
    kcoreResult: null,
    centralityMetrics: null,
    centralityMode: 'pageRank',
    savedSubGraphs: [],
    activeSubGraph: null,
    showSubGraphPanel: false,
    aiQAHistory: [],
    aiQuestion: '',
    aiAnswering: false,
  }
}

// ════════════════════════════════════════════════════════════
// Hook
// ════════════════════════════════════════════════════════════

export interface UseGraphStateOptions {
  initialLayout?: LayoutType
  /** 外部传入的节点数据 —— 用于计算 filteredData / degreeStats / searchMatches 等派生值 */
  nodes?: GraphNode[]
  /** 外部传入的边数据 */
  edges?: GraphEdge[]
  onNodeClick?: (node: GraphNode) => void
}

export function useGraphState(options: UseGraphStateOptions = {}) {
  const { initialLayout = 'force', nodes = EMPTY_NODES, edges = EMPTY_EDGES } = options
  const [state, dispatch] = useReducer(graphReducer, createInitialState(initialLayout))

  // ── 稳定的 ref 别名（与 state 中的 ref 对象共享同一引用）──
  const svgRef = state.svgRef
  const zoomBehaviorRef = state.zoomBehaviorRef
  const prevDataRef = state.prevDataRef

  // ── Convenience dispatch wrappers ──

  const setTooltip = useCallback((t: GraphState['tooltip']) => dispatch({ type: 'SET_TOOLTIP', payload: t }), [])
  const setActiveFilter = useCallback((v: string | null) => dispatch({ type: 'SET_FILTER', payload: v }), [])
  const setSelectedNode = useCallback((n: GraphNode | null) => dispatch({ type: 'SELECT_NODE', payload: n }), [])
  const setSelectedNodes = useCallback((s: Set<string>) => dispatch({ type: 'SET_SELECTED_NODES', payload: s }), [])
  const setZoomTransform = useCallback((z: d3.ZoomTransform | null) => dispatch({ type: 'SET_ZOOM_TRANSFORM', payload: z }), [])
  const setLegendOpen = useCallback((v: boolean) => dispatch({ type: 'SET_LEGEND_OPEN', payload: v }), [])
  const setDetailTab = useCallback((t: 'info' | 'connections' | 'properties') => dispatch({ type: 'SET_DETAIL_TAB', payload: t }), [])
  const setSearchQuery = useCallback((q: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q }), [])
  const setSearchResults = useCallback((r: GraphNode[]) => dispatch({ type: 'SET_SEARCH_RESULTS', payload: r }), [])
  const setSearchHistoryItems = useCallback((q: string) => dispatch({ type: 'ADD_SEARCH_HISTORY_ITEM', payload: q }), [])
  const setFocusedNodeIndex = useCallback((i: number) => dispatch({ type: 'SET_FOCUSED_NODE_INDEX', payload: i }), [])
  const setIsSelecting = useCallback((v: boolean) => dispatch({ type: 'SET_IS_SELECTING', payload: v }), [])
  const setSelectionBox = useCallback((b: GraphState['selectionBox']) => dispatch({ type: 'SET_SELECTION_BOX', payload: b }), [])
  const setContextMenu = useCallback((m: GraphState['contextMenu']) => dispatch({ type: 'SET_CONTEXT_MENU', payload: m }), [])

  const setCommunities = useCallback((c: Map<string, number>) => dispatch({ type: 'SET_COMMUNITIES', payload: c }), [])
  const setCommunityColors = useCallback((c: Record<number, string>) => dispatch({ type: 'SET_COMMUNITY_COLORS', payload: c }), [])
  const setPerfStats = useCallback((p: GraphState['perfStats']) => dispatch({ type: 'SET_PERF_STATS', payload: p }), [])
  const setShowPerfPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_PERF_PANEL', payload: v }), [])
  const setShowExportMenu = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: v }), [])
  const setExportStatus = useCallback((s: string | null) => dispatch({ type: 'SET_EXPORT_STATUS', payload: s }), [])
  const setShowMinimap = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_MINIMAP', payload: v }), [])
  const setPathAnimation = useCallback((p: GraphState['pathAnimation']) => dispatch({ type: 'SET_PATH_ANIMATION', payload: p }), [])

  const setShowCentralityPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_CENTRALITY_PANEL', payload: v }), [])
  const setSortBy = useCallback((s: 'degree' | 'label' | 'type') => dispatch({ type: 'SET_SORT_BY', payload: s }), [])
  const setPinnedNodes = useCallback((s: Set<string>) => dispatch({ type: 'SET_PINNED_NODES', payload: s }), [])
  const setShowPinnedPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_PINNED_PANEL', payload: v }), [])
  const setAnnotationsAdd = useCallback((a: Omit<AnnotationEntry, 'id'>) => dispatch({ type: 'ADD_ANNOTATION_ENTRY', payload: a }), [])
  const setAnnotationsRemove = useCallback((id: string) => dispatch({ type: 'REMOVE_ANNOTATION_ENTRY', payload: id }), [])
  const clearAllAnnotations = useCallback(() => dispatch({ type: 'CLEAR_ALL_ANNOTATIONS' }), [])
  const setIsAddingAnnotation = useCallback((v: boolean) => dispatch({ type: 'SET_IS_ADDING_ANNOTATION', payload: v }), [])

  const setActiveTheme = useCallback((t: ThemeConfig) => dispatch({ type: 'SET_THEME', payload: t }), [])
  const setShowThemePanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_THEME_PANEL', payload: v }), [])
  const setAnimationPreset = useCallback((p: AnimationPreset) => dispatch({ type: 'SET_ANIMATION_PRESET', payload: p }), [])
  const setShowLayoutMenu = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_LAYOUT_MENU', payload: v }), [])
  const setLocalLayout = useCallback((l: LayoutType) => dispatch({ type: 'SET_LAYOUT', payload: l }), [])

  const setAiInsights = useCallback((i: AIInsight[]) => dispatch({ type: 'SET_AI_INSIGHTS', payload: i }), [])
  const setShowAIPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_AI_PANEL', payload: v }), [])
  const setSmartPathResult = useCallback((r: SmartPathResult | null) => dispatch({ type: 'SET_SMART_PATH_RESULT', payload: r }), [])
  const setShowPathPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_PATH_PANEL', payload: v }), [])
  const setPathSourceId = useCallback((id: string) => dispatch({ type: 'SET_PATH_SOURCE_ID', payload: id }), [])
  const setPathTargetId = useCallback((id: string) => dispatch({ type: 'SET_PATH_TARGET_ID', payload: id }), [])
  const setNodeAIAnalysis = useCallback((a: NodeAIAnalysis | null) => dispatch({ type: 'SET_NODE_AI_ANALYSIS', payload: a }), [])
  const appendGraphSnapshot = useCallback((s: { id: string; timestamp: number; label: string; nodeCount: number }) => dispatch({ type: 'APPEND_GRAPH_SNAPSHOT', payload: s }), [])
  const setIsGeneratingInsight = useCallback((v: boolean) => dispatch({ type: 'SET_GENERATING_INSIGHT', payload: v }), [])

  const setExternalDataCache = useCallback((m: Map<string, ExternalData>) => dispatch({ type: 'SET_EXTERNAL_DATA_CACHE', payload: m }), [])
  const setShowExternalPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_EXTERNAL_PANEL', payload: v }), [])
  const setExternalLoadingId = useCallback((id: string | null) => dispatch({ type: 'SET_EXTERNAL_LOADING_ID', payload: id }), [])
  const setImportStatePartial = useCallback((fn: Partial<ImportState>) => dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: fn }), [])
  const setShowImportDialog = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_IMPORT_DIALOG', payload: v }), [])
  const setShowCompareMode = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_COMPARE_MODE', payload: v }), [])
  const setCompareResult = useCallback((r: GraphComparison | null) => dispatch({ type: 'SET_COMPARE_RESULT', payload: r }), [])
  const setSyncStatus = useCallback((s: GraphState['syncStatus']) => dispatch({ type: 'SET_SYNC_STATUS', payload: s }), [])
  const setLastSyncTime = useCallback((d: Date) => dispatch({ type: 'SET_LAST_SYNC_TIME', payload: d }), [])
  const setDragOver = useCallback((v: boolean) => dispatch({ type: 'SET_DRAG_OVER', payload: v }), [])

  const setShareLink = useCallback((l: ShareLink | null) => dispatch({ type: 'SET_SHARE_LINK', payload: l }), [])
  const setShowSharePanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_SHARE_PANEL', payload: v }), [])
  const setNodeAnnotationsMap = useCallback((m: Map<string, NodeAnnotation[]>) => dispatch({ type: 'SET_NODE_ANNOTATIONS_MAP', payload: m }), [])
  const setShowAnnotationPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_ANNOTATION_PANEL', payload: v }), [])
  const setNewAnnotationText = useCallback((t: string) => dispatch({ type: 'SET_NEW_ANNOTATION_TEXT', payload: t }), [])
  const addHistoryEntry = useCallback((type: HistoryEntry['type'], description: string, detail?: Record<string, unknown>) =>
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type, description, detail } }), [])
  const undoHistory = useCallback(() => dispatch({ type: 'UNDO_HISTORY' }), [])
  const redoHistory = useCallback(() => dispatch({ type: 'REDO_HISTORY' }), [])
  const setShowHistoryPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_HISTORY_PANEL', payload: v }), [])
  const appendBookmark = useCallback((b: GraphBookmark) => dispatch({ type: 'APPEND_BOOKMARK', payload: b }), [])
  const removeBookmark = useCallback((id: string) => dispatch({ type: 'REMOVE_BOOKMARK_ENTRY', payload: id }), [])
  const setShowBookmarkPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_BOOKMARK_PANEL', payload: v }), [])
  const setReportConfigPartial = useCallback((fn: Partial<ReportConfig>) => dispatch({ type: 'SET_REPORT_CONFIG_PARTIAL', payload: fn }), [])
  const setShowReportDialog = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_REPORT_DIALOG', payload: v }), [])
  const setReportGenerating = useCallback((v: boolean) => dispatch({ type: 'SET_REPORT_GENERATING', payload: v }), [])

  const setGraphStats = useCallback((s: GraphStatistics | null) => dispatch({ type: 'SET_GRAPH_STATS', payload: s }), [])
  const setShowStatsPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_STATS_PANEL', payload: v }), [])
  const setCommunityResult = useCallback((r: CommunityResult | null) => dispatch({ type: 'SET_COMMUNITY_RESULT', payload: r }), [])
  const setKcoreResult = useCallback((r: KCoreResult | null) => dispatch({ type: 'SET_KCORE_RESULT', payload: r }), [])
  const setCentralityMetrics = useCallback((m: CentralityMetrics | null) => dispatch({ type: 'SET_CENTRALITY_METRICS', payload: m }), [])
  const setCentralityMode = useCallback((m: 'pageRank' | 'betweenness' | 'closeness' | 'degree') => dispatch({ type: 'SET_CENTRALITY_MODE', payload: m }), [])
  const appendSavedSubGraph = useCallback((g: SubGraphResult) => dispatch({ type: 'APPEND_SAVED_SUBGRAPH', payload: g }), [])
  const setActiveSubGraph = useCallback((s: SubGraphResult | null) => dispatch({ type: 'SET_ACTIVE_SUBGRAPH', payload: s }), [])
  const setShowSubGraphPanel = useCallback((v: boolean) => dispatch({ type: 'SET_SHOW_SUBGRAPH_PANEL', payload: v }), [])
  const appendAIQARecord = useCallback((r: AIQARecord) => dispatch({ type: 'APPEND_AI_QA_RECORD', payload: r }), [])
  const setAiQuestion = useCallback((q: string) => dispatch({ type: 'SET_AI_QUESTION', payload: q }), [])
  const setAiAnswering = useCallback((v: boolean) => dispatch({ type: 'SET_AI_ANSWERING', payload: v }), [])

  // ═══════════════════════════════════════════════════════════
  // 派生数据计算（恢复自 4d9b782^ 的原实现，重构时曾丢失）
  // ═══════════════════════════════════════════════════════════

  const onNodeClickRef = options.onNodeClick
  const optsRef = { onNodeClick: onNodeClickRef, dispatch }

  /** 按 activeFilter 过滤节点与边（原 KnowledgeGraph.tsx 第 784-791 行） */
  const filteredData = useMemo(() => {
    const fn = state.activeFilter ? nodes.filter((n) => n.type === state.activeFilter) : nodes
    const fIds = new Set(fn.map((n) => n.id || n.label))
    const fe = edges.filter(
      (e) =>
        fIds.has(e.source as string) &&
        fIds.has(e.target as string),
    )
    return { filteredNodes: fn, filteredEdges: fe }
  }, [nodes, edges, state.activeFilter])

  /** 大规模图渲染护栏：节点数超过上限时按度数降序截取，避免 SVG 冻结 */
  const renderableData = useMemo(() => {
    if (filteredData.filteredNodes.length <= MAX_RENDER_NODES) return filteredData
    const counts = new Map<string, number>()
    for (const e of filteredData.filteredEdges) {
      counts.set(e.source as string, (counts.get(e.source as string) || 0) + 1)
      counts.set(e.target as string, (counts.get(e.target as string) || 0) + 1)
    }
    const sorted = [...filteredData.filteredNodes].sort(
      (a, b) =>
        (counts.get(b.id || b.label) || 0) - (counts.get(a.id || a.label) || 0),
    )
    const keep = new Set(
      sorted.slice(0, MAX_RENDER_NODES).map((n) => n.id || n.label),
    )
    return {
      filteredNodes: sorted.slice(0, MAX_RENDER_NODES),
      filteredEdges: filteredData.filteredEdges.filter(
        (e) =>
          keep.has(e.source as string) &&
          keep.has(e.target as string),
      ),
    }
  }, [filteredData])

  /** LOD 分级：节点数硬上限 + 缩放比例自适应（原第 795-799 行扩展） */
  const lodLevel = useMemo<'minimal' | 'reduced' | 'full'>(() => {
    const count = renderableData.filteredNodes.length
    const zoom = state.zoomTransform?.k ?? 1
    if (count > LOD_REDUCED_MAX) {
      return zoom < 0.4 ? 'minimal' : 'reduced'
    }
    if (zoom < 0.25) return 'minimal'
    if (zoom < 0.5 || count > LOD_FULL_MAX) return 'reduced'
    return 'full'
  }, [renderableData.filteredNodes.length, state.zoomTransform])

  /** 数据变更检测（原第 802-815 行）—— 引擎 renderFull 的唯一触发条件 */
  const dataChanged = useMemo(() => {
    const currentIds = renderableData.filteredNodes
      .map((n) => n.id || n.label)
      .sort()
      .join(',')
    const changed =
      prevDataRef.current.nodeCount !== renderableData.filteredNodes.length ||
      prevDataRef.current.edgeCount !== renderableData.filteredEdges.length ||
      prevDataRef.current.nodeIds !== currentIds
    if (changed) {
      prevDataRef.current = {
        nodeCount: renderableData.filteredNodes.length,
        edgeCount: renderableData.filteredEdges.length,
        nodeIds: currentIds,
      }
    }
    return changed
  }, [renderableData, prevDataRef])

  /** 度数统计 */
  const degreeStats = useMemo(() => {
    const degreeMap = new Map<string, number>()
    for (const e of renderableData.filteredEdges) {
      const s = e.source as string
      const t = e.target as string
      degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
      degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
    }
    let maxDegree = 0
    for (const n of renderableData.filteredNodes) {
      const d = degreeMap.get(n.id || n.label) || 0
      if (d > maxDegree) maxDegree = d
    }
    return { degreeMap, maxDegree }
  }, [renderableData])

  /** 节点类型列表（按 TYPE_ORDER 排序） */
  const allTypes = useMemo(() => {
    const present = new Set<string>(renderableData.filteredNodes.map((n) => n.type))
    const ordered = (TYPE_ORDER as readonly string[]).filter((t) => present.has(t))
    for (const t of [...present]) if (!ordered.includes(t)) ordered.push(t)
    return ordered
  }, [renderableData])

  /** 各类型节点计数 */
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of renderableData.filteredNodes) m[n.type] = (m[n.type] || 0) + 1
    return m
  }, [renderableData])

  /** 选中节点的连接信息 */
  const nodeConnections = useMemo(() => {
    const id = state.selectedNode?.id || state.selectedNode?.label
    if (!id) return { incoming: [] as GraphEdge[], outgoing: [] as GraphEdge[], neighbors: [] as GraphNode[], totalConnections: 0 }
    const outgoing = renderableData.filteredEdges.filter((e) => (e.source as string) === id)
    const incoming = renderableData.filteredEdges.filter((e) => (e.target as string) === id)
    const nbIds = new Set<string>()
    for (const e of outgoing) nbIds.add(e.target as string)
    for (const e of incoming) nbIds.add(e.source as string)
    nbIds.delete(id)
    const neighbors = renderableData.filteredNodes.filter((n) => nbIds.has(n.id || n.label))
    return { incoming, outgoing, neighbors, totalConnections: incoming.length + outgoing.length }
  }, [renderableData, state.selectedNode])

  /** 搜索匹配（前缀 > 包含 > id 包含，降序） */
  const searchMatches = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase()
    if (!q) return []
    const matches: { node: GraphNode; score: number; matchFields: string[] }[] = []
    for (const n of renderableData.filteredNodes) {
      const label = (n.label || '').toLowerCase()
      const idStr = (n.id || '').toLowerCase()
      let score = 0
      const fields: string[] = []
      if (label === q) { score = 100; fields.push('label') }
      else if (label.startsWith(q)) { score = 80; fields.push('label') }
      else if (label.includes(q)) { score = 60; fields.push('label') }
      else if (idStr.includes(q)) { score = 30; fields.push('id') }
      if (score > 0) matches.push({ node: n, score, matchFields: fields })
    }
    return matches.sort((a, b) => b.score - a.score)
  }, [renderableData, state.searchQuery])

  /** 度中心性（本地快速版，供 CentralityPanel 使用） */
  const centralityData = useMemo(() => {
    const nodeCount = renderableData.filteredNodes.length
    if (!nodeCount) return {}
    const topByDegree = renderableData.filteredNodes
      .map((n) => {
        const degree = degreeStats.degreeMap.get(n.id || n.label) || 0
        return { node: n, degree, score: degree }
      })
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 50)
    const edgeCount = renderableData.filteredEdges.length
    return {
      stats: {
        nodeCount,
        edgeCount,
        maxDegree: degreeStats.maxDegree,
        avgDegree: nodeCount ? (2 * edgeCount) / nodeCount : 0,
      },
      topByDegree,
    }
  }, [renderableData, degreeStats])

  const sortedNodeList = useMemo(() => {
    if (!centralityData.topByDegree) return []
    const list = [...(centralityData.topByDegree as { node: GraphNode; degree: number }[])]
    if (state.sortBy === 'label') list.sort((a, b) => (a.node.label || '').localeCompare(b.node.label || '', 'zh-CN'))
    else if (state.sortBy === 'type') list.sort((a, b) => a.node.type.localeCompare(b.node.type))
    return list
  }, [centralityData, state.sortBy])

  // ── 交互回调（恢复真实实现，原为 useCallback(() => {}) 空桩）──

  const handleSearchChange = useCallback(
    (q: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: q })
      if (q.length >= 2) dispatch({ type: 'ADD_SEARCH_HISTORY_ITEM', payload: q })
    },
    [],
  )

  const handleSearchSelect = useCallback(
    (node: GraphNode) => {
      dispatch({ type: 'SELECT_NODE', payload: node })
      dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
      optsRef.onNodeClick?.(node)
    },
    [],
  )

  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] })
  }, [])

  const togglePinNode = useCallback(
    (nodeId: string) => {
      dispatch({ type: 'TOGGLE_PIN', payload: nodeId })
    },
    [],
  )

  const clearAllPins = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_PINS' })
  }, [])

  const applyTheme = useCallback(
    (theme: ThemeConfig) => {
      dispatch({ type: 'SET_THEME', payload: theme })
    },
    [],
  )

  const switchLayoutMode = useCallback(
    (l: LayoutType) => {
      dispatch({ type: 'SET_LAYOUT', payload: l })
    },
    [],
  )

  const switchAnimationPreset = useCallback(
    (p: string) => {
      dispatch({ type: 'SET_ANIMATION_PRESET', payload: p as never })
    },
    [],
  )

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current as SVGSVGElement)
      .transition()
      .duration(250)
      .call(zoomBehaviorRef.current.scaleBy, 1.3)
  }, [svgRef, zoomBehaviorRef])

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current as SVGSVGElement)
      .transition()
      .duration(250)
      .call(zoomBehaviorRef.current.scaleBy, 1 / 1.3)
  }, [svgRef, zoomBehaviorRef])

  const handleFitToCanvas = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current as SVGSVGElement)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
  }, [svgRef, zoomBehaviorRef])

  const handleResetView = useCallback(() => {
    dispatch({ type: 'SELECT_NODE', payload: null })
    dispatch({ type: 'SET_FILTER', payload: null })
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
    dispatch({ type: 'SET_SORT_BY', payload: 'degree' })
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current as SVGSVGElement)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity)
  }, [svgRef, zoomBehaviorRef])

  // ── 真实功能 handlers：从 useGraphHandlers 接线（替代原 42 个空桩）──
  const handlers = useGraphHandlers({
    state,
    dispatch,
    filteredNodes: renderableData.filteredNodes,
    filteredEdges: renderableData.filteredEdges,
    nodes,
    edges,
    onNodeClick: options.onNodeClick,
    highlightPath: state.pathAnimation ? state.pathAnimation.pathNodes : undefined,
    zoomTransform: state.zoomTransform,
    svgRef,
    zoomBehaviorRef,
    detectedComm: state.communities,
    commColors: state.communityColors,
    centralityTop: centralityData?.topByDegree ?? [],
    insig: INSIGHT_TEMPLATES,
    typeConfig: TYPE_CONFIG,
    edgeTypeLabels: EDGE_TYPE_LABELS,
    mockExternalDB: MOCK_EXTERNAL_DB,
    findSmartPathFn: findSmartPath,
    findPathBFSFn: findPathBFS,
    width: 800,
    height: 600,
  })

  // ── Return ─────────────────────────────────────────────────

  return {
    // Core handle
    state,
    dispatch,

    // ── State values ──
    tooltip: state.tooltip,
    activeFilter: state.activeFilter,
    selectedNode: state.selectedNode,
    selectedNodes: state.selectedNodes,
    zoomTransform: state.zoomTransform,
    legendOpen: state.legendOpen,
    detailTab: state.detailTab,
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    searchHistory: state.searchHistory,
    focusedNodeIndex: state.focusedNodeIndex,
    isSelecting: state.isSelecting,
    selectionBox: state.selectionBox,
    contextMenu: state.contextMenu,
    communities: state.communities,
    communityColors: state.communityColors,
    perfStats: state.perfStats,
    showPerfPanel: state.showPerfPanel,
    showExportMenu: state.showExportMenu,
    exportStatus: state.exportStatus,
    showMinimap: state.showMinimap,
    pathAnimation: state.pathAnimation,
    collapsedGroups: state.collapsedGroups,
    showCentralityPanel: state.showCentralityPanel,
    sortBy: state.sortBy,
    pinnedNodes: state.pinnedNodes,
    showPinnedPanel: state.showPinnedPanel,
    annotations: state.annotations,
    isAddingAnnotation: state.isAddingAnnotation,
    activeTheme: state.activeTheme,
    showThemePanel: state.showThemePanel,
    animationPreset: state.animationPreset,
    showLayoutMenu: state.showLayoutMenu,
    localLayout: state.localLayout,
    aiInsights: state.aiInsights,
    showAIPanel: state.showAIPanel,
    smartPathResult: state.smartPathResult,
    showPathPanel: state.showPathPanel,
    pathSourceId: state.pathSourceId,
    pathTargetId: state.pathTargetId,
    nodeAIAnalysis: state.nodeAIAnalysis,
    graphSnapshots: state.graphSnapshots,
    isGeneratingInsight: state.isGeneratingInsight,
    externalDataCache: state.externalDataCache,
    showExternalPanel: state.showExternalPanel,
    externalLoadingId: state.externalLoadingId,
    importState: state.importState,
    showImportDialog: state.showImportDialog,
    showCompareMode: state.showCompareMode,
    compareResult: state.compareResult,
    syncStatus: state.syncStatus,
    lastSyncTime: state.lastSyncTime,
    dragOver: state.dragOver,
    shareLink: state.shareLink,
    showSharePanel: state.showSharePanel,
    nodeAnnotations: state.nodeAnnotations,
    showAnnotationPanel: state.showAnnotationPanel,
    newAnnotationText: state.newAnnotationText,
    historyEntries: state.historyEntries,
    historyIndex: state.historyIndex,
    showHistoryPanel: state.showHistoryPanel,
    bookmarks: state.bookmarks,
    showBookmarkPanel: state.showBookmarkPanel,
    reportConfig: state.reportConfig,
    showReportDialog: state.showReportDialog,
    reportGenerating: state.reportGenerating,
    graphStats: state.graphStats,
    showStatsPanel: state.showStatsPanel,
    communityResult: state.communityResult,
    kcoreResult: state.kcoreResult,
    centralityMetrics: state.centralityMetrics,
    centralityMode: state.centralityMode,
    savedSubGraphs: state.savedSubGraphs,
    activeSubGraph: state.activeSubGraph,
    showSubGraphPanel: state.showSubGraphPanel,
    aiQAHistory: state.aiQAHistory,
    aiQuestion: state.aiQuestion,
    aiAnswering: state.aiAnswering,

    // ── Dispatch setters (mirror original useState setters) ──
    setTooltip,
    setActiveFilter,
    setSelectedNode,
    setSelectedNodes,
    setZoomTransform,
    setLegendOpen,
    setDetailTab,
    setSearchQuery,
    setSearchResults,
    setSearchHistoryItems,
    setSearchHistory: setSearchHistoryItems,
    setFocusedNodeIndex,
    setIsSelecting,
    setSelectionBox,
    setContextMenu,
    setCommunities,
    setCommunityColors,
    setPerfStats,
    setShowPerfPanel,
    setShowExportMenu,
    setExportStatus,
    setShowMinimap,
    setPathAnimation,
    setShowCentralityPanel,
    setSortBy,
    setPinnedNodes,
    setShowPinnedPanel,
    setAnnotationsAdd,
    setAnnotationsRemove,
    clearAllAnnotations,
    setIsAddingAnnotation,
    setActiveTheme,
    setShowThemePanel,
    setAnimationPreset,
    setShowLayoutMenu,
    setLocalLayout,
    setAiInsights,
    setShowAIPanel,
    setSmartPathResult,
    setShowPathPanel,
    setPathSourceId,
    setPathTargetId,
    setNodeAIAnalysis,
    appendGraphSnapshot,
    setIsGeneratingInsight,
    setExternalDataCache,
    setShowExternalPanel,
    setExternalLoadingId,
    setImportStatePartial,
    setShowImportDialog,
    setShowCompareMode,
    setCompareResult,
    setSyncStatus,
    setLastSyncTime,
    setDragOver,
    setShareLink,
    setShowSharePanel,
    setNodeAnnotationsMap,
    setShowAnnotationPanel,
    setNewAnnotationText,
    addHistoryEntry,
    undoHistory,
    redoHistory,
    setShowHistoryPanel,
    appendBookmark,
    removeBookmark,
    setShowBookmarkPanel,
    setReportConfigPartial,
    setShowReportDialog,
    setReportGenerating,
    setGraphStats,
    setShowStatsPanel,
    setCommunityResult,
    setKcoreResult,
    setCentralityMetrics,
    setCentralityMode,
    appendSavedSubGraph,
    setActiveSubGraph,
    setShowSubGraphPanel,
    appendAIQARecord,
    setAiQuestion,
    setAiAnswering,

    // ── Refs (attach to refs in the component) ──
    svgRef: state.svgRef,
    containerRef: state.containerRef,
    zoomBehaviorRef: state.zoomBehaviorRef,
    prevLayoutRef: state.prevLayoutRef,
    prevDataRef: state.prevDataRef,
    perfFrameTimesRef: state.perfFrameTimesRef,
    lastFrameTimeRef: state.lastFrameTimeRef,
    perfRafIdRef: state.perfRafIdRef,
    engineRef: state.engineRef,

    // ── Toggle helpers (for boolean state that was previously toggled via setState(prev => !prev)) ──
    toggleLegend: useCallback(() => dispatch({ type: 'SET_LEGEND_OPEN', payload: !state.legendOpen }), [state.legendOpen]),
    togglePerfPanel: useCallback(() => dispatch({ type: 'SET_SHOW_PERF_PANEL', payload: !state.showPerfPanel }), [state.showPerfPanel]),
    toggleExportMenu: useCallback(() => dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: !state.showExportMenu }), [state.showExportMenu]),
    toggleMinimap: useCallback(() => dispatch({ type: 'SET_SHOW_MINIMAP', payload: !state.showMinimap }), [state.showMinimap]),
    togglePinnedPanel: useCallback(() => dispatch({ type: 'SET_SHOW_PINNED_PANEL', payload: !state.showPinnedPanel }), [state.showPinnedPanel]),
    toggleThemePanel: useCallback(() => dispatch({ type: 'SET_SHOW_THEME_PANEL', payload: !state.showThemePanel }), [state.showThemePanel]),
    toggleLayoutMenu: useCallback(() => dispatch({ type: 'SET_SHOW_LAYOUT_MENU', payload: !state.showLayoutMenu }), [state.showLayoutMenu]),
    toggleAIPanel: useCallback(() => dispatch({ type: 'SET_SHOW_AI_PANEL', payload: !state.showAIPanel }), [state.showAIPanel]),
    togglePathPanel: useCallback(() => dispatch({ type: 'SET_SHOW_PATH_PANEL', payload: !state.showPathPanel }), [state.showPathPanel]),
    toggleExternalPanel: useCallback(() => dispatch({ type: 'SET_SHOW_EXTERNAL_PANEL', payload: !state.showExternalPanel }), [state.showExternalPanel]),
    toggleImportDialog: useCallback(() => dispatch({ type: 'SET_SHOW_IMPORT_DIALOG', payload: !state.showImportDialog }), [state.showImportDialog]),
    toggleCompareMode: useCallback(() => dispatch({ type: 'SET_SHOW_COMPARE_MODE', payload: !state.showCompareMode }), [state.showCompareMode]),
    toggleSharePanel: useCallback(() => dispatch({ type: 'SET_SHOW_SHARE_PANEL', payload: !state.showSharePanel }), [state.showSharePanel]),
    toggleAnnotationPanel: useCallback(() => dispatch({ type: 'SET_SHOW_ANNOTATION_PANEL', payload: !state.showAnnotationPanel }), [state.showAnnotationPanel]),
    toggleHistoryPanel: useCallback(() => dispatch({ type: 'SET_SHOW_HISTORY_PANEL', payload: !state.showHistoryPanel }), [state.showHistoryPanel]),
    toggleBookmarkPanel: useCallback(() => dispatch({ type: 'SET_SHOW_BOOKMARK_PANEL', payload: !state.showBookmarkPanel }), [state.showBookmarkPanel]),
    toggleReportDialog: useCallback(() => dispatch({ type: 'SET_SHOW_REPORT_DIALOG', payload: !state.showReportDialog }), [state.showReportDialog]),
    toggleStatsPanel: useCallback(() => dispatch({ type: 'SET_SHOW_STATS_PANEL', payload: !state.showStatsPanel }), [state.showStatsPanel]),
    toggleCentralityPanel: useCallback(() => dispatch({ type: 'SET_SHOW_CENTRALITY_PANEL', payload: !state.showCentralityPanel }), [state.showCentralityPanel]),
    toggleSubGraphPanel: useCallback(() => dispatch({ type: 'SET_SHOW_SUBGRAPH_PANEL', payload: !state.showSubGraphPanel }), [state.showSubGraphPanel]),
    toggleAddingAnnotation: useCallback(() => dispatch({ type: 'SET_IS_ADDING_ANNOTATION', payload: !state.isAddingAnnotation }), [state.isAddingAnnotation]),
    toggleGroupCollapse: useCallback((type: string) => dispatch({ type: 'TOGGLE_GROUP_COLLAPSE', payload: type }), []),

    // ── Add missing handlers (no-op stubs for KnowledgeGraph compatibility) ──
    addAnnotation: handlers.addAnnotation,
    removeAnnotation: handlers.removeAnnotation,
    clearSearch,
    handleSearchChange,
    handleSearchSelect,
    togglePinNode,
    clearAllPins,
    batchOperationOnSelected: handlers.batchOperationOnSelected,
    applyTheme,
    switchLayoutMode,
    switchAnimationPreset,
    generateAIInsights: handlers.generateAIInsights,
    generateNodeAnalysis: handlers.generateNodeAnalysis,
    runSmartPathSearch: handlers.runSmartPathSearch,
    takeSnapshot: handlers.takeSnapshot,
    queryExternalData: handlers.queryExternalData,
    handleFileImport: handlers.handleFileImport,
    runGraphComparison: handlers.runGraphComparison,
    triggerAutoSync: handlers.triggerAutoSync,
    handleDragOver: handlers.handleDragOver,
    handleDragLeave: handlers.handleDragLeave,
    handleDrop: handlers.handleDrop,
    generateShareLink: handlers.generateShareLink,
    copyShareLink: handlers.copyShareLink,
    addNodeAnnotation: handlers.addNodeAnnotation,
    // 真实实现：把当前视图快照成书签。原为 useCallback(() => {}, []) 空桩，
    // 与上方第 993 行已正确实现的 appendBookmark 重名但被覆盖，导致"保存书签"
    // 按钮点击后无任何效果。
    addBookmark: useCallback((name: string) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return
      const zt = state.zoomTransform
      appendBookmark({
        id: `bm_${Date.now()}`,
        name: trimmed,
        icon: '⭐',
        createdAt: new Date(),
        snapshot: {
          selectedNode: state.selectedNode?.label,
          highlightPath: state.pathAnimation ? state.pathAnimation.pathNodes : undefined,
          filterTypes: state.activeFilter ? [state.activeFilter] : [],
          searchQuery: state.searchQuery,
          layoutType: state.localLayout,
          zoomLevel: zt ? zt.k : 1,
          panOffset: zt ? { x: zt.x, y: zt.y } : { x: 0, y: 0 },
        },
      })
    }, [state, appendBookmark]),
    // 真实实现：还原书签快照到当前视图
    loadBookmark: useCallback((bm: GraphBookmark) => {
      dispatch({ type: 'SET_FILTER', payload: bm.snapshot.filterTypes[0] ?? null })
      dispatch({ type: 'SET_SEARCH_QUERY', payload: bm.snapshot.searchQuery || '' })
      dispatch({ type: 'SET_LAYOUT', payload: bm.snapshot.layoutType as LayoutType })
      dispatch({
        type: 'SET_ZOOM_TRANSFORM',
        payload: d3.zoomIdentity.translate(bm.snapshot.panOffset?.x ?? 0, bm.snapshot.panOffset?.y ?? 0).scale(bm.snapshot.zoomLevel || 1),
      })
      dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'zoom', description: `载入书签：${bm.name}` } })
    }, []),
    generateReport: handlers.generateReport,
    computeGraphStatistics: handlers.computeGraphStatistics,
    computePageRank: handlers.computePageRank,
    computeBetweenness: handlers.computeBetweenness,
    computeCloseness: handlers.computeCloseness,
    // 真实实现：对当前筛选视图计算全部中心性指标并写入 state。
    // 原为空桩 useCallback(() => {}, [])，centralityMetrics 因此恒为 null，
    // CentralityMetricsPanel 的 `if (!showCentralityPanel || !centralityMetrics) return null`
    // 使其永不渲染——整个中心性面板功能完全不可用。
    runCentralityAnalysis: useCallback(() => {
      if (!renderableData.filteredNodes.length) return
      dispatch({
        type: 'SET_CENTRALITY_METRICS',
        payload: computeCentralityMetrics(renderableData.filteredNodes, renderableData.filteredEdges),
      })
    }, [renderableData]),
    detectCommunitiesLouvain: handlers.detectCommunitiesLouvain,
    computeKCore: handlers.computeKCore,
    extractEgoNetwork: handlers.extractEgoNetwork,
    handleAIQuestion: handlers.handleAIQuestion,
    handleSelectionComplete: handlers.handleSelectionComplete,
    handleContextAction: handlers.handleContextAction,
    exportSubgraphJSON: handlers.exportSubgraphJSON,
    findPathBFS: handlers.findPathBFSLocal,
    startPathAnimation: handlers.startPathAnimation,
    handleZoomIn,
    handleZoomOut,
    handleFitToCanvas,
    handleResetView,

    // ── Add missing setters ──
    setCollapsedGroups: useCallback((g: Set<string>) => dispatch({ type: 'SET_COLLAPSED_GROUPS', payload: g }), []),
    setAnnotations: useCallback((a: AnnotationEntry[]) => dispatch({ type: 'SET_ANNOTATIONS', payload: a }), []),
    setGraphSnapshots: useCallback((s: Array<{ id: string; timestamp: number; label: string; nodeCount: number }>) => dispatch({ type: 'SET_GRAPH_SNAPSHOTS', payload: s }), []),
    setImportState: useCallback((s: ImportState) => dispatch({ type: 'SET_IMPORT_STATE', payload: s }), []),
    setNodeAnnotations: useCallback((m: Map<string, NodeAnnotation[]>) => dispatch({ type: 'SET_NODE_ANNOTATIONS', payload: m }), []),
    setHistoryEntries: useCallback((h: HistoryEntry[]) => dispatch({ type: 'SET_HISTORY_ENTRIES', payload: h }), []),
    setHistoryIndex: useCallback((i: number) => dispatch({ type: 'SET_HISTORY_INDEX', payload: i }), []),
    setBookmarks: useCallback((b: GraphBookmark[]) => dispatch({ type: 'SET_BOOKMARKS', payload: b }), []),
    setReportConfig: useCallback((c: Partial<ReportConfig>) => dispatch({ type: 'SET_REPORT_CONFIG_PARTIAL', payload: c }), []),
    setSavedSubGraphs: useCallback((s: SubGraphResult[]) => dispatch({ type: 'SET_SAVED_SUBGRAPHS', payload: s }), []),
    setAiQAHistory: useCallback((h: AIQARecord[]) => dispatch({ type: 'SET_AI_QA_HISTORY', payload: h }), []),
    // ── Derived properties（真实计算，来自本 hook 上方的 useMemo）──
    filteredData: renderableData,
    lodLevel,
    dataChanged,
    detectedCommunities: state.communities,
    generatedCommunityColors: state.communityColors,
    centralityData,
    sortedNodeList,
    degreeStats,
    allTypes,
    typeCounts,
    nodeConnections,
    searchMatches,
    maxDegree: degreeStats.maxDegree,
  }
}
