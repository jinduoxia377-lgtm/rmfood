/**
 * usePermissions Hook - 单元测试
 * 覆盖：无用户、基于角色、自定义权限、can/canAny/canAll/isRole
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, ROLE_PERMISSIONS } from '../usePermissions';

describe('usePermissions', () => {
  describe('无用户', () => {
    it('应返回空权限且未认证', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions).toEqual([]);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.role).toBe('guest');
    });

    it('can/canAny/canAll 均返回 false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can('formula:read')).toBe(false);
      expect(result.current.canAny(['formula:read'])).toBe(false);
      expect(result.current.canAll(['formula:read'])).toBe(false);
    });
  });

  describe('基于角色的用户', () => {
    it('应按角色返回权限', () => {
      const { result } = renderHook(() => usePermissions({ role: 'admin' }));
      expect(result.current.permissions).toEqual(ROLE_PERMISSIONS.admin);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.can('formula:write')).toBe(true);
      expect(result.current.canWriteFormula).toBe(true);
    });

    it('canAny 应正确判断', () => {
      const { result } = renderHook(() => usePermissions({ role: 'researcher' }));
      // researcher 有 formula:write，但没有 ai:advanced
      expect(result.current.canAny(['formula:write', 'ai:advanced'])).toBe(true);
      expect(result.current.canAny(['ai:advanced'])).toBe(false);
    });

    it('canAll 应正确判断', () => {
      const { result } = renderHook(() => usePermissions({ role: 'researcher' }));
      expect(result.current.canAll(['formula:read', 'formula:write'])).toBe(true);
      expect(result.current.canAll(['formula:read', 'experiment:write', 'ai:advanced'])).toBe(false);
    });

    it('isRole 应正确判断', () => {
      const { result } = renderHook(() => usePermissions({ role: 'viewer' }));
      expect(result.current.isRole('viewer')).toBe(true);
      expect(result.current.isRole(['admin', 'viewer'])).toBe(true);
      expect(result.current.isRole('admin')).toBe(false);
    });
  });

  describe('带自定义权限的用户', () => {
    it('应优先使用 user.permissions', () => {
      const { result } = renderHook(() => usePermissions({
        role: 'guest',
        permissions: ['custom:perm'],
      }));
      expect(result.current.permissions).toEqual(['custom:perm']);
      expect(result.current.can('custom:perm')).toBe(true);
      expect(result.current.can('formula:read')).toBe(false);
    });

    it('canAny/canAll 基于自定义权限判断', () => {
      const { result } = renderHook(() => usePermissions({
        role: 'guest',
        permissions: ['a:1', 'b:2'],
      }));
      expect(result.current.canAny(['b:2', 'z:9'])).toBe(true);
      expect(result.current.canAll(['a:1', 'b:2'])).toBe(true);
      expect(result.current.canAll(['a:1', 'z:9'])).toBe(false);
    });
  });
});