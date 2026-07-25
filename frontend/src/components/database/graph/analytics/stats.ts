/**
 * Graph analytics — simple statistics (degree maps, legend items, type counts).
 */

import type { GraphNode, GraphEdge } from '../types'

export interface DegreeStats {
  degreeMap: Map<string, number>
  maxDegree: number
}

export interface LegendData {
  allTypes: string[]
  legendItems: Array<{ type: string; label: string; color: string; glow: string; icon: string }>
  typeCounts: Record<string, number>
}

export interface SmartPathResult {
  sourceId: string
  targetId: string
  path: string[]
  length: number
  intermediateNodes: string[]
  keyBridges: string[]
  alternativePaths: Array<{ path: string[]; length: number }>
}

/**
 * Compute node degree map and max degree.
 */
export function computeDegreeStats(nodes: GraphNode[], edges: GraphEdge[]): DegreeStats {
  const degreeMap = new Map<string, number>()
  nodes.forEach(n => degreeMap.set(n.id || n.label, 0))
  edges.forEach(e => {
    const s = typeof e.source === 'string' ? e.source : String(e.source)
    const t = typeof e.target === 'string' ? e.target : String(e.target)
    degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
    degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
  })
  return {
    degreeMap,
    maxDegree: Math.max(...Array.from(degreeMap.values()), 1),
  }
}

/**
 * Compute legend data (all unique types, items with config, counts).
 */
export function computeLegendData(
  nodes: GraphNode[],
  TYPE_CONFIG: Record<string, { color: string; glow: string; label: string; icon: string }>,
): LegendData {
  const allTypes = [...new Set(nodes.map(n => n.type))]
  const legendItems = allTypes.map(type => ({
    type,
    label: TYPE_CONFIG[type]?.label || type,
    color: TYPE_CONFIG[type]?.color || '',
    glow: TYPE_CONFIG[type]?.glow || '',
    icon: TYPE_CONFIG[type]?.icon || '',
  }))
  const typeCounts: Record<string, number> = {}
  nodes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1 })
  return { allTypes, legendItems, typeCounts }
}

/**
 * BFS path finding between two nodes.
 */
export function findPathBFS(edges: GraphEdge[], sourceId: string, targetId: string): string[] | null {
  if (sourceId === targetId) return [sourceId]
  const adjList = new Map<string, string[]>()
  edges.forEach(e => {
    const s = typeof e.source === 'string' ? e.source : ''
    const t = typeof e.target === 'string' ? e.target : ''
    if (!adjList.has(s)) adjList.set(s, [])
    if (!adjList.has(t)) adjList.set(t, [])
    adjList.get(s)!.push(t)
    adjList.get(t)!.push(s)
  })

  const visited = new Set<string>()
  const parent = new Map<string, string>()
  const queue = [sourceId]
  visited.add(sourceId)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === targetId) {
      const path: string[] = []
      let node: string | undefined = targetId
      while (node) {
        path.unshift(node)
        node = parent.get(node)
      }
      return path
    }
    for (const neighbor of adjList.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    }
  }
  return null
}

/**
 * Dijkstra shortest path with bridge detection.
 */
export function findSmartPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): SmartPathResult | null {
  // Build adjacency list with weights
  const adj = new Map<string, Array<{ node: string; weight: number }>>()
  nodes.forEach(n => adj.set(n.id || n.label, []))
  edges.forEach(e => {
    const s = typeof e.source === 'string' ? e.source : String(e.source)
    const t = typeof e.target === 'string' ? e.target : String(e.target)
    const w = e.strength ? (1 - e.strength) * 2 + 1 : 1
    adj.get(s)?.push({ node: t, weight: w })
    adj.get(t)?.push({ node: s, weight: w })
  })

  // Dijkstra
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const visiting = new Set<string>(nodes.map(n => n.id || n.label))
  dist.set(sourceId, 0)
  nodes.forEach(n => {
    if ((n.id || n.label) !== sourceId) {
      dist.set(n.id || n.label, Infinity)
      prev.set(n.id || n.label, null)
    }
  })

  while (visiting.size > 0) {
    let minDist = Infinity, minNode = ''
    visiting.forEach(v => { const d = dist.get(v) || Infinity; if (d < minDist) { minDist = d; minNode = v } })
    if (minDist === Infinity) break
    visiting.delete(minNode)
    ;(adj.get(minNode) || []).forEach(({ node: neighbor, weight }) => {
      const alt = minDist + weight
      if (alt < (dist.get(neighbor) || Infinity)) { dist.set(neighbor, alt); prev.set(neighbor, minNode) }
    })
  }

  if ((dist.get(targetId) || Infinity) === Infinity) return null

  // Reconstruct path
  const path: string[] = []
  let curr: string | null = targetId
  while (curr) { path.unshift(curr); curr = prev.get(curr) || null }

  const intermediateNodes = path.slice(1, -1)

  // Simple bridge detection via degree
  const keyBridges: string[] = []
  intermediateNodes.forEach(nodeId => {
    const node = nodes.find(n => (n.id || n.label) === nodeId)
    if (node && (node.degree || 0) >= 3) keyBridges.push(nodeId)
  })

  // Alternative paths via BFS
  const altAdj = new Map<string, string[]>()
  nodes.forEach(n => altAdj.set(n.id || n.label, []))
  edges.forEach(e => {
    const s = typeof e.source === 'string' ? e.source : String(e.source)
    const t = typeof e.target === 'string' ? e.target : String(e.target)
    altAdj.get(s)?.push(t); altAdj.get(t)?.push(s)
  })

  const altPaths: Array<{ path: string[]; length: number }> = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const visited = new Set<string>([sourceId])
    const queue: string[][] = [[sourceId]]
    let found = false
    while (queue.length > 0 && !found) {
      const p = queue.shift()!
      const cur = p[p.length - 1]
      ;(altAdj.get(cur) || []).filter(n => !visited.has(n)).forEach(nbr => {
        visited.add(nbr)
        const newPath = [...p, nbr]
        if (nbr === targetId) {
          const pathKey = newPath.join('→')
          if (pathKey !== path.join('→')) altPaths.push({ path: newPath, length: newPath.length - 1 })
          found = true
        } else if (newPath.length < path.length + 3) {
          queue.push(newPath)
        }
      })
    }
  }

  return { sourceId, targetId, path, length: path.length - 1, intermediateNodes, keyBridges, alternativePaths: altPaths }
}
