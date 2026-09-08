/**
 * IngredientNetworkChart — 食材关联网络图
 *
 * 基于 SVG + 简易力导向布局，展示食材之间的共现关系。
 * 无额外依赖（不使用 d3-force）。
 *
 * 数据格式:
 *   nodes: [{ id, name, count }]
 *   edges: [{ source: id, target: id, weight: number }]
 */
import React, { useMemo, useEffect, useRef, useState } from 'react'

interface NodeData {
  id: string
  name: string
  count: number
  x: number
  y: number
}

interface EdgeData {
  source: string
  target: string
  weight: number
}

interface Props {
  nodes: Array<{ id: string; name: string; count: number }>
  edges: Array<{ source: string; target: string; weight: number }>
  height?: number
}

const NODE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

export const IngredientNetworkChart: React.FC<Props> = ({
  nodes: inputNodes,
  edges: inputEdges,
  height = 360,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ w: 600, h: height })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDimensions({ w: e.contentRect.width, h: e.contentRect.height || height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [height])

  // 简易力导向布局
  const layout = useMemo(() => {
    const W = dimensions.w || 600
    const H = dimensions.h || height
    const nodeMap = new Map(inputNodes.map((n, i) => [
      n.id,
      {
        ...n,
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: H / 2 + (Math.random() - 0.5) * H * 0.6,
      },
    ]))

    // 迭代模拟
    const iterations = 120
    const idealLength = Math.sqrt((W * H) / Math.max(inputNodes.length, 1)) * 0.8 // 理想边长
    for (let iter = 0; iter < iterations; iter++) {
      const temp = 0.1 * (1 - iter / iterations) // 降温

      // 斥力（所有节点对）
      const forces = new Map<string, { fx: number; fy: number }>()
      const keys = Array.from(nodeMap.keys())
      for (const key of keys) forces.set(key, { fx: 0, fy: 0 })
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = nodeMap.get(keys[i])!
          const b = nodeMap.get(keys[j])!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (idealLength * idealLength) / dist
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          const fa = forces.get(keys[i])!
          const fb = forces.get(keys[j])!
          fa.fx -= fx; fa.fy -= fy
          fb.fx += fx; fb.fy += fy
        }
      }

      // 引力（边）
      for (const edge of inputEdges) {
        const a = nodeMap.get(edge.source)
        const b = nodeMap.get(edge.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist * dist) / idealLength * 0.01
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fa = forces.get(edge.source)!
        const fb = forces.get(edge.target)!
        fa.fx += fx; fa.fy += fy
        fb.fx -= fx; fb.fy -= fy
      }

      // 中心引力
      for (const [id, node] of nodeMap) {
        const f = forces.get(id)!
        f.fx += (W / 2 - node.x) * 0.01
        f.fy += (H / 2 - node.y) * 0.01
      }

      // 更新位置
      for (const [id, node] of nodeMap) {
        const f = forces.get(id)!
        const len = Math.sqrt(f.fx * f.fx + f.fy * f.fy) || 1
        node.x += (f.fx / len) * Math.min(len, temp * 50)
        node.y += (f.fy / len) * Math.min(len, temp * 50)
        node.x = Math.max(30, Math.min(W - 30, node.x))
        node.y = Math.max(20, Math.min(H - 20, node.y))
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges: inputEdges, W, H }
  }, [inputNodes, inputEdges, dimensions.w, dimensions.h, height])

  if (inputNodes.length === 0) {
    return (
      <div ref={containerRef} className="h-[360px] flex items-center justify-center text-text-muted text-sm rounded-xl border border-border">
        暂无食材关联数据
      </div>
    )
  }

  const maxWeight = Math.max(...inputEdges.map(e => e.weight), 1)

  return (
    <div ref={containerRef} className="w-full rounded-xl border border-border overflow-hidden">
      <svg
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="食材关联网络图"
      >
        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const src = layout.nodes.find(n => n.id === edge.source)
          const tgt = layout.nodes.find(n => n.id === edge.target)
          if (!src || !tgt) return null
          const opacity = 0.15 + (edge.weight / maxWeight) * 0.35
          const strokeW = 0.5 + (edge.weight / maxWeight) * 2.5
          return (
            <line
              key={i}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke="#94a3b8"
              strokeWidth={strokeW}
              opacity={opacity}
            />
          )
        })}

        {/* Nodes */}
        {layout.nodes.map((node, i) => {
          const r = 6 + Math.min(node.count / 10, 12)
          const color = NODE_COLORS[i % NODE_COLORS.length]
          return (
            <g key={node.id} className="cursor-pointer">
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={color} opacity={0.8}
                className="transition-all duration-200 hover:opacity-100"
              />
              <text
                x={node.x} y={node.y + r + 12}
                textAnchor="middle"
                className="fill-neutral-600 dark:fill-neutral-400 select-none"
                style={{ fontSize: 10 }}
              >
                {node.name.length > 6 ? node.name.slice(0, 6) + '…' : node.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default IngredientNetworkChart
