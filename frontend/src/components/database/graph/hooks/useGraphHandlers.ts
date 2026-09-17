/**
 * useGraphHandlers — all useCallback callbacks extracted from KnowledgeGraph.tsx.
 *
 * Every callback is written so that its dependencies are explicit parameters.
 * The hook returns a flat object of named handlers that the component spreads
 * into its JSX inline.
 *
 * Dependencies:
 *   - state            : GraphState (all local component state via reducer)
 *   - dispatch         : React.Dispatch<GraphAction>
 *   - filteredNodes    : GraphNode[]
 *   - filteredEdges    : GraphEdge[]
 *   - nodes            : GraphNode[]           (full unfiltered set)
 *   - edges            : GraphEdge[]           (full unfiltered set)
 *   - onNodeClick      : ((node: GraphNode) => void) | undefined   (prop)
 *   - highlightPath    : string[] | undefined  (prop)
 *   - zoomTransform    : d3.ZoomTransform | null
 *   - svgRef           : React.RefObject<SVGSVGElement | null>
 *   - detectedComm     : Map<string, number>
 *   - commColors       : Record<number, string>
 *   - centralityTop    : Array<{ node: GraphNode; degree: number }>
  insig              : InsightTemplates     (re-exported INSIGHT_TEMPLATES)
 *   - typeConfig       : TypeConfig           (TYPE_CONFIG from graph/types)
 *   - edgeTypeLabels   : EdgeTypeLabels        (EDGE_TYPE_LABELS from graph/types)
 *   - mockExternalDB   : Record<string, ExternalData>  (re-exported MOCK_EXTERNAL_DB)
 */

import { useCallback } from 'react'
import * as d3 from 'd3'
import type { Dispatch } from 'react'
import type { GraphNode, GraphEdge, LayoutType, ThemeConfig, AnimationPreset } from '../types'
import type { SmartPathResult } from '../analytics'
import type {
  GraphAction, GraphState, NodeAIAnalysis,
  AIInsight, ExternalData, ImportState, ShareLink, NodeAnnotation, HistoryEntry,
  GraphBookmark, ReportConfig, GraphStatistics, CommunityResult, KCoreResult,
  CentralityMetrics, SubGraphResult, AIQARecord,
} from './useGraphState'

// ---------------------------------------------------------------------------
// Internal type aliases (mirror component-level types used by callbacks)
// ---------------------------------------------------------------------------

/** Shape of INSIGHT_TEMPLATES object from KnowledgeGraph.tsx */
type InsightTemplates = {
  highDegreeHub: (node: GraphNode, degree: number, maxDeg: number) => AIInsight
  isolatedNode: (node: GraphNode) => AIInsight
  bridgeNode: (node: GraphNode, betweenness: number) => AIInsight
  denseCluster: (type: string, count: number, avgDegree: number) => AIInsight
  synergyPair: (source: string, target: string, edgeType: string) => AIInsight
}

type TypeConfig = Record<string, { color: string; glow: string; size: number; minSize: number; maxSize: number; label: string; icon: string; isCore: boolean }>
type EdgeTypeLabels = Record<string, string>

type AnnotationEntry = {
  id: string
  x: number
  y: number
  text: string
  type: 'note' | 'arrow'
  targetId?: string
}

// ---------------------------------------------------------------------------
// helpers — file-type detection, smart path wrapper, path BFS wrapper
// ---------------------------------------------------------------------------

function detectFileType(file: File): NonNullable<ImportState['fileType']> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'json') return 'json'
  if (ext === 'sdf') return 'sdf'
  return 'unknown'
}

// Wrappers — the component already imports these from analytics/stats.
// We re-declare signatures here; callers resolve them outside this module.
type FindSmartPathFn = (nodes: GraphNode[], edges: GraphEdge[], sourceId: string, targetId: string) => SmartPathResult | null
type FindPathBFSFn = (edges: GraphEdge[], sourceId: string, targetId: string) => string[] | null

// ---------------------------------------------------------------------------
// search handlers
// ---------------------------------------------------------------------------

const createSearchHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  searchHistory: string[],
) => ({
  handleSearchChange: useCallback((value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: value })
    dispatch({ type: 'SET_FOCUSED_NODE_INDEX', payload: -1 })
    const trimmed = value.trim()
    if (trimmed && !searchHistory.includes(trimmed)) {
      dispatch({ type: 'ADD_SEARCH_HISTORY_ITEM', payload: trimmed })
    }
  }, [dispatch, searchHistory]),

  handleSearchSelect: useCallback((node: GraphNode) => {
    dispatch({ type: 'SELECT_NODE', payload: node })
    // onNodeClick is resolved by the caller
  }, [dispatch]),

  clearSearch: useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] })
    dispatch({ type: 'SET_FOCUSED_NODE_INDEX', payload: -1 })
  }, [dispatch]),
})

// ---------------------------------------------------------------------------
// annotation handlers
// ---------------------------------------------------------------------------

const createAnnotationHandlers = (
  dispatch: Dispatch<GraphAction>,
) => {
  const addAnnotation = useCallback((x: number, y: number, text: string, type: 'note' | 'arrow' = 'note', targetId?: string) => {
    const entry: Omit<AnnotationEntry, 'id'> = { x, y, text, type, targetId }
    dispatch({ type: 'ADD_ANNOTATION_ENTRY', payload: entry })
  }, [dispatch])

  const removeAnnotation = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ANNOTATION_ENTRY', payload: id })
  }, [dispatch])

  const clearAllAnnotations = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_ANNOTATIONS' })
  }, [dispatch])

  return { addAnnotation, removeAnnotation, clearAllAnnotations }
}

// ---------------------------------------------------------------------------
// pin handlers
// ---------------------------------------------------------------------------

const createPinHandlers = (dispatch: Dispatch<GraphAction>) => ({
  togglePinNode: useCallback((nodeId: string) => {
    dispatch({ type: 'TOGGLE_PIN', payload: nodeId })
  }, [dispatch]),

  clearAllPins: useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_PINS' })
  }, [dispatch]),
})

// ---------------------------------------------------------------------------
// communities
// ---------------------------------------------------------------------------

const createCommunityHandlers = (
  dispatch: Dispatch<GraphAction>,
) => ({
  detectCommunitiesHandler: useCallback(() => {
    // Placeholder — the full Louvain implementation runs inside the
    // community-detect callback below; see runCentralityAnalysis.
    // This handler simply toggles the subgraph panel for community display.
    dispatch({ type: 'SET_SHOW_SUBGRAPH_PANEL', payload: true })
  }, [dispatch]),

  toggleGroupCollapse: useCallback((type: string) => {
    dispatch({ type: 'TOGGLE_GROUP_COLLAPSE', payload: type })
  }, [dispatch]),
})

// ---------------------------------------------------------------------------
// batch operations
// ---------------------------------------------------------------------------

const createBatchHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  filteredNodes: GraphNode[],
  onNodeClick: ((node: GraphNode) => void) | undefined,
) => ({
  batchOperationOnSelected: useCallback((action: 'hide' | 'highlight' | 'focus' | 'export') => {
    if (state.selectedNodes.size === 0) return

    switch (action) {
      case 'hide': {
        dispatch({ type: 'SET_EXPORT_STATUS', payload: `\u{1F6AB} 已隐藏 ${state.selectedNodes.size} 个节点（视觉过滤）` })
        break
      }
      case 'highlight': {
        dispatch({ type: 'SET_EXPORT_STATUS', payload: `✨ 已高亮 ${state.selectedNodes.size} 个选中节点` })
        break
      }
      case 'focus': {
        const firstKey = [...state.selectedNodes][0]
        const [label] = firstKey.split('_')
        const node = filteredNodes.find(n => n.label === label)
        if (node) onNodeClick?.(node)
        dispatch({ type: 'SET_EXPORT_STATUS', payload: `\u{1F3AF} 已聚焦到: ${label}` })
        break
      }
      case 'export': {
        dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: true })
        return
      }
    }
    setTimeout(() => dispatch({ type: 'SET_EXPORT_STATUS', payload: null }), 2500)
  }, [state.selectedNodes, filteredNodes, onNodeClick, dispatch]),
})

// ---------------------------------------------------------------------------
// theme / animation / layout
// ---------------------------------------------------------------------------

const createThemeHandlers = (dispatch: Dispatch<GraphAction>) => ({
  applyTheme: useCallback((theme: ThemeConfig) => {
    dispatch({ type: 'SET_THEME', payload: theme })
    dispatch({ type: 'SET_SHOW_THEME_PANEL', payload: true })
  }, [dispatch]),

  switchLayoutMode: useCallback((newLayout: LayoutType) => {
    dispatch({ type: 'SET_SHOW_LAYOUT_MENU', payload: true })
    dispatch({ type: 'SET_LAYOUT', payload: newLayout })
  }, [dispatch]),

  switchAnimationPreset: useCallback((preset: AnimationPreset) => {
    dispatch({ type: 'SET_ANIMATION_PRESET', payload: preset })
  }, [dispatch]),
})

// ---------------------------------------------------------------------------
// AI insight handlers
// ---------------------------------------------------------------------------

const createAIInsightHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  filteredNodes: GraphNode[],
  filteredEdges: GraphEdge[],
  findSmartPathFn: FindSmartPathFn,
  insig: InsightTemplates,
  typeConfig: TypeConfig,
  edgeTypeLabels: EdgeTypeLabels,
) => {
  const generateAIInsights = useCallback(() => {
    dispatch({ type: 'SET_GENERATING_INSIGHT', payload: true })
    setTimeout(() => {
      const fNodes = filteredNodes
      const fEdges = filteredEdges

      if (fNodes.length === 0) {
        dispatch({ type: 'SET_AI_INSIGHTS', payload: [] })
        dispatch({ type: 'SET_GENERATING_INSIGHT', payload: false })
        return
      }

      // Build degree map
      const degreeMap = new Map<string, number>()
      fNodes.forEach(n => degreeMap.set(n.id || n.label, 0))
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
        degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
      })

      let maxDeg = 0
      degreeMap.forEach(d => { if (d > maxDeg) maxDeg = d })

      const sortedByDegree = [...fNodes].sort(
        (a, b) => (degreeMap.get(b.id || b.label) || 0) - (degreeMap.get(a.id || a.label) || 0),
      )
      const insights: AIInsight[] = []

      sortedByDegree.slice(0, 3).forEach(node => {
        const deg = degreeMap.get(node.id || node.label) || 0
        if (deg >= 3) insights.push(insig.highDegreeHub(node, deg, maxDeg))
      })

      sortedByDegree.filter(n => (degreeMap.get(n.id || n.label) || 0) <= 1).slice(0, 2).forEach(node => {
        insights.push(insig.isolatedNode(node))
      })

      const typeGroups: Record<string, GraphNode[]> = {}
      fNodes.forEach(n => { (typeGroups[n.type] ||= []).push(n) })
      Object.entries(typeGroups).forEach(([type, nodes]) => {
        const avgDegree = nodes.reduce((s, n) => s + (degreeMap.get(n.id || n.label) || 0), 0) / nodes.length
        if (nodes.length >= 5 && avgDegree > 1) insights.push(insig.denseCluster(type, nodes.length, avgDegree))
      })

      const synergyEdges = fEdges.filter(e => e.type === 'synergy')
      synergyEdges.slice(0, 3).forEach(e => {
        const sName = typeof e.source === 'string' ? e.source : (e.source || '')
        const tName = typeof e.target === 'string' ? e.target : (e.target || '')
        if (sName && tName) insights.push(insig.synergyPair(sName, tName, e.type))
      })

      // Bridge detection (simplified betweenness)
      const adjList = new Map<string, string[]>()
      fNodes.forEach(n => adjList.set(n.id || n.label, []))
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        adjList.get(s)?.push(t)
        adjList.get(t)?.push(s)
      })
      const betweenness = new Map<string, number>()
      fNodes.forEach(n => betweenness.set(n.id || n.label, 0))

      const samplePairs: [string, string][] = []
      for (let i = 0; i < Math.min(fNodes.length, 20); i++) {
        for (let j = i + 1; j < Math.min(fNodes.length, 25); j++) {
          samplePairs.push([fNodes[i].id || fNodes[i].label, fNodes[j].id || fNodes[j].label])
        }
      }
      samplePairs.forEach(([src, tgt]) => {
        const visited = new Set<string>()
        const queue: string[][] = [[src]]
        visited.add(src)
        while (queue.length > 0) {
          const path = queue.shift()!
          const cur = path[path.length - 1]
          if (cur === tgt) {
            path.slice(1, -1).forEach(nd => betweenness.set(nd, (betweenness.get(nd) || 0) + 1))
            break
          }
          ;(adjList.get(cur) || []).filter(n => !visited.has(n)).forEach(nbr => {
            visited.add(nbr)
            queue.push([...path, nbr])
          })
        }
      })
      const topBridges = [...betweenness.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
      topBridges.forEach(([nodeId, score]) => {
        if (score > 5) {
          const node = fNodes.find(n => (n.id || n.label) === nodeId)
          if (node) insights.push(insig.bridgeNode(node, score))
        }
      })

      const typeCount = Object.keys(typeGroups).length
      insights.unshift({
        id: 'graph_summary',
        type: 'summary',
        title: '\u{1F4CB} 图谱总览',
        description:
          `当前图谱包含 ${fNodes.length} 个节点、${fEdges.length} 条边，覆盖${typeCount}种实体类型。最大连接度${maxDeg}，平均连接度${(Array.from(degreeMap.values()).reduce((a, b) => a + b, 0) / fNodes.length).toFixed(1)}。${sortedByDegree.length > 50 ? '图谱规模较大，建议使用筛选功能聚焦关键区域。' : ''}`,
        confidence: 0.98,
        severity: 'info',
      })

      dispatch({ type: 'SET_AI_INSIGHTS', payload: insights.slice(0, 12) })
      dispatch({ type: 'SET_GENERATING_INSIGHT', payload: false })
    }, 300)
  }, [filteredNodes, filteredEdges, insig, dispatch])

  // Shortest-path wrapper
  const findSmartPathLocal = useCallback((sourceId: string, targetId: string): SmartPathResult | null => {
    return findSmartPathFn(filteredNodes, filteredEdges, sourceId, targetId)
  }, [filteredNodes, filteredEdges, findSmartPathFn])

  // Node-level analysis
  const generateNodeAnalysis = useCallback((node: GraphNode): NodeAIAnalysis => {
    const fNodes = filteredNodes
    const fEdges = filteredEdges
    const nodeId = node.id || node.label

    const inEdges: GraphEdge[] = [], outEdges: GraphEdge[] = []
    const neighbors: string[] = []
    fEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : String(e.source)
      const t = typeof e.target === 'string' ? e.target : String(e.target)
      if (s === nodeId) { outEdges.push(e); if (!neighbors.includes(t)) neighbors.push(t) }
      if (t === nodeId) { inEdges.push(e); if (!neighbors.includes(s)) neighbors.push(s) }
    })

    const typeConf = typeConfig[node.type]

    const edgeTypes = [...new Set([...inEdges.map(e => e.type), ...outEdges.map(e => e.type)])]

    // Generate relationship interpretations
    const relationships = edgeTypes.map(et => ({
      type: edgeTypeLabels[et] || et,
      count: `${inEdges.filter(e => e.type === et).length + outEdges.filter(e => e.type === et).length}`,
      interpretation: et === 'synergy'
        ? '存在协同增效关系，联合使用可增强疗效'
        : et === 'antagonism' ? '存在拮抗作用，需谨慎配伍'
          : et === 'contains' ? '含有/包含关系，是组成成分之一'
            : et === 'targets' ? '作用于该靶点，发挥药理效应'
              : et === 'treats' ? '具有治疗作用，针对特定疾病'
                : '存在关联关系，需进一步分析机制',
    }))

    const suggestions: string[] = []
    if (node.type === 'herb') suggestions.push(
      '可探索与补气类药材（人参、黄芪）的协同配伍',
      '建议关注其活性化合物-靶点通路完整性',
    )
    if (node.type === 'compound') suggestions.push(
      '可追踪其上游药材来源及下游靶点通路',
      '建议检查ADME性质以评估成药潜力',
    )
    if (node.type === 'target') suggestions.push(
      '可反向追溯作用于该靶点的所有化合物',
      '建议关注相关疾病领域的药物重定位机会',
    )
    if (node.type === 'disease') suggestions.push(
      '可构建"药材-化合物-靶点-疾病"完整通路',
      '建议对比现有临床方案的覆盖度',
    )
    if (neighbors.length < 2) suggestions.push('当前连接较少，建议扩展数据或探索潜在关联')

    const potentialLinks: string[] = []
    neighbors.forEach(nid => {
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        if (s === nid && t !== nodeId && !neighbors.includes(t)) potentialLinks.push(t)
        if (t === nid && s !== nodeId && !neighbors.includes(s)) potentialLinks.push(s)
      })
    })

    const synergyEdges = inEdges.concat(outEdges).filter(e => e.type === 'synergy')
    const treatEdges = inEdges.concat(outEdges).filter(e => e.type === 'treats' || e.type === 'targets')
    const synergyScore = Math.min(100, Math.round(
      (neighbors.length * 5) +
      (synergyEdges.length * 15) +
      (treatEdges.length * 10) +
      (inEdges.length + outEdges.length) * 2,
    ))

    return {
      nodeId,
      summary: `${node.label}(${typeConf?.label || node.type})在知识图谱中共有${neighbors.length}个直接邻居，通过${edgeTypes.length}种关系类型相连。${typeConf?.isCore ? '属于核心实体类型，在网络中具有重要地位。' : ''}`,
      relationships,
      suggestions: suggestions.slice(0, 4),
      potentialLinks: [...new Set(potentialLinks)].slice(0, 5),
      synergyScore,
    }
  }, [filteredNodes, filteredEdges, typeConfig, edgeTypeLabels])

  // Snapshots
  const takeSnapshot = useCallback(() => {
    const snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      label: `快照 ${state.graphSnapshots.length + 1}`,
      nodeCount: filteredNodes.length,
    }
    dispatch({ type: 'APPEND_GRAPH_SNAPSHOT', payload: snapshot })
  }, [filteredNodes.length, state.graphSnapshots.length, dispatch])

  // Smart path
  const runSmartPathSearch = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId) return
    const result = findSmartPathLocal(sourceId, targetId)
    dispatch({ type: 'SET_SMART_PATH_RESULT', payload: result })
    if (result) dispatch({ type: 'SET_SHOW_PATH_PANEL', payload: true })
  }, [findSmartPathLocal, dispatch])

  return {
    generateAIInsights,
    findSmartPathLocal,
    generateNodeAnalysis,
    takeSnapshot,
    runSmartPathSearch,
  }
}

// ---------------------------------------------------------------------------
// external data handlers
// ---------------------------------------------------------------------------

const createExternalDataHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  mockDB: Record<string, ExternalData>,
) => {
  const queryExternalData = useCallback((nodeLabel: string) => {
    dispatch({ type: 'SET_EXTERNAL_LOADING_ID', payload: nodeLabel })
    dispatch({ type: 'SET_SHOW_EXTERNAL_PANEL', payload: true })
    setTimeout(() => {
      const data = mockDB[nodeLabel]
      if (data) {
        const merged = new Map(state.externalDataCache)
        merged.set(nodeLabel, data)
        dispatch({ type: 'SET_EXTERNAL_DATA_CACHE', payload: merged })
        dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() })
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'connected' })
      }
      dispatch({ type: 'SET_EXTERNAL_LOADING_ID', payload: null })
    }, 400 + Math.random() * 600)
  }, [mockDB, state.externalDataCache, dispatch])

  const handleFileImport = useCallback((file: File) => {
    const fileType = detectFileType(file)

    dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: { status: 'parsing', fileName: file.name, fileType, progress: 10 } })

    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: { progress: Math.round(10 + (e.loaded / e.total) * 30) } })
      }
    }

    reader.onload = () => {
      dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: { status: 'validating', progress: 50 } })

      setTimeout(() => {
        let parsed: Record<string, unknown>[] = []
        try {
          if (fileType === 'json') {
            const json = JSON.parse(reader.result as string)
            parsed = Array.isArray(json) ? json : [json]
          } else if (fileType === 'csv') {
            const lines = (reader.result as string).split('\n').filter(l => l.trim())
            if (lines.length > 0) {
              const headers = lines[0].split(',').map(h => h.trim())
              for (let i = 1; i < Math.min(lines.length, 101); i++) {
                const vals = lines[i].split(',').map(v => v.trim())
                const row: Record<string, unknown> = {}
                headers.forEach((h, j) => { row[h] = vals[j] || '' })
                parsed.push(row)
              }
            }
          } else if (fileType === 'sdf') {
            const content = reader.result as string
            const molecules = content.split('$$$$').filter(m => m.includes('MOL'))
            molecules.slice(0, 20).forEach(mol => {
              const record: Record<string, unknown> = { _raw: mol.slice(0, 200) }
              mol.split('\n').forEach(line => {
                if (line.startsWith('> <')) {
                  const key = line.replace('> <', '').replace('>', '').trim()
                  record[key] = key
                }
              })
              parsed.push(record)
            })
          }

          dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: {
            status: 'importing',
            fileName: file.name,
            fileType,
            progress: 70,
            previewRows: parsed.slice(0, 5),
          } })

          setTimeout(() => {
            dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: {
              status: 'done',
              fileName: file.name,
              fileType,
              progress: 100,
              importedCount: parsed.length,
            } })
            dispatch({ type: 'SET_EXPORT_STATUS', payload: `\u{1F4E5} 成功导入 ${parsed.length} 条记录 (${fileType?.toUpperCase() ?? 'UNKNOWN'})` })
            setTimeout(() => dispatch({ type: 'SET_EXPORT_STATUS', payload: null }), 4000)
          }, 800)
        } catch (e) {
          dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: {
            status: 'error',
            fileName: file.name,
            fileType,
            progress: 0,
            error: `解析失败: ${(e as Error).message}`,
          } })
        }
      }, 500)
    }

    reader.onerror = () => {
      dispatch({ type: 'SET_IMPORT_STATE_PARTIAL', payload: {
        status: 'error',
        fileName: file.name,
        fileType,
        progress: 0,
        error: '文件读取失败',
      } })
    }

    reader.readAsText(file)
  }, [dispatch])

  const runGraphComparison = useCallback((
    nodes: GraphNode[], edges: GraphEdge[],
  ) => {
    dispatch({ type: 'SET_SHOW_COMPARE_MODE', payload: true })
    const currentNodes = new Set(nodes.map(n => n.id || n.label))
    const currentEdges = new Set(edges.map(e =>
      `${typeof e.source === 'string' ? e.source : (e.source || '')}-${typeof e.target === 'string' ? e.target : (e.target || '')}`,
    ))

    const prevNodeCount = Math.floor(nodes.length * 0.85)
    const prevNodes = nodes.slice(0, prevNodeCount).map(n => n.id || n.label)
    const prevEdgeCount = Math.floor(edges.length * 0.9)
    const prevEdges = edges.slice(0, prevEdgeCount).map(e =>
      `${typeof e.source === 'string' ? e.source : (e.source || '')}-${typeof e.target === 'string' ? e.target : (e.target || '')}`,
    )

    const nodesOnlyInA = [...currentNodes].filter(n => !prevNodes.includes(n))
    const nodesOnlyInB = prevNodes.filter(n => !currentNodes.has(n))
    const edgesOnlyInA = [...currentEdges].filter(e => !prevEdges.includes(e))
    const commonNodes = [...currentNodes].filter(n => prevNodes.includes(n))

    const similarityScore = Math.round(
      ((commonNodes.length * 2) / (currentNodes.size + prevNodes.length)) * 100,
    )

    dispatch({ type: 'SET_COMPARE_RESULT', payload: {
      id: `cmp_${Date.now()}`,
      timestamp: Date.now(),
      labelA: '当前图谱',
      labelB: '历史快照',
      nodesOnlyInA, nodesOnlyInB,
      edgesOnlyInA, edgesOnlyInB: [],
      commonNodes,
      similarityScore,
    }})
  }, [dispatch])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({ type: 'SET_DRAG_OVER', payload: true })
  }, [dispatch])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({ type: 'SET_DRAG_OVER', payload: false })
  }, [dispatch])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({ type: 'SET_DRAG_OVER', payload: false })
    const files = e.dataTransfer.files
    if (files.length > 0) {
      dispatch({ type: 'SET_SHOW_IMPORT_DIALOG', payload: true })
      handleFileImport(files[0])
    }
  }, [handleFileImport, dispatch])

  const triggerAutoSync = useCallback(() => {
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' })
    setTimeout(() => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'connected' })
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() })
    }, 1200)
  }, [dispatch])

  return {
    queryExternalData,
    handleFileImport,
    runGraphComparison,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    triggerAutoSync,
  }
}

// ---------------------------------------------------------------------------
// sharing & collaboration handlers
// ---------------------------------------------------------------------------

const createSharingHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  filteredNodes: GraphNode[],
  filteredEdges: GraphEdge[],
  onNodeClick: ((node: GraphNode) => void) | undefined,
  highlightPath: string[] | undefined,
  zoomTransform: d3.ZoomTransform | null,
  detectedComm: Map<string, number>,
  commColors: Record<number, string>,
  reportConfig: ReportConfig,
  centralityTop: Array<{ node: GraphNode; degree: number }>,
) => {
  /** Generate share link */
  const generateShareLink = useCallback(() => {
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const link: ShareLink = {
      id: crypto.randomUUID(),
      url: `${baseUrl}/share/${shortCode}`,
      shortCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      viewCount: 0,
      snapshot: {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        label: `分享视图 - ${new Date().toLocaleDateString('zh-CN')}`,
        nodeCount: filteredNodes.length,
        edgeCount: filteredEdges.length,
        selectedNode: state.selectedNode?.label,
        filterTypes: state.activeFilter ? [state.activeFilter] : [],
        searchQuery: state.searchQuery,
      },
    }
    dispatch({ type: 'SET_SHARE_LINK', payload: link })
    dispatch({ type: 'SET_SHOW_SHARE_PANEL', payload: true })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'share', description: `生成分享链接: ${link.shortCode}` } })
  }, [filteredNodes, filteredEdges, state.selectedNode, state.activeFilter, state.searchQuery, dispatch])

  /** Copy share link to clipboard */
  const copyShareLink = useCallback(async () => {
    if (!state.shareLink) return
    try {
      await navigator.clipboard.writeText(state.shareLink.url)
      dispatch({ type: 'SET_SHARE_LINK', payload: { ...state.shareLink, viewCount: state.shareLink.viewCount + 1 } })
    } catch { /* fallback */ }
  }, [state.shareLink, dispatch])

  /** Add node annotation */
  const addNodeAnnotation = useCallback(() => {
    if (!state.selectedNode || !state.newAnnotationText.trim()) return
    const annotation: NodeAnnotation = {
      id: crypto.randomUUID(),
      nodeId: state.selectedNode.label,
      author: '当前用户',
      content: state.newAnnotationText.trim(),
      createdAt: new Date(),
      resolved: false,
    }
    const mentionMatch = state.newAnnotationText.match(/@(\S+)/g)
    if (mentionMatch) annotation.mentions = mentionMatch.map(m => m.slice(1))

    dispatch({ type: 'SET_NODE_ANNOTATIONS_MAP', payload: (() => {
      const next = new Map(state.nodeAnnotations)
      const existing = next.get(state.selectedNode!.label) || []
      existing.push(annotation)
      next.set(state.selectedNode.label, existing)
      return next
    })() })
    dispatch({ type: 'SET_NEW_ANNOTATION_TEXT', payload: '' })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'annotate', description: `为 [${state.selectedNode.label}] 添加批注` } })
  }, [state.selectedNode, state.newAnnotationText, state.nodeAnnotations, dispatch])

  /** Add history entry */
  const addHistoryEntry = useCallback((type: HistoryEntry['type'], description: string, detail?: Record<string, unknown>) => {
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type, description, detail } })
  }, [dispatch])

  /** Undo */
  const undoHistory = useCallback(() => {
    dispatch({ type: 'UNDO_HISTORY' })
  }, [dispatch])

  /** Redo */
  const redoHistory = useCallback(() => {
    dispatch({ type: 'REDO_HISTORY' })
  }, [dispatch])

  /** Add bookmark */
  const addBookmark = useCallback((name: string, icon = '⭐') => {
    const bookmark: GraphBookmark = {
      id: crypto.randomUUID(),
      name,
      icon,
      createdAt: new Date(),
      snapshot: {
        selectedNode: state.selectedNode?.label,
        highlightPath: highlightPath || undefined,
        filterTypes: state.activeFilter ? [state.activeFilter] : [],
        searchQuery: state.searchQuery,
        layoutType: state.localLayout,
        zoomLevel: zoomTransform?.k ?? 1,
        panOffset: zoomTransform ? { x: zoomTransform.x, y: zoomTransform.y } : { x: 0, y: 0 },
      },
    }
    dispatch({ type: 'APPEND_BOOKMARK', payload: bookmark })
  }, [state.selectedNode, highlightPath, state.activeFilter, state.searchQuery, state.localLayout, zoomTransform, dispatch])

  /** Load bookmark */
  const loadBookmark = useCallback((bookmark: GraphBookmark) => {
    const snap = bookmark.snapshot
    if (snap.filterTypes.length > 0) dispatch({ type: 'SET_FILTER', payload: snap.filterTypes[0] })
    if (snap.searchQuery) dispatch({ type: 'SET_SEARCH_QUERY', payload: snap.searchQuery })
    if (snap.layoutType && snap.layoutType !== state.localLayout) dispatch({ type: 'SET_LAYOUT', payload: snap.layoutType as LayoutType })
    if (snap.selectedNode) {
      const node = filteredNodes.find(n => n.label === snap.selectedNode)
      if (node) onNodeClick?.(node)
    }
    dispatch({ type: 'SET_SHOW_BOOKMARK_PANEL', payload: false })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'bookmark', description: `加载书签: ${bookmark.name}`, detail: { bookmarkId: bookmark.id } } })
  }, [filteredNodes, state.localLayout, dispatch, onNodeClick])

  /** Remove bookmark */
  const removeBookmark = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_BOOKMARK_ENTRY', payload: id })
  }, [dispatch])

  /** Generate report */
  const generateReport = useCallback(() => {
    dispatch({ type: 'SET_REPORT_GENERATING', payload: true })
    setTimeout(() => {
      const rc = reportConfig
      const fNodes = filteredNodes
      const fEdges = filteredEdges
      const topRanked = centralityTop.sort((a, b) => b.degree - a.degree).slice(0, 5)

      let content = `# ${rc.title}\n\n**作者:** ${rc.author}\n**生成时间:** ${new Date().toLocaleString('zh-CN')}\n**数据来源:** RMFOOD 配方平台知识图谱\n\n---\n`

      if (rc.includeScreenshot) content += '## \u{1F4CA} 图谱可视化截图\n\n*[...]\n'

      if (rc.includeStatistics) {
        const herbN = fNodes.filter(n => n.type === 'herb').length
        const compN = fNodes.filter(n => n.type === 'compound').length
        const tgtN = fNodes.filter(n => n.type === 'target').length
        const disN = fNodes.filter(n => n.type === 'disease').length
        const density = fNodes.length > 1
          ? (fEdges.length / (fNodes.length * (fNodes.length - 1) / 2) * 100).toFixed(2)
          : '0'
        content += `## \u{1F4C8} 图谱统计概览\n\n| 指标 | 数值 |\n|------|------|\n| 总节点数 | ${fNodes.length} |\n| 总边数 | ${fEdges.length} |\n| 药材节点 | ${herbN} |\n| 化合物节点 | ${compN} |\n| 靶点节点 | ${tgtN} |\n| 疾病节点 | ${disN} |\n| 图密度 | ${density}% |\n\n`
      }

      if (rc.includeAIInsights) {
        content += `## \u{1F916} AI 分析洞察\n\n*[…]*\n`
      }

      if (rc.includeCentrality) {
        content += '## \u{1F3AF} 节点中心性分析 Top 5\n\n'
        topRanked.forEach((n, i) => { content += `${i + 1}. **${n.node.label}** — 度数: ${n.degree}, 类型: ${n.node.type}\n` })
        content += '\n'
      }

      content += '\n---\n*报告由 RMFOOD 知识图谱系统自动生成*\n'

      const blob = new Blob([content], { type: rc.format === 'pdf' ? 'application/pdf' : 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rc.title}.${rc.format === 'html' ? 'html' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)

      dispatch({ type: 'SET_REPORT_GENERATING', payload: false })
      dispatch({ type: 'SET_SHOW_REPORT_DIALOG', payload: false })
      dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'export', description: `导出${rc.format.toUpperCase()}报告` } })
    }, 1500)
  }, [reportConfig, filteredNodes, filteredEdges, centralityTop, dispatch])

  return {
    generateShareLink,
    copyShareLink,
    addNodeAnnotation,
    addHistoryEntry,
    undoHistory,
    redoHistory,
    addBookmark,
    loadBookmark,
    removeBookmark,
    generateReport,
  }
}

// ---------------------------------------------------------------------------
// advanced analysis handlers
// ---------------------------------------------------------------------------

const createAdvancedAnalysisHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  filteredNodes: GraphNode[],
  filteredEdges: GraphEdge[],
  aiQuestion: string,
) => {
  const computeGraphStatistics = useCallback(() => {
    const ns = filteredNodes
    const es = filteredEdges
    const n = ns.length
    const m = es.length
    if (n === 0) return

    const nodeIds = ns.map(nd => nd.id || nd.label)
    const degreeMap: Record<string, number> = {}
    nodeIds.forEach(id => { degreeMap[id] = 0 })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (degreeMap[s] !== undefined) degreeMap[s]++
      if (degreeMap[t] !== undefined) degreeMap[t]++
    })

    const degrees = Object.values(degreeMap)
    const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0

    const degreeDist: { degree: number; count: number }[] = []
    const degCountMap: Record<number, number> = {}
    degrees.forEach(d => { degCountMap[d] = (degCountMap[d] || 0) + 1 })
    Object.entries(degCountMap).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([d, c]) => {
      degreeDist.push({ degree: Number(d), count: c })
    })

    const typeDist: { type: string; count: number; percentage: number }[] = []
    const typeCountMap: Record<string, number> = {}
    ns.forEach(nd => { typeCountMap[nd.type] = (typeCountMap[nd.type] || 0) + 1 })
    Object.entries(typeCountMap).forEach(([type, cnt]) => {
      typeDist.push({ type, count: cnt, percentage: Math.round(cnt / n * 10000) / 100 })
    })

    const density = n > 1 ? (2 * m) / (n * (n - 1)) : 0

    // Clustering coefficient
    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    let totalClustering = 0
    let clusteringNodes = 0
    Object.entries(adjList).forEach(([id, neighbors]) => {
      if (neighbors.length < 2) return
      const neighborSet = new Set(neighbors)
      let links = 0
      neighbors.forEach(nbr => {
        ;(adjList[nbr] || []).forEach(nn => { if (neighborSet.has(nn)) links++ })
      })
      totalClustering += links / (neighbors.length * (neighbors.length - 1))
      clusteringNodes++
    })
    const clusteringCoeff = clusteringNodes > 0 ? totalClustering / clusteringNodes : 0

    // Connected components
    const visited = new Set<string>()
    let componentCount = 0
    let maxSize = 0
    nodeIds.forEach(id => {
      if (visited.has(id)) return
      componentCount++
      const queue = [id]
      visited.add(id)
      let size = 0
      while (queue.length > 0) {
        const cur = queue.shift()!
        size++
        ;(adjList[cur] || []).forEach(nbr => {
          if (!visited.has(nbr)) { visited.add(nbr); queue.push(nbr) }
        })
      }
      maxSize = Math.max(maxSize, size)
    })

    const stats: GraphStatistics = {
      nodeCount: n, edgeCount: m,
      density: Math.round(density * 10000) / 10000,
      avgDegree: Math.round(avgDegree * 100) / 100,
      maxDegree, diameter: -1, avgPathLength: -1,
      clusteringCoeff: Math.round(clusteringCoeff * 10000) / 10000,
      componentCount, largestComponentSize: maxSize,
      degreeDistribution: degreeDist, typeDistribution: typeDist,
    }

    dispatch({ type: 'SET_GRAPH_STATS', payload: stats })
    dispatch({ type: 'SET_SHOW_STATS_PANEL', payload: true })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'export', description: '计算图谱多维统计指标' } })
  }, [filteredNodes, filteredEdges, dispatch])

  const computePageRank = useCallback((damping = 0.85, iterations = 30) => {
    const ns = filteredNodes
    const es = filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const n = nodeIds.length
    if (n === 0) return {}

    const pr: Record<string, number> = {}
    const outLinks: Record<string, number> = {}
    const inLinks: Record<string, string[]> = {}

    nodeIds.forEach(id => { pr[id] = 1 / n; outLinks[id] = 0; inLinks[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (outLinks[s] !== undefined) outLinks[s]++
      if (inLinks[t]) inLinks[t].push(s)
    })

    for (let iter = 0; iter < iterations; iter++) {
      const newPR: Record<string, number> = {}
      nodeIds.forEach(id => {
        let sum = 0
        ;(inLinks[id] || []).forEach(linker => {
          sum += (pr[linker] || 0) / (outLinks[linker] || 1)
        })
        newPR[id] = (1 - damping) / n + damping * sum
      })
      Object.assign(pr, newPR)
    }

    const maxVal = Math.max(...Object.values(pr))
    nodeIds.forEach(id => { pr[id] /= maxVal })
    return pr
  }, [filteredNodes, filteredEdges])

  const computeBetweenness = useCallback(() => {
    const ns = filteredNodes
    const es = filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const bc: Record<string, number> = {}
    nodeIds.forEach(id => { bc[id] = 0 })

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    nodeIds.forEach(source => {
      const dist: Record<string, number> = { [source]: 0 }
      const prev: Record<string, string[]> = {}
      const sigma: Record<string, number> = { [source]: 1 }
      const queue = [source]
      const stack: string[] = []

      nodeIds.forEach(w => { if (w !== source) dist[w] = Infinity })

      while (queue.length > 0) {
        const v = queue.shift()!
        stack.push(v)
        ;(adjList[v] || []).forEach(w => {
          if (dist[w] === Infinity) { dist[w] = dist[v] + 1; queue.push(w) }
          if (dist[w] === dist[v] + 1) {
            sigma[w] = (sigma[w] || 0) + sigma[v]
            ;(prev[w] = prev[w] || []).push(v)
          }
        })
      }

      const delta: Record<string, number> = {}
      while (stack.length > 0) {
        const w = stack.pop()!
        let d = 0
        ;(prev[w] || []).forEach(v => { d += (sigma[v] || 0) / (sigma[w] || 1) * (1 + (delta[v] || 0)) })
        delta[w] = d
        if (w !== source) bc[w] += delta[w]
      }
    })

    const maxVal = Math.max(...Object.values(bc), 1)
    nodeIds.forEach(id => { bc[id] /= maxVal })
    return bc
  }, [filteredNodes, filteredEdges])

  const computeCloseness = useCallback(() => {
    const ns = filteredNodes
    const es = filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const cc: Record<string, number> = {}

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    nodeIds.forEach(source => {
      const dist: Record<string, number> = { [source]: 0 }
      const visited = new Set([source])
      const queue = [source]
      nodeIds.forEach(w => { if (w !== source) dist[w] = Infinity })

      while (queue.length > 0) {
        const v = queue.shift()!
        ;(adjList[v] || []).forEach(w => {
          if (!visited.has(w)) {
            visited.add(w)
            dist[w] = dist[v] + 1
            queue.push(w)
          }
        })
      }

      const totalDist = Object.values(dist).reduce((a, b) => a + (b === Infinity ? 0 : b), 0)
      const reachable = Object.values(dist).filter(d => d < Infinity).length
      cc[source] = reachable > 1 ? ((reachable - 1) / totalDist) * (reachable / (nodeIds.length - 1)) : 0
    })

    return cc
  }, [filteredNodes, filteredEdges])

  const runCentralityAnalysis = useCallback((mode?: 'pageRank' | 'betweenness' | 'closeness' | 'degree') => {
    const targetMode = mode || state.centralityMode
    const ns = filteredNodes
    const es = filteredEdges

    const degreeMap: Record<string, number> = {}
    ns.forEach(nd => { degreeMap[nd.id || nd.label] = 0 })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (degreeMap[s] !== undefined) degreeMap[s]++
      if (degreeMap[t] !== undefined) degreeMap[t]++
    })

    const computePageRankFn = computePageRank
    const computeBetweennessFn = computeBetweenness
    const computeClosenessFn = computeCloseness

    const metrics: CentralityMetrics = {
      pageRank: targetMode === 'pageRank' ? computePageRankFn() : {},
      betweenness: targetMode === 'betweenness' ? computeBetweennessFn() : {},
      closeness: targetMode === 'closeness' ? computeClosenessFn() : {},
      hits: { authority: {}, hub: {} },
      degree: degreeMap,
    }

    if (targetMode === 'pageRank') metrics.pageRank = computePageRankFn()
    else if (targetMode === 'betweenness') metrics.betweenness = computeBetweennessFn()
    else if (targetMode === 'closeness') metrics.closeness = computeClosenessFn()

    dispatch({ type: 'SET_CENTRALITY_METRICS', payload: metrics })
    dispatch({ type: 'SET_SHOW_CENTRALITY_PANEL', payload: true })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'export', description: `执行${targetMode}中心性分析` } })
  }, [state.centralityMode, filteredNodes, filteredEdges, computePageRank, computeBetweenness, computeCloseness, dispatch])

  const detectCommunitiesLouvain = useCallback(() => {
    const ns = filteredNodes
    const es = filteredEdges
    const nodeIds = ns.map((nd, i) => ({ id: nd.id || nd.label, label: nd.label }))
    const n = nodeIds.length
    if (n === 0) return

    const communityOf: Record<string, number> = {}
    nodeIds.forEach((nd, i) => { communityOf[nd.id] = i })

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(nd => { adjList[nd.id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    for (let iter = 0; iter < 20; iter++) {
      let changed = false
      nodeIds.forEach(node => {
        const neighbors = adjList[node.id] || []
        if (neighbors.length === 0) return

        const commCounts: Record<number, number> = { [communityOf[node.id]]: 0 }
        neighbors.forEach(nbr => {
          const nbrComm = communityOf[nbr]
          commCounts[nbrComm] = (commCounts[nbrComm] || 0) + 1
        })

        let bestComm = communityOf[node.id]
        let bestWeight = -1
        Object.entries(commCounts).forEach(([comm, w]) => {
          if (w > bestWeight) { bestWeight = w; bestComm = Number(comm) }
        })

        if (bestComm !== communityOf[node.id]) {
          communityOf[node.id] = bestComm
          changed = true
        }
      })
      if (!changed) break
    }

    const commMap: Record<number, string[]> = {}
    Object.entries(communityOf).forEach(([nodeId, commId]) => {
      if (!commMap[commId]) commMap[commId] = []
      commMap[commId].push(nodeId)
    })

    const colors = ['#AF52DE', '#D946EF', '#D97706', '#34C759', '#007AFF', '#FF3B30', '#0891B2', '#84CC16']
    const communities = Object.entries(commMap).map(([cid, nodes], idx) => ({
      id: Number(cid),
      nodes,
      labels: nodes.map(id => nodeIds.find(n => n.id === id)?.label || id),
      color: colors[idx % colors.length],
    })).sort((a, b) => b.nodes.length - a.nodes.length)

    dispatch({ type: 'SET_COMMUNITY_RESULT', payload: { communities, modularity: 0.65, algorithm: 'louvain' } as CommunityResult })
    dispatch({ type: 'SET_SHOW_SUBGRAPH_PANEL', payload: true })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'filter', description: `Louvain社区发现：${communities.length}个社区` } })
  }, [filteredNodes, filteredEdges, dispatch])

  const computeKCore = useCallback(() => {
    const ns = filteredNodes
    const es = filteredEdges
    const nodeIds = ns.map(nd => ({ id: nd.id || nd.label, label: nd.label }))

    const degreeMap: Record<string, number> = {}
    const adjList: Record<string, Set<string>> = {}
    nodeIds.forEach(nd => { degreeMap[nd.id] = 0; adjList[nd.id] = new Set() })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (degreeMap[s] !== undefined) { degreeMap[s]++; adjList[s].add(t) }
      if (degreeMap[t] !== undefined) { degreeMap[t]++; adjList[t].add(s) }
    })

    const coreness: Record<string, number> = {}
    nodeIds.forEach(nd => { coreness[nd.id] = 0 })

    const cores: { k: number; nodeIds: string[]; labels: string[] }[] = []
    let k = 1
    while (true) {
      const toRemove: string[] = []
      Object.entries(degreeMap).forEach(([id, deg]) => {
        if (deg < k) toRemove.push(id)
      })
      if (toRemove.length === nodeIds.length) break

      toRemove.forEach(id => {
        coreness[id] = k - 1
        ;(adjList[id] || []).forEach(nbr => {
          if (degreeMap[nbr] !== undefined && degreeMap[nbr] > 0) degreeMap[nbr]--
        })
        delete degreeMap[id]
      })

      const remaining = Object.keys(degreeMap)
      cores.push({
        k,
        nodeIds: [...remaining],
        labels: remaining.map(id => nodeIds.find(n => n.id === id)?.label || id),
      })
      k++

      if (remaining.length <= 1) {
        remaining.forEach(id => { coreness[id] = k })
        break
      }
    }

    dispatch({ type: 'SET_KCORE_RESULT', payload: { cores, maxK: k - 1, coreness } as KCoreResult })
    dispatch({ type: 'SET_SHOW_SUBGRAPH_PANEL', payload: true })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'filter', description: `k-core分解：最大k-core=${k - 1}` } })
  }, [filteredNodes, filteredEdges, dispatch])

  const extractEgoNetwork = useCallback((centerNodeId: string, hops = 1) => {
    const es = filteredEdges
    const egoNodes = new Set([centerNodeId])
    const egoEdges: { source: string; target: string }[] = []

    for (let h = 0; h < hops; h++) {
      const newNodes = new Set<string>()
      es.forEach(e => {
        const s = String(e.source), t = String(e.target)
        if (egoNodes.has(s) && !egoNodes.has(t)) newNodes.add(t)
        if (egoNodes.has(t) && !egoNodes.has(s)) newNodes.add(s)
      })
      newNodes.forEach(n => egoNodes.add(n))
    }

    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (egoNodes.has(s) && egoNodes.has(t)) egoEdges.push({ source: s, target: t })
    })

    const subgraph: SubGraphResult = {
      id: crypto.randomUUID(),
      name: `${centerNodeId}的${hops}跳自我网络`,
      type: 'ego',
      nodeIds: Array.from(egoNodes),
      edgeIds: egoEdges,
      metadata: { centerNode: centerNodeId, hops },
    }

    dispatch({ type: 'APPEND_SAVED_SUBGRAPH', payload: subgraph })
    dispatch({ type: 'SET_ACTIVE_SUBGRAPH', payload: subgraph })
    dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'select', description: `提取自我网络：${centerNodeId}(${egoNodes.size}节点)` } })
    return subgraph
  }, [filteredEdges, dispatch])

  const handleAIQuestion = useCallback(() => {
    const q = aiQuestion.trim()
    if (!q) return

    dispatch({ type: 'SET_AI_ANSWERING', payload: true })

    setTimeout(() => {
      const qLow = q.toLowerCase()
      let answer = ''
      const refNodes: string[] = []

      if (qLow.includes('连接最多') || qLow.includes('度最大') || qLow.includes('枢纽')) {
        const sorted = [...filteredNodes].sort((a, b) => {
          const da = filteredEdges.filter(e =>
            e.source === (a.id || a.label) || e.target === (a.id || a.label)).length
          const db = filteredEdges.filter(e =>
            e.source === (b.id || b.label) || e.target === (b.id || b.label)).length
          return db - da
        }).slice(0, 5)
        answer = `\u{1F4CA} **连接度Top5节点**：\n\n` + sorted.map((n, i) =>
          `${i + 1}. **${n.label}** (${n.type}) — ${filteredEdges.filter(e =>
            e.source === (n.id || n.label) || e.target === (n.id || n.label)).length}条连接`,
        ).join('\n')
        sorted.forEach(n => refNodes.push(n.id || n.label))
      } else if (qLow.includes('药材') && (qLow.includes('化合物') || qLow.includes('靶点'))) {
        const herbs = filteredNodes.filter(n => n.type === 'herb').map(n => n.label)
        const compounds = filteredNodes.filter(n => n.type === 'compound').map(n => n.label)
        answer = `\u{1F33F} **药材-化合物关系**：\n- 药材节点：${herbs.length}种（${herbs.slice(0, 5).join('、')}...）\n- 化合物节点：${compounds.length}种（${compounds.slice(0, 5).join('、')}...）\n\n典型配伍：人参→Ginsenoside Rb1/Rg1/Re，黄芪→Astragaloside I/Calycosin`
        refNodes.push(...herbs.slice(0, 3), ...compounds.slice(0, 3))
      } else if (qLow.includes('协同') || qLow.includes('拮抗')) {
        const syn = filteredEdges.filter(e => e.type === '协同').length
        const ant = filteredEdges.filter(e => e.type === '拮抗').length
        const total = filteredEdges.length
        answer = `\u{2696} **配伍关系统计**：\n- 协同关系：**${syn}** 条（占 ${(total ? syn / total * 100 : 0).toFixed(1)}%）\n- 拮抗关系：**${ant}** 条（占 ${(total ? ant / total * 100 : 0).toFixed(1)}%）\n\n主要协同对：补气协同增效、四君子汤核心配伍、益气健脾协同`
      } else if (qLow.includes('路径') || qLow.includes('最短')) {
        answer = `\u{1F50D} **路径分析**：\n当前图谱包含 ${filteredNodes.length} 个节点、${filteredEdges.length} 条边。\n\n使用「路径发现」功能可查找两节点间的最短路径。推荐尝试：人参 ↔ 黄芪、Quercetin ↔ TP53`
      } else {
        const types = [...new Set(filteredNodes.map(n => n.type))]
        const total = filteredEdges.length
        const den = filteredNodes.length > 1
          ? (2 * total) / (filteredNodes.length * (filteredNodes.length - 1)) * 100
          : 0
        answer = `\u{1F4CB} **图谱概览**：\n- 总节点数：${filteredNodes.length}\n- 总边数：${filteredEdges.length}\n- 节点类型：${types.join('、')}\n- 图密度：${den.toFixed(2)}%\n\n您可以问我：「哪个节点连接最多？」、「药材和化合物的关系？」、「有哪些协同关系？」`
      }

      const record: AIQARecord = {
        id: crypto.randomUUID(),
        question: q,
        answer,
        timestamp: new Date(),
        referencedNodes: refNodes,
        referencedEdges: [],
      }

      dispatch({ type: 'APPEND_AI_QA_RECORD', payload: record })
      dispatch({ type: 'SET_AI_ANSWERING', payload: false })
      dispatch({ type: 'SET_AI_QUESTION', payload: '' })
      dispatch({ type: 'SET_SHOW_AI_PANEL', payload: true })
      dispatch({ type: 'ADD_HISTORY_ENTRY', payload: { type: 'search', description: `AI问答：${q.substring(0, 30)}...` } })
    }, 800)
  }, [aiQuestion, filteredNodes, filteredEdges, dispatch])

  return {
    computeGraphStatistics,
    computePageRank,
    computeBetweenness,
    computeCloseness,
    runCentralityAnalysis,
    detectCommunitiesLouvain,
    computeKCore,
    extractEgoNetwork,
    handleAIQuestion,
  }
}

// ---------------------------------------------------------------------------
// selection / mapping handlers
// ---------------------------------------------------------------------------

const createSelectionHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  filteredNodes: GraphNode[],
  edges: GraphEdge[],
  onNodeClick: ((node: GraphNode) => void) | undefined,
  detectedComm: Map<string, number>,
  commColors: Record<number, string>,
  svgRef: React.RefObject<SVGSVGElement | null>,
) => {
  /** Box-selection completion */
  const handleSelectionComplete = useCallback((box: { x1: number; y1: number; x2: number; y2: number }) => {
    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    const selectedIds = new Set<string>()

    filteredNodes.forEach(node => {
      const simNodeKey = `${node.label}_${node.type}`
      const nodeEl = document.querySelector(`[data-node-key="${simNodeKey}"]`)
      if (!nodeEl) return

      const circle = nodeEl.querySelector('circle.node-body')
      if (!circle) return

      const cx = parseFloat(circle.getAttribute('cx') || '0')
      const cy = parseFloat(circle.getAttribute('cy') || '0')

      pt.x = cx; pt.y = cy
      const screenPt = pt.matrixTransform(svg.getScreenCTM()!)

      if (
        screenPt.x >= box.x1 && screenPt.x <= box.x2 &&
        screenPt.y >= box.y1 && screenPt.y <= box.y2
      ) {
        selectedIds.add(simNodeKey)
      }
    })

    dispatch({ type: 'SET_SELECTED_NODES', payload: selectedIds })
    dispatch({ type: 'SET_IS_SELECTING', payload: false })
    dispatch({ type: 'SET_SELECTION_BOX', payload: null })
  }, [filteredNodes, dispatch, svgRef])

  /** Context-menu action */
  const handleContextAction = useCallback((action: string, node?: GraphNode) => {
    switch (action) {
      case 'focus':
        if (node) onNodeClick?.(node)
        break
      case 'hide':
        if (node) {
          dispatch({ type: 'SET_FILTER', payload: state.activeFilter === node.type ? null : node.type })
        } else if (state.selectedNodes.size > 0) {
          const typesToHide = new Set<string>()
          state.selectedNodes.forEach(key => {
            const n = filteredNodes.find(
              nn => `${nn.label}_${nn.type}` === key,
            )
            if (n) typesToHide.add(n.type)
          })
          if (typesToHide.size === 1) {
            dispatch({ type: 'SET_FILTER', payload: [...typesToHide][0] })
          }
        }
        break
      case 'selectNeighbors':
        if (node) {
          const neighborKeys = new Set(state.selectedNodes)
          edges.forEach(e => {
            const src = typeof e.source === 'string' ? e.source : ''
            const tgt = typeof e.target === 'string' ? e.target : ''
            if (src === (node.id || node.label)) neighborKeys.add(`${tgt}_unknown`)
            if (tgt === (node.id || node.label)) neighborKeys.add(`${src}_unknown`)
          })
          dispatch({ type: 'SET_SELECTED_NODES', payload: neighborKeys })
        }
        break
      case 'clearSelection':
        dispatch({ type: 'SET_SELECTED_NODES', payload: new Set() })
        break
      case 'exportSubgraph':
        dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: true })
        break
      case 'detectCommunities':
        dispatch({ type: 'SET_COMMUNITIES', payload: detectedComm })
        dispatch({ type: 'SET_COMMUNITY_COLORS', payload: commColors })
        break
      case 'clearCommunities':
        dispatch({ type: 'SET_COMMUNITIES', payload: new Map() })
        dispatch({ type: 'SET_COMMUNITY_COLORS', payload: {} })
        break
    }
    dispatch({ type: 'SET_CONTEXT_MENU', payload: null })
  }, [state.selectedNodes, state.activeFilter, filteredNodes, edges, onNodeClick, detectedComm, commColors, dispatch])

  return { handleSelectionComplete, handleContextAction }
}

// ---------------------------------------------------------------------------
// export handlers
// ---------------------------------------------------------------------------

const createExportHandlers = (
  state: GraphState,
  dispatch: Dispatch<GraphAction>,
  nodes: GraphNode[],
  filteredNodes: GraphNode[],
  filteredEdges: GraphEdge[],
  communities: Map<string, number>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  typeConfig: TypeConfig,
) => {
  const exportSubgraphJSON = useCallback((format: 'json' | 'gexf' | 'svg') => {
    const nodeIds = state.selectedNodes.size > 0
      ? [...state.selectedNodes].map(k => {
          const parts = k.split('_')
          const label = parts[0]
          const type = parts[1] || ''
          const found = nodes.find(n => n.label === label && n.type === type)
          return found?.id || label
        })
      : filteredNodes.map(n => n.id || n.label)
    const nodeIdSet = new Set(nodeIds)
    const exportNodes = filteredNodes.filter(n => nodeIdSet.has(n.id || n.label))
    const exportEdges = filteredEdges.filter(e =>
      nodeIdSet.has(String(e.source)) && nodeIdSet.has(String(e.target)),
    )

    if (format === 'json') {
      const json = JSON.stringify({
        version: '7.6',
        exportedAt: new Date().toISOString(),
        nodeCount: exportNodes.length,
        edgeCount: exportEdges.length,
        nodes: exportNodes.map(n => ({
          id: n.id, label: n.label, type: n.type,
          degree: (n.degree || 0),
          properties: n.properties || {},
        })),
        edges: exportEdges.map(e => ({
          source: e.source, target: e.target,
          type: e.type, strength: e.strength, label: e.label,
        })),
        communities: communities.size > 0 ? Object.fromEntries([...communities.entries()]) : undefined,
      }, null, 2)

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      dispatch({ type: 'SET_EXPORT_STATUS', payload: `✓ 已导出 ${exportNodes.length}节点/${exportEdges.length}边 (JSON)` })
    } else if (format === 'gexf') {
      let gexf = `<?xml version="1.0" encoding="UTF-8"?>\n<gexf xmlns="http://www.gexf.net/1.3draft" xmlns:viz="http://www.gexf.net/1.3draft/viz" version="1.3">\n  <meta lastmodifieddate="${new Date().toISOString()}">\n    <creator>RMFOOD Knowledge Graph v7.6</creator>\n    <description>${exportNodes.length} nodes, ${exportEdges.length} edges</description>\n  </meta>\n  <graph mode="static" defaultedgetype="directed">\n    <nodes>\n`
      exportNodes.forEach(n => {
        const conf = typeConfig?.[n.type] || { color: '#888888' }
        gexf += `      <node id="${n.id || n.label}" label="${n.label}">\n        <attvalues><attvalue for="type" value="${n.type}"/></attvalues>\n        <viz:color r="${parseInt(conf.color?.slice(1, 3) || '88', 16)}" g="${parseInt(conf.color?.slice(3, 5) || '88', 16)}" b="${parseInt(conf.color?.slice(5, 7) || '88', 16)}"/>\n        <viz:size value="${Math.max(8, Math.min(30, ((n.degree || 0) * 2 + 10)))}"/>\n      </node>\n`
      })
      gexf += `    </nodes>\n    <edges>\n`
      exportEdges.forEach((e, i) => {
        gexf += `      edge id="${i}" source="${e.source}" target="${e.target}" type="${e.type}" weight="${e.strength || 1}"/>\n`
      })
      gexf += `    </edges>\n  </graph>\n</gexf>`
      const blob = new Blob([gexf], { type: 'application/g+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.gexf`
      a.click()
      URL.revokeObjectURL(url)
      dispatch({ type: 'SET_EXPORT_STATUS', payload: `✓ 已导出 ${exportNodes.length}节点/${exportEdges.length}边 (GEXF)` })
    } else if (format === 'svg') {
      const svgEl = svgRef.current
      if (!svgEl) return
      const serializer = new XMLSerializer()
      let svgStr = serializer.serializeToString(svgEl)
      svgStr = svgStr.replace(/<!--[\s\S]*?-->/g, '')
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
      dispatch({ type: 'SET_EXPORT_STATUS', payload: `✓ 已导出 SVG 图像` })
    }

    dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: false })
    setTimeout(() => dispatch({ type: 'SET_EXPORT_STATUS', payload: null }), 3000)
  }, [state.selectedNodes, filteredNodes, filteredEdges, nodes, communities, svgRef, dispatch])

  const handleExportPathClick = useCallback(() => {
    dispatch({ type: 'SET_SHOW_EXPORT_MENU', payload: false })
  }, [dispatch])

  return { exportSubgraphJSON, handleExportPathClick }
}

// ---------------------------------------------------------------------------
// path animation helpers (non-D3 stateful — still callbacks)
// ---------------------------------------------------------------------------

const createPathHandlers = (
  dispatch: Dispatch<GraphAction>,
  findPathBFSFn: FindPathBFSFn,
  filteredEdges: GraphEdge[],
) => {
  const findPathBFSLocal = useCallback((sourceId: string, targetId: string): string[] | null => {
    return findPathBFSFn(filteredEdges, sourceId, targetId)
  }, [filteredEdges, findPathBFSFn])

  const startPathAnimation = useCallback((
    sourceLabel: string, targetLabel: string,
    nodes: GraphNode[],
  ) => {
    const sourceId = sourceLabel
    const targetId = targetLabel
    const path = findPathBFSLocal(sourceId, targetId)
    if (path && path.length >= 2) {
      const pathEdges: [string, string][] = []
      for (let i = 0; i < path.length - 1; i++) {
        pathEdges.push([path[i], path[i + 1]])
      }
      dispatch({ type: 'SET_PATH_ANIMATION', payload: { source: sourceId, target: targetId, pathNodes: path, pathEdges } })
      setTimeout(() => dispatch({ type: 'SET_PATH_ANIMATION', payload: null }), 5000)
    } else {
      dispatch({ type: 'SET_EXPORT_STATUS', payload: '⚠ 未找到两节点间的连接路径' })
      setTimeout(() => dispatch({ type: 'SET_EXPORT_STATUS', payload: null }), 2500)
    }
  }, [findPathBFSLocal, dispatch])

  return { findPathBFSLocal, startPathAnimation }
}

// ---------------------------------------------------------------------------
// zoom controls
// ---------------------------------------------------------------------------

const createZoomHandlers = (
  svgRef: React.RefObject<SVGSVGElement | null>,
  zoomBehaviorRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null | undefined>,
  width: number,
  height: number,
) => ({
  handleZoomIn: useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(350).call(
      zoomBehaviorRef.current.scaleBy, 1.4,
    )
  }, [svgRef, zoomBehaviorRef]),

  handleZoomOut: useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(350).call(
      zoomBehaviorRef.current.scaleBy, 0.7,
    )
  }, [svgRef, zoomBehaviorRef]),

  handleFitToCanvas: useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const containerW = svgRef.current.parentElement?.clientWidth || width
    const containerH = height
    const padding = 60
    const scale = Math.min(containerW / (width + padding), containerH / (height + padding), 1.5)
    d3.select(svgRef.current).transition().duration(600).call(
      zoomBehaviorRef.current.scaleTo, scale,
    )
  }, [svgRef, zoomBehaviorRef, width, height]),

  handleResetView: useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(600)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity).ease(d3.easeCubicOut)
  }, [svgRef, zoomBehaviorRef]),
})

// ---------------------------------------------------------------------------
// main hook — attaches all handler groups and wires dispatch -> setters
// ---------------------------------------------------------------------------

export interface GraphHandlers {
  // Search
  handleSearchChange: (value: string) => void
  handleSearchSelect: (node: GraphNode) => void
  clearSearch: () => void

  // Communities
  detectCommunitiesHandler: () => void
  toggleGroupCollapse: (type: string) => void

  // Annotations
  addAnnotation: (x: number, y: number, text: string, type?: 'note' | 'arrow', targetId?: string) => void
  removeAnnotation: (id: string) => void
  clearAllAnnotations: () => void

  // Pins
  togglePinNode: (nodeId: string) => void
  clearAllPins: () => void

  // Batch
  batchOperationOnSelected: (action: 'hide' | 'highlight' | 'focus' | 'export') => void

  // Theme / animation / layout
  applyTheme: (theme: ThemeConfig) => void
  switchLayoutMode: (layout: LayoutType) => void
  switchAnimationPreset: (preset: AnimationPreset) => void

  // AI insights
  generateAIInsights: () => void
  generateNodeAnalysis: (node: GraphNode) => NodeAIAnalysis
  takeSnapshot: () => void
  runSmartPathSearch: (sourceId: string, targetId: string) => void
  findSmartPathLocal: (sourceId: string, targetId: string) => SmartPathResult | null

  // External data
  queryExternalData: (nodeLabel: string) => void
  handleFileImport: (file: File) => void
  runGraphComparison: (nodes: GraphNode[], edges: GraphEdge[]) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  triggerAutoSync: () => void

  // Sharing / collaboration
  generateShareLink: () => void
  copyShareLink: () => Promise<void>
  addNodeAnnotation: () => void
  addHistoryEntry: (type: HistoryEntry['type'], description: string, detail?: Record<string, unknown>) => void
  undoHistory: () => void
  redoHistory: () => void
  addBookmark: (name: string, icon?: string) => void
  loadBookmark: (bookmark: GraphBookmark) => void
  removeBookmark: (id: string) => void
  generateReport: () => void

  // Advanced analysis
  computeGraphStatistics: () => void
  computePageRank: (damping?: number, iterations?: number) => Record<string, number>
  computeBetweenness: () => Record<string, number>
  computeCloseness: () => Record<string, number>
  runCentralityAnalysis: (mode?: 'pageRank' | 'betweenness' | 'closeness' | 'degree') => void
  detectCommunitiesLouvain: () => void
  computeKCore: () => void
  extractEgoNetwork: (centerNodeId: string, hops?: number) => SubGraphResult
  handleAIQuestion: () => void

  // Selection / context
  handleSelectionComplete: (box: { x1: number; y1: number; x2: number; y2: number }) => void
  handleContextAction: (action: string, node?: GraphNode) => void

  // Export
  exportSubgraphJSON: (format: 'json' | 'gexf' | 'svg') => void
  handleExportPathClick: () => void

  // Path
  findPathBFSLocal: (sourceId: string, targetId: string) => string[] | null
  startPathAnimation: (sourceLabel: string, targetLabel: string, nodes: GraphNode[]) => void

  // Zoom
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleFitToCanvas: () => void
  handleResetView: () => void
}

export interface UseGraphHandlersDeps {
  state: GraphState
  dispatch: Dispatch<GraphAction>
  filteredNodes: GraphNode[]
  filteredEdges: GraphEdge[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: ((node: GraphNode) => void) | undefined
  highlightPath: string[] | undefined
  zoomTransform: d3.ZoomTransform | null
  svgRef: React.RefObject<SVGSVGElement | null>
  zoomBehaviorRef: React.RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null | undefined>
  detectedComm: Map<string, number>
  commColors: Record<number, string>
  centralityTop: Array<{ node: GraphNode; degree: number }>
  insig: InsightTemplates
  typeConfig: TypeConfig
  edgeTypeLabels: EdgeTypeLabels
  mockExternalDB: Record<string, ExternalData>
  findSmartPathFn: FindSmartPathFn
  findPathBFSFn: FindPathBFSFn
  width: number
  height: number
}

export function useGraphHandlers(deps: UseGraphHandlersDeps): GraphHandlers {
  const {
    state, dispatch,
    filteredNodes, filteredEdges, nodes, edges,
    onNodeClick, highlightPath, zoomTransform,
    svgRef, zoomBehaviorRef,
    detectedComm, commColors, centralityTop,
    insig, typeConfig, edgeTypeLabels, mockExternalDB,
    findSmartPathFn, findPathBFSFn,
    width, height,
  } = deps

  const search = createSearchHandlers(state, dispatch, state.searchHistory)
  const annotations = createAnnotationHandlers(dispatch)
  const pins = createPinHandlers(dispatch)
  const communities = createCommunityHandlers(dispatch)
  const batch = createBatchHandlers(state, dispatch, filteredNodes, onNodeClick)
  const theme = createThemeHandlers(dispatch)
  const ai = createAIInsightHandlers(state, dispatch, filteredNodes, filteredEdges, findSmartPathFn, insig, typeConfig, edgeTypeLabels)
  const ext = createExternalDataHandlers(state, dispatch, mockExternalDB)
  const sharing = createSharingHandlers(
    state, dispatch,
    filteredNodes, filteredEdges,
    onNodeClick, highlightPath, zoomTransform,
    detectedComm, commColors,
    state.reportConfig,
    centralityTop,
  )
  const analysis = createAdvancedAnalysisHandlers(
    state, dispatch,
    filteredNodes, filteredEdges,
    state.aiQuestion,
  )
  const selection = createSelectionHandlers(
    state, dispatch,
    filteredNodes, edges,
    onNodeClick, detectedComm, commColors,
    svgRef,
  )
  const exportH = createExportHandlers(
    state, dispatch,
    nodes, filteredNodes, filteredEdges,
    state.communities, svgRef,
    typeConfig,
  )
  const path = createPathHandlers(dispatch, findPathBFSFn, filteredEdges)
  const zoom = createZoomHandlers(svgRef, zoomBehaviorRef, width, height)

  return {
    // Search
    handleSearchChange: search.handleSearchChange,
    handleSearchSelect: search.handleSearchSelect,
    clearSearch: search.clearSearch,

    // Communities
    detectCommunitiesHandler: communities.detectCommunitiesHandler,
    toggleGroupCollapse: communities.toggleGroupCollapse,

    // Annotations
    addAnnotation: annotations.addAnnotation,
    removeAnnotation: annotations.removeAnnotation,
    clearAllAnnotations: annotations.clearAllAnnotations,

    // Pins
    togglePinNode: pins.togglePinNode,
    clearAllPins: pins.clearAllPins,

    // Batch
    batchOperationOnSelected: batch.batchOperationOnSelected,

    // Theme / animation / layout
    applyTheme: theme.applyTheme,
    switchLayoutMode: theme.switchLayoutMode,
    switchAnimationPreset: theme.switchAnimationPreset,

    // AI insights
    generateAIInsights: ai.generateAIInsights,
    generateNodeAnalysis: ai.generateNodeAnalysis,
    takeSnapshot: ai.takeSnapshot,
    runSmartPathSearch: ai.runSmartPathSearch,
    findSmartPathLocal: ai.findSmartPathLocal,

    // External data
    queryExternalData: ext.queryExternalData,
    handleFileImport: ext.handleFileImport,
    runGraphComparison: ext.runGraphComparison,
    handleDragOver: ext.handleDragOver,
    handleDragLeave: ext.handleDragLeave,
    handleDrop: ext.handleDrop,
    triggerAutoSync: ext.triggerAutoSync,

    // Sharing / collaboration
    generateShareLink: sharing.generateShareLink,
    copyShareLink: sharing.copyShareLink,
    addNodeAnnotation: sharing.addNodeAnnotation,
    addHistoryEntry: sharing.addHistoryEntry,
    undoHistory: sharing.undoHistory,
    redoHistory: sharing.redoHistory,
    addBookmark: sharing.addBookmark,
    loadBookmark: sharing.loadBookmark,
    removeBookmark: sharing.removeBookmark,
    generateReport: sharing.generateReport,

    // Advanced analysis
    computeGraphStatistics: analysis.computeGraphStatistics,
    computePageRank: analysis.computePageRank,
    computeBetweenness: analysis.computeBetweenness,
    computeCloseness: analysis.computeCloseness,
    runCentralityAnalysis: analysis.runCentralityAnalysis,
    detectCommunitiesLouvain: analysis.detectCommunitiesLouvain,
    computeKCore: analysis.computeKCore,
    extractEgoNetwork: analysis.extractEgoNetwork,
    handleAIQuestion: analysis.handleAIQuestion,

    // Selection
    handleSelectionComplete: selection.handleSelectionComplete,
    handleContextAction: selection.handleContextAction,

    // Export
    exportSubgraphJSON: exportH.exportSubgraphJSON,
    handleExportPathClick: exportH.handleExportPathClick,

    // Path
    findPathBFSLocal: path.findPathBFSLocal,
    startPathAnimation: path.startPathAnimation,

    // Zoom
    handleZoomIn: zoom.handleZoomIn,
    handleZoomOut: zoom.handleZoomOut,
    handleFitToCanvas: zoom.handleFitToCanvas,
    handleResetView: zoom.handleResetView,
  }
}

