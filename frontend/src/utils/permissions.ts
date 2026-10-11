import React from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth'

export enum FormulaPermission {
  VIEW = 'formula:view',
  CREATE = 'formula:create',
  EDIT = 'formula:edit',
  DELETE = 'formula:delete',
  EXPORT = 'formula:export',
  AUDIT = 'formula:audit',
  MANAGE = 'formula:manage',
  IMPORT = 'formula:import',
}

export type RolePermissionMap = Record<string, FormulaPermission[]>;

export class PermissionDeniedError extends Error {
  constructor(
    public readonly permission: FormulaPermission,
    message?: string,
  ) {
    super(message ?? `权限不足: 需要权限 ${permission}`)
    this.name = 'PermissionDeniedError'
  }
}

export const ROLE_PERMISSIONS: RolePermissionMap = {
  GUEST: [FormulaPermission.VIEW],
  VIEWER: [FormulaPermission.VIEW],
  RESEARCHER: [
    FormulaPermission.VIEW,
    FormulaPermission.CREATE,
    FormulaPermission.EDIT,
    FormulaPermission.EXPORT,
  ],
  FORMULATOR: [
    FormulaPermission.VIEW,
    FormulaPermission.CREATE,
    FormulaPermission.EDIT,
    FormulaPermission.EXPORT,
  ],
  REVIEWER: [
    FormulaPermission.VIEW,
    FormulaPermission.CREATE,
    FormulaPermission.EDIT,
    FormulaPermission.EXPORT,
    FormulaPermission.AUDIT,
  ],
  ANALYST: [
    FormulaPermission.VIEW,
    FormulaPermission.CREATE,
    FormulaPermission.EDIT,
    FormulaPermission.EXPORT,
    FormulaPermission.AUDIT,
  ],
  ADMIN: [
    FormulaPermission.VIEW,
    FormulaPermission.CREATE,
    FormulaPermission.EDIT,
    FormulaPermission.DELETE,
    FormulaPermission.EXPORT,
    FormulaPermission.IMPORT,
    FormulaPermission.AUDIT,
    FormulaPermission.MANAGE,
  ],
  MANAGER: Object.values(FormulaPermission),
}

function getCurrentUserRole(): string | null {
  const role = useAuthStore.getState().user?.role ?? null
  return role ? role.toUpperCase() : null
}

export function hasPermission(
  userRole: string | null,
  requiredPermission: FormulaPermission,
): boolean {
  if (!userRole) return false
  const normalizedRole = userRole.toUpperCase()
  const permissions = ROLE_PERMISSIONS[normalizedRole]
  if (!permissions) return false
  return permissions.includes(requiredPermission)
}

export function hasAnyPermission(
  userRole: string | null,
  permissions: FormulaPermission[],
): boolean {
  if (!userRole || permissions.length === 0) return false
  const normalizedRole = userRole.toUpperCase()
  const userPermissions = ROLE_PERMISSIONS[normalizedRole]
  if (!userPermissions) return false
  return permissions.some((p) => userPermissions.includes(p))
}

export function requirePermission(
  userRole: string | null,
  permission: FormulaPermission,
  fallback?: ReactNode,
): { allowed: boolean; fallback?: ReactNode } {
  const allowed = hasPermission(userRole, permission)
  return { allowed, fallback: allowed ? undefined : fallback }
}

interface PermissionGateProps {
  permission: FormulaPermission | FormulaPermission[]
  userRole?: string | null
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({
  permission,
  userRole,
  children,
  fallback = null,
}: PermissionGateProps): React.ReactElement | null {
  const effectiveRole = userRole ?? getCurrentUserRole()
  const permissions = Array.isArray(permission) ? permission : [permission]
  const allowed = hasAnyPermission(effectiveRole, permissions)
  if (!allowed) {
    return React.createElement(React.Fragment, null, fallback)
  }
  return React.createElement(React.Fragment, null, children)
}

export function usePermission() {
  const user = useAuthStore((s) => s.user)
  const rawRole = user?.role ?? null
  const userRole = rawRole ? rawRole.toUpperCase() : null
  const permissions = (userRole ? ROLE_PERMISSIONS[userRole] ?? [] : [])

  const check = (permission: FormulaPermission): boolean => {
    return hasPermission(userRole, permission)
  }

  const checkAny = (perms: FormulaPermission[]): boolean => {
    return hasAnyPermission(userRole, perms)
  }

  return {
    userRole,
    permissions,
    has: check,
    hasAny: checkAny,
  } as const
}

export async function withPermissionCheck<T>(
  permission: FormulaPermission,
  apiCall: () => Promise<T>,
): Promise<T> {
  const role = getCurrentUserRole()
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(permission)
  }
  return apiCall()
}
