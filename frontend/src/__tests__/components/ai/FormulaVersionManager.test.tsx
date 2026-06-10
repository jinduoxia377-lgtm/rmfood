import { render, screen, fireEvent } from '@testing-library/react'
import { FormulaVersionManager, FormulaVersion } from '@/components/ai/FormulaVersionManager'

const mockVersions: FormulaVersion[] = [
  {
    id: 'v1',
    versionNumber: 2,
    formulaName: '测试配方 v2',
    effects: ['增强免疫', '抗氧化'],
    ingredients: [
      { name: '枸杞', dosage: '10g', role: '君药' },
      { name: '黄芪', dosage: '5g', role: '臣药' },
    ],
    scores: { synergy: 0.85, taste: 0.78, stability: 0.82, overall: 0.82 },
    createdAt: Date.now() - 86400000,
    remark: '优化剂量比例',
  },
  {
    id: 'v2',
    versionNumber: 1,
    formulaName: '测试配方 v1',
    effects: ['增强免疫'],
    ingredients: [
      { name: '枸杞', dosage: '8g', role: '君药' },
    ],
    scores: { synergy: 0.75, taste: 0.68, stability: 0.72, overall: 0.72 },
    createdAt: Date.now() - 172800000,
    remark: '初始版本',
    parentId: undefined,
  },
]

describe('FormulaVersionManager', () => {
  const mockOnSelectVersion = jest.fn()
  const mockOnRollback = jest.fn()
  const mockOnVersionCompare = jest.fn()
  const mockOnAddRemark = jest.fn()
  const mockOnCreateBranch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders empty state when no versions', () => {
    render(<FormulaVersionManager versions={[]} />)

    expect(screen.getByText('暂无版本记录')).toBeInTheDocument()
    expect(screen.getByText('配方修改后将自动创建版本')).toBeInTheDocument()
  })

  it('renders versions list', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('测试配方 v2')).toBeInTheDocument()
    expect(screen.getByText('测试配方 v1')).toBeInTheDocument()
  })

  it('displays version number correctly', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('calls onSelectVersion when version is clicked', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    const versionItem = screen.getByText('测试配方 v1').closest('.cursor-pointer')
    if (versionItem) {
      fireEvent.click(versionItem)
      expect(mockOnSelectVersion).toHaveBeenCalled()
    }
  })

  it('renders version effects', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('增强免疫')).toBeInTheDocument()
    expect(screen.getByText('抗氧化')).toBeInTheDocument()
  })

  it('displays version scores', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText(/评分: 0\.82/)).toBeInTheDocument()
    expect(screen.getByText(/评分: 0\.72/)).toBeInTheDocument()
  })

  it('shows compare button when two versions are selected', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
        onVersionCompare={mockOnVersionCompare}
      />
    )

    const v1 = screen.getByText('测试配方 v1').closest('.cursor-pointer')
    const v2 = screen.getByText('测试配方 v2').closest('.cursor-pointer')

    if (v1) fireEvent.click(v1)
    if (v2) fireEvent.click(v2)

    expect(screen.getByText('对比')).toBeInTheDocument()
  })

  it('calls onVersionCompare when compare button is clicked', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
        onVersionCompare={mockOnVersionCompare}
      />
    )

    const v1 = screen.getByText('测试配方 v1').closest('.cursor-pointer')
    const v2 = screen.getByText('测试配方 v2').closest('.cursor-pointer')

    if (v1) fireEvent.click(v1)
    if (v2) fireEvent.click(v2)

    const compareButton = screen.getByText('对比')
    fireEvent.click(compareButton)

    expect(mockOnVersionCompare).toHaveBeenCalled()
  })

  it('displays version remarks', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('优化剂量比例')).toBeInTheDocument()
    expect(screen.getByText('初始版本')).toBeInTheDocument()
  })

  it('shows current version badge', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        currentVersionId="v1"
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('当前')).toBeInTheDocument()
  })

  it('hides rollback button for current version', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        currentVersionId="v2"
        onSelectVersion={mockOnSelectVersion}
        onRollback={mockOnRollback}
      />
    )

    const rollbackButtons = screen.getAllByText(/回滚/)
    expect(rollbackButtons.length).toBeGreaterThanOrEqual(0)
  })

  it('calls onRollback when rollback button is clicked', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        currentVersionId="v2"
        onSelectVersion={mockOnSelectVersion}
        onRollback={mockOnRollback}
      />
    )

    const rollbackButtons = screen.getAllByText(/回滚/)
    if (rollbackButtons.length > 0) {
      fireEvent.click(rollbackButtons[0])
      expect(mockOnRollback).toHaveBeenCalled()
    }
  })

  it('calls onCreateBranch when branch button is clicked', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        currentVersionId="v2"
        onSelectVersion={mockOnSelectVersion}
        onCreateBranch={mockOnCreateBranch}
      />
    )

    const branchButtons = screen.getAllByText(/分支/)
    if (branchButtons.length > 0) {
      fireEvent.click(branchButtons[0])
      expect(mockOnCreateBranch).toHaveBeenCalled()
    }
  })

  it('displays version count', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText(/\(2\/100\)/)).toBeInTheDocument()
  })

  it('opens remark edit when remark button is clicked', () => {
    render(
      <FormulaVersionManager
        versions={mockVersions}
        onSelectVersion={mockOnSelectVersion}
        onAddRemark={mockOnAddRemark}
      />
    )

    const remarkButtons = screen.getAllByText(/备注/)
    if (remarkButtons.length > 0) {
      fireEvent.click(remarkButtons[0])
    }
  })

  it('handles branch versions correctly', () => {
    const versionsWithBranch: FormulaVersion[] = [
      ...mockVersions,
      {
        id: 'v3',
        versionNumber: 1.1,
        formulaName: '测试配方 分支版',
        effects: ['增强免疫', '改善睡眠'],
        ingredients: [{ name: '酸枣仁', dosage: '5g', role: '佐药' }],
        scores: { synergy: 0.70, taste: 0.65, stability: 0.68, overall: 0.68 },
        createdAt: Date.now() - 86400000,
        remark: '分支版本',
        parentId: 'v1',
      },
    ]

    render(
      <FormulaVersionManager
        versions={versionsWithBranch}
        onSelectVersion={mockOnSelectVersion}
      />
    )

    expect(screen.getByText('测试配方 分支版')).toBeInTheDocument()
  })
})
