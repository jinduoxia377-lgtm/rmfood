/**
 * Shared types, constants, and utilities for the D3 force simulation engine.
 * Re-exported so both KnowledgeGraph.tsx and graph/engine/forceSimulation.ts can import them.
 */

import * as d3 from 'd3'

// ═══════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════

export interface GraphNode {
  id: string
  label: string
  type: 'herb' | 'compound' | 'target' | 'disease' | 'peptide' | 'protein' | 'food'
  x?: number
  y?: number
  degree?: number
  properties?: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  type: string
  strength?: number
  label?: string
  basis?: string
}

/** Internal simulated node type (augmented with D3 physics attributes) */
export interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  degree?: number
}

/** Internal edge type used by force simulation */
export interface SimEdge {
  source: string | SimNode
  target: string | SimNode
  type: string
  strength?: number
  label?: string
  basis?: string
}

export type LayoutType = 'force' | 'radial' | 'tree' | 'hierarchical' | 'circular' | 'grid'

/** v7.9: Theme color scheme */
export interface ThemeConfig {
  id: string
  name: string
  icon: string
  bgGradient: string
  nodeColors: Record<string, { color: string; glow: string }>
  edgeBaseColor: string
  canvasBg: string
  panelBg: string
  textPrimary: string
  textSecondary: string
  accentColor: string
}

export type AnimationPreset = 'fadeIn' | 'expand' | 'converge' | 'none'

// ═══════════════════════════════════════════
// 常量配置 v6.0
// ═══════════════════════════════════════════

/** Node type configuration — v7.0: WCAG 2.1 AA compliant */
export const TYPE_CONFIG: Record<string, {
  color: string
  glow: string
  size: number
  minSize: number
  maxSize: number
  label: string
  icon: string
  isCore: boolean
}> = {
  herb:     { color: '#1E8E3E', glow: 'rgba(4,120,87,0.35)',   size: 26, minSize: 18, maxSize: 44, label: '药材',   icon: '🌿', isCore: true },
  compound: { color: '#0052AE', glow: 'rgba(29,78,216,0.35)',   size: 16, minSize: 10, maxSize: 30, label: '化合物', icon: '⚗️', isCore: false },
  target:   { color: '#D97706', glow: 'rgba(180,83,9,0.35)',    size: 14, minSize: 9,  maxSize: 26, label: '靶点',   icon: '🎯', isCore: false },
  disease:  { color: '#DC2626', glow: 'rgba(185,28,28,0.35)',    size: 18, minSize: 12, maxSize: 34, label: '疾病',   icon: '🩺', isCore: true },
  peptide:  { color: '#8B5CF6', glow: 'rgba(109,40,217,0.35)',  size: 18, minSize: 12, maxSize: 34, label: '肽',     icon: '🧬', isCore: true },
  protein:  { color: '#9D174D', glow: 'rgba(190,24,93,0.35)',  size: 15, minSize: 10, maxSize: 28, label: '蛋白质', icon: '🔬', isCore: false },
  food:     { color: '#C2410C', glow: 'rgba(194,65,12,0.35)',   size: 16, minSize: 10, maxSize: 30, label: '食物',   icon: '🍽️', isCore: false },
}

export const DEFAULT_TYPE = TYPE_CONFIG.compound

/** Type arrangement order */
export const TYPE_ORDER = ['herb', 'compound', 'target', 'disease', 'peptide', 'protein', 'food'] as const

/** Edge type colors and line styles — v7.0: layered thickness system */
export const EDGE_COLORS: Record<string, {
  color: string
  dash: string
  animDash: string
  width: number
  priority: 'core' | 'secondary'
}> = {
  contains:    { color: '#0052AE', dash: '', animDash: '8 4', width: 2.5, priority: 'core' },
  targets:     { color: '#D97706', dash: '4,2', animDash: '6 3', width: 2.5, priority: 'core' },
  treats:      { color: '#DC2626', dash: '',    animDash: '10 5', width: 3.0, priority: 'core' },
  synergy:     { color: '#1E8E3E', dash: '',    animDash: '',    width: 2.0, priority: 'core' },
  antagonism:  { color: '#B91C1C', dash: '3,2', animDash: '4 4', width: 1.5, priority: 'secondary' },
  interacts:   { color: '#8B5CF6', dash: '5,3', animDash: '8 4', width: 1.5, priority: 'secondary' },
  relates_to:  { color: 'var(--color-knowledge-text, #6B7280)', dash: '',    animDash: '',    width: 1.0, priority: 'secondary' },
}

/** v7.2: Edge type Chinese labels */
export const EDGE_TYPE_LABELS: Record<string, string> = {
  contains: '含有',
  targets: '作用于',
  treats: '治疗',
  synergy: '协同增效',
  antagonism: '拮抗',
  interacts: '相互作用',
  relates_to: '相关',
}

/** Performance threshold */
export const PERF_THRESHOLD = 80

/** Degree scale parameters — v7.1: enhanced size difference + density adaptive */
const DEGREE_SCALE_FACTOR = 4.5
const MAX_DEGREE_CAP = 18
const CORE_DEGREE_THRESHOLD = 6
const NODE_SIZE_BOOST_FACTOR = 1.45

// Density-adaptive parameters — v7.1
const DENSITY_HIGH_THRESHOLD = 120
const DENSITY_MEDIUM_THRESHOLD = 60
const DENSITY_SCALE_HIGH = 0.72
const DENSITY_SCALE_MEDIUM = 0.85
const MIN_NODE_RADIUS_FLOOR = 6
const LABEL_HIDE_ZOOM_THRESHOLD = 0.55
const LINK_DISTANCE_MULTIPLIER = 2.8

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

export function getTypeConf(type: string) {
  return TYPE_CONFIG[type] || DEFAULT_TYPE
}

/** v7.1: Calculate global density scale factor */
export function getDensityScale(nodeCount: number): number {
  if (nodeCount > DENSITY_HIGH_THRESHOLD) return DENSITY_SCALE_HIGH
  if (nodeCount > DENSITY_MEDIUM_THRESHOLD) return DENSITY_SCALE_MEDIUM
  return 1.0
}

/** Calculate node radius based on degree — v7.1: density adaptive + core node boost */
export function calcNodeRadius(d: SimNode, densityScale = 1.0): number {
  const conf = getTypeConf(d.type)
  const deg = Math.min(d.degree || 0, MAX_DEGREE_CAP)
  const t = Math.min(deg / MAX_DEGREE_CAP, 1)
  let radius = conf.minSize + (conf.maxSize - conf.minSize) * t
  if (conf.isCore || deg >= CORE_DEGREE_THRESHOLD) {
    radius *= NODE_SIZE_BOOST_FACTOR
  }
  radius *= densityScale
  return Math.max(radius, MIN_NODE_RADIUS_FLOOR)
}

/** Check if node is a core node (for visual hierarchy) */
export function isCoreNode(d: SimNode): boolean {
  return getTypeConf(d.type).isCore || (d.degree || 0) >= CORE_DEGREE_THRESHOLD
}

export function calcInitialPosition(
  n: GraphNode,
  index: number,
  total: number,
  layout: LayoutType,
  containerWidth: number,
  containerHeight: number,
  typeCountMap?: Record<string, number>,
): [number, number] {
  const centerX = containerWidth / 2
  const centerY = containerHeight / 2

  if (layout === 'radial') {
    const typeIndex = TYPE_ORDER.indexOf(n.type as typeof TYPE_ORDER[number])
    const angleOffset = (typeIndex >= 0 ? typeIndex : 0) * (Math.PI / 4)
    const angle = angleOffset + (index / Math.max(total, 1)) * 2 * Math.PI
    const radius = Math.min(containerWidth, containerHeight) * 0.35
    return [
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    ]
  }

  if (layout === 'tree') {
    let level: number
    if (n.type === 'herb') level = 0
    else if (n.type === 'compound') level = 1
    else if (n.type === 'target') level = 2
    else level = 3

    const x = 80 + level * ((containerWidth - 160) / 3)
    const y = 60 + (index / Math.max(total, 1)) * (containerHeight - 120)
    return [x, y]
  }

  if (layout === 'hierarchical') {
    const typeOrder: Record<string, number> = { herb: 0, compound: 1, target: 2, disease: 3, peptide: 4, protein: 5, food: 6 }
    const level = typeOrder[n.type] ?? 3
    const levels = 7
    const levelHeight = containerHeight / levels
    const typeNodes = typeCountMap || { herb: 0, compound: 0, target: 0, disease: 0, peptide: 0, protein: 0, food: 0 }
    const countInLevel = typeNodes[n.type] || Math.ceil(total / levels)
    const col = index % Math.max(Math.ceil(countInLevel / 8), 1)
    const row = Math.floor(index / Math.max(Math.ceil(countInLevel / 8), 1))
    const x = 60 + (col / Math.max(Math.ceil(countInLevel / 8) - 1, 1)) * (containerWidth - 120)
    const y = level * levelHeight + 20 + row * (levelHeight - 40) / Math.max(Math.ceil(countInLevel / 8) / Math.ceil(countInLevel / 8), 8)
    return [x, y]
  }

  if (layout === 'circular') {
    const typeOrder: Record<string, number> = { herb: 0, compound: 1, target: 2, disease: 3, peptide: 4, protein: 5, food: 6 }
    const ringIndex = typeOrder[n.type] ?? 3
    const rings = 7
    const maxRadius = Math.min(containerWidth, containerHeight) * 0.42
    const minRadius = Math.min(containerWidth, containerHeight) * 0.08
    const ringRadius = minRadius + (ringIndex / (rings - 1)) * (maxRadius - minRadius)
    const typeCount = typeCountMap || { herb: 0, compound: 0, target: 0, disease: 0, peptide: 0, protein: 0, food: 0 }
    const nodesInRing = typeCount[n.type] || Math.ceil(total / rings)
    const angle = (index % Math.max(nodesInRing, 1)) / Math.max(nodesInRing, 1) * 2 * Math.PI - Math.PI / 2
    return [
      centerX + Math.cos(angle) * ringRadius,
      centerY + Math.sin(angle) * ringRadius,
    ]
  }

  if (layout === 'grid') {
    const cols = Math.max(Math.ceil(Math.sqrt(total)), 3)
    const cellW = (containerWidth - 80) / cols
    const cellH = (containerHeight - 80) / Math.max(Math.ceil(total / cols), 1)
    const col = index % cols
    const row = Math.floor(index / cols)
    return [
      40 + col * cellW + cellW / 2,
      40 + row * cellH + cellH / 2,
    ]
  }

  return [
    centerX + (Math.random() - 0.5) * 280,
    centerY + (Math.random() - 0.5) * 280,
  ]
}

/** v7.0: Optimized Bezier curved path — adaptive curvature */
export function curvedLinkPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const curvature = Math.min(dist * 0.12, Math.max(15, dist * 0.08))
  const mx = (sx + tx) / 2 - dy * curvature / dist
  const my = (sy + ty) / 2 + dx * curvature / dist
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
}

/** v7.0: Calculate edge width — core edges 2-3px, secondary 1-1.5px */
export function calcEdgeWidth(edgeType: string, strength?: number): number {
  const edgeConf = EDGE_COLORS[edgeType]
  if (edgeConf?.width) return edgeConf.width
  if (edgeConf?.priority === 'core') return 2.5
  return Math.max(1, (strength || 0.5) * 2.5)
}

// ═══════════════════════════════════════════
// Theme presets (required by the engine to determine default/initial theme)
// ═══════════════════════════════════════════

export const THEME_PRESETS: ThemeConfig[] = [
  {
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
    edgeBaseColor: 'var(--color-knowledge-text, #6B7280)', canvasBg: '#ffffff', panelBg: 'rgba(255,255,255,0.95)',
    textPrimary: '#1F2937', textSecondary: '#6B7280', accentColor: 'var(--color-secondary-500)',
  },
  {
    id: 'deepSpace', name: '深空探索', icon: '🌌',
    bgGradient: 'linear-gradient(135deg, #111827 0%, #1e1b4b 100%)',
    nodeColors: {
      herb: { color: '#4ADE80', glow: 'rgba(52,211,153,0.40)' },
      compound: { color: '#6ECAFF', glow: 'rgba(96,165,250,0.40)' },
      target: { color: '#F59E0B', glow: 'rgba(251,191,36,0.40)' },
      disease: { color: '#EF4444', glow: 'rgba(248,113,113,0.40)' },
      peptide: { color: '#c084fc', glow: 'rgba(192,132,252,0.40)' },
      protein: { color: '#fb7185', glow: 'rgba(251,113,133,0.40)' },
      food: { color: '#fb923c', glow: 'rgba(251,146,60,0.40)' },
    },
    edgeBaseColor: '#4B5563', canvasBg: '#111827', panelBg: 'rgba(15,23,42,0.95)',
    textPrimary: '#E5E7EB', textSecondary: 'var(--color-knowledge-default, #9CA3AF)', accentColor: '#818cf8',
  },
  {
    id: 'warmSun', name: '暖阳大地', icon: '🌅',
    bgGradient: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3CD 100%)',
    nodeColors: {
      herb: { color: '#166534', glow: 'rgba(21,128,61,0.30)' },
      compound: { color: '#0052AE', glow: 'rgba(29,78,216,0.30)' },
      target: { color: '#D97706', glow: 'rgba(180,83,9,0.30)' },
      disease: { color: '#B91C1C', glow: 'rgba(220,38,38,0.30)' },
      peptide: { color: 'var(--color-accent-500)', glow: 'rgba(124,58,237,0.30)' },
      protein: { color: '#9D174D', glow: 'rgba(190,24,93,0.30)' },
      food: { color: '#c2410c', glow: 'rgba(194,65,12,0.30)' },
    },
    edgeBaseColor: '#a16207', canvasBg: '#fefce8', panelBg: 'rgba(254,252,232,0.95)',
    textPrimary: '#451a03', textSecondary: '#854d0e', accentColor: '#C2410C',
  },
  {
    id: 'forest', name: '森林秘境', icon: '🌲',
    bgGradient: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
    nodeColors: {
      herb: { color: '#065f46', glow: 'rgba(6,95,70,0.35)' },
      compound: { color: '#003E87', glow: 'rgba(30,64,175,0.35)' },
      target: { color: '#D97706', glow: 'rgba(146,64,14,0.35)' },
      disease: { color: '#DC2626', glow: 'rgba(153,27,27,0.35)' },
      peptide: { color: '#7C3AED', glow: 'rgba(91,33,182,0.35)' },
      protein: { color: '#831843', glow: 'rgba(157,23,77,0.35)' },
      food: { color: '#9a3412', glow: 'rgba(154,52,18,0.35)' },
    },
    edgeBaseColor: '#4d7c0f', canvasBg: '#F0FDF4', panelBg: 'rgba(236,253,245,0.95)',
    textPrimary: '#064e3b', textSecondary: '#6b8f4a', accentColor: 'var(--color-primary-500)',
  },
  {
    id: 'ocean', name: '海洋深邃', icon: '🌊',
    bgGradient: 'linear-gradient(135deg, #F0F7FF 0%, #E8F4FD 100%)',
    nodeColors: {
      herb: { color: '#0d9488', glow: 'rgba(13,148,136,0.35)' },
      compound: { color: 'var(--color-secondary-500)', glow: 'rgba(37,99,235,0.35)' },
      target: { color: '#B45309', glow: 'rgba(217,119,6,0.35)' },
      disease: { color: '#B91C1C', glow: 'rgba(220,38,38,0.35)' },
      peptide: { color: 'var(--color-accent-500)', glow: 'rgba(124,58,237,0.35)' },
      protein: { color: '#BE185D', glow: 'rgba(219,39,119,0.35)' },
      food: { color: '#C2410C', glow: 'rgba(234,88,12,0.35)' },
    },
    edgeBaseColor: '#0369a1', canvasBg: '#f0f9ff', panelBg: 'rgba(240,249,255,0.95)',
    textPrimary: '#0c4a6e', textSecondary: '#0369a1', accentColor: '#0284c7',
  },
]

// Animation presets (already defined above at line 67)
// export type AnimationPreset = 'fadeIn' | 'expand' | 'converge' | 'none'

// Performance stats types
export interface PerfStats { fps: number; frameTime: number; memoryEst: string; lodLevel: string; rating: 'excellent' | 'good' | 'fair' | 'poor'; }
export type LODLevel = 'minimal' | 'reduced' | 'full';
export interface GraphStats { nodeCount: number; edgeCount: number; density: number; avgDegree: number; maxDegree: number; diameter: number; avgPathLength: number; clusteringCoeff: number; componentCount: number; }

// Edge colors for components
export type EdgeColors = Record<string, { color: string; dash?: string; width?: number; priority: string; }>;

// AIPanel props
export interface AIPanelProps { 
  aiInsights: any[];
  showAIPanel: boolean;
  onToggle: () => void;
}
