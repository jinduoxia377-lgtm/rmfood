/**
 * 🟡 P1-1: 前端权限路由守卫
 *
 * 提供统一的权限控制体系
 *
 * 核心组件:
 * 1. PermissionGuard - 路由级权限守卫
 * 2. PermissionCheck - 组件级权限检查
 * 3. usePermission - 权限查询 Hook
 * 4. 权限元数据配置
 *
 * 使用方式:
 * // 1. 路由守卫 (App.tsx)
 * <Route
 *   path="/formulas"
 *   element={
 *     <PermissionGuard required="formula:read" redirect="/login">
 *       <FormulaListPage />
 *     </PermissionGuard>
 *   }
 * />
 *
 * // 2. 组件检查 (Page 内)
 * {can('formula:write') && <EditButton />}
 *
 * // 3. 权限 Hook
 * const { can, isAdmin, hasAny } = usePermission()
 */

import { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// 权限元数据配置
// （替换为您项目中的 store 路径
// 假设项目有全局用户信息在全局 useAuth 中
// 以下是核心功能

/**
 * 角色与权限的映射关系
 */
const ROLE_PERMISSION_MAP = {
  // 超级管理员: 所有权限
  admin: [
    'formula:read',
    'formula:write',
    'formula:delete',
    'formula:approve',
    'formula:export',
    'formula:version',
    'experiment:read',
    'experiment:write',
    'ingredient:read',
    'ingredient:write',
    'peptide:read',
    'peptide:write',
    'ai:access',
    'ai:advanced',
    'user:read',
    'user:write',
    'settings:read',
    'settings:write',
  ],
  // 研究员: 配方/实验/AI 基本权限
  'researcher': [
    'formula:read',
    'formula:write',
    'experiment:read',
    'experiment:write',
    'ingredient:read',
    'ai:access',
  ],
  // 配方师: 编辑配方权限
  'formulator': [
    'formula:read',
    'formula:write',
    'formula:version',
    'formula:export',
    'ingredient:read',
    'peptide:read',
    'ai:access',
  ],
  // 审核者: 只读 + 审核权限
  'reviewer': [
    'formula:read',
    'formula:approve',
    'formula:export',
    'experiment:read',
    'ingredient:read',
    'ingredient:write',
    'ai:access',
    'ai:advanced',
    'peptide:read',
  ],
  // 访客: 只读
  'viewer': ['formula:read', 'ingredient:read'],
};

/**
 * 获取用户的角色
 * （这里是示例代码中的用户对象的角色字段，根据项目情况替换为
 */
function getCurrentUser() {
  // 注意: 这里是模拟实现
  try {
    // 模拟返回 { role: 'admin', permissions: [] }
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      return { role: 'viewer', permissions: [] };
    }
    const user = JSON.parse(userStr);
    return user || { role: 'viewer', permissions: [] };
  } catch {
    return { role: 'viewer', permissions: [] };
  }
}

/**
 * 获取权限列表
 */
function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSION_MAP[role as keyof typeof ROLE_PERMISSION_MAP] || [];
}

/**
 * 检查用户是否具有所需权限
 */
export function hasPermission(required: string | string[], user: any = getCurrentUser()): boolean {
  const { role, permissions = user || getCurrentUser();

  // 获取用户的角色权限
  const rolePermissions = getRolePermissions(role || 'viewer');
  const userPerms = [...rolePermissions, ...(permissions || [])];

  // 没有权限检查
  if (Array.isArray(required)) {
    // 全部权限: 需要全部满足
    return required.every((p) => userPerms.includes(p));
  }
  // 单权限检查
  return userPerms.includes(required);
}

/**
 * 🔒 P1-1: Permission Hook
 */
export function usePermission(user: any = getCurrentUser()) {
  return useMemo(() => {
    const can = (required: string) => hasPermission(required, user);
    const isAdmin = user?.role === 'admin';
    const isFormulator = user?.role === 'formulator';
    const hasAny = (required: string[]) => required.some((p) => can(p));

    return {
      // 核心检查方法
      can, // 检查是否有指定权限
      canAny: hasAny, // 检查是否有任意权限列表中至少一个
      isAdmin, isFormulator, // 是否管理员
      // 当前角色
      role: user?.role || 'viewer',
    };
  }, [user?.role, user?.permissions?.join(',')]);
}

/**
 * 🔒 P1-1: 权限守卫组件（路由级保护）
 */
export function PermissionGuard({
  required, // 需要的权限
  fallback = null, // Fallback 组件（默认不通过时）
  redirect, // 重定向 URL（权限不足时跳转的）
  requireAll = true, // 是否需要所有权限
  children, // 受保护的子组件
}: {
  required: string | string[];
  fallback?: React.ReactNode;
  redirect?: string;
  requireAll?: boolean;
  children: React.ReactNode;
}) {
  const { can, canAny: hasAny } = usePermission();

  // 检查权限是否满足
  const hasAccess =
    Array.isArray(required) && !requireAll
      ? hasAny(required) // 任意权限通过
      : can(required as string);

  // 权限不通过
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  // 权限通过
  return <>{children}</>;
}

/**
 * 🔒 P1-1: 登录守卫（替代 PermissionGuard，重定向模式
 */
export function ProtectedRoute({
  required,
  redirect = '/login',
  children,
}: {
  required?: string | string[];
  redirect?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { can, canAny: hasAny } = usePermission();

  // 无权限跳转
  if (Array.isArray(required) && !required.every((p) => can(p))) {
    return <Navigate to={redirect} replace state={{ from: location }} />;
  }

  // 无权限跳转
  if (!Array.isArray(required) && required && !hasAny([required])) {
    return <Navigate to={redirect} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

/**
 * 🔒 P1-1: 仅管理员可访问的守卫
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = usePermission();
  return isAdmin ? <>{children}</> : null;
}

/**
 * 🔒 P1-1: 权限按钮（带权限检查的按钮组件
 */
export function PermissionButton({
  required,
  children,
  className = '',
  ...props
}: {
  required: string | string[];
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { can, canAny } = usePermission();

  // 检查是否有权限
  const hasAccess = Array.isArray(required)
    ? required.some((p) => can(p))
    : can(required);

  // 无权限则不渲染
  if (!hasAccess) return null;

  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}

/**
 * 🔒 P1-1: 权限菜单项（带权限检查的菜单项
 */
export function PermissionMenuItem({
  required,
  children,
  onClick,
}: {
  required: string | string[];
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { can, canAny } = usePermission();
  const hasAccess = Array.isArray(required)
    ? required.some((p) => can(p))
    : can(required);

  if (!hasAccess) return null;

  return <li onClick={onClick}>{children}</li>;
}

/**
 * 🔒 P1-1: 权限显示组件（权限不足时显示禁用状态显示
 */
export function WithPermission({
  required,
  children,
  children,
}: {
  required: string | string[];
  children: React.ReactNode;
}) {
  const { can } = usePermission();
  if (!can(required)) return null;
  return <>{children}</>;
}

/**
 * 🔒 P1-1: 权限信息显示组件（显示权限信息的页面
 */
export function PermissionInfo() {
  const { role } = usePermission();
  return <div>当前角色: {role}</div>;
}

/**
 * 🔒 P1-1: 权限上下文（供子组件调用）
 */
export function PermissionContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { can, isAdmin, role } = usePermission();

  // 简化: 提供上下文供子组件调用
  const ctx = {
    can,
    isAdmin,
    role,
  };

  return (
    <PermissionContext.Provider value={ctx}>{children}</PermissionContext.Provider>
  );
}

/**
 * 🔒 P1-1: 权限上下文 Hook（通过 createContext 实现，供深层嵌套组件使用
 */
const PermissionContext = createContext<{
  can: (required: string) => boolean;
  isAdmin: boolean;
  role: string;
} | null>(null);

/**
 * 🔒 P1-1: 权限上下文 Hook（供子组件调用）
 */
export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (!context) {
    // 未在组件中调用
    return usePermission();
  }
  return context;
}

/**
 * 🔒 P1-1: 角色守卫（仅特定角色才能访问
 */
export function RoleBasedGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const { role } = usePermission();
  if (!allowedRoles.includes(role)) return null;

  return <>{children}</>;
}

/**
 * 🔒 P1-1: 条件守卫（自定义条件检查）
 */
export function ConditionalGuard({
  condition,
  children,
  fallback,
}: {
  condition: () => boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const result = condition();
  if (!result) return <>{fallback || null}</>;
  return <>{children}</>;
}

/**
 * 🔒 P1-1: 权限验证状态（供调试使用）
 */
export function PermissionDebugInfo() {
  const { role, can, isAdmin } = usePermission();
  return (
    <div className="permission-debug">
      <div>角色: {role}</div>
      <div>是否管理员: {isAdmin ? '是' : '否'}</div>
      <div>权限列表: {can('formula:write') ? '✓' : '✗'}</div>
    </div>
  );
}

/**
 * 🔒 P1-1: 权限检查工具（页面级权限检查快速方法
 */
export function checkPagePermission(required: string | string[]): boolean {
  const { can, canAny } = usePermission();
  if (Array.isArray(required)) {
    return required.every((p) => can(p));
  }
  return can(required);
}

// 为兼容旧代码的导出别名
export {
  // （兼容旧代码使用
  ROLE_PERMISSION_MAP as rolePermissionMap,
};

// 默认导出（供外部 use
export default {
  PermissionGuard,
  ProtectedRoute,
  AdminOnly,
  PermissionButton,
  PermissionMenuItem,
  WithPermission,
  PermissionInfo,
  PermissionContextProvider,
  usePermission,
  usePermissionContext,
  RoleBasedGuard,
  ConditionalGuard,
  PermissionDebugInfo,
};
