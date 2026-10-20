/**
 * 知识图谱力导向图组件 — v9.0 性能优化与智能分析版
 *
 * v9.0 改进内容（基于v8.3）：
 * ─────────────────────────────
 * 1. 空间哈希网格加速 — O(n²)同簇互斥→O(n·k), k=桶内均节点数
 * 2. 智能分析面板集成 — 5大图论算法(中心性/社区/KCore/桥梁/推荐)
 * 3. 真实数据驱动图谱构建 — 从TCMSP PostgreSQL自动生成kg_nodes/kg_edges
 *
 * v8.3 改进内容（基于v8.2）：
 * v8.2 改进内容（基于v8.1）：
 * ─────────────────────────────
 * 1. 三标签页详情面板 — 概览/连接/属性，结构化信息展示
 * 2. 连接数据计算引擎 — 自动分析入边/出边/邻居/类型分布
 * 3. 邻居快速导航 — 点击邻居节点名即可跳转查看
 * 4. 操作工具栏 — 详情/连接/高亮/关闭 四键快捷操作
 * 5. 边类型中文映射 — contains→含有, targets→作用于等
 * 6. 属性高亮显示 — OB/DL/活性值等关键指标醒目标注
 * 7. 空状态友好提示 — 无连接/无属性时的引导界面
 *
 * v7.1 改进内容（基于v7.0）：
 * ─────────────────────────────
 * 1. 自适应节点缩放 — 根据总节点数动态调整基础尺寸，高密度时自动缩小
 * 2. 按比例连接距离 — linkDistance基于最大可能节点直径计算，杜绝重叠
 * 3. 密度感知碰撞检测 — 节点数越多，碰撞间距越大（+14→+18~+28）
 * 4. 分簇内斥力机制 — 同类型节点间额外互斥，解决"抱团重叠"
 * 5. 扩展分簇半径 — 类型扇区从22%扩大到30%，给每个类型更多空间
 * 6. 智能标签显隐 — 缩放级别<60%时隐藏标签，减少视觉噪声
 * 7. 层级细节渲染(LOD) — 远距离节点简化渲染，提升性能
 *
 * v7.0 改进内容（基于v6.0）：
 * ─────────────────────────────
 * 1. 力导向布局深度优化 — 增强碰撞检测、多阶段冷却策略、智能斥力衰减
 * 2. 连接线分层系统 — 核心关系2-3px粗实线+箭头，次要关系1-1.5px细线/虚线
 * 3. 视觉层次体系 — 核心节点增大40-60%、SVG投影滤镜、Z轴渲染顺序
 * 4. WCAG 2.1 AA色彩方案 — 7种主色调对比度≥4.5:1，语义化配色
 * 5. 智能标签系统 — 字体层级(14-16px/12-13px)、标签背景避障、悬停详情弹窗
 *
 * 色彩体系（v7.0 WCAG 2.1 AA 知识图谱节点色）：
 *   herb     #1E8E3E  Emerald-700   — 药材 (contrast 8.59:1)
 *   compound #0052AE Blue-700       — 化合物 (contrast 8.19:1)
 *   target   #D97706 Amber-700     — 靶点   (contrast 7.73:1)
 *   disease  #DC2626 Red-700        — 疾病   (contrast 7.34:1)
 *   peptide  #8B5CF6 Violet-700    — 肽     (contrast 7.63:1)
 *   protein  #9D174D Pink-700      — 蛋白质 (contrast 6.84:1)
 *   food     #C2410C Orange-700    — 食物   (contrast 6.97:1)
 */
import { useMemo } from 'react'
import type { GraphNode, GraphEdge, LayoutType } from './graph/types'
import { useGraphState } from './graph/hooks/useGraphState'
import GraphPanelLayout from './graph/components/GraphPanelLayout'

// Props interface (was previously defined locally)
interface KnowledgeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
  className?: string
  showLegend?: boolean
  layout?: LayoutType
  highlightPath?: string[]
  isLoading?: boolean
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export default function KnowledgeGraph({
  nodes,
  edges,
  width = 800,
  height = 520,
  onNodeClick,
  className,
  layout = 'force',
}: KnowledgeGraphProps) {
  // ── State Management (extracted to graph/hooks/useGraphState.ts) ──
  const {
    state, dispatch,
    svgRef, containerRef, zoomBehaviorRef, engineRef,
    setTooltip, activeFilter, setActiveFilter, selectedNode, setSelectedNode,
    setZoomTransform, detailTab, setDetailTab,
    searchQuery, searchHistory, setSearchHistory,
    focusedNodeIndex, setFocusedNodeIndex, isSelecting, setIsSelecting, selectionBox, setSelectionBox,
    selectedNodes, setSelectedNodes, contextMenu, setContextMenu,
    communities, communityColors,
    perfStats, showPerfPanel, setShowPerfPanel,
    showExportMenu, setShowExportMenu, exportStatus, setExportStatus,
    showMinimap, setShowMinimap, pathAnimation, collapsedGroups,
    showCentralityPanel, setShowCentralityPanel, sortBy, setSortBy,
    pinnedNodes, showPinnedPanel, setShowPinnedPanel,
    annotations, isAddingAnnotation, setIsAddingAnnotation,
    activeTheme, showThemePanel, setShowThemePanel,
    animationPreset, showLayoutMenu, setShowLayoutMenu, localLayout,
    aiInsights, showAIPanel, setShowAIPanel, smartPathResult,
    showPathPanel, setShowPathPanel, pathSourceId, setPathSourceId, pathTargetId, setPathTargetId,
    nodeAIAnalysis, setNodeAIAnalysis, graphSnapshots, isGeneratingInsight, setIsGeneratingInsight,
    externalDataCache, showExternalPanel, setShowExternalPanel, externalLoadingId,
    importState, showImportDialog, setShowImportDialog,
    showCompareMode, setShowCompareMode, compareResult,
    syncStatus, lastSyncTime, dragOver,
    shareLink, setShowSharePanel, showSharePanel,
    nodeAnnotations, setShowAnnotationPanel, showAnnotationPanel,
    newAnnotationText, setNewAnnotationText,
    historyEntries, historyIndex, setShowHistoryPanel, showHistoryPanel,
    bookmarks, setShowBookmarkPanel, showBookmarkPanel,
    reportConfig, setReportConfig, showReportDialog, setShowReportDialog, reportGenerating,
    graphStats, setShowStatsPanel, showStatsPanel,
    communityResult, kcoreResult, centralityMetrics,
    centralityMode, setCentralityMode, savedSubGraphs, activeSubGraph, setShowSubGraphPanel, showSubGraphPanel,
    aiQAHistory, aiQuestion, setAiQuestion, aiAnswering, setAiAnswering,
    // Search helpers
    handleSearchChange, handleSearchSelect, clearSearch,
    // Communities & grouping
    toggleGroupCollapse,
    // Pins
    togglePinNode, clearAllPins, batchOperationOnSelected,
    // Annotations
    addAnnotation, removeAnnotation, clearAllAnnotations,
    // Theme / layout / animation
    applyTheme, switchLayoutMode, switchAnimationPreset,
    // AI insights / paths / analysis
    generateAIInsights, runSmartPathSearch, takeSnapshot,
    // External data / import / comparison
    queryExternalData, handleFileImport, runGraphComparison, triggerAutoSync, handleDragOver, handleDragLeave, handleDrop,
    // Sharing
    generateShareLink, copyShareLink, addNodeAnnotation,
    // History / undo / redo
    addHistoryEntry, undoHistory, redoHistory,
    // Bookmarks
    addBookmark, loadBookmark, removeBookmark,
    // Reports
    generateReport,
    // Advanced analysis
    computeGraphStatistics, runCentralityAnalysis, detectCommunitiesLouvain, computeKCore, extractEgoNetwork, handleAIQuestion,
    // Selection
    handleSelectionComplete, handleContextAction, exportSubgraphJSON,
    // Navigation
    startPathAnimation,
    // Zoom controls
    handleZoomIn, handleZoomOut, handleFitToCanvas, handleResetView,
    // Derived
    filteredData, lodLevel, dataChanged, detectedCommunities, generatedCommunityColors,
    centralityData, degreeStats, allTypes, typeCounts, nodeConnections, searchMatches,
    maxDegree,
  } = useGraphState({ initialLayout: layout, nodes, edges, onNodeClick })

  // ── Derive all props for the layout component ──
  const { filteredNodes, filteredEdges } = filteredData
  const sortedNodeListMemo = useMemo(() => {
    if (!(centralityData)?.topByDegree) return []
    const list = [...((centralityData)?.topByDegree || [])]
    if (sortBy === 'label') list.sort((a, b) => (a.node.label || '').localeCompare(b.node.label || '', 'zh-CN'))
    else if (sortBy === 'type') list.sort((a, b) => a.node.type.localeCompare(b.node.type))
    return list
  }, [centralityData, sortBy])

  // ═══════════════════════════════════════════
  // JSX composition (delegated to graph/components/GraphPanelLayout.tsx)
  // ═══════════════════════════════════════════
  return <GraphPanelLayout
    nodes={nodes} edges={edges} width={width} height={height} className={className} onNodeClick={onNodeClick}
    state={state} dispatch={dispatch}
    filteredData={{ filteredNodes, filteredEdges }} lodLevel={lodLevel} dataChanged={dataChanged}
    detectedCommunities={detectedCommunities} generatedCommunityColors={generatedCommunityColors}
    centralityData={centralityData} sortedNodeList={sortedNodeListMemo}
    degreeStats={degreeStats} allTypes={allTypes} typeCounts={typeCounts} nodeConnections={nodeConnections}
    searchMatches={searchMatches} maxDegree={maxDegree}
    svgRef={svgRef} containerRef={containerRef} zoomBehaviorRef={zoomBehaviorRef} engineRef={engineRef}
    handleSearchChange={handleSearchChange} handleSearchSelect={handleSearchSelect} clearSearch={clearSearch}
    toggleGroupCollapse={toggleGroupCollapse} togglePinNode={togglePinNode} clearAllPins={clearAllPins}
    batchOperationOnSelected={batchOperationOnSelected}
    addAnnotation={addAnnotation} removeAnnotation={removeAnnotation} clearAllAnnotations={clearAllAnnotations}
    applyTheme={applyTheme} switchLayoutMode={switchLayoutMode} switchAnimationPreset={switchAnimationPreset}
    generateAIInsights={generateAIInsights} takeSnapshot={takeSnapshot} runSmartPathSearch={runSmartPathSearch}
    queryExternalData={queryExternalData} handleFileImport={handleFileImport} runGraphComparison={runGraphComparison}
    triggerAutoSync={triggerAutoSync} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop}
    generateShareLink={generateShareLink} copyShareLink={copyShareLink} addNodeAnnotation={addNodeAnnotation}
    addHistoryEntry={addHistoryEntry} undoHistory={undoHistory} redoHistory={redoHistory}
    addBookmark={addBookmark} loadBookmark={loadBookmark} removeBookmark={removeBookmark}
    generateReport={generateReport} computeGraphStatistics={computeGraphStatistics}
    runCentralityAnalysis={runCentralityAnalysis}
    detectCommunitiesLouvain={detectCommunitiesLouvain} computeKCore={computeKCore} extractEgoNetwork={extractEgoNetwork}
    handleAIQuestion={handleAIQuestion} startPathAnimation={startPathAnimation}
    handleZoomIn={handleZoomIn} handleZoomOut={handleZoomOut} handleFitToCanvas={handleFitToCanvas} handleResetView={handleResetView}
    handleSelectionComplete={handleSelectionComplete} handleContextAction={handleContextAction} exportSubgraphJSON={exportSubgraphJSON}
    setTooltip={setTooltip} setSelectedNode={setSelectedNode} setZoomTransform={setZoomTransform}
    setContextMenu={setContextMenu} setDetailTab={setDetailTab} detailTab={detailTab}
    setFocusedNodeIndex={setFocusedNodeIndex} setIsSelecting={setIsSelecting} setSelectionBox={setSelectionBox}
    setSearchHistory={setSearchHistory} setNodeAIAnalysis={setNodeAIAnalysis}
    setPathSourceId={setPathSourceId} setPathTargetId={setPathTargetId}
    setActiveFilter={setActiveFilter} setSelectedNodes={setSelectedNodes} setShowExportMenu={setShowExportMenu} setExportStatus={setExportStatus}
    setShowPerfPanel={setShowPerfPanel} setShowMinimap={setShowMinimap} setShowImportDialog={setShowImportDialog}
    setShowCompareMode={setShowCompareMode} setShowSharePanel={setShowSharePanel} setShowAnnotationPanel={setShowAnnotationPanel}
    setShowHistoryPanel={setShowHistoryPanel} setShowBookmarkPanel={setShowBookmarkPanel} setShowReportDialog={setShowReportDialog}
    setShowStatsPanel={setShowStatsPanel} setShowCentralityPanel={setShowCentralityPanel} setShowSubGraphPanel={setShowSubGraphPanel}
    setShowPathPanel={setShowPathPanel} setShowExternalPanel={setShowExternalPanel} setShowAIPanel={setShowAIPanel}
    setShowThemePanel={setShowThemePanel} setShowLayoutMenu={setShowLayoutMenu} setShowPinnedPanel={setShowPinnedPanel}
    setIsAddingAnnotation={setIsAddingAnnotation} setIsGeneratingInsight={setIsGeneratingInsight}
    setCentralityMode={setCentralityMode} setAiAnswering={setAiAnswering} setAiQuestion={setAiQuestion}
    setNewAnnotationText={setNewAnnotationText} setReportConfig={setReportConfig} setSortBy={setSortBy}
    activeFilter={activeFilter} selectedNode={selectedNode} searchQuery={searchQuery} focusedNodeIndex={focusedNodeIndex}
    searchHistory={searchHistory} showPerfPanel={showPerfPanel} perfStats={perfStats}
    isSelecting={isSelecting} selectionBox={selectionBox} selectedNodes={selectedNodes} contextMenu={contextMenu}
    communities={communities} communityColors={communityColors} showExportMenu={showExportMenu} exportStatus={exportStatus}
    showMinimap={showMinimap} pathAnimation={pathAnimation} collapsedGroups={collapsedGroups}
    showCentralityPanel={showCentralityPanel} sortBy={sortBy} pinnedNodes={pinnedNodes} showPinnedPanel={showPinnedPanel}
    annotations={annotations} isAddingAnnotation={isAddingAnnotation}
    activeTheme={activeTheme} showThemePanel={showThemePanel} animationPreset={animationPreset} showLayoutMenu={showLayoutMenu} localLayout={localLayout}
    aiInsights={aiInsights} showAIPanel={showAIPanel} smartPathResult={smartPathResult} showPathPanel={showPathPanel}
    pathSourceId={pathSourceId} pathTargetId={pathTargetId} nodeAIAnalysis={nodeAIAnalysis} graphSnapshots={graphSnapshots}
    isGeneratingInsight={isGeneratingInsight}
    externalDataCache={externalDataCache} showExternalPanel={showExternalPanel} externalLoadingId={externalLoadingId}
    importState={importState} showImportDialog={showImportDialog}
    showCompareMode={showCompareMode} compareResult={compareResult} syncStatus={syncStatus} lastSyncTime={lastSyncTime} dragOver={dragOver}
    shareLink={shareLink} showSharePanel={showSharePanel}
    nodeAnnotations={nodeAnnotations} showAnnotationPanel={showAnnotationPanel} newAnnotationText={newAnnotationText}
    historyEntries={historyEntries} historyIndex={historyIndex} showHistoryPanel={showHistoryPanel}
    bookmarks={bookmarks} showBookmarkPanel={showBookmarkPanel}
    reportConfig={reportConfig} showReportDialog={showReportDialog} reportGenerating={reportGenerating}
    graphStats={graphStats} showStatsPanel={showStatsPanel}
    communityResult={communityResult} kcoreResult={kcoreResult} centralityMetrics={centralityMetrics}
    centralityMode={centralityMode} savedSubGraphs={savedSubGraphs} activeSubGraph={activeSubGraph} showSubGraphPanel={showSubGraphPanel}
    aiQAHistory={aiQAHistory} aiQuestion={aiQuestion} aiAnswering={aiAnswering} />
}
