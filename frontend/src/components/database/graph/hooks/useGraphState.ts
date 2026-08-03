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

import { useCallback, useReducer } from 'react'
import type { Reducer } from 'react'
import * as d3 from 'd3'
import type { LayoutType, ThemeConfig, GraphNode } from '../types'
import type { SmartPathResult } from '../analytics'
import type { GraphEngine } from '../engine/forceSimulation'

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

    default:
      // TypeScript exhaustive check — add `: never` below if we miss a case
      const _: never = action
      return _ satisfies never
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
      accentColor: '#007AFF',
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

export function useGraphState(initialLayout: LayoutType = 'force') {
  const [state, dispatch] = useReducer(graphReducer, createInitialState(initialLayout))

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

  const setCollapsedGroupsSet = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    // Toggle by individual type key only (matches original toggleGroupCollapse)
  }, [])
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
  }
}
