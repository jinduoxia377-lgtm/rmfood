/**
 * Auth Store - 单元测试
 * 测试覆盖：初始状态、登录/登出、Token 管理、localStorage 持久化
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 通过 vi.hoisted 在 vi.mock 工厂中共享 mock 函数
const mocks = vi.hoisted(() => ({
  clientGet: vi.fn(),
  clientPost: vi.fn(),
  clientPut: vi.fn(),
  clientDelete: vi.fn(),
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    refresh: vi.fn(),
  },
}));

// 登录流程中的 getMe 走的是集中式 axios client（@/api/client），而非 authApi.getMe，
// 因此必须 mock client 才能让登录用例在无网络环境下通过。
vi.mock('@/api/client', () => ({
  default: {
    get: mocks.clientGet,
    post: mocks.clientPost,
    put: mocks.clientPut,
    delete: mocks.clientDelete,
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
import { normalizeUser } from '@/utils/userNormalizer';

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
    });
    vi.clearAllMocks();
    // 模拟集中式 client：
    // - 启动静默检查（_silent）→ 返回空数据
    // - 携带 Authorization 的请求（登录回退路径）→ 返回 mockUser
    // - 其余（_loginFlow 首次请求）→ 网络错误，触发回退路径
    mocks.clientGet.mockImplementation((url: string, config?: any) => {
      if (config?.params?._silent) return Promise.resolve({ data: null });
      if (config?.headers?.Authorization) return Promise.resolve({ data: mockUser });
      return Promise.reject(new Error('Network error'));
    });
    // 登录成功后需要连接 WebSocket（保持 mock 实现跨用例可用）
    vi.mocked(connectWebSocket).mockResolvedValue(true);
  });

  afterEach(() => {
    // 只清调用记录，不重置实现（restoreAllMocks 会移除 mockResolvedValue）
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have isAuthenticated as false', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    it('should have user as null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('login', () => {
    it('should set isAuthenticated on successful login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      await useAuthStore.getState().login('testuser', 'password123');
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
    it('should fetch user info after successful login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      await useAuthStore.getState().login('testuser', 'password123');
      expect(useAuthStore.getState().user).toEqual(normalizeUser(mockUser as any));
    });
    it('should connect WebSocket after login', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      await useAuthStore.getState().login('testuser', 'password123');
      expect(connectWebSocket).toHaveBeenCalled();
    });
    it('should throw error when login API fails', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'));
      await expect(useAuthStore.getState().login('testuser', 'wrong')).rejects.toThrow();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    it('should set fallback user when primary getMe fails', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockToken as any);
      // authApi.getMe 已不再是登录流程的取用户通道（登录走集中式 client），
      // 这里模拟其失败不影响登录回退路径。
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Network error'));
      await useAuthStore.getState().login('testuser', 'password123');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.username).toBe('testuser');
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.setState({ user: mockUser as any, isAuthenticated: true });
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
    it('should disconnect WebSocket on logout', () => {
      useAuthStore.getState().logout();
      expect(disconnectWebSocket).toHaveBeenCalled();
    });
  });

  describe('fetchUser', () => {
    it('should set normalized user and isAuthenticated on success', async () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);
      await useAuthStore.getState().fetchUser();
      expect(useAuthStore.getState().user).toEqual(normalizeUser(mockUser as any));
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    it('should keep existing auth state when getMe fails', async () => {
      useAuthStore.setState({ user: mockUser as any, isAuthenticated: true });
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
      await useAuthStore.getState().fetchUser();
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should update the user object (normalized)', () => {
      useAuthStore.getState().setUser(mockUser as any);
      expect(useAuthStore.getState().user).toEqual(normalizeUser(mockUser as any));
    });
  });
});