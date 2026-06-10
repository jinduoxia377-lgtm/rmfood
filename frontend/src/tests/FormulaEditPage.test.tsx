import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FormulaEditPage from '../pages/formula/FormulaEditPage'
import { useAuthStore } from '../stores/auth'

// Mock stores
jest.mock('../stores/auth')

// Mock hooks
jest.mock('../hooks/useQueries', () => ({
  useFormula: jest.fn(() => ({
    data: {
      id: 1,
      name: '测试配方',
      code: 'FORMULA-001',
      description: '测试配方描述',
      status: 'draft' as const,
      version: 1,
      target_effects: ['增强免疫', '抗氧化'],
      composition: {
        ingredients: [
          { name: '枸杞', category: '滋补类', dosage: '10g' },
          { name: '山药', category: '健脾类', dosage: '15g' },
        ],
      },
      processing_method: '煎煮',
      dosage: '每日2次',
      storage_conditions: '阴凉干燥',
      shelf_life: 365,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    isLoading: false,
  })),
  useFormulaVersions: jest.fn(() => ({
    data: [
      { id: 1, version: 1, change_summary: '初始版本', created_at: '2024-01-01T00:00:00Z' },
    ],
  })),
  useUpdateFormula: jest.fn(() => ({
    mutateAsync: jest.fn(() => Promise.resolve({ id: 1, name: '测试配方' })),
    isPending: false,
  })),
  useDeleteFormula: jest.fn(() => ({
    mutateAsync: jest.fn(() => Promise.resolve()),
    isPending: false,
  })),
}))

// Mock API
jest.mock('../api/formula', () => ({
  formulaApi: {
    delete: jest.fn(),
  },
}))

describe('FormulaEditPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  beforeEach(() => {
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: {
        id: 1,
        role: 'formulator',
      },
    })
  })

  test('renders edit formula page', () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('编辑配方')).toBeInTheDocument()
    expect(screen.getByDisplayValue('测试配方')).toBeInTheDocument()
  })

  test('validates form submission', async () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const nameInput = screen.getByDisplayValue('测试配方')
    fireEvent.change(nameInput, { target: { value: '' } })

    const saveButton = screen.getByText('保存修改')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('请输入配方名称')).toBeInTheDocument()
    })
  })

  test('adds target effects', () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const effectInput = screen.getByPlaceholderText('输入功效后按回车添加')
    fireEvent.change(effectInput, { target: { value: '降血压' } })
    fireEvent.keyDown(effectInput, { key: 'Enter' })

    expect(screen.getByText('降血压')).toBeInTheDocument()
  })

  test('removes target effects', () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const removeButtons = screen.getAllByTitle('Remove')
    fireEvent.click(removeButtons[0])

    expect(screen.queryByText('增强免疫')).not.toBeInTheDocument()
  })

  test('submits form successfully', async () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const nameInput = screen.getByDisplayValue('测试配方')
    fireEvent.change(nameInput, { target: { value: '更新后的配方' } })

    const saveButton = screen.getByText('保存修改')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByDisplayValue('更新后的配方')).toBeInTheDocument()
    })
  })

  test('handles delete confirmation', async () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const deleteButton = screen.getByText('删除配方')
    fireEvent.click(deleteButton)

    window.confirm = jest.fn().mockReturnValue(true)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('确认删除此配方？此操作不可撤销。')
    })
  })

  test('displays version history', () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('初始版本')).toBeInTheDocument()
  })

  test('updates version notes', () => {
    render(
      <MemoryRouter initialEntries={['/formulas/1/edit']}>
        <QueryClientProvider client={queryClient}>
          <FormulaEditPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const notesInput = screen.getByPlaceholderText('简要描述本次修改内容（选填）')
    fireEvent.change(notesInput, { target: { value: '测试版本说明' } })

    expect(screen.getByDisplayValue('测试版本说明')).toBeInTheDocument()
  })
})
