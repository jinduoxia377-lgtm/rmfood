/**
 * Mock Data Provider
 *
 * 集中管理所有的模拟数据和 Mock 回退逻辑。
 * 在生产构建中通过 tree-shaking 消除未使用的代码。
 *
 * 支持：
 * - 登录/用户 Mock
 * - 配方 CRUD Mock
 * - AI 生成 Mock
 * - 后端不可用时的优雅降级
 */

import type { Token, User } from '@/types'
import { UserRole } from '@/types'
import { envConfig } from '@/config/env'

// ==================== Mock 数据 ====================

export const mockToken: Token = {
  accessToken: 'mock_access_token_123456',
  refreshToken: 'mock_refresh_token_123456',
  tokenType: 'Bearer',
  expiresIn: 3600,
  expiresAt: new Date(Date.now() + 3600 * 1000),
}

export const mockUser: User = {
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

/**
 * 检查是否应该使用模拟数据
 * 在后端不可用（502/503/504/500）或特定 422 时触发
 */
export const shouldUseMockData = (error: any): boolean => {
  if (!error.response) return true
  const status = error.response.status
  if (status === 502 || status === 503 || status === 504) return true
  if (status === 500) return true
  if (status === 422) {
    const urlPath = error.config?.url?.replace(envConfig.api.baseUrl || 'http://localhost:8000', '') || ''
    if (urlPath.includes('/formulas/statistics') || urlPath.includes('/formulas/logs')) return true
  }
  return false
}

/**
 * 生成符合 Axios 响应格式的 Mock 响应对象
 */
export const createMockResponse = (original: any, data: any) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: original,
})

/**
 * 根据 URL 路径和请求方法生成对应的 Mock 响应
 */
export function getMockResponse(error: any, urlPath: string) {
  // 登录请求
  if (urlPath.includes('/auth/login') || urlPath.includes('/auth/register')) {
    if (mockToken.accessToken) {
      localStorage.setItem('access_token', mockToken.accessToken)
    }
    if (mockToken.refreshToken) {
      localStorage.setItem('refresh_token', mockToken.refreshToken)
    }
    return createMockResponse(error, mockToken)
  }

  // 获取用户信息
  if (urlPath.includes('/auth/me')) {
    return createMockResponse(error, mockUser)
  }

  // 用户相关
  if (urlPath.includes('/users')) {
    return createMockResponse(error, {
      data: [mockUser],
      total: 1,
      page: 1,
      page_size: 10,
    })
  }

  // 配方相关
  if (urlPath.includes('/formulas')) {
    if (urlPath.includes('/statistics')) {
      return createMockResponse(error, {
        total: 0,
        approved: 0,
        pending: 0,
        draft: 0,
        archived: 0,
        this_month: 0,
      })
    }
    if (urlPath.includes('/logs')) {
      return createMockResponse(error, {
        data: [],
        total: 0,
        page: 1,
        page_size: 20,
      })
    }
    return createMockResponse(error, {
      data: [],
      total: 0,
      page: 1,
      page_size: 10,
    })
  }

  // AI 生成请求
  if (urlPath.includes('/ai/generate')) {
    return createMockResponse(error, {
      candidates: getMockFormulaCandidates(),
      total: 3,
      generator: 'rule_engine',
    })
  }

  // 默认返回空数据
  return createMockResponse(error, {})
}

/**
 * 生成模拟的配方候选数据（用于 AI 生成演示）
 */
function getMockFormulaCandidates() {
  const now = Date.now()
  return [
    {
      id: `auto_0_${now}`,
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
      id: `auto_1_${now}`,
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
      id: `auto_2_${now}`,
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
}

export default {
  mockToken,
  mockUser,
  shouldUseMockData,
  createMockResponse,
  getMockResponse,
}
