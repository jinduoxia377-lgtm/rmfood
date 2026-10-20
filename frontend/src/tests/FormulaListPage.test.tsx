import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FormulaListPage from '../pages/formula/FormulaListPage'
import { useAuthStore } from '../stores/auth'

// Mock stores
vi.mock('../stores/auth')

// Mock hooks
vi.mock('../hooks/useQueries', () => ({
  useFormulas: vi.fn(() => ({
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
  useSubmitFormula: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

// Mock API
vi.mock('../api/formula', () => ({
  formulaApi: {
    list: vi.fn(() => Promise.resolve({
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
      total_pages: 1,
    })),
    getStatistics: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(),
    import: vi.fn(),
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
    // useAuthStore 在组件与 usePermission 中以 selector 形式调用（useAuthStore((s) => s.user)），
    // 因此 mock 需实现 selector 语义，返回 state.user 而不是整个 state。
    (useAuthStore as unknown as vi.Mock).mockImplementation((selector?: (state: { user: { id: number; role: string } }) => unknown) => {
      const state = { user: { id: 1, role: 'admin' } }
      return selector ? selector(state) : state
    })
  })

  test('renders formula list', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // 页面在数据加载期间渲染骨架屏，标题与列表需等待 React Query 完成
    expect(await screen.findByText('配方管理')).toBeInTheDocument()
    expect(screen.getAllByText('测试配方1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('测试配方2').length).toBeGreaterThan(0)
  })

  test('filters formulas by status', async () => {
    render(
      <MemoryRouter initialEntries={['/formulas?status=draft']}>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect((await screen.findAllByText('测试配方1')).length).toBeGreaterThan(0)
  })

  test('searches formulas', async () => {
    render(
      <MemoryRouter initialEntries={['/formulas?search=测试']}>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // 搜索场景下 FormulaCard 会用 <mark> 高亮命中的“测试”，名称文本被拆分，
    // 因此按未被高亮拆分的后缀断言；同时放宽超时以容纳 URL 同步带来的二次渲染。
    expect((await screen.findAllByText('配方1', {}, { timeout: 3000 })).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('配方2', {}, { timeout: 3000 })).length).toBeGreaterThan(0)
  })

  test('toggles view mode', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaListPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const tableViewButton = await screen.findByTitle('表格视图')
    fireEvent.click(tableViewButton)

    const cardViewButton = await screen.findByTitle('卡片视图')
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

    // 等待列表渲染后，勾选表格中第一行配方（避免误点筛选区 checkbox）
    await screen.findByText('配方管理')
    const table = await screen.findByRole('table')
    const rows = await within(table).findAllByRole('row')
    const firstRowCheckbox = within(rows[1]).getByRole('checkbox')
    fireEvent.click(firstRowCheckbox)

    // 点击批量删除（按钮文案为 i18n 的“批量删除”，不带计数）
    const deleteButton = await screen.findByText('批量删除')
    // 必须在点击前替换 window.confirm，否则组件内同步调用的是真实 confirm
    window.confirm = vi.fn().mockReturnValue(true)
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('确定要删除选中的 1 个配方吗？5秒内可撤销。')
    })
  })
})
