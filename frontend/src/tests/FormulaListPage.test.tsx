import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FormulaListPage from '../pages/formula/FormulaListPage'
import { useAuthStore } from '../stores/auth'

// Mock stores
jest.mock('../stores/auth')

// Mock hooks
jest.mock('../hooks/useQueries', () => ({
  useFormulas: jest.fn(() => ({
    data: {
      items: [
        {
          id: 1,
          name: '测试配方1',
          code: 'FORMULA-001',
          description: '测试配方描述1',
          status: 'draft' as const,
          version: 1,
          target_effects: ['增强免疫', '抗氧化'],
          composition: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: '测试配方2',
          code: 'FORMULA-002',
          description: '测试配方描述2',
          status: 'approved' as const,
          version: 2,
          target_effects: ['降血压', '降血糖'],
          composition: {},
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
      total: 2,
    },
    isLoading: false,
  })),
  useSubmitFormula: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
}))

// Mock API
jest.mock('../api/formula', () => ({
  formulaApi: {
    delete: jest.fn(),
    import: jest.fn(),
  },
}))

describe('FormulaListPage', () => {
  const queryClient = new QueryClient({ 
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  beforeEach(() => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: {
        id: 1,
        role: 'admin',
      },
    })
  })

  test('renders formula list', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('配方管理')).toBeInTheDocument()
    expect(screen.getByText('测试配方1')).toBeInTheDocument()
    expect(screen.getByText('测试配方2')).toBeInTheDocument()
  })

  test('filters formulas by status', () => {
    render(
      <MemoryRouter initialEntries={['/formulas?status=draft']}>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('测试配方1')).toBeInTheDocument()
  })

  test('searches formulas', () => {
    render(
      <MemoryRouter initialEntries={['/formulas?search=测试']}>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('测试配方1')).toBeInTheDocument()
    expect(screen.getByText('测试配方2')).toBeInTheDocument()
  })

  test('toggles view mode', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const tableViewButton = screen.getByTitle('表格视图')
    fireEvent.click(tableViewButton)
    
    const cardViewButton = screen.getByTitle('卡片视图')
    fireEvent.click(cardViewButton)
  })

  test('handles batch operations', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // 选择第一个配方
    const checkboxes = screen.getAllByRole('button')
    fireEvent.click(checkboxes[0])

    // 点击批量删除
    const deleteButton = screen.getByText('批量删除 (1)')
    fireEvent.click(deleteButton)

    // 模拟确认删除
    window.confirm = jest.fn().mockReturnValue(true)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('确定要删除选中的 1 个配方吗？此操作不可撤销。')
    })
  })
})
