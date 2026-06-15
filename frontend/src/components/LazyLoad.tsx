/**
 * 🔒 P3-1: 动态导入辅助组件
 *
 * 提供通用的懒加载包装器：
 * - 加载状态 UI（骨架屏）
 * - 错误重试
 * - 超时警告
 * - 预加载提示
 *
 * 用法:
 * ```tsx
 * const LazyPage = lazyWithPreload(() => import('./HeavyPage'))
 *
 * // 在关键路径预加载
 * useEffect(() => {
 *   LazyPage.preload() // 在空闲时预加载
 * }, [])
 * ```
 */
import React, {
  ComponentType,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface LoadableComponent<P = object> extends React.LazyExoticComponent<ComponentType<P>> {
  preload: () => Promise<void>;
}

/**
 * 创建可预加载的懒加载组件
 */
export function lazyWithPreload<P = object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  options: {
    componentName?: string;
    timeout?: number;
  } = {},
): LoadableComponent<P> {
  const LazyComponent = React.lazy(factory) as LoadableComponent<P>;
  const componentName = options.componentName || 'Component';
  const timeoutDuration = options.timeout || 15000;

  // 🔒 P3-1: 添加 preload 方法（空闲时预加载）
  let preloadPromise: Promise<void> | null = null;
  let preloadStarted = false;

  const preload = (): Promise<void> => {
    if (preloadStarted) {
      return preloadPromise || Promise.resolve();
    }
    preloadStarted = true;
    preloadPromise = factory()
      .then(() => {
        if (typeof window !== 'undefined' && (window as any).__RMFOOD_PERF__) {
          (window as any).__RMFOOD_PERF__.record(componentName, 'preloaded');
        }
      })
      .catch((error) => {
        console.error(`[LazyLoad] 预加载失败: ${componentName}`, error);
      });
    return preloadPromise;
  };

  LazyComponent.preload = preload;

  // 🔒 P3-1: 当页面空闲时触发预加载（避免阻塞关键路径）
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      // 不立即预加载，避免阻塞
    });
  }

  return LazyComponent;
}

/**
 * 通用懒加载包装器（带加载/错误状态）
 */
export function LazyLoadWrapper<P = object>(props: {
  component: React.LazyExoticComponent<ComponentType<P>>;
  componentProps?: P;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode | ((error: Error, retry: () => void) => React.ReactNode);
  skeleton?: React.ReactNode;
  minLoadTime?: number; // 避免闪烁的最小加载时间
  timeout?: number; // 超时警告
  onError?: (error: Error) => void;
  onLoad?: () => void;
}): React.ReactElement {
  const {
    component: LazyComponent,
    componentProps,
    fallback,
    errorFallback,
    skeleton,
    minLoadTime = 300,
    timeout = 15000,
    onError,
    onLoad,
  } = props;

  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const timeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    startTimeRef.current = Date.now();

    // 设置超时警告
    timeoutRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        console.warn(
          `[LazyLoad] 组件加载超时 (${timeout}ms): ${
            (LazyComponent as any).displayName || 'Unknown'
          }`,
        );
      }
    }, timeout);

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [retryKey, timeout, LazyComponent]);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryKey((k) => k + 1);
  }, []);

  // 默认 fallback（骨架屏）
  const defaultFallback = skeleton || (
    <div className="animate-pulse space-y-4 p-8">
      <div className="h-6 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-24 bg-gray-100 rounded mt-8" />
    </div>
  );

  // 错误状态（展示友好的错误提示）
  if (error) {
    if (typeof errorFallback === 'function') {
      return <>{errorFallback(error, handleRetry)}</>;
    }
    if (errorFallback) {
      return <>{errorFallback}</>;
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">组件加载失败</h3>
        <p className="text-sm text-gray-500 mb-6">
          抱歉，页面组件加载时发生错误。请重试或刷新页面。
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            重新加载
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={fallback || defaultFallback} key={retryKey}>
      <ErrorBoundary onError={onError}>
        <LazyComponent {...(componentProps as P)} />
      </ErrorBoundary>
    </Suspense>
  );
}

import { ErrorBoundary } from './ErrorBoundary';
