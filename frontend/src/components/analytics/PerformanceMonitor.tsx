/**
 * 性能监控组件
 * 实时显示帧率、Web Vitals 指标和资源加载状态
 */

import { useEffect, useState, useRef } from 'react'
import {
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MinusCircle,
  Gauge,
  Zap,
} from 'lucide-react'
import { webVitalsMonitor, type PerformanceReport, DEFAULT_THRESHOLDS } from '@/utils/webVitals'

interface PerformanceCardProps {
  title: string
  value: string
  status: 'good' | 'needs-improvement' | 'poor' | 'neutral'
  icon: React.ReactNode
  subtitle?: string
}

function PerformanceCard({ title, value, status, icon, subtitle }: PerformanceCardProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'good':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'needs-improvement':
        return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'poor':
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getIconStyles = () => {
    switch (status) {
      case 'good':
        return 'text-green-500'
      case 'needs-improvement':
        return 'text-amber-500'
      case 'poor':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-4 h-4" />
      case 'needs-improvement':
        return <MinusCircle className="w-4 h-4" />
      case 'poor':
        return <XCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusStyles()}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-white/50 ${getIconStyles()}`}>
            {icon}
          </div>
          <span className="text-sm font-medium">{title}</span>
        </div>
        {getStatusIcon()}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs opacity-70 mt-1">{subtitle}</div>}
    </div>
  )
}

interface FPSIndicatorProps {
  fps: number
}

function FPSIndicator({ fps }: FPSIndicatorProps) {
  const getStatus = () => {
    if (fps >= DEFAULT_THRESHOLDS.fps.target) return 'good'
    if (fps >= DEFAULT_THRESHOLDS.fps.min) return 'needs-improvement'
    return 'poor'
  }

  const status = getStatus()

  const getBarColor = () => {
    switch (status) {
      case 'good':
        return 'bg-green-500'
      case 'needs-improvement':
        return 'bg-amber-500'
      case 'poor':
        return 'bg-red-500'
    }
  }

  const percentage = Math.min((fps / 60) * 100, 100)

  return (
    <div className="bg-gray-900 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <span className="text-sm">帧率</span>
        </div>
        <div className={`flex items-center gap-1 ${
          status === 'good' ? 'text-green-400' :
          status === 'needs-improvement' ? 'text-amber-400' : 'text-red-400'
        }`}>
          <span className="text-2xl font-bold">{fps}</span>
          <span className="text-sm">fps</span>
        </div>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0</span>
        <span>30</span>
        <span>60</span>
      </div>
    </div>
  )
}

interface ResourceTimingProps {
  loadTime: number
}

function ResourceTiming({ loadTime }: ResourceTimingProps) {
  const isFast = loadTime <= DEFAULT_THRESHOLDS.resourceLoad

  return (
    <div className={`p-4 rounded-lg border ${
      isFast ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={`w-5 h-5 ${isFast ? 'text-green-500' : 'text-red-500'}`} />
        <span className="text-sm font-medium text-gray-700">资源加载时间</span>
      </div>
      <div className={`text-2xl font-bold ${isFast ? 'text-green-700' : 'text-red-700'}`}>
        {loadTime.toFixed(0)}ms
      </div>
      <div className="text-xs mt-1" style={{ color: isFast ? '#166534' : '#991b1b' }}>
        {isFast ? '✓ 首屏加载 ≤ 2秒' : '⚠️ 需要优化'}
      </div>
    </div>
  )
}

export default function PerformanceMonitor() {
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [currentFPS, setCurrentFPS] = useState(60)
  const intervalRef = useRef<number>()

  useEffect(() => {
    const unsubscribe = webVitalsMonitor.addReportListener((newReport) => {
      setReport(newReport)
      setCurrentFPS(newReport.fps.average)
    })

    intervalRef.current = window.setInterval(() => {
      const latestReport = webVitalsMonitor.getPerformanceReport()
      setReport(latestReport)
      setCurrentFPS(latestReport.fps.average)
    }, 1000)

    return () => {
      unsubscribe()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (!report) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="w-6 h-6 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-800">性能监控</h2>
        <span className="ml-auto text-sm text-gray-500">
          {new Date(report.timestamp).toLocaleTimeString('zh-CN')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <FPSIndicator fps={currentFPS} />
        <ResourceTiming loadTime={report.resourceLoadTime} />
      </div>

      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <TrendingUp className="w-4 h-4" />
          Core Web Vitals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PerformanceCard
            title="LCP"
            value={report.lcp.label}
            status={report.lcp.status}
            icon={<Clock className="w-4 h-4" />}
            subtitle="最大内容绘制"
          />
          <PerformanceCard
            title="FID"
            value={report.fid.label}
            status={report.fid.status}
            icon={<Zap className="w-4 h-4" />}
            subtitle="首次输入延迟"
          />
          <PerformanceCard
            title="CLS"
            value={report.cls.label}
            status={report.cls.status}
            icon={<Activity className="w-4 h-4" />}
            subtitle="累积布局偏移"
          />
          <PerformanceCard
            title="INP"
            value={report.inp.label}
            status={report.inp.status}
            icon={<TrendingUp className="w-4 h-4" />}
            subtitle="交互响应时间"
          />
          <PerformanceCard
            title="FCP"
            value={report.fcp.label}
            status="neutral"
            icon={<Clock className="w-4 h-4" />}
            subtitle="首次内容绘制"
          />
          <PerformanceCard
            title="TTI"
            value={report.tti.label}
            status="neutral"
            icon={<AlertTriangle className="w-4 h-4" />}
            subtitle="可交互时间"
          />
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">FPS 统计</h4>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">平均: <span className="font-bold">{report.fps.average}</span> fps</span>
          <span className="text-gray-600">最低: <span className={`font-bold ${
            report.fps.min < 30 ? 'text-red-600' : report.fps.min < 45 ? 'text-amber-600' : 'text-green-600'
          }`}>{report.fps.min}</span> fps</span>
          <span className="text-gray-600">最高: <span className="font-bold text-green-600">{report.fps.max}</span> fps</span>
        </div>
      </div>
    </div>
  )
}
