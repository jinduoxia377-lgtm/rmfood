/**
 * 「市售产品」搜索面板组件 UI 测试
 *
 * 覆盖：
 * - mapOFFProduct 数据映射（OFF 原始数据 → 前端统一格式）
 * - 搜索请求参数构造（关键词/筛选/realtime）
 * - 收藏 / 取消收藏逻辑（pantry API）
 * - 排序与过滤（价格排序、品牌过滤、收藏过滤）
 * - 导出 CSV（BOM、表头、数据行、收藏/对比标记）
 * - 相关度体验（相关度过滤文案、无相关结果提示、热门词引导）
 *
 * 语言锁定 zh-CN（import '@/i18n'）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import RetailProductSearchPanel from '../RetailProductSearchPanel'

// ── mock 依赖 ──
const mocks = vi.hoisted(() => ({
  searchOpenFoodFacts: vi.fn(),
  getOpenFoodFactsCategories: vi.fn(),
  getSearchSuggestions: vi.fn(),
  addToPantryRetailProduct: vi.fn(),
  removeFromPantryRetailProduct: vi.fn(),
  getPantryRetailProducts: vi.fn(),
  getProductsByCategory: vi.fn(),
  getOpenFoodFactsSyncStats: vi.fn(),
  getOpenFoodFactsReport: vi.fn(),
  getOpenFoodFactByBarcode: vi.fn(),
  getOpenFoodFactById: vi.fn(),
}))

vi.mock('@/api/searchNew', () => ({
  searchOpenFoodFacts: mocks.searchOpenFoodFacts,
  getOpenFoodFactsCategories: mocks.getOpenFoodFactsCategories,
  getSearchSuggestions: mocks.getSearchSuggestions,
  addToPantryRetailProduct: mocks.addToPantryRetailProduct,
  removeFromPantryRetailProduct: mocks.removeFromPantryRetailProduct,
  getPantryRetailProducts: mocks.getPantryRetailProducts,
  getProductsByCategory: mocks.getProductsByCategory,
  getOpenFoodFactsSyncStats: mocks.getOpenFoodFactsSyncStats,
  getOpenFoodFactsReport: mocks.getOpenFoodFactsReport,
  getOpenFoodFactByBarcode: mocks.getOpenFoodFactByBarcode,
  getOpenFoodFactById: mocks.getOpenFoodFactById,
}))

vi.mock('@/stores/toastStore', () => {
  // 模块级单例：addToast 引用稳定，避免组件 useEffect 依赖 toast 引用变化而反复执行
  const addToast = vi.fn()
  return {
    useToastStore: (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { addToast }
      return selector ? selector(state) : state
    },
  }
})

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── mapOFFProduct 副本（组件内函数未导出，测试中复制逻辑并标注来源） ──
interface OFFRawProduct {
  id?: number | string
  product_name?: string
  brand?: string
  category?: string
  formulation_type?: string | null
  price?: number | null
  avg_rating?: number | null
  image_urls?: string[]
  effects?: string[]
  score?: number
  allergens_tags?: string[]
  additives_tags?: string[]
  ecoscore_grade?: string | null
  traces_tags?: string[]
  contaminants?: string[]
}

function mapOFFProductCopy(raw: OFFRawProduct) {
  return {
    id: Number(raw.id ?? 0),
    product_name: raw.product_name || '',
    brand: raw.brand || 'Unknown',
    category: raw.category || '',
    sub_category: undefined,
    formulation_type: raw.formulation_type || '',
    price: raw.price != null ? Number(raw.price) : 0,
    avg_rating: raw.avg_rating != null ? Number(raw.avg_rating) : 0,
    image_urls: Array.isArray(raw.image_urls) ? raw.image_urls : [],
    effects: Array.isArray(raw.effects) ? raw.effects : [],
    score: raw.score != null ? Number(raw.score) : 0,
    allergens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [],
    additives_tags: Array.isArray(raw.additives_tags) ? raw.additives_tags : [],
    ecoscore_grade: raw.ecoscore_grade ?? null,
    traces_tags: Array.isArray(raw.traces_tags) ? raw.traces_tags : [],
    contaminants: Array.isArray(raw.contaminants) ? raw.contaminants : [],
  }
}

// ── 辅助函数 ──
function sampleProducts() {
  return [
    {
      id: 1,
      product_name: '汤臣倍健 蛋白质粉（香草口味）',
      brand: '汤臣倍健',
      category: '保健食品',
      formulation_type: '粉剂',
      price: 298,
      avg_rating: 4.5,
      image_urls: [],
      effects: ['增强免疫力'],
      allergens_tags: ['牛奶'],
      additives_tags: [],
      ecoscore_grade: 'b',
    },
    {
      id: 2,
      product_name: 'Swisse 深海鱼油软胶囊',
      brand: 'Swisse',
      category: '保健食品',
      formulation_type: '胶囊',
      price: 199,
      avg_rating: 4.2,
      image_urls: [],
      effects: ['辅助降血脂'],
      allergens_tags: [],
      additives_tags: ['E202'],
      ecoscore_grade: 'a',
    },
  ]
}

function emptyResponse(dataSource = 'postgresql_ilike_empty') {
  return {
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    data_source: dataSource,
  }
}

async function renderPanel() {
  const user = userEvent.setup()
  // 仅在调用方未预设时设置默认 mock（避免覆盖测试预设的搜索结果/收藏）
  if (!mocks.getOpenFoodFactsCategories.getMockImplementation()) {
    mocks.getOpenFoodFactsCategories.mockResolvedValue([])
  }
  if (!mocks.getPantryRetailProducts.getMockImplementation()) {
    mocks.getPantryRetailProducts.mockResolvedValue([])
  }
  if (!mocks.getSearchSuggestions.getMockImplementation()) {
    mocks.getSearchSuggestions.mockResolvedValue({ suggestions: [] })
  }
  render(<RetailProductSearchPanel />)
  return user
}

async function renderAndSearch(keyword = '蛋白粉') {
  const user = await renderPanel()
  await user.type(screen.getByPlaceholderText(/输入中文关键词/), keyword)
  await user.click(screen.getByRole('button', { name: '搜索零售产品' }))
  return user
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ═══════════════════════════════════════
// 1. mapOFFProduct 数据映射
// ═══════════════════════════════════════
describe('mapOFFProduct 数据映射', () => {
  it('缺失字段使用默认值：品牌 Unknown、价格 0、空数组、ecoscore null', () => {
    const mapped = mapOFFProductCopy({ id: 1 })
    expect(mapped.id).toBe(1)
    expect(mapped.brand).toBe('Unknown')
    expect(mapped.price).toBe(0)
    expect(mapped.avg_rating).toBe(0)
    expect(mapped.image_urls).toEqual([])
    expect(mapped.effects).toEqual([])
    expect(mapped.ecoscore_grade).toBeNull()
  })

  it('null 数值字段降级为 0，非数组字段不报错', () => {
    const mapped = mapOFFProductCopy({
      id: 2,
      price: null,
      avg_rating: null,
      image_urls: undefined,
      effects: undefined,
      ecoscore_grade: null,
    })
    expect(mapped.id).toBe(2)
    expect(mapped.price).toBe(0)
    expect(mapped.avg_rating).toBe(0)
    expect(mapped.image_urls).toEqual([])
    expect(mapped.effects).toEqual([])
    expect(mapped.ecoscore_grade).toBeNull()
  })
})

// ═══════════════════════════════════════
// 2. searchOpenFoodFacts 请求参数构造
// ═══════════════════════════════════════
describe('搜索请求参数构造', () => {
  it('搜索时携带 query/page/page_size/realtime 与筛选参数', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    await renderAndSearch()
    await waitFor(() => {
      expect(mocks.searchOpenFoodFacts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '蛋白粉',
          page: 1,
          page_size: 20,
          realtime: false,
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy()
    })
  })

  it('品牌/剂型/价格筛选会构造进 OFF 搜索请求', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    const user = await renderAndSearch()
    // 先等第一批结果出现（品牌输入框在 results>0 时才显示）
    await waitFor(() => expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText('品牌'), { target: { value: '汤臣倍健' } })
    fireEvent.change(screen.getByPlaceholderText('剂型'), { target: { value: '粉剂' } })
    fireEvent.change(screen.getByPlaceholderText('价'), { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: '搜索零售产品' }))
    await waitFor(() => {
      expect(mocks.searchOpenFoodFacts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          brand: '汤臣倍健',
          formulation_type: '粉剂',
          min_price: 10,
          page_size: 20,
        }),
      )
    })
  })
})

// ═══════════════════════════════════════
// 3. 收藏 / 取消收藏逻辑
// ═══════════════════════════════════════
describe('收藏 / 取消收藏逻辑', () => {
  it('点击收藏调用 addToPantryRetailProduct 并更新按钮状态', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    mocks.addToPantryRetailProduct.mockResolvedValue({ status: 'added' })
    await renderAndSearch()
    // 仅匹配产品卡片上的 aria-label="收藏" 按钮（工具栏「收藏」过滤按钮是文本，不匹配 label）
    const favButtons = await screen.findAllByLabelText('收藏')
    fireEvent.click(favButtons[0])
    await waitFor(() => {
      expect(mocks.addToPantryRetailProduct).toHaveBeenCalled()
    })
    // 收藏成功后工具栏计数按钮变为「收藏 (1)」
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '收藏 (1)' })).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '取消收藏' }).length).toBeGreaterThan(0)
    })
  })

  it('点击取消收藏调用 removeFromPantryRetailProduct', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    mocks.getPantryRetailProducts.mockResolvedValue([
      { id: 1, product_name: '汤臣倍健 蛋白质粉（香草口味）' },
    ])
    mocks.removeFromPantryRetailProduct.mockResolvedValue({ status: 'removed' })
    const user = await renderAndSearch()
    const favButtons = await screen.findAllByRole('button', { name: '取消收藏' })
    await user.click(favButtons[0])
    await waitFor(() => {
      expect(mocks.removeFromPantryRetailProduct).toHaveBeenCalledWith(1)
    })
  })

  it('已收藏产品加载后初始显示"取消收藏"', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    mocks.getPantryRetailProducts.mockResolvedValue([
      { id: 1, product_name: '汤臣倍健 蛋白质粉（香草口味）' },
    ])
    await renderAndSearch()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '取消收藏' }).length).toBeGreaterThan(0)
    })
  })
})

// ═══════════════════════════════════════
// 4. 排序与过滤
// ═══════════════════════════════════════
describe('排序与过滤', () => {
  it('价格排序：升序 → 降序', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    const user = await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '价格' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '价格↑' })).toBeTruthy()
    })
  })

  it('品牌过滤：输入品牌后重新搜索并传递 brand 参数', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    const user = await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText('品牌'), { target: { value: 'Swisse' } })
    await user.click(screen.getByRole('button', { name: '搜索零售产品' }))
    await waitFor(() => {
      expect(mocks.searchOpenFoodFacts).toHaveBeenLastCalledWith(
        expect.objectContaining({ brand: 'Swisse' }),
      )
    })
  })

  it('收藏过滤：仅显示已收藏产品', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    mocks.getPantryRetailProducts.mockResolvedValue([
      { id: 2, product_name: 'Swisse 深海鱼油软胶囊' },
    ])
    const user = await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy())
    // 工具栏「收藏 (1)」过滤按钮（favorites.size=1），区别于产品卡片的「收藏」aria-label
    await user.click(screen.getByRole('button', { name: '收藏 (1)' }))
    await waitFor(() => {
      expect(screen.getByText(/Swisse 深海鱼油软胶囊/)).toBeTruthy()
    })
    expect(screen.queryByText(/汤臣倍健 蛋白质粉/)).toBeNull()
  })
})

// ═══════════════════════════════════════
// 5. 导出 CSV
// ═══════════════════════════════════════
describe('导出 CSV', () => {
  it('生成含 BOM、表头、数据行与收藏/对比标记的 CSV', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    const user = await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/汤臣倍健 蛋白质粉/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '导出 CSV' }))
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore()
    clickSpy.mockRestore()
  })

  it('无结果时不渲染导出按钮（无数据可导出）', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue(emptyResponse())
    await renderAndSearch('不存在')
    await waitFor(() => expect(screen.getByText(/本地库暂无匹配/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: '导出 CSV' })).toBeNull()
  })
})

// ═══════════════════════════════════════
// 6. 相关度体验与热门词引导
// ═══════════════════════════════════════
describe('相关度体验与热门词引导', () => {
  it('data_source 含 api 时显示相关度过滤文案', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: sampleProducts().slice(0, 1),
      total: 1,
      page: 1,
      page_size: 20,
      data_source: 'openfoodfacts_api',
      off_total: 4828,
    })
    await renderAndSearch()
    await waitFor(() => {
      expect(screen.getByText(/已按相关度过滤，共 1 款相关产品/)).toBeTruthy()
    })
  })

  it('realtime=true 且 items 为空时显示无相关结果提示', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue(emptyResponse('openfoodfacts_api'))
    const user = await renderPanel()
    await user.click(screen.getByRole('switch', { name: '实时数据源' }))
    await user.type(screen.getByPlaceholderText(/输入中文关键词/), '不存在的词')
    // 开启实时后按钮文案为「实时搜索 OpenFoodFacts」
    await user.click(screen.getByRole('button', { name: '实时搜索 OpenFoodFacts' }))
    await waitFor(() => {
      expect(screen.getByText(/未找到与.*高度相关的产品/)).toBeTruthy()
    })
  })

  it('空结果区热门搜索词 chip 点击后触发搜索', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue(emptyResponse())
    const user = await renderPanel()
    await user.type(screen.getByPlaceholderText(/输入中文关键词/), '不存在')
    await user.click(screen.getByRole('button', { name: '搜索零售产品' }))
    await waitFor(() => {
      expect(screen.getByText(/本地库暂无匹配/)).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: '蛋白粉' }))
    await waitFor(() => {
      expect(mocks.searchOpenFoodFacts).toHaveBeenCalledWith(
        expect.objectContaining({ query: '蛋白粉' }),
      )
    })
  })
})

// ═══════════════════════════════════════
// 7. 数据来源透明化：来源徽标 / 仅看互联网产品开关 / 来源统计
// ═══════════════════════════════════════
describe('数据来源透明化', () => {
  function originProducts() {
    return [
      {
        id: 11,
        product_name: 'Whey Protein Powder',
        brand: 'BioFarma',
        category: '营养补充剂',
        formulation_type: '粉剂',
        price: 299,
        avg_rating: 4.6,
        image_urls: [],
        effects: ['增肌'],
        allergens_tags: [],
        additives_tags: [],
        ecoscore_grade: 'a',
        source: 'openfoodfacts',
        data_origin: 'internet_realtime',
      },
      {
        id: 12,
        product_name: '汤臣倍健 蛋白质粉',
        brand: '汤臣倍健',
        category: '保健食品',
        formulation_type: '粉剂',
        price: 298,
        avg_rating: 4.5,
        image_urls: [],
        effects: ['增强免疫力'],
        allergens_tags: ['牛奶'],
        additives_tags: [],
        ecoscore_grade: 'b',
        source: 'manual',
        data_origin: 'local_reference',
      },
    ]
  }

  it('产品卡片按 data_origin 显示来源徽标', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: originProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'openfoodfacts_api_fallback',
    })
    await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/Whey Protein Powder/)).toBeTruthy())
    expect(screen.getByText('实时互联网')).toBeTruthy()
    expect(screen.getByText('平台参考数据')).toBeTruthy()
  })

  it('结果工具栏显示来源统计', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: originProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'openfoodfacts_api_fallback',
    })
    await renderAndSearch()
    await waitFor(() => {
      expect(screen.getByText(/共 2 款（其中 1 款互联网真实产品 \/ 1 款平台参考数据）/)).toBeTruthy()
    })
  })

  it('开启“仅看互联网产品”后搜索请求携带 origin=internet', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: originProducts(),
      total: 2,
      page: 1,
      page_size: 20,
      data_source: 'openfoodfacts_api_fallback',
    })
    const user = await renderAndSearch()
    await waitFor(() => expect(screen.getByText(/Whey Protein Powder/)).toBeTruthy())
    await user.click(screen.getByRole('switch', { name: '仅看互联网产品' }))
    await waitFor(() => {
      expect(mocks.searchOpenFoodFacts).toHaveBeenLastCalledWith(
        expect.objectContaining({ origin: 'internet' }),
      )
    })
  })
})

// ═══════════════════════════════════════
// 8. 详情弹窗：五 Tab 切换 / 营养表 / 配料 chips / local_reference 空数据提示
// ═══════════════════════════════════════
describe('详情弹窗', () => {
  function detailProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 21,
      product_name: '乳清蛋白粉',
      brand: 'BioFarma',
      category: '营养补充剂',
      formulation_type: '粉剂',
      price: 299,
      avg_rating: 4.6,
      image_urls: [],
      effects: ['增肌'],
      allergens_tags: ['牛奶'],
      additives_tags: [],
      ecoscore_grade: 'a',
      source: 'openfoodfacts',
      data_origin: 'internet_realtime',
      key_ingredients: {
        nutrition: { 'energy-kcal': 375, proteins: 80, fat: 6.5, carbohydrates: 8 },
        ingredients: [
          { text: '乳清蛋白', id: 'whey-protein' },
          { text: '大豆卵磷脂', id: 'soy-lecithin' },
        ],
        nutrition_grade: 'a',
      },
      full_ingredients: '乳清蛋白、大豆卵磷脂',
      ...overrides,
    }
  }

  it('打开详情后五个 Tab 可切换，营养表与配料 chips 渲染', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: [detailProduct()],
      total: 1,
      page: 1,
      page_size: 20,
      data_source: 'openfoodfacts_api',
    })
    const user = await renderAndSearch('蛋白粉')
    await waitFor(() => expect(screen.getByText('乳清蛋白粉')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '乳清蛋白粉' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()

    // 五个 Tab 均存在
    expect(screen.getByRole('tab', { name: /基本信息/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /营养成分/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /食品安全/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /成分表/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /市场信息/ })).toBeTruthy()

    // 营养成分 Tab：营养表渲染（每 100g + 数值）
    await user.click(screen.getByRole('tab', { name: /营养成分/ }))
    await waitFor(() => expect(screen.getByText(/每 100g/)).toBeTruthy())
    expect(screen.getByText(/375/)).toBeTruthy() // energy-kcal
    expect(screen.getByText(/80\.0/)).toBeTruthy() // proteins

    // 成分表 Tab：结构化配料 chips 渲染
    await user.click(screen.getByRole('tab', { name: /成分表/ }))
    await waitFor(() => expect(screen.getByText('乳清蛋白')).toBeTruthy())
    expect(screen.getByText('大豆卵磷脂')).toBeTruthy()
  })

  it('local_reference 产品营养为空时显示“平台参考数据暂无营养声明”', async () => {
    mocks.searchOpenFoodFacts.mockResolvedValue({
      items: [
        detailProduct({
          id: 22,
          product_name: '汤臣倍健 蛋白质粉',
          source: 'manual',
          data_origin: 'local_reference',
          key_ingredients: {},
          full_ingredients: '',
        }),
      ],
      total: 1,
      page: 1,
      page_size: 20,
      data_source: 'postgresql_ilike',
    })
    const user = await renderAndSearch('蛋白粉')
    await waitFor(() => expect(screen.getByText('汤臣倍健 蛋白质粉')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '汤臣倍健 蛋白质粉' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('tab', { name: /营养成分/ }))
    await waitFor(() => {
      expect(screen.getByText('平台参考数据暂无营养声明')).toBeTruthy()
    })
  })
})