import { useState, useEffect, useCallback } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export interface UseDeviceInfoResult {
  deviceType: DeviceType
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouch: boolean
  supportsHover: boolean
  viewportWidth: number
  viewportHeight: number
  pixelRatio: number
  orientation: 'portrait' | 'landscape' | 'unknown'
}

export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<UseDeviceInfoResult>({
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouch: false,
    supportsHover: true,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 1080,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    orientation: 'unknown',
  })

  const updateDeviceInfo = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = window.devicePixelRatio || 1

    let deviceType: DeviceType = 'desktop'
    let isMobile = false
    let isTablet = false
    let isDesktop = true

    if (width < 768) {
      deviceType = 'mobile'
      isMobile = true
      isDesktop = false
    } else if (width >= 768 && width < 1024) {
      deviceType = 'tablet'
      isTablet = true
      isDesktop = false
    }

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const supportsHover = !isTouch || (navigator as any).hover !== undefined

    let orientation: 'portrait' | 'landscape' | 'unknown' = 'unknown'
    if (typeof screen !== 'undefined' && screen.orientation) {
      orientation = screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape'
    } else if (height > width) {
      orientation = 'portrait'
    } else if (width > height) {
      orientation = 'landscape'
    }

    setDeviceInfo({
      deviceType,
      isMobile,
      isTablet,
      isDesktop,
      isTouch,
      supportsHover,
      viewportWidth: width,
      viewportHeight: height,
      pixelRatio,
      orientation,
    })
  }, [])

  useEffect(() => {
    updateDeviceInfo()

    window.addEventListener('resize', updateDeviceInfo)
    window.addEventListener('orientationchange', updateDeviceInfo)

    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      window.removeEventListener('orientationchange', updateDeviceInfo)
    }
  }, [updateDeviceInfo])

  return deviceInfo
}

export interface UseBreakpointOptions {
  breakpoints?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    xxl?: number
  }
}

export function useBreakpoint(options: UseBreakpointOptions = {}) {
  const { breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 } } = options

  const [breakpoint, setBreakpoint] = useState<string>('lg')
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920)

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWidth(w)

      if (w >= (breakpoints.xxl || 1400)) setBreakpoint('xxl')
      else if (w >= (breakpoints.xl || 1200)) setBreakpoint('xl')
      else if (w >= (breakpoints.lg || 992)) setBreakpoint('lg')
      else if (w >= (breakpoints.md || 768)) setBreakpoint('md')
      else if (w >= (breakpoints.sm || 576)) setBreakpoint('sm')
      else setBreakpoint('xs')
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoints])

  return { breakpoint, width }
}

export function useIsomorphicLayoutEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList,
): void {
  if (typeof window !== 'undefined') {
    useEffect(effect, deps)
  }
}

export interface ResponsiveValue<T> {
  base?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  xxl?: T
}

export function useResponsiveValue<T>(values: ResponsiveValue<T>, defaultValue: T): T {
  const { breakpoint } = useBreakpoint()

  if ((values as any)[breakpoint] !== undefined) {
    return (values as any)[breakpoint] as T
  }

  if (breakpoint === 'xxl' && values.xl !== undefined) return values.xl
  if (breakpoint === 'xl' && values.lg !== undefined) return values.lg
  if (breakpoint === 'lg' && values.md !== undefined) return values.md
  if (breakpoint === 'md' && values.sm !== undefined) return values.sm
  if (breakpoint === 'sm' && values.base !== undefined) return values.base

  return values.base ?? defaultValue
}

export interface UseTouchFriendlyOptions {
  tapHighlightColor?: string
  userSelect?: boolean
  touchAction?: string
}

export function useTouchFriendly(options: UseTouchFriendlyOptions = {}) {
  const { tapHighlightColor = 'transparent', userSelect = false, touchAction = 'manipulation' } = options

  const touchStyles = {
    WebkitTapHighlightColor: tapHighlightColor,
    userSelect: userSelect ? 'text' as const : 'none' as const,
    touchAction,
    WebkitUserSelect: userSelect ? 'text' as const : 'none' as const,
  }

  return touchStyles
}

export function usePullToRefresh(elementRef: React.RefObject<HTMLElement>, onRefresh: () => Promise<void>) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = { current: 0 }
  const isPullRef = { current: false }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY
      isPullRef.current = true
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullRef.current) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current

    if (diff > 0) {
      e.preventDefault()
      setPullDistance(Math.min(diff, 100))
      setIsPulling(diff > 50)
    }
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (isPulling && pullDistance >= 50) {
      await onRefresh()
    }
    setPullDistance(0)
    setIsPulling(false)
    isPullRef.current = false
  }, [isPulling, pullDistance, onRefresh])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd])

  return { isPulling, pullDistance }
}

export function useSwipeNavigation(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 50,
) {
  const startXRef = { current: 0 }
  const isSwipingRef = { current: false }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    isSwipingRef.current = true
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isSwipingRef.current) return

    const endX = e.changedTouches[0].clientX
    const diff = endX - startXRef.current

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        onSwipeRight?.()
      } else {
        onSwipeLeft?.()
      }
    }

    isSwipingRef.current = false
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { handleTouchStart, handleTouchEnd }
}
