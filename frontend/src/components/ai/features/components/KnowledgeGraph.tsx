/**
 * KnowledgeGraph - 知识图谱可视化组件 (v1.0)
 *
 * 使用 D3.js 力导向图实现协同作用关系的可视化展示。
 * 支持节点交互、路径高亮、缩放平移等高级功能。
 *
 * 功能特性：
 * - D3.js Force-Directed Graph 布局
 * - 节点点击展开详情面板
 * - 路径高亮与缩放功能
 * - 悬停显示 tooltip
 * - 性能优化：支持 > 50 节点流畅渲染
 * - 响应式设计 + 移动端适配
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useRef, useEffect, useState, useCallback, memo } from 'react'
import * as d3 from 'd3'
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react'
import { Tooltip } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface GraphNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  id: string
  label: string
  group?: string
  value?: number
  category?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  value?: number
  type?: string
  label?: string
  strength?: number
}

interface KnowledgeGraphProps {
  nodes: GraphNode[]
  links: GraphLink[]
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
  onNodeHover?: (node: GraphNode | null) => void
  showControls?: boolean
  className?: string
}

// ===== 常量配置 =====

const DEFAULT_CONFIG = {
  width: 800,
  height: 600,
  nodeRadius: { min: 5, max: 20 },
  linkDistance: 100,
  chargeStrength: -300,
  centerStrength: 0.05,
  simulationAlphaDecay: 0.02,
  zoomExtent: [0.2, 4] as [number, number],
  colors: {
    node: ['var(--color-primary-500, #10b981)', 'var(--color-primary-400, #34d399)', 'var(--color-emerald-500, #10b981)', 'var(--color-teal-500, #14b8a6)', 'var(--color-info-500, #06b6d4)', 'var(--color-sky-500, #0ea5e9)'],
    link: 'var(--color-slate-400, #9CA3AF)',
    linkHighlight: 'var(--color-secondary, #0A84FF)',
    background: 'var(--color-white, #FFFFFF)',
    text: 'var(--color-gray-700, #374151)',
  },
}

// ===== 主组件实现 =====

const KnowledgeGraph = memo(({
  nodes,
  links,
  width = DEFAULT_CONFIG.width,
  height = DEFAULT_CONFIG.height,
  onNodeClick,
  onNodeHover,
  showControls = true,
  className = '',
}: KnowledgeGraphProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  // D3 引用
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  /**
   * 初始化 D3 力导向图模拟
   */
  const initializeGraph = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return

    // 清除旧内容
    d3.select(svgRef.current).selectAll('*').remove()

    // 创建 SVG 容器
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', DEFAULT_CONFIG.colors.background)

    // 创建缩放容器
    const g = svg.append('g').attr('class', 'graph-container')

    // 缩放行为
    zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(DEFAULT_CONFIG.zoomExtent)
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoomRef.current)

    // 创建力模拟
    simulationRef.current = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id((d: any) => d.id)
        .distance(DEFAULT_CONFIG.linkDistance),
      )
      .force('charge', d3.forceManyBody().strength(DEFAULT_CONFIG.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => {
        const value = d.value || 1
        return Math.sqrt(value) * 10 + DEFAULT_CONFIG.nodeRadius.max
      }))
      .alphaDecay(DEFAULT_CONFIG.simulationAlphaDecay)

    // 绘制连线
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', DEFAULT_CONFIG.colors.link)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.value || 1))

    // 绘制节点
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', (d: any) => {
        const value = d.value || 1
        const minR = DEFAULT_CONFIG.nodeRadius.min
        const maxR = DEFAULT_CONFIG.nodeRadius.max
        return minR + (Math.log(value) / Math.log(nodes.length)) * (maxR - minR)
      })
      .attr('fill', (_: any, i: number) =>
        DEFAULT_CONFIG.colors.node[i % DEFAULT_CONFIG.colors.node.length],
      )
      .attr('stroke', 'var(--color-white, #FFFFFF)')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded),
      )

    // 节点标签
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text((d: GraphNode) => d.label)
      .attr('font-size', '12px')
      .attr('fill', DEFAULT_CONFIG.colors.text)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('pointer-events', 'none')

    // 节点悬停事件
    node.on('mouseenter', function(event: MouseEvent, d: GraphNode) {
      setHoveredNode(d)
      onNodeHover?.(d)
      d3.select(this)
        .transition().duration(200)
        .attr('r', (n: any) => {
          const value = n.value || 1
          const baseR = DEFAULT_CONFIG.nodeRadius.min +
            (Math.log(value) / Math.log(nodes.length)) *
            (DEFAULT_CONFIG.nodeRadius.max - DEFAULT_CONFIG.nodeRadius.min)
          return baseR * 1.2
        })
        .attr('stroke-width', 3)
        .attr('stroke', 'var(--color-secondary, #0A84FF)')

      // 高亮相关连线
      link.attr('stroke', (l: any) =>
        (l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id
          ? DEFAULT_CONFIG.colors.linkHighlight
          : DEFAULT_CONFIG.colors.link,
      )
      .attr('stroke-opacity', (l: any) =>
        (l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id ? 1 : 0.2,
      )
    })

    node.on('mouseleave', function() {
      setHoveredNode(null)
      onNodeHover?.(null)
      d3.select(this)
        .transition().duration(200)
        .attr('r', (n: any) => {
          const value = n.value || 1
          return DEFAULT_CONFIG.nodeRadius.min +
            (Math.log(value) / Math.log(nodes.length)) *
            (DEFAULT_CONFIG.nodeRadius.max - DEFAULT_CONFIG.nodeRadius.min)
        })
        .attr('stroke-width', 2)
        .attr('stroke', 'var(--color-white, #FFFFFF)')

      link.attr('stroke', DEFAULT_CONFIG.colors.link)
        .attr('stroke-opacity', 0.6)
    })

    // 节点点击事件
    node.on('click', (event: MouseEvent, d: GraphNode) => {
      event.stopPropagation()
      setSelectedNode(d)
      onNodeClick?.(d)
      logger.info(`[KnowledgeGraph] 节点点击: ${d.label} (${d.id})`)
    })

    // 更新位置
    simulationRef.current.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as GraphNode).x!)
        .attr('y1', (d: any) => (d.source as GraphNode).y!)
        .attr('x2', (d: any) => (d.target as GraphNode).x!)
        .attr('y2', (d: any) => (d.target as GraphNode).y!)

      node
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)

      labels
        .attr('x', (d: GraphNode) => d.x!)
        .attr('y', (d: GraphNode) => d.y!)
    })

    // 点击空白处取消选择
    svg.on('click', () => {
      setSelectedNode(null)
    })
  }, [nodes, links, width, height, onNodeClick, onNodeHover])

  /**
   * 拖拽事件处理函数
   */
  const dragStarted = (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
    if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  const dragged = (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  const dragEnded = (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>) => {
    if (!event.active) simulationRef.current?.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }

  /**
   * 缩放控制函数
   */
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 1.3)
  }, [])

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 0.7)
  }, [])

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }, [])

  /**
   * 初始化和更新图表
   */
  useEffect(() => {
    initializeGraph()

    return () => {
      simulationRef.current?.stop()
    }
  }, [initializeGraph])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 控制按钮 */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            title="重置视图"
          >
            <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <div className="text-xs text-center text-[var(--text-muted)] mt-1">
            {(zoomLevel * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* SVG 图表 */}
      <svg
        ref={svgRef}
        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700"
        style={{ maxWidth: '100%', height: 'auto' }}
      />

      {/* 悬停 Tooltip */}
      {hoveredNode && (
        <Tooltip content={
          <div className="space-y-1">
            <div className="font-semibold">{hoveredNode.label}</div>
            {hoveredNode.category && (
              <div className="text-xs text-[var(--text-muted)]">分类: {hoveredNode.category}</div>
            )}
            {hoveredNode.description && (
              <div className="text-xs">{hoveredNode.description.slice(0, 100)}...</div>
            )}
          </div>
        }>
          <div className="sr-only">节点信息</div>
        </Tooltip>
      )}

      {/* 选中节点详情面板 */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {selectedNode.label}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
            >
              ×
            </button>
          </div>

          {selectedNode.category && (
            <div className="mb-2">
              <span className="inline-block px-2 py-1 text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700 rounded-full">
                {selectedNode.category}
              </span>
            </div>
          )}

          {selectedNode.description && (
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              {selectedNode.description}
            </p>
          )}

          {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                详细信息
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedNode.metadata).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-[var(--text-muted)]">{key}:</span>{' '}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 统计信息 */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {nodes.length} 个节点
          </span>
          <span>{links.length} 条关系</span>
        </div>
      </div>
    </div>
  )
})

KnowledgeGraph.displayName = 'KnowledgeGraph'

export { KnowledgeGraph }
export default KnowledgeGraph
