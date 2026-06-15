/**
 * 🔒 P5-4: 前端权限控制与路由守卫
 *
 * 提供:
 * 1. **权限定义** - 基于角色的权限系统 (RBAC)
 * 2. **路由守卫** - 基于权限的访问控制
 * 3. **权限指令** - ngIf / disabled 等权限指令
 * 4. **动态权限** - 基于后端返回的动态权限
 * 5. **审计日志** - 敏感操作记录
 *
 * 使用方式:
 *   import { PermissionGuard, withPermission, usePermissions } from '@/hooks/usePermissions'
 *
 *   // 路由守卫
 *   <Route path="/admin" element={<AdminPage />} loader={withPermission('admin:access')} />
 *
 *   // 权限检查
 *   const { can, canAny } = usePermissions()
 *   {can('formula:write') && <EditButton />}
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

// ════════════════════════════════════════════
// 🔒 P5-4: 权限类型定义
// ════════════════════════════════════════════

export type Permission =
  | 'admin:access'
  | 'admin:users'
  | 'admin:settings'
  | 'formula:read'
  | 'formula:write'
  | 'formula:delete'
  | 'formula:approve'
  | 'experiment:read'
  | 'experiment:write'
  | 'experiment:delete'
  | 'ai:access'
  | 'ai:advanced'
  | 'export:excel'
  | 'export:pdf'
  | 'export:csv'
  | 'user:read'
  | 'user:write'
  | 'organization:manage'
  | string;  // 允许自定义权限

export type Role = 'admin' | 'manager' | 'researcher' | 'viewer' | 'guest';

export interface PermissionContext {
  userId: string;
  role: Role;
  permissions: Permission[];
  organizationId?: string;
  metadata?: Record<string, any>;
}

// 默认角色权限映射
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'admin:access',
    'admin:users',
    'admin:settings',
    'formula:read',
    'formula:write',
    'formula:delete',
    'formula:approve',
    'experiment:read',
    'experiment:write',
    'experiment:delete',
    'ai:access',
    'ai:advanced',
    'export:excel',
    'export:pdf',
    'export:csv',
    'user:read',
    'user:write',
    'organization:manage',
  ],
  manager: [
    'formula:read',
    'formula:write',
    'formula:approve',
    'experiment:read',
    'experiment:write',
    'experiment:delete',
    'ai:access',
    'ai:advanced',
    'export:excel',
    'export:pdf',
    'export:csv',
    'user:read',
    'organization:manage',
  ],
  researcher: [
    'formula:read',
    'formula:write',
    'experiment:read',
    'experiment:write',
    'ai:access',
    'export:excel',
    'export:pdf',
    'export:csv',
  ],
  viewer: [
    'formula:read',
    'experiment:read',
    'ai:access',
    'export:pdf',
  ],
  guest: [
    'formula:read',
    'ai:access',
  ],
};

// ════════════════════════════════════════════
// 🔒 P5-4: 权限检查 Hook
// ════════════════════════════════════════════

export function usePermissions() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  // 从用户信息中获取权限（支持动态权限）
  const permissions = useMemo((): Permission[] => {
    if (!user) return [];

    // 优先使用后端返回的动态权限
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions as Permission[];
    }

    // 否则基于角色推断权限
    const role = user.role as Role;
    return ROLE_PERMISSIONS[role] || [];
  }, [user]);

  const role = user?.role as Role || 'guest';

  // ─────────────────────────────────────────────
  // 权限检查函数
  // ─────────────────────────────────────────────

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return permissions.includes(permission);
    },
    [permissions, user]
  );

  const canAny = useCallback(
    (perms: Permission[]): boolean => {
      if (!user) return false;
      return perms.some(p => permissions.includes(p));
    },
    [permissions, user]
  );

  const canAll = useCallback(
    (perms: Permission[]): boolean => {
      if (!user) return false;
      return perms.every(p => permissions.includes(p));
    },
    [permissions, user]
  );

  const isRole = useCallback(
    (roles: Role | Role[]): boolean => {
      if (!user) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(role);
    },
    [role, user]
  );

  const isAtLeast = useCallback(
    (minRole: Role): boolean => {
      if (!user) return false;
      const hierarchy: Role[] = ['guest', 'viewer', 'researcher', 'manager', 'admin'];
      const userLevel = hierarchy.indexOf(role);
      const minLevel = hierarchy.indexOf(minRole);
      return userLevel >= minLevel;
    },
    [role, user]
  );

  return {
    // 状态
    permissions,
    role,
    isAdmin: role === 'admin',
    isAuthenticated: !!user,

    // 检查函数
    can,
    canAny,
    canAll,
    isRole,
    isAtLeast,

    // 便捷方法
    canReadFormula: can('formula:read'),
    canWriteFormula: can('formula:write'),
    canDeleteFormula: can('formula:delete'),
    canApproveFormula: can('formula:approve'),
    canAccessAdmin: can('admin:access'),
    canAccessAI: can('ai:access'),
    canAccessAdvancedAI: can('ai:advanced'),
    canExport: canAny(['export:excel', 'export:pdf', 'export:csv']),
  };
}

// ════════════════════════════════════════════
// 🔒 P5-4: 权限守卫 Hook
// ════════════════════════════════════════════

export function usePermissionGuard(
  requiredPermission: Permission | Permission[],
  options: {
    mode?: 'all' | 'any';
    fallback?: 'redirect' | 'hide' | 'disable';
    redirectTo?: string;
    onDenied?: () => void;
  } = {}
) {
  const { can, canAny, canAll, isAuthenticated } = usePermissions();
  const navigate = useNavigate();

  const {
    mode = Array.isArray(requiredPermission) ? 'any' : 'all',
    fallback = 'hide',
    redirectTo = '/unauthorized',
    onDenied,
  } = options;

  const hasPermission = useMemo(() => {
    if (!isAuthenticated) return false;
    if (typeof requiredPermission === 'string') {
      return can(requiredPermission);
    }
    return mode === 'all' ? canAll(requiredPermission) : canAny(requiredPermission);
  }, [requiredPermission, mode, can, canAny, canAll, isAuthenticated]);

  const handleDenied = useCallback(() => {
    if (onDenied) {
      onDenied();
    } else if (fallback === 'redirect') {
      navigate(redirectTo, { replace: true });
    }
  }, [fallback, redirectTo, navigate, onDenied]);

  return {
    hasPermission,
    handleDenied,
    isLoading: !isAuthenticated,
  };
}

// ════════════════════════════════════════════
// 🔒 P5-4: 路由守卫组件
// ════════════════════════════════════════════

interface PermissionRouteProps {
  children: React.ReactNode;
  permission?: Permission | Permission[];
  requireAll?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function PermissionRoute({
  children,
  permission,
  requireAll = false,
  redirectTo = '/unauthorized',
  fallback = null,
}: PermissionRouteProps) {
  const { can, canAny, canAll, isAuthenticated } = usePermissions();
  const navigate = useNavigate();

  // 无需权限的路由
  if (!permission) {
    return <>{children}</>;
  }

  // 未登录
  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return fallback;
  }

  // 权限检查
  let hasPermission = true;
  if (typeof permission === 'string') {
    hasPermission = can(permission);
  } else if (Array.isArray(permission)) {
    hasPermission = requireAll ? canAll(permission) : canAny(permission);
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  // 无权限
  navigate(redirectTo, { replace: true });
  return fallback;
}

// ─────────────────────────────────────────────
// 认证守卫
// ─────────────────────────────────────────────

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  allowedRoles?: Role[];
  requiredPermissions?: Permission[];
}

export function AuthGuard({
  children,
  redirectTo = '/login',
  allowedRoles,
  requiredPermissions,
}: AuthGuardProps) {
  const { isAuthenticated, isRole, canAny } = usePermissions();

  // 未登录
  if (!isAuthenticated) {
    window.location.href = redirectTo;
    return null;
  }

  // 角色检查
  if (allowedRoles && allowedRoles.length > 0) {
    if (!isRole(allowedRoles)) {
      window.location.href = '/unauthorized';
      return null;
    }
  }

  // 权限检查
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!canAny(requiredPermissions)) {
      window.location.href = '/unauthorized';
      return null;
    }
  }

  return <>{children}</>;
}

// ════════════════════════════════════════════
// 🔒 P5-4: 权限高阶组件
// ════════════════════════════════════════════

export function withPermission<P extends object>(
  permission: Permission | Permission[],
  mode: 'all' | 'any' = 'any'
) {
  return function WithPermissionWrapper<P extends object>(
    WrappedComponent: React.ComponentType<P>
  ) {
    return function PermissionWrapper(props: P) {
      const { can, canAny, canAll } = usePermissions();
      const navigate = useNavigate();

      let hasPermission = true;
      if (typeof permission === 'string') {
        hasPermission = can(permission);
      } else if (Array.isArray(permission)) {
        hasPermission = mode === 'all' ? canAll(permission) : canAny(permission);
      }

      if (!hasPermission) {
        navigate('/unauthorized', { replace: true });
        return null;
      }

      return <WrappedComponent {...props} />;
    };
  };
}

// ════════════════════════════════════════════
// 🔒 P5-4: 权限按钮组件
// ════════════════════════════════════════════

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission?: Permission | Permission[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionButton({
  permission,
  requireAll = false,
  children,
  fallback = null,
  ...buttonProps
}: PermissionButtonProps) {
  const { can, canAny, canAll, isAuthenticated } = usePermissions();

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  if (!permission) {
    return (
      <button {...buttonProps}>
        {children}
      </button>
    );
  }

  let hasPermission = true;
  if (typeof permission === 'string') {
    hasPermission = can(permission);
  } else if (Array.isArray(permission)) {
    hasPermission = requireAll ? canAll(permission) : canAny(permission);
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return (
    <button {...buttonProps}>
      {children}
    </button>
  );
}

// ════════════════════════════════════════════
// 🔒 P5-4: 权限菜单项
// ════════════════════════════════════════════

interface PermissionMenuItemProps {
  permission?: Permission | Permission[];
  requireAll?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function PermissionMenuItem({
  permission,
  requireAll = false,
  children,
  onClick,
  disabled = false,
}: PermissionMenuItemProps) {
  const { can, canAny, canAll } = usePermissions();

  let hasPermission = true;
  if (permission) {
    if (typeof permission === 'string') {
      hasPermission = can(permission);
    } else if (Array.isArray(permission)) {
      hasPermission = requireAll ? canAll(permission) : canAny(permission);
    }
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <li onClick={disabled ? undefined : onClick}>
      {children}
    </li>
  );
}

// ════════════════════════════════════════════
// 🔒 P5-4: 审计日志 Hook
// ════════════════════════════════════════════

interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

const AUDIT_QUEUE: AuditLogEntry[] = [];
const AUDIT_ENDPOINT = '/api/v1/audit/log';

export function useAuditLog() {
  const user = useAuthStore(state => state.user);
  const queueRef = useRef<AuditLogEntry[]>([]);
  const isProcessingRef = useRef(false);

  const log = useCallback(
    async (entry: AuditLogEntry) => {
      const fullEntry: AuditLogEntry = {
        ...entry,
        timestamp: Date.now(),
      };

      queueRef.current.push(fullEntry);

      // 批量发送（最多 10 条或间隔 5 秒）
      if (queueRef.current.length >= 10) {
        await flushAuditLog();
      }
    },
    []
  );

  const flushAuditLog = useCallback(async () => {
    if (queueRef.current.length === 0 || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    const entries = [...queueRef.current];
    queueRef.current = [];

    try {
      await fetch(AUDIT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries,
          userId: user?.id,
          sessionId: sessionStorage.getItem('session_id'),
        }),
      });
    } catch (e) {
      // 失败时放回队列
      queueRef.current.unshift(...entries);
      console.warn('[AuditLog] Failed to send audit log:', e);
    } finally {
      isProcessingRef.current = false;
    }
  }, [user]);

  // 定期刷新
  useEffect(() => {
    const interval = setInterval(flushAuditLog, 5000);
    return () => {
      clearInterval(interval);
      flushAuditLog();
    };
  }, [flushAuditLog]);

  return {
    log,
    flush: flushAuditLog,
    // 便捷方法
    logView: (resource: string, resourceId?: string) =>
      log({ action: 'view', resource, resourceId }),
    logCreate: (resource: string, resourceId?: string, metadata?: any) =>
      log({ action: 'create', resource, resourceId, metadata }),
    logUpdate: (resource: string, resourceId?: string, metadata?: any) =>
      log({ action: 'update', resource, resourceId, metadata }),
    logDelete: (resource: string, resourceId?: string) =>
      log({ action: 'delete', resource, resourceId }),
    logExport: (resource: string, format: string) =>
      log({ action: 'export', resource, metadata: { format } }),
    logLogin: (method: string) =>
      log({ action: 'login', resource: 'auth', metadata: { method } }),
    logLogout: () =>
      log({ action: 'logout', resource: 'auth' }),
  };
}

// ════════════════════════════════════════════
// 🔒 P5-4: 导出
// ════════════════════════════════════════════

export {
  usePermissions,
  usePermissionGuard,
  PermissionRoute,
  AuthGuard,
  PermissionButton,
  PermissionMenuItem,
  withPermission,
  useAuditLog,
};

export type {
  PermissionRouteProps,
  AuthGuardProps,
  PermissionButtonProps,
  PermissionMenuItemProps,
};
