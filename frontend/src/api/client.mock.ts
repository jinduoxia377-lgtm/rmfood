/**
 * API Mock 数据（仅开发环境使用）
 *
 * 生产环境严禁导入此文件。
 * 通过 import.meta.env.DEV 条件判断确保不会被打包进生产构建。
 */
import type { Token, User } from '@/types'
import { UserRole } from '@/types'

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
 * 生成模拟响应
 */
export const createMockResponse = (original: any, data: any) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: original,
})

/**
 * 根据 URL 路径返回对应的 mock 数据
 */
export const getMockData = (urlPath: string, original: any) => {
  if (urlPath.includes('/auth/login')) {
    return createMockResponse(original, mockToken)
  }

  if (urlPath.includes('/auth/me')) {
    return createMockResponse(original, mockUser)
  }

  if (urlPath.includes('/users')) {
    return createMockResponse(original, {
      data: [mockUser],
      total: 1,
      page: 1,
      page_size: 10,
    })
  }

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

  if (urlPath.includes('/ai/generate')) {
    const mockCandidates = [
      {
        id: 'mock_' + Date.now(),
        name: '配方示例（Mock）',
        formula_name: '配方示例',
        ingredients: [
          { name: '黄芪', dosage: '10g', unit: 'g' },
          { name: '枸杞子', dosage: '5g', unit: 'g' },
        ],
        score: 0.85,
        effects: ['增强免疫'],
        generated_by: 'mock',
        generated_at: new Date().toISOString(),
      },
    ]
    return createMockResponse(original, {
      candidates: mockCandidates,
      total: mockCandidates.length,
      generator: 'mock',
    })
  }

  return createMockResponse(original, {})
}
