/**
 * 配方案例库前端集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FormulaCasesPage } from './FormulaCasesPage'
import * as formulaApi from '@/api/formula'

// Mock API
vi.mock('@/api/formula', () => ({
  getFormulaCases: vi.fn(),
  getCaseCategories: vi.fn(),
  getFormulaCase: vi.fn(),
  toggleCaseLike: vi.fn(),
  getCaseComments: vi.fn(),
  createCaseComment: vi.fn(),
  deleteFormulaCase: vi.fn(),
  createFormulaCase: vi.fn(),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/formulas/cases']}>
      <Routes>
        <Route path="/formulas/cases" element={<FormulaCasesPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
)

describe('FormulaCasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该显示案例列表标题', async () => {
    vi.mocked(formulaApi.getFormulaCases).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(formulaApi.getCaseCategories).mockResolvedValue([])

    render(<Wrapper />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText('配方案例库')).toBeInTheDocument()
    })
  })

  it('应该显示搜索框', async () => {
    vi.mocked(formulaApi.getFormulaCases).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(formulaApi.getCaseCategories).mockResolvedValue([])

    render(<Wrapper />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索案例标题、简介...')).toBeInTheDocument()
    })
  })

  it('应该显示网格/列表切换按钮', async () => {
    vi.mocked(formulaApi.getFormulaCases).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(formulaApi.getCaseCategories).mockResolvedValue([])

    render(<Wrapper />)

    await waitFor(() => {
      expect(screen.getByText('网格')).toBeInTheDocument()
      expect(screen.getByText('列表')).toBeInTheDocument()
    })
  })

  it('加载案例时应显示骨架屏', async () => {
    // 不 resolve，模拟加载中
    const loadingPromise = new Promise(() => {})
    vi.mocked(formulaApi.getFormulaCases).mockReturnValue(loadingPromise as any)
    vi.mocked(formulaApi.getCaseCategories).mockReturnValue(loadingPromise as any)

    render(<Wrapper />)

    // 应该显示骨架屏卡片
    const cards = document.querySelectorAll('[class*="animate-pulse"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('案例为空时应显示空状态', async () => {
    vi.mocked(formulaApi.getFormulaCases).mockResolvedValue({
      items: [],
      total: 0,
    })
    vi.mocked(formulaApi.getCaseCategories).mockResolvedValue([])

    render(<Wrapper />)

    await waitFor(() => {
      expect(screen.getByText('暂无案例')).toBeInTheDocument()
    })
  })

  it('应正确渲染案例卡片', async () => {
    const mockCases = {
      items: [
        {
          id: 1,
          title: '补气养血配方案例',
          formula_id: 10,
          category: '补气养血',
          tags: ['黄芪', '人参'],
          summary: '经典补气养血配方，适用于气血两虚人群',
          content: '# 详细内容\n\n此处为案例详情...',
          cover_image: null,
          views: 120,
          likes: 15,
          is_featured: true,
          created_by: 1,
          creator_name: '张医生',
          formula_name: '补气养血方',
          created_at: '2026-08-15T10:00:00Z',
          updated_at: '2026-08-15T10:00:00Z',
          generated_by_ai: false,
        },
      ],
      total: 1,
    }

    vi.mocked(formulaApi.getFormulaCases).mockResolvedValue(mockCases)
    vi.mocked(formulaApi.getCaseCategories).mockResolvedValue([])

    render(<Wrapper />)

    await waitFor(() => {
      expect(screen.getByText('补气养血配方案例')).toBeInTheDocument()
      expect(screen.getByText('经典补气养血配方，适用于气血两虚人群')).toBeInTheDocument()
    })
  })
})
