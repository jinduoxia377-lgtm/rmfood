import { useEffect, useCallback, useState, useRef } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
  scope?: 'global' | 'local'
  enabled?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue

        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

export interface GestureState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  direction: 'none' | 'left' | 'right' | 'up' | 'down'
  distance: number
  isSwiping: boolean
}

export interface UseGesturesOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onPinch?: (scale: number) => void
  onRotate?: (angle: number) => void
  threshold?: number
  velocityThreshold?: number
}

export function useGestures(
  elementRef: React.RefObject<HTMLElement>,
  options: UseGesturesOptions = {},
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.5,
  } = options

  const [gestureState, setGestureState] = useState<GestureState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    direction: 'none',
    distance: 0,
    isSwiping: false,
  })

  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    setGestureState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      direction: 'none',
      distance: 0,
      isSwiping: true,
    })
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!gestureState.isSwiping) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - gestureState.startX
    const deltaY = touch.clientY - gestureState.startY

    let direction: GestureState['direction'] = 'none'
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left'
    } else {
      direction = deltaY > 0 ? 'down' : 'up'
    }

    setGestureState((prev) => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      direction,
      distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
    }))
  }, [gestureState.isSwiping, gestureState.startX, gestureState.startY])

  const handleTouchEnd = useCallback(() => {
    if (!gestureState.isSwiping) return

    const { direction, distance } = gestureState

    if (distance > threshold) {
      const velocity = distance / (Date.now() - (lastTouchRef.current?.time || Date.now())) * 1000

      if (velocity > velocityThreshold) {
        switch (direction) {
          case 'left':
            onSwipeLeft?.()
            break
          case 'right':
            onSwipeRight?.()
            break
          case 'up':
            onSwipeUp?.()
            break
          case 'down':
            onSwipeDown?.()
            break
        }
      }
    }

    setGestureState((prev) => ({
      ...prev,
      isSwiping: false,
      distance: 0,
      direction: 'none',
    }))
  }, [gestureState, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd])

  return gestureState
}

export interface LongPressOptions {
  onLongPress?: () => void
  onLongPressComplete?: () => void
  threshold?: number
}

export function useLongPress(
  callback: () => void,
  options: LongPressOptions = {},
) {
  const { threshold = 500 } = options
  const [isPressed, setIsPressed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetRef = useRef<EventTarget | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      setIsPressed(true)
      targetRef.current = event.target

      startPosRef.current = 'touches' in event && event.touches.length > 0
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : 'clientX' in event
          ? { x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY }
          : null

      timeoutRef.current = setTimeout(() => {
        options.onLongPress?.()
        callback()
        options.onLongPressComplete?.()
      }, threshold)
    },
    [callback, options, threshold],
  )

  const cancel = useCallback(() => {
    setIsPressed(false)
    startPosRef.current = null
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  /** 手指移动超过容差即视为「在滚动页面」，取消长按，避免滑动时误弹出上下文菜单 */
  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      const start = startPosRef.current
      const touch = event.touches[0]
      if (!start || !touch) return
      const dx = Math.abs(touch.clientX - start.x)
      const dy = Math.abs(touch.clientY - start.y)
      if (dx > 10 || dy > 10) cancel()
    },
    [cancel],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isPressed,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onTouchMove: handleTouchMove,
    },
  }
}

export interface PinchZoomState {
  scale: number
  isPinching: boolean
}

export function usePinchZoom(elementRef: React.RefObject<HTMLElement>) {
  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    isPinching: false,
  })

  const lastDistanceRef = useRef<number>(0)

  const getDistance = (touches: TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastDistanceRef.current = getDistance(e.touches)
        setState((prev) => ({ ...prev, isPinching: true }))
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && state.isPinching) {
        const distance = getDistance(e.touches)
        const scale = distance / lastDistanceRef.current
        setState((prev) => ({ ...prev, scale: prev.scale * scale }))
        lastDistanceRef.current = distance
      }
    }

    const handleTouchEnd = () => {
      setState((prev) => ({ ...prev, isPinching: false }))
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, state.isPinching])

  const reset = useCallback(() => {
    setState({ scale: 1, isPinching: false })
  }, [])

  return { ...state, reset }
}

export const FORMULA_GENERATION_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'g',
    description: '生成配方',
    action: () => {},
  },
  {
    key: 's',
    ctrl: true,
    description: '保存配方',
    action: () => {},
  },
  {
    key: 'z',
    ctrl: true,
    description: '撤销',
    action: () => {},
  },
  {
    key: 'z',
    ctrl: true,
    shift: true,
    description: '重做',
    action: () => {},
  },
  {
    key: 'e',
    description: '切换高级模式',
    action: () => {},
  },
  {
    key: 'v',
    description: '切换视图模式',
    action: () => {},
  },
  {
    key: '1',
    description: '配方生成',
    action: () => {},
  },
  {
    key: '2',
    description: '配方对话',
    action: () => {},
  },
  {
    key: '3',
    description: '配方安全',
    action: () => {},
  },
  {
    key: '?',
    description: '显示快捷键帮助',
    action: () => {},
  },
]
