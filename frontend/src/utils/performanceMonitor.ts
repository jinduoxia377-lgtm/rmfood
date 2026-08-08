/**
 * 性能监控与用户体验增强工具
 * 提供性能指标收集、用户行为分析和体验优化建议
 */

import { logger } from '@/utils/safeLogger';
export interface PerformanceMetrics {
  // 解析性能
  parseTime: number          // 平均解析时间 (ms)
  parseCount: number         // 解析次数

  // 渲染性能
  renderTime: number         // 平均渲染时间 (ms)
  reRenderCount: number      // 重渲染次数

  // 用户交互
  searchCount: number        // 搜索次数
  expandCount: number        // 展开详情次数
  exportCount: number        // 导出次数

  // 数据统计
  totalFormulasRecognized: number  // 总识别配方数
  avgConfidence: number            // 平均置信度
  peakFormulaCount: number         // 峰值配方数量
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics
  private startTime: number
  private listeners: ((metrics: PerformanceMetrics) => void)[] = []

  constructor() {
    this.metrics = this.getInitialMetrics()
    this.startTime = Date.now()

    // 每30秒自动记录一次性能快照
    if (typeof window !== 'undefined') {
      setInterval(() => this.recordSnapshot(), 30000)
    }
  }

  private getInitialMetrics(): PerformanceMetrics {
    return {
      parseTime: 0,
      parseCount: 0,
      renderTime: 0,
      reRenderCount: 0,
      searchCount: 0,
      expandCount: 0,
      exportCount: 0,
      totalFormulasRecognized: 0,
      avgConfidence: 0,
      peakFormulaCount: 0,
    }
  }

  /**
   * 记录解析耗时
   */
  recordParseTime(timeMs: number): void {
    this.metrics.parseCount++
    this.metrics.parseTime =
      (this.metrics.parseTime * (this.metrics.parseCount - 1) + timeMs) / this.metrics.parseCount

    this.notifyListeners()
  }

  /**
   * 记录渲染耗时
   */
  recordRenderTime(timeMs: number): void {
    this.metrics.reRenderCount++
    this.metrics.renderTime =
      (this.metrics.renderTime * (this.metrics.reRenderCount - 1) + timeMs) / this.metrics.reRenderCount

    this.notifyListeners()
  }

  /**
   * 记录搜索操作
   */
  recordSearch(): void {
    this.metrics.searchCount++
    this.notifyListeners()
  }

  /**
   * 记录展开操作
   */
  recordExpand(): void {
    this.metrics.expandCount++
    this.notifyListeners()
  }

  /**
   * 记录导出操作
   */
  recordExport(): void {
    this.metrics.exportCount++
    this.notifyListeners()
  }

  /**
   * 更新配方统计数据
   */
  updateFormulaStats(count: number, avgConfidence: number): void {
    this.metrics.totalFormulasRecognized = count
    this.metrics.avgConfidence = avgConfidence

    if (count > this.metrics.peakFormulaCount) {
      this.metrics.peakFormulaCount = count
    }

    this.notifyListeners()
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const uptime = Math.round((Date.now() - this.startTime) / 1000)
    const lines = [
      '📈 性能监控报告',
      '='.repeat(40),
      '',
      `运行时长: ${uptime} 秒 (${Math.round(uptime / 60)} 分钟)`,
      '',
      '📊 解析性能:',
      `  - 平均解析时间: ${this.metrics.parseTime.toFixed(2)} ms`,
      `  - 解析次数: ${this.metrics.parseCount}`,
      '',
      '🎨 渲染性能:',
      `  - 平均渲染时间: ${this.metrics.renderTime.toFixed(2)} ms`,
      `  - 重渲染次数: ${this.metrics.reRenderCount}`,
      '',
      '👆 用户交互:',
      `  - 搜索次数: ${this.metrics.searchCount}`,
      `  - 展开详情: ${this.metrics.expandCount}`,
      `  - 导出操作: ${this.metrics.exportCount}`,
      '',
      '📦 数据统计:',
      `  - 总识别配方: ${this.metrics.totalFormulasRecognized}`,
      `  - 峰值配方数: ${this.metrics.peakFormulaCount}`,
      `  - 平均置信度: ${(this.metrics.avgConfidence * 100).toFixed(1)}%`,
      '',
      '-' .repeat(40),
      '💡 性能评估:',
    ]

    // 添加性能评估
    if (this.metrics.parseTime < 50) {
      lines.push('  ✅ 解析性能优秀 (<50ms)')
    } else if (this.metrics.parseTime < 100) {
      lines.push('  ✅ 解析性能良好 (<100ms)')
    } else {
      lines.push('  ⚠️ 解析性能需要优化 (>100ms)')
    }

    if (this.metrics.renderTime < 16.67) {
      lines.push('  ✅ 渲染流畅 (60fps)')
    } else if (this.metrics.renderTime < 33.33) {
      lines.push('  ✅ 渲染正常 (30fps)')
    } else {
      lines.push('  ⚠️ 渲染可能卡顿')
    }

    return lines.join('\n')
  }

  /**
   * 注册监听器
   */
  addListener(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.push(listener)

    // 返回取消订阅函数
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const metricsCopy = { ...this.metrics }
    this.listeners.forEach(listener => listener(metricsCopy))
  }

  /**
   * 定期记录快照（用于长期分析）
   */
  private recordSnapshot(): void {
    logger.info('[PerformanceMonitor] 📊 快照:', {
      timestamp: new Date().toISOString(),
      ...this.getMetrics(),
    })
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics = this.getInitialMetrics()
    this.startTime = Date.now()
    logger.info('[PerformanceMonitor] 🔄 已重置所有指标')
  }
}

// 单例模式
export const performanceMonitor = new PerformanceMonitor()

/**
 * 防抖函数（通用）
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数（通用）
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    logger.error('[Utils] ❌ 复制失败:', e)

    // 降级方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch (err) {
      logger.error('[Utils] ❌ 降级复制也失败:', err)
      return false
    }
  }
}
