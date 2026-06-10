/**
 * usePermissions Hook - 单元测试
 * 测试覆盖：初始状态、权限检查、角色 CRUD、API 错误处理
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePermissions } from '../usePermissions';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/api/client';

const mockPermissions = [
  { id: 1, name: 'Create Formula', code: 'formula:create', resource: 'formula', actions: ['create', 'read'] },
  { id: 2, name: 'Manage Org', code: 'org:manage', resource: 'organization', actions: ['read', 'update', 'manage'] },
  {
    id: 3,
    name: 'Delete Member',
    code: 'member:delete',
    resource: 'member',
    actions: ['invite', 'read', 'update', 'delete'],
  },
];

const mockRoles = [
  {
    id: 1,
    name: 'Admin',
    code: 'admin',
    description: 'Full access',
    permissions: mockPermissions,
    isSystem: true,
    memberCount: 2,
  },
  {
    id: 2,
    name: 'Researcher',
    code: 'researcher',
    description: 'Research access',
    permissions: [mockPermissions[0]],
    isSystem: false,
    memberCount: 5,
  },
];

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty permissions when autoFetch disabled', () => {
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      expect(result.current.permissions).toEqual([]);
    });
    it('should start with empty roles', () => {
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      expect(result.current.roles).toEqual([]);
    });
    it('should start with no error', () => {
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      expect(result.current.error).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission exists', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasPermission('create', 'formula')).toBe(true);
    });
    it('should return false when permission does not exist', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasPermission('delete', 'formula')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when at least one action is permitted', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasAnyPermission(['create', 'delete'], 'formula')).toBe(true);
    });
    it('should return false when no actions are permitted', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasAnyPermission(['archive', 'invite'], 'formula')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all actions are permitted', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasAllPermissions(['create', 'read'], 'formula')).toBe(true);
    });
    it('should return false when one action is missing', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.hasAllPermissions(['create', 'read', 'delete'], 'formula')).toBe(false);
    });
  });

  describe('fetchPermissions', () => {
    it('should set permissions on success', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.permissions).toEqual(mockPermissions);
    });
    it('should set error on failure', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Server down'));
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('Role CRUD', () => {
    it('should add new role on createRole success', async () => {
      const newRole = { id: 3, name: 'New', code: 'new', permissions: [], isSystem: false };
      vi.mocked(api.get).mockResolvedValue({ data: { items: mockPermissions } });
      vi.mocked(api.post).mockResolvedValue({ data: newRole });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      await act(async () => {
        await result.current.createRole({ name: 'New', code: 'new', permissionIds: [1] });
      });
      expect(result.current.roles).toContainEqual(newRole);
    });
    it('should remove role on deleteRole', async () => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { items: mockPermissions } })
        .mockResolvedValueOnce({ data: { items: mockRoles } });
      vi.mocked(api.delete).mockResolvedValue({ data: {} });
      const { result } = renderHook(() => usePermissions({ autoFetch: false }));
      await act(async () => {
        await result.current.fetchPermissions(1);
      });
      await act(async () => {
        await result.current.fetchRoles();
      });
      expect(result.current.roles).toHaveLength(2);
      await act(async () => {
        await result.current.deleteRole(2);
      });
      expect(result.current.roles).toHaveLength(1);
    });
  });
});
