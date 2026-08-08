/**
 * 性能监控工具
 *
 * @description 提供 React 应用的性能监控和分析功能
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger';
import { useEffect, useRef, useState } from 'react';

export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  components: Record<string, ComponentMetrics>;
}

export interface ComponentMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  prevProps?: string;
  nextProps?: string;
}

export interface UseRenderMonitorOptions {
  enabled?: boolean;
  logToConsole?: boolean;
  maxHistory?: number;
}

const globalMetrics: PerformanceMetrics = {
  renderCount: 0,
  lastRenderTime: 0,
  averageRenderTime: 0,
  components: {},
};

export function useRenderMonitor(componentName: string, options: UseRenderMonitorOptions = {}) {
  const { enabled = process.env.NODE_ENV === 'development', logToConsole = false } = options;
  const renderCountRef = useRef(0);
  const startTimeRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    renderCountRef.current++;
    renderTimesRef.current.push(renderTime);

    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }

    const averageRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;

    globalMetrics.renderCount++;
    globalMetrics.lastRenderTime = renderTime;
    globalMetrics.averageRenderTime = averageRenderTime;

    globalMetrics.components[componentName] = {
      renderCount: renderCountRef.current,
      lastRenderTime: renderTime,
      averageRenderTime,
    };

    if (logToConsole) {
      logger.log(`[${componentName}] Render #${renderCountRef.current} in ${renderTime.toFixed(2)}ms`);
    }

    startTimeRef.current = performance.now();
  });

  useEffect(() => {
    if (enabled) {
      startTimeRef.current = performance.now();
    }
  });

  return {
    renderCount: renderCountRef.current,
    metrics: globalMetrics.components[componentName],
  };
}

export function useRenderTimeTracker() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(globalMetrics);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({ ...globalMetrics });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...globalMetrics };
}

export function resetPerformanceMetrics() {
  globalMetrics.renderCount = 0;
  globalMetrics.lastRenderTime = 0;
  globalMetrics.averageRenderTime = 0;
  globalMetrics.components = {};
}

export function logPerformanceReport() {
  console.group('📊 Performance Report');
  logger.log('Total Renders:', globalMetrics.renderCount);
  logger.log('Last Render Time:', `${globalMetrics.lastRenderTime.toFixed(2)}ms`);
  logger.log('Average Render Time:', `${globalMetrics.averageRenderTime.toFixed(2)}ms`);

  console.group('Components');
  Object.entries(globalMetrics.components).forEach(([name, metrics]) => {
    logger.log(`  ${name}:`, {
      renders: metrics.renderCount,
      last: `${metrics.lastRenderTime.toFixed(2)}ms`,
      avg: `${metrics.averageRenderTime.toFixed(2)}ms`,
    });
  });
  console.groupEnd();

  console.groupEnd();
}

export interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function getMemoryUsage(): MemoryUsage | null {
  const perfWithMemory = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
  if (typeof window !== 'undefined' && perfWithMemory.memory) {
    const memory = perfWithMemory.memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function useMemoryMonitor(enabled = false) {
  const [memory, setMemory] = useState<MemoryUsage | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const updateMemory = () => {
      const mem = getMemoryUsage();
      if (mem) {
        setMemory(mem);
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);

    return () => clearInterval(interval);
  }, [enabled]);

  return memory;
}

export function logMemoryReport() {
  const memory = getMemoryUsage();
  if (memory) {
    console.group('💾 Memory Usage');
    logger.log('Used:', formatBytes(memory.usedJSHeapSize));
    logger.log('Total:', formatBytes(memory.totalJSHeapSize));
    logger.log('Limit:', formatBytes(memory.jsHeapSizeLimit));
    logger.log('Usage %:', `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`);
    console.groupEnd();
  }
}

export interface FPSMonitorOptions {
  targetFPS?: number;
  warnThreshold?: number;
}

export function useFPSMonitor(options: FPSMonitorOptions = {}) {
  const { targetFPS = 60, warnThreshold = 30 } = options;
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const rafId = useRef<number>(0);

  useEffect(() => {
    const measureFPS = () => {
      const now = performance.now();
      frameCount.current++;

      if (now - lastTime.current >= 1000) {
        const currentFPS = Math.round((frameCount.current * 1000) / (now - lastTime.current));
        setFps(currentFPS);

        if (currentFPS < warnThreshold) {
          logger.warn(`FPS dropped to ${currentFPS}, below threshold ${warnThreshold}`);
        }

        frameCount.current = 0;
        lastTime.current = now;
      }

      rafId.current = requestAnimationFrame(measureFPS);
    };

    rafId.current = requestAnimationFrame(measureFPS);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [targetFPS, warnThreshold]);

  return {
    fps,
    isHealthy: fps >= targetFPS,
    isWarning: fps < warnThreshold,
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private marks = new Map<string, number>();
  private measures: { name: string; duration: number; timestamp: number }[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      logger.warn(`Start mark "${startMark}" not found`);
      return;
    }

    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    if (!endTime) {
      logger.warn(`End mark "${endMark}" not found`);
      return;
    }

    const duration = endTime - startTime;
    this.measures.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    if (process.env.NODE_ENV === 'development') {
      logger.log(`⏱️ [${name}] ${duration.toFixed(2)}ms`);
    }
  }

  getMeasures() {
    return [...this.measures];
  }

  clear() {
    this.marks.clear();
    this.measures = [];
  }

  report() {
    console.group('📈 Performance Measures');
    this.measures.forEach((measure) => {
      logger.log(`  ${measure.name}: ${measure.duration.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
