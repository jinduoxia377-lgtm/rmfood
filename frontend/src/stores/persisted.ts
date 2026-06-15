/**
 * 🟡 P1-2: Zustand 状态持久化系统
 *
 * 提供统一的状态持久化解决方案，支持 localStorage / sessionStorage
 * 支持用户登录信息、UI 偏好、筛选条件等
 *
 * 使用方式:
 *   const [theme, setTheme] = usePersistedState<string>('ui:theme', 'dark', 'localStorage')
 *   const authStore = useAuthStore()
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ═════════════════════════════════════════
// 🟡 P1-2: 通用状态持久化 Hook
// ═════════════════════════════════════════

interface PersistedState<T> {
  value: T;
  setValue: (val: T) => void;
  reset: () => void;
}

/**
 * 持久化状态（通用版）
 *
 * @param key - 存储键名
 * @param initial - 初始值
 * @param storage - 存储类型（localStorage 或 sessionStorage）
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  storage: 'localStorage' | 'sessionStorage' = 'localStorage'
): [T, (val: T) => void, () => void] {
  const store = useMemoStore<T>(key, initial, storage);

  return [
    store.value,
    store.setValue,
    store.reset,
  ];
}

/**
 * 内部实现：使用 zustand 管理持久化状态
 * （使用 create() 创建一个 store 实例
 */
function useMemoStore<T>(
  key: string,
  initial: T,
  storageType: 'localStorage' | 'sessionStorage'
): PersistedState<T> {
  const useStore = useMemo(() => {
    // 延迟到运行时创建（避免 SSR 问题
    // 通过 closure 捕获的方式，使用动态创建的
    return create<PersistedState<T>>(
      persist(
        (set) => ({
          value: initial,
          setValue: (val: T) => set({ value: val }),
          reset: () => set({ value: initial }),
        }),
        {
          name: key,
          storage: createJSONStorage(
            () => (storageType === 'localStorage' ? localStorage : sessionStorage),
          ),
          partialize: (state) => ({ value: state.value }),
        }
      )
    );
  }, [key]);

  return useStore();
}

// ═════════════════════════════════════════
// 🟡 P1-2: 认证状态持久化
// ═════════════════════════════════════════

interface AuthState {
  token: string | null;
  user: {
    id: number;
    username: string;
    role: string;
    email: string;
  } | null;
  lastLoginAt: number | null;
  sessionId: string | null;
  // 权限列表
  permissions: string[];

  // 操作方法
  login: (token: string, user: any, permissions?: string[]) => void;
  logout: () => void;
  updateUser: (updates: Partial<any>) => void;
  addPermission: (perm: string) => void;
  removePermission: (perm: string) => void;
  hasPermission: (perm: string) => boolean;
  // 刷新 Token
  refreshToken: (token: string) => void;
}

/**
 * 认证状态 store（支持 localStorage 持久化
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      lastLoginAt: null,
      sessionId: null,
      permissions: [],

      // 登录
      login: (token, user, permissions = []) => {
        set({
          token,
          user,
          lastLoginAt: Date.now(),
          sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          permissions,
        });
      },

      // 登出
      logout: () => {
        set({
          token: null,
          user: null,
          lastLoginAt: null,
          sessionId: null,
          permissions: [],
        });
      },

      // 更新用户信息
      updateUser: (updates) => {
        const { user } = get();
        if (!user) return;
        set({ user: { ...user, ...updates } });
      },

      // 权限管理
      addPermission: (perm) => {
        set((s) => ({ permissions: [...s.permissions, perm] }));
      },

      removePermission: (perm) => {
        set((s) => ({ permissions: s.permissions.filter((p) => p !== perm) }));
      },

      hasPermission: (perm) => {
        const { user, permissions } = get();
        // 超级管理员
        if (user?.role === 'admin') return true;
        return permissions.includes(perm);
      },

      refreshToken: (token) => {
        set({ token });
      },
    }),
    {
      name: 'rmfood:auth',
      // 使用 sessionStorage 存储认证（安全性考虑
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        lastLoginAt: state.lastLoginAt,
        permissions: state.permissions,
      }),
    }
  )
);

// ═════════════════════════════════════════
// 🟡 P1-2: UI 偏好持久化
// ═════════════════════════════════════════

interface UIState {
  theme: 'dark' | 'light';
  primaryColor: string;
  locale: 'zh-CN' | 'en-US';
  collapsed: boolean; // 侧边栏是否折叠
  tableDensity: 'comfortable' | 'compact'; // 表格密度
  // 列表筛选条件记忆
  filters: { [pageKey: string]: any };
  // 列可见性配置
  columnVisibility: { [tableName: string]: { [col: string]: boolean } };

  // 操作方法
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setPrimaryColor: (color: string) => void;
  setLocale: (locale: 'zh-CN' | 'en-US') => void;
  toggleSidebar: () => void;
  setTableDensity: (density: 'comfortable' | 'compact') => void;
  setFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearAllFilters: () => void;
  setColumnVisibility: (table: string, column: string, visible: boolean) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      primaryColor: '#1677ff',
      locale: 'zh-CN',
      collapsed: false,
      tableDensity: 'comfortable',
      filters: {},
      columnVisibility: {},

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setPrimaryColor: (color) => set({ primaryColor: color }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () => set({ collapsed: !get().collapsed }),
      setTableDensity: (density) => set({ tableDensity: density }),

      // 筛选条件
      setFilter: (key, value) => {
        const filters = { ...get().filters, [key]: value };
        set({ filters });
      },
      removeFilter: (key) => {
        const { [key]: _, ...rest } = get().filters;
        set({ filters: rest });
      },
      clearAllFilters: () => set({ filters: {} }),

      // 列可见性
      setColumnVisibility: (table, column, visible) => {
        set((state) => ({
          columnVisibility: {
            ...state.columnVisibility,
            [table]: {
              ...state.columnVisibility[table],
              [column]: visible,
            },
          },
        }));
      },

      resetUI: () =>
        set({
          theme: 'dark',
          primaryColor: '#1677ff',
          locale: 'zh-CN',
          collapsed: false,
          tableDensity: 'comfortable',
          filters: {},
          columnVisibility: {},
        }),
    }),
    {
      name: 'rmfood:ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ═════════════════════════════════════════
// 🟡 P1-2: 搜索历史持久化
// ═════════════════════════════════════════

interface SearchHistory {
  // 全局搜索关键词（最近 20 条
  keywords: string[];
  // 高级筛选条件记忆（按模块分组
  advanced: {
    formula: any[];
    experiment: any[];
    [key: string]: any[];
  };

  // 操作方法
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;
  clearKeywords: () => void;
  saveAdvanced: (module: string, condition: any) => void;
  clearAdvanced: (module: string) => void;
}

export const useSearchHistoryStore = create<SearchHistory>()(
  persist(
    (set, get) => ({
      keywords: [],
      advanced: {
        formula: [],
        experiment: [],
      },

      addKeyword: (keyword: string) => {
        if (!keyword || keyword.length > 50) return;
        // 去重 + 置顶 + 限制数量（最多 20 条
        const existing = get().keywords.filter((k) => k !== keyword);
        const keywords = [keyword, ...existing].slice(0, 20);
        set({ keywords });
      },

      removeKeyword: (keyword) => {
        const keywords = get().keywords.filter((k) => k !== keyword);
        set({ keywords });
      },

      clearKeywords: () => set({ keywords: [] }),

      saveAdvanced: (module, condition) => {
        const current = get().advanced[module] || [];
        const updated = [condition, ...current].slice(0, 10); // 每个模块最多 10 条
        set({ advanced: { ...get().advanced, [module]: updated } });
      },

      clearAdvanced: (module) => {
        set((s) => ({
          advanced: { ...s.advanced, [module]: [] },
        }));
      },
    }),
    {
      name: 'rmfood:search-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        keywords: state.keywords,
        advanced: state.advanced,
      }),
    }
  )
);

// ═════════════════════════════════════════
// 🟡 P1-2: 应用配置持久化（供开发环境切换
// ═════════════════════════════════════════

interface AppConfigState {
  // 后端 API 基础地址（开发环境支持切换
  apiBaseUrl: string;
  // AI 服务地址（如 DeepSeek/本地模型
  aiServiceUrl: string;
  // 是否启用实验性功能
  experimentalFeatures: boolean;
  // 调试模式
  debugMode: boolean;

  setApiBaseUrl: (url: string) => void;
  setAiServiceUrl: (url: string) => void;
  setExperimentalFeatures: (enable: boolean) => void;
  setDebugMode: (enable: boolean) => void;
}

export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set, get) => ({
      apiBaseUrl: '/api',
      aiServiceUrl: '/api/ai',
      experimentalFeatures: false,
      debugMode: process.env.NODE_ENV === 'development',

      setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
      setAiServiceUrl: (url) => set({ aiServiceUrl: url }),
      setExperimentalFeatures: (enable) => set({ experimentalFeatures: enable }),
      setDebugMode: (enable) => set({ debugMode: enable }),
    }),
    {
      name: 'rmfood:app-config',
      storage: createJSONStorage(() => localStorage),
      // 开发环境持久化，生产环境不持久化（防止用户误修改
      partialize: (state) => {
        if (process.env.NODE_ENV === 'production') return {};
        return state;
      },
    }
  )
);

// ═════════════════════════════════════════
// 🟡 P1-2: 便捷函数（批量导入导出）
// ═════════════════════════════════════════

/**
 * 获取认证信息的便捷方法
 */
export function getAuthInfo() {
  const { token, user, role, permissions } = useAuthStore.getState();
  return {
    token,
    user,
    role: user?.role || 'guest',
    isAuthenticated: !!token,
    permissions,
  };
}

/**
 * 清除所有持久化状态（登出清理
 */
export function clearAllPersistedState(): void {
  try {
    // 使用 zustand persistence API 清除
    // 手动清除 localStorage 中的项目
    const keysToRemove = [
      'rmfood:auth',
      'rmfood:search-history',
      // UI 状态保留，不随登录清除
    ];

    keysToRemove.forEach((key) => {
      sessionStorage.removeItem(key);
    });
  } catch (e) {
    console.error('Failed to clear persisted state:', e);
  }
}

/**
 * 导出用户数据（为数据备份/迁移做准备
 */
export function exportPersistedData(): { [key: string]: any } {
  return {
    ui: useUIStore.getState(),
    searchHistory: useSearchHistoryStore.getState(),
    appConfig: useAppConfigStore.getState(),
    exportedAt: new Date().toISOString(),
    version: process.env.REACT_APP_VERSION || 'unknown',
  };
}

/**
 * 导入用户数据（恢复
 */
export function importPersistedData(data: { [key: string]: any }): void {
  if (!data) return;

  try {
    // UI 状态
    if (data.ui) {
      useUIStore.setState(data.ui);
    }
    // 搜索历史
    if (data.searchHistory) {
      useSearchHistoryStore.setState(data.searchHistory);
    }
    // 应用配置
    if (data.appConfig) {
      useAppConfigStore.setState(data.appConfig);
    }
  } catch (e) {
    console.error('Failed to import persisted data:', e);
    throw e;
  }
}

// ═════════════════════════════════════════
// 🟡 P1-2: 便捷 Hook（组合使用
// ═════════════════════════════════════════

/**
 * 认证便捷 Hook
 */
export function useAuth() {
  const { token, user, login, logout, lastLoginAt } = useAuthStore();
  return {
    isAuthenticated: !!token,
    token,
    user,
    role: user?.role || 'guest',
    login,
    logout,
    lastLoginAt,
  };
}

/**
 * UI 偏好便捷 Hook
 */
export function useUI() {
  const { theme, setTheme, toggleTheme, primaryColor, setPrimaryColor, collapsed, toggleSidebar, locale, setLocale, filters, setFilter, clearAllFilters } = useUIStore();

  return {
    theme, primaryColor, locale, collapsed, filters,
    setTheme, toggleTheme,
    setPrimaryColor, setLocale, toggleSidebar,
    setFilter, clearAllFilters,
  };
}

/**
 * 搜索历史便捷 Hook
 */
export function useSearchHistory() {
  const { keywords, advanced, addKeyword, removeKeyword, clearKeywords } = useSearchHistoryStore();
  return { keywords, advanced, addKeyword, removeKeyword, clearKeywords };
}

/**
 * 应用配置便捷 Hook
 */
export function useAppConfig() {
  return useAppConfigStore();
}

// ═════════════════════════════════════════
// 🟡 P1-2: 默认导出（供外部使用
// ═════════════════════════════════════════

export default {
  useAuthStore,
  useUIStore,
  useSearchHistoryStore,
  useAppConfigStore,
  getAuthInfo,
  clearAllPersistedState,
  exportPersistedData,
  importPersistedData,
  useAuth,
  useUI,
  useSearchHistory,
  useAppConfig,
};
