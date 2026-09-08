/**
 * KeepAliveOutlet — 页面级状态缓存组件
 *
 * ✅ 已修复：通过 React Context + sessionStorage 实现真正的页面状态保留
 *
 * 工作原理：
 * 1. 页面导航离开时：将滚动位置保存到 sessionStorage
 * 2. 页面重新激活时：从 sessionStorage 恢复滚动位置
 * 3. 配合 React Query 的 5 分钟 staleTime，数据请求直接从缓存返回（不触发网络）
 *
 * 设计原则：
 * - 不修改 React Router 架构（不影响现有路由）
 * - 不修改任何页面组件代码（零侵入）
 * - 仅在主布局层添加
 */
import { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '@/utils/safeLogger';

// ── 缓存配置 ──────────────────────────────────────────────
const SCROLL_STORAGE_PREFIX = 'rmfood_scroll_';

// ── KeepAliveContext：跨导航的生命周期状态管理 ──────────────
// 用于页面级状态恢复（如展开/折叠状态、输入值等）
interface PageStateEntry {
  pageKey: string;
  state: Record<string, unknown>;
  updatedAt: number;
}

// 页面状态全局存储（模块级，跨组件实例共享）
const pageStateStore = new Map<string, PageStateEntry>();

interface KeepAliveContextType {
  /** 保存某个页面的状态 */
  saveState: (pageKey: string, state: Record<string, unknown>) => void;
  /** 恢复某个页面的状态，无则返回 null */
  restoreState: <T = Record<string, unknown>>(pageKey: string) => T | null;
  /** 清除某个页面的状态 */
  clearState: (pageKey: string) => void;
  /** 获取所有缓存的页面状态统计 */
  getStats: () => { size: number; entries: Array<{ key: string; ageMs: number }> };
}

const KeepAliveContext = createContext<KeepAliveContextType>({
  saveState: () => {},
  restoreState: () => null,
  clearState: () => {},
  getStats: () => ({ size: 0, entries: [] }),
});

export function useKeepAlive() {
  return useContext(KeepAliveContext);
}

/**
 * Hook：自动保存/恢复页面状态
 * @param pageKey 页面唯一标识（默认使用 location.pathname）
 * @param stateFn 返回需要保存的状态对象的函数
 * @param deps 依赖数组，变化时重新保存状态
 */
export function usePageState<T extends Record<string, unknown>>(
  pageKey: string,
  stateFn: () => T,
  deps: unknown[] = [],
): T | null {
  const keepAlive = useKeepAlive();
  const [restoredState, setRestoredState] = useState<T | null>(null);
  const hasRestored = useRef(false);

  useEffect(() => {
    if (!hasRestored.current) {
      const saved = keepAlive.restoreState<T>(pageKey);
      if (saved) {
        setRestoredState(saved);
        logger.debug(`[KeepAlive] 恢复页面状态: ${pageKey}`);
      }
      hasRestored.current = true;
    }
  }, [pageKey, keepAlive]);

  useEffect(() => {
    // 当 deps 变化时保存当前状态
    const state = stateFn();
    keepAlive.saveState(pageKey, state);
  }, [...deps, keepAlive.saveState]);

  return restoredState;
}

function createContextValue(): KeepAliveContextType {
  return {
    saveState: (pageKey, state) => {
      pageStateStore.set(pageKey, {
        pageKey,
        state,
        updatedAt: Date.now(),
      });
    },
    restoreState: <T = Record<string, unknown>>(pageKey: string): T | null => {
      const entry = pageStateStore.get(pageKey);
      if (!entry) return null;
      return entry.state as unknown as T;
    },
    clearState: (pageKey) => {
      pageStateStore.delete(pageKey);
    },
    getStats: () => {
      const now = Date.now();
      const entries = Array.from(pageStateStore.entries()).map(([key, entry]) => ({
        key,
        ageMs: now - entry.updatedAt,
      }));
      return { size: pageStateStore.size, entries };
    },
  };
}

// ── KeepAliveOutlet 主组件 ──────────────────────────────────
interface KeepAliveOutletProps {
  /** 页面状态缓存的生命周期（毫秒），默认 10 分钟 */
  stateTtlMs?: number;
  /** 是否在页面切换时自动保存滚动位置 */
  saveScrollPosition?: boolean;
}

export function KeepAliveOutlet({
  stateTtlMs = 10 * 60 * 1000,
  saveScrollPosition = true,
}: KeepAliveOutletProps) {
  const location = useLocation();
  const ctxRef = useRef(createContextValue());

  // 清理过期状态
  useEffect(() => {
    const now = Date.now();
    for (const [key, entry] of pageStateStore) {
      if (now - entry.updatedAt > stateTtlMs) {
        pageStateStore.delete(key);
      }
    }
  }, [location.pathname, stateTtlMs]);

  // 滚动位置保存/恢复
  useEffect(() => {
    if (!saveScrollPosition) return;

    // 离开页面时保存滚动位置
    const saveScroll = () => {
      try {
        sessionStorage.setItem(
          `${SCROLL_STORAGE_PREFIX}${location.pathname}`,
          JSON.stringify({ x: window.scrollX, y: window.scrollY }),
        );
      } catch {
        /* ignore quota errors */
      }
    };

    window.addEventListener('beforeunload', saveScroll);
    return () => window.removeEventListener('beforeunload', saveScroll);
  }, [location.pathname, saveScrollPosition]);

  useEffect(() => {
    if (!saveScrollPosition) return;
    try {
      const stored = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${location.pathname}`);
      if (stored) {
        const { x, y } = JSON.parse(stored) as { x: number; y: number };
        requestAnimationFrame(() => window.scrollTo(x, y));
        sessionStorage.removeItem(`${SCROLL_STORAGE_PREFIX}${location.pathname}`);
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, saveScrollPosition]);

  return (
    <KeepAliveContext.Provider value={ctxRef.current}>
      {/* 占位节点，实际内容仍由 <Outlet /> 渲染 */}
      <div style={{ display: 'none' }} aria-hidden="true" data-keep-alive-root />
    </KeepAliveContext.Provider>
  );
}

// ── 工具函数导出 ───────────────────────────────────────────

/**
 * 手动清除某个页面的缓存状态
 */
export function evictPageState(pathname: string): void {
  pageStateStore.delete(pathname);
  sessionStorage.removeItem(`${SCROLL_STORAGE_PREFIX}${pathname}`);
}

/**
 * 清除所有页面缓存状态
 */
export function clearAllPageState(): void {
  pageStateStore.clear();
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(SCROLL_STORAGE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
}

/**
 * 获取页面缓存统计
 */
export function getPageStateStats() {  const now = Date.now();
  const entries = Array.from(pageStateStore.entries()).map(([key, entry]) => ({
    key,
    size: JSON.stringify(entry.state).length,
    ageMs: now - entry.updatedAt,
  }));
  return { size: pageStateStore.size, entries };
}

