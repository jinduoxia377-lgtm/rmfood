/**
 * Graph analytics — centrality metrics and structural statistics.
 */

import type { GraphNode, GraphEdge } from '../types'

export interface CentralityResult {
  degreeMap: Map<string, number>
  topByDegree: Array<{ node: GraphNode; degree: number }>
  stats: GraphStats | null
}

export interface GraphStats {
  totalNodes: number
  totalEdges: number
  density: string
  avgDegree: string
  maxDegree: number
  minDegree: number
  connectedComponents: number
  largestComponentSize: number
  diameter: number
  typeDistribution: [string, number][]
}

/**
 * Compute degree-based centrality for filtered nodes/edges.
 */
export function computeCentrality(nodes: GraphNode[], edges: GraphEdge[]): CentralityResult {
  if (nodes.length === 0) return { degreeMap: new Map(), topByDegree: [], stats: null }

  const degreeMap = new Map<string, number>()
  nodes.forEach(n => {
    const id = n.id || n.label
    let deg = 0
    edges.forEach(e => {
      if (e.source === id || e.target === id) deg++
    })
    degreeMap.set(id, deg)
  })

  const nodeDegreeList = nodes.map(n => ({
    node: n,
    degree: degreeMap.get(n.id || n.label) || 0,
  }))
  nodeDegreeList.sort((a, b) => b.degree - a.degree)
  const topByDegree = nodeDegreeList.slice(0, 10)

  // Graph statistics
  const N = nodes.length
  const E = edges.length
  const maxPossibleEdges = N * (N - 1) / 2
  const density = maxPossibleEdges > 0 ? E / maxPossibleEdges : 0
  const avgDegree = N > 0 ? (2 * E) / N : 0
  const degrees = Array.from(degreeMap.values())
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0
  const minDegree = degrees.length > 0 ? Math.min(...degrees) : 0

  // Connected components (BFS)
  const visited = new Set<string>()
  let components = 0
  let largestComponentSize = 0
  nodes.forEach(n => {
    const nid = n.id || n.label
    if (visited.has(nid)) return
    components++
    const queue = [nid]
    let compSize = 0
    while (queue.length > 0) {
      const curr = queue.shift()!
      if (visited.has(curr)) continue
      visited.add(curr)
      compSize++
      edges.forEach(e => {
        if (e.source === curr && !visited.has(String(e.target))) queue.push(String(e.target))
        if (e.target === curr && !visited.has(String(e.source))) queue.push(String(e.source))
      })
    }
    largestComponentSize = Math.max(largestComponentSize, compSize)
  })

  // Approximate diameter via BFS from highest-degree node
  let diameter = 0
  if (topByDegree.length > 0) {
    const startId = topByDegree[0].node.id || topByDegree[0].node.label
    const distMap = new Map<string, number>()
    distMap.set(startId, 0)
    const bfsQueue = [startId]
    while (bfsQueue.length > 0) {
      const curr = bfsQueue.shift()!
      const d = distMap.get(curr) || 0
      diameter = Math.max(diameter, d)
      edges.forEach(e => {
        const s = String(e.source), t = String(e.target)
        if (s === curr && !distMap.has(t)) { distMap.set(t, d + 1); bfsQueue.push(t) }
        else if (t === curr && !distMap.has(s)) { distMap.set(s, d + 1); bfsQueue.push(s) }
      })
    }
  }

  const typeDistribution: [string, number][] = Object.entries(
    nodes.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  ).sort((a, b) => b[1] - a[1])

  return {
    degreeMap,
    topByDegree,
    stats: {
      totalNodes: N,
      totalEdges: E,
      density: density.toFixed(4),
      avgDegree: avgDegree.toFixed(1),
      maxDegree,
      minDegree,
      connectedComponents: components,
      largestComponentSize,
      diameter,
      typeDistribution,
    },
  }
}
