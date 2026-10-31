/**
 * 「市售产品」API 客户端函数单测（searchNew.ts 真实导出函数）
 *
 * 通过 mock 底层 @/api/database 与 @/api/client，直接验证：
 * - searchOpenFoodFacts 请求参数构造与端点
 * - addToPantryRetailProduct / removeFromPantryRetailProduct 端点
 * - getPantryRetailProducts 端点与返回解析
 *
 * 与 retail-product.test.tsx（组件 UI 测试）分离，避免 vi.importActual
 * 与组件级 vi.mock('@/api/searchNew') 相互干扰。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  searchOpenFoodFacts,
  addToPantryRetailProduct,
  removeFromPantryRetailProduct,
  getPantryRetailProducts,
} from '@/api/searchNew'

const mocks = vi.hoisted(() => {
  const databasePost = vi.fn()
  const databaseGet = vi.fn()
  const databaseDelete = vi.fn()
  const databaseGeneric = vi.fn()
  const databaseApi = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      if (prop === 'post') return databasePost
      if (prop === 'get') return databaseGet
      if (prop === 'delete') return databaseDelete
      return databaseGeneric
    },
  })
  return {
    databaseApi,
    databasePost,
    databaseGet,
    databaseDelete,
    databaseGeneric,
    clientDelete: vi.fn(),
  }
})

vi.mock('@/api/database', () => ({
  databaseApi: mocks.databaseApi,
}))

vi.mock('@/api/client', () => ({
  default: {
    delete: mocks.clientDelete,
    post: mocks.databasePost,
    get: mocks.databaseGet,
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.databasePost.mockResolvedValue({ data: {} })
  mocks.databaseGet.mockResolvedValue({ data: { items: [], total: 0 } })
  mocks.clientDelete.mockResolvedValue({ data: {} })
})

describe('searchOpenFoodFacts', () => {
  it('POST 到 /databases/openfoodfacts/search 并原样传递请求体', async () => {
    mocks.databasePost.mockResolvedValue({
      data: { items: [], total: 0, page: 2, page_size: 20, data_source: 'test' },
    })
    const resp = await searchOpenFoodFacts({
      query: '胶原蛋白',
      page: 2,
      page_size: 20,
      realtime: true,
      brand: '汤臣倍健',
      min_price: 10,
      max_price: 200,
      nova_group: 1,
      min_completeness: 0.5,
      sort_by: 'quality',
    })
    expect(mocks.databasePost).toHaveBeenCalledWith(
      '/databases/openfoodfacts/search',
      expect.objectContaining({
        query: '胶原蛋白',
        page: 2,
        page_size: 20,
        realtime: true,
        brand: '汤臣倍健',
        min_price: 10,
        max_price: 200,
        nova_group: 1,
        min_completeness: 0.5,
        sort_by: 'quality',
      }),
      { timeout: 60000 },
    )
    expect(resp.items).toEqual([])
    expect(resp.data_source).toBe('test')
  })

  it('支持省略可选筛选参数', async () => {
    mocks.databasePost.mockResolvedValue({
      data: { items: [], total: 0, page: 1, page_size: 20, data_source: 'test' },
    })
    await searchOpenFoodFacts({ query: '蛋白' })
    expect(mocks.databasePost).toHaveBeenCalledWith(
      '/databases/openfoodfacts/search',
      { query: '蛋白' },
      { timeout: 60000 },
    )
  })

  it('支持 origin 来源过滤参数', async () => {
    mocks.databasePost.mockResolvedValue({
      data: { items: [], total: 0, page: 1, page_size: 20, data_source: 'test' },
    })
    await searchOpenFoodFacts({ query: '蛋白粉', origin: 'internet' })
    expect(mocks.databasePost).toHaveBeenCalledWith(
      '/databases/openfoodfacts/search',
      expect.objectContaining({ query: '蛋白粉', origin: 'internet' }),
      { timeout: 60000 },
    )
  })

  it('拦截器返回 data:null（请求中止/超时）时抛出友好网络错误，而非“搜索请求失败”', async () => {
    // client.ts 响应拦截器对 ERR_ABORTED / canceled 返回 { data: null, status: 0 }，
    // databaseApi.post 解包后为 null；searchOpenFoodFacts 应转换为可读网络错误。
    mocks.databasePost.mockResolvedValue(null)
    await expect(searchOpenFoodFacts({ query: '胶原蛋白' })).rejects.toThrow(
      '网络请求失败（超时/连接中断），请重试',
    )
  })

  it('拦截器返回 { data: null, status: 0 } 时同样抛出友好网络错误', async () => {
    mocks.databasePost.mockResolvedValue({ data: null, status: 0 })
    await expect(searchOpenFoodFacts({ query: '胶原蛋白' })).rejects.toThrow(
      '网络请求失败（超时/连接中断），请重试',
    )
  })
})

describe('pantry API 函数', () => {
  it('addToPantryRetailProduct 使用 POST /databases/pantry/retail-products/{id}', async () => {
    mocks.databasePost.mockResolvedValue({ data: { status: 'added', product_id: 123 } })
    const result = await addToPantryRetailProduct(123)
    expect(mocks.databasePost).toHaveBeenCalledWith('/databases/pantry/retail-products/123')
    expect(result).toEqual({ status: 'added', product_id: 123 })
  })

  it('removeFromPantryRetailProduct 使用 DELETE /databases/pantry/retail-products/{id}', async () => {
    mocks.clientDelete.mockResolvedValue({ data: { status: 'removed', product_id: 123 } })
    const result = await removeFromPantryRetailProduct(123)
    expect(mocks.clientDelete).toHaveBeenCalledWith('/databases/pantry/retail-products/123')
    expect(result).toEqual({ status: 'removed', product_id: 123 })
  })

  it('getPantryRetailProducts 使用 GET /databases/pantry 并解析 items', async () => {
    mocks.databaseGet.mockResolvedValue({
      data: {
        items: [{ id: 123, product_name: '胶原蛋白肽口服液' }],
        total: 1,
      },
    })
    const items = await getPantryRetailProducts()
    expect(mocks.databaseGet).toHaveBeenCalledWith('/databases/pantry', {
      params: { item_type: 'retail_product' },
    })
    expect(items).toEqual([{ id: 123, product_name: '胶原蛋白肽口服液' }])
  })
})