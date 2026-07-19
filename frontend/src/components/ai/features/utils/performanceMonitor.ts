import { logger } from '@/utils/safeLogger';

interface PerformanceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timing: {
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
  components: {
    messageCount: number;
    renderTime: number;
    virtualScrollMetrics?: {
      visibleItems: number;
      totalItems: number;
      scrollFPS: number;
    };
  };
}

interface PerformanceConfig {
  enabled: boolean;
  samplingInterval: number; // ms
  maxHistoryLength: number;
  thresholds: {
    memoryWarningMB: number;
    memoryCriticalMB: number;
    fpsWarning: number;
    renderTimeWarningMs: number;
  };
  onMemoryWarning?: (usage: number) => void;
  onMemoryCritical?: (usage: number) => void;
  onPerformanceDegraded?: (metrics: PerformanceMetrics) => void;
}

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metricsHistory: PerformanceMetrics[] = [];
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentFPS = 60;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: true,
      samplingInterval: 5000,
      maxHistoryLength: 100,
      thresholds: {
        memoryWarningMB: 150,
        memoryCriticalMB: 250,
        fpsWarning: 30,
        renderTimeWarningMs: 100,
      },
      ...config,
    };

    if (typeof window !== 'undefined' && 'performance' in window) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (!this.config.enabled) return;

    logger.info('[PerformanceMonitor] 初始化性能监控', {
      samplingInterval: this.config.samplingInterval,
      thresholds: this.config.thresholds,
    });

    this.startMonitoring();
    this.startFPSMonitor();
  }

  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      try {
        const metrics = this.collectMetrics();
        this.metricsHistory.push(metrics);

        if (this.metricsHistory.length > this.config.maxHistoryLength) {
          this.metricsHistory.shift();
        }

        this.checkThresholds(metrics);
      } catch (error) {
        logger.warn('[PerformanceMonitor] 收集指标失败:', error);
      }
    }, this.config.samplingInterval);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    logger.info('[PerformanceMonitor] 性能监控已停止');
  }

  private startFPSMonitor(): void {
    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime) {
        const delta = timestamp - this.lastFrameTime;
        this.currentFPS = 1000 / delta;
        this.frameCount++;

        if (this.frameCount % 60 === 0) {
          if (this.currentFPS < this.config.thresholds.fpsWarning) {
            logger.warn(`[PerformanceMonitor] FPS 降低: ${Math.round(this.currentFPS)}`);

            const latest = this.getLatestMetrics();
            if (latest) {
              this.config.onPerformanceDegraded?.(latest);
            }
          }
        }
      }

      this.lastFrameTime = timestamp;
      this.rafId = requestAnimationFrame(measureFPS);
    };

    this.rafId = requestAnimationFrame(measureFPS);
  }

  collectMetrics(): PerformanceMetrics {
    const memoryUsage = this.getMemoryUsage();
    const timing = this.getTimingMetrics();
    const components = this.getComponentMetrics();

    return { memoryUsage, timing, components };
  }

  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    const memory = (performance as any).memory;

    if (!memory) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
      };
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  private getTimingMetrics(): PerformanceMetrics['timing'] {
    const navigation = performance.getEntriesByType('navigation')[0] as any;

    if (!navigation) {
      return {
        domContentLoaded: 0,
        loadComplete: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
      };
    }

    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find((e) => e.name === 'first-paint')?.startTime || 0;
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint')?.startTime || 0;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      loadComplete: navigation.loadEventEnd - navigation.startTime,
      firstPaint,
      firstContentfulPaint: fcp,
    };
  }

  private getComponentMetrics(): PerformanceMetrics['components'] {
    const messageContainer = document.querySelector('[data-testid="message-list"]');

    if (!messageContainer) {
      return {
        messageCount: 0,
        renderTime: 0,
      };
    }

    const messages = messageContainer.querySelectorAll('[data-testid="chat-message"]');
    const startTime = performance.now();

    forceLayout(messageContainer as HTMLElement);

    const renderTime = performance.now() - startTime;

    let virtualScrollMetrics: PerformanceMetrics['components']['virtualScrollMetrics'];

    const scrollContainer = document.querySelector('[data-testid="virtual-scroll-container"]');
    if (scrollContainer) {
      const visibleItems = scrollContainer.querySelectorAll(':scope > [data-visible="true"]').length;
      const totalItems = messages.length;

      virtualScrollMetrics = {
        visibleItems,
        totalItems,
        scrollFPS: this.currentFPS,
      };
    }

    return {
      messageCount: messages.length,
      renderTime,
      virtualScrollMetrics,
    };
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const memoryMB = metrics.memoryUsage.usedJSHeapSize / (1024 * 1024);

    if (memoryMB > this.config.thresholds.memoryCriticalMB) {
      logger.error(
        `[PerformanceMonitor] ⚠️ 内存使用严重超标: ${memoryMB.toFixed(1)}MB (阈值: ${this.config.thresholds.memoryCriticalMB}MB)`,
      );

      this.config.onMemoryCritical?.(memoryMB);
      this.suggestGarbageCollection();
    } else if (memoryMB > this.config.thresholds.memoryWarningMB) {
      logger.warn(
        `[PerformanceMonitor] 内存使用偏高: ${memoryMB.toFixed(1)}MB (阈值: ${this.config.thresholds.memoryWarningMB}MB)`,
      );

      this.config.onMemoryWarning?.(memoryMB);
    }

    if (metrics.components.renderTime > this.config.thresholds.renderTimeWarningMs) {
      logger.warn(`[PerformanceMonitor] 渲染时间过长: ${metrics.components.renderTime.toFixed(1)}ms`);
    }
  }

  private suggestGarbageCollection(): void {
    if (window.gc) {
      try {
        window.gc();
        logger.info('[PerformanceMonitor] 已触发垃圾回收');
      } catch (error) {
        logger.warn('[PerformanceMonitor] 垃圾回收失败:', error);
      }
    } else {
      logger.debug('[PerformanceMonitor] 环境不支持手动 GC (--expose-gc)');
    }
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(): readonly PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  getCurrentFPS(): number {
    return Math.round(this.currentFPS);
  }

  getMemoryUsageMB(): number {
    const metrics = this.getLatestMetrics();
    if (!metrics) return 0;
    return metrics.memoryUsage.usedJSHeapSize / (1024 * 1024);
  }

  generateReport(): string {
    const latest = this.getLatestMetrics();
    if (!latest) return '暂无性能数据';

    const avgRenderTime =
      this.metricsHistory.reduce((sum, m) => sum + m.components.renderTime, 0) / this.metricsHistory.length;
    const peakMemory = Math.max(...this.metricsHistory.map((m) => m.memoryUsage.usedJSHeapSize));
    const minFPS = Math.min(...this.metricsHistory.map(() => this.currentFPS));

    return `
=== 性能监控报告 ===
📊 采样点数: ${this.metricsHistory.length}
💾 峰值内存: ${(peakMemory / (1024 * 1024)).toFixed(1)} MB
⚡ 平均渲染时间: ${avgRenderTime.toFixed(1)} ms
🎯 最低 FPS: ${minFPS}
📈 当前 FPS: ${this.getCurrentFPS()}
🎨 首次内容绘制: ${latest.timing.firstContentfulPaint.toFixed(0)} ms
💬 消息数量: ${latest.components.messageCount}
${
  latest.components.virtualScrollMetrics
    ? `
📜 虚拟滚动:
   可见项: ${latest.components.virtualScrollMetrics.visibleItems}/${latest.components.virtualScrollMetrics.totalItems}
`
    : ''
}
`.trim();
  }

  clearHistory(): void {
    this.metricsHistory = [];
    logger.info('[PerformanceMonitor] 性能历史记录已清空');
  }

  destroy(): void {
    this.stopMonitoring();
    this.clearHistory();
    logger.info('[PerformanceMonitor] 实例已销毁');
  }
}

function forceLayout(element: HTMLElement): void {
  void element.offsetHeight;
}

export { PerformanceMonitor, type PerformanceConfig, type PerformanceMetrics };
export default PerformanceMonitor;
