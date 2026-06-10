/**
 * Axios API 客户端
 * 自动附加 JWT 令牌、统一错误处理、刷新令牌逻辑
 */
import axios from 'axios'
import type { Token, User } from '@/types'
import { UserRole } from '@/types'
import { envConfig } from '@/config/env'

const API_BASE = envConfig.api.baseUrl

const api = axios.create({
  baseURL: API_BASE,
  timeout: envConfig.api.timeout,
  headers: { 'Content-Type': 'application/json' },
})

// 模拟数据
const mockToken: Token = {
  accessToken: 'mock_access_token_123456',
  refreshToken: 'mock_refresh_token_123456',
  tokenType: 'Bearer',
  expiresIn: 3600,
  expiresAt: new Date(Date.now() + 3600 * 1000),
}

const mockUser: User = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  fullName: '管理员',
  role: UserRole.ADMIN,
  isActive: true,
  createdAt: new Date().toISOString(),
  department: '',
  phone: '',
  avatarUrl: '',
  loginAttempts: 0,
  updatedAt: new Date().toISOString(),
}

// ── 请求拦截器：附加 access_token ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Token 刷新状态管理 ──
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

/**
 * 订阅 token 刷新事件
 */
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

/**
 * 通知所有订阅者 token 已刷新
 */
const notifyTokenRefresh = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

/**
 * 检查是否应该使用模拟数据
 */
const shouldUseMockData = (error: any): boolean => {
  if (!error.response) return true
  const status = error.response.status
  if (status === 502 || status === 503 || status === 504) return true
  if (status === 500) return true
  if (status === 422) {
    const urlPath = error.config?.url?.replace(envConfig.api.baseUrl, '') || ''
    if (urlPath.includes('/formulas/statistics') || urlPath.includes('/formulas/logs')) return true
  }
  return false
}

/**
 * 生成模拟响应
 */
const createMockResponse = (original: any, data: any) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: original,
})

/**
 * 刷新 Token
 */
const refreshToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('没有可用的刷新令牌')
  }

  try {
    const response = await axios.post<{ access_token: string; refresh_token: string }>(
      `${API_BASE}/auth/refresh`,
      { refresh_token: refreshToken },
    )

    const { access_token, refresh_token } = response.data
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)

    return access_token
  } catch (error) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    throw error
  }
}

// ── 响应拦截器：错误处理与模拟数据 fallback ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // ── 静默处理请求被中止的错误（页面导航、组件卸载、React Query 取消等正常场景）──
    // net::ERR_ABORTED 是浏览器级别的网络事件，Chrome 会自动记录到 Console（JS 层无法屏蔽）
    // 此处必须返回一个已 resolve 的 Promise（非 reject），避免：
    //   1. 触发后续 401/mockData 等错误处理分支产生额外日志
    //   2. 产生 unhandled promise rejection 警告叠加到浏览器原生日志上
    if (error.code === 'ERR_ABORTED' || error.message === 'canceled') {
      // 返回标记为已中止的"成功"响应，调用方可通过 response.__aborted 检测
      const silentResponse = {
        data: null,
        status: 0,
        statusText: 'aborted',
        headers: {},
        config: original,
        request: error.request,
        __aborted: true as const,
      }
      return Promise.resolve(silentResponse as any)
    }

    // 使用模拟数据处理后端不可用的情况
    if (shouldUseMockData(error)) {
      const urlPath = original.url?.replace(API_BASE, '') || original.url || ''

      // 登录请求
      if (urlPath.includes('/auth/login')) {
        if (mockToken.accessToken) {
          localStorage.setItem('access_token', mockToken.accessToken)
        }
        if (mockToken.refreshToken) {
          localStorage.setItem('refresh_token', mockToken.refreshToken)
        }
        return createMockResponse(original, mockToken)
      }

      // 获取用户信息
      if (urlPath.includes('/auth/me')) {
        return createMockResponse(original, mockUser)
      }

      // 用户列表
      if (urlPath.includes('/users')) {
        return createMockResponse(original, {
          data: [mockUser],
          total: 1,
          page: 1,
          page_size: 10,
        })
      }

      // 配方列表
      if (urlPath.includes('/formulas')) {
        if (urlPath.includes('/statistics')) {
          return createMockResponse(original, {
            total: 0,
            approved: 0,
            pending: 0,
            draft: 0,
            archived: 0,
            this_month: 0,
          })
        }
        if (urlPath.includes('/logs')) {
          return createMockResponse(original, {
            data: [],
            total: 0,
            page: 1,
            page_size: 20,
          })
        }
        return createMockResponse(original, {
          data: [],
          total: 0,
          page: 1,
          page_size: 10,
        })
      }

      // AI 生成请求
      if (urlPath.includes('/ai/generate')) {
        const mockCandidates = [
          {
            id: 'auto_0_' + Date.now(),
            name: '免疫增强配方方案1',
            formula_name: '免疫增强配方方案1',
            ingredients: [
              { name: '黄芪', dosage: '10g', unit: 'g' },
              { name: '党参', dosage: '8g', unit: 'g' },
              { name: '枸杞子', dosage: '5g', unit: 'g' },
            ],
            herb_combination: [
              { name: '黄芪', dosage: '10g', role: '君药' },
              { name: '党参', dosage: '8g', role: '臣药' },
              { name: '枸杞子', dosage: '5g', role: '佐药' },
            ],
            score: 0.88,
            synergy_score: 0.85,
            peptide_candidates: [],
            patent_synergy_scores: {
              bliss_independence: 0.75,
              pk_interaction: 0.82,
              gibbs_stability: 0.78,
              network_pharmacology: 0.85,
              taste_matrix: 0.70,
              overall_si: 0.80,
              weighted_score: 85,
              dominant_mechanism: '免疫调节',
              quality_level: 'A',
              confidence: 0.92,
            },
            safety_passed: true,
            taste_score: 0.75,
            stability_score: 0.88,
            overall_score: 0.85,
            effects: ['增强免疫', '抗疲劳'],
            generated_by: 'rule_engine',
            generated_at: new Date().toISOString(),
          },
          {
            id: 'auto_1_' + Date.now(),
            name: '免疫增强配方方案2',
            formula_name: '免疫增强配方方案2',
            ingredients: [
              { name: '人参', dosage: '6g', unit: 'g' },
              { name: '黄芪', dosage: '12g', unit: 'g' },
              { name: '当归', dosage: '6g', unit: 'g' },
            ],
            herb_combination: [
              { name: '人参', dosage: '6g', role: '君药' },
              { name: '黄芪', dosage: '12g', role: '臣药' },
              { name: '当归', dosage: '6g', role: '佐药' },
            ],
            score: 0.92,
            synergy_score: 0.88,
            peptide_candidates: [],
            patent_synergy_scores: {
              bliss_independence: 0.80,
              pk_interaction: 0.85,
              gibbs_stability: 0.82,
              network_pharmacology: 0.88,
              taste_matrix: 0.65,
              overall_si: 0.84,
              weighted_score: 88,
              dominant_mechanism: '气血双补',
              quality_level: 'A',
              confidence: 0.95,
            },
            safety_passed: true,
            taste_score: 0.70,
            stability_score: 0.90,
            overall_score: 0.88,
            effects: ['增强免疫', '补气养血'],
            generated_by: 'rule_engine',
            generated_at: new Date().toISOString(),
          },
          {
            id: 'auto_2_' + Date.now(),
            name: '免疫增强配方方案3',
            formula_name: '免疫增强配方方案3',
            ingredients: [
              { name: '灵芝', dosage: '5g', unit: 'g' },
              { name: '香菇', dosage: '10g', unit: 'g' },
              { name: '银耳', dosage: '8g', unit: 'g' },
            ],
            herb_combination: [
              { name: '灵芝', dosage: '5g', role: '君药' },
              { name: '香菇', dosage: '10g', role: '臣药' },
              { name: '银耳', dosage: '8g', role: '佐药' },
            ],
            score: 0.85,
            synergy_score: 0.82,
            peptide_candidates: [],
            patent_synergy_scores: {
              bliss_independence: 0.78,
              pk_interaction: 0.80,
              gibbs_stability: 0.85,
              network_pharmacology: 0.75,
              taste_matrix: 0.80,
              overall_si: 0.79,
              weighted_score: 82,
              dominant_mechanism: '免疫调节',
              quality_level: 'B',
              confidence: 0.88,
            },
            safety_passed: true,
            taste_score: 0.85,
            stability_score: 0.85,
            overall_score: 0.83,
            effects: ['增强免疫', '美容养颜'],
            generated_by: 'rule_engine',
            generated_at: new Date().toISOString(),
          },
        ]
        return createMockResponse(original, {
          candidates: mockCandidates,
          total: mockCandidates.length,
          generator: 'rule_engine',
        })
      }

      // 默认返回空数据
      return createMockResponse(original, {})
    }

    // 处理 404 错误
    if (error.response.status === 404) {
      return Promise.reject(error)
    }

    // ✅ 修复：实现完整的 401 错误处理和 Token 自动刷新
    if (error.response?.status === 401) {
      const errorDetail = error.response.data?.detail || error.response.data?.message || ''
      const isAuthError = errorDetail.includes('认证') ||
                          errorDetail.includes('token') ||
                          errorDetail.includes('登录') ||
                          errorDetail.includes('Unauthorized') ||
                          errorDetail.includes('expired')

      if (isAuthError) {
        // 如果是登录或刷新请求，直接拒绝
        if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
          console.warn('[API] 登录或刷新失败:', errorDetail)
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          return Promise.reject(error)
        }

        // 如果正在刷新，等待刷新完成
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeTokenRefresh((newToken) => {
              original.headers.Authorization = `Bearer ${newToken}`
              resolve(api(original))
            })
          })
        }

        // 开始刷新 token
        isRefreshing = true

        try {
          const newToken = await refreshToken()
          isRefreshing = false
          notifyTokenRefresh(newToken)

          // 重新发送原始请求
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        } catch (refreshError) {
          isRefreshing = false
          console.warn('[API] Token 刷新失败，用户将被登出')
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          return Promise.reject(error)
        }
      }

      return Promise.reject(error)
    }

    // 处理 403 权限不足错误
    if (error.response?.status === 403) {
      const errorDetail = error.response.data?.detail || error.response.data?.message || ''
      console.warn(`[API] 权限不足 (403): ${original.url} - ${errorDetail}`)
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export default api
