/**
 * GraphPanelLayout — comprehensive JSX delegation layer.
 *
 * This component takes all state/callbacks from useGraphState/useGraphHandlers
 * and delegates each sub-panel to its corresponding extracted component.
 *
 * Total panel count: 41 components in graph/components/
 */

import * as d3 from 'd3'
import { cn } from '@/lib/utils'
import type {
  GraphNode, GraphEdge, LayoutType, ThemeConfig,
} from '../types'
import { TYPE_CONFIG, EDGE_COLORS } from '../types'
import type { ZoomToolbarProps } from './ZoomToolbar'
import type { SearchBarProps } from './SearchBar'
import type { TooltipProps } from './Tooltip'
import type { PerformancePanelProps } from './PerformancePanel'
import type { ContextMenuProps } from './ContextMenu'
import type { SelectionBarProps } from './SelectionBar'
import type { CommunityLegendProps } from './CommunityLegend'
import type { CentralityPanelProps, SortByOption } from './CentralityPanel'
import type { DetailPanelProps, ConnectionInfo } from './DetailPanel'
import type { BatchOperationBarProps } from './BatchOperationBar'
import type { PinnedNodesPanelProps } from './PinnedNodesPanel'
import type { AnnotationRendererProps } from './AnnotationRenderer'
import type { ExternalDataPanelProps } from './ExternalDataPanel'
import type { ImportDialogProps } from './ImportDialog'
import type { ComparisonPanelProps } from './ComparisonPanel'
import type { SharePanelProps } from './SharePanel'
import type { AnnotationPanelProps } from './AnnotationPanel'
import type { HistoryPanelProps } from './HistoryPanel'
import type { BookmarkPanelProps } from './BookmarkPanel'
import type { ReportDialogProps } from './ReportDialog'
import type { StatisticsDashboardProps } from './StatisticsDashboard'
import type { SubGraphBrowserProps } from './SubGraphBrowser'
import type { AIPanelProps } from './AIPanel'
import type { NodeAIAnalysisProps } from './NodeAIAnalysis'
import type { AIInsightsPanelProps } from './AIInsightsPanel'
import type { SPathToolbarProps } from './SPathToolbar'
import type { GraphSnapshotsProps } from './GraphSnapshots'
import type { FilterEmptyStateProps } from './FilterEmptyState'
import type { DataEmptyStateProps } from './DataEmptyState'
import type { GraphSkeletonProps } from './GraphSkeleton'
import type { MinimapCanvasProps } from './MinimapCanvas'
import type { LegendPanelProps } from './LegendPanel'
import type { LayoutIndicatorProps } from './LayoutIndicator'
import type { ThemePanelProps } from './ThemePanel'
import type { AnimationPresetsControlsProps } from './AnimationPresetsControls'
import type { ExportStatusBarProps } from './ExportStatusBar'
import type { ExportMenuProps } from './ExportMenu'
import type { SearchOverlayProps } from './SearchOverlay'
import type { SearchHistoryPanelProps } from './SearchHistoryPanel'
import type {
  GraphBookmark, ReportConfig as ReportConfigT, CommunityResult as CommunityResultT,
  KCoreResult as KCoreResultT, AIInsight as AIInsightT, LegendItem,
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
import { THEME_PRESETS } from '../types'
// ── Lightweight ad-hoc types for missing component props ──
interface GraphSnapshotT { time: string; nodes: number; edges: number }
interface ExternalDataItem { name: string; source: string }
interface ImportState { progress: number; status: 'idle'|'loading'|'success'|'error'; message?: string }
interface ShareLink { url: string; shortcode: string; views: number }
interface NodeAnnotation { id: string; x: number; y: number; text: string; type: string }
interface ComparisonResult { similarity: number; added: string[]; removed: string[] }
type ExportFormat = 'json' | 'svg' | 'gexf'

// ── Internal graph types for callbacks ──
interface SimNode extends GraphNode {
  x?: number; y?: number; fx?: number | null; fy?: number | null; degree?: number
}
interface SimEdge {
  source: string | SimNode; target: string | SimNode; type: string; strength?: number; label?: string; basis?: string
}

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
  lodLevel: string
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
  batchOperationOnSelected: (action: string) => void
  addAnnotation: (x: number, y: number, text: string, type: string, targetId?: string) => void
  removeAnnotation: (id: string) => void
  clearAllAnnotations: () => void
  applyTheme: (theme: ThemeConfig) => void
  switchLayoutMode: (layout: LayoutType) => void
  switchAnimationPreset: (preset: string) => void
  generateAIInsights: () => void
  takeSnapshot: () => void
  runSmartPathSearch: () => void
  queryExternalData: (label: string) => void
  handleFileImport: (file: File) => void
  runGraphComparison: () => void
  triggerAutoSync: () => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  generateShareLink: () => void
  copyShareLink: () => void
  addNodeAnnotation: () => void
  addHistoryEntry: (type: string, description: string, detail?: Record<string, unknown>) => void
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
  startPathAnimation: (node: GraphNode) => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleFitToCanvas: () => void
  handleResetView: () => void
  handleSelectionComplete: (box: { x1: number; y1: number; x2: number; y2: number }) => void
  handleContextAction: (action: string, node?: GraphNode) => void
  exportSubgraphJSON: (format: ExportFormat) => void

  // Toggle helpers
  setTooltip: (t: any) => void
  setSelectedNode: (n: GraphNode | null) => void
  setZoomTransform: (z: any) => void
  setActiveFilter: (f: string | null) => void
  setSelectedNodes: (s: Set<string>) => void
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
  setCentralityMode: (m: string) => void
  setAiAnswering: (v: boolean) => void
  setAiQuestion: (q: string) => void
  setNewAnnotationText: (t: string) => void
  setReportConfig: (r: Partial<ReportConfigT>) => void
  setSortBy: (s: SortByOption) => void
  setFocusedNodeIndex: (v: number) => void
  setIsSelecting: (v: boolean) => void
  setSelectionBox: (v: any) => void
  setContextMenu: (v: any) => void
  setSearchHistory: (v: any) => void
  setNodeAIAnalysis: (v: any) => void
  setPathSourceId: (v: string) => void
  setPathTargetId: (v: string) => void
  setDetailTab: (v: string) => void
  isLoading?: boolean

  // State values (required by graph engine for rendering)
  activeFilter: string | null
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
  sortBy: string
  pinnedNodes: Set<string>
  showPinnedPanel: boolean
  annotations: Array<{ id: string; x: number; y: number; text: string; type: 'note' | 'arrow'; targetId?: string }>
  isAddingAnnotation: boolean
  activeTheme: ThemeConfig
  showThemePanel: boolean
  animationPreset: string
  showLayoutMenu: boolean
  localLayout: string
  aiInsights: AIInsightT[]
  showAIPanel: boolean
  smartPathResult: SmartPathResultV80 | null
  showPathPanel: boolean
  pathSourceId: string
  pathTargetId: string
  nodeAIAnalysis: NodeAIAnalysisData | null
  graphSnapshots: GraphSnapshotT[]
  isGeneratingInsight: boolean
  externalDataCache: Record<string, ExternalDataItem>
  showExternalPanel: boolean
  externalLoadingId: string | null
  importState: ImportState
  showImportDialog: boolean
  showCompareMode: boolean
  compareResult: ComparisonResult | null
  syncStatus: string
  lastSyncTime: string | null
  dragOver: boolean
  shareLink: ShareLink | null
  showSharePanel: boolean
  nodeAnnotations: NodeAnnotation[]
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
  savedSubGraphs: SubGraphResult[]
  activeSubGraph: string | null
  showSubGraphPanel: boolean
  aiQAHistory: Array<{ question: string; answer: string }>
  aiQuestion: string
  aiAnswering: boolean
}

/** Main composition component — renders all panels from extracted graph/components/ */
export default function GraphPanelLayout({
  nodes, edges, width, height, className, onNodeClick,
  state, dispatch,
  filteredData, lodLevel, dataChanged, detectedCommunities, generatedCommunityColors,
  centralityData, sortedNodeList, degreeStats, allTypes, typeCounts, nodeConnections, searchMatches, maxDegree,
  svgRef, containerRef, zoomBehaviorRef, engineRef,
  // Handlers
  handleSearchChange, handleSearchSelect, clearSearch,
  toggleGroupCollapse, togglePinNode, clearAllPins, batchOperationOnSelected,
  addAnnotation, removeAnnotation, clearAllAnnotations,
  applyTheme, switchLayoutMode, switchAnimationPreset,
  generateAIInsights, takeSnapshot, runSmartPathSearch,
  queryExternalData, handleFileImport, runGraphComparison, triggerAutoSync,
  handleDragOver, handleDragLeave, handleDrop,
  generateShareLink, copyShareLink, addNodeAnnotation,
  addHistoryEntry, undoHistory, redoHistory,
  addBookmark, loadBookmark, removeBookmark,
  generateReport, computeGraphStatistics, detectCommunitiesLouvain, computeKCore, extractEgoNetwork, handleAIQuestion,
  startPathAnimation, handleZoomIn, handleZoomOut, handleFitToCanvas, handleResetView,
  handleSelectionComplete, handleContextAction, exportSubgraphJSON,
  // Setters
  setTooltip, setSelectedNode, setZoomTransform, setActiveFilter, setSelectedNodes,
  setShowExportMenu, setExportStatus,
  setShowPerfPanel, setShowMinimap, setShowImportDialog, setShowCompareMode, setShowSharePanel,
  setShowAnnotationPanel, setShowHistoryPanel, setShowBookmarkPanel, setShowReportDialog,
  setShowStatsPanel, setShowCentralityPanel, setShowSubGraphPanel, setShowPathPanel,
  setShowExternalPanel, setShowAIPanel, setShowThemePanel, setShowLayoutMenu,
  setShowPinnedPanel, setIsAddingAnnotation, setIsGeneratingInsight,
  setCentralityMode, setAiAnswering, setAiQuestion, setNewAnnotationText, setReportConfig,
  setSortBy,
  // Missing setters
  setFocusedNodeIndex, setIsSelecting, setSelectionBox, setContextMenu,
  setSearchHistory, setNodeAIAnalysis, setPathSourceId, setPathTargetId,
  setDetailTab, isLoading,
  // State values
  activeFilter, selectedNode, searchQuery, focusedNodeIndex, searchHistory,
  showPerfPanel, perfStats, isSelecting, selectionBox, selectedNodes, contextMenu,
  communities, communityColors, showExportMenu, exportStatus,
  showMinimap, pathAnimation, collapsedGroups, showCentralityPanel, sortBy,
  pinnedNodes, showPinnedPanel, annotations, isAddingAnnotation,
  activeTheme, showThemePanel, animationPreset, showLayoutMenu, localLayout,
  aiInsights, showAIPanel, smartPathResult, showPathPanel, pathSourceId, pathTargetId,
  nodeAIAnalysis, graphSnapshots, isGeneratingInsight,
  externalDataCache, showExternalPanel, externalLoadingId, importState, showImportDialog,
  showCompareMode, compareResult, syncStatus, lastSyncTime, dragOver,
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
  const { tooltip, zoomTransform } = state

  return (
    <div className={cn('relative select-none', className)}
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
      onMouseDown={(e) => {
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
      onMouseUp={(e) => {
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
          if (text) addAnnotation(e.clientX - rect.left, e.clientY - rect.top, text)
        }
      }}
      tabIndex={0}
    >
      {/* SVG Canvas — wraps engine ref and provides base layer */}
      <svg ref={svgRef} className="w-full rounded-xl border" style={{ minHeight: height }}>
        <style>{`
          @keyframes edge-flow { to { stroke-dashoffset: -24; } }
          @keyframes graph-fade-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          .graph-animate-fade-in { animation: graph-fade-in 800ms ease-out both; }
          .hub-glow-ring { animation: hub-pulse 3s ease-in-out infinite; }
        `}</style>
      </svg>

      {/* v7.5: Performance Monitor Hook (RAF-based, runs independently) */}
      <div className="absolute bottom-3 right-3 z-30 w-6 h-6">
        <button onClick={() => setShowPerfPanel(!showPerfPanel)} title="性能监控 (Shift+P)">
          <span>📊</span>
        </button>
      </div>

      {/* ── Toolbar & Controls Layer ── */}
      <ZoomToolbar zoomTransform={zoomTransform} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFit={handleFitToCanvas} onReset={handleResetView} />

      {/* v7.3: Search Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-72">
        <SearchBar
          searchQuery={searchQuery}
          searchMatches={searchMatches}
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
        <div className="absolute border-2 border-dashed border-primary-500 bg-primary-100/20 dark:bg-primary-900/20 rounded pointer-events-none z-30"
          style={{ left: Math.min(selectionBox.x1, selectionBox.x2), top: Math.min(selectionBox.y1, selectionBox.y2),
            width: Math.abs(selectionBox.x2 - selectionBox.x1), height: Math.abs(selectionBox.y2 - selectionBox.y1) }} />
      )}

      {/* v7.4: Context Menu */}
      {contextMenu && (
        <ContextMenu node={contextMenu.node} selectedNodes={selectedNodes} communities={communities.size > 0 ? communities : undefined}
          onAction={(action, node) => { handleContextAction(action, node); setContextMenu(null) }} />
      )}

      {/* v7.5: Performance Monitoring Panel */}
      {showPerfPanel && <PerformancePanel stats={perfStats} />}

      {/* v7.6: Export Status Toast */}
      {exportStatus && <ExportStatusBar message={exportStatus} />}

      {/* v7.6: Path Animation Indicator */}
      {pathAnimation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-45 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg">
          <span className="text-[11px] font-medium text-white">{pathAnimation.pathNodes.length} nodes · {pathAnimation.pathEdges.length} edges</span>
        </div>
      )}

      {/* v7.6: Export Menu Dropdown */}
      {showExportMenu && (
        <ExportMenu format={exportSubgraphJSON} selectedCount={selectedNodes.size} onClose={() => setShowExportMenu(false)} />
      )}

      {/* v7.6: Minimap Navigation */}
      {showMinimap && filteredData.filteredNodes.length > 0 && (
        <div className="absolute bottom-3 left-3 z-35 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-sm rounded-lg border border-neutral-200/70 dark:border-neutral-700/50 shadow-md overflow-hidden" style={{ width: 160, height: 110 }}>
          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 dark:border-neutral-700/40">
            <span className="text-[8px] font-semibold text-neutral-500 uppercase tracking-wider">导航图</span>
            <button onClick={() => setShowMinimap(false)} title="关闭小地图"><span className="text-xs">✕</span></button>
          </div>
          <MinimapCanvas nodes={filteredData.filteredNodes} edges={filteredData.filteredEdges} width={158} height={94}
            selectedNode={selectedNode} pathAnimation={pathAnimation} communities={detectedCommunities} communityColors={generatedCommunityColors}
            onNavigate={(x, y, scale) => {
              if (!svgRef.current || !zoomBehaviorRef.current) return
              const svg = d3.select(svgRef.current)
              svg.transition().duration(400).ease(d3.easeCubicOut)
                .call(zoomBehaviorRef.current.transform as any,
                  d3.zoomIdentity.translate((containerRef.current?.clientWidth || width) / 2, height / 2)
                    .scale(scale).translate(-x * scale, -y * scale))
            }} />
        </div>
      )}

      {/* v7.7: Centrality Panel Trigger + Panel */}
      {!showCentralityPanel && (
        <div className="absolute bottom-14 right-3 z-30 w-6 h-6">
          <button onClick={() => setShowCentralityPanel(true)} title="中心性分析 (Shift+C)"><span>📈</span></button>
        </div>
      )}
      {showCentralityPanel && centralityData.stats && (
        <CentralityPanel sortBy={sortBy} onSetSortBy={setSortBy} stats={centralityData.stats} topNodes={centralityData.topByDegree}
          onNodeClick={(n) => { setSelectedNode(n); onNodeClick?.(n) }} />
      )}

      {/* v7.8: Batch Operation Bar */}
      {selectedNodes.size > 0 && (
        <BatchOperationBar count={selectedNodes.size} onFocus={() => batchOperationOnSelected('focus')} onHighlight={() => batchOperationOnSelected('highlight')}
          onHide={() => batchOperationOnSelected('hide')} onExport={() => batchOperationOnSelected('export')}
          onClear={() => setSelectedNodes(new Set())} />
      )}

      {/* v7.8: Pinned Nodes Panel */}
      {pinnedNodes.size > 0 && showPinnedPanel && (
        <PinnedNodesPanel nodes={pinnedNodes} filteredNodes={filteredData.filteredNodes} onNodeClick={onNodeClick}
          onTogglePin={togglePinNode} onClearAll={clearAllPins} onClose={() => setShowPinnedPanel(false)} />
      )}

      {/* v7.8: Annotations */}
      {annotations.map(a => (
        <AnnotationRenderer key={a.id} annotation={a} onRemove={() => removeAnnotation(a.id)} />
      ))}

      {/* v7.8: Annotation Controls */}
      {isAddingAnnotation
        ? <AnnotationControls isAdding={true} annotations={annotations} onClearAll={clearAllAnnotations} />
        : <AnnotationControls isAdding={false} annotations={annotations} onClearAll={clearAllAnnotations} onToggleAdd={() => setIsAddingAnnotation(true)} />
      }

      {/* v7.8: Selected Nodes Selection Bar */}
      {selectedNodes.size > 0 && !showPinnedPanel && (
        <SelectionBar count={selectedNodes.size} onClear={() => setSelectedNodes(new Set())} />
      )}

      {/* v7.9: Community Legend */}
      {communities.size > 0 && (
        <CommunityLegend communities={communities} colors={generatedCommunityColors} maxShow={10} />
      )}

      {/* v7.9: Theme Panel */}
      {showThemePanel && (
        <ThemePanel themes={[activeTheme, ...THEME_PRESETS.filter(t => t.id !== activeTheme.id)]}
          onSelect={applyTheme} onClose={() => setShowThemePanel(false)} />
      )}

      {/* v7.9: Layout Indicator */}
      <LayoutIndicator current={localLayout} />

      {/* v7.9: Animation Presets Controls */}
      <AnimationPresetsControls preset={animationPreset} onChange={switchAnimationPreset} />

      {/* v8.0: AI Panel + AI Insights */}
      {showAIPanel && (
        <AIPanel qaHistory={aiQAHistory} question={aiQuestion} setQuestion={setAiQuestion} answering={aiAnswering} onSend={handleAIQuestion} onClose={() => setShowAIPanel(false)} />
      )}
      {aiInsights.length > 0 && (
        <AIInsightsPanel insights={aiInsights} generating={isGeneratingInsight} onGenerate={generateAIInsights} onClose={() => setShowAIPanel(false)} />
      )}

      {/* v8.0: Node AI Analysis Panel */}
      {nodeAIAnalysis && (
        <NodeAIAnalysis analysis={nodeAIAnalysis} onClose={() => setNodeAIAnalysis(null)} />
      )}

      {/* v8.0: Smart Path Toolbar */}
      <SPathToolbar sourceId={pathSourceId} targetId={pathTargetId}
        onSourceChange={setPathSourceId} onTargetChange={setPathTargetId} nodes={filteredData.filteredNodes.slice(0, 30)}
        onSearch={runSmartPathSearch} disabled={!pathSourceId || !pathTargetId} />

      {/* v8.0: Graph Snapshots Sidebar */}
      {graphSnapshots.length > 0 && (
        <GraphSnapshots snapshots={graphSnapshots} count={graphSnapshots.length} />
      )}

      {/* v8.1: External Data Panel */}
      {showExternalPanel && selectedNode && (
        <ExternalDataPanel loadingId={externalLoadingId} cache={externalDataCache} nodeLabel={selectedNode.label}
          syncStatus={syncStatus} onRefresh={() => queryExternalData(selectedNode.label)} onAutoSync={triggerAutoSync}
          onClose={() => setShowExternalPanel(false)} />
      )}

      {/* v8.1: Import Dialog */}
      {showImportDialog && (
        <ImportDialog state={importState} onAccept={() => setShowImportDialog(false)} onClose={() => setShowImportDialog(false)}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />
      )}

      {/* v8.1: Comparison Panel */}
      {showCompareMode && compareResult && (
        <ComparisonPanel result={compareResult} filteredNodes={filteredData.filteredNodes} onClose={() => setShowCompareMode(false)} />
      )}

      {/* v8.2: Share Panel */}
      {showSharePanel && shareLink && (
        <SharePanel link={shareLink} onCopy={copyShareLink} onClose={() => setShowSharePanel(false)} />
      )}

      {/* v8.2: Annotation Panel */}
      {showAnnotationPanel && selectedNode && (
        <AnnotationPanel node={selectedNode} annotations={nodeAnnotations.get(selectedNode.label || '') || []}
          newText={newAnnotationText} onTextChange={setNewAnnotationText} onSend={addNodeAnnotation}
          onClose={() => setShowAnnotationPanel(false)} />
      )}

      {/* v8.2: History Panel */}
      {showHistoryPanel && (
        <HistoryPanel entries={historyEntries} index={historyIndex} onUndo={undoHistory} onRedo={redoHistory}
          canUndo={historyIndex >= 0} canRedo={historyIndex < historyEntries.length - 1}
          onClose={() => setShowHistoryPanel(false)} />
      )}

      {/* v8.2: Bookmark Panel */}
      {showBookmarkPanel && (
        <BookmarkPanel bookmarks={bookmarks} onAdd={(name) => addBookmark(name)} onLoad={loadBookmark}
          onRemove={removeBookmark} onClose={() => setShowBookmarkPanel(false)} />
      )}

      {/* v8.2: Report Dialog */}
      {showReportDialog && (
        <ReportDialog config={reportConfig} generating={reportGenerating} onConfigChange={setReportConfig}
          onGenerate={generateReport} onClose={() => setShowReportDialog(false)} />
      )}

      {/* v8.3: Statistics Dashboard */}
      {showStatsPanel && graphStats && (
        <StatisticsDashboard stats={graphStats} onClose={() => setShowStatsPanel(false)} />
      )}

      {/* v8.3: Centrality Metrics Panel */}
      {showCentralityPanel && centralityMetrics && (
        <CentralityMetricsPanel metrics={centralityMetrics} mode={centralityMode} onSetMode={setCentralityMode}
          onClose={() => setShowCentralityPanel(false)} filteredNodes={filteredData.filteredNodes} />
      )}

      {/* v8.3: SubGraph Browser */}
      {showSubGraphPanel && (communityResult || kcoreResult || savedSubGraphs.length > 0) && (
        <SubGraphBrowser communities={communityResult} kcore={kcoreResult} saved={savedSubGraphs}
          onApply={(sg) => { /* TODO: apply subgraph */ }}
          onClose={() => setShowSubGraphPanel(false)} />
      )}

      {/* v7.2: Detail Panel */}
      {selectedNode && (
        <DetailPanel selectedNode={selectedNode} nodeConnections={nodeConnections ?? { incoming: [], outgoing: [], neighbors: [], totalConnections: 0 }}
          detailTab={detailTab} onSetDetailTab={setDetailTab} setSelectedNode={setSelectedNode} onNodeClick={onNodeClick} />
      )}

      {/* v7.3: Search Results Dropdown & History */}
      {searchQuery && searchMatches.length > 0 && (
        <SearchOverlay matches={searchMatches.map(m => ({ node: m.node, score: m.score }))}
          focusedIndex={focusedNodeIndex} onSelect={handleSearchSelect} onFocus={setFocusedNodeIndex} />
      )}
      {!searchQuery && searchHistory.length > 0 && (
        <SearchHistoryPanel history={searchHistory} onClear={() => setSearchHistory([])} onPick={(t) => { handleSearchChange(t); setFocusedNodeIndex(0) }} />
      )}

      {/* v7.4: Empty States */}
      {filteredData.filteredNodes.length === 0 && nodes.length > 0 && (
        <FilterEmptyState activeFilter={activeFilter} onClear={() => setActiveFilter(null)} />
      )}
      {nodes.length === 0 && (!isLoading || false) && (
        <DataEmptyState />
      )}

      {/* Loading Skeleton */}
      {isLoading && <GraphSkeleton height={height} />}

      {/* v7.4: Right Click Menu (rendered inline since it uses complex event handling) */}
      {contextMenu && (
        <ContextMenu node={contextMenu.node} selectedNodes={selectedNodes}
          onAction={(action, node) => { handleContextAction(action, node); setContextMenu(null) }} />
      )}

      {/* v7.8: Pin trigger button */}
      {pinnedNodes.size > 0 && !showPinnedPanel && (
        <button onClick={() => setShowPinnedPanel(true)} title={`固定节点 (${pinnedNodes.size})`}
          className="absolute top-14 left-3 z-30 w-6 h-6">
          <span>📌</span><span className="absolute -top-1 -right-1 w-3.5 h-3.5">{pinnedNodes.size}</span>
        </button>
      )}

      {/* v7.8: Adding annotation indicator */}
      {isAddingAnnotation && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-35 px-3 py-1.5 rounded-lg bg-warning-500 text-white text-[11px] animate-pulse">
          ✏️ 点击图谱添加标注 — 按 Esc 取消
        </div>
      )}
    </div>
  )
}
