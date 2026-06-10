/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 知识图谱 Tab — v5.0 完整版
 *
 * 功能清单：
 * - 首屏全量图谱展示（所有药材 + 化合物 + 配伍关系 + 肽节点）
 * - 7种节点类型全覆盖统计卡片
 * - 搜索定位（7种类型过滤）
 * - 布局切换（力导向/放射/树形）+ 深度控制
 * - 图谱/表格双视图
 * - 节点对比模式（最多4个节点并排对比）
 * - 路径发现工具（两节点间最短路径）
 * - 化合物-靶点-疾病路径面板
 * - 配伍关系查询工具
 * - 关系表格视图（可排序）
 *
 * v5.0 改进：
 * - 全量图谱后端支持（__full__ 标记 → get_full_graph 返回完整图谱数据）
 * - 统计卡片从4种扩展到7种节点类型
 * - 搜索过滤下拉覆盖全部7种类型
 * - 对比模式完整实现（选中节点的属性对比面板）
 * - 路径发现功能接入前端UI
 * - 空状态和加载状态全面优化
 */
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import KnowledgeGraph from '@/components/database/KnowledgeGraph'
import {
  Input, Button, Badge, Card,
} from '@/components/ui'
import {
  Search, Layers, ChevronRight, TrendingUp,
  ChevronUp, ChevronDown, GitBranch, X, ArrowLeftRight,
  BarChart3, Network, Loader2,
  Leaf, FlaskConical, Crosshair, HeartPulse, Dna, Microscope, Apple,
} from 'lucide-react'

// ═══════════════════════════════════════════
// 节点类型体系（7种全覆盖）
// ═══════════════════════════════════════════

const NODE_TYPE_BADGE: Record<string, 'primary' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  herb:     'primary',   // 药材   — 森林绿
  compound: 'info',      // 化合物 — 海洋蓝
  target:   'warning',   // 靶点   — 琥珀色
  disease:  'danger',    // 疾病   — 红色
  peptide:  'primary',   // 肽     — 生物紫
  protein:  'neutral',   // 蛋白质 — 粉色
  food:     'warning',   // 食物   — 橙色
}

const NODE_TYPE_LABEL: Record<string, string> = {
  herb: '药材', compound: '化合物', target: '靶点', disease: '疾病',
  peptide: '活性肽', protein: '蛋白质', food: '食物',
}

/** 统计卡片的视觉配置 */
const STAT_CARD_CONFIG: Record<string, { label: string; bg: string; icon: ReactNode; color: string }> = {
  herbs:       { label: '药材节点',    bg: 'bg-primary-50 dark:bg-primary-950/40',   icon: <Leaf className="w-5 h-5" />,          color: 'var(--color-primary-600, #059669)' },
  compounds:   { label: '化合物节点',  bg: 'bg-blue-50 dark:bg-blue-950/40',         icon: <FlaskConical className="w-5 h-5" />,  color: 'var(--color-info-600, #2563EB)' },
  targets:     { label: '靶点节点',    bg: 'bg-amber-50 dark:bg-amber-950/40',       icon: <Crosshair className="w-5 h-5" />,    color: 'var(--color-warning-600, #D97706)' },
  diseases:    { label: '疾病节点',    bg: 'bg-rose-50 dark:bg-rose-950/40',        icon: <HeartPulse className="w-5 h-5" />,   color: 'var(--color-danger-600, #DC2626)' },
  peptides:    { label: '活性肽节点',  bg: 'bg-purple-50 dark:bg-purple-950/40',     icon: <Dna className="w-5 h-5" />,         color: 'var(--color-purple-600, #7C3AED)' },
  proteins:    { label: '蛋白质节点',  bg: 'bg-pink-50 dark:bg-pink-950/40',         icon: <Microscope className="w-5 h-5" />,   color: 'var(--color-pink-500, #EC4899)' },
  foods:       { label: '药食同源',    bg: 'bg-orange-50 dark:bg-orange-950/40',     icon: <Apple className="w-5 h-5" />,       color: 'var(--color-orange-600, #EA580C)' },
}

// ═══════════════════════════════════════════
// 骨架屏
// ═══════════════════════════════════════════

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="card p-4 text-center animate-pulse">
          <div className="h-8 w-12 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-1" />
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
          <div className="h-2 w-10 bg-slate-200 dark:bg-slate-700 rounded mx-auto mt-1" />
        </div>
      ))}
    </div>
  )
}

type Layout = 'force' | 'radial' | 'tree'
type SortField = 'strength' | 'type'
type SortDir = 'asc' | 'desc'

export default function GraphTab() {
  // ── 核心状态 ──
  const [keyword, setKeyword] = useState('')
  const [nodeType, setNodeType] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [interactionHerbs, setInteractionHerbs] = useState('')

  // 视图与布局
  const [activeView, setActiveView] = useState<'graph' | 'table'>('graph')
  const [graphLayout, setGraphLayout] = useState<Layout>('force')
  const [nodeDepth, setNodeDepth] = useState(1)

  // 对比模式
  const [compareNodes, setCompareNodes] = useState<string[]>([])
  const [compareMode, setCompareMode] = useState(false)

  // 路径发现
  const [pathSource, setPathSource] = useState('')
  const [pathTarget, setPathTarget] = useState('')
  const [showPathTool, setShowPathTool] = useState(false)

  // 排序
  const [relSortField, setRelSortField] = useState<SortField>('strength')
  const [relSortDir, setRelSortDir] = useState<SortDir>('desc')

  // 类型过滤
  const [filteredTypes, setFilteredTypes] = useState<Set<string>>(new Set())

  // v9.0: 智能分析面板状态
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analyticsTab, setAnalyticsTab] = useState<'centrality' | 'communities' | 'kcore' | 'bridges' | 'recommend'>('centrality')
  const [centralityMode, setCentralityMode] = useState<'pageRank' | 'betweenness' | 'closeness'>('pageRank')
  const [recommendHerbName, setRecommendHerbName] = useState('')
  const [kCoreValue, setKCoreValue] = useState(2)

  // ══════════════════════════════════════
  // 数据查询
  // ══════════════════════════════════════

  const statsQuery = useQuery({
    queryKey: ['db-graph-stats'],
    queryFn: () => databaseApi.getGraphStats(),
    staleTime: 60_000,
  })

  // 全量图谱查询（首屏默认加载，使用 __full__ 标记触发后端全量返回）
  const fullGraphQuery = useQuery({
    queryKey: ['db-graph-full', nodeDepth],
    queryFn: () => databaseApi.getNodeRelations({ node_label: '__full__', depth: nodeDepth }),
    enabled: !keyword && !selectedNode,
    staleTime: 120_000,
  })

  // 搜索查询
  const searchQuery = useQuery({
    queryKey: ['db-graph-search', keyword, nodeType],
    queryFn: () => databaseApi.searchKnowledge({ keyword, node_type: nodeType || undefined }),
    enabled: keyword.length >= 1,
  })

  // 节点关系查询（选中某节点后的局部网络）
  const relationsQuery = useQuery({
    queryKey: ['db-graph-relations', selectedNode, nodeDepth],
    queryFn: () => databaseApi.getNodeRelations({ node_label: selectedNode!, depth: nodeDepth }),
    enabled: !!selectedNode && selectedNode !== '__full__',
  })

  // 药材化合物靶点路径
  const herbPathQuery = useQuery({
    queryKey: ['db-graph-herb-path', selectedNode],
    queryFn: () => databaseApi.getHerbCompoundTargets(selectedNode!),
    enabled: !!selectedNode && selectedNode !== '__full__',
  })

  // 配伍关系
  const interactionsQuery = useQuery({
    queryKey: ['db-graph-interactions', interactionHerbs],
    queryFn: () => databaseApi.getHerbInteractions(interactionHerbs.split(',').filter(Boolean)),
    enabled: interactionHerbs.includes(',') && interactionHerbs.split(',').filter(Boolean).length >= 2,
  })

  // 路径发现
  const pathQuery = useQuery({
    queryKey: ['db-graph-path', pathSource, pathTarget],
    queryFn: () => databaseApi.findPath(pathSource, pathTarget),
    enabled: !!pathSource && !!pathTarget && pathSource !== pathTarget,
  })

  // ═══ v9.0: 智能分析查询 ═══
  const centralityQuery = useQuery({
    queryKey: ['kg-analytics-centrality', centralityMode],
    queryFn: () => databaseApi.getCentrality(centralityMode, 20),
    enabled: showAnalytics && analyticsTab === 'centrality',
    staleTime: 300_000,
  })
  const communitiesQuery = useQuery({
    queryKey: ['kg-analytics-communities'],
    queryFn: () => databaseApi.getCommunities(),
    enabled: showAnalytics && analyticsTab === 'communities',
    staleTime: 300_000,
  })
  const kcoreQuery = useQuery({
    queryKey: ['kg-analytics-kcore', kCoreValue],
    queryFn: () => databaseApi.getKCore(kCoreValue),
    enabled: showAnalytics && analyticsTab === 'kcore',
    staleTime: 300_000,
  })
  const bridgesQuery = useQuery({
    queryKey: ['kg-analytics-bridges'],
    queryFn: () => databaseApi.getBridges(),
    enabled: showAnalytics && analyticsTab === 'bridges',
    staleTime: 300_000,
  })
  const recommendQuery = useQuery({
    queryKey: ['kg-recommend-herb', recommendHerbName],
    queryFn: () => databaseApi.recommendHerbs(recommendHerbName, 10),
    enabled: showAnalytics && analyticsTab === 'recommend' && recommendHerbName.length >= 1,
    staleTime: 120_000,
  })

  // ══════════════════════════════════════
  // 数据处理
  // ══════════════════════════════════════

  // 用于图谱展示的数据
  const graphData = useMemo(() => {
    let data = null
    if (selectedNode && selectedNode !== '__full__' && relationsQuery.data) {
      data = relationsQuery.data
    } else if (fullGraphQuery.data && (!keyword || keyword.length === 0) && (!selectedNode || selectedNode === '__full__')) {
      data = fullGraphQuery.data
    }

    if (!data) return null

    // 应用类型过滤器
    let filteredNodes = (data.nodes ?? []).map((n: any) => ({
      id: n.label || n.id,
      label: n.label || n.id,
      type: (n.type || 'compound').toLowerCase(),
      properties: n.properties || {},
    }))

    if (filteredTypes.size > 0) {
      // 预索引节点类型以便快速查找
      const nodeTypeIndex = new Map<string, string>()
      for (const n of (data.nodes ?? [])) {
        nodeTypeIndex.set((n.label || n.id), (n.type || 'compound').toLowerCase())
      }
      const allowedLabels = new Set<string>()
      for (const e of (data.edges ?? [])) {
        const srcType = nodeTypeIndex.get(e.source) || 'compound'
        const tgtType = nodeTypeIndex.get(e.target) || 'compound'
        const srcMatch = filteredTypes.has(srcType)
        const tgtMatch = filteredTypes.has(tgtType)
        // 至少一端匹配筛选类型即保留 (单类型筛选显示该类型节点及其邻居)
        if (srcMatch || tgtMatch) {
          allowedLabels.add(e.source)
          allowedLabels.add(e.target)
        }
      }
      // 筛选类型匹配的节点总是保留
      filteredNodes = filteredNodes.filter((n: any) => filteredTypes.has(n.type) || allowedLabels.has(n.label))
    }

    const edges = (data.edges ?? []).map((e: any) => ({
      source: e.source,
      target: e.target,
      type: e.type || 'relates_to',
      strength: e.strength || 0.5,
      label: e.label || e.basis,
      basis: e.basis,
    })).filter((e: any) => {
      // 过滤掉两端都不在可见节点的边
      const srcVisible = filteredNodes.some((n: any) => n.label === e.source)
      const tgtVisible = filteredNodes.some((n: any) => n.label === e.target)
      return srcVisible && tgtVisible
    })

    return { nodes: filteredNodes, edges, stats: data.stats }
  }, [selectedNode, relationsQuery.data, fullGraphQuery.data, keyword, filteredTypes])

  // 计算高亮路径
  const highlightPath = useMemo(() => {
    if (!selectedNode || !graphData || selectedNode === '__full__') return undefined
    const path = new Set([selectedNode])
    ;(graphData.edges ?? []).forEach((e: any) => {
      if (e.source === selectedNode) path.add(e.target)
      if (e.target === selectedNode) path.add(e.source)
    })
    return Array.from(path)
  }, [selectedNode, graphData])

  // ══════════════════════════════════════
  // 操作方法
  // ══════════════════════════════════════

  const handleAddCompare = (nodeLabel: string) => {
    setCompareMode(true)
    if (!compareNodes.includes(nodeLabel) && compareNodes.length < 4) {
      setCompareNodes(prev => [...prev, nodeLabel])
    }
  }

  const handleRemoveCompare = (idx: number) => {
    setCompareNodes(prev => prev.filter((_, i) => i !== idx))
  }

  const toggleRelSort = (field: SortField) => {
    if (relSortField === field) {
      setRelSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setRelSortField(field); setRelSortDir('desc')
    }
  }

  const toggleTypeFilter = (type: string) => {
    setFilteredTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const clearFilters = () => setFilteredTypes(new Set())

  // ESC 关闭详情
  useEffect(() => {
    if (!selectedNode) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedNode(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedNode])

  // ══════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════

  const isLoadingGlobal = fullGraphQuery.isLoading || relationsQuery.isLoading

  return (
    <div className="space-y-4">
      {/* ═════ 统计概览（7种类型）═════ */}
      {statsQuery.isLoading ? (
        <StatsSkeleton />
      ) : statsQuery.data ? (
        <>
          {/* 主统计行：药材/化合物/靶点/疾病 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { key: 'herbs', value: statsQuery.data.total_herbs },
              { key: 'compounds', value: statsQuery.data.total_compounds },
              { key: 'targets', value: statsQuery.data.total_targets },
              { key: 'diseases', value: statsQuery.data.total_diseases },
            ] as const).map(({ key, value }) => {
              const cfg = STAT_CARD_CONFIG[key]
              return (
                <div key={key} className={`card p-4 text-center ${cfg.bg} cursor-pointer hover:shadow-md transition-shadow`}>
                  <div className="flex justify-center" style={{ color: cfg.color }}>{cfg.icon}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: cfg.color }}>{(value ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{cfg.label}</div>
                </div>
              )
            })}
          </div>

          {/* 第二行：肽/蛋白质/药食同源 + 总计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { key: 'peptides', value: statsQuery.data.total_peptides },
              { key: 'proteins', value: statsQuery.data.total_proteins },
              { key: 'foods', value: statsQuery.data.total_foods },
              { key: 'total', value: statsQuery.data.total_nodes, label: '总节点数', bg: 'bg-slate-50 dark:bg-slate-800/60', icon: <BarChart3 className="w-5 h-5" />, color: '#64748B' },
            ] as const).map(({ key, value, ...override }) => {
              const cfg = key === 'total' ? override as typeof STAT_CARD_CONFIG[string] : STAT_CARD_CONFIG[key]
              return (
                <div key={key} className={`card p-4 text-center ${(cfg as any)?.bg ?? ''} hover:shadow-md transition-shadow`}>
                  <div className="flex justify-center" style={{ color: (cfg as any)?.color ?? '#64748B' }}>{(cfg as any)?.icon ?? '📌'}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: (cfg as any)?.color ?? '#64748B' }}>
                    {(value ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                    {(cfg as any)?.label ?? `${(key === 'peptides' ? '活性肽' : key === 'proteins' ? '蛋白质' : '药食同源')}节点`}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 边统计 + 分类标签 */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
            <span>配伍关系: <strong className="text-[#0f172a] dark:text-white">{statsQuery.data.herb_interactions}</strong></span>
            <span>协同: <strong className="text-green-600">{statsQuery.data.synergy_count}</strong></span>
            <span>拮抗: <strong className="text-red-500">{statsQuery.data.antagonism_count}</strong></span>
            <span>化合物-靶点路径: <strong className="text-[#0f172a] dark:text-white">{statsQuery.data.compound_target_paths}</strong></span>
            {(statsQuery.data.herb_categories ?? []).length > 0 && (
              <div className="flex gap-1 ml-auto">
                {statsQuery.data.herb_categories.slice(0, 5).map((cat: string) => (
                  <Badge key={cat} variant="neutral" size="sm" className="text-[10px]">{cat}</Badge>
                ))}
                {statsQuery.data.herb_categories.length > 5 && (
                  <Badge variant="neutral" size="sm" className="text-[10px]">+{statsQuery.data.herb_categories.length - 5}</Badge>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ═════ 工具栏 ═════ */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索药材、化合物、靶点、疾病、活性肽..."
            className="pl-9"
          />
        </div>

        {/* 类型过滤下拉（7种全覆盖）*/}
        <select value={nodeType} onChange={(e) => setNodeType(e.target.value)}
          className="input w-auto min-w-[130px]">
          <option value="">全部类型</option>
          <option value="herb">药材</option>
          <option value="compound">化合物</option>
          <option value="target">靶点</option>
          <option value="disease">疾病</option>
          <option value="peptide">活性肽</option>
          <option value="protein">蛋白质</option>
          <option value="food">药食同源</option>
        </select>

        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {([['graph', '图谱', 'Network'], ['table', '表格', 'BarChart3']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === v ? 'bg-white dark:bg-slate-700 shadow-sm text-[#0f172a] dark:text-white' : 'text-[#94A3B8] hover:text-[#64748B]'}`}>
              {v === 'graph' ? <Network className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
              {label}
            </button>
          ))}
        </div>

        {/* 布局切换 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {([['force', '力导向'], ['radial', '放射'], ['tree', '树形']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setGraphLayout(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${graphLayout === v ? 'bg-white dark:bg-slate-700 shadow-sm text-[#0f172a] dark:text-white' : 'text-[#94A3B8] hover:text-[#64748B]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 深度选择 */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#94A3B8] hidden sm:inline">深度</span>
          {[1, 2, 3].map(d => (
            <button key={d} onClick={() => setNodeDepth(d)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${nodeDepth === d ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              {d}
            </button>
          ))}
        </div>

        {/* 对比模式 */}
        <Button variant="secondary" size="sm" onClick={() => { setCompareMode(!compareMode); if (!compareMode) setCompareNodes([]) }}>
          {compareMode ? `退出对比(${compareNodes.length}/4)` : '对比模式'}
        </Button>

        {/* 路径发现 */}
        <Button variant="secondary" size="sm" onClick={() => setShowPathTool(!showPathTool)}>
          <GitBranch className="w-3.5 h-3.5 mr-1" />
          {showPathTool ? '收起路径' : '路径发现'}
        </Button>

        {/* v9.0: 智能分析 */}
        <Button variant={showAnalytics ? 'default' : 'secondary'} size="sm" onClick={() => setShowAnalytics(!showAnalytics)}>
          <TrendingUp className="w-3.5 h-3.5 mr-1" />
          {showAnalytics ? '关闭分析' : '智能分析'}
        </Button>

        {/* 重置按钮 */}
        {selectedNode && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
            重置视图
          </Button>
        )}
      </div>

      {/* ═══ v9.0: 智能分析面板 ═══ */}
      {showAnalytics && (
        <div className="card p-4 border-2 border-primary-200 dark:border-primary-800/40 bg-gradient-to-r from-primary-50/50 via-white to-blue-50/50 dark:from-primary-950/20 dark:via-slate-900 dark:to-blue-950/20">
          {/* 数据状态概览 */}
          {statsQuery.data && (
            <div className="flex items-center gap-4 mb-3 pb-3 border-b border-slate-200/60 dark:border-slate-700/60 text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                图谱已构建
              </span>
              <span>节点: <strong className="text-slate-700 dark:text-slate-300">{(statsQuery.data as any)?.stats?.nodes ?? (statsQuery.data as any)?.total_nodes ?? '-'}</strong></span>
              <span>边: <strong className="text-slate-700 dark:text-slate-300">{(statsQuery.data as any)?.stats?.edges ?? (statsQuery.data as any)?.total_edges ?? '-'}</strong></span>
            </div>
          )}

          {/* 分析标签页切换 */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {([
              ['centrality', '中心性', 'BarChart3'],
              ['communities', '社区检测', 'Network'],
              ['kcore', 'K-Core', 'Layers'],
              ['bridges', '桥梁节点', 'GitBranch'],
              ['recommend', '智能推荐', 'TrendingUp'],
            ] as const).map(([key, label, icon]) => (
              <button key={key} onClick={() => setAnalyticsTab(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  analyticsTab === key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-[#64748B] hover:text-[#0f172a] dark:hover:text-white border border-slate-200 dark:border-slate-700'
                }`}>
                {key === 'centrality' ? <BarChart3 className="w-3.5 h-3.5" /> :
                 key === 'communities' ? <Network className="w-3.5 h-3.5" /> :
                 key === 'kcore' ? <Layers className="w-3.5 h-3.5" /> :
                 key === 'bridges' ? <GitBranch className="w-3.5 h-3.5" /> :
                 <TrendingUp className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {/* 中心性分析面板 */}
          {analyticsTab === 'centrality' && (
            <div>
              <div className="flex gap-2 mb-3">
                {(['pageRank', 'betweenness', 'closeness'] as const).map(m => (
                  <button key={m} onClick={() => setCentralityMode(m)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      centralityMode === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#64748B]'
                    }`}>
                    {m === 'pageRank' ? 'PageRank' : m === 'betweenness' ? '介数中心性' : '接近中心性'}
                  </button>
                ))}
              </div>
              {centralityQuery.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /><span className="ml-2 text-xs">计算中...</span></div>
              ) : centralityQuery.isError ? (
                <p className="text-center text-xs text-red-500 py-6">分析请求失败，请重试</p>
              ) : centralityQuery.data?.results?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">#</th>
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">节点</th>
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">类型</th>
                      <th className="text-right py-2 px-3 font-medium text-[#64748B]">{centralityMode === 'pageRank' ? 'PR值' : centralityMode === 'betweenness' ? '介数' : '接近度'}</th>
                    </tr></thead>
                    <tbody>{centralityQuery.data.results.slice(0, 15).map((r: any, i: number) => (
                      <tr key={r.node_id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100/50">
                        <td className="py-1.5 px-3 text-[#94A3B8]">{i + 1}</td>
                        <td className="py-1.5 px-3 font-medium cursor-pointer hover:text-primary-600"
                          onClick={() => setSelectedNode(r.node_label)}>{r.node_label}</td>
                        <td className="py-1.5 px-3"><Badge variant={(NODE_TYPE_BADGE as any)[r.node_type] || 'neutral'} size="sm">{NODE_TYPE_LABEL[r.node_type] || r.node_type}</Badge></td>
                        <td className="text-right py-1.5 px-3 font-mono">{(
                          r.pagerank_score ?? r.betweenness_score ?? r.closeness_score ?? r.score ?? 0
                        ).toFixed(6)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-6">暂无数据，请先构建知识图谱</p>
              )}
            </div>
          )}

          {/* 社区检测面板 */}
          {analyticsTab === 'communities' && (
            <div>
              {communitiesQuery.isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
              ) : communitiesQuery.isError ? (
                <p className="text-center text-xs text-red-500 py-6">社区检测请求失败，请重试</p>
              ) : communitiesQuery.data?.total_communities > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(communitiesQuery.data.communities as any[]).slice(0, 12).map((c, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold" style={{ color: `hsl(${(i * 47) % 360}, 65%, 45%)` }}>社区 #{c.community_id ?? i + 1}</span>
                        <Badge variant="neutral" size="sm">{c.size || c.members?.length || 0} 节点</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(c.members || []).slice(0, 6).map((n: any, j: number) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded cursor-pointer hover:bg-primary-100"
                            onClick={() => setSelectedNode(n.node_label)}>{n.node_label}</span>
                        ))}
                        {(c.members || []).length > 6 && <span className="text-[10px] text-[#94A3B8]">+{(c.members || []).length - 6}...</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-6">暂无社区数据</p>
              )}
            </div>
          )}

          {/* K-Core 面板 */}
          {analyticsTab === 'kcore' && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-[#64748B]">K 值:</span>
                {[1, 2, 3, 4, 5].map(k => (
                  <button key={k} onClick={() => setKCoreValue(k)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${kCoreValue === k ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-[#64748B]'}`}>
                    {k}
                  </button>
                ))}
              </div>
              {kcoreQuery.isLoading ? (<Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />) :
               kcoreQuery.isError ? (
                <p className="text-center text-xs text-red-500 py-6">K-Core分析请求失败，请重试</p>
               ) : (kcoreQuery.data?.results as any[])?.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  <p className="text-xs text-[#64748B] mb-2">{kcoreQuery.data.results.length} 个节点属于 {kCoreValue}-Core（连接度 ≥ {kCoreValue}）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kcoreQuery.data.results.map((n: any, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-full cursor-pointer hover:ring-2 ring-purple-300"
                        onClick={() => setSelectedNode(n.node_label)}>{n.node_label}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-6">当前 K 值下无核心子图</p>
              )}
            </div>
          )}

          {/* 桥梁节点面板 */}
          {analyticsTab === 'bridges' && (
            <div>
              {bridgesQuery.isLoading ? (<Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />) :
               bridgesQuery.isError ? (
                <p className="text-center text-xs text-red-500 py-6">桥梁分析请求失败，请重试</p>
               ) : (bridgesQuery.data?.bridges as any[])?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">节点</th>
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">类型</th>
                      <th className="text-right py-2 px-3 font-medium text-[#64748B]">综合评分</th>
                      <th className="text-left py-2 px-3 font-medium text-[#64748B]">角色</th>
                    </tr></thead>
                    <tbody>{bridgesQuery.data.bridges.slice(0, 15).map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 border-b border-slate-100/50">
                        <td className="py-1.5 px-3 font-medium cursor-pointer hover:text-amber-700"
                          onClick={() => setSelectedNode(b.node_label)}>{b.node_label}</td>
                        <td className="py-1.5 px-3"><Badge variant={(NODE_TYPE_BADGE as any)[b.node_type] || 'warning'} size="sm">{NODE_TYPE_LABEL[b.node_type] || b.node_type}</Badge></td>
                        <td className="text-right py-1.5 px-3 font-mono text-amber-600 font-semibold">{(b.bridge_score ?? b.score ?? 0).toFixed(4)}</td>
                        <td className="py-1.5 px-3 text-[10px] text-[#94A3B8] max-w-[140px] truncate">跨社区关键枢纽 (介数+度数综合)</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-6">暂无桥梁节点数据</p>
              )}
            </div>
          )}

          {/* 智能推荐面板 */}
          {analyticsTab === 'recommend' && (
            <div>
              <div className="flex gap-2 mb-3">
                <Input value={recommendHerbName} onChange={(e) => setRecommendHerbName(e.target.value)}
                  placeholder="输入药材名称获取相似推荐..." className="flex-1 text-sm" />
              </div>
              {recommendQuery.isLoading ? (<Loader2 className="w-5 h-5 animate-spin mx-auto my-4" />) :
               recommendQuery.isError ? (
                <p className="text-center text-xs text-red-500 py-6">推荐请求失败，请重试</p>
               ) : recommendHerbName.length >= 1 && (recommendQuery.data?.recommendations as any[])?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#64748B]">与 "<strong>{recommendQuery.data.target_herb || recommendHerbName}</strong>" 最相似的药材（基于化合物重叠、靶点覆盖、图谱拓扑）：</p>
                  {(recommendQuery.data.recommendations as any[]).map((rec, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/50">
                      <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-700">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm cursor-pointer hover:text-primary-600" onClick={() => setSelectedNode(rec.herb_name)}>{rec.herb_name}</span>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[10px] text-[#94A3B8]">综合评分: <strong className="text-green-600">{(rec.combined_score ?? rec.similarity_score ?? rec.score ?? 0).toFixed(3)}</strong></span>
                          {rec.shared_compounds != null && <span className="text-[10px] text-[#94A3B8]">共{rec.shared_compounds}化合物</span>}
                          {rec.shared_targets != null && <span className="text-[10px] text-blue-500">共{rec.shared_targets}靶点</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedNode(rec.herb_name)}>查看</Button>
                    </div>
                  ))}
                </div>
              ) : recommendHerbName.length >= 1 ? (
                <p className="text-center text-xs text-[#94A3B8] py-6">未找到相似药材</p>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-6">输入药材名称开始推荐</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═════ 图谱内类型过滤栏 ═════ */}
      {graphData && activeView === 'graph' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[#94A3B8] mr-1">筛选:</span>
          {(Object.keys(NODE_TYPE_BADGE)).map(type => {
            const isActive = filteredTypes.has(type)
            const cfg = NODE_TYPE_LABEL[type]
            return (
              <button key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all border ${
                  isActive
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-slate-200 bg-white text-[#94A3B8] hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-current opacity-100' : 'opacity-50'}`} style={{ background: isActive ? undefined : undefined }} />
                {cfg}
              </button>
            )
          })}
          {filteredTypes.size > 0 && (
            <button onClick={clearFilters} className="text-[11px] text-primary-600 hover:text-primary-800 ml-1">
              清除全部
            </button>
          )}
        </div>
      )}

      {/* ═════ 搜索结果标签 ═════ */}
      {searchQuery.data && searchQuery.data.items.length > 0 && (
        <Card className="p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
              搜索结果 ({searchQuery.data.total})
            </h3>
            {compareMode && <span className="text-xs text-[#94A3B8]">已选 {compareNodes.length}/4</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {searchQuery.data.items.slice(0, 50).map((node: any, idx: number) => (
              <button key={idx}
                onClick={() => compareMode ? handleAddCompare(node.node_label) : setSelectedNode(node.node_label)}
                className="hover:scale-105 transition-transform duration-150"
              >
                <Badge
                  variant={NODE_TYPE_BADGE[node.node_type as string] || 'neutral'}
                  size="md"
                  className={compareMode && compareNodes.includes(node.node_label) ? 'ring-2 ring-primary-500' : ''}
                >
                  {node.node_label}
                  <span className="ml-1.5 opacity-60 text-[10px]">
                    {NODE_TYPE_LABEL[node.node_type as string] || node.node_type}
                  </span>
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ═════ 主图谱区域 ═════ */}
      {(selectedNode || ((!keyword || keyword.length === 0) && (!selectedNode || selectedNode === '__full__'))) && (
        <Card className="p-5 animate-fade-in">
          {/* 标题栏 */}
          {selectedNode && selectedNode !== '__full__' ? (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-[#0f172a] dark:text-[#f1f5f9]">{selectedNode}</h3>
                <span className="text-[#94A3B8] text-sm">— 关系网络</span>
                <Badge variant="neutral" size="sm">深度 {nodeDepth}</Badge>
                {graphData?.stats?.nodes && (
                  <span className="text-[11px] text-[#94A3B8]">
                    {graphData.stats.nodes} 节点 / {graphData.stats.edges} 边
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleAddCompare(selectedNode)} disabled={compareNodes.length >= 4}>
                  加入对比
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>关闭</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-[#0f172a] dark:text-[#f1f5f9]">全局知识图谱</h3>
                {fullGraphQuery.data?.mode === 'full' && (
                  <Badge variant="success" size="sm">全量模式</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                {graphData?.stats?.nodes && (
                  <>
                    <span>节点: <strong className="text-[#0f172a] dark:text-white">{graphData.stats.nodes}</strong></span>
                    <span>边: <strong className="text-[#0f172a] dark:text-white">{graphData.stats.edges}</strong></span>
                    {/* 类型分布 */}
                    {graphData.stats.type_breakdown && Object.entries(graphData.stats.type_breakdown).map(([type, count]) => (
                      <span key={type}>{NODE_TYPE_LABEL[type] || type}: <strong>{count}</strong></span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 加载态 */}
          {isLoadingGlobal && !graphData ? (
            <div className="flex flex-col items-center justify-center h-80 text-[#94A3B8]">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-3" />
              <p className="text-sm">正在构建知识图谱...</p>
              <p className="text-xs mt-1 opacity-60">首次加载可能需要几秒钟</p>
            </div>
          ) : graphData?.nodes && graphData.nodes.length > 0 ? (
            /* 图谱或表格视图 */
            activeView === 'graph' ? (
              <KnowledgeGraph
                nodes={graphData.nodes}
                edges={graphData.edges}
                height={selectedNode && selectedNode !== '__full__' ? 420 : 520}
                onNodeClick={(node) => {
                  if (compareMode) {
                    handleAddCompare(node.label)
                  } else {
                    setSelectedNode(node.label)
                  }
                }}
                layout={graphLayout}
                highlightPath={highlightPath}
                isLoading={isLoadingGlobal}
              />
            ) : (
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10">
                    <tr className="border-b border-[rgba(148,163,184,0.18)]">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">源节点</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">关系</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">目标节点</th>
                      <th
                        className="px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-[#0f172a] select-none"
                        onClick={() => toggleRelSort('strength')}
                      >
                        强度
                        {relSortField === 'strength' && (relSortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3 inline ml-1" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                        )}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">依据</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(148,163,184,0.06)]">
                    {graphData.edges
                      .slice()
                      .sort((a: any, b: any) => relSortDir === 'asc'
                        ? (a[relSortField] ?? 0) - (b[relSortField] ?? 0)
                        : (b[relSortField] ?? 0) - (a[relSortField] ?? 0),
                      )
                      .map((edge: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedNode(edge.target)}>
                          <td className="px-3 py-2.5">
                            <Badge variant={NODE_TYPE_BADGE[graphData.nodes.find((n: any) => n.id === edge.source)?.type || ''] || 'neutral'} size="sm">
                              {edge.source}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={
                              edge.type === 'synergy' ? 'success' :
                              edge.type === 'antagonism' ? 'danger' :
                              edge.type === 'contains' ? 'info' :
                              edge.type === 'treats' ? 'danger' :
                              edge.type === 'targets' ? 'warning' : 'neutral'
                            } size="sm">{edge.type}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={NODE_TYPE_BADGE[graphData.nodes.find((n: any) => n.id === edge.target)?.type || ''] || 'neutral'} size="sm">
                              {edge.target}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            {edge.strength != null ? `${(edge.strength * 100).toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-[#94A3B8] max-w-[200px] truncate">
                            {edge.label || edge.basis || '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center h-64 text-[#94A3B8]">
              <Network className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">暂无图谱数据</p>
              <p className="text-xs mt-1 opacity-60">
                尝试调整搜索关键词或降低深度设置
              </p>
              {(keyword || filteredTypes.size > 0) && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setKeyword(''); clearFilters() }}>
                  显示全量图谱
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ═════ 对比面板 ═════ */}
      {compareMode && compareNodes.length > 0 && (
        <Card className="p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary-600" />
              节点对比 ({compareNodes.length}/4)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => { setCompareMode(false); setCompareNodes([]) }}>
              <X className="w-3.5 h-3.5 mr-1" />关闭对比
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {compareNodes.map((label, idx) => {
              // 从当前图谱数据中找到该节点的信息
              const node = graphData?.nodes.find((n: any) => n.label === label)
              const relatedEdges = graphData?.edges.filter((e: any) =>
                e.source === label || e.target === label,
              ) ?? []

              return (
                <div key={idx} className="relative bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => handleRemoveCompare(idx)}
                    className="absolute top-2 right-2 text-[#94A3B8] hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-start gap-2 mb-3 pr-5">
                    <Badge variant={NODE_TYPE_BADGE[node?.type || ''] || 'neutral'} size="md" className="shrink-0">
                      {label}
                    </Badge>
                  </div>

                  {node ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#94A3B8]">类型</span>
                        <span className="font-medium">{NODE_TYPE_LABEL[node.type] || node.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#94A3B8]">关联数</span>
                        <span className="font-mono font-bold text-primary-600">{relatedEdges.length}</span>
                      </div>

                      {/* 属性展示 */}
                      {node.properties && Object.entries(node.properties).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-[#94A3B8] truncate max-w-[80px]" title={k}>{k}</span>
                          <span className="font-mono text-right truncate max-w-[120px]" title={String(v)}>
                            {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v)}
                          </span>
                        </div>
                      ))}

                      {/* 关联关系摘要 */}
                      {relatedEdges.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] text-[#94A3B8] mb-1 font-semibold">关联节点</div>
                          <div className="flex flex-wrap gap-1">
                            {relatedEdges.slice(0, 8).map((e: any, ei: number) => (
                              <Badge key={ei} variant="neutral" size="sm" className="text-[10px]">
                                {e.source === label ? e.target : e.source}
                                <span className="ml-1 opacity-50 text-[9px]">{e.type}</span>
                              </Badge>
                            ))}
                            {relatedEdges.length > 8 && (
                              <span className="text-[10px] text-[#94A3B8] self-center">+{relatedEdges.length - 8}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">该节点不在当前视图中</p>
                  )}

                  {/* 快捷操作 */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSelectedNode(label)}>
                      查看详情
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 添加更多节点提示 */}
          {compareNodes.length < 4 && (
            <div className="mt-3 text-center">
              <p className="text-xs text-[#94A3B8]">
                在图谱中点击节点或搜索结果中添加到对比（还可添加 {4 - compareNodes.length} 个）
              </p>
            </div>
          )}
        </Card>
      )}

      {/* ═════ 路径发现工具 ═════ */}
      {showPathTool && (
        <Card className="p-5 animate-fade-in">
          <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-3 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary-600" />
            路径发现 — 查找两节点间的关联链路
          </h3>
          <p className="text-xs text-[#94A3B8] mb-3">
            使用 BFS 算法在知识图谱中搜索两个节点之间的最短关联路径
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] text-[#94A3B8] mb-1 font-medium">起始节点</label>
              <Input
                value={pathSource} onChange={(e) => setPathSource(e.target.value)}
                placeholder="例如: 人参"
              />
            </div>

            <ArrowLeftRight className="w-5 h-5 text-[#94A3B8] mb-2 shrink-0" />

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] text-[#94A3B8] mb-1 font-medium">目标节点</label>
              <Input
                value={pathTarget} onChange={(e) => setPathTarget(e.target.value)}
                placeholder="例如: 糖尿病"
              />
            </div>

            <Button
              size="sm"
              disabled={!pathSource || !pathTarget || pathSource === pathTarget || pathQuery.isFetching}
              onClick={() => { if (pathSource && pathTarget) pathQuery.refetch() }}
            >
              {pathQuery.isFetching ? '搜索中...' : '搜索路径'}
            </Button>
          </div>

          {/* 路径结果 */}
          {pathQuery.isLoading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-[#94A3B8]">
              <Loader2 className="w-4 h-4 animate-spin" /> 正在搜索路径...
            </div>
          )}

          {pathQuery.data && (
            <div className="mt-4">
              {pathQuery.data.found ? (
                <div>
                  <p className="text-sm text-green-700 dark:text-green-400 mb-3 font-medium">
                    找到路径！共 {pathQuery.data.length} 步：
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" size="md">{pathQuery.data.source}</Badge>
                    {pathQuery.data.path.map((step: any, idx: number) => (
                      <span key={idx} className="flex items-center gap-1.5">
                        <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                        <div className="text-center">
                          <Badge
                            variant={
                              step.relation?.includes('contains') ? 'info' :
                              step.relation?.includes('treats') ? 'danger' :
                              step.relation?.includes('targets') ? 'warning' :
                              step.relation?.includes('synergy') ? 'success' :
                              step.relation?.includes('antagonism') ? 'danger' : 'neutral'
                            }
                            size="md"
                          >
                            {step.node}
                          </Badge>
                          <div className="text-[9px] text-[#94A3B8] mt-0.5">{step.relation}</div>
                        </div>
                      </span>
                    ))}
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                    <Badge variant="primary" size="md">{pathQuery.data.target}</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-[#94A3B8]">
                  <p>{pathQuery.data.message || '未找到关联路径'}</p>
                  <p className="text-xs mt-1">尝试使用更接近的节点名称，或增加最大深度</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ═════ 化合物-靶点-疾病 路径详情 ═════ */}
      {selectedNode && selectedNode !== '__full__' && herbPathQuery.data?.compounds && herbPathQuery.data.compounds.length > 0 && (
        <Card className="p-5 animate-fade-in">
          <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-4 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-primary-600" />
            {selectedNode} — 化合物-靶点-疾病 完整路径
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {herbPathQuery.data.compounds.map((comp: any, i: number) => (
              <div key={i} className="bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-4 text-sm border border-blue-100 dark:border-blue-900/30 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="font-medium text-blue-700 dark:text-blue-400 flex-1">{comp.name}</div>
                  <div className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap ml-2">
                    OB {comp.ob != null ? Number(comp.ob).toFixed(1) : '-'} | DL {comp.dl != null ? Number(comp.dl).toFixed(2) : '-'}
                  </div>
                </div>
                {comp.related_targets?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-[#94A3B8] mb-1 font-semibold uppercase tracking-wider">作用靶点</div>
                    <div className="flex flex-wrap gap-1">
                      {comp.related_targets.map((t: string) => (
                        <Badge key={t} variant="warning" size="sm">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {comp.related_diseases?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-[#94A3B8] mb-1 font-semibold uppercase tracking-wider">相关疾病</div>
                    <div className="flex flex-wrap gap-1">
                      {comp.related_diseases.map((d: string) => (
                        <Badge key={d} variant="danger" size="sm">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {comp.target_count != null && (
                  <div className="mt-1 text-[10px] text-[#94A3B8]">
                    共 {comp.target_count} 个预测靶点
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 所有靶点 & 疾病汇总 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            {herbPathQuery.data.all_targets?.length > 0 && (
              <div>
                <div className="text-[10px] text-[#94A3B8] mb-1 font-semibold uppercase tracking-wider">全部靶点 ({herbPathQuery.data.all_targets.length})</div>
                <div className="flex flex-wrap gap-1">
                  {herbPathQuery.data.all_targets.map((t: string) => (
                    <Badge key={t} variant="warning" size="sm">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {herbPathQuery.data.all_diseases?.length > 0 && (
              <div>
                <div className="text-[10px] text-[#94A3B8] mb-1 font-semibold uppercase tracking-wider">全部疾病 ({herbPathQuery.data.all_diseases.length})</div>
                <div className="flex flex-wrap gap-1">
                  {herbPathQuery.data.all_diseases.map((d: string) => (
                    <Badge key={d} variant="danger" size="sm">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {herbPathQuery.data.interaction_summary?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8] mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />配伍协同关系
              </h4>
              <div className="flex flex-wrap gap-2">
                {herbPathQuery.data.interaction_summary.map((inter: any, i: number) => (
                  <Badge key={i} variant={inter.type === 'synergy' ? 'success' : 'danger'} size="md">
                    {inter.partner}
                    <span className="ml-1 text-[10px] opacity-80">
                      ({inter.type === 'synergy' ? '协同' : '拮抗'} {(inter.strength * 100).toFixed(0)}%)
                    </span>
                  </Badge>
                ))}
              </div>
              {herbPathQuery.data.category && (
                <p className="text-xs text-[#94A3B8] mt-2">
                  归类: {herbPathQuery.data.category} | 功效: {herbPathQuery.data.effects}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ═════ 配伍关系工具 ═════ */}
      <Card className="p-5">
        <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary-600" />药材配伍关系查询
        </h3>
        <p className="text-xs text-[#94A3B8] mb-3">输入多味药材名称（逗号分隔），查询协同/拮抗关系</p>
        <Input
          value={interactionHerbs} onChange={(e) => setInteractionHerbs(e.target.value)}
          placeholder="例如: 人参,黄芪,当归,丹参"
        />
        {interactionsQuery.isLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-[#94A3B8]">
            <Loader2 className="w-4 h-4 animate-spin" /> 查询中...
          </div>
        )}
        {interactionsQuery.data?.edges?.length > 0 && (
          <div className="mt-3 space-y-2">
            {interactionsQuery.data.edges.map((edge: any, i: number) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                edge.type === 'synergy'
                  ? 'bg-primary-50/60 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/30'
                  : 'bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30'
              }`}>
                <span className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">{edge.source}</span>
                <Badge variant={edge.type === 'synergy' ? 'success' : 'danger'} size="sm">
                  {edge.type === 'synergy' ? '协同' : '拮抗'} ({(edge.strength * 100).toFixed(0)}%)
                </Badge>
                <span className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">{edge.target}</span>
                {edge.basis && <span className="text-xs text-[#94A3B8] ml-auto hidden lg:inline">{edge.basis}</span>}

                {/* 点击跳转到该节点 */}
                <button
                  onClick={() => setSelectedNode(edge.source)}
                  className="ml-auto text-[10px] text-primary-600 hover:text-primary-800 shrink-0"
                >
                  查看
                </button>
              </div>
            ))}
          </div>
        )}
        {interactionsQuery.data?.edges?.length === 0 && !interactionsQuery.isLoading && interactionHerbs.includes(',') && (
          <div className="text-center text-[#94A3B8] py-6 text-sm mt-3">
            <Network className="w-8 h-8 mx-auto mb-2 opacity-20" />
            未发现已知的配伍关系
            <p className="text-xs mt-1">这些药材之间可能尚未建立关联记录</p>
          </div>
        )}

        {/* 配伍统计 */}
        {statsQuery.data && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 text-[11px] text-[#94A3B8]">
            <span>数据库共有 {statsQuery.data.herb_interactions} 条配伍记录</span>
            <span className="text-green-600">协同 {statsQuery.data.synergy_count} 条</span>
            <span className="text-red-500">拮抗 {statsQuery.data.antagonism_count} 条</span>
          </div>
        )}
      </Card>
    </div>
  )
}
