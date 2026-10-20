/**
 * 中心性算法实现（客户端，作用于当前筛选视图）
 *
 * 为什么在客户端算而不调后端 /analytics/centrality：
 * 1. 该端点只支持 pageRank/betweenness/closeness，没有 degree；
 * 2. limit 上限 200，而图谱有 1215 节点——一次拿不全；
 * 3. CentralityMetricsPanel 作用域是 filteredNodes（当前筛选结果），
 *    随筛选变化，后端全量结果与面板作用域并不一致。
 * 4. 1215 节点 / 2477 边下四个算法均为毫秒级，无性能顾虑。
 *
 * 所有算法按无向图处理（与 D3 力导向布局的边语义一致）。
 */

import type { GraphNode, GraphEdge } from '../types'
import type { CentralityMetrics } from '../hooks/useGraphState'

/** 统一节点标识：与组件内 `n.id || n.label` 的查找方式保持一致 */
const nodeKey = (n: GraphNode): string => n.id || n.label

/** 在已知节点集合上构建无向邻接表，丢弃两端无法解析的悬空边与自环 */
function buildAdjacency(nodes: GraphNode[], edges: GraphEdge[]): Map<string, Set<string>> {
  const keys = new Set<string>(nodes.map(nodeKey))
  const adj = new Map<string, Set<string>>()
  for (const n of nodes) adj.set(nodeKey(n), new Set())
  for (const e of edges) {
    if (!keys.has(e.source) || !keys.has(e.target)) continue
    if (e.source === e.target) continue
    adj.get(e.source)!.add(e.target)
    adj.get(e.target)!.add(e.source)
  }
  return adj
}

/** 度中心性：归一化度 (k / (n-1)) */
export function computeDegreeCentrality(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, number> {
  const adj = buildAdjacency(nodes, edges)
  const n = nodes.length
  const denom = Math.max(n - 1, 1)
  const result: Record<string, number> = {}
  for (const [k, nb] of adj) result[k] = +(nb.size / denom).toFixed(6)
  return result
}

/**
 * PageRank（含悬挂节点重新分配）
 * @param damping 阻尼系数，默认 0.85
 * @param iterations 迭代次数，默认 60（1215 节点已充分收敛）
 */
export function computePageRank(
  nodes: GraphNode[],
  edges: GraphEdge[],
  damping = 0.85,
  iterations = 60,
): Record<string, number> {
  const adj = buildAdjacency(nodes, edges)
  const n = adj.size
  if (n === 0) return {}

  let scores = new Map<string, number>()
  for (const k of adj.keys()) scores.set(k, 1 / n)

  const base = (1 - damping) / n
  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>()
    let dangling = 0
    for (const [k, v] of scores) {
      const nb = adj.get(k)!
      if (nb.size === 0) { dangling += v; continue }
      const share = v / nb.size
      for (const t of nb) next.set(t, (next.get(t) ?? 0) + share)
    }
    const danglingPart = (damping * dangling) / n
    for (const k of adj.keys()) {
      next.set(k, base + damping * (next.get(k) ?? 0) + danglingPart)
    }
    scores = next
  }
  const result: Record<string, number> = {}
  for (const [k, v] of scores) result[k] = +v.toFixed(6)
  return result
}

/**
 * 介数中心性（Brandes 最短路径算法，无向图）
 *
 * 复杂度 O(V × (V + E))：1215 × 3692 ≈ 450 万次操作。
 * 注意：队列用指针推进而非 shift()，否则退化为 O(V²) 每次入队。
 */
export function computeBetweennessCentrality(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, number> {
  const adj = buildAdjacency(nodes, edges)
  const bc = new Map<string, number>()
  for (const k of adj.keys()) bc.set(k, 0)

  for (const s of adj.keys()) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    for (const k of adj.keys()) {
      pred.set(k, [])
      sigma.set(k, 0)
      dist.set(k, -1)
    }
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue = [s]
    let qi = 0
    while (qi < queue.length) {
      const v = queue[qi++]
      stack.push(v)
      const dv = dist.get(v)!
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          queue.push(w)
          dist.set(w, dv + 1)
        }
        if (dist.get(w)! === dv + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          pred.get(w)!.push(v)
        }
      }
    }
    const delta = new Map<string, number>()
    for (const k of adj.keys()) delta.set(k, 0)
    while (stack.length) {
      const w = stack.pop()!
      const sw = sigma.get(w)! || 1
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sw) * (1 + delta.get(w)!))
      }
      if (w !== s) bc.set(w, bc.get(w)! + delta.get(w)!)
    }
  }

  // 无向图中每对节点被双向计数一次，故除以 2
  const result: Record<string, number> = {}
  for (const [k, v] of bc) result[k] = +(v / 2).toFixed(6)
  return result
}

/**
 * 接近中心性（BFS，Wasserman-Faust 修正版）
 *
 * 修正版对不连通图安全：只统计可达节点数，避免除零与无限距离。
 */
export function computeClosenessCentrality(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, number> {
  const adj = buildAdjacency(nodes, edges)
  const result: Record<string, number> = {}

  for (const s of adj.keys()) {
    const dist = new Map<string, number>()
    for (const k of adj.keys()) dist.set(k, -1)
    dist.set(s, 0)
    const queue = [s]
    let qi = 0
    let reachable = 0
    while (qi < queue.length) {
      const v = queue[qi++]
      reachable++
      const dv = dist.get(v)!
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dv + 1)
          queue.push(w)
        }
      }
    }
    if (reachable <= 1) { result[s] = 0; continue }
    let sum = 0
    for (const [k, d] of dist) if (k !== s && d >= 0) sum += d
    result[s] = sum > 0 ? +((reachable - 1) / sum).toFixed(6) : 0
  }
  return result
}

/**
 * HITS（hub / authority）
 *
 * CentralityMetricsPanel 目前不使用 hits，但 CentralityMetrics 接口要求该字段，
 * 故完整实现而非填空对象。
 */
function computeHits(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations = 30,
): { authority: Record<string, number>; hub: Record<string, number> } {
  const adj = buildAdjacency(nodes, edges)
  const keys = [...adj.keys()]
  let authority = new Map<string, number>()
  let hub = new Map<string, number>()
  for (const k of keys) { authority.set(k, 1); hub.set(k, 1) }

  const normalize = (m: Map<string, number>): Map<string, number> => {
    let max = 0
    for (const v of m.values()) if (v > max) max = v
    const out = new Map<string, number>()
    if (max <= 0) { for (const k of m.keys()) out.set(k, 0); return out }
    for (const [k, v] of m) out.set(k, +(v / max).toFixed(6))
    return out
  }

  for (let it = 0; it < iterations; it++) {
    const newA = new Map<string, number>()
    const newH = new Map<string, number>()
    for (const [k, nb] of adj) {
      let a = 0
      for (const w of nb) a += hub.get(w)!
      newA.set(k, a)
    }
    for (const [k, nb] of adj) {
      let h = 0
      for (const w of nb) h += authority.get(w)!
      newH.set(k, h)
    }
    authority = normalize(newA)
    hub = normalize(newH)
  }
  return {
    authority: Object.fromEntries(authority),
    hub: Object.fromEntries(hub),
  }
}

/**
 * 一次性计算全部中心性指标，返回可直接喂给 CentralityMetricsPanel 的结构。
 * 键为 `node.id || node.label`，与组件内的节点查找方式一致。
 */
export function computeCentralityMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
): CentralityMetrics {
  const hits = computeHits(nodes, edges)
  return {
    pageRank: computePageRank(nodes, edges),
    betweenness: computeBetweennessCentrality(nodes, edges),
    closeness: computeClosenessCentrality(nodes, edges),
    degree: computeDegreeCentrality(nodes, edges),
    hits: { authority: hits.authority, hub: hits.hub },
  }
}
