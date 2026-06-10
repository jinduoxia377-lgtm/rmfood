import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FormulaNewPage from '../pages/formula/FormulaNewPage'
import { useAuthStore } from '../stores/auth'

// Mock stores
jest.mock('../stores/auth')

// Mock hooks
jest.mock('../hooks/useQueries', () => ({
  useCreateFormula: jest.fn(() => ({
    mutateAsync: jest.fn(() => Promise.resolve({ id: 1, name: '测试配方' })),
    isPending: false,
  })),
  useAIRecommendations: jest.fn(() => ({
    data: null,
    isLoading: false,
  })),
}))

// Mock API
jest.mock('../api/database', () => ({
  databaseApi: {
    searchHerbs: jest.fn(() => Promise.resolve({ items: [] })),
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
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: {
        id: 1,
        role: 'formulator',
      },
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

    await waitFor(() => {
      expect(screen.getByText('请输入配方名称')).toBeInTheDocument()
    })
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

  test('removes target effects', () => {
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

    const removeButton = screen.getByTitle('Remove')
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
