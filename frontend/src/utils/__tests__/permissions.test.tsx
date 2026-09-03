/**
 * permissions 单元测试
 *
 * 测试覆盖范围：
 * - hasPermission: 权限检查函数（5个测试用例）
 * - hasAnyPermission: 任一权限检查（3个测试用例）
 * - PermissionGate 组件（4个测试用例）
 * - ROLE_PERMISSIONS 映射表验证（3个测试用例）
 * - requirePermission 函数（2个测试用例）
 * - PermissionDeniedError 类（2个测试用例）
 *
 * 目标代码覆盖率 ≥ 95%
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'

// 定义 UserRole 常量（与源码中的枚举值一致）
const VIEWER = 'VIEWER'
const RESEARCHER = 'RESEARCHER'
const ANALYST = 'ANALYST'
const ADMIN = 'ADMIN'
const MANAGER = 'MANAGER'

// Mock useAuthStore
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    getState: () => ({
      user: null,
    }),
  })),
}))

describe('permissions - 权限工具函数库', () => {
  let hasPermission: (role: string | null, perm: string) => boolean
  let hasAnyPermission: (role: string | null, perms: string[]) => boolean
  let requirePermission: (role: string | null, permission: string, fallback?: ReactNode) => { allowed: boolean; fallback?: ReactNode }
  let PermissionGate: any
  let ROLE_PERMISSIONS: any
  let PermissionDeniedError: any
  let FormulaPermission: any

  beforeAll(async () => {
    const module = await import('@/utils/permissions')
    hasPermission = module.hasPermission
    hasAnyPermission = module.hasAnyPermission
    requirePermission = module.requirePermission
    PermissionGate = module.PermissionGate
    ROLE_PERMISSIONS = module.ROLE_PERMISSIONS
    PermissionDeniedError = module.PermissionDeniedError
    FormulaPermission = module.FormulaPermission
  })

  // ============================================================
  // 1. hasPermission 测试
  // ============================================================
  describe('hasPermission - 单权限检查', () => {
    it('管理员应有所有权限', () => {
      expect(hasPermission(ADMIN, FormulaPermission.VIEW)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.CREATE)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.EDIT)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.DELETE)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.EXPORT)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.IMPORT)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.AUDIT)).toBe(true)
      expect(hasPermission(ADMIN, FormulaPermission.MANAGE)).toBe(true)
    })

    it('访客只能查看', () => {
      expect(hasPermission(VIEWER, FormulaPermission.VIEW)).toBe(true)
      expect(hasPermission(VIEWER, FormulaPermission.CREATE)).toBe(false)
      expect(hasPermission(VIEWER, FormulaPermission.EDIT)).toBe(false)
      expect(hasPermission(VIEWER, FormulaPermission.DELETE)).toBe(false)
      expect(hasPermission(VIEWER, FormulaPermission.EXPORT)).toBe(false)
    })

    it('研究员可以创建编辑但不能删除', () => {
      expect(hasPermission(RESEARCHER, FormulaPermission.VIEW)).toBe(true)
      expect(hasPermission(RESEARCHER, FormulaPermission.CREATE)).toBe(true)
      expect(hasPermission(RESEARCHER, FormulaPermission.EDIT)).toBe(true)
      expect(hasPermission(RESEARCHER, FormulaPermission.DELETE)).toBe(false)
      expect(hasPermission(RESEARCHER, FormulaPermission.EXPORT)).toBe(true)
      expect(hasPermission(RESEARCHER, FormulaPermission.MANAGE)).toBe(false)
    })

    it('null 角色应无任何权限', () => {
      expect(hasPermission(null, FormulaPermission.VIEW)).toBe(false)
      expect(hasPermission(null, FormulaPermission.CREATE)).toBe(false)
      expect(hasPermission(null, FormulaPermission.DELETE)).toBe(false)
    })

    it('未知角色应无任何权限', () => {
      expect(hasPermission('UNKNOWN_ROLE', FormulaPermission.VIEW)).toBe(false)
      expect(hasPermission('GUEST', FormulaPermission.CREATE)).toBe(false)
    })
  })

  // ============================================================
  // 2. hasAnyPermission 测试
  // ============================================================
  describe('hasAnyPermission - 任一权限检查', () => {
    it('拥有任一权限即返回 true', () => {
      expect(hasAnyPermission(VIEWER, [FormulaPermission.VIEW])).toBe(true)
      expect(
        hasAnyPermission(VIEWER, [FormulaPermission.CREATE, FormulaPermission.VIEW])
      ).toBe(true)
    })

    it('完全不匹配返回 false', () => {
      expect(
        hasAnyPermission(VIEWER, [FormulaPermission.CREATE, FormulaPermission.DELETE])
      ).toBe(false)
    })

    it('空权限列表应返回 false', () => {
      expect(hasAnyPermission(ADMIN, [])).toBe(false)
      expect(hasAnyPermission(MANAGER, [])).toBe(false)
    })

    it('null 角色应返回 false', () => {
      expect(hasAnyPermission(null, [FormulaPermission.VIEW])).toBe(false)
    })

    it('管理员应对任意权限组合返回 true', () => {
      const allPermissions = Object.values(FormulaPermission)
      expect(hasAnyPermission(ADMIN, allPermissions)).toBe(true)
    })
  })

  // ============================================================
  // 3. requirePermission 测试
  // ============================================================
  describe('requirePermission - 权限要求函数', () => {
    it('有权限时应返回 allowed=true 且无 fallback', () => {
      const result = requirePermission(ADMIN, FormulaPermission.DELETE)
      expect(result.allowed).toBe(true)
      expect(result.fallback).toBeUndefined()
    })

    it('无权限时应返回 allowed=false 并包含 fallback', () => {
      const fallback = React.createElement('div', null, '无权限提示')
      const result = requirePermission(VIEWER, FormulaPermission.DELETE, fallback)
      expect(result.allowed).toBe(false)
      expect(result.fallback).toBe(fallback)
    })

    it('无权限且未提供 fallback 时 fallback 应为 undefined', () => {
      const result = requirePermission(VIEWER, FormulaPermission.DELETE)
      expect(result.allowed).toBe(false)
      expect(result.fallback).toBeUndefined()
    })
  })

  // ============================================================
  // 4. PermissionGate 组件测试
  // ============================================================
  describe('PermissionGate - 权限门控组件', () => {
    it('有权限时应渲染 children', () => {
      const { container } = render(
        React.createElement(PermissionGate, {
          permission: FormulaPermission.VIEW,
          userRole: ADMIN,
          children: React.createElement('div', null, '受保护内容'),
        })
      )

      expect(container.textContent).toContain('受保护内容')
    })

    it('无权限时应渲染 fallback', () => {
      const { container } = render(
        React.createElement(PermissionGate, {
          permission: FormulaPermission.DELETE,
          userRole: VIEWER,
          fallback: React.createElement('div', null, '无权限提示'),
          children: React.createElement('div', null, '受保护内容'),
        })
      )

      expect(container.textContent).toContain('无权限提示')
      expect(container.textContent).not.toContain('受保护内容')
    })

    it('无权限且无 fallback 应不渲染任何内容', () => {
      const { container } = render(
        React.createElement(PermissionGate, {
          permission: FormulaPermission.DELETE,
          userRole: VIEWER,
          children: React.createElement('div', null, '受保护内容'),
        })
      )

      expect(container.textContent).toBe('')
    })

    it('传入权限数组（满足任一即可）', () => {
      const { container } = render(
        React.createElement(PermissionGate, {
          permission: [FormulaPermission.CREATE, FormulaPermission.VIEW],
          userRole: VIEWER,
          children: React.createElement('div', null, '可见内容'),
        })
      )

      expect(container.textContent).toContain('可见内容')
    })

    it('传入权限数组（全部不匹配）', () => {
      const { container } = render(
        React.createElement(PermissionGate, {
          permission: [FormulaPermission.DELETE, FormulaPermission.MANAGER],
          userRole: VIEWER,
          fallback: React.createElement('div', null, '无权限'),
          children: React.createElement('div', null, '不可见内容'),
        })
      )

      expect(container.textContent).toContain('无权限')
      expect(container.textContent).not.toContain('不可见内容')
    })
  })

  // ============================================================
  // 5. ROLE_PERMISSIONS 映射表测试
  // ============================================================
  describe('ROLE_PERMISSIONS - 角色权限映射表', () => {
    it('VIEWER 应仅有 VIEW 权限', () => {
      const viewerPermissions = ROLE_PERMISSIONS[VIEWER]
      expect(viewerPermissions).toHaveLength(1)
      expect(viewerPermissions).toContain(FormulaPermission.VIEW)
    })

    it('MANAGER 应包含所有权限', () => {
      const managerPermissions = ROLE_PERMISSIONS[MANAGER]
      const allPermissions = Object.values(FormulaPermission)

      expect(managerPermissions.length).toBe(allPermissions.length)
      allPermissions.forEach((permission) => {
        expect(managerPermissions).toContain(permission)
      })
    })

    it('角色层级正确（VIEWER < RESEARCHER < ANALYST < ADMIN < MANAGER）', () => {
      const viewerPerms = new Set(ROLE_PERMISSIONS[VIEWER])
      const researcherPerms = new Set(ROLE_PERMISSIONS[RESEARCHER])
      const analystPerms = new Set(ROLE_PERMISSIONS[ANALYST])
      const adminPerms = new Set(ROLE_PERMISSIONS[ADMIN])

      for (const perm of viewerPerms) {
        expect(researcherPerms.has(perm)).toBe(true)
      }
      for (const perm of researcherPerms) {
        expect(analystPerms.has(perm)).toBe(true)
      }
      for (const perm of analystPerms) {
        expect(adminPerms.has(perm)).toBe(true)
      }

      expect(analystPerms.size).toBeGreaterThan(researcherPerms.size)
      expect(adminPerms.size).toBeGreaterThan(analystPerms.size)
    })

    it('ANALYST 应比 RESEARCHER 多 AUDIT 权限', () => {
      const researcherPerms = ROLE_PERMISSIONS[RESEARCHER]
      const analystPerms = ROLE_PERMISSIONS[ANALYST]

      expect(researcherPerms).not.toContain(FormulaPermission.AUDIT)
      expect(analystPerms).toContain(FormulaPermission.AUDIT)
    })

    it('ADMIN 应有 DELETE 和 IMPORT 权限但 ANALYST 没有', () => {
      const adminPerms = ROLE_PERMISSIONS[ADMIN]
      const analystPerms = ROLE_PERMISSIONS[ANALYST]

      expect(adminPerms).toContain(FormulaPermission.DELETE)
      expect(adminPerms).toContain(FormulaPermission.IMPORT)
      expect(analystPerms).not.toContain(FormulaPermission.DELETE)
      expect(analystPerms).not.toContain(FormulaPermission.IMPORT)
    })
  })

  // ============================================================
  // 6. PermissionDeniedError 测试
  // ============================================================
  describe('PermissionDeniedError - 权限拒绝错误类', () => {
    it('应创建正确的错误实例', () => {
      const error = new PermissionDeniedError(FormulaPermission.DELETE)
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(PermissionDeniedError)
      expect(error.name).toBe('PermissionDeniedError')
      expect(error.permission).toBe(FormulaPermission.DELETE)
      expect(error.message).toContain('formula:delete')
    })

    it('支持自定义消息', () => {
      const customMessage = '您没有删除配方的权限'
      const error = new PermissionDeniedError(FormulaPermission.DELETE, customMessage)
      expect(error.message).toBe(customMessage)
    })
  })
})
