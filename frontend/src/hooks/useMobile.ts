/**
 * 移动端响应式工具集
 *
 * 功能:
 * - 断点检测 Hook
 * - 触摸手势支持
 * - 移动端专用布局组件
 * - 安全区域适配（刘海屏等）
 *
 * @author RMFOOD Team
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ── 断点定义 (根据用户需求: 桌面端≥1200px、平板端768-1199px、移动端<768px) ──

export const BREAKPOINTS = {
  mobile: 0,      // 移动端: < 768px
  tablet: 768,    // 平板端: 768px - 1199px
  desktop: 1200,  // 桌面端: ≥ 1200px
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

// ── 断点检测 Hook ──

interface BreakpointResult {
  /** 当前断点 */
  breakpoint: Breakpoint
  /** 是否为移动端 (< 768px) */
  isMobile: boolean
  /** 是否为平板端 (768px - 1199px) */
  isTablet: boolean
  /** 是否为桌面端 (≥ 1200px) */
  isDesktop: boolean
  /** 窗口宽度 */
  width: number
  /** 窗口高度 */
  height: number
}

/**
 * 响应式断点检测 Hook
 *
 * @example
 * const { isMobile, isTablet, isDesktop, breakpoint } = useBreakpoint()
 *
 * if (isMobile) {
 *   return <MobileLayout />
 * }
 */
export function useBreakpoint(): BreakpointResult {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize() // 初始化

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const breakpoint = useCallback((): Breakpoint => {
    const { width } = size
    if (width >= BREAKPOINTS.desktop) return 'desktop'
    if (width >= BREAKPOINTS.tablet) return 'tablet'
    return 'mobile'
  }, [size])

  const currentBP = breakpoint()

  return {
    breakpoint: currentBP,
    isMobile: size.width < BREAKPOINTS.tablet,
    isTablet: size.width >= BREAKPOINTS.tablet && size.width < BREAKPOINTS.desktop,
    isDesktop: size.width >= BREAKPOINTS.desktop,
    width: size.width,
    height: size.height,
  }
}

// ── 安全区域检测 Hook ──

interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * 安全区域检测（用于刘海屏、底部指示器等）
 *
 * @example
 * const safeArea = useSafeArea()
 *
 * <div style={{ paddingTop: safeArea.top }}>
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const getInsets = (): SafeAreaInsets => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)

      return {
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      }
    }

    setInsets(getInsets())

    // 监听方向变化（手机旋转）
    const mediaQuery = window.matchMedia('(orientation: portrait)')
    const handleChange = () => setInsets(getInsets())

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return insets
}

// ── 触摸手势 Hook ──

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
}

/**
 * 滑动手势 Hook
 *
 * @example
 * const swipeHandlers = useSwipe({
 *   onSwipeLeft: () => next(),
 *   onSwipeRight: () => prev(),
 * })
 *
 * <div {...swipeHandlers}>可滑动内容</div>
 */
export function useSwipe(handlers: SwipeHandlers = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
  } = handlers

  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y

    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // 判断是水平还是垂直滑动
    if (absDeltaX > absDeltaY) {
      // 水平滑动
      if (absDeltaX > threshold) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      }
    } else {
      // 垂直滑动
      if (absDeltaY > threshold) {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown()
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp()
        }
      }
    }

    touchStart.current = null
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold])

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }
}

// ── 长按手势 Hook ──

interface LongPressHandlers {
  onLongPress: () => void
  delay?: number
  onTouchStart?: () => void
  onTouchEnd?: () => void
}

/**
 * 长按手势 Hook
 *
 * @example
 * const longPressHandlers = useLongPress({
 *   onLongPress: () => showContextMenu(),
 *   delay: 500,
 * })
 *
 * <button {...longPressHandlers}>长按操作</button>
 */
export function useLongPress(handlers: LongPressHandlers) {
  const { onLongPress, delay = 500, onTouchStart, onTouchEnd } = handlers
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    onTouchStart?.()
    timeoutRef.current = setTimeout(() => {
      onLongPress()
    }, delay)
  }, [onLongPress, onTouchStart, delay])

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    onTouchEnd?.()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [onTouchEnd])

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
  }
}

// ── 双指捏合手势 Hook ──

interface PinchHandlers {
  onPinch?: (scale: number) => void
  onPinchStart?: () => void
  onPinchEnd?: () => void
}

/**
 * 双指捏合手势 Hook（用于缩放）
 *
 * @example
 * const pinchHandlers = usePinch({
 *   onPinch: (scale) => setZoom(scale),
 * })
 *
 * <div {...pinchHandlers}>可缩放内容</div>
 */
export function usePinch(handlers: PinchHandlers = {}) {
  const { onPinch, onPinchStart, onPinchEnd } = handlers
  const initialDistance = useRef<number | null>(null)
  const initialScale = useRef(1)

  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0
    const touch0 = touches.item(0)
    const touch1 = touches.item(1)
    if (!touch0 || !touch1) return 0
    const dx = touch0.clientX - touch1.clientX
    const dy = touch0.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches)
      initialScale.current = 1
      onPinchStart?.()
    }
  }, [onPinchStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current) {
      const currentDistance = getDistance(e.touches)
      const scale = currentDistance / initialDistance.current
      onPinch?.(initialScale.current * scale)
    }
  }, [onPinch])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistance.current = null
      onPinchEnd?.()
    }
  }, [onPinchEnd])

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }
}

// ── CSS 工具类生成 ──

/**
 * 生成响应式 CSS 类名
 */
export function responsiveClass(
  base: string,
  variants: Partial<Record<Breakpoint, string>>,
): string {
  const classes = [base]

  for (const [bp, className] of Object.entries(variants)) {
    if (className) {
      classes.push(`${bp}:${className}`)
    }
  }

  return classes.join(' ')
}

/**
 * 网格列数（根据断点）
 */
export function getGridColumns(breakpoint: Breakpoint): number {
  switch (breakpoint) {
    case 'mobile': return 1
    case 'tablet': return 2
    case 'desktop': return 3
    default: return 3
  }
}

/**
 * 获取断点对应的容器最大宽度
 */
export function getContainerMaxWidth(breakpoint: Breakpoint): number {
  switch (breakpoint) {
    case 'mobile': return 100
    case 'tablet': return 960
    case 'desktop': return 1200
    default: return 1200
  }
}

/**
 * 获取断点对应的间距大小
 */
export function getSpacing(breakpoint: Breakpoint): string {
  switch (breakpoint) {
    case 'mobile': return 'var(--space-4)'
    case 'tablet': return 'var(--space-6)'
    case 'desktop': return 'var(--space-8)'
    default: return 'var(--space-4)'
  }
}

// ── 触摸操作辅助函数 ──

/**
 * 判断是否为触摸设备
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * 获取触摸位置
 */
export function getTouchPosition(e: React.TouchEvent): { x: number; y: number } {
  const touch = e.touches[0] || e.changedTouches[0]
  return {
    x: touch?.clientX || 0,
    y: touch?.clientY || 0,
  }
}

// ── 移动端专用组件导出 ──

export { default as ResponsiveContainer } from './components/ResponsiveContainer'
export { default as MobileBottomSheet } from './components/MobileBottomSheet'
export { default as PullToRefresh } from './components/PullToRefresh'
export { default as TouchButton } from './components/TouchButton'
export { default as TouchCard } from './components/TouchCard'
