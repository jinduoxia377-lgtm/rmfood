/**
 * SankeyFunnelChart — 配方生命周期桑基图
 *
 * 用桑基流式图展示各阶段的数量流转和转化率。
 * 纯 SVG 实现，无额外依赖。
 *
 * 数据格式:
 *   stages: [{ id, label, count, color }, ...]
 *   flows:  [{ from: number, to: number, value: number }, ...]
 */
import React, { useMemo } from 'react'

interface SankeyNode {
  id: string
  label: string
  count: number
  color: string
}

interface SankeyFlow {
  from: number  // node index
  to: number    // node index
  value: number
  sx: number; sy: number; sw: number
  tx: number; ty: number; tw: number
}

interface Props {
  stages: SankeyNode[]
  height?: number
  showRates?: boolean
}

export const SankeyFunnelChart: React.FC<Props> = ({
  stages,
  height = 200,
  showRates = true,
}) => {
  const { nodes, links, svgWidth, nodeWidth, gap } = useMemo(() => {
    const W = 600
    const H = height
    const n = stages.length
    if (n === 0) return { nodes: [], links: [], svgWidth: W, nodeWidth: 16, gap: 0 }

    const nodeWidth = 16
    const maxCount = Math.max(...stages.map(s => s.count), 1)
    const totalH = H - 40
    const paddingX = 60
    const availW = W - paddingX * 2 - nodeWidth * n
    const stepX = availW / Math.max(n - 1, 1)
    const gap = Math.min(stepX * 0.3, 30)

    const nodes = stages.map((s, i) => {
      const h = Math.max(20, (s.count / maxCount) * totalH)
      const y = (H - h) / 2
      const x = paddingX + i * stepX
      return { ...s, x, y, w: nodeWidth, h, idx: i }
    })

    const links: SankeyFlow[] = []
    for (let i = 0; i < n - 1; i++) {
      const src = nodes[i]
      const tgt = nodes[i + 1]
      const val = Math.min(src.count, tgt.count)
      if (val <= 0) continue
      links.push({
        from: i,
        to: i + 1,
        value: val,
        sx: src.x + src.w, sy: src.y, sw: src.h,
        tx: tgt.x, ty: tgt.y, tw: tgt.h,
      })
    }

    return { nodes, links, svgWidth: W, nodeWidth, gap }
  }, [stages, height])

  if (stages.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">
        暂无漏斗数据
      </div>
    )
  }

  // 构建 SVG path for each link (quadratic bezier)
  const buildLinkPath = (link: typeof links[0]) => {
    const { sx, sy, sw, tx, ty, tw } = link
    return `M ${sx},${sy} L ${tx},${ty} L ${tx},${ty + tw} L ${sx},${sy + sw} Z`
  }

  const total = stages[0]?.count ?? 1

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${height}`}
      className="w-full"
      role="img"
      aria-label="配方生命周期桑基图"
    >
      <defs>
        {nodes.map((n, i) => (
          <linearGradient key={`g-${i}`} id={`sg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={n.color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={n.color} stopOpacity={0.7} />
          </linearGradient>
        ))}
      </defs>

      {/* Links */}
      {links.map((link, i) => (
        <path
          key={i}
          d={buildLinkPath(link)}
          fill={stages[link.from]?.color || '#3b82f6'}
          opacity={0.25}
          className="transition-opacity hover:opacity-40"
        />
      ))}

      {/* Nodes */}
      {nodes.map((n, i) => (
        <g key={n.id}>
          <rect
            x={n.x} y={n.y} width={n.w} height={n.h}
            rx={3}
            fill={n.color}
            opacity={0.85}
          />
          {/* Label */}
          <text
            x={n.x - 8} y={n.y + n.h / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[11px] fill-neutral-600 dark:fill-neutral-400 select-none"
            style={{ fontSize: 11 }}
          >
            {n.label}
          </text>
          {/* Count */}
          <text
            x={n.x + n.w + 8} y={n.y + n.h / 2 - 8}
            textAnchor="start"
            dominantBaseline="middle"
            className="font-semibold fill-neutral-800 dark:fill-neutral-200 select-none"
            style={{ fontSize: 12 }}
          >
            {n.count.toLocaleString()}
          </text>
          {/* Rate */}
          {showRates && i > 0 && (
            <text
              x={(nodes[i - 1].x + nodes[i - 1].w + n.x) / 2}
              y={n.y + n.h + 14}
              textAnchor="middle"
              className="fill-primary-600 dark:fill-primary-400 select-none"
              style={{ fontSize: 10 }}
            >
              {((n.count / Math.max(nodes[i - 1].count, 1)) * 100).toFixed(1)}%
            </text>
          )}
        </g>
      ))}

      {/* Overall rate */}
      {stages.length > 1 && (
        <text
          x={svgWidth / 2}
          y={height - 6}
          textAnchor="middle"
          className="fill-neutral-500 select-none"
          style={{ fontSize: 11 }}
        >
          整体转化率 {(stages[stages.length - 1].count / total * 100).toFixed(1)}%
        </text>
      )}
    </svg>
  )
}

export default SankeyFunnelChart
