/**
 * KnowledgeGraphPanel - 知识库「知识图谱」专业探索面板
 *
 * 能力：
 * - 节点联想搜索（300ms 防抖，命中 `/nodes/search`，最多 8 条下拉）
 * - 搜索/回车以中心词调用 `/subgraph` 展开子图；联想点击调用 `/nodes/{id}/subgraph`
 * - 复用 `features/components/KnowledgeGraph` 渲染（缩放/拖拽/tooltip/选中详情）
 * - 节点 > 500 时按连接度截断，并提示 graphTooLarge
 * - 统计条（节点/关系 + 四类节点计数）与图例
 * - 选中节点面板内「以此节点为中心展开」（由 KnowledgeGraph 注入回调）
 * - 可折叠分析侧栏：中心性 / 社区 / K-Core / 桥梁 / 相似药材推荐
 * - 完整状态：初始 / 加载 / 空 / 错误 + 重试
 *
 * 全部文案来自 `ai.knowledge.graph*` 既有 i18n 键；样式使用 Tailwind + CSS 变量 + dark:。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Network,
  Play,
  Search,
} from 'lucide-react'
import { databaseApi, getNodeSubgraph, searchGraphNodes } from '@/api/database'
import { runKgAnalysis } from '@/components/database/graph/hooks/kgAsyncAnalysis'
import { KnowledgeGraph } from '@/components/ai/features/components/KnowledgeGraph'
import type { GraphLink, GraphNode } from '@/components/ai/features/components/KnowledgeGraph'
import { Card } from '@/components/ui'

// ═══════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════

type NodeKind = 'herb' | 'compound' | 'target' | 'disease'
type NodeTypeFilter = '' | NodeKind

/** 四类节点的固定配色（与 KnowledgeGraph 内部 category 着色保持一致） */
const NODE_TYPE_COLORS: Record<NodeKind, string> = {
  herb: '#10b981',
  compound: '#3b82f6',
  target: '#8b5cf6',
  disease: '#f59e0b',
}

/** 节点类型 → i18n 键 */
const NODE_TYPE_LABEL_KEYS: Record<NodeKind, string> = {
  herb: 'ai.knowledge.graphTypeHerb',
  compound: 'ai.knowledge.graphTypeCompound',
  target: 'ai.knowledge.graphTypeTarget',
  disease: 'ai.knowledge.graphTypeDisease',
}

const NODE_KINDS: NodeKind[] = ['herb', 'compound', 'target', 'disease']

/** 图区高度（需求固定 520） */
const GRAPH_HEIGHT = 520
/** 单次渲染的最大节点数，超出按连接度截断 */
const MAX_GRAPH_NODES = 500
/** 搜索联想条数上限 */
const MAX_SUGGESTIONS = 8
/** 输入防抖时长 */
const SEARCH_DEBOUNCE_MS = 300
/** 分析结果列表上限 */
const MAX_ANALYSIS_ITEMS = 10
/** 未测量到容器宽度时的兜底宽度 */
const FALLBACK_GRAPH_WIDTH = 760

/** 分析算法类别 */
type AnalysisKind = 'centrality' | 'communities' | 'kcore' | 'bridges' | 'recommend'

interface AnalysisItem {
  id: string
  label: string
  value: string
  type?: string
}

interface AnalysisState {
  status: 'idle' | 'loading' | 'success' | 'error'
  items: AnalysisItem[]
}

// ═══════════════════════════════════════════
// 后端原始数据类型（不同接口字段略有差异，统一在后端原始层做兼容）
// ═══════════════════════════════════════════

interface RawNode {
  id?: number | string
  node_id?: number | string
  label?: string
  node_label?: string
  type?: string
  node_type?: string
  category?: string
  group?: string
  description?: string | null
  metadata?: Record<string, unknown>
  importance?: number
  value?: number
}

interface RawEdge {
  source?: string | number | RawNode | null
  target?: string | number | RawNode | null
  source_id?: string | number
  target_id?: string | number
  type?: string
  relation?: string
  relation_type?: string
  strength?: number
  value?: number
}

interface RawCenterSubgraph {
  center_node?: string
  nodes?: RawNode[]
  edges?: RawEdge[]
}

interface RawNodeSubgraph {
  root_node_id?: string | number
  nodes?: RawNode[]
  edges?: RawEdge[]
}

interface RawGraphStats {
  total_nodes?: number
  graph_node_count?: number
  graph_edge_count?: number
  estimated_total_edges?: number
  total_herbs?: number
  total_compounds?: number
  total_targets?: number
  total_diseases?: number
  node_type_breakdown?: Record<string, number>
}

// ═══════════════════════════════════════════
// 纯函数工具
// ═══════════════════════════════════════════

function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as string[]).includes(value)
}

/** 数字本地化格式（千分位）；非法值回退破折号 */
function formatCount(value: number, language: string): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(language).format(value)
  } catch {
    return String(value)
  }
}

/** 分析指标格式化：大数取整、常规取 3 位、小数取 4 位、极小值用科学计数法 */
function formatMetric(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1000) return value.toFixed(0)
  if (abs >= 1) return value.toFixed(3)
  if (abs >= 0.001) return value.toFixed(4)
  return value.toExponential(2)
}

const METRIC_KEYS = [
  'pagerank_score',
  'betweenness_score',
  'closeness_score',
  'bridge_score',
  'score',
  'coreness',
  'centrality',
  'value',
]

/** 从分析结果行中提取数值指标（不同算法返回不同字段名） */
function pickMetric(row: Record<string, unknown>): number | null {
  for (const key of METRIC_KEYS) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

/** 原始节点 → 渲染节点（兼容 `{id,label,type}` 与 `{node_id,node_label,node_type}` 两种字段） */
function normalizeNode(raw: RawNode, index: number): GraphNode {
  const idValue = raw.id ?? raw.node_id ?? raw.label ?? raw.node_label
  const id =
    idValue !== undefined && idValue !== null && String(idValue).length > 0
      ? String(idValue)
      : `node-${index}`
  const label = raw.node_label ?? raw.label ?? id
  const category = raw.node_type ?? raw.type ?? raw.category ?? raw.group
  return {
    id,
    label: String(label),
    category: category ? String(category).toLowerCase() : undefined,
    value: 1,
    description: raw.description ?? undefined,
    metadata: raw.metadata,
  }
}

/** 取边端点 id（兼容字符串 / 数字 / D3 改写后的节点对象） */
function endpointId(endpoint: RawEdge['source']): string | null {
  if (endpoint === null || endpoint === undefined) return null
  if (typeof endpoint === 'object') {
    const value = endpoint.id ?? endpoint.node_id ?? endpoint.label ?? endpoint.node_label
    return value === undefined || value === null ? null : String(value)
  }
  return String(endpoint)
}

/** 渲染阶段边端点 id（D3 会把字符串端点改写成节点对象） */
function linkEndpointId(endpoint: GraphLink['source'] | GraphLink['target']): string {
  if (typeof endpoint === 'string') return endpoint
  return endpoint?.id ?? ''
}

/** 原始边 → 渲染边，丢弃任一端点不在节点集合内的悬空边（否则 D3 forceLink 会抛错） */
function normalizeLinks(rawEdges: RawEdge[] | undefined, nodes: GraphNode[]): GraphLink[] {
  const ids = new Set(nodes.map((node) => node.id))
  const links: GraphLink[] = []
  for (const edge of rawEdges ?? []) {
    const source =
      endpointId(edge.source) ?? (edge.source_id !== undefined ? String(edge.source_id) : null)
    const target =
      endpointId(edge.target) ?? (edge.target_id !== undefined ? String(edge.target_id) : null)
    if (!source || !target || source === target) continue
    if (!ids.has(source) || !ids.has(target)) continue
    links.push({
      source,
      target,
      type: edge.relation ?? edge.type ?? edge.relation_type ?? 'related',
      label: edge.relation ?? edge.type ?? '',
      value:
        typeof edge.strength === 'number'
          ? edge.strength
          : typeof edge.value === 'number'
            ? edge.value
            : 1,
    })
  }
  return links
}

/** 用连接度作为节点半径权重（1 + degree），避免所有节点同尺寸 */
function withDegreeWeights(nodes: GraphNode[], links: GraphLink[]): GraphNode[] {
  const degree = new Map<string, number>()
  for (const link of links) {
    const source = linkEndpointId(link.source)
    const target = linkEndpointId(link.target)
    if (source) degree.set(source, (degree.get(source) ?? 0) + 1)
    if (target) degree.set(target, (degree.get(target) ?? 0) + 1)
  }
  return nodes.map((node) => ({ ...node, value: (degree.get(node.id) ?? 0) + 1 }))
}

/** 统计四类（及未知类型）节点数量 */
function countNodeTypes(nodes: GraphNode[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const node of nodes) {
    if (!node.category) continue
    counts[node.category] = (counts[node.category] ?? 0) + 1
  }
  return counts
}

interface LimitedGraph {
  nodes: GraphNode[]
  links: GraphLink[]
  truncated: boolean
}

/**
 * 超过 MAX_GRAPH_NODES 时截断：
 * 优先保留中心节点，其余按连接度降序；只保留两端都在保留集合内的边。
 */
function limitGraph(nodes: GraphNode[], links: GraphLink[], priorityIds: string[]): LimitedGraph {
  if (nodes.length <= MAX_GRAPH_NODES) return { nodes, links, truncated: false }

  const priority = new Set(priorityIds)
  const degree = new Map<string, number>()
  for (const link of links) {
    const source = linkEndpointId(link.source)
    const target = linkEndpointId(link.target)
    if (source) degree.set(source, (degree.get(source) ?? 0) + 1)
    if (target) degree.set(target, (degree.get(target) ?? 0) + 1)
  }

  const ordered = [...nodes].sort((a, b) => {
    const byPriority = Number(priority.has(b.id)) - Number(priority.has(a.id))
    if (byPriority !== 0) return byPriority
    return (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
  })

  const keptNodes = ordered.slice(0, MAX_GRAPH_NODES)
  const keptIds = new Set(keptNodes.map((node) => node.id))
  const keptLinks = links.filter(
    (link) => keptIds.has(linkEndpointId(link.source)) && keptIds.has(linkEndpointId(link.target)),
  )
  return { nodes: keptNodes, links: keptLinks, truncated: true }
}

// ═══════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════

/** 类型徽标（herb/compound/target/disease 使用固定色；未知类型回退中性灰） */
function TypeBadge({ type }: { type?: string }) {
  const { t } = useTranslation()
  if (!type) return null
  const normalized = type.toLowerCase()
  if (!isNodeKind(normalized)) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        {type}
      </span>
    )
  }
  const color = NODE_TYPE_COLORS[normalized]
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {t(NODE_TYPE_LABEL_KEYS[normalized])}
    </span>
  )
}

/** 单个分析卡片（标题 + 运行按钮 + 结果/空态/错误态） */
function AnalysisSection({
  kind,
  title,
  state,
  onRun,
}: {
  kind: AnalysisKind
  title: string
  state: AnalysisState
  onRun: () => void
}) {
  const { t } = useTranslation()
  return (
    <section
      data-testid={`kg-analysis-${kind}`}
      className="rounded-lg border border-[var(--border-color)] bg-white/60 dark:bg-neutral-900/40 p-2.5 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-[var(--text-primary)] dark:text-neutral-200">
          {title}
        </h4>
        <button
          type="button"
          onClick={onRun}
          disabled={state.status === 'loading'}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-[var(--border-color)] text-[var(--text-secondary)] transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.status === 'loading' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {t('ai.knowledge.graphRunAnalysis')}
        </button>
      </div>

      {state.status === 'error' ? (
        <p className="text-[11px] text-error-600 dark:text-error-400">
          {t('ai.knowledge.graphLoadFailed')}
        </p>
      ) : state.status === 'success' && state.items.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)]">
          {t('ai.knowledge.graphAnalysisEmpty')}
        </p>
      ) : state.status === 'success' ? (
        <ul className="max-h-56 overflow-y-auto space-y-0.5">
          {state.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="truncate text-[11px] text-[var(--text-primary)] dark:text-neutral-200"
                  title={item.label}
                >
                  {item.label}
                </span>
                <TypeBadge type={item.type} />
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-[var(--text-secondary)] flex-shrink-0">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

// ═══════════════════════════════════════════
// 主面板
// ═══════════════════════════════════════════

interface SearchSuggestion {
  id: string
  label: string
  type: string
  description?: string
}

interface GraphViewData {
  nodes: GraphNode[]
  links: GraphLink[]
  totalNodes: number
  totalLinks: number
  truncated: boolean
  typeCounts: Record<string, number>
}

type GraphState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'success'; data: GraphViewData }

type RetryTarget =
  | { kind: 'center'; center: string }
  | { kind: 'node'; option: SearchSuggestion }

function createAnalysisState(): Record<AnalysisKind, AnalysisState> {
  return {
    centrality: { status: 'idle', items: [] },
    communities: { status: 'idle', items: [] },
    kcore: { status: 'idle', items: [] },
    bridges: { status: 'idle', items: [] },
    recommend: { status: 'idle', items: [] },
  }
}

export function KnowledgeGraphPanel() {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'zh-CN'

  // ── 搜索区状态 ──
  const [input, setInput] = useState('')
  const [nodeType, setNodeType] = useState<NodeTypeFilter>('')
  const [center, setCenter] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestSettled, setSuggestSettled] = useState(false)
  const skipSuggestRef = useRef(false)
  const suggestSeqRef = useRef(0)

  // ── 图区状态 ──
  const [graphState, setGraphState] = useState<GraphState>({ status: 'idle' })
  const [graphWidth, setGraphWidth] = useState(FALLBACK_GRAPH_WIDTH)
  const graphBoxRef = useRef<HTMLDivElement>(null)
  const loadSeqRef = useRef(0)
  const retryRef = useRef<RetryTarget | null>(null)

  // ── 分析侧栏 ──
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysis, setAnalysis] = useState<Record<AnalysisKind, AnalysisState>>(createAnalysisState)

  // 整体图谱规模（未加载子图时用于统计条兜底）
  const statsQuery = useQuery<RawGraphStats>({
    queryKey: ['knowledge-graph-overview-stats'],
    queryFn: async () => (await databaseApi.getGraphStats()) as RawGraphStats,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // 容器宽度测量：把实际宽度传给 KnowledgeGraph，保证 520 高度下不裁切
  useEffect(() => {
    const element = graphBoxRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (typeof width === 'number' && width > 0) setGraphWidth(Math.round(width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // 300ms 防抖联想搜索
  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false
      return
    }
    const query = input.trim()
    // 清空输入时的状态重置在 onChange 中同步完成，避免在 effect 内同步 setState
    if (query.length < 1) return
    const seq = ++suggestSeqRef.current
    const timer = window.setTimeout(() => {
      setSuggestLoading(true)
      void (async () => {
        try {
          const data = (await searchGraphNodes(query, nodeType || undefined)) as {
            nodes?: RawNode[]
          }
          if (seq !== suggestSeqRef.current) return
          const next = (data?.nodes ?? [])
            .slice(0, MAX_SUGGESTIONS)
            .map((raw, index) => {
              const node = normalizeNode(raw, index)
              return {
                id: node.id,
                label: node.label,
                type: node.category ?? '',
                description: node.description,
              }
            })
          setSuggestions(next)
          setSuggestOpen(true)
          setSuggestSettled(true)
        } catch {
          if (seq !== suggestSeqRef.current) return
          setSuggestions([])
          setSuggestOpen(false)
          setSuggestSettled(false)
        } finally {
          if (seq === suggestSeqRef.current) setSuggestLoading(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [input, nodeType])

  // ── 图数据归一 / 截断 ──
  const applyGraphData = useCallback(
    (rawNodes: RawNode[], rawEdges: RawEdge[], priorityIds: string[]) => {
      const baseNodes = rawNodes.map(normalizeNode)
      const links = normalizeLinks(rawEdges, baseNodes)
      const nodes = withDegreeWeights(baseNodes, links)
      const limited = limitGraph(nodes, links, priorityIds)
      setGraphState({
        status: 'success',
        data: {
          nodes: limited.nodes,
          links: limited.links,
          totalNodes: nodes.length,
          totalLinks: links.length,
          truncated: limited.truncated,
          typeCounts: countNodeTypes(nodes),
        },
      })
    },
    [],
  )

  // 以中心词展开（回车 / 搜索按钮 / 选中节点展开按钮共用）
  const loadByCenter = useCallback(
    async (rawCenter: string) => {
      const targetCenter = rawCenter.trim()
      if (!targetCenter) return
      const seq = ++loadSeqRef.current
      retryRef.current = { kind: 'center', center: targetCenter }
      skipSuggestRef.current = true
      setInput(targetCenter)
      setCenter(targetCenter)
      setSuggestOpen(false)
      setGraphState({ status: 'loading' })
      try {
        const data = (await databaseApi.findSubgraph(targetCenter, 2)) as RawCenterSubgraph
        if (seq !== loadSeqRef.current) return
        applyGraphData(data?.nodes ?? [], data?.edges ?? [], [targetCenter])
      } catch (error) {
        if (seq !== loadSeqRef.current) return
        setGraphState({
          status: 'error',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [applyGraphData],
  )

  // 联想点击：按节点 id 拉取子图（后端返回不含根节点，这里按 root_node_id 补齐）
  const loadNodeSubgraph = useCallback(
    async (option: SearchSuggestion) => {
      const seq = ++loadSeqRef.current
      retryRef.current = { kind: 'node', option }
      skipSuggestRef.current = true
      setInput(option.label)
      setCenter(option.label)
      setSuggestOpen(false)
      setSuggestions([])
      setSuggestSettled(false)
      setGraphState({ status: 'loading' })
      try {
        const data = (await getNodeSubgraph(option.id, 2)) as RawNodeSubgraph
        if (seq !== loadSeqRef.current) return
        const rawNodes = [...(data?.nodes ?? [])]
        const rootId = String(data?.root_node_id ?? option.id)
        const hasRoot = rawNodes.some((raw) => {
          const idValue = raw.id ?? raw.node_id
          return idValue !== undefined && idValue !== null && String(idValue) === rootId
        })
        if (!hasRoot) {
          rawNodes.unshift({
            id: rootId,
            label: option.label,
            type: option.type,
            description: option.description,
          })
        }
        applyGraphData(rawNodes, data?.edges ?? [], [rootId])
      } catch (error) {
        if (seq !== loadSeqRef.current) return
        setGraphState({
          status: 'error',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [applyGraphData],
  )

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    skipSuggestRef.current = false
    setInput(value)
    if (value.trim().length < 1) {
      setSuggestions([])
      setSuggestOpen(false)
      setSuggestSettled(false)
    } else {
      setSuggestOpen(true)
      setSuggestSettled(false)
    }
  }

  const handleSubmit = useCallback(() => {
    const query = input.trim()
    if (!query) return
    void loadByCenter(query)
  }, [input, loadByCenter])

  const handleRetry = useCallback(() => {
    const target = retryRef.current
    if (!target) return
    if (target.kind === 'center') void loadByCenter(target.center)
    else void loadNodeSubgraph(target.option)
  }, [loadByCenter, loadNodeSubgraph])

  // 选中节点面板中的「以此节点为中心展开」
  const handleExpandNode = useCallback(
    (node: GraphNode) => {
      void loadByCenter(node.label)
    },
    [loadByCenter],
  )

  // ── 分析执行 ──
  const runAnalysis = useCallback(
    async (kind: AnalysisKind) => {
      if (kind === 'recommend' && !center) {
        setAnalysis((prev) => ({
          ...prev,
          recommend: { status: 'success', items: [] },
        }))
        return
      }
      setAnalysis((prev) => ({ ...prev, [kind]: { status: 'loading', items: [] } }))
      try {
        let items: AnalysisItem[] = []

        if (kind === 'centrality') {
          const data = (await databaseApi.getCentrality('pageRank', 20)) as {
            results?: Array<Record<string, unknown>>
          }
          items = (data?.results ?? []).map((row, index) => ({
            id: `centrality-${String(row.node_id ?? index)}`,
            label: String(row.node_label ?? row.node_id ?? '—'),
            value: formatMetric(pickMetric(row)),
            type: typeof row.node_type === 'string' ? row.node_type : undefined,
          }))
        } else if (kind === 'communities') {
          // ②b：社区检测 B表全谱同步会超时，走异步任务（提交→轮询→缓存）
          const data = (await runKgAnalysis('communities')) as {
            communities?: Array<{ community_id?: number; size?: number; nodes?: Array<{ node_type?: string }> }>
          }
          items = (data?.communities ?? []).map((row, index) => {
            const communityId = row.community_id ?? index
            // 从社区成员统计主导类型（后端返回 nodes，无 type_distribution）
            const typeCount = new Map<string, number>()
            for (const n of row.nodes ?? []) {
              if (typeof n?.node_type === 'string') typeCount.set(n.node_type, (typeCount.get(n.node_type) ?? 0) + 1)
            }
            const dominant = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
            return {
              id: `community-${String(communityId)}`,
              label: `#${String(communityId)}`,
              value: formatMetric(typeof row.size === 'number' ? row.size : (row.nodes?.length ?? null)),
              type: dominant,
            }
          })
        } else if (kind === 'kcore') {
          // ②b：K-Core B表全谱同步 ~34s 会超时，走异步任务
          const data = (await runKgAnalysis('kcore')) as {
            results?: Array<Record<string, unknown>>
          }
          items = (data?.results ?? []).map((row, index) => ({
            id: `kcore-${String(row.node_id ?? index)}`,
            label: String(row.node_label ?? row.node_id ?? '—'),
            value: formatMetric(
              typeof row.coreness === 'number' ? row.coreness : pickMetric(row),
            ),
            type: typeof row.node_type === 'string' ? row.node_type : undefined,
          }))
        } else if (kind === 'bridges') {
          const data = (await databaseApi.getBridges()) as {
            bridges?: Array<Record<string, unknown>>
          }
          items = (data?.bridges ?? []).map((row, index) => ({
            id: `bridge-${String(row.node_id ?? index)}`,
            label: String(row.node_label ?? row.node_id ?? '—'),
            value: formatMetric(
              typeof row.bridge_score === 'number' ? row.bridge_score : pickMetric(row),
            ),
            type: typeof row.node_type === 'string' ? row.node_type : undefined,
          }))
        } else {
          const data = (await databaseApi.recommendHerbs(center, 10)) as {
            recommendations?: Array<Record<string, unknown>>
          }
          items = (data?.recommendations ?? []).map((row, index) => ({
            id: `recommend-${String(row.herb_id ?? index)}`,
            label: String(row.herb_name ?? row.herb_id ?? '—'),
            value: formatMetric(pickMetric(row)),
            type: 'herb',
          }))
        }

        setAnalysis((prev) => ({
          ...prev,
          [kind]: { status: 'success', items: items.slice(0, MAX_ANALYSIS_ITEMS) },
        }))
      } catch {
        setAnalysis((prev) => ({ ...prev, [kind]: { status: 'error', items: [] } }))
      }
    },
    [center],
  )

  // ── 统计条数据（已加载子图优先，否则用整体图谱规模） ──
  const overviewTypeCounts = useMemo<Record<string, number>>(() => {
    const stats = statsQuery.data
    if (!stats) return {}
    if (stats.node_type_breakdown) return stats.node_type_breakdown
    return {
      herb: stats.total_herbs ?? 0,
      compound: stats.total_compounds ?? 0,
      target: stats.total_targets ?? 0,
      disease: stats.total_diseases ?? 0,
    }
  }, [statsQuery.data])

  const loadedGraph = graphState.status === 'success' ? graphState.data : null
  const typeCounts = loadedGraph ? loadedGraph.typeCounts : statsQuery.data ? overviewTypeCounts : null

  const nodesText = loadedGraph
    ? formatCount(loadedGraph.totalNodes, language)
    : statsQuery.data
      ? formatCount(statsQuery.data.graph_node_count ?? statsQuery.data.total_nodes ?? 0, language)
      : null

  const edgesText = loadedGraph
    ? formatCount(loadedGraph.totalLinks, language)
    : statsQuery.data
      ? formatCount(
          statsQuery.data.graph_edge_count ?? statsQuery.data.estimated_total_edges ?? 0,
          language,
        )
      : null

  return (
    <div className="space-y-3">
      {/* ── 搜索区 ── */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="search"
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls="kg-suggestions"
              aria-autocomplete="list"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSubmit()
                } else if (event.key === 'Escape') {
                  setSuggestOpen(false)
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) setSuggestOpen(true)
              }}
              placeholder={t('ai.knowledge.graphSearchPlaceholder')}
              aria-label={t('ai.knowledge.graphSearchPlaceholder')}
              className="w-full pl-8 pr-8 py-2 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-primary)] dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {suggestLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
            )}

            {/* 联想下拉 */}
            {suggestOpen && suggestions.length > 0 && (
              <div
                id="kg-suggestions"
                role="listbox"
                aria-label={t('ai.knowledge.graphSearch')}
                className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 shadow-xl"
              >
                {suggestions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void loadNodeSubgraph(option)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)] dark:text-neutral-100">
                      {option.label}
                    </span>
                    <TypeBadge type={option.type} />
                  </button>
                ))}
              </div>
            )}
            {suggestOpen && suggestSettled && suggestions.length === 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--border-color)] bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-[var(--text-muted)] shadow-xl">
                {t('ai.knowledge.graphSearchNoResult')}
              </div>
            )}
          </div>

          <select
            aria-label={t('ai.knowledge.graphNodeType')}
            value={nodeType}
            onChange={(event) => {
              setNodeType(event.target.value as NodeTypeFilter)
              setSuggestOpen(true)
            }}
            className="sm:w-36 px-2 py-2 text-xs border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{t('ai.knowledge.graphTypeAll')}</option>
            {NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(NODE_TYPE_LABEL_KEYS[kind])}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || graphState.status === 'loading'}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-700 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {graphState.status === 'loading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {t('ai.knowledge.graphSearch')}
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          {/* ── 图区 ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)]">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] dark:text-white">
                <Network className="w-4 h-4 text-primary-600 dark:text-primary-500" />
                {t('ai.knowledge.knowledgeGraph')}
              </h3>
              <span className="hidden sm:block text-[11px] text-[var(--text-muted)] truncate">
                {t('ai.knowledge.graphClickNodeHint')}
              </span>
            </div>

            <div ref={graphBoxRef} className="relative overflow-hidden" style={{ height: GRAPH_HEIGHT }}>
              {graphState.status === 'loading' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  aria-busy="true"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('ai.knowledge.graphLoading')}
                  </p>
                </div>
              )}

              {graphState.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertCircle className="w-6 h-6 text-error-500" />
                  <p className="text-sm text-error-600 dark:text-error-400">
                    {t('ai.knowledge.graphLoadFailed')}
                  </p>
                  {graphState.message && (
                    <p
                      className="text-[11px] text-[var(--text-muted)] max-w-sm truncate"
                      title={graphState.message}
                    >
                      {graphState.message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-1 px-3 py-1.5 text-xs rounded-lg bg-primary-700 hover:bg-primary-600 text-white transition-colors"
                  >
                    {t('ai.knowledge.retry')}
                  </button>
                </div>
              )}

              {graphState.status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <Network className="w-8 h-8 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)] max-w-sm">
                    {t('ai.knowledge.graphInitialHint')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.graphHint')}</p>
                </div>
              )}

              {graphState.status === 'success' && graphState.data.nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertCircle className="w-6 h-6 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('ai.knowledge.graphNoNodes')}
                  </p>
                </div>
              )}

              {graphState.status === 'success' && graphState.data.nodes.length > 0 && (
                <KnowledgeGraph
                  nodes={graphState.data.nodes}
                  links={graphState.data.links}
                  width={graphWidth}
                  height={GRAPH_HEIGHT}
                  onExpandNode={handleExpandNode}
                  expandNodeLabel={t('ai.knowledge.graphExpandHere')}
                />
              )}
            </div>

            {graphState.status === 'success' && graphState.data.truncated && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-[var(--border-color)] bg-warning-50 dark:bg-warning-950/20 text-xs text-warning-700 dark:text-warning-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {t('ai.knowledge.graphTooLarge', {
                    count: formatCount(graphState.data.totalNodes, language),
                  })}
                </span>
              </div>
            )}
          </Card>

          {/* ── 统计条 + 图例 ── */}
          <Card className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-primary-600 dark:text-primary-500" />
                <span className="font-semibold tabular-nums text-[var(--text-primary)] dark:text-neutral-100">
                  {nodesText === null
                    ? '—'
                    : t('ai.knowledge.graphStatsNodes', { count: nodesText })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-secondary-600 dark:text-secondary-500" />
                <span className="font-semibold tabular-nums text-[var(--text-primary)] dark:text-neutral-100">
                  {edgesText === null
                    ? '—'
                    : t('ai.knowledge.graphStatsEdges', { count: edgesText })}
                </span>
              </span>
              <span className="hidden sm:block w-px h-4 bg-[var(--border-color)]" aria-hidden="true" />
              {NODE_KINDS.map((kind) => {
                const countText = typeCounts
                  ? formatCount(typeCounts[kind] ?? 0, language)
                  : '—'
                const label = t(NODE_TYPE_LABEL_KEYS[kind])
                return (
                  <span key={kind} className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: NODE_TYPE_COLORS[kind] }}
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">{`${label} ${countText}`}</span>
                  </span>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-color)] pt-2 text-[11px] text-[var(--text-secondary)]">
              <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t('ai.knowledge.graphLegend')}
              </span>
              {NODE_KINDS.map((kind) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: NODE_TYPE_COLORS[kind] }}
                    aria-hidden="true"
                  />
                  {t(NODE_TYPE_LABEL_KEYS[kind])}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* ── 分析侧栏（默认折叠） ── */}
        <aside className="w-full">
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setAnalysisOpen((open) => !open)}
              aria-expanded={analysisOpen}
              aria-controls="kg-analysis-body"
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] dark:text-white">
                <BarChart3 className="w-4 h-4 text-secondary-600 dark:text-secondary-500" />
                {t('ai.knowledge.graphAnalysis')}
              </span>
              {analysisOpen ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>

            {analysisOpen && (
              <div
                id="kg-analysis-body"
                className="px-2.5 pb-2.5 space-y-2 border-t border-[var(--border-color)] pt-2.5"
              >
                <AnalysisSection
                  kind="centrality"
                  title={t('ai.knowledge.graphCentrality')}
                  state={analysis.centrality}
                  onRun={() => void runAnalysis('centrality')}
                />
                <AnalysisSection
                  kind="communities"
                  title={t('ai.knowledge.graphCommunities')}
                  state={analysis.communities}
                  onRun={() => void runAnalysis('communities')}
                />
                <AnalysisSection
                  kind="kcore"
                  title={t('ai.knowledge.graphKCore')}
                  state={analysis.kcore}
                  onRun={() => void runAnalysis('kcore')}
                />
                <AnalysisSection
                  kind="bridges"
                  title={t('ai.knowledge.graphBridges')}
                  state={analysis.bridges}
                  onRun={() => void runAnalysis('bridges')}
                />
                <AnalysisSection
                  kind="recommend"
                  title={t('ai.knowledge.graphRecommend')}
                  state={analysis.recommend}
                  onRun={() => void runAnalysis('recommend')}
                />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default KnowledgeGraphPanel
