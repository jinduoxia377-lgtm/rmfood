/**
 * GraphPanelLayout — comprehensive JSX delegation layer.
 *
 * This component takes all state/callbacks from useGraphState/useGraphHandlers
 * and delegates each sub-panel to its corresponding extracted component.
 *
 * Total panel count: 41 components in graph/components/
 */

import { useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { cn } from '@/lib/utils'
import { Activity, BarChart3, MapPin } from 'lucide-react'
import { GraphEngine } from '../engine/forceSimulation'
import type {
  GraphNode, GraphEdge, LayoutType, ThemeConfig, LODLevel, AnimationPreset,
} from '../types'
import { TYPE_CONFIG } from '../types'
import type { SortByOption } from './CentralityPanel'
import type { GraphCompareResult } from './ComparisonPanel'
import type {
  GraphBookmark, ReportConfig as ReportConfigT, CommunityResult as CommunityResultT,
  KCoreResult as KCoreResultT, AIInsight as AIInsightT,
  SmartPathResultV80, NodeAIAnalysisData, GraphStatistics, SubGraphResult, HistoryEntry,
  CentralityMode,
} from './types'

// ── Component default imports ──
import ZoomToolbar from './ZoomToolbar'
import SearchBar from './SearchBar'
import PerformancePanel from './PerformancePanel'
import ContextMenu from './ContextMenu'
import SelectionBar from './SelectionBar'
import CommunityLegend from './CommunityLegend'
import CentralityPanel from './CentralityPanel'
import CentralityMetricsPanel from './CentralityMetricsPanel'
import DetailPanel from './DetailPanel'
import BatchOperationBar from './BatchOperationBar'
import PinnedNodesPanel from './PinnedNodesPanel'
import AnnotationRenderer from './AnnotationRenderer'
import ExternalDataPanel from './ExternalDataPanel'
import ImportDialog from './ImportDialog'
import ComparisonPanel from './ComparisonPanel'
import SharePanel from './SharePanel'
import AnnotationPanel from './AnnotationPanel'
import HistoryPanel from './HistoryPanel'
import BookmarkPanel from './BookmarkPanel'
import ReportDialog from './ReportDialog'
import StatisticsDashboard from './StatisticsDashboard'
import SubGraphBrowser from './SubGraphBrowser'
import AIPanel from './AIPanel'
import NodeAIAnalysis from './NodeAIAnalysis'
import AIInsightsPanel from './AIInsightsPanel'
import SPathToolbar from './SPathToolbar'
import GraphSnapshots from './GraphSnapshots'
import FilterEmptyState from './FilterEmptyState'
import DataEmptyState from './DataEmptyState'
import GraphSkeleton from './GraphSkeleton'
import MinimapCanvas from './MinimapCanvas'
import LayoutIndicator from './LayoutIndicator'
import ThemePanel from './ThemePanel'
import AnimationPresetsControls from './AnimationPresetsControls'
import ExportStatusBar from './ExportStatusBar'
import ExportMenu from './ExportMenu'
import SearchOverlay from './SearchOverlay'
import SearchHistoryPanel from './SearchHistoryPanel'
import AnnotationControls from './AnnotationControls'
import LegendPanel from './LegendPanel'
import Tooltip from './Tooltip'
// 真实类型从 useGraphState 导入。此前这里有一批「ad-hoc 桩类型」用来糊住编译器，
// 其中 ShareLink 桩被写成 { url, shortcode, views }，与真实 { url, shortCode, viewCount }
// 字段名都不符，导致 <SharePanel shareLink> 长期类型不匹配（且语义上是错的）。
import type { ShareLink, ImportState, NodeAnnotation, ExternalData } from '../hooks/useGraphState'

// ── 无对应真实类型的局部定义 ──
type ExportFormat = 'json' | 'svg' | 'gexf'

export interface GraphPanelLayoutProps {
  // Core props from KnowledgeGraph
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  className?: string
  onNodeClick?: (node: GraphNode) => void

  // State from useGraphState hook
  state: any
  dispatch: any

  // Derived data
  filteredData: { filteredNodes: GraphNode[]; filteredEdges: GraphEdge[] }
  lodLevel: LODLevel
  dataChanged: boolean
  detectedCommunities: Map<string, number>
  generatedCommunityColors: Record<number, string>
  centralityData: any
  sortedNodeList: any[]
  degreeStats: { degreeMap: Map<string, number>; maxDegree: number }
  allTypes: string[]
  typeCounts: Record<string, number>
  nodeConnections: any
  searchMatches: Array<{ node: GraphNode; score: number }>
  maxDegree: number

  // Refs
  svgRef: React.RefObject<SVGSVGElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  zoomBehaviorRef: React.RefObject<any | null>

  // Engine ref
  engineRef: React.RefObject<any | null>

  // Helpers from handlers
  handleSearchChange: (value: string) => void
  handleSearchSelect: (node: GraphNode) => void
  clearSearch: () => void
  toggleGroupCollapse: (type: string) => void
  togglePinNode: (nodeId: string) => void
  clearAllPins: () => void
  batchOperationOnSelected: (action: 'hide' | 'highlight' | 'focus' | 'export') => void
  addAnnotation: (x: number, y: number, text: string, type?: 'note' | 'arrow', targetId?: string) => void
  removeAnnotation: (id: string) => void
  clearAllAnnotations: () => void
  applyTheme: (theme: ThemeConfig) => void
  switchLayoutMode: (layout: LayoutType) => void
  switchAnimationPreset: (preset: string) => void
  generateAIInsights: () => void
  takeSnapshot: () => void
  runSmartPathSearch: (sourceId: string, targetId: string) => void
  queryExternalData: (label: string) => void
  handleFileImport: (file: File) => void
  runGraphComparison: (nodes: GraphNode[], edges: GraphEdge[]) => void
  triggerAutoSync: () => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  generateShareLink: () => void
  copyShareLink: () => void
  addNodeAnnotation: (text: string) => void
  addHistoryEntry: (type: HistoryEntry['type'], description: string, detail?: Record<string, unknown>) => void
  undoHistory: () => void
  redoHistory: () => void
  addBookmark: (name: string, icon?: string) => void
  loadBookmark: (bm: GraphBookmark) => void
  removeBookmark: (id: string) => void
  generateReport: () => void
  computeGraphStatistics: () => void
  detectCommunitiesLouvain: () => void
  computeKCore: () => void
  extractEgoNetwork: (centerNodeId: string, hops?: number) => void
  handleAIQuestion: () => void
  startPathAnimation: (sourceLabel: string, targetLabel: string) => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleFitToCanvas: () => void
  handleResetView: () => void
  handleSelectionComplete: (box: { x1: number; y1: number; x2: number; y2: number }) => void
  handleContextAction: (action: string, node?: GraphNode) => void
  exportSubgraphJSON: (format: ExportFormat) => void

  // Toggle helpers
  setTooltip: (t: any) => void
  tooltip: { x: number; y: number; content: string } | null
  setSelectedNode: (n: GraphNode | null) => void
  setZoomTransform: (z: any) => void
  setActiveFilter: (f: string | null) => void
  setSelectedNodes: (s: Set<string>) => void
  legendOpen: boolean
  toggleLegend: () => void
  setShowExportMenu: (v: boolean) => void
  setExportStatus: (s: string | null) => void

  // Panel toggle helpers
  setShowPerfPanel: (v: boolean) => void
  setShowMinimap: (v: boolean) => void
  setShowImportDialog: (v: boolean) => void
  setShowCompareMode: (v: boolean) => void
  setShowSharePanel: (v: boolean) => void
  setShowAnnotationPanel: (v: boolean) => void
  setShowHistoryPanel: (v: boolean) => void
  setShowBookmarkPanel: (v: boolean) => void
  setShowReportDialog: (v: boolean) => void
  setShowStatsPanel: (v: boolean) => void
  setShowCentralityPanel: (v: boolean) => void
  setShowSubGraphPanel: (v: boolean) => void
  setShowPathPanel: (v: boolean) => void
  setShowExternalPanel: (v: boolean) => void
  setShowAIPanel: (v: boolean) => void
  setShowThemePanel: (v: boolean) => void
  setShowLayoutMenu: (v: boolean) => void
  setShowPinnedPanel: (v: boolean) => void
  setIsAddingAnnotation: (v: boolean) => void
  setIsGeneratingInsight: (v: boolean) => void
  setCentralityMode: (m: CentralityMode) => void
  setAiAnswering: (v: boolean) => void
  setAiQuestion: (q: string) => void
  setNewAnnotationText: (t: string) => void
  setReportConfig: (c: Partial<ReportConfigT>) => void
  setSortBy: (s: SortByOption) => void
  setFocusedNodeIndex: (v: number) => void
  setIsSelecting: (v: boolean) => void
  setSelectionBox: (v: any) => void
  setContextMenu: (v: any) => void
  setSearchHistory: (v: any) => void
  setNodeAIAnalysis: (v: any) => void
  setPathSourceId: (v: string) => void
  setPathTargetId: (v: string) => void
  setDetailTab: (v: 'info' | 'connections' | 'properties') => void
  isLoading?: boolean

  // State values (required by graph engine for rendering)
  activeFilter: string | null
  detailTab: 'info' | 'properties' | 'connections'
  selectedNode: GraphNode | null
  searchQuery: string
  focusedNodeIndex: number
  searchHistory: string[]
  showPerfPanel: boolean
  perfStats: any
  isSelecting: boolean
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null
  selectedNodes: Set<string>
  contextMenu: { x: number; y: number; node?: GraphNode } | null
  communities: Map<string, number>
  communityColors: Record<number, string>
  showExportMenu: boolean
  exportStatus: string | null
  showMinimap: boolean
  pathAnimation: { source: string; target: string; pathNodes: string[]; pathEdges: [string, string][] } | null
  collapsedGroups: Set<string>
  showCentralityPanel: boolean
  sortBy: SortByOption
  pinnedNodes: Set<string>
  showPinnedPanel: boolean
  annotations: Array<{ id: string; x: number; y: number; text: string; type: 'note' | 'arrow'; targetId?: string }>
  isAddingAnnotation: boolean
  activeTheme: ThemeConfig
  showThemePanel: boolean
  animationPreset: AnimationPreset
  showLayoutMenu: boolean
  localLayout: LayoutType
  aiInsights: AIInsightT[]
  showAIPanel: boolean
  smartPathResult: SmartPathResultV80 | null
  showPathPanel: boolean
  pathSourceId: string
  pathTargetId: string
  nodeAIAnalysis: NodeAIAnalysisData | null
  graphSnapshots: Array<{ id: string; timestamp: number; label: string; nodeCount: number }>
  isGeneratingInsight: boolean
  externalDataCache: Map<string, ExternalData>
  showExternalPanel: boolean
  externalLoadingId: string | null
  importState: ImportState
  showImportDialog: boolean
  showCompareMode: boolean
  compareResult: GraphCompareResult | null
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error'
  lastSyncTime: Date
  dragOver: boolean
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
  reportConfig: ReportConfigT
  showReportDialog: boolean
  reportGenerating: boolean
  graphStats: GraphStatistics | null
  showStatsPanel: boolean
  communityResult: CommunityResultT | null
  kcoreResult: KCoreResultT | null
  centralityMetrics: any
  centralityMode: CentralityMode
  runCentralityAnalysis: () => void
  savedSubGraphs: SubGraphResult[]
  activeSubGraph: SubGraphResult | null
  showSubGraphPanel: boolean
  aiQAHistory: Array<{ question: string; answer: string }>
  aiQuestion: string
  aiAnswering: boolean
}

/** Main composition component — renders all panels from extracted graph/components/ */
export default function GraphPanelLayout({
  nodes, width, height, className, onNodeClick,
  state, dispatch,
  filteredData, lodLevel, dataChanged, detectedCommunities, generatedCommunityColors,
  centralityData, nodeConnections, searchMatches,
  allTypes, typeCounts,
  svgRef, containerRef, zoomBehaviorRef, engineRef,
  // Handlers
  handleSearchChange, handleSearchSelect, clearSearch,
  togglePinNode, clearAllPins, batchOperationOnSelected,
  addAnnotation, removeAnnotation, clearAllAnnotations,
  applyTheme, switchLayoutMode, switchAnimationPreset,
  generateAIInsights, runSmartPathSearch, runCentralityAnalysis,
  queryExternalData, handleFileImport, triggerAutoSync,
  handleDragOver, handleDragLeave, handleDrop,
  copyShareLink, addNodeAnnotation,
  undoHistory, redoHistory,
  addBookmark, loadBookmark, removeBookmark,
  generateReport, detectCommunitiesLouvain, computeKCore, handleAIQuestion,
  handleZoomIn, handleZoomOut, handleFitToCanvas, handleResetView,
  handleSelectionComplete, handleContextAction, exportSubgraphJSON,
  // Setters
  setTooltip, setSelectedNode, setZoomTransform, setActiveFilter, setSelectedNodes,
  tooltip, legendOpen, toggleLegend,
  setShowExportMenu,
  setShowPerfPanel, setShowMinimap, setShowImportDialog, setShowCompareMode, setShowSharePanel,
  setShowAnnotationPanel, setShowHistoryPanel, setShowBookmarkPanel, setShowReportDialog,
  setShowStatsPanel, setShowCentralityPanel, setShowSubGraphPanel, setShowPathPanel,
  setShowExternalPanel, setShowAIPanel, setShowThemePanel, setShowLayoutMenu,
  setShowPinnedPanel, setIsAddingAnnotation,
  setCentralityMode, setAiQuestion, setNewAnnotationText, setReportConfig,
  setSortBy,
  // Missing setters
  setFocusedNodeIndex, setIsSelecting, setSelectionBox, setContextMenu,
  setSearchHistory, setNodeAIAnalysis, setPathSourceId, setPathTargetId,
  setDetailTab, isLoading, detailTab,
  // State values
  activeFilter, selectedNode, searchQuery, focusedNodeIndex, searchHistory,
  showPerfPanel, perfStats, isSelecting, selectionBox, selectedNodes, contextMenu,
  communities, showExportMenu, exportStatus,
  showMinimap, pathAnimation, showCentralityPanel, sortBy,
  pinnedNodes, showPinnedPanel, annotations, isAddingAnnotation,
  activeTheme, showThemePanel, animationPreset, showLayoutMenu, localLayout,
  aiInsights, showAIPanel, smartPathResult, showPathPanel, pathSourceId, pathTargetId,
  nodeAIAnalysis, graphSnapshots, isGeneratingInsight,
  externalDataCache, showExternalPanel, externalLoadingId, importState, showImportDialog,
  showCompareMode, compareResult, syncStatus, dragOver,
  shareLink, showSharePanel,
  nodeAnnotations, showAnnotationPanel, newAnnotationText,
  historyEntries, historyIndex, showHistoryPanel,
  bookmarks, showBookmarkPanel,
  reportConfig, showReportDialog, reportGenerating,
  graphStats, showStatsPanel,
  communityResult, kcoreResult, centralityMetrics, centralityMode, savedSubGraphs, activeSubGraph, showSubGraphPanel,
  aiQAHistory, aiQuestion, aiAnswering,
  // Derived
}: GraphPanelLayoutProps) {
  const { zoomTransform } = state

  // ═══════════════════════════════════════════════════════════
  // 引擎实例化 —— 恢复自 4d9b782^（重构时曾丢失，导致整条渲染管线为死代码）
  //
  // 生命周期：
  //   1. 首次挂载 → new GraphEngine + init()（建 defs / zoom / container）
  //   2. 依赖变化 → updateInput() 原地替换输入 + update() 重绘
  //   3. 卸载     → destroy()（停模拟、取消 RAF、摘事件）
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const svgEl = svgRef.current
    const containerEl = containerRef.current
    if (!svgEl || !containerEl) return

    if (!engineRef.current) {
      engineRef.current = new GraphEngine({
        containerRef, svgRef, width, height,
        nodes: filteredData.filteredNodes,
        edges: filteredData.filteredEdges.map((e) => ({ ...e, source: e.source as any, target: e.target as any })),
        theme: activeTheme,
        layout: localLayout,
        lodLevel,
        highlightPath: pathAnimation ? pathAnimation.pathNodes : undefined,
        selectedNodes,
        communities: detectedCommunities,
        generatedCommunityColors,
        pinnedNodes,
        focusedNodeIndex,
        animationPreset,
        dataChanged,
        onNodeClick: (n: any) => {
          setSelectedNode(n)
          onNodeClick?.(n)
        },
        onSetZoomTransform: setZoomTransform,
        onSetTooltip: setTooltip,
        onSetSelectedNode: setSelectedNode,
        onTogglePinNode: togglePinNode,
      } as any)
      engineRef.current.init()
      zoomBehaviorRef.current = engineRef.current.getZoomBehavior?.() ?? null
    } else {
      engineRef.current.updateInput({
        width, height,
        nodes: filteredData.filteredNodes,
        edges: filteredData.filteredEdges.map((e) => ({ ...e, source: e.source as any, target: e.target as any })),
        theme: activeTheme,
        layout: localLayout,
        lodLevel,
        highlightPath: pathAnimation ? pathAnimation.pathNodes : undefined,
        selectedNodes,
        communities: detectedCommunities,
        generatedCommunityColors,
        pinnedNodes,
        focusedNodeIndex,
        animationPreset,
        dataChanged,
      } as any)
    }

    engineRef.current.update()
  }, [
    filteredData, width, height, activeTheme, localLayout, lodLevel,
    selectedNodes, detectedCommunities, generatedCommunityColors, pinnedNodes,
    focusedNodeIndex, dataChanged, pathAnimation,
  ])

  // 卸载时销毁引擎
  useEffect(() => {
    return () => {
      try { engineRef.current?.destroy?.() } catch { /* ignore */ }
      engineRef.current = null
    }
  }, [])

  // 中心性面板打开时立即计算指标。
  // centralityMetrics 首次为 null，CentralityMetricsPanel 的守卫
  // `if (!showCentralityPanel || !centralityMetrics) return null` 会让整个面板
  // 静默不渲染——用户点开关也看不到任何东西。此处打开即算，并随筛选变化刷新。
  useEffect(() => {
    if (showCentralityPanel && !centralityMetrics && filteredData.filteredNodes.length) {
      runCentralityAnalysis()
    }
  }, [showCentralityPanel, centralityMetrics, filteredData.filteredNodes.length, runCentralityAnalysis])

  // 图例数据：由当前可见类型动态生成（挂载 LegendPanel，修复「画布无类型图例」）
  const legendItems = useMemo(
    () =>
      allTypes
        .map((type) => ({
          type,
          color: TYPE_CONFIG[type]?.color || 'var(--color-knowledge-default, #9CA3AF)',
          label: TYPE_CONFIG[type]?.label || type,
          icon: TYPE_CONFIG[type]?.icon || '●',
        }))
        .filter((item) => (typeCounts[item.type] || 0) > 0),
    [allTypes, typeCounts],
  )

  return (
    <div ref={containerRef} className={cn('relative select-none', className)}
      onKeyDown={(e) => {
        if (searchQuery) return
        const visibleNodes = filteredData.filteredNodes
        if (e.key === 'Tab' && !e.shiftKey && focusedNodeIndex < 0) { e.preventDefault(); setFocusedNodeIndex(0) }
        else if (e.key === 'Tab' && !e.shiftKey && focusedNodeIndex >= 0) { e.preventDefault(); setFocusedNodeIndex((visibleNodes.length > 0 ? (focusedNodeIndex + 1) % visibleNodes.length : 0)) }
        else if (e.key === 'Tab' && e.shiftKey && focusedNodeIndex > 0) { e.preventDefault(); setFocusedNodeIndex(focusedNodeIndex - 1) }
        else if (e.key === 'Enter' && focusedNodeIndex >= 0 && visibleNodes[focusedNodeIndex]) { e.preventDefault(); handleSearchSelect(visibleNodes[focusedNodeIndex]) }
        else if ((e.key === 'Escape') && selectedNode) { setSelectedNode(null); setFocusedNodeIndex(-1) }
        else if (e.key === 'P' && e.shiftKey) { e.preventDefault(); setShowPerfPanel(!showPerfPanel) }
        else if (e.key === 'C' && e.shiftKey) { e.preventDefault(); setShowCentralityPanel(!showCentralityPanel) }
        else if (e.key === 'N' && e.shiftKey) { e.preventDefault(); setIsAddingAnnotation(!isAddingAnnotation) }
        else if (e.key === 'T' && e.shiftKey) { e.preventDefault(); setShowThemePanel(!showThemePanel) }
        else if (e.key === 'L' && e.shiftKey) { e.preventDefault(); setShowLayoutMenu(!showLayoutMenu) }
        else if (e.key === 'A' && e.shiftKey) { e.preventDefault(); setShowAIPanel(!showAIPanel) }
        else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !e.shiftKey) { e.preventDefault(); undoHistory() }
        else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && e.shiftKey) { e.preventDefault(); redoHistory() }
      }}
      onPointerDown={(e) => { const { pointerId } = e;
        const target = e.target as HTMLElement | null
        // 修复：此前无条件 setPointerCapture，会把子控件（图例/缩放/搜索/主题等按钮）
        // 的 pointerup/click 重定向到容器，导致图内所有按钮真实点击失效。
        // 仅在选择框模式（Ctrl/Shift/Meta+拖拽）或点击画布空白时捕获指针。
        const isInteractive = !!target?.closest?.('button, input, select, a, textarea, [role="button"], [contenteditable]')
        if ((e.ctrlKey || e.metaKey || e.shiftKey) || !isInteractive) {
          e.currentTarget.setPointerCapture(pointerId)
        }
        if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.button === 0) {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setIsSelecting(true)
          setSelectionBox({ x1: e.clientX - rect.left, y1: e.clientY - rect.top, x2: e.clientX - rect.left, y2: e.clientY - rect.top })
          e.preventDefault()
        }
      }}
      onMouseMove={(e) => {
        if (isSelecting && selectionBox) {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setSelectionBox((prev: any) => prev ? { ...prev, x2: e.clientX - rect.left, y2: e.clientY - rect.top } : null)
        }
      }}
      onMouseUp={() => {
        if (isSelecting && selectionBox) { handleSelectionComplete(selectionBox) }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const target = e.target as SVGElement | HTMLElement
        const nodeGroup = target.closest('.node-group')
        if (nodeGroup) {
          const labelEl = nodeGroup.querySelector('text')
          const typeAttr = nodeGroup.getAttribute('data-type')
          if (labelEl && typeAttr) {
            const label = labelEl.textContent
            const node = nodes.find(n => n.label === label && n.type === typeAttr)
            if (node) setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, node })
          }
        } else {
          setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }
      }}
      onClick={(e) => {
        if (contextMenu) setContextMenu(null)
        if (isAddingAnnotation && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const text = prompt('输入标注内容:', '📝 标注')
          if (text) addAnnotation(e.clientX - rect.left, e.clientY - rect.top, text, 'note')
        }
      }}
      tabIndex={0}
    >
      {/* SVG Canvas — wraps engine ref and provides base layer */}
      {/* 画布背景跟随 activeTheme.canvasBg（academic 为 var(--bg-secondary) 自适应全局主题） */}
      <svg ref={svgRef} className="w-full rounded-xl border border-[var(--border-color)]"
        style={{ minHeight: height, backgroundColor: activeTheme?.canvasBg || 'var(--bg-secondary, transparent)' }}>
        <style>{`
          @keyframes edge-flow { to { stroke-dashoffset: -24; } }
          @keyframes graph-fade-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          .graph-animate-fade-in { animation: graph-fade-in 800ms ease-out both; }
          .hub-glow-ring { animation: hub-pulse 3s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .node-group, .edge-link, .graph-animate-fade-in, .hub-glow-ring {
              animation: none !important;
              transition: none !important;
            }
          }
        `}</style>
      </svg>

      {/* v7.3: Hover Tooltip（修复：此前 Tooltip 已实现但从未挂载） */}
      <Tooltip tooltip={tooltip} />

      {/* v7.5: Performance Monitor Hook (RAF-based, runs independently) */}
      <div className="absolute bottom-3 right-3 z-30 w-6 h-6">
        <button onClick={() => setShowPerfPanel(!showPerfPanel)} title="性能监控 (Shift+P)" aria-label="性能监控">
          <Activity className="w-4 h-4 text-[var(--text-muted)] dark:text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* ── Toolbar & Controls Layer ── */}
      <ZoomToolbar zoomTransform={zoomTransform} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFit={handleFitToCanvas} onReset={handleResetView} />

      {/* v7.3: Search Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-72">
        <SearchBar
          searchQuery={searchQuery}
          searchMatches={searchMatches.map(m => ({ ...m, matchFields: [] }))}
          focusedNodeIndex={focusedNodeIndex}
          searchHistory={searchHistory}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearch}
          onSelectMatch={handleSearchSelect}
          onFocusChange={setFocusedNodeIndex}
        />
      </div>

      {/* v7.4: Box Selection Overlay */}
      {isSelecting && selectionBox && (
        <div className="absolute border-2 border-dashed border-primary-500 bg-primary-100/20 dark:bg-primary-300/20 rounded pointer-events-none z-30"
          style={{ left: Math.min(selectionBox.x1, selectionBox.x2), top: Math.min(selectionBox.y1, selectionBox.y2),
            width: Math.abs(selectionBox.x2 - selectionBox.x1), height: Math.abs(selectionBox.y2 - selectionBox.y1) }} />
      )}

      {/* v7.4: Context Menu */}
      {contextMenu && (
        <ContextMenu contextMenu={contextMenu} selectedNodesCount={selectedNodes.size} communitiesSize={communities.size} onAction={(action, node) => { handleContextAction(action, node); setContextMenu(null) }}
          onClearCommunities={() => dispatch({ type: 'SET_COMMUNITIES', payload: new Map<string, number>() })}
          onDetectCommunities={detectCommunitiesLouvain} onResetView={handleResetView} />
      )}

      {/* v7.5: Performance Monitoring Panel */}
      {showPerfPanel && <PerformancePanel perfStats={perfStats} showPerfPanel={showPerfPanel} lodLevel={lodLevel} dataChanged={dataChanged} filteredNodeCount={filteredData.filteredNodes.length} filteredEdgeCount={filteredData.filteredEdges.length} onToggle={() => setShowPerfPanel(!showPerfPanel)} />}

      {/* v7.6: Export Status Toast */}
      {exportStatus && <ExportStatusBar exportStatus={exportStatus} />}

      {/* v7.6: Path Animation Indicator */}
      {pathAnimation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-45 px-4 py-2 rounded-xl bg-[var(--color-accent-surface-deep)] shadow-lg">
          <span className="text-xs font-medium text-white">{pathAnimation.pathNodes.length} nodes · {pathAnimation.pathEdges.length} edges</span>
        </div>
      )}

      {/* v7.6: Export Menu Dropdown */}
      {showExportMenu && (
        <ExportMenu showExportMenu={showExportMenu} selectedNodesCount={selectedNodes.size} onExportJson={() => exportSubgraphJSON('json')} onExportGexf={() => exportSubgraphJSON('gexf')} onExportSvg={() => exportSubgraphJSON('svg')} onClose={() => setShowExportMenu(false)} />
      )}

      {/* v7.6: Minimap Navigation */}
      {showMinimap && filteredData.filteredNodes.length > 0 && (
        <div className="absolute bottom-3 left-3 z-35 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-sm rounded-lg border border-neutral-200/70 dark:border-neutral-700/50 shadow-md overflow-hidden" style={{ width: 160, height: 110 }}>
          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 dark:border-neutral-700/40">
            <span className="text-[11px] font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">导航图</span>
            <button onClick={() => setShowMinimap(false)} title="关闭小地图"><span className="text-xs">✕</span></button>
          </div>
          <MinimapCanvas nodes={filteredData.filteredNodes} edges={filteredData.filteredEdges} width={158} height={94}
            selectedNode={selectedNode} pathAnimation={pathAnimation} communities={detectedCommunities} communityColors={generatedCommunityColors}
            onNavigate={(x, y, scale) => {
              if (!svgRef.current || !zoomBehaviorRef.current) return
              const svg = d3.select(svgRef.current)
              svg.transition().duration(400).ease(d3.easeCubicOut)
                .call(zoomBehaviorRef.current.transform,
                  d3.zoomIdentity.translate((containerRef.current?.clientWidth || width) / 2, height / 2)
                    .scale(scale).translate(-x * scale, -y * scale))
            }} />
        </div>
      )}

      {/* v7.7: Centrality Panel Trigger + Panel */}
      {!showCentralityPanel && (
        <div className="absolute bottom-14 right-3 z-30 w-6 h-6">
          <button onClick={() => setShowCentralityPanel(true)} title="中心性分析 (Shift+C)" aria-label="中心性分析">
            <BarChart3 className="w-4 h-4 text-[var(--text-muted)] dark:text-[var(--text-secondary)]" />
          </button>
        </div>
      )}
      {showCentralityPanel && centralityData.stats && (
        <CentralityPanel showCentralityPanel={showCentralityPanel} centralityData={centralityData}
          sortBy={sortBy} onSetSortBy={(s) => setSortBy(s)}
          onNodeClick={(n) => { setSelectedNode(n); onNodeClick?.(n) }}
          onClose={() => setShowCentralityPanel(false)} />
      )}

      {/* v7.8: Batch Operation Bar */}
      {selectedNodes.size > 0 && (
        <BatchOperationBar selectedNodesCount={selectedNodes.size} onFocus={() => batchOperationOnSelected('focus')} onHighlight={() => batchOperationOnSelected('highlight')}
          onHide={() => batchOperationOnSelected('hide')} onExport={() => batchOperationOnSelected('export')}
          onClear={() => setSelectedNodes(new Set())} />
      )}

      {/* v7.8: Pinned Nodes Panel */}
      {pinnedNodes.size > 0 && showPinnedPanel && (
        <PinnedNodesPanel pinnedNodes={pinnedNodes} showPinnedPanel={showPinnedPanel} filteredNodes={filteredData.filteredNodes}
          onNodeClick={onNodeClick} onTogglePin={togglePinNode} onClearAllPins={clearAllPins} onClose={() => setShowPinnedPanel(false)} />
      )}

      {/* v7.8: Annotations —— AnnotationRenderer 内部自行 map，此处只渲染一次 */}
      {annotations.length > 0 && (
        <AnnotationRenderer annotations={annotations} onRemoveAnnotation={removeAnnotation} />
      )}

      {/* v7.8: Annotation Controls */}
      {isAddingAnnotation
        ? <AnnotationControls isAddingAnnotation={true} annotationsCount={annotations?.length ?? 0} onClearAllAnnotations={clearAllAnnotations} onToggleAddAnnotation={() => setIsAddingAnnotation(false)} />
        : <AnnotationControls isAddingAnnotation={false} annotationsCount={annotations?.length ?? 0} onClearAllAnnotations={clearAllAnnotations} onToggleAddAnnotation={() => setIsAddingAnnotation(true)} />
      }

      {/* v7.8: Selected Nodes Selection Bar */}
      {selectedNodes.size > 0 && !showPinnedPanel && (
        <SelectionBar selectedNodesCount={selectedNodes.size} onClear={() => setSelectedNodes(new Set())} />
      )}

      {/* v7.9: Community Legend */}
      {communities.size > 0 && (
        <CommunityLegend communities={communities} generatedCommunityColors={generatedCommunityColors} />
      )}

      {/* v7.9: 节点类型图例（挂载 LegendPanel，修复「画布无类型图例」） */}
      <LegendPanel
        showLegend={filteredData.filteredNodes.length > 0}
        legendOpen={legendOpen}
        legendItems={legendItems}
        typeCounts={typeCounts}
        nodeCount={filteredData.filteredNodes.length}
        edgeCount={filteredData.filteredEdges.length}
        onToggle={toggleLegend}
      />

      {/* v7.9: Theme Panel */}
      {showThemePanel && (
        <ThemePanel showThemePanel={showThemePanel} activeTheme={activeTheme} onApplyTheme={applyTheme}
          onClose={() => setShowThemePanel(false)} />
      )}

      {/* v7.9: Layout Indicator */}
      <LayoutIndicator localLayout={localLayout} showLayoutMenu={showLayoutMenu}
        onToggleLayoutMenu={() => setShowLayoutMenu(!showLayoutMenu)} onSwitchLayout={switchLayoutMode} />

      {/* v7.9: Animation Presets Controls */}
      <AnimationPresetsControls animationPreset={animationPreset} onSwitchAnimationPreset={switchAnimationPreset} />

      {/* v8.0: AI Panel + AI Insights */}
      {showAIPanel && (
        <AIPanel showAIPanel={showAIPanel} aiQAHistory={aiQAHistory.map((e, i) => ({ id: String(i), ...e }))} aiQuestion={aiQuestion}
          aiAnswering={aiAnswering} onSetAiQuestion={setAiQuestion} onSendQuestion={handleAIQuestion}
          onClose={() => setShowAIPanel(false)} />
      )}
      {aiInsights.length > 0 && (
        <AIInsightsPanel showAIPanel={showAIPanel} aiInsights={aiInsights} isGeneratingInsight={isGeneratingInsight}
          onRegenerateInsights={generateAIInsights}
          onNodeClick={(n) => { setSelectedNode(n); onNodeClick?.(n) }}
          onSetSelectedNode={setSelectedNode} onSetNodeAIAnalysis={setNodeAIAnalysis}
          onClose={() => setShowAIPanel(false)} />
      )}

      {/* v8.0: Node AI Analysis Panel */}
      {nodeAIAnalysis && (
        <NodeAIAnalysis nodeAIAnalysis={nodeAIAnalysis} selectedNodeLabel={selectedNode?.label}
          onClose={() => setNodeAIAnalysis(null)} />
      )}

      {/* v8.0: Smart Path Toolbar */}
      <SPathToolbar showPathPanel={showPathPanel} smartPathResult={smartPathResult}
        filteredNodes={filteredData.filteredNodes.slice(0, 30)}
        pathSourceId={pathSourceId} pathTargetId={pathTargetId}
        onSetPathSourceId={setPathSourceId} onSetPathTargetId={setPathTargetId}
        onRunSearch={runSmartPathSearch} onClose={() => setShowPathPanel(false)} />

      {/* v8.0: Graph Snapshots Sidebar */}
      {graphSnapshots.length > 0 && (
        <GraphSnapshots graphSnapshots={graphSnapshots} />
      )}

      {/* v8.1: External Data Panel */}
      {showExternalPanel && selectedNode && (
        <ExternalDataPanel showExternalPanel={showExternalPanel} selectedNode={selectedNode}
          /* ExternalDataPanel 未实现 'error' 态，归一为 disconnected 展示 */
          syncStatus={syncStatus === 'error' ? 'disconnected' : syncStatus}
          externalLoadingId={externalLoadingId}
          externalData={externalDataCache.get(selectedNode.label) ?? null}
          onQueryExternalData={() => queryExternalData(selectedNode.label)} onTriggerAutoSync={triggerAutoSync}
          onClose={() => setShowExternalPanel(false)} />
      )}

      {/* v8.1: Import Dialog */}
      {showImportDialog && (
        <ImportDialog showImportDialog={showImportDialog} importState={importState} dragOver={dragOver}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onFileSelect={handleFileImport} onClose={() => setShowImportDialog(false)} />
      )}

      {/* v8.1: Comparison Panel */}
      {showCompareMode && compareResult && (
        <ComparisonPanel showCompareMode={showCompareMode} compareResult={compareResult}
          filteredNodes={filteredData.filteredNodes} onClose={() => setShowCompareMode(false)} />
      )}

      {/* v8.2: Share Panel */}
      {showSharePanel && shareLink && (
        <SharePanel showSharePanel={showSharePanel} shareLink={shareLink} onCopyLink={copyShareLink}
          onClose={() => setShowSharePanel(false)} />
      )}

      {/* v8.2: Annotation Panel */}
      {showAnnotationPanel && selectedNode && (
        <AnnotationPanel showAnnotationPanel={showAnnotationPanel} selectedNodeLabel={selectedNode?.label}
          nodeAnnotations={nodeAnnotations.get(selectedNode?.label || '') || []}
          newAnnotationText={newAnnotationText} onSetNewAnnotationText={setNewAnnotationText} onAddAnnotation={() => addNodeAnnotation(newAnnotationText)}
          onClose={() => setShowAnnotationPanel(false)} />
      )}

      {/* v8.2: History Panel */}
      {showHistoryPanel && (
        <HistoryPanel showHistoryPanel={showHistoryPanel} historyEntries={historyEntries} historyIndex={historyIndex}
          onUndo={undoHistory} onRedo={redoHistory} onClose={() => setShowHistoryPanel(false)} />
      )}

      {/* v8.2: Bookmark Panel */}
      {showBookmarkPanel && (
        <BookmarkPanel showBookmarkPanel={showBookmarkPanel} bookmarks={bookmarks}
          onSaveCurrentView={(name: string) => addBookmark(name)}
          onLoadBookmark={loadBookmark}
          onRemoveBookmark={removeBookmark} onClose={() => setShowBookmarkPanel(false)} />
      )}

      {/* v8.2: Report Dialog */}
      {showReportDialog && (
        <ReportDialog showReportDialog={showReportDialog} reportConfig={reportConfig} reportGenerating={reportGenerating}
          onSetReportConfig={setReportConfig} onGenerateReport={generateReport} onClose={() => setShowReportDialog(false)} />
      )}

      {/* v8.3: Statistics Dashboard */}
      {showStatsPanel && graphStats && (
        <StatisticsDashboard showStatsPanel={showStatsPanel} graphStats={graphStats}
          onClose={() => setShowStatsPanel(false)} />
      )}

      {/* v8.3: Centrality Metrics Panel */}
      {showCentralityPanel && centralityMetrics && (
        <CentralityMetricsPanel showCentralityPanel={showCentralityPanel} centralityMetrics={centralityMetrics}
          centralityMode={centralityMode} filteredNodes={filteredData.filteredNodes}
          onSetCentralityMode={(m) => setCentralityMode(m)}
          onRunCentralityAnalysis={() => runCentralityAnalysis()}
          onNodeClick={(n) => { setSelectedNode(n); onNodeClick?.(n) }} setSelectedNode={setSelectedNode}
          onClose={() => setShowCentralityPanel(false)} />
      )}

      {/* v8.3: SubGraph Browser */}
      {showSubGraphPanel && (communityResult || kcoreResult || savedSubGraphs.length > 0) && (
        <SubGraphBrowser showSubGraphPanel={showSubGraphPanel} communityResult={communityResult} kcoreResult={kcoreResult}
          savedSubGraphs={savedSubGraphs} activeSubGraph={activeSubGraph}
          onComputeKCore={computeKCore}
          onSetSavedSubGraphs={(g) => dispatch({ type: 'APPEND_SAVED_SUBGRAPH', payload: g })}
          onSetActiveSubGraph={(s) => dispatch({ type: 'SET_ACTIVE_SUBGRAPH', payload: s })}
          onClose={() => setShowSubGraphPanel(false)} />
      )}

      {/* v7.2: Detail Panel */}
      {selectedNode && (
        <DetailPanel selectedNode={selectedNode} nodeConnections={nodeConnections ?? { incoming: [], outgoing: [], neighbors: [], totalConnections: 0 }}
          detailTab={detailTab} onSetDetailTab={setDetailTab} setSelectedNode={setSelectedNode} onNodeClick={onNodeClick} />
      )}

      {/* v7.3: Search Results Dropdown & History */}
      {searchQuery && searchMatches.length > 0 && (
        <SearchOverlay searchMatches={searchMatches.map(m => ({ node: m.node, score: m.score, matchFields: [] as string[] }))}
          focusedNodeIndex={focusedNodeIndex} onSelectMatch={handleSearchSelect} onFocusChange={setFocusedNodeIndex}
          totalMatches={searchMatches.length} />
      )}
      {!searchQuery && searchHistory.length > 0 && (
        <SearchHistoryPanel searchHistory={searchHistory} onClearHistory={() => setSearchHistory([])}
          onSelectTerm={(t) => { handleSearchChange(t); setFocusedNodeIndex(0) }} />
      )}

      {/* v7.4: Empty States —— 仅在非加载态展示，避免数据到达前闪现误导性「无匹配节点」 */}
      {!isLoading && filteredData.filteredNodes.length === 0 && nodes.length > 0 && (
        <FilterEmptyState activeFilter={activeFilter} onClearFilter={() => setActiveFilter(null)} />
      )}
      {!isLoading && nodes.length === 0 && (
        <DataEmptyState isLoading={false} />
      )}

      {/* Loading Skeleton */}
      {isLoading && <GraphSkeleton isLoading />}

      {/* v7.4: Right Click Menu (rendered inline since it uses complex event handling) */}
      {contextMenu && (
        <ContextMenu contextMenu={contextMenu} selectedNodesCount={selectedNodes.size} communitiesSize={communities.size} onAction={(action, node) => { handleContextAction(action, node); setContextMenu(null) }}
          onClearCommunities={() => dispatch({ type: 'SET_COMMUNITIES', payload: new Map<string, number>() })}
          onDetectCommunities={detectCommunitiesLouvain} onResetView={handleResetView} />
      )}

      {/* v7.8: Pin trigger button */}
      {pinnedNodes.size > 0 && !showPinnedPanel && (
        <button onClick={() => setShowPinnedPanel(true)} title={`固定节点 (${pinnedNodes.size})`}
          className="absolute top-14 left-3 z-30 w-6 h-6">
          <MapPin className="w-4 h-4 text-[var(--text-muted)] dark:text-[var(--text-secondary)]" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[11px] font-bold text-[var(--text-primary)] dark:text-[var(--text-secondary)]">{pinnedNodes.size}</span>
        </button>
      )}

      {/* v7.8: Adding annotation indicator */}
      {isAddingAnnotation && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-35 px-3 py-1.5 rounded-lg bg-[var(--color-warning-surface)] text-white text-xs animate-pulse">
          ✏️ 点击图谱添加标注 — 按 Esc 取消
        </div>
      )}
    </div>
  )
}

