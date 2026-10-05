/**
 * Web Vitals 性能监控模块
 * 集成 Core Web Vitals API，提供完整的性能指标收集和分析
 *
 * Core Web Vitals:
 * - LCP (Largest Contentful Paint): 最大内容绘制时间
 * - INP (Interaction to Next Paint): 交互响应时间
 * - CLS (Cumulative Layout Shift): 累积布局偏移
 * - FCP (First Contentful Paint): 首次内容绘制
 * - TTFB (Time to First Byte): 首字节时间
 */

import { logger } from '@/utils/safeLogger'
import {
  onLCP,
  onCLS,
  onINP,
  onFCP,
  onTTFB,
  type Metric,
  type ReportCallback,
} from 'web-vitals'

export interface WebVitalsMetrics {
  lcp?: Metric
  cls?: Metric
  inp?: Metric
  fcp?: Metric
  ttfb?: Metric
}

export interface PerformanceReport {
  timestamp: number
  lcp: { value: number; status: 'good' | 'needs-improvement' | 'poor'; label: string }
  cls: { value: number; status: 'good' | 'needs-improvement' | 'poor'; label: string }
  inp: { value: number; status: 'good' | 'needs-improvement' | 'poor'; label: string }
  fcp: { value: number; label: string }
  ttfb: { value: number; label: string }
  fps: { average: number; min: number; max: number }
  resourceLoadTime: number
}

export interface PerformanceThresholds {
  lcp: { good: number; poor: number }
  cls: { good: number; poor: number }
  inp: { good: number; poor: number }
  fps: { min: number; target: number }
  resourceLoad: number
}

export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  fps: { min: 30, target: 60 },
  resourceLoad: 2000,
}

class WebVitalsMonitor {
  private metrics: WebVitalsMetrics = {}
  private listeners: ((metrics: WebVitalsMetrics) => void)[] = []
  private reportListeners: ((report: PerformanceReport) => void)[] = []
  private fpsData: number[] = []
  private resourceLoadTime = 0

  constructor() {
    this.initWebVitals()
    this.initResourceTiming()
    this.initFPSMonitor()
  }

  private initWebVitals(): void {
    const handleMetric: ReportCallback = (metric) => {
      switch (metric.name) {
        case 'LCP':
          this.metrics.lcp = metric
          break
        case 'CLS':
          this.metrics.cls = metric
          break
        case 'INP':
          this.metrics.inp = metric
          break
        case 'FCP':
          this.metrics.fcp = metric
          break
        case 'TTFB':
          this.metrics.ttfb = metric
          break
      }
      this.notifyListeners()
    }

    onLCP(handleMetric)
    onCLS(handleMetric)
    onINP(handleMetric)
    onFCP(handleMetric)
    onTTFB(handleMetric)
  }

  private initResourceTiming(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource')
        const totalLoadTime = resources.reduce((sum, resource) => {
          return sum + (resource.responseEnd - resource.requestStart)
        }, 0)
        this.resourceLoadTime = totalLoadTime
      })
    }
  }

  private initFPSMonitor(): void {
    if (typeof window !== 'undefined') {
      let frameCount = 0
      let lastTime = performance.now()

      const measureFPS = () => {
        frameCount++
        const now = performance.now()

        if (now - lastTime >= 1000) {
          const fps = Math.round((frameCount * 1000) / (now - lastTime))
          this.fpsData.push(fps)

          if (this.fpsData.length > 60) {
            this.fpsData.shift()
          }

          frameCount = 0
          lastTime = now
        }

        requestAnimationFrame(measureFPS)
      }

      requestAnimationFrame(measureFPS)
    }
  }

  private getStatus(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' {
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.poor) return 'needs-improvement'
    return 'poor'
  }

  private formatMetric(value: number, name: string): string {
    switch (name) {
      case 'LCP':
      case 'INP':
      case 'FCP':
      case 'TTFB':
        return `${value.toFixed(0)}ms`
      case 'CLS':
        return value.toFixed(2)
      default:
        return value.toString()
    }
  }

  getPerformanceReport(): PerformanceReport {
    const fpsAverage = this.fpsData.length > 0
      ? Math.round(this.fpsData.reduce((a, b) => a + b, 0) / this.fpsData.length)
      : 60
    const fpsMin = this.fpsData.length > 0 ? Math.min(...this.fpsData) : 60
    const fpsMax = this.fpsData.length > 0 ? Math.max(...this.fpsData) : 60

    return {
      timestamp: Date.now(),
      lcp: {
        value: this.metrics.lcp?.value ?? 0,
        status: this.getStatus(this.metrics.lcp?.value ?? Infinity, DEFAULT_THRESHOLDS.lcp),
        label: this.formatMetric(this.metrics.lcp?.value ?? 0, 'LCP'),
      },
      cls: {
        value: this.metrics.cls?.value ?? 0,
        status: this.getStatus(this.metrics.cls?.value ?? Infinity, DEFAULT_THRESHOLDS.cls),
        label: this.formatMetric(this.metrics.cls?.value ?? 0, 'CLS'),
      },
      inp: {
        value: this.metrics.inp?.value ?? 0,
        status: this.getStatus(this.metrics.inp?.value ?? Infinity, DEFAULT_THRESHOLDS.inp),
        label: this.formatMetric(this.metrics.inp?.value ?? 0, 'INP'),
      },
      fcp: {
        value: this.metrics.fcp?.value ?? 0,
        label: this.formatMetric(this.metrics.fcp?.value ?? 0, 'FCP'),
      },
      ttfb: {
        value: this.metrics.ttfb?.value ?? 0,
        label: this.formatMetric(this.metrics.ttfb?.value ?? 0, 'TTFB'),
      },
      fps: {
        average: fpsAverage,
        min: fpsMin,
        max: fpsMax,
      },
      resourceLoadTime: this.resourceLoadTime,
    }
  }

  getMetrics(): WebVitalsMetrics {
    return { ...this.metrics }
  }

  addListener(listener: (metrics: WebVitalsMetrics) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  addReportListener(listener: (report: PerformanceReport) => void): () => void {
    this.reportListeners.push(listener)
    return () => {
      this.reportListeners = this.reportListeners.filter(l => l !== listener)
    }
  }

  private notifyListeners(): void {
    const metricsCopy = { ...this.metrics }
    this.listeners.forEach(listener => listener(metricsCopy))

    const report = this.getPerformanceReport()
    this.reportListeners.forEach(listener => listener(report))
  }

  logReport(): void {
    const report = this.getPerformanceReport()
    console.group('📊 Web Vitals Report')
    logger.log('LCP:', report.lcp)
    logger.log('CLS:', report.cls)
    logger.log('INP:', report.inp)
    logger.log('FCP:', report.fcp)
    logger.log('TTFB:', report.ttfb)
    logger.log('FPS:', report.fps)
    logger.log('Resource Load Time:', `${report.resourceLoadTime.toFixed(0)}ms`)
    console.groupEnd()
  }

  getStatusColor(status: 'good' | 'needs-improvement' | 'poor'): string {
    switch (status) {
      case 'good':
        return 'var(--color-primary-400)'
      case 'needs-improvement':
        return '#D97706'
      case 'poor':
        return '#FF3B30'
    }
  }
}

export const webVitalsMonitor = new WebVitalsMonitor()

export function initWebVitals(): void {
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      webVitalsMonitor.logReport()
    }, 30000)
  }
}

export function sendToAnalytics(report: PerformanceReport): void {
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const payload = JSON.stringify({
      timestamp: report.timestamp,
      lcp: report.lcp.value,
      cls: report.cls.value,
      inp: report.inp.value,
      fcp: report.fcp.value,
      ttfb: report.ttfb.value,
      fps: report.fps.average,
      resourceLoadTime: report.resourceLoadTime,
    })

    navigator.sendBeacon('/api/analytics/performance', payload)
  }
}
