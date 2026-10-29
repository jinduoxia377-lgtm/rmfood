import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  hasPlan,
  toPlan,
  getUserOrgName,
  usePlan,
  WHITELIST_ORG_NAME,
  WHITELIST_GRANTED_FEATURES,
} from '../plan'
import type { User } from '@/types'

// 可控 user mock，避免真实 authStore 在模块加载时触发 /auth/me 网络请求
const { mockUserRef } = vi.hoisted(() => ({ mockUserRef: { value: null as User | null } }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user: User | null }) => unknown) => selector({ user: mockUserRef.value }),
}))

describe('hasPlan — 白名单组织授予（与后端 plans.py 对齐）', () => {
  it('pro 满足所有专业功能', () => {
    expect(hasPlan('pro', 'ai_formula_generation')).toBe(true)
    expect(hasPlan('pro', 'peptide_analysis')).toBe(true)
    expect(hasPlan('pro', 'advanced_analytics')).toBe(true)
    expect(hasPlan('pro', 'knowledge_graph')).toBe(true)
    expect(hasPlan('pro', 'multi_ecommerce_sync')).toBe(true)
    expect(hasPlan('pro', 'advanced_report_export')).toBe(true)
  })

  it('free 无组织时不授予专业功能（既有 free 行为不破坏）', () => {
    expect(hasPlan('free', 'ai_formula_generation')).toBe(false)
    expect(hasPlan('free', 'ai_formula_generation', undefined)).toBe(false)
    expect(hasPlan('free', 'knowledge_graph')).toBe(false)
    expect(hasPlan('free', 'advanced_report_export')).toBe(false)
  })

  it('free + 莱茵分子白名单组织 → 授予子集功能可用', () => {
    expect(WHITELIST_GRANTED_FEATURES.has('ai_formula_generation')).toBe(true)
    expect(WHITELIST_GRANTED_FEATURES.has('peptide_analysis')).toBe(true)
    expect(WHITELIST_GRANTED_FEATURES.has('advanced_analytics')).toBe(true)
    expect(hasPlan('free', 'ai_formula_generation', WHITELIST_ORG_NAME)).toBe(true)
    expect(hasPlan('free', 'peptide_analysis', WHITELIST_ORG_NAME)).toBe(true)
    expect(hasPlan('free', 'advanced_analytics', WHITELIST_ORG_NAME)).toBe(true)
  })

  it('free + 白名单组织 → 非授予子集功能仍不可用', () => {
    expect(hasPlan('free', 'knowledge_graph', WHITELIST_ORG_NAME)).toBe(false)
    expect(hasPlan('free', 'multi_ecommerce_sync', WHITELIST_ORG_NAME)).toBe(false)
    expect(hasPlan('free', 'advanced_report_export', WHITELIST_ORG_NAME)).toBe(false)
  })

  it('free + 非白名单组织 → 不授予', () => {
    expect(hasPlan('free', 'ai_formula_generation', '其他组织')).toBe(false)
  })

  it('pro + 任意组织仍可用（plan 满足优先于组织授予）', () => {
    expect(hasPlan('pro', 'ai_formula_generation', '其他组织')).toBe(true)
    expect(hasPlan('pro', 'knowledge_graph', WHITELIST_ORG_NAME)).toBe(true)
  })
})

describe('toPlan', () => {
  it('归一化 plan，未知/缺失回退 free', () => {
    expect(toPlan('pro')).toBe('pro')
    expect(toPlan('free')).toBe('free')
    expect(toPlan(undefined)).toBe('free')
    expect(toPlan(null)).toBe('free')
    expect(toPlan('enterprise')).toBe('free')
    expect(toPlan('bogus')).toBe('free')
  })
})

describe('getUserOrgName', () => {
  it('优先 organizationName（规范化字段）', () => {
    expect(getUserOrgName({ organizationName: 'A', orgName: 'B', organization: { name: 'C' } } as User)).toBe('A')
  })

  it('回退 orgName（兼容别名）', () => {
    expect(getUserOrgName({ orgName: 'B', organization: { name: 'C' } } as User)).toBe('B')
  })

  it('回退 organization.name（嵌套对象）', () => {
    expect(getUserOrgName({ organization: { name: 'C' } } as User)).toBe('C')
  })

  it('null/undefined/无组织 → undefined（org-grant 不生效）', () => {
    expect(getUserOrgName(null)).toBeUndefined()
    expect(getUserOrgName(undefined)).toBeUndefined()
    expect(getUserOrgName({} as User)).toBeUndefined()
  })
})

describe('usePlan', () => {
  beforeEach(() => {
    mockUserRef.value = null
  })

  it('白名单组织 free 用户：hasFeature 授予子集 → true，非授予 → false', () => {
    mockUserRef.value = { plan: 'free', organizationName: WHITELIST_ORG_NAME } as User
    const { result } = renderHook(() => usePlan())
    expect(result.current.plan).toBe('free')
    expect(result.current.isPro).toBe(false)
    expect(result.current.orgName).toBe(WHITELIST_ORG_NAME)
    expect(result.current.hasFeature('ai_formula_generation')).toBe(true)
    expect(result.current.hasFeature('peptide_analysis')).toBe(true)
    expect(result.current.hasFeature('advanced_analytics')).toBe(true)
    expect(result.current.hasFeature('knowledge_graph')).toBe(false)
  })

  it('无组织 free 用户：hasFeature → false（org-grant 不生效）', () => {
    mockUserRef.value = { plan: 'free' } as User
    const { result } = renderHook(() => usePlan())
    expect(result.current.hasFeature('ai_formula_generation')).toBe(false)
    expect(result.current.orgName).toBeUndefined()
  })

  it('pro 用户：hasFeature 全部 → true', () => {
    mockUserRef.value = { plan: 'pro' } as User
    const { result } = renderHook(() => usePlan())
    expect(result.current.isPro).toBe(true)
    expect(result.current.hasFeature('advanced_report_export')).toBe(true)
  })
})
