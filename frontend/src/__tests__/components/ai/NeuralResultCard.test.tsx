import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NeuralResultCard } from '@/components/ai/NeuralResultCard'
import type { AICandidate } from '@/types'

vi.mock('recharts', () => ({
  RadarChart: () => null,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
}))

const mockCandidate: AICandidate = {
  formula_name: '测试配方',
  description: '这是一个测试配方描述',
  synergy_score: 0.85,
  taste_score: 0.75,
  stability_score: 0.8,
  overall_score: 0.8,
  safety_passed: true,
  safety_details: { passed: true },
  herb_combination: [
    { name: '黄芪', role: '君' },
    { name: '党参', role: '臣' },
  ],
  peptide_candidates: [],
}

describe('NeuralResultCard', () => {
  it('renders formula name and description correctly', () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    expect(screen.getByText('测试配方')).toBeInTheDocument()
    expect(screen.getByText('这是一个测试配方描述')).toBeInTheDocument()
  })

  it('renders scores correctly', () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getAllByText('80')).toHaveLength(4)
  })

  it('renders ingredient list correctly', () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    expect(screen.getByText('黄芪')).toBeInTheDocument()
    expect(screen.getByText('党参')).toBeInTheDocument()
    expect(screen.getByText('君')).toBeInTheDocument()
    expect(screen.getByText('臣')).toBeInTheDocument()
  })

  it('enters edit mode when edit button is clicked', async () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    const editButton = screen.getByText('编辑配方')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByText('取消编辑')).toBeInTheDocument()
    })
    expect(screen.getByText('保存修改')).toBeInTheDocument()
  })

  it('shows edit toolbar in edit mode', async () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    const editButton = screen.getByText('编辑配方')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTitle('加粗')).toBeInTheDocument()
    })
    expect(screen.getByTitle('斜体')).toBeInTheDocument()
    expect(screen.getByTitle('无序列表')).toBeInTheDocument()
    expect(screen.getByTitle('有序列表')).toBeInTheDocument()
  })

  it('shows undo/redo buttons in edit mode', async () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    const editButton = screen.getByText('编辑配方')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTitle('撤销')).toBeInTheDocument()
    })
    expect(screen.getByTitle('重做')).toBeInTheDocument()
  })

  it('shows reset button in edit mode', async () => {
    render(<NeuralResultCard candidate={mockCandidate} index={0} />)

    const editButton = screen.getByText('编辑配方')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTitle('重置到初始状态')).toBeInTheDocument()
    })
  })
})
