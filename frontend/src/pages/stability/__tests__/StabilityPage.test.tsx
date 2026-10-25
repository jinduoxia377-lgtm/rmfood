/**
 * StabilityPage 前端专项测试
 *
 * 覆盖：
 * 1. 页面关键元素渲染
 * 2. 已知成分从后端稳定性数据库加载（替代静态硬编码列表）
 * 3. 运行稳定性预测并展示结果（真实 API 契约的 mock）
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StabilityPage from '../StabilityPage'

// ── Mock i18n ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>): string => {
      const map: Record<string, string> = {
        'pages.stability.title': '稳定性分析',
        'pages.stability.formulaIngredients': '配方成分',
        'pages.stability.addIngredient': '添加成分',
        'pages.stability.selectIngredient': '选择成分...',
        'pages.stability.runStabilityPrediction': '运行稳定性预测',
        'pages.stability.knownHerbsFromBackend': '后端数据库',
        'pages.stability.knownHerbsFallback': '离线列表',
        'pages.stability.stabilityScore': '稳定性评分',
        'pages.stability.estimatedShelfLife': '预估货架期',
        'pages.stability.toastPredictionDone': '预测完成',
      }
      return map[key] ?? key
    },
  }),
}))

// ── Mock stability API：使用与后端 /stability/ingredients 一致的响应契约 ──
const listIngredientsMock = vi.fn(() =>
  Promise.resolve({
    data: {
      status: 'ok',
      count: 2,
      ingredients: [
        { name: '后端成分A', k_25_per_month: 0.01, activation_energy_J: 50000, light_factor: 1.2, ph_window: [4, 7], base_shelf_life_months: 24 },
        { name: '后端成分B', k_25_per_month: 0.02, activation_energy_J: 48000, light_factor: 1.5, ph_window: [5, 8], base_shelf_life_months: 18 },
      ],
    },
  }),
)
const predictMock = vi.fn(() =>
  Promise.resolve({
    data: {
      data: {
        stability_score: 0.85,
        estimated_shelf_life_months: 18.5,
        risk_factors: [],
        monthly_curve: [{ month: 1, remaining_pct: 0.98 }],
        storage_advice: ['避光保存'],
        shelf_life_details: { months_to_90: 12, months_to_80: 24, predicted_months: 18, confidence: 0.9 },
      },
    },
  }),
)
vi.mock('@/api/stability', () => ({
  stabilityApi: {
    listIngredients: () => listIngredientsMock(),
    predict: (data: unknown) => predictMock(data),
    q10: () => Promise.resolve({ data: {} }),
  },
}))

// ── Mock Toast ──
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

// ── Mock recharts（jsdom 无真实尺寸，渲染为轻量容器）──
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
  ReferenceLine: () => null,
  Area: () => null,
}))

describe('StabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染页面标题与核心表单', () => {
    render(<StabilityPage />)
    expect(screen.getByText('稳定性分析')).toBeInTheDocument()
    expect(screen.getByText('配方成分')).toBeInTheDocument()
    expect(screen.getByText('运行稳定性预测')).toBeInTheDocument()
  })

  it('从后端加载已知成分并渲染为下拉选项（真实数据契约）', async () => {
    render(<StabilityPage />)
    // 初始为静态降级列表，等待后端返回后切换为后端成分（页面有 3 个成分行，每行下拉均含后端成分）
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: '后端成分A' }).length).toBeGreaterThan(0)
    })
    expect(screen.getAllByRole('option', { name: '后端成分B' }).length).toBeGreaterThan(0)
    expect(screen.getByText('后端数据库')).toBeInTheDocument()
    expect(listIngredientsMock).toHaveBeenCalledTimes(1)
  })

  it('点击运行预测后展示稳定性结果', async () => {
    render(<StabilityPage />)
    fireEvent.click(screen.getByText('运行稳定性预测'))
    await waitFor(() => {
      expect(predictMock).toHaveBeenCalledTimes(1)
    })
    // 预测成功后展示稳定性评分（0.85 → 85%）
    await waitFor(() => {
      expect(screen.getByText('稳定性评分')).toBeInTheDocument()
    })
  })
})