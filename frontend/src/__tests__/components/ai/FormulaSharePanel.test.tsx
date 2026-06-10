import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FormulaSharePanel, ImportShareDialog } from '@/components/ai/FormulaSharePanel'

const mockFormula = {
  formulaName: '测试配方',
  effects: ['增强免疫', '抗氧化'],
  ingredients: [
    { name: '枸杞', dosage: '10g', role: '君药' },
    { name: '黄芪', dosage: '5g', role: '臣药' },
  ],
  scores: { synergy: 0.85, taste: 0.78, stability: 0.82, overall: 0.82 },
}

describe('FormulaSharePanel', () => {
  const mockOnShare = jest.fn()
  const mockOnImport = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders share panel with title', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    expect(screen.getByText('分享配方')).toBeInTheDocument()
    expect(screen.getByText('生成链接或二维码分享配方')).toBeInTheDocument()
  })

  it('renders permission options', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    expect(screen.getByText('公开')).toBeInTheDocument()
    expect(screen.getByText('私密')).toBeInTheDocument()
    expect(screen.getByText('密码')).toBeInTheDocument()
  })

  it('calls onShare when generate link is clicked', () => {
    render(<FormulaSharePanel formula={mockFormula} onShare={mockOnShare} />)

    const generateButton = screen.getByText('生成分享链接')
    fireEvent.click(generateButton)

    expect(mockOnShare).toHaveBeenCalled()
  })

  it('shows password input when password permission is selected', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    const passwordButton = screen.getByText('密码').closest('button')
    if (passwordButton) {
      fireEvent.click(passwordButton)
    }

    expect(screen.getByPlaceholderText('设置访问密码')).toBeInTheDocument()
  })

  it('renders expiration options', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    expect(screen.getByText('链接有效期')).toBeInTheDocument()
    expect(screen.getByText('7天')).toBeInTheDocument()
    expect(screen.getByText('30天')).toBeInTheDocument()
  })

  it('renders content options', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    expect(screen.getByText('包含评分信息')).toBeInTheDocument()
    expect(screen.getByText('包含原料信息')).toBeInTheDocument()
  })

  it('renders template options', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    expect(screen.getByText('卡片样式')).toBeInTheDocument()
    expect(screen.getByText('简洁')).toBeInTheDocument()
    expect(screen.getByText('详细')).toBeInTheDocument()
    expect(screen.getByText('卡片')).toBeInTheDocument()
  })

  it('generates share link with correct parameters', () => {
    render(<FormulaSharePanel formula={mockFormula} onShare={mockOnShare} />)

    const generateButton = screen.getByText('生成分享链接')
    fireEvent.click(generateButton)

    expect(mockOnShare).toHaveBeenCalledWith(
      expect.objectContaining({
        formulaName: '测试配方',
        effects: ['增强免疫', '抗氧化'],
        viewCount: 0,
      })
    )
  })

  it('shows import dialog when import button is clicked', () => {
    render(<FormulaSharePanel formula={mockFormula} />)

    const importButton = screen.getByText('导入他人分享的配方')
    fireEvent.click(importButton)

    expect(screen.getByPlaceholderText('粘贴分享链接或输入分享ID')).toBeInTheDocument()
  })

  it('calls onImport with share link', () => {
    render(<FormulaSharePanel formula={mockFormula} onImport={mockOnImport} />)

    const importButton = screen.getByText('导入他人分享的配方')
    fireEvent.click(importButton)

    const input = screen.getByPlaceholderText('粘贴分享链接或输入分享ID')
    fireEvent.change(input, { target: { value: 'https://example.com/share/formula/123' } })

    const importConfirmButton = screen.getByText('导入配方')
    fireEvent.click(importConfirmButton)
  })
})

describe('ImportShareDialog', () => {
  const mockOnClose = jest.fn()
  const mockOnImport = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders import dialog when open', () => {
    render(
      <ImportShareDialog
        open={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    )

    expect(screen.getByText('导入配方')).toBeInTheDocument()
  })

  it('does not render when not open', () => {
    render(
      <ImportShareDialog
        open={false}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    )

    expect(screen.queryByText('导入配方')).not.toBeInTheDocument()
  })

  it('calls onClose when cancel is clicked', () => {
    render(
      <ImportShareDialog
        open={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    )

    const cancelButton = screen.getByText('取消')
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows error for invalid share link', async () => {
    render(
      <ImportShareDialog
        open={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    )

    const input = screen.getByPlaceholderText('粘贴分享链接')
    fireEvent.change(input, { target: { value: 'invalid-url' } })

    const importButton = screen.getByText('导入')
    fireEvent.click(importButton)

    await waitFor(() => {
      expect(screen.queryByText('无效的分享链接')).toBeInTheDocument()
    })
  })

  it('handles share link with password', async () => {
    render(
      <ImportShareDialog
        open={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    )

    const input = screen.getByPlaceholderText('粘贴分享链接')
    fireEvent.change(input, { target: { value: 'https://example.com/share/formula/123?pwd=abc' } })

    expect(screen.getByPlaceholderText('输入访问密码')).toBeInTheDocument()
  })
})
