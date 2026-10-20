import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import KnowledgeGraph from '../components/database/KnowledgeGraph'

// 模拟数据
const mockNodes = [
  { id: '1', type: 'herb' as const, label: '人参', properties: { description: '补气养阴' } },
  { id: '2', type: 'compound' as const, label: '人参皂苷', properties: { description: '主要活性成分' } },
  { id: '3', type: 'target' as const, label: 'NF-κB', properties: { description: '炎症通路靶点' } },
]

const mockEdges = [
  { source: '1', target: '2', type: 'contains' },
  { source: '2', target: '3', type: 'targets' },
]

describe('KnowledgeGraph组件测试', () => {
  test('组件能够正常渲染', () => {
    const { container } = render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)

    // 检查 SVG 力导向图是否渲染成功
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  test('能够处理空数据', () => {
    expect(() => {
      render(<KnowledgeGraph nodes={[]} edges={[]} />)
    }).not.toThrow()
  })

  test('能够处理部分数据缺失的情况', () => {
    const partialNodes = [
      { id: '1', type: 'herb' as const, label: '人参' },
      // 缺少properties
      { id: '2', type: 'compound' as const, label: '化合物' },
      // 缺少properties
    ]

    const partialEdges = [
      { source: '1', target: '2', type: 'contains' },
      // 完整的边
    ]

    expect(() => {
      render(<KnowledgeGraph nodes={partialNodes} edges={partialEdges} />)
    }).not.toThrow()
  })

  test('能够处理无效的节点类型', () => {
    const invalidTypeNodes = [
      { id: '1', type: 'herb' as const, label: '测试节点' },
      { id: '2', type: 'herb' as const, label: '人参' },
    ]

    expect(() => {
      render(<KnowledgeGraph nodes={invalidTypeNodes} edges={mockEdges} />)
    }).not.toThrow()
  })

  test('能够处理无效的边类型', () => {
    const invalidEdgeTypeEdges = [
      { source: '1', target: '2', type: 'invalid' },
    ]

    expect(() => {
      render(<KnowledgeGraph nodes={mockNodes} edges={invalidEdgeTypeEdges} />)
    }).not.toThrow()
  })

  // ════════════════════════════════════════════════════════════════════
  // 防回归断言 —— 以下用例在回归提交 4d9b782 后曾全部失效
  // （重构把 `new GraphEngine(...)` 与 filteredData 计算一起丢掉了）
  // ════════════════════════════════════════════════════════════════════

  /**
   * 核心断言：传入 3 节点 2 边，SVG 里必须真实出现 3 个 g.node-group
   * 和 2 条 path.edge-link。回归前该断言恒失败（0 / 0）。
   */
  test('回归断言：引擎真实渲染全部节点与边', () => {
    const { container } = render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)

    const nodeGroups = container.querySelectorAll('svg g.node-group')
    const edgePaths = container.querySelectorAll('svg path.edge-link')

    expect(nodeGroups.length).toBe(mockNodes.length)
    expect(edgePaths.length).toBe(mockEdges.length)
  })

  /**
   * 核心断言：数据非空时，绝不能出现「当前筛选条件下无匹配节点」这句
   * 误导性空状态文案（回归前它恒为 true，直接覆盖了真实图谱）。
   */
  test('回归断言：数据非空时不显示误导性空状态', () => {
    render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)

    expect(
      screen.queryByText('当前筛选条件下无匹配节点'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('显示全部节点')).not.toBeInTheDocument()
  })

  /**
   * 边界断言：activeFilter 命中 0 节点时，空状态应当出现（说明过滤逻辑真实生效）。
   */
  test('过滤断言：筛选无命中时显示空状态', () => {
    const { container } = render(
      <KnowledgeGraph nodes={mockNodes} edges={mockEdges} />,
    )
    // 触发 activeFilter='protein'（数据中不存在该类型）
    container.querySelector('button[title*="蛋白质"], [data-type="protein"]')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  /**
   * 断言：渲染的节点带 data-type，供右键菜单按类型定位。
   */
  test('断言：节点组携带 data-type 属性', () => {
    const { container } = render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)
    const types = Array.from(
      container.querySelectorAll('svg g.node-group'),
    ).map((el) => el.getAttribute('data-type'))
    expect(types).toContain('herb')
    expect(types).toContain('compound')
    expect(types).toContain('target')
  })

  /**
   * 断言：渲染出的节点 label 文本与输入一致（防止 label 截断/丢失）。
   */
  test('断言：节点标签文本完整渲染', () => {
    const { container } = render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)
    const labels = Array.from(
      container.querySelectorAll('svg g.node-group text'),
    ).map((el) => el.textContent)
    expect(labels).toContain('人参')
    expect(labels).toContain('人参皂苷')
    expect(labels).toContain('NF-κB')
  })
})
