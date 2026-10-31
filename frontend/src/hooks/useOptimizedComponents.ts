import React, { memo, useMemo, useCallback, useRef } from 'react';

export type PropertyComparator<T> = (prevProps: T, nextProps: T) => boolean;

export function createPropComparator<T>(keys: (keyof T)[]): PropertyComparator<T> {
  return (prevProps: T, nextProps: T) => {
    return keys.every((key) => {
      const prevValue = prevProps[key];
      const nextValue = nextProps[key];
      if (prevValue === nextValue) return true;
      if (typeof prevValue === 'object' && typeof nextValue === 'object') {
        return JSON.stringify(prevValue) === JSON.stringify(nextValue);
      }
      return false;
    });
  };
}

export function deepCompare<T>(prevProps: T, nextProps: T): boolean {
  const prevKeys = Object.keys(prevProps as object);
  const nextKeys = Object.keys(nextProps as object);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    const prevValue = (prevProps as Record<string, unknown>)[key];
    const nextValue = (nextProps as Record<string, unknown>)[key];
    if (prevValue === nextValue) continue;
    if (typeof prevValue === 'object' && typeof nextValue === 'object') {
      if (!deepCompare(prevValue, nextValue)) return false;
    } else {
      return false;
    }
  }
  return true;
}

export function optimizedMemo<T extends React.ComponentType<any>>(
  Component: T,
  comparator?: PropertyComparator<React.ComponentProps<T>>,
): T {
  return memo(Component, comparator as (a: T, b: T) => boolean) as unknown as T;
}

// NOTE: useDebouncedCallback has been moved to hooks/useDebounce.ts
// Import from there instead of this file.

export function useThrottledCallback<T extends (...args: any[]) => any>(callback: T, delay = 300): T {
  const lastCallRef = useRef(0);
  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      }
    }) as unknown as unknown as T,
    [callback, delay],
  );
}

export function useComputed<T>(compute: () => T, deps: React.DependencyList): T {
  return useMemo(compute, deps);
}

export const OptimizedCondition = memo<{
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}>(({ condition, children, fallback }) => {
  if (condition) {
    return React.createElement(React.Fragment, null, children);
  }
  return fallback ? React.createElement(React.Fragment, null, fallback) : null;
});

export const OptimizedList = memo<{
  items: unknown[];
  renderItem: (item: unknown, index: number) => React.ReactNode;
  keyExtractor: (item: unknown, index: number) => string | number;
  className?: string;
}>(({ items, renderItem, keyExtractor, className }) => {
  const children = items.map((item, index) => {
    return React.createElement(React.Fragment, { key: keyExtractor(item, index) }, renderItem(item, index));
  });
  return React.createElement('div', { className }, children);
});
