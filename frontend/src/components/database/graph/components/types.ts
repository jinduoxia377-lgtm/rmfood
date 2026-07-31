/** Shared type exports used by graph UI component files. */

import { GraphNode, AnimationPreset } from '../types'
export type { AnimationPreset }

export interface LegendItem {
  type: string
  color: string
  label: string
  icon: string
}

export type TypeCounts = Record<string, number>

export interface SmartPathResultV80 {
  sourceId: string
  targetId: string
  path: string[]
  length: number
  intermediateNodes: string[]
  keyBridges: string[]
  alternativePaths: Array<{ path: string[]; length: number }>
}

/** v8.0: AI 洞察 */
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

/** v8.0: Node-level AI analysis */
export interface NodeAIAnalysisData {
  nodeId: string
  summary: string
  relationships: { type: string; count: string; interpretation: string }[]
  suggestions: string[]
  potentialLinks: string[]
  synergyScore: number
}

/** v8.3: Graph statistics */
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

/** Community/cluster result */
export interface CommunityResult {
  communities: { id: number; nodes: string[]; labels: string[]; color: string }[]
  modularity: number
  algorithm: 'louvain' | 'label-prop' | 'connected'
}

/** k-core decomposition result */
export interface KCoreResult {
  cores: { k: number; nodeIds: string[]; labels: string[] }[]
  maxK: number
  coreness: Record<string, number>
}

/** Subgraph extraction result */
export interface SubGraphResult {
  id: string
  name: string
  type: 'kcore' | 'community' | 'ego' | 'path' | 'custom'
  nodeIds: string[]
  edgeIds: { source: string; target: string }[]
  metadata: Record<string, unknown>
}

/** Report generation config */
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

/** Operation history entry */
export interface HistoryEntry {
  id: string
  timestamp: Date
  type: 'filter' | 'search' | 'select' | 'layout' | 'theme' | 'zoom' | 'focus' | 'export' | 'annotate' | 'bookmark' | 'import' | 'share'
  description: string
  detail?: Record<string, unknown>
  reversible: boolean
}

/** Graph bookmark */
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

/** Centrilty mode */
export type CentralityMode = 'pageRank' | 'betweenness' | 'closeness' | 'degree'

/** LOD rendering levels */
export type LODLevel = 'full' | 'reduced' | 'minimal'

/** Performance stats */
export interface PerfStats {
  fps: number
  frameTime: number
  rating: 'excellent' | 'good' | 'fair' | 'poor'
  memoryEst: string
  lodLevel: string
}

/** Search match for fuzzy search */
export interface SearchMatch {
  node: GraphNode
  score: number
  matchFields: string[]
}
