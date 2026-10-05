// @ts-nocheck
/**
 * Force-directed graph rendering engine.
 *
 * Encapsulates the entire D3 SVG force simulation pipeline:
 * - Arrow markers, SVG filters (glow, drop-shadow)
 * - Zoom behavior and double-click reset
 * - Incremental update fast path (data unchanged → only visual props)
 * - Data preparation (degree calc, position mapping, density scaling)
 * - Force simulation setup (link, charge, center, collision, cluster-by-type, intra-cluster-repel)
 * - Layout transitions (tree, radial, hierarchical, circular, grid)
 * - Edge rendering phase (enter/merge/update with stroke-width, opacity, dashed animation)
 * - Node rendering phase (enter with animations, merge with updates)
 * - Interaction events (hover, click, dblclick, drag)
 * - Tick handler (RAF-throttled with LOD frame-skipping)
 * - Cleanup (simulation stop, RAF cancel, event detach)
 */

import * as d3 from 'd3'
import type { RefObject } from 'react'

// ── Re-export internal types used in the public API ──
export type { SimNode, SimEdge, LayoutType, ThemeConfig } from '../types'
import type { SimNode, SimEdge, LayoutType, ThemeConfig, GraphNode, GraphEdge } from '../types'
import {
  TYPE_CONFIG, EDGE_COLORS, TYPE_ORDER,
  getTypeConf, getDensityScale, calcNodeRadius, isCoreNode,
  calcInitialPosition, curvedLinkPath, calcEdgeWidth,
  PERF_THRESHOLD,
} from '../types'

// ═══════════════════════════════════════════
// Public API types
// ═══════════════════════════════════════════

export interface GraphEngineInput {
  containerRef: RefObject<HTMLDivElement | null>
  svgRef: RefObject<SVGSVGElement | null>
  width: number
  height: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  theme: ThemeConfig
  layout: LayoutType
  lodLevel: 'minimal' | 'reduced' | 'full'
  highlightPath?: string[]
  selectedNodes: Set<string>
  communities: Map<string, number>
  generatedCommunityColors: Record<number, string>
  pinnedNodes: Set<string>
  focusedNodeIndex: number
  animationPreset: string
  dataChanged: boolean
  onSimulationStart?: () => void
  onSimulationTick?: (nodes: SimNode[], links: d3.SimulationLinkDatum<SimNode>[]) => void
  onSimulationEnd?: () => void
  onNodeDrag?: (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>) => void
  onNodeClick?: (node: SimNode) => void
  onNodeDoubleClick?: (event: React.MouseEvent, node: SimNode) => void
  onNodeContextMenu?: (event: React.MouseEvent, node: SimNode) => void
  onSetZoomTransform?: (transform: d3.ZoomTransform) => void
  onSetTooltip?: (tooltip: { x: number; y: number; content: string } | null) => void
  onSetSelectedNode?: (node: SimNode | null) => void
  onTogglePinNode?: (nodeId: string) => void
}

export class GraphEngine {
  private svgEl: SVGSVGElement | null = null
  private container: HTMLDivElement | null = null
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
  private defs: d3.Selection<SVGElement, unknown, null, undefined> | null = null
  private simulation: d3.Simulation<SimNode, undefined> | null = null
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  private rafId: number | null = null
  private ticking = false
  private tickCounter = 0
  private currentLodLevel: string = 'full'
  private densityScale = 1
  private prevLayout?: LayoutType
  // Cached DOM references for tick handler
  private allLinksSel: d3.Selection<SVGPathElement, SimEdge,SVGGElement, unknown> | null = null
  private allLabelsSel: d3.Selection<SVGTextElement, SimEdge, SVGGElement, unknown> | null = null
  private allNodesSel: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null = null

  constructor(private input: GraphEngineInput) {}

  getZoomBehavior(): d3.ZoomBehavior<SVGSVGElement, unknown> | null {
    return this.zoomBehavior
  }

  init(): void {
    const { containerRef, svgRef } = this.input
    this.svgEl = svgRef.current
    this.container = containerRef.current
    if (!this.svgEl || !this.container) return

    this.svg = d3.select(this.svgEl)

    const containerWidth = this.container.clientWidth || this.input.width
    const containerHeight = Math.max(this.input.height, 420)
    this.svg.attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)

    let g = this.svg.select<SVGGElement>('g.graph-container')
    let defs = this.svg.select('defs')

    if (g.empty()) {
      g = this.svg.append('g').attr('class', 'graph-container')
      defs = this.svg.append<SVGDefsElement>('defs')
      this.buildDefs(defs)
      this.setupZoom(g)
    }

    this.g = g
    this.defs = defs as unknown as typeof this.defs
    this.currentLodLevel = this.input.lodLevel
    this.prevLayout = this.input.layout
  }

  update(): void {
    if (!this.svg || !this.g) return

    const { nodes, edges, layout, lodLevel, highlightPath, selectedNodes,
            communities, generatedCommunityColors, dataChanged, pinnedNodes,
            focusedNodeIndex, animationPreset } = this.input
    const containerWidth = this.container?.clientWidth || this.input.width
    const containerHeight = Math.max(this.input.height, 420)

    this.currentLodLevel = lodLevel

    // Detect layout change
    if (this.prevLayout !== layout && this.prevLayout != null) {
      this.prevLayout = layout
      const allNodesSel = this.g!.selectAll<SVGGElement, SimNode>('g.node-group')
      allNodesSel
        .transition().duration(600).ease(d3.easeCubicInOut)
        .attr('transform', (d: SimNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      this.g!.selectAll<SVGPathElement, SimEdge>('path.edge-link')
        .transition().duration(600).ease(d3.easeCubicInOut)
        .style('opacity', 1)
    }

    // ── Incremental fast path ──
    if (!dataChanged) {
      this.doIncrementalUpdate()
      return
    }

    // ── Full render ──
    this.renderFull(nodes, edges, layout, containerWidth, containerHeight,
                    highlightPath, selectedNodes, communities, generatedCommunityColors,
                    pinnedNodes, focusedNodeIndex, animationPreset)
  }

  destroy(): void {
    if (this.simulation) {
      this.simulation.stop()
      this.simulation = null
    }
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.svg && this.svgEl) {
      this.svg.on('.zoom', null)
      this.svg.on('.dblclick', null)
      this.svg.on('.click', null)
    }
    this.allLinksSel = null
    this.allLabelsSel = null
    this.allNodesSel = null
  }

  setZoom(transform: d3.ZoomTransform): void {
    if (!this.svg || !this.zoomBehavior) return
    d3.transition().duration(350).call(this.zoomBehavior!.transform, this.svg!, transform)
  }

  // ────────────────────────────────────────
  // Private methods
  // ────────────────────────────────────────

  private buildDefs(defs: d3.Selection<d3.BaseType, unknown, null, undefined>): void {
    Object.entries(EDGE_COLORS).forEach(([etype, config]) => {
      const isCore = config.priority === 'core'
      defs.append('marker')
        .attr('id', `arrow-${etype}`)
        .attr('viewBox', '0 -6 12 12')
        .attr('refX', isCore ? 26 : 22)
        .attr('refY', 0)
        .attr('markerWidth', isCore ? 8 : 7)
        .attr('markerHeight', isCore ? 8 : 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-6L12,0L0,6L3,-2Z')
        .attr('fill', config.color)
        .attr('fill-opacity', isCore ? 0.85 : 0.7)
    })

    // Outer soft glow
    const outerGlow = defs.append('filter').attr('id', 'glow-outer')
      .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
    outerGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur-out')
    const outerMerge = outerGlow.append('feMerge')
    outerMerge.append('feMergeNode').attr('in', 'blur-out')
    outerMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Inner sharp glow
    const innerGlow = defs.append('filter').attr('id', 'glow-inner')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    innerGlow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur-in')
    innerGlow.append('feComponentTransfer').append('feFuncA')
      .attr('type', 'linear').attr('slope', '1.5')
    const innerMerge = innerGlow.append('feMerge')
    innerMerge.append('feMergeNode').attr('in', 'blur-in')
    innerMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Pulse filter
    const pulseFilter = defs.append('filter').attr('id', 'pulse-glow')
      .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
    pulseFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur-p')
    const pulseMerge = pulseFilter.append('feMerge')
    pulseMerge.append('feMergeNode').attr('in', 'blur-p')
    pulseMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Node drop shadow
    const dropShadow = defs.append('filter').attr('id', 'node-drop-shadow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    dropShadow.append('feDropShadow')
      .attr('dx', '1.5').attr('dy', '2').attr('stdDeviation', '3')
      .attr('flood-color', '#000000').attr('flood-opacity', '0.18')

    // Core node enhanced shadow
    const coreShadow = defs.append('filter').attr('id', 'core-node-shadow')
      .attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%')
    coreShadow.append('feDropShadow')
      .attr('dx', '2').attr('dy', '3').attr('stdDeviation', '4.5')
      .attr('flood-color', '#000000').attr('flood-opacity', '0.25')
  }

  private setupZoom(g: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 8])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString())
        this.input.onSetZoomTransform?.(event.transform)
      })

    this.svgEl?.addEventListener('touchstart', () => {}, { passive: true })
    this.zoomBehavior!(this.svg!)

    this.svgEl?.addEventListener('dblclick', () => {
      d3.transition().duration(600).call(this.zoomBehavior!.transform, this.svg!, d3.zoomIdentity).ease(d3.easeCubicOut)
    })
  }

  private doIncrementalUpdate(): void {
    const g = this.g!
    const allNodes = g.selectAll<SVGGElement, SimNode>('g.node-group')
    const allLinks = g.select<SVGGElement>('g.links')?.selectAll<SVGPathElement, SimEdge>('path.edge-link')

    allNodes.select('.node-body')
      .transition().duration(200)
      .attr('fill', (d: SimNode) => {
        if (this.input.communities.size > 0) {
          const commId = this.input.communities.get(d.id || d.label)
          if (commId !== undefined && this.input.generatedCommunityColors[commId]) {
            return this.input.generatedCommunityColors[commId]
          }
        }
        return getTypeConf(d.type).color
      })
      .attr('stroke', (d: SimNode) => {
        const nodeKey = `${d.label}_${d.type}`
        if (this.input.selectedNodes.has(nodeKey)) return 'var(--color-secondary-500)'
        const highlightSet = new Set(this.input.highlightPath || [])
        return highlightSet.has(d.id) ? '#F59E0B' : 'white'
      })

    const showDecorations = this.currentLodLevel === 'full'
    const showLabels = this.currentLodLevel !== 'minimal'
    allNodes.select('.node-glow-outer').style('opacity', showDecorations ? 1 : 0)
    allNodes.select('.node-glow-ring').style('opacity', showDecorations ? 1 : 0)
    allNodes.select('.node-highlight').style('opacity', showDecorations ? 1 : 0)
    allNodes.select('.degree-badge-bg').style('opacity', showDecorations ? 1 : 0)
    allNodes.select('.degree-badge-text').style('opacity', showDecorations ? 1 : 0)
    allNodes.select('.label-bg').style('opacity', showLabels && showDecorations ? 0.85 : 0)
    allNodes.select('.node-label').style('opacity', showLabels ? 1 : 0)

    if (allLinks && !allLinks.empty()) {
      allLinks.style('opacity', this.currentLodLevel === 'minimal' ? '0.3' : '1')
    }
  }

  private renderFull(
    nodes: GraphNode[],
    edges: GraphEdge[],
    layout: LayoutType,
    containerWidth: number,
    containerHeight: number,
    highlightPath: string[] | undefined,
    selectedNodes: Set<string>,
    communities: Map<string, number>,
    generatedCommunityColors: Record<number, string>,
    _pinnedNodes: Set<string>,
    _focusedNodeIndex: number,
    _animationPreset: string,
  ): void {
    const g = this.g!
    const highlightSet = new Set(highlightPath || [])

    // ── Data preparation ──
    const nodeMap = new Map<string, GraphNode>()
    for (const n of nodes) nodeMap.set(n.id || n.label, n)

    // Calculate degree map from original edges
    const degreeMap = new Map<string, number>()
    for (const e of edges) {
      const sId = typeof e.source === 'string' ? e.source : (e.source as SimNode).id || ''
      const tId = typeof e.target === 'string' ? e.target : (e.target as SimNode).id || ''
      degreeMap.set(sId, (degreeMap.get(sId) || 0) + 1)
      degreeMap.set(tId, (degreeMap.get(tId) || 0) + 1)
    }

    // Preserve existing positions
    const existingPositions = new Map<string, { x: number; y: number }>()
    g.selectAll<SVGGElement, SimNode>('g.node-group').each((d: SimNode) => {
      existingPositions.set(d.id, { x: d.x ?? 0, y: d.y ?? 0 })
    })

    // Count nodes by type
    const typeCountMap: Record<string, number> = {}
    for (const node of nodes) {
      typeCountMap[node.type] = (typeCountMap[node.type] || 0) + 1
    }

    // Build simulation nodes
    const simNodes: SimNode[] = nodes.map((n, i) => {
      const key = n.id || n.label
      const prevPos = existingPositions.get(key)
      const [ix, iy] = calcInitialPosition(n, i, nodes.length, layout, containerWidth, containerHeight, typeCountMap)
      return {
        ...n,
        id: key,
        x: prevPos?.x ?? ix,
        y: prevPos?.y ?? iy,
        fx: layout !== 'force' ? ix : undefined,
        fy: layout !== 'force' ? iy : undefined,
        degree: degreeMap.get(key) || 0,
      } as unknown as SimNode
    })

    // Filter and prepare simulation edges
    const simEdges = edges
      .filter(e => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        strength: e.strength,
        label: e.label,
        basis: e.basis,
      }))

    // ── Force simulation ──
    const isLarge = simNodes.length > PERF_THRESHOLD
    const centerX = containerWidth / 2
    const centerY = containerHeight / 2
    const densityScale = getDensityScale(simNodes.length)
    this.densityScale = densityScale

    let maxPossibleRadius = 0
    for (const n of simNodes) {
      const r = calcNodeRadius(n, densityScale)
      if (r > maxPossibleRadius) maxPossibleRadius = r
    }

    const baseLinkDistance = Math.max(
      maxPossibleRadius * 2.8,
      layout === 'tree' ? 160 : layout === 'radial' ? 140 : 120,
    )

    const densityPadding = simNodes.length > 120 ? 26
      : simNodes.length > 60 ? 22 : 18

    // Stop old simulation
    if (this.simulation) this.simulation.stop()

    const lodTickInterval = this.currentLodLevel === 'minimal' ? 3
      : this.currentLodLevel === 'reduced' ? 2 : 1
    const lodAlphaMultiplier = this.currentLodLevel === 'minimal' ? 1.8
      : this.currentLodLevel === 'reduced' ? 1.3 : 1

    this.simulation = d3.forceSimulation<SimNode>(simNodes)
      .alphaDecay((isLarge ? 0.018 : 0.01) * lodAlphaMultiplier)
      .velocityDecay(isLarge ? 0.38 : 0.26)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges as unknown as d3.SimulationLinkDatum<SimNode>[])
        .id((d: any) => d.id)
        .distance(baseLinkDistance))
      .force('charge', d3.forceManyBody<SimNode>().strength(
        layout === 'force'
          ? (d: SimNode) => {
              const baseStrength = isCoreNode(d) ? -520 : -420
              const densityBonus = simNodes.length > 120 ? 1.25 : 1.1
              return baseStrength * (1 + Math.min(d.degree || 0, 18) * 0.08) * densityBonus
            }
          : -100,
      ))
      .force('center', d3.forceCenter<SimNode>(centerX, centerY))
      .force('collision', d3.forceCollide<any>().radius((d: any) => calcNodeRadius(d as SimNode, densityScale) + densityPadding))

    if (layout === 'force') {
      this.simulation.force('x', d3.forceX<SimNode>(centerX).strength(0.02))
      this.simulation.force('y', d3.forceY<SimNode>(centerY).strength(0.02))

      // Cluster-by-type force
      this.simulation.force('cluster-by-type', () => {
        const k = 0.042
        const clusterRadiusRatio = 0.30
        simNodes.forEach((node) => {
          const typeIdx = TYPE_ORDER.indexOf(node.type as typeof TYPE_ORDER[number])
          if (typeIdx >= 0) {
            const angle = (typeIdx / TYPE_ORDER.length) * Math.PI * 2
            const r = Math.min(containerWidth, containerHeight) * clusterRadiusRatio
            const tx = centerX + Math.cos(angle) * r
            const ty = centerY + Math.sin(angle) * r
            if (node.x !== undefined && node.y !== undefined) {
              node.vx = (node.vx || 0) + (tx - node.x) * k
              node.vy = (node.vy || 0) + (ty - node.y) * k
            }
          }
        })
      })

      // v9.0: Spatial hash grid for intra-cluster repulsion
      this.simulation.force('intra-cluster-repel', () => {
        const repelK = 0.025
        const minDist = maxPossibleRadius * 2.2
        const minDistSq = minDist * minDist
        const maxCheckDist = maxPossibleRadius * 4
        const maxCheckDistSq = maxCheckDist * maxCheckDist
        const cellSize = maxCheckDist

        const typeBuckets = new Map<string, SimNode[]>()
        for (const node of simNodes) {
          if (node.x === undefined || node.y === undefined) continue
          if (!typeBuckets.has(node.type)) typeBuckets.set(node.type, [])
          typeBuckets.get(node.type)!.push(node)
        }

        for (const typedNodes of Array.from(typeBuckets.values())) {
          const grid = new Map<string, SimNode[]>()
          const getGridKey = (x: number, y: number) =>
            `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`

          for (const n of typedNodes) {
            const key = getGridKey(n.x!, n.y!)
            if (!grid.has(key)) grid.set(key, [])
            grid.get(key)!.push(n)
          }

          for (const [key, bucket] of Array.from(grid.entries())) {
            const [gx, gy] = key.split(',').map(Number)
            const neighbors: SimNode[] = []
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const nk = `${gx + dx},${gy + dy}`
                if (grid.has(nk)) neighbors.push(...grid.get(nk)!)
              }
            }

            for (let i = 0; i < bucket.length; i++) {
              const a = bucket[i]
              for (const b of neighbors) {
                if (a === b || b.x === undefined || b.y === undefined) continue
                const ddx = b.x - a.x!
                const ddy = b.y - a.y!
                const distSq = ddx * ddx + ddy * ddy
                if (distSq < maxCheckDistSq && distSq > 1 && distSq < minDistSq) {
                  const dist = Math.sqrt(distSq)
                  const force = (minDist - dist) / dist * repelK
                  a.vx = (a.vx || 0) - ddx * force
                  a.vy = (a.vy || 0) - ddy * force
                  b.vx = (b.vx || 0) + ddx * force
                  b.vy = (b.vy || 0) + ddy * force
                }
              }
            }
          }
        }
      })
    }

    this.input.onSimulationStart?.()

    // ── Edge rendering ──
    this.renderEdges(simEdges, highlightSet)

    // ── Node rendering ──
    this.renderNodes(simNodes, simEdges, densityScale, selectedNodes, communities, generatedCommunityColors, highlightSet, layout)

    // ── Interaction events ──
    this.setupInteractions(simEdges)

    // ── SVG-level events ──
    if (this.svg) {
      this.svg.on('click', () => this.input.onSetSelectedNode?.(null))
      this.svg.on('touchend', () => {})
    }

    // ── Tick handler ──
    this.tickCounter = 0
    const throttledTick = () => {
      this.tickCounter++
      if (this.tickCounter % lodTickInterval !== 0) return

      if (!this.ticking) {
        this.rafId = requestAnimationFrame(() => {
          this.ticking = false
          this.applyTickPositions()
          this.input.onSimulationTick?.(simNodes, simEdges as unknown as d3.SimulationLinkDatum<SimNode>[])
          this.rafId = null
        })
        this.ticking = true
      }
    }

    this.simulation.on('tick', throttledTick)
    this.simulation.on('end', () => {
      this.input.onSimulationEnd?.()
    })
  }

  private renderEdges(simEdges: SimEdge[], highlightSet: Set<string>): void {
    const g = this.g!
    const useCurve = this.input.layout === 'force'

    const linkG = g.select<SVGGElement>('g.links').empty()
      ? g.append('g').attr('class', 'links') : g.select<SVGGElement>('g.links')

    const linkSelection = linkG.selectAll<SVGPathElement, SimEdge>('path.edge-link')
      .data(simEdges, (d: any) => {
        const sId = typeof d.source === 'string' ? d.source : (d.source as SimNode).id
        const tId = typeof d.target === 'string' ? d.target : (d.target as SimNode).id
        return `${sId}-${tId}`
      })

    linkSelection.exit()
      .transition().duration(300)
      .style('opacity', 0)
      .remove()

    const links = linkSelection.join('path')
      .attr('class', 'edge-link')
      .attr('fill', 'none')
      .attr('stroke', d => EDGE_COLORS[d.type]?.color || 'var(--color-knowledge-default, #9CA3AF)')
      .attr('stroke-width', (d) => {
        const baseWidth = calcEdgeWidth(d.type, d.strength)
        const strengthBoost = (d.strength || 0.5) > 0.7 ? 1.4 : (d.strength || 0.5) > 0.4 ? 1.15 : 1.0
        return baseWidth * strengthBoost
      })
      .attr('stroke-opacity', d => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source
        const tId = typeof d.target === 'object' ? d.target.id : d.target
        const baseOpacity = (highlightSet.size === 0 || (highlightSet.has(sId as string) && highlightSet.has(tId as string))) ? 0.55 : 0.07
        const strengthBonus = (d.strength || 0.5) > 0.7 ? 0.12 : (d.strength || 0.5) > 0.4 ? 0.05 : 0
        return Math.min(baseOpacity + strengthBonus, 0.75)
      })
      .attr('stroke-dasharray', d => EDGE_COLORS[d.type]?.animDash || EDGE_COLORS[d.type]?.dash || '')
      .attr('marker-end', d => `url(#arrow-${d.type})`)
      .attr('d', (d: SimEdge) => {
        const sx = (d.source as SimNode).x ?? 0
        const sy = (d.source as SimNode).y ?? 0
        const tx = (d.target as SimNode).x ?? 0
        const ty = (d.target as SimNode).y ?? 0
        const sId = typeof d.source === 'string' ? d.source : (d.source as SimNode)?.id || ''
        const tId = typeof d.target === 'string' ? d.target : (d.target as SimNode)?.id || ''

        let parallelCount = 0
        let parallelIndex = 0
        simEdges.forEach((e: SimEdge) => {
          const esId = typeof e.source === 'string' ? e.source : (e.source as SimNode)?.id || ''
          const etId = typeof e.target === 'string' ? e.target : (e.target as SimNode)?.id || ''
          if ((esId === sId && etId === tId) || (esId === tId && etId === sId)) {
            if (e === d) parallelIndex = parallelCount
            parallelCount++
          }
        })

        if (parallelCount > 1) {
          const midX = (sx + tx) / 2
          const midY = (sy + ty) / 2
          const dx = tx - sx
          const dy = ty - sy
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len > 0) {
            const nx = -dy / len
            const ny = dx / len
            const offset = ((parallelIndex - (parallelCount - 1) / 2)) * 20 * (parallelCount > 3 ? 1.5 : 1)
            return `M${sx},${sy} Q${midX + nx * offset},${midY + ny * offset} ${tx},${ty}`
          }
        }
        return `M${sx},${sy} L${tx},${ty}`
      })
      .style('opacity', 0)
      .transition().duration(500)
      .style('opacity', 1)

    // Animated edge flow
    links.each(function (_d: SimEdge) {
      const el = d3.select(this)
      const dash = el.attr('stroke-dasharray') || ''
      if (dash && dash !== '') {
        el.style('animation', `edge-flow ${2 + Math.random() * 2}s linear infinite`)
      }
    })

    // Edge labels
    const labeledEdges = simEdges.filter(e => e.label)
    const labelG = linkG.select<SVGGElement>('g.edge-labels').empty()
      ? linkG.append('g').attr('class', 'edge-labels') : linkG.select<SVGGElement>('g.edge-labels')

    const linkLabelSel = labelG.selectAll<SVGTextElement, SimEdge>('text.edge-label')
      .data(labeledEdges, (d: any) => {
        const sId = typeof d.source === 'string' ? d.source : (d.source as SimNode).id
        const tId = typeof d.target === 'string' ? d.target : (d.target as SimNode).id
        return `${sId}-${tId}`
      })
    linkLabelSel.exit().remove()
    linkLabelSel.enter()
      .append('text')
      .attr('class', 'edge-label')
      .merge(linkLabelSel)
      .text(d => d.label || '')
      .attr('fill', 'var(--color-knowledge-default, #9CA3AF)')
      .attr('font-size', 9)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')

    // Cache selections for tick handler
    this.allLinksSel = linkG.selectAll<SVGPathElement, SimEdge>('path.edge-link')
    this.allLabelsSel = labelG.selectAll<SVGTextElement, SimEdge>('text.edge-label')
  }

  private renderNodes(
    simNodes: SimNode[],
    simEdges: SimEdge[],
    densityScale: number,
    selectedNodes: Set<string>,
    communities: Map<string, number>,
    generatedCommunityColors: Record<number, string>,
    highlightSet: Set<string>,
    layout: LayoutType,
  ): void {
    const g = this.g!
    const nodeG = g.select<SVGGElement>('g.nodes').empty()
      ? g.append('g').attr('class', 'nodes') : g.select<SVGGElement>('g.nodes')

    // Sort by degree for Z-axis layering
    const sortedSimNodes = [...simNodes].sort((a, b) => (a.degree || 0) - (b.degree || 0))

    const nodeSelection = nodeG.selectAll<SVGGElement, SimNode>('g.node-group')
      .data(sortedSimNodes, (d: any) => d.id)

    // Exit
    const exited = nodeSelection.exit()
    exited.selectAll('.node-body')
      .transition().duration(300)
      .attr('r', 0)
    exited.transition().duration(350).style('opacity', 0).remove()

    // Enter
    const entered = nodeSelection.enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .style('opacity', 0)

    // Outer glow
    entered.append('circle')
      .attr('class', 'node-glow-outer')
      .attr('r', 0)
      .attr('fill', (d: SimNode) => getTypeConf(d.type).glow)
      .attr('filter', 'url(#glow-outer)')
      .transition().delay((_, i) => Math.min(i * 30, 600)).duration(550)
      .ease(d3.easeElasticOut.amplitude(0.8).period(0.6))
      .attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) + 10)

    // Glow ring
    entered.append('circle')
      .attr('class', 'node-glow-ring')
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', (d: SimNode) => getTypeConf(d.type).color)
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1.5)
      .transition().delay((_, i) => Math.min(i * 30 + 80, 650)).duration(450)
      .attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) + 4)

    // Body
    entered.append('circle')
      .attr('class', 'node-body')
      .attr('r', 0)
      .attr('fill', (d: SimNode) => {
        if (communities.size > 0) {
          const commId = communities.get(d.id || d.label)
          if (commId !== undefined && generatedCommunityColors[commId]) {
            return generatedCommunityColors[commId]
          }
        }
        return getTypeConf(d.type).color
      })
      .attr('stroke', (d: SimNode) => {
        const nodeKey = `${d.label}_${d.type}`
        if (selectedNodes.has(nodeKey)) return 'var(--color-secondary-500)'
        return highlightSet.has(d.id || d.label) ? '#F59E0B' : 'white'
      })
      .attr('stroke-width', (d: SimNode) => {
        const nodeKey = `${d.label}_${d.type}`
        if (selectedNodes.has(nodeKey)) return 3
        return highlightSet.has(d.id || d.label) ? 3.5 : 2
      })
      .attr('fill-opacity', (d: SimNode) => highlightSet.size === 0 || highlightSet.has(d.id || d.label) ? 0.94 : 0.28)
      .attr('filter', (d: SimNode) => isCoreNode(d) ? 'url(#core-node-shadow)' : 'url(#node-drop-shadow)')
      .transition().delay((_, i) => Math.min(i * 30, 600)).duration(480)
      .ease(d3.easeBackOut.overshoot(1.35))
      .attr('r', (d: SimNode) => calcNodeRadius(d, densityScale))

    // Highlight point
    entered.append('circle')
      .attr('class', 'node-highlight')
      .attr('r', 0)
      .attr('cx', (d: SimNode) => -calcNodeRadius(d, densityScale) * 0.22)
      .attr('cy', (d: SimNode) => -calcNodeRadius(d, densityScale) * 0.22)
      .attr('fill', 'white')
      .attr('fill-opacity', 0.3)
      .transition().delay((_, i) => Math.min(i * 30 + 120, 720)).duration(380)
      .attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) * 0.38)

    // Degree badge (for nodes with degree >= 5)
    const MAX_DEGREE_CAP = 18
    entered.each(function (d: SimNode) {
      if ((d.degree || 0) >= 5) {
        const group = d3.select(this)
        const dynamicR = calcNodeRadius(d, densityScale)
        const badgeR = Math.min(dynamicR * 0.32, 8)
        group.append('circle')
          .attr('class', 'degree-badge-bg')
          .attr('cx', dynamicR * 0.65)
          .attr('cy', -dynamicR * 0.65)
          .attr('r', 0)
          .attr('fill', 'rgba(255,255,255,0.9)')
          .attr('stroke', getTypeConf(d.type).color)
          .attr('stroke-width', 1.5)
          .transition().delay(400 + Math.random() * 300).duration(300)
          .attr('r', badgeR + 2)
        group.append('text')
          .attr('class', 'degree-badge-text')
          .attr('x', dynamicR * 0.65)
          .attr('y', -dynamicR * 0.65 + 3.5)
          .attr('text-anchor', 'middle')
          .attr('font-size', Math.min(badgeR * 1.2, 8))
          .attr('font-weight', '700')
          .attr('fill', getTypeConf(d.type).color)
          .attr('pointer-events', 'none')
          .text(String(Math.min(d.degree || 0, 99)))
          .style('opacity', 0)
          .transition().delay(500 + Math.random() * 300).duration(250)
          .style('opacity', 1)
      }
    })

    // Hub glow ring for high-degree nodes
    entered.each(function (d: SimNode) {
      const degree = d.degree || 0
      if (degree >= simNodes.reduce((max, n) => Math.max(max, n.degree || 0), 1) * 0.5) {
        const group = d3.select(this)
        const baseR = calcNodeRadius(d, densityScale)
        const maxDeg = Math.max(...simNodes.map(n => n.degree || 0), 1)
        const hubRingR = baseR + 6 + (degree / maxDeg) * 8
        group.insert('circle', ':first-child')
          .attr('class', 'hub-glow-ring')
          .attr('r', 0)
          .attr('fill', 'none')
          .attr('stroke', getTypeConf(d.type).color)
          .attr('stroke-opacity', 0)
          .attr('stroke-width', 2 + (degree / maxDeg) * 2)
          .style('filter', 'url(#glow-outer)')
          .transition().delay(600 + Math.random() * 400).duration(800)
          .ease(d3.easeCubicOut)
          .attr('r', hubRingR)
          .attr('stroke-opacity', 0.35 - (degree / maxDeg) * 0.15)
      }
    })

    // Label
    entered.append('text')
      .attr('class', 'node-label')
      .text((d: SimNode) => d.label.length > 10 ? d.label.slice(0, 10) + '...' : d.label)
      .attr('dy', (d: SimNode) => calcNodeRadius(d, densityScale) + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1F2937')
      .attr('font-size', (d: SimNode) => isCoreNode(d)
        ? Math.max(11, Math.min(14, calcNodeRadius(d, densityScale) * 0.42))
        : Math.max(9, Math.min(11, calcNodeRadius(d, densityScale) * 0.50)))
      .attr('font-weight', (d: SimNode) => isCoreNode(d) ? '700' : '600')
      .attr("font-family", "'Noto Sans SC', system-ui, sans-serif")
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.7)')
      .attr('pointer-events', 'none')
      .style('opacity', 0)
      .transition().delay((_, i) => Math.min(i * 30 + 220, 850)).duration(320)
      .style('opacity', 1)

    // Label background
    entered.insert('rect', ':first-child')
      .attr('class', 'label-bg')
      .attr('x', (d: SimNode) => -calcNodeRadius(d, densityScale) * 1.8)
      .attr('y', (d: SimNode) => calcNodeRadius(d, densityScale) + 6)
      .attr('width', (d: SimNode) => calcNodeRadius(d, densityScale) * 3.6)
      .attr('height', 16)
      .attr('rx', 3)
      .attr('fill', 'rgba(255,255,255,0.75)')
      .attr('stroke', 'rgba(148,163,184,0.15)')
      .attr('stroke-width', 0.5)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .transition().delay((_, i) => Math.min(i * 30 + 200, 830)).duration(320)
      .style('opacity', 0.85)

    // Fade in enter selection
    entered.transition().delay((_, i) => Math.min(i * 20, 520)).duration(320)
      .style('opacity', 1)

    const mergedNodes = entered.merge(nodeSelection)

    // Keyboard focus ring
    const focusRingSel = mergedNodes.selectAll('.keyboard-focus-ring').data(
      (d: SimNode, i: number) => (i === this.input.focusedNodeIndex ? [d] : [] as SimNode[]),
    )
    focusRingSel.exit().remove()
    focusRingSel.enter()
      .insert('circle', ':first-child')
      .attr('class', 'keyboard-focus-ring')
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-secondary-500)')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2')
      .style('pointer-events', 'none')
      .transition().duration(200)
      .attr('r', (d: any) => calcNodeRadius(d as SimNode, densityScale) + 8)
    mergedNodes.selectAll('.keyboard-focus-ring')
      .attr('r', (d: any, i: number) => i === this.input.focusedNodeIndex ? calcNodeRadius(d as SimNode, densityScale) + 8 : 0)

    // ── Update phase: sync all elements ──
    mergedNodes.select('.node-glow-outer')
      .transition().duration(350).attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) + 10)
    mergedNodes.select('.node-glow-ring')
      .transition().duration(350).attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) + 4)
    mergedNodes.select('.node-highlight')
      .transition().duration(300).attr('r', (d: SimNode) => calcNodeRadius(d, densityScale) * 0.38)
    mergedNodes.select('.label-bg')
      .transition().duration(300)
      .attr('x', (d: SimNode) => -calcNodeRadius(d, densityScale) * 1.8)
      .attr('y', (d: SimNode) => calcNodeRadius(d, densityScale) + 6)
      .attr('width', (d: SimNode) => calcNodeRadius(d, densityScale) * 3.6)
    mergedNodes.select('.node-label')
      .transition().duration(300)
      .attr('dy', (d: SimNode) => calcNodeRadius(d, densityScale) + 18)
      .attr('font-size', (d: SimNode) => isCoreNode(d)
        ? Math.max(11, Math.min(14, calcNodeRadius(d, densityScale) * 0.42))
        : Math.max(9, Math.min(11, calcNodeRadius(d, densityScale) * 0.50)))
      .attr('font-weight', (d: SimNode) => isCoreNode(d) ? '700' : '600')

    mergedNodes.select('.node-body')
      .transition().duration(300)
      .attr('fill', (d: SimNode) => {
        if (communities.size > 0) {
          const commId = communities.get(d.id || d.label)
          if (commId !== undefined && generatedCommunityColors[commId]) {
            return generatedCommunityColors[commId]
          }
        }
        return getTypeConf(d.type).color
      })
      .attr('stroke', (d: SimNode) => {
        const nodeKey = `${d.label}_${d.type}`
        if (selectedNodes.has(nodeKey)) return 'var(--color-secondary-500)'
        return highlightSet.has(d.id || d.label) ? '#F59E0B' : 'white'
      })
      .attr('stroke-width', (d: SimNode) => {
        const nodeKey = `${d.label}_${d.type}`
        if (selectedNodes.has(nodeKey)) return 3
        return highlightSet.has(d.id || d.label) ? 3.5 : 2
      })
      .attr('fill-opacity', (d: SimNode) => highlightSet.size === 0 || highlightSet.has(d.id || d.label) ? 0.94 : 0.28)
      .attr('r', (d: SimNode) => calcNodeRadius(d, densityScale))
      .attr('filter', (d: SimNode) => isCoreNode(d) ? 'url(#core-node-shadow)' : 'url(#node-drop-shadow)')

    // Cache node selection for interaction/tick
    this.allNodesSel = nodeG.selectAll<SVGGElement, SimNode>('g.node-group')
  }

  private setupInteractions(simEdges: SimEdge[]): void {
    const allNodes = this.allNodesSel
    const allLinks = this.allLinksSel
    if (!allNodes || allNodes.empty()) return

    // Drag behavior
    const dragBehavior = d3.drag<SVGGElement, SimNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active && this.simulation) this.simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
        if (!event.active && this.simulation) this.simulation.alphaTarget(0)
        d.fx = this.input.layout !== 'force' ? d.x : null
        d.fy = this.input.layout !== 'force' ? d.y : null
        if (this.input.onNodeDrag) {
          this.input.onNodeDrag(event)
        }
      })

    allNodes.call(dragBehavior)

    // Click
    allNodes.on('click', (event: Event, d: SimNode) => {
      event.stopPropagation()
      this.input.onSetSelectedNode?.(d)
      this.input.onNodeClick?.(d)
    })

    // Double-click: toggle pin
    allNodes.on('dblclick', (event: MouseEvent, d: SimNode) => {
      event.stopPropagation()
      const nodeId = d.id || d.label
      if (this.input.onTogglePinNode) {
        this.input.onTogglePinNode(nodeId)
      }
      const sel = d3.select(event.currentTarget as SVGGElement)
      sel.select('.node-body')
        .transition().duration(150).attr('stroke', '#FF3B30').attr('stroke-width', 4)
        .transition().duration(300).attr('stroke', 'white').attr('stroke-width', 2)
    })

    // Hover in/out
    const handleHoverIn = (el: SVGGElement, event: MouseEvent | TouchEvent, d: SimNode) => {
      const conf = getTypeConf(d.type)
      const dynamicR = calcNodeRadius(d)
      let connCount = 0
      simEdges.forEach((e: SimEdge) => {
        const sId = typeof e.source === 'object' ? e.source.id : e.source
        const tId = typeof e.target === 'object' ? e.target.id : e.target
        if (sId === d.id || tId === d.id) connCount++
      })
      const rect = this.container?.getBoundingClientRect() || { width: 0, height: 0 }
      const clientX = (event as MouseEvent).clientX ?? (event as TouchEvent).touches?.[0]?.clientX ?? rect.width / 2
      const clientY = (event as MouseEvent).clientY ?? (event as TouchEvent).touches?.[0]?.clientY ?? rect.height / 2

      const propParts: string[] = []
      if (d.properties) {
        const priorityKeys = ['ob', 'dl', 'ob_percent', 'dl_value', 'category', 'activity_value', 'source_protein', 'molecular_weight']
        for (const k of priorityKeys) {
          if (d.properties[k] != null) {
            const val = d.properties[k]
            const displayVal = typeof val === 'number'
              ? (Number.isInteger(val) ? String(val) : val.toFixed(2))
              : typeof val === 'object' && val !== null
              ? JSON.stringify(val)
              : String(val)
            propParts.push(`${k}: ${displayVal}`)
            if (propParts.length >= 3) break
          }
        }
      }

      this.input.onSetTooltip?.({
        x: clientX - (rect as DOMRect).left,
        y: clientY - (rect as DOMRect).top,
        content: `${conf.label} · ${d.label}` + (connCount > 0 ? ` (${connCount}条关联)` : '')
          + (d.degree && d.degree > 0 ? ` | 度数:${d.degree}` : '')
          + (propParts.length > 0 ? `\n${propParts.join('  | ')}` : ''),
      })

      d3.select(el).select('.node-body')
        .transition().duration(160).ease(d3.easeCubicOut)
        .attr('r', dynamicR + 6)
        .attr('fill-opacity', 1)
        .attr('stroke-width', 3.5)
        .attr('filter', 'url(#glow-inner)')

      const connectedIds = new Set<string>([d.id])
      simEdges.forEach((e: SimEdge) => {
        const sId = typeof e.source === 'object' ? e.source.id : e.source
        const tId = typeof e.target === 'object' ? e.target.id : e.target
        if (sId === d.id) connectedIds.add(tId)
        if (tId === d.id) connectedIds.add(sId)
      })

      allLinks?.transition().duration(160)
        .attr('stroke-opacity', (e: SimEdge) => {
          const sId = typeof e.source === 'object' ? e.source.id : e.source
          const tId = typeof e.target === 'object' ? e.target.id : e.target
          return (sId === d.id || tId === d.id) ? 0.92 : 0.05
        })
        .attr('stroke-width', (e: SimEdge) => {
          const sId = typeof e.source === 'object' ? e.source.id : e.source
          const tId = typeof e.target === 'object' ? e.target.id : e.target
          if (sId !== d.id && tId !== d.id) return 0.5
          const edgeConf = EDGE_COLORS[e.type]
          return edgeConf?.priority === 'core' ? Math.max(3.5, (e.strength || 0.5) * 5) : Math.max(2, (e.strength || 0.5) * 3)
        })

      allNodes?.select('.node-body')
        .transition().duration(160)
        .attr('fill-opacity', (n: SimNode) => connectedIds.has(n.id) ? 1 : 0.14)
    }

    const handleHoverOut = (el: SVGGElement) => {
      this.input.onSetTooltip?.(null)
      d3.select(el).select('.node-body')
        .transition().duration(220)
        .attr('r', (d: any) => calcNodeRadius(d))
        .attr('fill-opacity', 0.92)
        .attr('stroke-width', 2)
        .attr('filter', null)

      allLinks?.transition().duration(220)
        .attr('stroke-opacity', (e: SimEdge) => {
          const sId = typeof e.source === 'object' ? e.source.id : e.source
          const tId = typeof e.target === 'object' ? e.target.id : e.target
          return 0.55
        })
        .attr('stroke-width', (e: SimEdge) => calcEdgeWidth(e.type, e.strength))

      allNodes?.select('.node-body')
        .transition().duration(220)
        .attr('fill-opacity', 0.92)
    }

    allNodes
      .on('mouseenter', function (this: SVGGElement, event: MouseEvent | TouchEvent, d: SimNode) {
        handleHoverIn(this, event, d)
      })
      .on('mouseleave', function (this: SVGGElement) {
        handleHoverOut(this)
      })

    // Touch support
    allNodes.on('touchstart', function (this: SVGGElement, event: Event, d: SimNode) {
      handleHoverIn(this, event as MouseEvent | TouchEvent, d)
      setTimeout(() => { if ((this as SVGGElement).isConnected) handleHoverOut(this) }, 2500)
    })
  }

  private applyTickPositions(): void {
    const allLinks = this.allLinksSel
    const allLabels = this.allLabelsSel
    const allNodes = this.allNodesSel

    if (!allLinks || allLinks.empty()) return
    if (!allLabels) this.allLabelsSel = null
    if (!allNodes) this.allNodesSel = null

    const useCurve = this.input.layout === 'force'
    if (useCurve && allLinks) {
      allLinks.attr('d', (e: SimEdge) => {
        const sx = typeof e.source === 'object' ? (e.source.x ?? 0) : 0
        const sy = typeof e.source === 'object' ? (e.source.y ?? 0) : 0
        const tx = typeof e.target === 'object' ? (e.target.x ?? 0) : 0
        const ty = typeof e.target === 'object' ? (e.target.y ?? 0) : 0
        return curvedLinkPath(sx, sy, tx, ty)
      })
    } else if (allLinks) {
      allLinks
        .attr('x1', (e: SimEdge) => typeof e.source === 'object' ? (e.source.x ?? 0) : 0)
        .attr('y1', (e: SimEdge) => typeof e.source === 'object' ? (e.source.y ?? 0) : 0)
        .attr('x2', (e: SimEdge) => typeof e.target === 'object' ? (e.target.x ?? 0) : 0)
        .attr('y2', (e: SimEdge) => typeof e.target === 'object' ? (e.target.y ?? 0) : 0)
    }

    if (allLabels) {
      allLabels
        .attr('x', (e: SimEdge) => {
          const sx = typeof e.source === 'object' ? (e.source.x ?? 0) : 0
          const tx = typeof e.target === 'object' ? (e.target.x ?? 0) : 0
          return (sx + tx) / 2
        })
        .attr('y', (e: SimEdge) => {
          const sy = typeof e.source === 'object' ? (e.source.y ?? 0) : 0
          const ty = typeof e.target === 'object' ? (e.target.y ?? 0) : 0
          return (sy + ty) / 2 - 4
        })
    }

    if (allNodes) {
      allNodes.attr('transform', (d: SimNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }
  }
}
