import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FormulaNewPage from '../pages/formula/FormulaNewPage'
import { useAuthStore } from '../stores/auth'

// Mock stores
vi.mock('../stores/auth')

// Mock hooks
vi.mock('../hooks/useQueries', () => ({
  useCreateFormula: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve({ id: 1, name: '测试配方' })),
    isPending: false,
  })),
  useAIRecommendations: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
}))

// Mock API
vi.mock('../api/database', () => ({
  databaseApi: {
    searchHerbs: vi.fn(() => Promise.resolve({ items: [] })),
  },
}))

describe('FormulaNewPage', () => {
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
      const state = { user: { id: 1, role: 'formulator' } }
      return selector ? selector(state) : state
    })
  })

  test('renders create formula page', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaNewPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('新建配方')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例：枸杞山药增强免疫配方')).toBeInTheDocument()
  })

  test('validates form submission', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaNewPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const createButton = screen.getByText('创建配方')
    fireEvent.click(createButton)

    expect(await screen.findByText('配方名称不能为空')).toBeInTheDocument()
  })

  test('adds target effects', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaNewPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const effectInput = screen.getByPlaceholderText('输入功效后按回车添加')
    fireEvent.change(effectInput, { target: { value: '增强免疫' } })
    fireEvent.keyDown(effectInput, { key: 'Enter' })

    expect(screen.getByText('增强免疫')).toBeInTheDocument()
  })

  test('removes target effects', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaNewPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    const effectInput = screen.getByPlaceholderText('输入功效后按回车添加')
    fireEvent.change(effectInput, { target: { value: '增强免疫' } })
    fireEvent.keyDown(effectInput, { key: 'Enter' })

    const removeButton = await screen.findByRole('button', { name: '移除功效' })
    fireEvent.click(removeButton)

    expect(screen.queryByText('增强免疫')).not.toBeInTheDocument()
  })

  test('submits form successfully', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FormulaNewPage />
        </QueryClientProvider>
      </MemoryRouter>
    )

    // 填写配方名称
    const nameInput = screen.getByPlaceholderText('例：枸杞山药增强免疫配方')
    fireEvent.change(nameInput, { target: { value: '测试配方' } })

    // 添加功效
    const effectInput = screen.getByPlaceholderText('输入功效后按回车添加')
    fireEvent.change(effectInput, { target: { value: '增强免疫' } })
    fireEvent.keyDown(effectInput, { key: 'Enter' })

    // 点击创建按钮
    const createButton = screen.getByText('创建配方')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('创建配方')).toBeInTheDocument()
    })
  })
})
