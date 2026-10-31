import { useRef, useEffect } from 'react'
import { GraphNode, TYPE_CONFIG } from '../types'
import { CANVAS_COLORS } from '@/utils/canvas-colors'

/** canvas 直绘不解析 CSS var()，需从 computed style 取回具体色值（CHK-04）。 */
function resolveColor(value: string): string {
  if (!value.startsWith('var(')) return value
  const m = value.match(/var\((--[^,\s)]+)(?:\s*,\s*([^)]+))?\)/)
  if (!m) return value
  const resolved = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
    : ''
  return resolved || (m[2] ? m[2].trim() : value)
}

export interface MinimapCanvasProps {
  nodes: GraphNode[]
  edges: Array<{ source: string; target: string }>
  width: number
  height: number
  selectedNode?: GraphNode | null
  pathAnimation?: { source: string; target: string; pathNodes: string[]; pathEdges: [string, string][] } | null
  communities?: Map<string, number>
  communityColors?: Record<number, string>
  onNavigate?: (x: number, y: number, scale: number) => void
}

export default function MinimapCanvas({
  nodes, edges, width, height,
  selectedNode, pathAnimation,
  communities, communityColors,
  onNavigate,
}: MinimapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    const padding = 8
    const drawW = width - padding * 2
    const drawH = height - padding * 2

    const xs = nodes.map(n => n.x ?? 0).filter(x => isFinite(x))
    const ys = nodes.map(n => n.y ?? 0).filter(y => isFinite(y))
    if (xs.length === 0) return

    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = Math.max(maxX - minX, 1)
    const rangeY = Math.max(maxY - minY, 1)

    const scaleX = drawW / rangeX
    const scaleY = drawH / rangeY
    const scale = Math.min(scaleX, scaleY)
    const offsetX = padding + (drawW - rangeX * scale) / 2 - minX * scale
    const offsetY = padding + (drawH - rangeY * scale) / 2 - minY * scale

    const toScreen = (x: number, y: number) => [x * scale + offsetX, y * scale + offsetY]

    // Draw edges
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 0.5
    edges.forEach(e => {
      const src = nodes.find(n => (n.id || n.label) === e.source)
      const tgt = nodes.find(n => (n.id || n.label) === e.target)
      if (!src || !tgt) return
      const [sx, sy] = toScreen(src.x ?? 0, src.y ?? 0)
      const [tx, ty] = toScreen(tgt.x ?? 0, tgt.y ?? 0)
      ctx.strokeStyle = '#9CA3AF'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    })

    // Draw path animation edges (highlighted)
    if (pathAnimation) {
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 1.5
      ctx.strokeStyle = CANVAS_COLORS.accent // canvas 直绘：不解析 var()，用品牌色 hex（M5+）
      pathAnimation.pathEdges.forEach(([sId, tId]) => {
        const sn = nodes.find(n => (n.id || n.label) === sId)
        const tn = nodes.find(n => (n.id || n.label) === tId)
        if (!sn || !tn) return
        const [sx, sy] = toScreen(sn.x ?? 0, sn.y ?? 0)
        const [tx, ty] = toScreen(tn.x ?? 0, tn.y ?? 0)
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(tx, ty)
        ctx.stroke()
      })
    }

    // Draw nodes
    nodes.forEach(n => {
      if (n.x == null || n.y == null || !isFinite(n.x) || !isFinite(n.y)) return
      const [sx, sy] = toScreen(n.x, n.y)
      let fill = resolveColor(TYPE_CONFIG[n.type]?.color) || '#9CA3AF'
      if (communities && communities.size > 0 && communityColors) {
        const commId = communities.get(n.id || n.label)
        if (commId !== undefined && communityColors[commId]) fill = communityColors[commId]
      }
      const isSelected = selectedNode && ((selectedNode.id || selectedNode.label) === (n.id || n.label))
      const isInPath = pathAnimation?.pathNodes.includes(n.id || n.label)

      ctx.globalAlpha = isSelected ? 1 : isInPath ? 0.95 : 0.7
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(sx, sy, isSelected ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#F59E0B'
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else if (isInPath) {
        ctx.strokeStyle = '#C090FF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    // Viewport indicator
    ctx.globalAlpha = 0.4
    ctx.fillStyle = CANVAS_COLORS.secondary // canvas 直绘：用品牌色 hex（M5+）
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [nodes, edges, width, height, selectedNode, pathAnimation, communities, communityColors])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !onNavigate) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const xs = nodes.map(n => n.x ?? 0).filter(x => isFinite(x))
    const ys = nodes.map(n => n.y ?? 0).filter(y => isFinite(y))
    if (xs.length === 0) return
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = Math.max(maxX - minX, 1)
    const rangeY = Math.max(maxY - minY, 1)

    const padding = 8
    const drawW = width - padding * 2
    const drawH = height - padding * 2
    const scaleX = drawW / rangeX
    const scaleY = drawH / rangeY
    const scale = Math.min(scaleX, scaleY)
    const offsetX = padding + (drawW - rangeX * scale) / 2 - minX * scale
    const offsetY = padding + (drawH - rangeY * scale) / 2 - minY * scale

    const graphX = (clickX - offsetX) / scale
    const graphY = (clickY - offsetY) / scale
    onNavigate(graphX, graphY, 2.5)
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      className="w-full h-full cursor-crosshair"
      title="点击跳转到该位置"
    />
  )
}
