/**
 * KnowledgeGraphPanel 单元测试
 *
 * 覆盖：
 * - 搜索区 / 统计条 / 图例 / 初始提示的渲染
 * - 输入防抖联想 → 点击联想项按节点 id 加载子图（getNodeSubgraph）
 * - 回车 / 搜索按钮 → 以中心词 findSubgraph(center, 2)
 * - 节点 > 500 时截断并提示 graphTooLarge
 * - 分析侧栏「运行分析」展示结果（中心性）；空结果与错误态不崩
 * - 图谱加载失败展示错误态并可重试
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../../../../i18n'
import { KnowledgeGraphPanel } from '../../../rag/KnowledgeGraphPanel'
import { databaseApi, getNodeSubgraph, searchGraphNodes } from '@/api/database'

// 只 mock 面板用到的接口，避免 axios / 认证拦截器进入 jsdom
vi.mock('@/api/database', () => {
  const databaseApi = {
    findSubgraph: vi.fn(),
    getGraphStats: vi.fn(),
    getCentrality: vi.fn(),
    getCommunities: vi.fn(),
    getKCore: vi.fn(),
    getBridges: vi.fn(),
    recommendHerbs: vi.fn(),
  }
  return {
    databaseApi,
    searchGraphNodes: vi.fn(),
    getNodeSubgraph: vi.fn(),
  }
})

// 用轻量桩替换 D3 图，断言图数据规模而非渲染细节
vi.mock('@/components/ai/features/components/KnowledgeGraph', () => ({
  KnowledgeGraph: ({
    nodes,
    links,
    onExpandNode,
    expandNodeLabel,
  }: {
    nodes: Array<{ id: string; label: string }>
    links: unknown[]
    onExpandNode?: (node: { id: string; label: string }) => void
    expandNodeLabel?: string
  }) => (
    <div
      data-testid="knowledge-graph"
      data-node-count={nodes.length}
      data-link-count={links.length}
    >
      {nodes[0] && (
        <button type="button" onClick={() => onExpandNode?.(nodes[0])}>
          {expandNodeLabel}
        </button>
      )}
    </div>
  ),
}))

const mockFindSubgraph = vi.mocked(databaseApi.findSubgraph)
const mockGetGraphStats = vi.mocked(databaseApi.getGraphStats)
const mockGetCentrality = vi.mocked(databaseApi.getCentrality)
const mockGetCommunities = vi.mocked(databaseApi.getCommunities)
const mockGetKCore = vi.mocked(databaseApi.getKCore)
const mockGetBridges = vi.mocked(databaseApi.getBridges)
const mockRecommendHerbs = vi.mocked(databaseApi.recommendHerbs)
const mockSearchGraphNodes = vi.mocked(searchGraphNodes)
const mockGetNodeSubgraph = vi.mocked(getNodeSubgraph)

/** i18n 取值辅助（支持 count 等插值） */
const t = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(key, options as never) as string

const num = (value: number) => value.toLocaleString('zh-CN')

const GRAPH_STATS = {
  graph_node_count: 14728,
  graph_edge_count: 240143,
  node_type_breakdown: { herb: 612, compound: 12069, target: 1474, disease: 573 },
}

/** findSubgraph 返回（graph_service 口径：nodes 仅 {type,label}，edges 以 label 为端点） */
const CENTER_SUBGRAPH = {
  center_node: '黄芪',
  nodes: [
    { type: 'herb', label: '黄芪' },
    { type: 'compound', label: '黄芪甲苷' },
    { type: 'target', label: 'TNF' },
  ],
  edges: [
    { source: '黄芪', target: '黄芪甲苷', type: 'contains', strength: 1 },
    { source: '黄芪甲苷', target: 'TNF', type: 'targets', strength: 0.8 },
  ],
}

/** getNodeSubgraph 返回（DB 口径：nodes 不含根节点，edges 用 source_id/target_id） */
const NODE_SUBGRAPH = {
  root_node_id: 42,
  depth: 2,
  total_nodes: 3,
  total_edges: 2,
  nodes: [
    { id: 43, type: 'compound', label: '黄芪甲苷', description: null },
    { id: 44, type: 'target', label: 'TNF', description: null },
  ],
  edges: [
    { id: 1, source_id: 42, target_id: 43, type: 'contains', strength: 1 },
    { id: 2, source_id: 43, target_id: 44, type: 'targets', strength: 0.8 },
  ],
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <KnowledgeGraphPanel />
    </QueryClientProvider>,
  )
}

const inputPlaceholder = () => t('ai.knowledge.graphSearchPlaceholder')

describe('KnowledgeGraphPanel（mock @/api/database）', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh-CN')
  })

  beforeEach(() => {
    vi.resetAllMocks()
    mockGetGraphStats.mockResolvedValue(GRAPH_STATS)
    mockSearchGraphNodes.mockResolvedValue({ query: '', total: 0, nodes: [] })
    mockGetCentrality.mockResolvedValue({ mode: 'pageRank', results: [] })
    mockGetCommunities.mockResolvedValue({ communities: [] })
    mockGetKCore.mockResolvedValue({ k: 2, results: [] })
    mockGetBridges.mockResolvedValue({ bridges: [] })
    mockRecommendHerbs.mockResolvedValue({ recommendations: [] })
  })

  it('渲染搜索区、统计条、图例与初始提示（分析侧栏默认折叠）', async () => {
    renderPanel()

    // 搜索区
    expect(screen.getByPlaceholderText(inputPlaceholder())).toBeInTheDocument()
    expect(screen.getByLabelText(t('ai.knowledge.graphNodeType'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('ai.knowledge.graphSearch') })).toBeInTheDocument()

    // 初始态
    expect(screen.getByText(t('ai.knowledge.graphInitialHint'))).toBeInTheDocument()
    expect(screen.getByText(t('ai.knowledge.graphHint'))).toBeInTheDocument()

    // 统计条（整体图谱规模）
    expect(
      await screen.findByText(t('ai.knowledge.graphStatsNodes', { count: num(14728) })),
    ).toBeInTheDocument()
    expect(
      screen.getByText(t('ai.knowledge.graphStatsEdges', { count: num(240143) })),
    ).toBeInTheDocument()

    // 四类节点计数 + 图例
    expect(
      screen.getByText(`${t('ai.knowledge.graphTypeHerb')} ${num(612)}`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${t('ai.knowledge.graphTypeCompound')} ${num(12069)}`),
    ).toBeInTheDocument()
    expect(screen.getByText(t('ai.knowledge.graphLegend'))).toBeInTheDocument()

    // 分析侧栏折叠
    const toggle = screen.getByRole('button', { name: t('ai.knowledge.graphAnalysis') })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('kg-analysis-centrality')).not.toBeInTheDocument()
  })

  it('输入 300ms 防抖后出现联想，点击联想按 id 加载节点子图并更新统计条', async () => {
    mockSearchGraphNodes.mockResolvedValue({
      query: '黄芪',
      total: 1,
      nodes: [{ id: 42, type: 'herb', label: '黄芪', description: null }],
    })
    mockGetNodeSubgraph.mockResolvedValue(NODE_SUBGRAPH)

    renderPanel()
    const user = userEvent.setup()

    // 节点类型过滤参与联想请求
    await user.selectOptions(screen.getByLabelText(t('ai.knowledge.graphNodeType')), 'herb')
    await user.type(screen.getByPlaceholderText(inputPlaceholder()), '黄芪')

    const option = await screen.findByRole('option', { name: /黄芪/ })
    expect(mockSearchGraphNodes).toHaveBeenCalledWith('黄芪', 'herb')

    await user.click(option)

    // 联想点击走节点 id 子图接口（2 跳）
    expect(mockGetNodeSubgraph).toHaveBeenCalledWith('42', 2)
    // 根节点由前端补齐 → 2 个后端节点 + 1 个根节点
    const graph = await screen.findByTestId('knowledge-graph')
    expect(graph).toHaveAttribute('data-node-count', '3')
    expect(graph).toHaveAttribute('data-link-count', '2')

    // 统计条切换为子图规模
    expect(
      await screen.findByText(t('ai.knowledge.graphStatsNodes', { count: '3' })),
    ).toBeInTheDocument()
    expect(screen.getByText(t('ai.knowledge.graphStatsEdges', { count: '2' }))).toBeInTheDocument()
  })

  it('回车以中心词调用 findSubgraph(center, 2) 并渲染图', async () => {
    mockFindSubgraph.mockResolvedValue(CENTER_SUBGRAPH)

    renderPanel()
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText(inputPlaceholder()), '黄芪{Enter}')

    await waitFor(() => expect(mockFindSubgraph).toHaveBeenCalledWith('黄芪', 2))
    const graph = await screen.findByTestId('knowledge-graph')
    expect(graph).toHaveAttribute('data-node-count', '3')
    expect(graph).toHaveAttribute('data-link-count', '2')
  })

  it('节点超过 500 时按连接度截断并展示 graphTooLarge', async () => {
    const nodes = Array.from({ length: 600 }, (_, index) => ({
      type: 'compound',
      label: `C${index}`,
    }))
    const edges = Array.from({ length: 599 }, (_, index) => ({
      source: `C${index}`,
      target: `C${index + 1}`,
      type: 'related',
    }))
    mockFindSubgraph.mockResolvedValue({ center_node: 'C0', nodes, edges })

    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(inputPlaceholder()), 'C0{Enter}')

    const graph = await screen.findByTestId('knowledge-graph')
    expect(graph).toHaveAttribute('data-node-count', '500')
    expect(
      screen.getByText(t('ai.knowledge.graphTooLarge', { count: num(600) })),
    ).toBeInTheDocument()
  })

  it('分析侧栏「运行分析」展示中心性结果（label + 数值 + 类型）', async () => {
    mockGetCentrality.mockResolvedValue({
      mode: 'pageRank',
      total_nodes: 100,
      results: [
        { node_id: 1, node_type: 'herb', node_label: '黄芪', pagerank_score: 0.0421 },
      ],
    })

    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('ai.knowledge.graphAnalysis') }))

    const section = screen.getByTestId('kg-analysis-centrality')
    await user.click(
      within(section).getByRole('button', { name: t('ai.knowledge.graphRunAnalysis') }),
    )

    expect(mockGetCentrality).toHaveBeenCalledWith('pageRank', 20)
    await waitFor(() => expect(within(section).getByText('黄芪')).toBeInTheDocument())
    expect(within(section).getByText('0.0421')).toBeInTheDocument()
    expect(within(section).getByText(t('ai.knowledge.graphTypeHerb'))).toBeInTheDocument()
  })

  it('分析空结果显示 graphAnalysisEmpty，请求失败仅显示错误文案不崩溃', async () => {
    mockGetKCore.mockResolvedValue({ k: 2, results: [] })
    mockGetBridges.mockRejectedValueOnce(new Error('403 forbidden'))

    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('ai.knowledge.graphAnalysis') }))

    const kcoreSection = screen.getByTestId('kg-analysis-kcore')
    await user.click(
      within(kcoreSection).getByRole('button', { name: t('ai.knowledge.graphRunAnalysis') }),
    )
    await waitFor(() =>
      expect(
        within(kcoreSection).getByText(t('ai.knowledge.graphAnalysisEmpty')),
      ).toBeInTheDocument(),
    )

    const bridgesSection = screen.getByTestId('kg-analysis-bridges')
    await user.click(
      within(bridgesSection).getByRole('button', { name: t('ai.knowledge.graphRunAnalysis') }),
    )
    await waitFor(() =>
      expect(
        within(bridgesSection).getByText(t('ai.knowledge.graphLoadFailed')),
      ).toBeInTheDocument(),
    )
    // 面板其余部分仍然可用
    expect(screen.getByPlaceholderText(inputPlaceholder())).toBeInTheDocument()
  })

  it('加载失败展示 graphLoadFailed 并可重试恢复', async () => {
    mockFindSubgraph.mockRejectedValueOnce(new Error('network down'))
    mockFindSubgraph.mockResolvedValueOnce(CENTER_SUBGRAPH)

    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(inputPlaceholder()), '黄芪{Enter}')

    expect(await screen.findByText(t('ai.knowledge.graphLoadFailed'))).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('ai.knowledge.retry') }))

    expect(await screen.findByTestId('knowledge-graph')).toBeInTheDocument()
    expect(
      screen.queryByText(t('ai.knowledge.graphLoadFailed')),
    ).not.toBeInTheDocument()
  })

  it('分析推荐在有中心词时调用 recommendHerbs，无中心词时展示空态', async () => {
    renderPanel()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('ai.knowledge.graphAnalysis') }))

    const section = screen.getByTestId('kg-analysis-recommend')
    await user.click(
      within(section).getByRole('button', { name: t('ai.knowledge.graphRunAnalysis') }),
    )

    await waitFor(() =>
      expect(
        within(section).getByText(t('ai.knowledge.graphAnalysisEmpty')),
      ).toBeInTheDocument(),
    )
    expect(mockRecommendHerbs).not.toHaveBeenCalled()
    expect(mockGetCommunities).not.toHaveBeenCalled()
  })
})
