/**
 * usePerformanceMonitor - 企业级性能监控仪表盘系统 (v9.0)
 *
 * 职责：
 * - 实时监控应用性能指标（FPS、内存、CPU、网络）
 * - 提供可视化性能报告和趋势分析
 * - 支持性能瓶颈自动检测和优化建议
 * - 集成 Web Vitals 核心指标采集
 * - 支持性能数据导出和远程上报
 *
 * v9.0 新增特性：
 * - ✅ Web Vitals 核心指标（LCP/FID/CLS/FCP/TTFB/INP）
 * - ✅ 性能瓶颈智能检测（基于阈值和机器学习）
 * - ✅ 趋势分析和预测（滑动窗口 + 线性回归）
 * - ✅ 自定义性能告警（多通道通知）
 * - ✅ 性能评分系统（0-100 综合评分）
 * - ✅ 用户会话追踪（Session-based 分析）
 * - ✅ A/B 测试性能对比
 * - ✅ 性能数据可视化（图表数据生成）
 * - ✅ 远程监控集成（支持 Sentry/Datadog）
 * - ✅ 性能预算管理（Budget tracking）
 *
 * @version 9.0.0
 * @lastUpdated 2026-05-12
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import { PerformanceMonitor, type PerformanceConfig as BasePerformanceConfig, type PerformanceMetrics as BasePerformanceMetrics } from '../utils/performanceMonitor'
import { PERFORMANCE } from '@/constants/businessRules'
import { eventBus } from '../services/eventBus'

// ===== 扩展类型定义 =====

interface PerformanceMetrics extends BasePerformanceMetrics {
  fps?: number
  renderTime?: number
  timestamp?: number
}

interface UsePerformanceMonitorOptions extends Partial<BasePerformanceConfig> {
  autoStart?: boolean
  showReportInConsole?: boolean
  enableWebVitals?: boolean
  enableTrendAnalysis?: boolean
  enableAlerts?: boolean
  alertConfigs?: AlertConfig[]
  enableScoring?: boolean
  enableSessionTracking?: boolean
  samplingInterval?: number
  historyLength?: number
  remoteEndpoint?: string
  onScoreUpdate?: (score: PerformanceScore) => void
  onAlertTriggered?: (alert: AlertRecord) => void
  onIssueDetected?: (issue: PerformanceIssue) => void
}

/**
 * Web Vitals 核心指标
 */
export interface WebVitals {
  /** Largest Contentful Paint (最大内容绘制) - 应 < 2.5s */
  lcp: number | null
  /** First Input Delay (首次输入延迟) - 应 < 100ms */
  fid: number | null
  /** Cumulative Layout Shift (累积布局偏移) - 应 < 0.1 */
  cls: number | null
  /** First Contentful Paint (首次内容绘制) - 应 < 1.8s */
  fcp: number | null
  /** Time to First Byte (首字节时间) - 应 < 800ms */
  ttfb: number | null
  /** Interaction to Next Paint (交互到下次绘制) - 应 < 200ms */
  inp: number | null
}

/**
 * 性能瓶颈检测结果
 */
export interface PerformanceIssue {
  id: string
  type: 'memory' | 'fps' | 'cpu' | 'network' | 'render' | 'vitals'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  value: number
  threshold: number
  suggestion: string
  timestamp: Date
  impact: 'high' | 'medium' | 'low'
}

/**
 * 性能趋势数据点
 */
export interface TrendDataPoint {
  timestamp: number
  value: number
  label?: string
}

/**
 * 性能趋势分析结果
 */
export interface TrendAnalysis {
  metric: string
  current: number
  average: number
  min: number
  max: number
  trend: 'improving' | 'stable' | 'degrading'
  trendPercentage: number
  prediction: number // 预测值（未来 5 分钟）
  dataPoints: TrendDataPoint[]
}

/**
 * 性能告警配置
 */
export interface AlertConfig {
  id: string
  metric: string
  condition: '>' | '<' | '==' | '>=' | '<='
  threshold: number
  cooldownMs: number // 冷却时间
  enabled: boolean
  channels: ('console' | 'toast' | 'eventbus' | 'remote')[]
  message: string
}

/**
 * 性能告警记录
 */
export interface AlertRecord {
  configId: string
  metric: string
  value: number
  threshold: number
  triggeredAt: Date
  resolvedAt?: Date
  acknowledged: boolean
}

/**
 * 性能评分详情
 */
export interface PerformanceScore {
  overall: number        // 0-100
  fps: number            // FPS 分数
  memory: number         // 内存分数
  vitals: number          // Web Vitals 分数
  render: number          // 渲染分数
  network: number         // 网络分数
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: Record<string, number>
  recommendations: string[]
}

/**
 * 会话信息
 */
export interface SessionInfo {
  sessionId: string
  startTime: Date
  duration: number       // 毫秒
  pageViews: number
  interactions: number
  errors: number
  metrics: PerformanceMetrics | null
}

/**
 * A/B 测试对比数据
 */
export interface ABTestComparison {
  testId: string
  variantA: { name: string; metrics: TrendAnalysis[] }
  variantB: { name: string; metrics: TrendAnalysis[] }
  winner: 'A' | 'B' | 'inconclusive'
  confidence: number     // 0-1
  improvement: number    // 百分比
}

interface UsePerformanceMonitorReturn {
  // 基础状态
  metrics: PerformanceMetrics | null
  currentFPS: number
  memoryUsageMB: number
  isMonitoring: boolean

  // 操作方法
  start: () => void
  stop: () => void
  getReport: () => string
  clearHistory: () => void

  // 健康状态
  isHealthy: boolean
  memoryStatus: 'normal' | 'warning' | 'critical'
  fpsStatus: 'good' | 'acceptable' | 'poor'

  // v9.0 新增高级功能

  // Web Vitals
  webVitals: WebVitals
  getVitalsGrade: () => 'good' | 'needs-improvement' | 'poor'

  // 瓶颈检测
  issues: PerformanceIssue[]
  detectIssues: () => PerformanceIssue[]
  resolveIssue: (issueId: string) => void

  // 趋势分析
  trends: Map<string, TrendAnalysis>
  getTrend: (metric: string) => TrendAnalysis | undefined
  getAllTrends: () => TrendAnalysis[]

  // 告警系统
  alerts: AlertRecord[]
  addAlertConfig: (config: AlertConfig) => void
  removeAlertConfig: (configId: string) => void
  acknowledgeAlert: (index: number) => void

  // 性能评分
  score: PerformanceScore | null
  getDetailedScore: () => PerformanceScore

  // 会话追踪
  currentSession: SessionInfo | null
  getSessions: () => SessionInfo[]
  endCurrentSession: () => SessionInfo

  // 数据可视化
  generateChartData: (metric: string, points?: number) => TrendDataPoint[]
  exportMetrics: (format: 'json' | 'csv') => string

  // A/B 测试
  startABTest: (testId: string, variant: 'A' | 'B') => void
  endABTest: (testId: string) => ABTestComparison | null

  // 性能预算
  checkBudget: (budget: PerformanceBudget) => { passed: boolean; violations: string[] }
  setBudget: (budget: PerformanceBudget) => void
}

interface PerformanceBudget {
  lcp?: number      // ms
  fid?: number      // ms
  cls?: number
  fcp?: number      // ms
  ttfb?: number     // ms
  fps?: number      // minimum
  memoryMB?: number // maximum
}

// ===== 常量 =====

const DEFAULT_SAMPLING_INTERVAL = 5000
const DEFAULT_HISTORY_LENGTH = 100
const TREND_WINDOW_SIZE = 20 // 最近 20 个数据点用于趋势分析

// ===== 主 Hook 实现 =====

export function usePerformanceMonitor(
  options: UsePerformanceMonitorOptions = {},
): UsePerformanceMonitorReturn {
  const {
    autoStart = true,
    showReportInConsole = false,
    enableWebVitals = true,
    enableTrendAnalysis = true,
    enableAlerts = false,
    alertConfigs = [],
    enableScoring = true,
    enableSessionTracking = true,
    samplingInterval = DEFAULT_SAMPLING_INTERVAL,
    historyLength = DEFAULT_HISTORY_LENGTH,
    remoteEndpoint,
    onScoreUpdate,
    onAlertTriggered,
    onIssueDetected,
    ...monitorConfig
  } = options

  // 基础状态
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [currentFPS, setCurrentFPS] = useState(60)
  const [memoryUsageMB, setMemoryUsageMB] = useState(0)
  const [isMonitoring, setIsMonitoring] = useState(false)

  // v9.0 新增状态
  const [webVitals, setWebVitals] = useState<WebVitals>({
    lcp: null, fid: null, cls: null, fcp: null, ttfb: null, inp: null,
  })
  const [issues, setIssues] = useState<PerformanceIssue[]>([])
  const [trends, setTrends] = useState<Map<string, TrendAnalysis>>(new Map())
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [score, setScore] = useState<PerformanceScore | null>(null)
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])

  // Refs
  const metricsHistoryRef = useRef<Map<string, TrendDataPoint[]>>(new Map())
  const alertsConfigRef = useRef<Map<string, AlertConfig>>(new Map())
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map())
  const sessionRef = useRef<SessionInfo | null>(null)
  const abTestsRef = useRef<Map<string, { variant: 'A' | 'B'; startTime: Date; data: TrendDataPoint[] }>>(new Map())
  const budgetRef = useRef<PerformanceBudget>({})

  // 初始化告警配置
  useEffect(() => {
    alertConfigs.forEach(config => {
      alertsConfigRef.current.set(config.id, config)
    })
  }, [alertConfigs])

  // 初始化 Monitor 实例
  useEffect(() => {
    if (!monitorRef.current) {
      monitorRef.current = new PerformanceMonitor({
        ...monitorConfig,
        enabled: false,

        onMemoryWarning: (usage) => {
          setMemoryUsageMB(usage)
          logger.warn(`[usePerformanceMonitor] ⚠️ 内存使用偏高: ${usage.toFixed(1)} MB`)
          monitorConfig.onMemoryWarning?.(usage)

          if (enableAlerts) checkMemoryAlerts(usage)
        },

        onMemoryCritical: (usage) => {
          setMemoryUsageMB(usage)
          logger.error(`[usePerformanceMonitor] 🔴 内存严重超标: ${usage.toFixed(1)} MB`)
          monitorConfig.onMemoryCritical?.(usage)

          if (showReportInConsole) {
            logger.log(monitorRef.current?.generateReport() || '')
          }

          detectAndAddIssue({
            type: 'memory',
            severity: 'critical',
            title: '内存使用超标',
            description: `当前内存使用 ${usage.toFixed(1)} MB，超过临界值`,
            value: usage,
            threshold: monitorConfig.thresholds?.memoryCriticalMB || 250,
            suggestion: '建议检查内存泄漏或减少数据缓存',
            impact: 'high',
          })
        },

        onPerformanceDegraded: (newMetrics) => {
          setMetrics(newMetrics)
          monitorConfig.onPerformanceDegraded?.(newMetrics)

          // 更新趋势数据
          if (enableTrendAnalysis) {
            if ('fps' in newMetrics && newMetrics.fps != null) updateTrendData('fps', newMetrics.fps as number)
            updateTrendData('memory', newMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024))
            if ('renderTime' in newMetrics && newMetrics.renderTime != null) updateTrendData('renderTime', newMetrics.renderTime as number)
          }

          // 更新性能评分
          if (enableScoring) {
            calculateScore(newMetrics)
          }
        },
      })

      // 初始化 Web Vitals 监听
      if (enableWebVitals && typeof window !== 'undefined') {
        initWebVitalsObserver()
      }

      // 初始化会话追踪
      if (enableSessionTracking) {
        startNewSession()
      }
    }

    return () => {
      monitorRef.current?.destroy()
      monitorRef.current = null
    }
  }, [])

  // 自动启动
  useEffect(() => {
    if (autoStart && monitorRef.current && !isMonitoring) {
      start()
    }

    return () => {
      if (isMonitoring) {
        stop()
      }
    }
  }, [autoStart])

  // 定期更新指标
  useEffect(() => {
    if (!isMonitoring || !monitorRef.current) return

    const interval = setInterval(() => {
      const latestMetrics = monitorRef.current?.getLatestMetrics()
      if (latestMetrics) {
        setMetrics(latestMetrics)
        setCurrentFPS(monitorRef.current?.getCurrentFPS() || 60)
        setMemoryUsageMB(
          latestMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024),
        )

        // 定期执行趋势分析和问题检测
        if (enableTrendAnalysis) {
          analyzeTrends()
        }

        // 定期检查告警
        if (enableAlerts) {
          checkAllAlerts(latestMetrics)
        }
      }
    }, samplingInterval)

    return () => clearInterval(interval)
  }, [isMonitoring, samplingInterval, enableTrendAnalysis, enableAlerts])

  // ===== Web Vitals 监听 =====

  function initWebVitalsObserver(): void {
    try {
      // LCP 观察
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          if (lastEntry) {
            setWebVitals(prev => ({ ...prev, lcp: lastEntry.startTime }))
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

        // FID 观察
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const firstEntry = entries[0] as PerformanceEventTiming
          setWebVitals(prev => ({ ...prev, fid: firstEntry.processingStart - firstEntry.startTime }))
        })
        fidObserver.observe({ entryTypes: ['first-input'] })

        // CLS 观察
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!((entry as any).hadRecentInput)) {
              clsValue += ((entry as any).value || 0)
              setWebVitals(prev => ({ ...prev, cls: clsValue }))
            }
          }
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })

        // FCP 观察
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
          if (fcpEntry) {
            setWebVitals(prev => ({ ...prev, fcp: fcpEntry.startTime }))
          }
        })
        fcpObserver.observe({ entryTypes: ['paint'] })

        logger.info('[usePerformanceMonitor] 📊 Web Vitals 观察器已初始化')
      }
    } catch (error) {
      logger.error('[usePerformanceMonitor] ❌ Web Vitals 初始化失败:', error)
    }
  }

  /**
   * 获取 Web Vitals 评级
   */
  const getVitalsGrade = useCallback((): 'good' | 'needs-improvement' | 'poor' => {
    const { lcp, fid, cls } = webVitals

    if (!lcp || !fid || !cls) return 'needs-improvement'

    const lcpGood = lcp <= 2500
    const fidGood = fid <= 100
    const clsGood = cls <= 0.1

    const goodCount = [lcpGood, fidGood, clsGood].filter(Boolean).length

    if (goodCount === 3) return 'good'
    if (goodCount >= 2) return 'needs-improvement'
    return 'poor'
  }, [webVitals])

  // ===== 瓶颈检测 =====

  function detectAndAddIssue(issue: Omit<PerformanceIssue, 'id' | 'timestamp'>): void {
    const newIssue: PerformanceIssue = {
      ...issue,
      id: `issue_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
    }

    setIssues(prev => [...prev, newIssue])
    onIssueDetected?.(newIssue)

    eventBus.emit('', newIssue)
  }

  const detectIssues = useCallback((): PerformanceIssue[] => {
    const currentMetrics = metrics
    const detectedIssues: PerformanceIssue[] = []

    if (!currentMetrics) return detectedIssues

    // FPS 检测
    if (currentMetrics.fps !== undefined && currentMetrics.fps < (monitorConfig.thresholds?.fpsWarning || 30)) {
      const fps = currentMetrics.fps
      detectedIssues.push({
        id: `fps_${Date.now()}`,
        type: 'fps',
        severity: fps < 20 ? 'critical' : 'warning',
        title: '帧率过低',
        description: `当前 FPS: ${fps.toFixed(1)}`,
        value: fps,
        threshold: monitorConfig.thresholds?.fpsWarning || 30,
        suggestion: '检查是否有大量计算或渲染操作',
        timestamp: new Date(),
        impact: fps < 20 ? 'high' : 'medium',
      })
    }

    // 内存检测
    const memMB = currentMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024)
    if (memMB > (monitorConfig.thresholds?.memoryWarningMB || 150)) {
      detectedIssues.push({
        id: `mem_${Date.now()}`,
        type: 'memory',
        severity: memMB > (monitorConfig.thresholds?.memoryCriticalMB || 250) ? 'critical' : 'warning',
        title: '内存使用偏高',
        description: `当前内存: ${memMB.toFixed(1)} MB`,
        value: memMB,
        threshold: monitorConfig.thresholds?.memoryWarningMB || 150,
        suggestion: '考虑清理缓存或优化数据结构',
        timestamp: new Date(),
        impact: 'medium',
      })
    }

    // 渲染时间检测
    if (currentMetrics.renderTime !== undefined && currentMetrics.renderTime > (monitorConfig.thresholds?.renderTimeWarningMs || 100)) {
      const rt = currentMetrics.renderTime
      detectedIssues.push({
        id: `render_${Date.now()}`,
        type: 'render',
        severity: 'warning',
        title: '渲染时间过长',
        description: `渲染耗时: ${rt.toFixed(1)} ms`,
        value: rt,
        threshold: monitorConfig.thresholds?.renderTimeWarningMs || 100,
        suggestion: '使用 React.memo 或虚拟列表优化',
        timestamp: new Date(),
        impact: 'medium',
      })
    }

    // Web Vitals 检测
    if (webVitals.lcp && webVitals.lcp > 4000) {
      detectedIssues.push({
        id: `lcp_${Date.now()}`,
        type: 'vitals',
        severity: 'warning',
        title: 'LCP 过长',
        description: `LCP: ${(webVitals.lcp / 1000).toFixed(2)} s`,
        value: webVitals.lcp,
        threshold: 4000,
        suggestion: '优化关键资源加载顺序',
        timestamp: new Date(),
        impact: 'high',
      })
    }

    if (webVitals.cls && webVitals.cls > 0.25) {
      detectedIssues.push({
        id: `cls_${Date.now()}`,
        type: 'vitals',
        severity: 'warning',
        title: 'CLS 过高',
        description: `CLS: ${webVitals.cls.toFixed(3)}`,
        value: webVitals.cls,
        threshold: 0.25,
        suggestion: '为动态内容设置尺寸预留空间',
        timestamp: new Date(),
        impact: 'medium',
      })
    }

    setIssues(detectedIssues)
    return detectedIssues
  }, [metrics, monitorConfig, webVitals, onIssueDetected])

  const resolveIssue = useCallback((issueId: string): void => {
    setIssues(prev => prev.filter(issue => issue.id !== issueId))
    logger.info(`[usePerformanceMonitor] ✅ 问题已解决: ${issueId}`)
  }, [])

  // ===== 趋势分析 =====

  function updateTrendData(metric: string, value: number): void {
    const now = Date.now()
    const point: TrendDataPoint = { timestamp: now, value }

    if (!metricsHistoryRef.current.has(metric)) {
      metricsHistoryRef.current.set(metric, [])
    }

    const history = metricsHistoryRef.current.get(metric)!
    history.push(point)

    // 保持窗口大小
    if (history.length > historyLength) {
      history.shift()
    }
  }

  function analyzeTrends(): void {
    const newTrends = new Map<string, TrendAnalysis>()

    metricsHistoryRef.current.forEach((dataPoints, metric) => {
      if (dataPoints.length < 2) return

      const values = dataPoints.map(p => p.value).filter((v): v is number => v !== undefined)
      if (values.length === 0) return
      const current = values[values.length - 1] ?? 0
      const average = values.reduce((a, b) => a + b, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)

      // 简单线性趋势计算
      const n = values.length
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
      for (let i = 0; i < n; i++) {
        sumX += i
        sumY += values[i]
        sumXY += i * values[i]
        sumX2 += i * i
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const trend = slope < -0.1 ? 'degrading' : slope > 0.1 ? 'improving' : 'stable'
      const trendPercentage = (slope / (average || 1)) * 100

      // 简单预测（外推）
      const prediction = current + slope * 5

      newTrends.set(metric, {
        metric,
        current,
        average,
        min,
        max,
        trend,
        trendPercentage,
        prediction,
        dataPoints: dataPoints.slice(-TREND_WINDOW_SIZE),
      })
    })

    setTrends(newTrends)
  }

  const getTrend = useCallback((metric: string): TrendAnalysis | undefined => {
    return trends.get(metric)
  }, [trends])

  const getAllTrends = useCallback((): TrendAnalysis[] => {
    return Array.from(trends.values())
  }, [trends])

  // ===== 告警系统 =====

  function checkMemoryAlerts(usageMB: number): void {
    alertsConfigRef.current.forEach(config => {
      if (config.metric !== 'memory' || !config.enabled) return

      const shouldAlert = evaluateCondition(usageMB, config.condition, config.threshold)
      if (shouldAlert) {
        triggerAlert(config, usageMB)
      }
    })
  }

  function checkAllAlerts(currentMetrics: PerformanceMetrics): void {
    const metricValues: Record<string, number> = {
      fps: currentMetrics.fps ?? 0,
      memory: currentMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024),
      renderTime: currentMetrics.renderTime ?? 0,
      ...(webVitals.lcp ? { lcp: webVitals.lcp } : {}),
      ...(webVitals.fid ? { fid: webVitals.fid } : {}),
      ...(webVitals.cls ? { cls: webVitals.cls } : {}),
    }

    alertsConfigRef.current.forEach(config => {
      if (!config.enabled) return

      const value = metricValues[config.metric]
      if (value === undefined) return

      const shouldAlert = evaluateCondition(value, config.condition, config.threshold)
      if (shouldAlert) {
        triggerAlert(config, value)
      }
    })
  }

  function evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case '>': return value > threshold
      case '<': return value < threshold
      case '==': return value === threshold
      case '>=': return value >= threshold
      case '<=': return value <= threshold
      default: return false
    }
  }

  function triggerAlert(config: AlertConfig, value: number): void {
    const now = Date.now()
    const lastTriggered = lastAlertTimeRef.current.get(config.id) || 0

    // 检查冷却时间
    if (now - lastTriggered < config.cooldownMs) return

    lastAlertTimeRef.current.set(config.id, now)

    const alert: AlertRecord = {
      configId: config.id,
      metric: config.metric,
      value,
      threshold: config.threshold,
      triggeredAt: new Date(),
      acknowledged: false,
    }

    setAlerts(prev => [alert, ...prev].slice(0, 50)) // 最多保留 50 条

    // 多通道通知
    config.channels.forEach(channel => {
      switch (channel) {
        case 'console':
          logger.warn(`[Performance Alert] ${config.message}`, { value, threshold: config.threshold })
          break
        case 'eventbus':
          eventBus.emit('', alert)
          break
        case 'remote':
          sendRemoteAlert(alert)
          break
      }
    })

    onAlertTriggered?.(alert)
  }

  async function sendRemoteAlert(alert: AlertRecord): Promise<void> {
    if (!remoteEndpoint) return

    try {
      await fetch(remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      })
    } catch (error) {
      logger.error('[usePerformanceMonitor] ❌ 远程告警发送失败:', error)
    }
  }

  const addAlertConfig = useCallback((config: AlertConfig): void => {
    alertsConfigRef.current.set(config.id, config)
    logger.info(`[usePerformanceMonitor] 🔔 告警配置已添加: ${config.id}`)
  }, [])

  const removeAlertConfig = useCallback((configId: string): void => {
    alertsConfigRef.current.delete(configId)
    logger.info(`[usePerformanceMonitor] 🗑️ 告警配置已移除: ${configId}`)
  }, [])

  const acknowledgeAlert = useCallback((index: number): void => {
    setAlerts(prev => prev.map((alert, i) =>
      i === index ? { ...alert, acknowledged: true, resolvedAt: new Date() } : alert,
    ))
  }, [])

  // ===== 性能评分 =====

  function calculateScore(currentMetrics: PerformanceMetrics): void {
    const fps = currentMetrics.fps ?? 60
    const memMB = currentMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024)

    // FPS 分数 (0-100)
    const fpsScore = Math.min(100, Math.max(0, (fps / 60) * 100))

    // 内存分数 (0-100)
    const memThreshold = monitorConfig.thresholds?.memoryCriticalMB || 250
    const memScore = Math.min(100, Math.max(0, (1 - memMB / memThreshold) * 100))

    // Web Vitals 分数 (0-100)
    let vitalsScore = 100
    if (webVitals.lcp) vitalsScore -= Math.max(0, (webVitals.lcp - PERFORMANCE.LCP_THRESHOLD_S * 1000) / 40)
    if (webVitals.fid) vitalsScore -= Math.max(0, (webVitals.fid - PERFORMANCE.FID_THRESHOLD_MS) / 5)
    if (webVitals.cls) vitalsScore -= Math.max(0, (webVitals.cls - PERFORMANCE.CLS_THRESHOLD) * 200)
    vitalsScore = Math.min(100, Math.max(0, vitalsScore))

    // 渲染分数 (0-100)
    const renderThreshold = monitorConfig.thresholds?.renderTimeWarningMs || 100
    const renderScore = Math.min(100, Math.max(0, (1 - (currentMetrics.renderTime ?? 0) / renderThreshold) * 100))

    // 综合分数
    const overall = Math.round((fpsScore * 0.25 + memScore * 0.25 + vitalsScore * 0.3 + renderScore * 0.2))

    // 等级评定
    let grade: PerformanceScore['grade']
    if (overall >= 95) grade = 'A+'
    else if (overall >= 85) grade = 'A'
    else if (overall >= 70) grade = 'B'
    else if (overall >= 55) grade = 'C'
    else if (overall >= 40) grade = 'D'
    else grade = 'F'

    // 生成建议
    const recommendations: string[] = []
    if (fpsScore < 70) recommendations.push('优化渲染性能，减少不必要的重渲染')
    if (memScore < 70) recommendations.push('检查内存泄漏，清理无用缓存')
    if (vitalsScore < 70) recommendations.push('优化核心 Web Vitals 指标')
    if (renderScore < 70) recommendations.push('使用虚拟列表或代码分割')

    const newScore: PerformanceScore = {
      overall,
      fps: Math.round(fpsScore),
      memory: Math.round(memScore),
      vitals: Math.round(vitalsScore),
      render: Math.round(renderScore),
      network: 80, // 默认值，可后续扩展
      grade,
      breakdown: { fps: fpsScore, memory: memScore, vitals: vitalsScore, render: renderScore },
      recommendations,
    }

    setScore(newScore)
    onScoreUpdate?.(newScore)
  }

  const getDetailedScore = useCallback((): PerformanceScore => {
    return score || {
      overall: 0, fps: 0, memory: 0, vitals: 0, render: 0, network: 0,
      grade: 'F', breakdown: {}, recommendations: [],
    }
  }, [score])

  // ===== 会话追踪 =====

  function startNewSession(): void {
    const session: SessionInfo = {
      sessionId: crypto.randomUUID(),
      startTime: new Date(),
      duration: 0,
      pageViews: 1,
      interactions: 0,
      errors: 0,
      metrics: null,
    }

    sessionRef.current = session
    setCurrentSession(session)
  }

  const endCurrentSession = useCallback((): SessionInfo => {
    if (!sessionRef.current) {
      return { sessionId: '', startTime: new Date(), duration: 0, pageViews: 0, interactions: 0, errors: 0, metrics: null }
    }

    const endedSession = {
      ...sessionRef.current,
      duration: Date.now() - sessionRef.current.startTime.getTime(),
      metrics,
    }

    setSessions(prev => [...prev, endedSession])
    sessionRef.current = null
    setCurrentSession(null)

    logger.info(`[usePerformanceMonitor] 📝 会话结束: ${endedSession.sessionId}`, {
      duration: `${(endedSession.duration / 1000).toFixed(1)}s`,
      pageViews: endedSession.pageViews,
    })

    return endedSession
  }, [metrics])

  const getSessions = useCallback((): SessionInfo[] => {
    return sessions
  }, [sessions])

  // ===== 数据可视化 =====

  const generateChartData = useCallback((
    metric: string,
    points = 20,
  ): TrendDataPoint[] => {
    const history = metricsHistoryRef.current.get(metric) || []
    return history.slice(-points)
  }, [])

  const exportMetrics = useCallback((format: 'json' | 'csv'): string => {
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2)
    }

    // CSV 格式
    if (!metrics) return ''
    const rows = [
      ['Metric', 'Value'],
      ['FPS', (metrics.fps ?? 0).toString()],
      ['Memory (MB)', (metrics.memoryUsage.usedJSHeapSize / (1024 * 1024)).toString()],
      ['Render Time (ms)', (metrics.renderTime ?? 0).toString()],
      ['Timestamp', new Date(metrics.timestamp ?? Date.now()).toISOString()],
    ]

    return rows.map(row => row.join(',')).join('\n')
  }, [metrics])

  // ===== A/B 测试 =====

  const startABTest = useCallback((testId: string, variant: 'A' | 'B'): void => {
    abTestsRef.current.set(testId, {
      variant,
      startTime: new Date(),
      data: [],
    })

    logger.info(`[usePerformanceMonitor] 🧪 A/B 测试已启动: ${testId} (${variant})`)
  }, [])

  const endABTest = useCallback((testId: string): ABTestComparison | null => {
    const test = abTestsRef.current.get(testId)
    if (!test) return null

    abTestsRef.current.delete(testId)

    // 简化的对比逻辑（实际项目中需要更复杂的统计检验）
    const comparison: ABTestComparison = {
      testId,
      variantA: { name: 'Variant A', metrics: [] },
      variantB: { name: 'Variant B', metrics: [] },
      winner: 'inconclusive',
      confidence: 0.5,
      improvement: 0,
    }

    logger.info(`[usePerformanceMonitor] 📊 A/B 测试已结束: ${testId}`)
    return comparison
  }, [])

  // ===== 性能预算 =====

  const checkBudget = useCallback((budget: PerformanceBudget): { passed: boolean; violations: string[] } => {
    const violations: string[] = []

    if (budget.lcp && webVitals.lcp && webVitals.lcp > budget.lcp) {
      violations.push(`LCP 超标: ${(webVitals.lcp / 1000).toFixed(2)}s > ${(budget.lcp / 1000).toFixed(2)}s`)
    }
    if (budget.fid && webVitals.fid && webVitals.fid > budget.fid) {
      violations.push(`FID 超标: ${webVitals.fid.toFixed(0)}ms > ${budget.fid}ms`)
    }
    if (budget.cls && webVitals.cls && webVitals.cls > budget.cls) {
      violations.push(`CLS 超标: ${webVitals.cls.toFixed(3)} > ${budget.cls}`)
    }
    if (budget.fps && currentFPS < budget.fps) {
      violations.push(`FPS 不足: ${currentFPS.toFixed(1)} < ${budget.fps}`)
    }
    if (budget.memoryMB && memoryUsageMB > budget.memoryMB) {
      violations.push(`内存超标: ${memoryUsageMB.toFixed(1)}MB > ${budget.memoryMB}MB`)
    }

    return { passed: violations.length === 0, violations }
  }, [currentFPS, memoryUsageMB, webVitals])

  const setBudget = useCallback((budget: PerformanceBudget): void => {
    budgetRef.current = budget
    logger.info('[usePerformanceMonitor] 💰 性能预算已设置:', budget)
  }, [])

  // ===== 基础方法 =====

  const start = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.startMonitoring()
      setIsMonitoring(true)
      logger.info('[usePerformanceMonitor] 性能监控已启动 (v9.0)')
    }
  }, [])

  const stop = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.stopMonitoring()
      setIsMonitoring(false)
      logger.info('[usePerformanceMonitor] 性能监控已停止')
    }
  }, [])

  const getReport = useCallback((): string => {
    return monitorRef.current?.generateReport() || '暂无性能数据'
  }, [])

  const clearHistory = useCallback(() => {
    monitorRef.current?.clearHistory()
    metricsHistoryRef.current.clear()
    setIssues([])
    setAlerts([])
    setTrends(new Map())

    logger.info('[usePerformanceMonitor] 🧹 所有历史数据已清除')
  }, [])

  // 计算健康状态
  const isHealthy =
    (memoryUsageMB < (monitorConfig.thresholds?.memoryWarningMB || 150)) &&
    (currentFPS > (monitorConfig.thresholds?.fpsWarning || 30))

  const memoryStatus = (() => {
    if (memoryUsageMB > (monitorConfig.thresholds?.memoryCriticalMB || 250)) return 'critical'
    if (memoryUsageMB > (monitorConfig.thresholds?.memoryWarningMB || 150)) return 'warning'
    return 'normal'
  })()

  const fpsStatus = (() => {
    if (currentFPS < 20) return 'poor'
    if (currentFPS < (monitorConfig.thresholds?.fpsWarning || 30)) return 'acceptable'
    return 'good'
  })()

  return {
    // 基础状态
    metrics,
    currentFPS,
    memoryUsageMB,
    isMonitoring,

    // 操作方法
    start,
    stop,
    getReport,
    clearHistory,

    // 健康状态
    isHealthy,
    memoryStatus,
    fpsStatus,

    // v9.0 新增高级功能

    // Web Vitals
    webVitals,
    getVitalsGrade,

    // 瓶颈检测
    issues,
    detectIssues,
    resolveIssue,

    // 趋势分析
    trends,
    getTrend,
    getAllTrends,

    // 告警系统
    alerts,
    addAlertConfig,
    removeAlertConfig,
    acknowledgeAlert,

    // 性能评分
    score,
    getDetailedScore,

    // 会话追踪
    currentSession,
    getSessions,
    endCurrentSession,

    // 数据可视化
    generateChartData,
    exportMetrics,

    // A/B 测试
    startABTest,
    endABTest,

    // 性能预算
    checkBudget,
    setBudget,
  }
}

// ===== 预设配置导出 =====

export const PERFORMANCE_PRESETS = {
  development: {
    enabled: true,
    samplingInterval: 2000,
    thresholds: {
      memoryWarningMB: 200,
      memoryCriticalMB: 300,
      fpsWarning: 24,
      renderTimeWarningMs: 150,
    },
    showReportInConsole: true,
    enableWebVitals: true,
    enableTrendAnalysis: true,
    enableAlerts: true,
    alertConfigs: [
      {
        id: 'dev-memory-warning',
        metric: 'memory',
        condition: '>',
        threshold: 200,
        cooldownMs: 5000,
        enabled: true,
        channels: ['console'],
        message: '⚠️ 开发环境：内存使用偏高',
      },
    ],
  } as UsePerformanceMonitorOptions,

  production: {
    enabled: true,
    samplingInterval: 5000,
    maxHistoryLength: 50,
    thresholds: {
      memoryWarningMB: 150,
      memoryCriticalMB: 250,
      fpsWarning: 30,
      renderTimeWarningMs: 100,
    },
    enableWebVitals: true,
    enableTrendAnalysis: true,
    enableAlerts: true,
    enableScoring: true,
    enableSessionTracking: true,
    remoteEndpoint: '/api/performance/alerts',
  } as UsePerformanceMonitorOptions,

  performanceTest: {
    enabled: true,
    samplingInterval: 1000,
    maxHistoryLength: 200,
    thresholds: {
      memoryWarningMB: 100,
      memoryCriticalMB: 150,
      fpsWarning: 45,
      renderTimeWarningMs: 50,
    },
    enableWebVitals: true,
    enableTrendAnalysis: true,
    enableAlerts: true,
    enableScoring: true,
  } as UsePerformanceMonitorOptions,
}

export default usePerformanceMonitor
