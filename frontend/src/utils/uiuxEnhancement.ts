/**
 * UI/UX Enhancement System v2.0
 *
 * 基于 UI/UX Pro Max 专业规范的全面增强系统
 *
 * 核心原则:
 * - Accessibility (WCAG 2.1 AA)
 * - Performance (Core Web Vitals)
 * - Responsive Design (Mobile-first)
 * - Micro-interactions (150-300ms)
 * - Semantic HTML & ARIA
 */

import { useEffect, useCallback, useRef } from 'react'

// ============================================================================
// 1. 可访问性增强工具
// ============================================================================

export const useAccessibility = () => {
  const announceRef = useRef<HTMLDivElement | null>(null)

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceRef.current) {
      announceRef.current = document.createElement('div')
      announceRef.current.setAttribute('aria-live', priority)
      announceRef.current.setAttribute('aria-atomic', 'true')
      announceRef.current.className = 'sr-only'
      document.body.appendChild(announceRef.current)
    }

    announceRef.current.setAttribute('aria-live', priority)
    announceRef.current.textContent = message

    setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.textContent = ''
      }
    }, 1000)
  }, [])

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    return () => container.removeEventListener('keydown', handleTabKey)
  }, [])

  return { announceToScreenReader, trapFocus }
}

// ============================================================================
// 2. 微交互与动画系统
// ============================================================================

export interface AnimationConfig {
  duration?: number
  easing?: string
  delay?: number
}

const defaultAnimationConfig: AnimationConfig = {
  duration: 200,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  delay: 0,
}

export const useMicroInteractions = () => {
  const createSpringAnimation = useCallback((
    element: HTMLElement,
    keyframes: Keyframe[],
    config: AnimationConfig = {},
  ): Animation => {
    const finalConfig = { ...defaultAnimationConfig, ...config }

    return element.animate(keyframes, {
      duration: finalConfig.duration,
      easing: finalConfig.easing,
      delay: finalConfig.delay,
      fill: 'forwards',
    })
  }, [])

  const pressFeedback = useCallback((element: HTMLElement) => {
    createSpringAnimation(element, [
      { transform: 'scale(1)' },
      { transform: 'scale(0.95)' },
      { transform: 'scale(1)' },
    ], { duration: 150 })
  }, [createSpringAnimation])

  const hoverLift = useCallback((element: HTMLElement) => {
    createSpringAnimation(element, [
      { transform: 'translateY(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
      { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    ], { duration: 200 })
  }, [createSpringAnimation])

  const successPulse = useCallback((element: HTMLElement) => {
    createSpringAnimation(element, [
      { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
      { boxShadow: '0 0 0 8px rgba(34, 197, 94, 0)' },
    ], { duration: 600 })
  }, [createSpringAnimation])

  const errorShake = useCallback((element: HTMLElement) => {
    createSpringAnimation(element, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ], { duration: 400 })
  }, [createSpringAnimation])

  const fadeInUp = useCallback((element: HTMLElement, delay = 0) => {
    createSpringAnimation(element, [
      { opacity: '0', transform: 'translateY(20px)' },
      { opacity: '1', transform: 'translateY(0)' },
    ], { duration: 300, delay })
  }, [createSpringAnimation])

  const staggerChildren = useCallback((parent: HTMLElement, selector: string, baseDelay = 50) => {
    const children = parent.querySelectorAll(selector)
    children.forEach((child, index) => {
      setTimeout(() => {
        fadeInUp(child as HTMLElement, index * baseDelay)
      }, 0)
    })
  }, [fadeInUp])

  return {
    createSpringAnimation,
    pressFeedback,
    hoverLift,
    successPulse,
    errorShake,
    fadeInUp,
    staggerChildren,
  }
}

// ============================================================================
// 3. 性能监控与优化
// ============================================================================

export const usePerformanceMonitor = () => {
  const measureRenderTime = useCallback((componentName: string, renderFn: () => void) => {
    const startMark = `${componentName}-start`
    const endMark = `${componentName}-end`

    performance.mark(startMark)
    renderFn()
    performance.mark(endMark)
    performance.measure(componentName, startMark, endMark)

    const measure = performance.getEntriesByName(componentName)[0]
    if (measure && measure.duration > 16.67) {
      logger.warn(`[Performance] ⚠️ ${componentName} 渲染耗时 ${measure.duration.toFixed(2)}ms (>16.67ms)`)
    }

    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(componentName)
  }, [])

  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func(...args), wait)
    }
  }, [])

  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    limit: number,
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle = false

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => { inThrottle = false }, limit)
      }
    }
  }, [])

  return { measureRenderTime, debounce, throttle }
}

// ============================================================================
// 4. 响应式断点检测
// ============================================================================

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export const useResponsive = () => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('md')
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth

      if (width < 640) {
        setBreakpoint('xs')
        setIsMobile(true)
        setIsTablet(false)
        setIsDesktop(false)
      } else if (width < 768) {
        setBreakpoint('sm')
        setIsMobile(true)
        setIsTablet(false)
        setIsDesktop(false)
      } else if (width < 1024) {
        setBreakpoint('md')
        setIsMobile(false)
        setIsTablet(true)
        setIsDesktop(false)
      } else if (width < 1280) {
        setBreakpoint('lg')
        setIsMobile(false)
        setIsTablet(false)
        setIsDesktop(true)
      } else if (width < 1536) {
        setBreakpoint('xl')
        setIsMobile(false)
        setIsTablet(false)
        setIsDesktop(true)
      } else {
        setBreakpoint('2xl')
        setIsMobile(false)
        setIsTablet(false)
        setIsDesktop(true)
      }
    }

    updateBreakpoint()

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(updateBreakpoint, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  return { breakpoint, isMobile, isTablet, isDesktop }
}

// ============================================================================
// 5. 用户反馈系统
// ============================================================================

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface FeedbackMessage {
  id: string
  type: FeedbackType
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export const useFeedbackSystem = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackMessage[]>([])

  const removeFeedback = useCallback((id: string) => {
    setFeedbacks(prev => prev.filter(f => f.id !== id))
  }, [])

  const addFeedback = useCallback((feedback: Omit<FeedbackMessage, 'id'>) => {
    const id = `feedback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const newFeedback: FeedbackMessage = { ...feedback, id }

    setFeedbacks(prev => [...prev, newFeedback])

    const duration = feedback.duration || (feedback.type === 'error' ? 5000 : 3000)

    if (duration > 0) {
      setTimeout(() => {
        removeFeedback(id)
      }, duration)
    }

    return id
  }, [removeFeedback])

  const clearAllFeedbacks = useCallback(() => {
    setFeedbacks([])
  }, [])

  const showSuccess = useCallback((title: string, description?: string) => {
    return addFeedback({ type: 'success', title, description })
  }, [addFeedback])

  const showError = useCallback((title: string, description?: string) => {
    return addFeedback({ type: 'error', title, description, duration: 5000 })
  }, [addFeedback])

  const showWarning = useCallback((title: string, description?: string) => {
    return addFeedback({ type: 'warning', title, description })
  }, [addFeedback])

  const showInfo = useCallback((title: string, description?: string) => {
    return addFeedback({ type: 'info', title, description })
  }, [addFeedback])

  const showLoading = useCallback((title: string, description?: string) => {
    return addFeedback({ type: 'loading', title, description, duration: 0 })
  }, [addFeedback])

  return {
    feedbacks,
    addFeedback,
    removeFeedback,
    clearAllFeedbacks,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
  }
}

import { useState } from 'react'

import { logger } from '@/utils/safeLogger';
