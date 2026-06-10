import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/safeLogger';


export function usePerformanceMonitor() {
  const startTime = useRef(performance.now());
  const navigationStart = useRef(window.performance.timing.navigationStart);

  useEffect(() => {
    const observer = new PerformanceObserver((entries: PerformanceObserverEntryList) => {
      entries.getEntries().forEach((entry: PerformanceEntry) => {
        if (entry.entryType === 'measure') {
          logger.info(`Performance measure: ${entry.name} = ${entry.duration.toFixed(2)}ms`);
        }
      });
    });

    observer.observe({ entryTypes: ['measure', 'navigation'] });

    return () => observer.disconnect();
  }, []);

  const mark = useCallback((name: string) => {
    performance.mark(name);
  }, []);

  const measure = useCallback((name: string, startMark: string, endMark: string) => {
    performance.measure(name, startMark, endMark);
  }, []);

  const getLoadTime = useCallback(() => {
    return (performance.now() - startTime.current).toFixed(2);
  }, []);

  const getNavigationTime = useCallback(() => {
    return (performance.now() - navigationStart.current).toFixed(2);
  }, []);

  return {
    mark,
    measure,
    getLoadTime,
    getNavigationTime,
  };
}

export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: unknown[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  ) as T;
}

export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  limit: number,
): T {
  const inThrottle = useRef(false);

  return useCallback(
    (...args: unknown[]) => {
      if (!inThrottle.current) {
        callback(...args);
        inThrottle.current = true;
        setTimeout(() => {
          inThrottle.current = false;
        }, limit);
      }
    },
    [callback, limit],
  ) as T;
}

export function useIntersectionObserver<T extends HTMLElement>(
  callback: (isIntersecting: boolean) => void,
  options: IntersectionObserverInit = {},
): (node: T | null) => void {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return useCallback(
    (node: T | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            callback(entry.isIntersecting);
          },
          {
            root: null,
            rootMargin: '0px',
            threshold: 0.1,
            ...options,
          },
        );

        observerRef.current.observe(node);
      }
    },
    [callback, options],
  );
}
