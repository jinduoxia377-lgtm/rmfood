/**
 * 🔒 P3-4: 前端性能监控 - Web Vitals 采集
 *
 * 采集核心 Web 指标 (Core Web Vitals):
 * 1. LCP (Largest Contentful Paint) - 最大内容绘制 (<2.5s 良好)
 * 2. FID (First Input Delay) - 首次输入延迟 (<100ms 良好)
 * 3. CLS (Cumulative Layout Shift) - 累积布局偏移 (<0.1 良好)
 * 4. TTFB (Time to First Byte) - 首字节时间 (<800ms 良好)
 * 5. INP (Interaction to Next Paint) - 交互到下一绘制 (<200ms 良好)
 * 6. FCP (First Contentful Paint) - 首次内容绘制 (<1.8s 良好)
 *
 * 使用方式:
 *   // 在 main.tsx 中调用
 *   import { initPerformanceMonitoring } from '@/utils/performance'
 *   initPerformanceMonitoring({
 *     enabled: true,
 *     endpoint: '/api/v1/metrics/client-perf',
 *     sampleRate: 0.5, // 50% 采样率
 *   })
 */

import { logger } from '@/utils/safeLogger';
// Web Vitals 指标类型
export type VitalMetric = {
  name: string; // 指标名称
  value: number; // 指标值（毫秒或小数）
  id: string; // 指标唯一 ID
  delta: number; // 与上次的差值
  rating: 'good' | 'needs-improvement' | 'poor'; // 评级
  navigationType?: string; // 导航类型
  attribution?: Record<string, any>; // 归属信息
};

// 性能配置
export interface PerformanceConfig {
  enabled: boolean;
  endpoint?: string; // 上报端点
  sampleRate?: number; // 采样率 (0.0 ~ 1.0)
  batchSize?: number; // 批量上报大小
  batchInterval?: number; // 批量上报间隔 (ms)
  debug?: boolean; // 是否开启调试日志
  reportOnUnload?: boolean; // 页面卸载时是否上报
  userIdentifier?: string; // 用户标识（匿名 ID）
}

// 默认配置
const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true,
  sampleRate: 0.5,
  batchSize: 10,
  batchInterval: 5000,
  debug: false,
  reportOnUnload: true,
};

let config: PerformanceConfig = DEFAULT_CONFIG;
let metrics: VitalMetric[] = [];
let customMetrics: Record<string, number> = {};
let pageLoadStart: number = Date.now();
let isInitialized = false;
let reportTimer: number | null = null;
let pendingReports: any[] = [];

// 简单的匿名 ID（用于关联同一用户的多次会话）
function getOrCreateSessionId(): string {
  try {
    const key = 'rmfood_perf_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'sess_' + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * 🔒 P3-4: 根据阈值进行评级
 */
function rateMetric(name: string, value: number): VitalMetric['rating'] {
  const thresholds: Record<string, [number, number]> = {
    // [good_max, needs-improvement_max]
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    TTFB: [800, 1800],
    INP: [200, 500],
    FCP: [1800, 3000],
    'TTFB-request': [500, 1500],
  };

  const [good, need] = thresholds[name] || [1000, 2000];
  if (value <= good) return 'good';
  if (value <= need) return 'needs-improvement';
  return 'poor';
}

/**
 * 🔒 P3-4: 采集 LCP (Largest Contentful Paint)
 */
function observeLCP(callback: (metric: VitalMetric) => void) {
  try {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];

      if (lastEntry) {
        const value = Math.max(lastEntry.startTime, 0);
        callback({
          name: 'LCP',
          value: value,
          id: 'v3-' + value,
          delta: value,
          rating: rateMetric('LCP', value),
          attribution: {
            element: (lastEntry.element?.tagName || 'unknown',
            url: (lastEntry.url || 'n/a',
            renderTime: 0,
            loadTime: 0,
          },
        });
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    if (config.debug) logger.warn('[Perf] LCP observer not supported');
  }
}

/**
 * 🔒 P3-4: 采集 CLS (Cumulative Layout Shift)
 */
function observeCLS(callback: (metric: VitalMetric) => void) {
  try {
    if (typeof PerformanceObserver === 'undefined') return;

    let clsValue = 0;
    let clsEntries: PerformanceEntry[] = [];
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        // 只记录非用户输入的布局偏移
        if (!(entry.hadRecentInput) {
          const shiftValue = (entry.value;
          sessionValue += shiftValue;
          sessionEntries.push(entry);

          // 每隔一段时间计算一次 session
          const currentSession = Math.max(sessionValue);
          if (currentSession > clsValue) {
            clsValue = currentSession;
            clsEntries = [...sessionEntries];

            callback({
              name: 'CLS',
              value: clsValue,
              id: 'v3-' + clsValue.toFixed(4),
              delta: shiftValue,
              rating: rateMetric('CLS', clsValue),
              attribution: {
                shiftCount: clsEntries.length,
                lastShiftTime: entry.startTime,
              },
            });
          }

          // 1 秒后重置 session
          setTimeout(() => {
            if (Date.now() - (entry.startTime || 0) > 1000) {
              sessionValue = 0;
              sessionEntries = [];
            }
          }, 1000);
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    if (config.debug) logger.warn('[Perf] CLS observer not supported');
  }
}

/**
 * 🔒 P3-4: 采集 FID (First Input Delay) / INP (Interaction to Next Paint)
 */
function observeFID(callback: (metric: VitalMetric) => void) {
  try {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const delay = (entry.processingStart - entry.startTime;
        callback({
          name: 'FID',
          value: delay,
          id: 'v3-' + delay,
          delta: delay,
          rating: rateMetric('FID', delay),
          attribution: {
            eventType: entry.name,
            eventTime: entry.startTime,
          },
        });
      }
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    if (config.debug) logger.warn('[Perf] FID observer not supported');
  }
}

/**
 * 🔒 P3-4: 采集 FCP (First Contentful Paint)
 */
function observeFCP(callback: (metric: VitalMetric) => void) {
  try {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const value = entry.startTime;
        callback({
          name: 'FCP',
          value: value,
          id: 'v3-' + value,
          delta: value,
          rating: rateMetric('FCP', value),
        });
      }
    });

    observer.observe({ type: 'paint', buffered: true });
  } catch (e) {
    if (config.debug) logger.warn('[Perf] FCP observer not supported');
  }
}

/**
 * 🔒 P3-4: 采集 TTFB (Time to First Byte) — 从 Navigation Timing 获取
 */
function collectTTFB(callback: (metric: VitalMetric) => void) {
  try {
    // 使用 Navigation Timing API
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      const ttfb = navEntry.responseStart - navEntry.requestStart;
      callback({
        name: 'TTFB',
        value: ttfb,
        id: 'v3-ttfb-' + ttfb,
        delta: ttfb,
        rating: rateMetric('TTFB', ttfb),
        attribution: {
          navigationType: navEntry.type,
          domInteractive: navEntry.domInteractive,
          domContentLoaded: navEntry.domContentLoadedEventEnd,
          loadEvent: navEntry.loadEventEnd,
        },
      });
    }
  } catch (e) {
    if (config.debug) logger.warn('[Perf] TTFB collection failed');
  }
}

/**
 * 🔒 P3-4: 采集页面加载完整指标
 */
function collectPageLoad(callback: (metric: VitalMetric) => void) {
  if (document.readyState === 'complete') {
    const loadTime = performance.now();
    callback({
      name: 'PAGE_LOAD',
      value: loadTime,
      id: 'v3-page-' + loadTime,
      delta: loadTime,
      rating: rateMetric('PAGE_LOAD', loadTime),
    });
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const loadTime = performance.now();
        callback({
          name: 'PAGE_LOAD',
          value: loadTime,
          id: 'v3-page-' + loadTime,
          delta: loadTime,
          rating: rateMetric('PAGE_LOAD', loadTime),
        });
      }, 0);
    });
  }
}

/**
 * 🔒 P3-4: 自定义指标（用于业务特定的性能测量）
 */
export function startPerfTimer(name: string): () => number {
  const start = performance.now();
  return () => {
    const elapsed = performance.now() - start;
    customMetrics[name] = elapsed;

    if (config.debug) {
      logger.info(`[Perf] ${name}: ${elapsed.toFixed(2)}ms`);
    }

    // 自动上报自定义指标
    const metric: VitalMetric = {
      name: name.toUpperCase(),
      value: elapsed,
      id: 'custom-' + name + '-' + Date.now(),
      delta: elapsed,
      rating: rateMetric(name, elapsed),
    };
    metrics.push(metric);
    scheduleReport();

    return elapsed;
  };
}

/**
 * 🔒 P3-4: 标记关键时间点
 */
export function markPerfTiming(name: string): void {
  try {
    performance.mark(name);
    customMetrics[name] = performance.now();

    if (config.debug) {
      logger.info(`[Perf] Marked: ${name} at ${performance.now().toFixed(2)}ms`);
    }
  } catch (e) {
    // performance.mark 可能在某些环境失败
  }
}

/**
 * 🔒 P3-4: 处理并存储指标
 */
function handleMetric(metric: VitalMetric) {
  if (!config.enabled) return;

  // 采样率检查
  if (config.sampleRate && Math.random() > config.sampleRate) return;

  metrics.push(metric);

  if (config.debug) {
    logger.info(`[Perf] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`);
  }

  // 关键指标达到阈值时立即上报
  if (
    (metric.name === 'LCP' && metric.rating === 'poor') ||
    (metric.name === 'CLS' && metric.rating === 'poor') ||
    (metric.name === 'INP' && metric.rating === 'poor')
  ) {
    scheduleReport(true);
  } else {
    scheduleReport();
  }
}

/**
 * 🔒 P3-4: 构建上报数据
 */
function buildReportPayload(): any {
  const deviceInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    devicePixelRatio: window.devicePixelRatio,
    connection: (navigator.connection
      ? {
          effectiveType: (navigator.connection.effectiveType,
          downlink: (navigator.connection.downlink,
          rtt: (navigator.connection.rtt,
        }
      : null,
    memory: (navigator.deviceMemory || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
  };

  return {
    sessionId: getOrCreateSessionId(),
    userIdentifier: config.userIdentifier || null,
    timestamp: new Date().toISOString(),
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    pageLoadTime: Date.now() - pageLoadStart,
    metrics: metrics,
    customMetrics: customMetrics,
    device: deviceInfo,
    performance: {
      navigationTiming: getNavigationTimingSummary(),
      memory: getMemoryUsage(),
    },
    env: {
      isDebug: config.debug,
      sampleRate: config.sampleRate,
    },
  };
}

/**
 * 🔒 P3-4: 获取导航时间摘要
 */
function getNavigationTimingSummary(): any {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!nav) return null;

    return {
      redirectCount: nav.redirectCount,
      type: nav.type,
      dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
      tcpConnect: nav.connectEnd - nav.connectStart,
      sslNegotiation: nav.secureConnectionStart ? nav.connectEnd - nav.secureConnectionStart : 0,
      ttfb: nav.responseStart - nav.requestStart,
      contentDownload: nav.responseEnd - nav.responseStart,
      domInteractive: nav.domInteractive,
      domContentLoaded: nav.domContentLoadedEventEnd,
      domComplete: nav.domComplete,
      loadEvent: nav.loadEventEnd,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 🔒 P3-4: 获取内存使用
 */
function getMemoryUsage(): any {
  try {
    const perf = performance as any;
    if (perf.memory) {
      return {
        usedMB: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024),
        limitMB: Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024),
        percent: ((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100).toFixed(2),
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 🔒 P3-4: 上报到服务器（使用 sendBeacon 或 fetch）
 */
function sendReport(payload: any) {
  if (!config.endpoint) {
    if (config.debug) logger.info('[Perf] Report (no endpoint):', payload);
    return;
  }

  try {
    const body = JSON.stringify(payload);

    // 使用 sendBeacon（页面卸载时更可靠）
    if (navigator.sendBeacon) {
      const result = navigator.sendBeacon(config.endpoint, new Blob([body], { type: 'application/json' }));
      if (result) return;
      // sendBeacon 返回 false 表示请求被拒绝，静默忽略
    }

    // 回退到 fetch（keepalive）— 仅在页面活跃时使用
    if (!document.hidden) {
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(() => {
        // 静默忽略上报失败，避免页面卸载时产生 ERR_ABORTED
      });
    }
  } catch {
    // 静默忽略上报序列化失败
  }
}

/**
 * 🔒 P3-4: 调度批量上报
 */
function scheduleReport(immediate: boolean = false) {
  if (!config.endpoint) return;

  pendingReports.push(...metrics);
  metrics = [];

  const shouldReportNow =
    immediate || pendingReports.length >= (config.batchSize || 10) || pendingReports.some((m) => m.rating === 'poor');

  if (shouldReportNow) {
    const payload = buildReportPayload();
    pendingReports = [];
    sendReport(payload);
    return;
  }

  // 延迟批量上报
  if (reportTimer) clearTimeout(reportTimer);
  reportTimer = window.setTimeout(() => {
    const payload = buildReportPayload();
    pendingReports = [];
    sendReport(payload);
  }, config.batchInterval || 5000);
}

/**
 * 🔒 P3-4: 获取当前性能摘要
 */
export function getPerformanceSummary(): {
  metrics: VitalMetric[];
  custom: Record<string, number>;
  memory?: any;
  navigation?: any;
} {
  return {
    metrics: metrics,
    custom: customMetrics,
    memory: getMemoryUsage(),
    navigation: getNavigationTimingSummary(),
  };
}

/**
 * 🔒 P3-4: 主初始化函数
 */
export function initPerformanceMonitoring(userConfig: Partial<PerformanceConfig> = {}) {
  if (isInitialized) return;
  isInitialized = true;

  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (!config.enabled) {
    if (config.debug) logger.info('[Perf] Monitoring disabled');
    return;
  }

  if (config.debug) {
    logger.info('[Perf] Initializing performance monitoring', config);
  }

  // 初始化观察者
  observeLCP(handleMetric);
  observeCLS(handleMetric);
  observeFID(handleMetric);
  observeFCP(handleMetric);

  // 收集 TTFB
  collectTTFB(handleMetric);

  // 页面加载完成后收集总时间
  collectPageLoad(handleMetric);

  // 🔒 P3-4: 页面卸载前强制上报
  if (config.reportOnUnload) {
    const unloadHandler = () => {
      if (pendingReports.length > 0 || metrics.length > 0) {
        const payload = buildReportPayload();
        sendReport(payload);
      }
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        unloadHandler();
      }
    });

    window.addEventListener('pagehide', unloadHandler);
    window.addEventListener('beforeunload', unloadHandler);
  }

  // 🔒 P3-4: 定期上报（即使没有变化也采样）
  if (config.batchInterval) {
    setInterval(
      () => {
        if (pendingReports.length > 0) {
          const payload = buildReportPayload();
          pendingReports = [];
          sendReport(payload);
        }
      },
      Math.max(config.batchInterval, 30000),
    ); // 至少 30 秒
  }
}

/**
 * 🔒 P3-4: 便捷的 React Hook 包装
 */
export function usePerformance(enabled: boolean = true) {
  return {
    startTimer: startPerfTimer,
    mark: markPerfTiming,
    getSummary: getPerformanceSummary,
    init: initPerformanceMonitoring,
  };
}

// 暴露为全局对象（便于调试）
if (typeof window !== 'undefined') {
  window.__RMFOOD_PERF__ = {
    init: initPerformanceMonitoring,
    getSummary: getPerformanceSummary,
    startTimer: startPerfTimer,
    mark: markPerfTiming,
    record: (name: string, value: number) => {
      customMetrics[name] = value;
      metrics.push({
        name: name.toUpperCase(),
        value: value,
        id: 'manual-' + name + '-' + Date.now(),
        delta: value,
        rating: rateMetric(name, value),
      });
    },
  };
}
