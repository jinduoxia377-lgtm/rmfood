import React, { useState, useEffect, useCallback, useRef, Profiler } from 'react';
import type { ProfilerOnRenderCallback } from 'react';


import { logger } from '@/utils/safeLogger';
interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface RenderMetrics {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  timestamp: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

interface FPSData {
  fps: number;
  timestamp: number;
}

interface BundleInfo {
  name: string;
  size: number;
  path: string;
}

interface PerformanceMonitorProps {
  isVisible?: boolean;
  onMetricsUpdate?: (metrics: {
    webVitals: WebVitalMetric[];
    renderMetrics: RenderMetrics[];
    memory: MemoryInfo | null;
    fpsHistory: FPSData[];
    bundleSize: BundleInfo[];
  }) => void;
  enableWebVitals?: boolean;
  enableMemoryMonitoring?: boolean;
  enableFPSMonitoring?: boolean;
  maxRenderMetrics?: number;
  maxFPSHistory?: number;
  samplingRate?: number;
}

const VITAL_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  TBT: { good: 200, poor: 500 },
};

function getRating(name: string, value: number): WebVitalMetric['rating'] {
  const threshold = VITAL_THRESHOLDS[name as keyof typeof VITAL_THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function PerformanceMonitor({
  isVisible = false,
  onMetricsUpdate,
  enableWebVitals = true,
  enableMemoryMonitoring = true,
  enableFPSMonitoring = true,
  maxRenderMetrics = 50,
  maxFPSHistory = 60,
  samplingRate = 1,
}: PerformanceMonitorProps) {
  const [webVitals, setWebVitals] = useState<WebVitalMetric[]>([]);
  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [fpsHistory, setFpsHistory] = useState<FPSData[]>([]);
  const [bundleSize, setBundleSize] = useState<BundleInfo[]>([]);

  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const fpsIntervalRef = useRef<number | null>(null);
  const memoryIntervalRef = useRef<number | null>(null);
  const metricsUpdateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    if (enableWebVitals) {
      collectWebVitals();
    }

    if (enableMemoryMonitoring && (performance as unknown as { memory?: MemoryInfo }).memory) {
      startMemoryMonitoring();
    }

    if (enableFPSMonitoring) {
      startFPSMonitoring();
    }

    analyzeBundleSize();

    return () => {
      if (fpsIntervalRef.current) cancelAnimationFrame(fpsIntervalRef.current);
      if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current);
      if (metricsUpdateTimeoutRef.current) clearTimeout(metricsUpdateTimeoutRef.current);
    };
  }, [isVisible, enableWebVitals, enableMemoryMonitoring, enableFPSMonitoring]);

  const collectWebVitals = useCallback(() => {
    if (!('PerformanceObserver' in window)) return;

    try {
      const vitalsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metric: WebVitalMetric = {
            name: entry.entryType.toUpperCase(),
            value:
              entry.entryType === 'cls'
                ? ((entry as PerformanceEntry & { value?: number }).value ?? 0)
                : entry.startTime + (entry.duration || 0),
            rating: getRating(
              entry.entryType.toUpperCase(),
              entry.entryType === 'cls'
                ? ((entry as PerformanceEntry & { value?: number }).value ?? 0)
                : entry.startTime + (entry.duration || 0),
            ),
            timestamp: Date.now(),
          };

          setWebVitals((prev) => [...prev.slice(-19), metric]);
        }
      });

      vitalsObserver.observe({ entryTypes: ['paint', 'first-input', 'layout-shift', 'navigation'] });
    } catch (error) {
      logger.warn('[PerformanceMonitor] Web Vitals collection failed:', error);
    }
  }, []);

  const startMemoryMonitoring = useCallback(() => {
    memoryIntervalRef.current = window.setInterval(() => {
      const memory = (performance as unknown as { memory: MemoryInfo }).memory;
      if (memory) {
        const info: MemoryInfo = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          timestamp: Date.now(),
        };
        setMemoryInfo(info);
      }
    }, 2000);
  }, []);

  const startFPSMonitoring = useCallback(() => {
    let lastTime = performance.now();

    const measureFPS = (currentTime: number) => {
      frameCountRef.current++;

      if (currentTime - lastTime >= 1000) {
        const fps = (frameCountRef.current * 1000) / (currentTime - lastTime);
        setFpsHistory((prev) => [
          ...prev.slice(-(maxFPSHistory - 1)),
          { fps: Math.round(fps), timestamp: Date.now() },
        ]);
        frameCountRef.current = 0;
        lastTime = currentTime;
      }

      fpsIntervalRef.current = requestAnimationFrame(measureFPS);
    };

    fpsIntervalRef.current = requestAnimationFrame(measureFPS);
  }, [maxFPSHistory]);

  const analyzeBundleSize = useCallback(async () => {
    try {
      const modules = import.meta.glob('/src/**/*.{ts,tsx}', { eager: false, query: '?url' });
      const bundles: BundleInfo[] = [];

      for (const [path] of Object.entries(modules)) {
        const name = path.split('/').pop() || path;
        bundles.push({ name, size: 0, path });
      }

      setBundleSize(bundles);
    } catch (error) {
      logger.warn('[PerformanceMonitor] Bundle analysis failed:', error);
    }
  }, []);

  const handleProfilerRender: ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      if (Math.random() > samplingRate) return;

      const metric: RenderMetrics = {
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        timestamp: Date.now(),
      };

      setRenderMetrics((prev) => [...prev.slice(-(maxRenderMetrics - 1)), metric]);
    },
    [samplingRate, maxRenderMetrics],
  );

  useEffect(() => {
    if (!onMetricsUpdate || !isVisible) return;

    if (metricsUpdateTimeoutRef.current) clearTimeout(metricsUpdateTimeoutRef.current);

    metricsUpdateTimeoutRef.current = window.setTimeout(() => {
      onMetricsUpdate({
        webVitals,
        renderMetrics,
        memory: memoryInfo,
        fpsHistory,
        bundleSize,
      });
    }, 500);

    return () => {
      if (metricsUpdateTimeoutRef.current) clearTimeout(metricsUpdateTimeoutRef.current);
    };
  }, [webVitals, renderMetrics, memoryInfo, fpsHistory, bundleSize, onMetricsUpdate, isVisible]);

  if (!isVisible) {
    return (
      <Profiler id="performance-monitor-root" onRender={handleProfilerRender}>
        {React.Children.only(
          <div style={{ display: 'none' }} data-testid="performance-monitor-hidden" />,
        )}
      </Profiler>
    );
  }

  const avgFPS =
    fpsHistory.length > 0
      ? Math.round(fpsHistory.reduce((sum, d) => sum + d.fps, 0) / fpsHistory.length)
      : 0;

  const avgRenderTime =
    renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + m.actualDuration, 0) / renderMetrics.length
      : 0;

  return (
    <Profiler id="performance-monitor-visible" onRender={handleProfilerRender}>
      <div className="performance-monitor" style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '380px',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.95)',
        color: '#E5E7EB',
        borderRadius: '12px',
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '13px',
        zIndex: 9999,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
          ⚡ Performance Monitor
        </h3>

        {enableFPSMonitoring && fpsHistory.length > 0 && (
          <section style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 }}>📊 FPS</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: avgFPS >= 55 ? '#34C759' : avgFPS >= 30 ? '#eab308' : '#FF3B30' }}>
                {avgFPS}
              </span>
              <span style={{ opacity: 0.6 }}>avg</span>
            </div>
            <div style={{
              height: '40px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '1px',
              padding: '2px',
              overflow: 'hidden',
            }}>
              {fpsHistory.map((d, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${Math.min(100, (d.fps / 60) * 100)}%`,
                    background: d.fps >= 55 ? '#34C759' : d.fps >= 30 ? '#eab308' : '#FF3B30',
                    borderRadius: '1px',
                    minWidth: '2px',
                    transition: 'height 0.1s ease',
                  }}
                  title={`${d.fps} FPS`}
                />
              ))}
            </div>
          </section>
        )}

        {renderMetrics.length > 0 && (
          <section style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 }}>🔄 Render Time</h4>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {formatDuration(avgRenderTime)}
              </span>
              <span style={{ opacity: 0.6, marginLeft: '4px' }}>avg</span>
            </div>
            <div style={{
              maxHeight: '120px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              padding: '6px',
            }}>
              {renderMetrics.slice(-10).map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '11px',
                }}>
                  <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.id}</span>
                  <span style={{
                    color: m.actualDuration > 16 ? '#FF3B30' : m.actualDuration > 8 ? '#eab308' : '#34C759',
                  }}>
                    {formatDuration(m.actualDuration)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {enableWebVitals && webVitals.length > 0 && (
          <section style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 }}>🎯 Web Vitals</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {webVitals.map((v, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 8px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                }}>
                  <span>{v.name}</span>
                  <span style={{
                    fontWeight: 600,
                    color: v.rating === 'good' ? '#34C759' : v.rating === 'needs-improvement' ? '#eab308' : '#FF3B30',
                  }}>
                    {v.name === 'CLS' ? v.value.toFixed(3) : formatDuration(v.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {enableMemoryMonitoring && memoryInfo && (
          <section style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 }}>💾 Memory Usage</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Used:</span>
                <span style={{ color: '#EA580C' }}>{formatBytes(memoryInfo.usedJSHeapSize)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total:</span>
                <span>{formatBytes(memoryInfo.totalJSHeapSize)}</span>
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '3px',
                marginTop: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}%`,
                  height: '100%',
                  background: memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.7 ? '#FF3B30' : '#34C759',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </section>
        )}

        {bundleSize.length > 0 && (
          <section>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 }}>📦 Modules ({bundleSize.length})</h4>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              fontSize: '11px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              padding: '6px',
            }}>
              {bundleSize.slice(0, 20).map((b, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                  <span style={{ opacity: 0.6 }}>{b.path.split('/').slice(-2).join('/')}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Profiler>
  );
}

export default PerformanceMonitor;
