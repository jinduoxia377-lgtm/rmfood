/**
 * 工作流可视化编辑器 (Workflow Visual Editor)
 *
 * 功能特性:
 * - 可视化流程图渲染（SVG-based，零依赖）
 * - 拖拽式节点布局
 * - 工作流模板系统
 * - 实时状态更新与动画
 * - 节点详情面板
 * - 缩放和平移支持
 * - 导出/导入工作流配置
 * - 暗色/亮色主题自适应
 *
 * 使用方法:
 * <WorkflowVisualEditor workflow={workflow} onSave={handleSave} />
 *
 * @author RMFOOD Team
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  GitBranch, Plus, Trash2, Save,
  ChevronRight,
  CheckCircle, ZoomIn,
  ZoomOut, Maximize2, Download, Eye,
  Sparkles, RefreshCw, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Card, Modal, Badge, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import type { WorkflowDetail } from '@/api/workflow'
import type { WorkflowTemplate as APITemplate } from '@/api/deep_dev'
import { workflowApi } from '@/api/deep_dev'

// ── 模板 category → lucide icon，替代渲染 emoji 字符串 ──
const TEMPLATE_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  ai_generation: Sparkles,
  review: CheckCircle,
  data_sync: RefreshCw,
  analysis: BarChart3,
  custom: GitBranch,
}

interface WorkflowNode {
  id: string
  type: 'start' | 'task' | 'condition' | 'end' | 'parallel'
  position: { x: number; y: number }
  data: {
    label: string
    taskType?: string
    config?: Record<string, any>
    status?: 'pending' | 'in_progress' | 'completed' | 'failed'
    duration?: number
  }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

// ── 节点样式配置 ──

const NODE_STYLES = {
  start: {
    width: 140,
    height: 50,
    radius: 25,
    fill: 'var(--color-primary, var(--color-primary-400))',
    stroke: 'var(--color-primary-hover, var(--color-primary-500))',
    textColor: 'var(--card-bg-solid, #FFFFFF)',
    darkFill: 'var(--color-primary, var(--color-primary-400))',
    darkStroke: 'var(--color-primary-hover, var(--color-primary-500))',
    darkTextColor: 'var(--card-bg-solid, #FFFFFF)',
  },
  end: {
    width: 140,
    height: 50,
    radius: 25,
    fill: 'var(--color-error, #FF3B30)',
    stroke: 'var(--color-danger-600, #B91C1C)',
    textColor: 'var(--card-bg-solid, #FFFFFF)',
    darkFill: 'var(--color-error, #FF3B30)',
    darkStroke: 'var(--color-danger-600, #B91C1C)',
    darkTextColor: 'var(--card-bg-solid, #FFFFFF)',
  },
  task: {
    width: 180,
    height: 70,
    radius: 8,
    fill: 'var(--card-bg-solid, #FFFFFF)',
    stroke: 'var(--color-secondary, #0A84FF)',
    textColor: 'var(--text-primary, #1D1D1F)',
    darkFill: 'var(--bg-surface, var(--bg-surface-container))',
    darkStroke: 'var(--color-blue-400, #6ECAFF)',
    darkTextColor: 'var(--text-primary, var(--bg-canvas))',
  },
  condition: {
    width: 100,
    height: 100,
    radius: 4,
    fill: 'var(--color-warning-400, #F59E0B)',
    stroke: 'var(--color-warning, #FF9F0A)',
    textColor: 'var(--color-warning-900, #78350F)',
    darkFill: 'var(--color-warning-400, #F59E0B)',
    darkStroke: 'var(--color-warning, #FF9F0A)',
    darkTextColor: 'var(--color-warning-900, #78350F)',
    transform: 'rotate(45deg)',
  },
  parallel: {
    width: 160,
    height: 60,
    radius: 4,
    fill: 'var(--color-tertiary, var(--color-accent-500))',
    stroke: 'var(--color-tertiary-hover, #8B5CF6)',
    textColor: 'var(--card-bg-solid, #FFFFFF)',
    darkFill: 'var(--color-tertiary, var(--color-accent-500))',
    darkStroke: 'var(--color-tertiary-hover, #8B5CF6)',
    darkTextColor: 'var(--card-bg-solid, #FFFFFF)',
  },
}

const STATUS_COLORS = {
  pending: { bg: 'var(--bg-tertiary, var(--bg-canvas))', border: 'var(--text-muted, #9A9A9F)', text: 'var(--text-secondary, #6E6E73)' },
  in_progress: { bg: 'var(--color-secondary-container, #E8F4FD)', border: 'var(--color-secondary, #0A84FF)', text: 'var(--color-blue-700, #0052AE)' },
  completed: { bg: 'var(--color-success-container, #DCFCE7)', border: 'var(--color-primary, var(--color-primary-400))', text: 'var(--color-primary-800, #065F46)' },
  failed: { bg: 'var(--color-error-container, #FFE0E0)', border: 'var(--color-error, #FF3B30)', text: 'var(--color-danger-900, #7F1D1D)' },
}

// ── 主组件 ──

interface WorkflowVisualEditorProps {
  workflow?: WorkflowDetail | null
  onSave?: (config: { nodes: WorkflowNode[], edges: WorkflowEdge[], metadata: Record<string, any> }) => Promise<void>
  readOnly?: boolean
  className?: string
}

export function WorkflowVisualEditor({
  workflow,
  onSave,
  readOnly = false,
  className,
}: WorkflowVisualEditorProps) {
  const { addToast } = useToast()
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [workflowName, setWorkflowName] = useState(workflow?.name || '')
  const [workflowDesc, setWorkflowDesc] = useState(workflow?.description || '')
  const [templates, setTemplates] = useState<APITemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 从现有工作流初始化节点
  useEffect(() => {
    if (workflow?.config?.nodes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部工作流数据变化时同步到画布状态
      setNodes(workflow.config.nodes as WorkflowNode[])
      setEdges((workflow.config.edges || []) as WorkflowEdge[])
    }
  }, [workflow])

  // 从 API 加载模板列表
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载时加载模板列表并更新加载状态
    setTemplatesLoading(true)
    workflowApi.listTemplates()
      .then((res) => setTemplates(res.items || []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false))
  }, [])

  // 应用模板
  // A-27: 列表项 nodes/edges 为可选字段，必须通过 getTemplate(template_id)
  //       拉取完整节点/边详情后再应用，否则画布可能为空或形状不符。
  const applyTemplate = useCallback(async (template: APITemplate) => {
    const templateId = template.template_id || String(template.id)
    setShowTemplateModal(false)
    addToast({ type: 'info', message: `正在加载模板: ${template.name}...` })
    try {
      const detail = await workflowApi.getTemplate(templateId)
      const nodes = (detail?.nodes as unknown as WorkflowNode[]) || []
      const edges = (detail?.edges as unknown as WorkflowEdge[]) || []
      if (nodes.length === 0) {
        addToast({ type: 'warning', message: `模板「${template.name}」没有可用的节点定义` })
      }
      setNodes(nodes)
      setEdges(edges)
      setWorkflowName(detail?.name || template.name)
      setWorkflowDesc(detail?.description || template.description || '')
      addToast({ type: 'success', message: `已应用模板: ${detail?.name || template.name}` })
    } catch {
      // 回退：使用列表项自带的 nodes/edges（若存在）
      const nodes = (template.nodes as unknown as WorkflowNode[]) || []
      const edges = (template.edges as unknown as WorkflowEdge[]) || []
      setNodes(nodes)
      setEdges(edges)
      setWorkflowName(template.name)
      setWorkflowDesc(template.description || '')
      addToast({ type: 'warning', message: '加载模板详情失败，已使用列表项基础数据' })
    }
  }, [addToast])

  // 添加节点
  const addNode = useCallback((type: WorkflowNode['type'], position?: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 },
      data: {
        label: type === 'start' ? '开始' : type === 'end' ? '结束' : '新任务',
        ...(type === 'task' && { taskType: 'custom' }),
        status: 'pending',
      },
    }
    setNodes(prev => [...prev, newNode])
    addToast({ type: 'success', message: '已添加新节点' })
  }, [addToast])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
    if (selectedNode?.id === nodeId) setSelectedNode(null)
    addToast({ type: 'info', message: '已删除节点' })
  }, [selectedNode, addToast])

  // 缩放控制
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.3))
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  // 保存工作流
  const handleSave = async () => {
    if (!onSave) return
    try {
      await onSave({
        nodes,
        edges,
        metadata: {
          name: workflowName,
          description: workflowDesc,
          createdAt: new Date().toISOString(),
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      })
      addToast({ type: 'success', message: '工作流保存成功' })
    } catch {
      addToast({ type: 'error', message: '保存失败，请重试' })
    }
  }

  // 导出配置
  const exportConfig = () => {
    const config = { nodes, edges, metadata: { name: workflowName, description: workflowDesc } }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', message: '工作流配置已导出' })
  }

  // 渲染节点
  const renderNode = (node: WorkflowNode, isDark: boolean) => {
    const style = NODE_STYLES[node.type]
    const statusColor = node.data.status ? STATUS_COLORS[node.data.status] : null

    if (node.type === 'condition') {
      return (
        <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y})`}>
          {/* 菱形条件节点 */}
          <rect
            x="-50"
            y="-50"
            width="100"
            height="100"
            rx="4"
            fill={isDark ? style.darkFill || style.fill : style.fill}
            stroke={selectedNode?.id === node.id ? 'var(--color-secondary, #0A84FF)' : isDark ? style.darkStroke || style.stroke : style.stroke}
            strokeWidth={selectedNode?.id === node.id ? 3 : 2}
            transform="rotate(45)"
            className="cursor-pointer transition-all hover:opacity-80"
            onClick={() => !readOnly && setSelectedNode(node)}
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? style.darkTextColor || style.textColor : style.textColor}
            fontSize="12"
            fontWeight="600"
            pointerEvents="none"
          >
            {node.data.label}
          </text>
        </g>
      )
    }

    return (
      <g
        key={node.id}
        transform={`translate(${node.position.x}, ${node.position.y})`}
        className="cursor-move"
        onPointerDown={(e) => { const { pointerId } = e; e.currentTarget.setPointerCapture(pointerId); 
          if (readOnly) return
          e.preventDefault()
          setDraggedNode(node.id)
          setSelectedNode(node)
        }}
      >
        {/* 节点主体 */}
        <rect
          x={-style.width / 2}
          y={-style.height / 2}
          width={style.width}
          height={style.height}
          rx={style.radius}
          fill={
            statusColor?.bg ||
            (isDark && style.darkFill ? style.darkFill : style.fill)
          }
          stroke={selectedNode?.id === node.id ? 'var(--color-secondary, #0A84FF)' : statusColor?.border || (isDark && style.darkStroke ? style.darkStroke : style.stroke)}
          strokeWidth={selectedNode?.id === node.id ? 3 : 2}
          className="transition-all"
          filter={node.data.status === 'in_progress' ? 'url(#pulse)' : undefined}
        />

        {/* 状态指示器 */}
        {node.data.status && node.data.status !== 'pending' && (
          <circle
            cx={style.width / 2 - 12}
            cy={-style.height / 2 + 12}
            r="8"
            fill={STATUS_COLORS[node.data.status].bg}
            stroke={STATUS_COLORS[node.data.status].border}
            strokeWidth="2"
          >
            {node.data.status === 'in_progress' && (
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="1.5s"
                repeatCount="indefinite"
              />
            )}
          </circle>
        )}

        {/* 节点文本 */}
        <text
          x="0"
          y={node.type === 'start' || node.type === 'end' ? 5 : -5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isDark && style.darkTextColor ? style.darkTextColor : style.textColor}
          fontSize={node.type === 'start' || node.type === 'end' ? 14 : 13}
          fontWeight="600"
          pointerEvents="none"
        >
          {node.data.label}
        </text>

        {/* 任务类型标签 */}
        {node.type === 'task' && node.data.taskType && (
          <text
            x="0"
            y={18}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)'}
            fontSize="10"
            pointerEvents="none"
          >
            {(() => {
              const typeMap: Record<string, string> = {
                custom: '自定义',
                user_input: '用户输入',
                llm_analysis: 'LLM 分析',
                agent_smart: '智能 Agent',
                formula_gpt: '配方生成',
                llm: 'LLM 处理',
                safety_check: '安全检查',
                save_result: '保存结果',
                regenerate: '重新生成',
                agent_fast: '快速 Agent',
                fetch_tcmsp: 'TCMSP 检索',
                fetch_dfbp: 'DFBP 检索',
                merge: '数据合并',
                validate: '质量验证',
                update_graph: '图谱更新',
              }
              return typeMap[node.data.taskType] || node.data.taskType.replace(/_/g, ' ')
            })()}
          </text>
        )}
      </g>
    )
  }

  // 渲染连线
  const renderEdge = (edge: WorkflowEdge, isDark: boolean) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) return null

    const startX = sourceNode.position.x
    const startY = sourceNode.position.y + (NODE_STYLES[sourceNode.type].height / 2)
    const endX = targetNode.position.x
    const endY = targetNode.position.y - (NODE_STYLES[targetNode.type].height / 2)
    const midY = (startY + endY) / 2

    const pathD = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`

    return (
      <g key={edge.id}>
        {/* 连线 */}
        <path
          d={pathD}
          fill="none"
          stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'}
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
          className="transition-all hover:stroke-secondary-500"
        />
        {/* 标签 */}
        {edge.label && (
          <text
            x={(startX + endX) / 2 + 10}
            y={midY}
            fill={isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)'}
            fontSize="11"
            fontWeight="500"
          >
            {edge.label}
          </text>
        )}
      </g>
    )
  }

  // 计算画布尺寸
  const canvasSize = useMemo(() => {
    if (nodes.length === 0) return { width: 1000, height: 800 }
    const maxX = Math.max(...nodes.map(n => n.position.x + 200)) + 100
    const maxY = Math.max(...nodes.map(n => n.position.y + 150)) + 100
    return { width: Math.max(maxX, 800), height: Math.max(maxY, 600) }
  }, [nodes])

  return (
    <div className={cn('flex flex-col h-full bg-neutral-50 dark:bg-neutral-900 rounded-xl overflow-hidden', className)}>
      {/* ── 工具栏 ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <GitBranch size={20} className="text-secondary-600" />
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="工作流名称"
            className="w-48 h-8"
            disabled={readOnly}
          />
          {!readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowTemplateModal(true)}>
                <Plus size={14} className="mr-1" /> 模板
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('task')}>
                <Plus size={14} className="mr-1" /> 任务
              </Button>
              <Button size="sm" variant="outline" onClick={() => addNode('condition')}>
                条件
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 mr-2">
            <Button size="sm" variant="ghost" onClick={zoomOut}><ZoomOut size={16} /></Button>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button size="sm" variant="ghost" onClick={zoomIn}><ZoomIn size={16} /></Button>
            <Button size="sm" variant="ghost" onClick={resetView}><Maximize2 size={16} /></Button>
          </div>

          {!readOnly && (
            <>
              <Button size="sm" variant="outline" onClick={exportConfig}>
                <Download size={14} className="mr-1" /> 导出
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save size={14} className="mr-1" /> 保存
              </Button>
            </>
          )}

          {readOnly && (
            <Button size="sm" variant="outline" onClick={() => setShowConfigPanel(!showConfigPanel)}>
              <Eye size={14} className="mr-1" /> 详情
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 画布区域 ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative"
          onMouseMove={(e) => {
            if (draggedNode && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect()
              const x = (e.clientX - rect.left) / scale - offset.x
              const y = (e.clientY - rect.top) / scale - offset.y
              setNodes(prev =>
                prev.map(n =>
                  n.id === draggedNode
                    ? { ...n, position: { x: x - 50, y: y - 35 } }
                    : n,
                ),
              )
            }
          }}
          onMouseUp={() => setDraggedNode(null)}
          onMouseLeave={() => setDraggedNode(null)}
        >
          <svg
            width={canvasSize.width * scale}
            height={canvasSize.height * scale}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            className="bg-white dark:bg-neutral-900"
            style={{ minWidth: '100%', minHeight: '100%' }}
          >
            <defs>
              {/* 箭头标记 */}
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
              </marker>

              {/* 脉冲动画滤镜 */}
              <filter id="pulse">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* 阴影效果 */}
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
              </filter>
            </defs>

            {/* 网格背景 */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E7EB" strokeWidth="0.5" className="dark:stroke-neutral-700" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />

            {/* 渲染边 */}
            {edges.map(edge => renderEdge(edge, false))}

            {/* 渲染节点 */}
            {nodes.map(node => renderNode(node, false))}
          </svg>

          {/* 空状态提示 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <GitBranch size={64} className="mx-auto text-neutral-300 dark:text-neutral-400" />
                <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                  {readOnly ? '工作流暂无节点' : '开始构建工作流'}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                  {readOnly ? '此工作流尚未配置任何节点' : '选择一个预设模板或从头开始创建自定义工作流'}
                </p>
                {/* A-27: readOnly 下不显示「选择模板」按钮，避免只读态误触编辑 */}
                {!readOnly && (
                  <Button onClick={() => setShowTemplateModal(true)}>
                    <Plus size={16} className="mr-2" /> 选择模板
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 右侧属性面板 ── */}
        {(selectedNode || showConfigPanel) && (
          <div className="w-72 bg-white dark:bg-neutral-800 border-l border-neutral-200 dark:border-neutral-700 p-4 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center justify-between">
                  节点属性
                  <Button size="sm" variant="ghost" onClick={() => deleteNode(selectedNode.id)} className="text-error-500">
                    <Trash2 size={14} />
                  </Button>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">名称</label>
                    <Input
                      value={selectedNode.data.label}
                      onChange={(e) =>
                        setNodes(prev =>
                          prev.map(n =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, label: e.target.value } }
                              : n,
                          ),
                        )
                      }
                      disabled={readOnly}
                    />
                  </div>

                  {selectedNode.type === 'task' && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">任务类型</label>
                      <Select
                        value={selectedNode.data.taskType || ''}
                        onChange={(v) =>
                          setNodes(prev =>
                            prev.map(n =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, taskType: v } }
                                : n,
                            ),
                          )
                        }
                        disabled={readOnly}
                      >
                        <option value="">选择类型...</option>
                        <option value="user_input">用户输入</option>
                        <option value="llm_analysis">LLM 分析</option>
                        <option value="neural_generate">神经网络生成</option>
                        <option value="multi_optimize">多目标优化</option>
                        <option value="safety_check">安全性检查</option>
                        <option value="expert_review">专家审核</option>
                        <option value="auto_validate">自动验证</option>
                        <option value="save_result">保存结果</option>
                        <option value="notify">发送通知</option>
                        <option value="custom">自定义任务</option>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">位置</label>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      X: {Math.round(selectedNode.position.x)}, Y: {Math.round(selectedNode.position.y)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white">工作流信息</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">节点数:</span>{' '}
                    <span className="font-medium">{nodes.length}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">连接数:</span>{' '}
                    <span className="font-medium">{edges.length}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">类型:</span>{' '}
                    <span className="font-medium capitalize">{workflow?.workflow_type || '自定义'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 模板选择弹窗 ── */}
      {showTemplateModal && (
        <Modal
          title="选择工作流模板"
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
        >
          <div className="space-y-3 mt-4">
            {templatesLoading ? (
              <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">加载中...</div>
            ) : templates.length > 0 ? (
              templates.map((template) => (
                <Card
                  key={template.template_id || template.id}
                  hoverable
                  className="p-4 cursor-pointer"
                  onClick={() => applyTemplate(template)}
                >
                  <div className="flex items-start gap-3">
                    {(() => {
                      const TIcon = TEMPLATE_ICON_MAP[template.category] || Sparkles
                      return <div className="shrink-0 opacity-75 text-primary-500 dark:text-primary-700"><TIcon size={18} /></div>
                    })()}
                    <div className="flex-1">
                      <h4 className="font-semibold text-neutral-900 dark:text-white">
                        {template.name}
                      </h4>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        <span>{template.node_count} 个节点</span>
                        <span>·</span>
                        <span>{template.estimated_duration || '未知'}</span>
                        <span>·</span>
                        <Badge size="sm" className="mt-0">{template.category.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1" />
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">暂无可用模板</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default WorkflowVisualEditor

