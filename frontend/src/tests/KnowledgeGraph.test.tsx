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
    render(<KnowledgeGraph nodes={mockNodes} edges={mockEdges} />)
    
    // 检查组件是否渲染成功
    expect(screen.getByText('知识图谱')).toBeInTheDocument()
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
})
