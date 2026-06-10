/**
 * Auth Store - 单元测试
 * 测试覆盖：初始状态、登录/登出、Token 管理、localStorage 持久化
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('@/services/websocket', () => ({
  connectWebSocket: vi.fn().mockResolvedValue(true),
  disconnectWebSocket: vi.fn(),
}));

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

import { useAuthStore } from '../auth';
import { authApi } from '@/api/auth';
import { connectWebSocket, disconnectWebSocket } from '@/services/websocket';

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'admin',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockToken = {
  accessToken: 'access_abc123',
  refreshToken: 'refresh_xyz789',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      accessToken: null,
      refreshToken: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have isAuthenticated as false', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    it('should have user as null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });
    it('should have accessToken as null', () => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('login', () => {
    it('should set tokens and isAuthenticated on successful login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);
      await useAuthStore.getState().login('testuser', 'password123');
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('access_abc123');
      expect(state.isLoading).toBe(false);
    });
    it('should fetch user info after successful login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);
      await useAuthStore.getState().login('testuser', 'password123');
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
    it('should connect WebSocket after login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);
      await useAuthStore.getState().login('testuser', 'password123');
      expect(connectWebSocket).toHaveBeenCalled();
    });
    it('should throw error when login API fails', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'));
      await expect(useAuthStore.getState().login('testuser', 'wrong')).rejects.toThrow();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    it('should set fallback user when getMe fails', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Network error'));
      await useAuthStore.getState().login('testuser', 'password123');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.username).toBe('testuser');
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.setState({ user: mockUser as any, isAuthenticated: true, accessToken: 'tok', refreshToken: 'ref' });
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });
    it('should disconnect WebSocket on logout', () => {
      useAuthStore.getState().logout();
      expect(disconnectWebSocket).toHaveBeenCalled();
    });
  });

  describe('fetchUser', () => {
    it('should set user and isAuthenticated on success', async () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);
      await useAuthStore.getState().fetchUser();
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    it('should clear auth state when getMe fails', async () => {
      useAuthStore.setState({ user: mockUser as any, isAuthenticated: true });
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
      await useAuthStore.getState().fetchUser();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should update the user object', () => {
      useAuthStore.getState().setUser(mockUser as any);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });
});
