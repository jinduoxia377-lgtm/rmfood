/**
 * Graph analytics — community detection and color mapping.
 */

import type { GraphNode, GraphEdge } from '../types'

export interface CommunityResult {
  communities: Map<string, number>
  colors: Record<number, string>
}

/**
 * Simplified LabelPropagation community detection.
 * Runs 8 iterations, each node adopts the most frequent neighbor label.
 */
export function detectCommunities(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  if (edges.length === 0 || nodes.length === 0) return new Map<string, number>()

  const labels = new Map<string, number>()
  nodes.forEach((n, i) => { labels.set(n.id || n.label, i) })

  for (let iter = 0; iter < 8; iter++) {
    const newLabels = new Map(labels)
    for (const [nodeId] of labels) {
      const neighbors = new Set<string>()
      edges.forEach(e => {
        const src = typeof e.source === 'string' ? e.source : String(e.source)
        const tgt = typeof e.target === 'string' ? e.target : String(e.target)
        if (src === nodeId) neighbors.add(tgt)
        if (tgt === nodeId) neighbors.add(src)
      })

      if (neighbors.size > 0) {
        const counts = new Map<number, number>()
        neighbors.forEach(neighborId => {
          const l = labels.get(neighborId) ?? -1
          counts.set(l, (counts.get(l) || 0) + 1)
        })

        let maxCount = 0
        let maxLabel = labels.get(nodeId)!
        for (const [label, count] of counts) {
          if (count > maxCount) { maxCount = count; maxLabel = label }
        }
        newLabels.set(nodeId, maxLabel)
      }
    }
    labels.clear()
    newLabels.forEach((v, k) => labels.set(k, v))
  }

  const uniqueLabels = Array.from(new Set(labels.values()))
  const remapped = new Map<string, number>()
  labels.forEach((oldLabel, nodeId) => {
    remapped.set(nodeId, uniqueLabels.indexOf(oldLabel))
  })

  return remapped
}

/**
 * Generate HSL color map for communities using uniform hue distribution.
 */
export function generateCommunityColors(communities: Map<string, number>): Record<number, string> {
  const numCommunities = Array.from(new Set(Array.from(communities.values()))).length
  const colors: Record<number, string> = {}
  for (let i = 0; i < numCommunities; i++) {
    const hue = Math.round((i * 360 / Math.max(numCommunities, 1)) % 360)
    colors[i] = `hsl(${hue}, 65%, 52%)`
  }
  return colors
}
