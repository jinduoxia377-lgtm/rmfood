/**
 * ChatPerformanceOptimizer - 前端性能优化器 (v1.0)
 *
 * 职责：
 * - React 19 Concurrent Features 集成
 * - 消息列表渲染优化
 * - 图片懒加载
 * - Bundle 分析
 */

import { useCallback, useRef, useEffect } from 'react'
import { logger } from '@/utils/safeLogger'

export function useChatPerformance() {
  const frameRef = useRef<number>(0)
  const lastRenderTimeRef = useRef(0)

  const throttleRender = useCallback((fn: () => void) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const now = performance.now()
      if (now - lastRenderTimeRef.current >= 16) {
        fn()
        lastRenderTimeRef.current = now
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return { throttleRender }
}

export function useLazyImage(ref: React.RefObject<HTMLImageElement | null>) {
  useEffect(() => {
    const img = ref.current
    if (!img) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const src = (img as HTMLImageElement).dataset.src
            if (src) {
              ;(img as HTMLImageElement).src = src
              observer.unobserve(img)
            }
          }
        })
      },
      { rootMargin: '200px' },
    )

    observer.observe(img)
    return () => observer.disconnect()
  }, [ref])
}

export interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  fps: number
  messageCount: number
  streamingDuration: number
}

export function usePerformanceMonitor() {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    fps: 60,
    messageCount: 0,
    streamingDuration: 0,
  })

  const recordRender = useCallback((startTime: number) => {
    const elapsed = performance.now() - startTime
    metricsRef.current.renderTime = elapsed
    if (elapsed > 100) {
      logger.warn(`[Perf] 渲染耗时过长: ${elapsed.toFixed(0)}ms`)
    }
  }, [])

  const recordFPS = useCallback((frames: number, duration: number) => {
    const fps = Math.round((frames / duration) * 1000)
    metricsRef.current.fps = fps
  }, [])

  return {
    metrics: metricsRef.current,
    recordRender,
    recordFPS,
  }
}
