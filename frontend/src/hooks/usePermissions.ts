import { useCallback, useMemo } from 'react';

export type Permission = string;
export type Role = 'admin' | 'manager' | 'researcher' | 'viewer' | 'guest';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['admin:access', 'formula:write', 'experiment:write', 'ai:advanced'],
  manager: ['formula:write', 'experiment:write', 'ai:access'],
  researcher: ['formula:read', 'formula:write', 'experiment:write', 'ai:access'],
  viewer: ['formula:read', 'experiment:read'],
  guest: ['formula:read'],
};

export function usePermissions(user?: any) {
  const permissions = useMemo((): Permission[] => {
    if (!user) return [];
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions as Permission[];
    }
    const role = user.role as Role;
    return ROLE_PERMISSIONS[role] || [];
  }, [user]);

  const role = user?.role as Role || 'guest';

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

  return {
    permissions,
    role,
    isAdmin: role === 'admin',
    isAuthenticated: !!user,
    can,
    canAny,
    canAll,
    isRole,
    canReadFormula: can('formula:read'),
    canWriteFormula: can('formula:write'),
    canAccessAI: can('ai:access'),
  };
}
