import { useState, useCallback, useEffect, useRef } from 'react'

export interface TourStep {
  id: string
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  actionText?: string
  skipText?: string
}

export interface TourOptions {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  onStepChange?: (step: TourStep, index: number) => void
}

export function useTour(options: TourOptions) {
  const { steps, onComplete, onSkip, onStepChange } = options
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const start = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
    setIsVisible(true)
  }, [])

  const stop = useCallback(() => {
    setIsActive(false)
    setIsVisible(false)
    setCurrentStep(0)
  }, [])

  const next = useCallback(() => {
    if (isLastStep) {
      onComplete?.()
      stop()
    } else {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(steps[nextStep], nextStep)
    }
  }, [currentStep, isLastStep, onComplete, onStepChange, stop, steps])

  const previous = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      onStepChange?.(steps[prevStep], prevStep)
    }
  }, [currentStep, isFirstStep, onStepChange, steps])

  const skip = useCallback(() => {
    onSkip?.()
    stop()
  }, [onSkip, stop])

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index)
        onStepChange?.(steps[index], index)
      }
    },
    [onStepChange, steps],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return

      switch (e.key) {
        case 'Escape':
          skip()
          break
        case 'ArrowRight':
        case 'Enter':
          next()
          break
        case 'ArrowLeft':
          previous()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, next, previous, skip])

  return {
    step,
    currentStep,
    totalSteps: steps.length,
    isActive,
    isVisible,
    isFirstStep,
    isLastStep,
    tooltipRef,
    start,
    stop,
    next,
    previous,
    skip,
    goToStep,
  }
}

export interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function useTooltip({ delay = 200 }: { delay?: number } = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((_e: React.MouseEvent | React.FocusEvent) => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }, [])

  const updatePosition = useCallback((rect: DOMRect) => {
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }, [])

  return {
    isVisible,
    position,
    triggerRef,
    show,
    hide,
    updatePosition,
  }
}

export interface FeatureHighlightProps {
  id: string
  title: string
  description: string
  learnMoreUrl?: string
}

export function useFeatureAnnouncements() {
  const [announcements, setAnnouncements] = useState<FeatureHighlightProps[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const addAnnouncement = useCallback((announcement: FeatureHighlightProps) => {
    setAnnouncements((prev) => [...prev, announcement])
  }, [])

  const removeAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setAnnouncements([])
    setCurrentIndex(0)
  }, [])

  const next = useCallback(() => {
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [currentIndex, announcements.length])

  const previous = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex])

  return {
    announcements,
    currentAnnouncement: announcements[currentIndex],
    currentIndex,
    total: announcements.length,
    addAnnouncement,
    removeAnnouncement,
    dismissAll,
    next,
    previous,
    hasNext: currentIndex < announcements.length - 1,
    hasPrevious: currentIndex > 0,
  }
}

export interface KeyboardShortcut {
  key: string
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  description: string
  action: () => void
}

export function useGlobalShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifiersMatch =
          !shortcut.modifiers ||
          shortcut.modifiers.every((mod) => {
            switch (mod) {
              case 'ctrl':
                return e.ctrlKey
              case 'alt':
                return e.altKey
              case 'shift':
                return e.shiftKey
              case 'meta':
                return e.metaKey
              default:
                return false
            }
          })

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (modifiersMatch && keyMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export interface OnboardingProgress {
  completedSteps: string[]
  totalSteps: number
  percentage: number
}

export function useOnboardingProgress() {
  const [progress, setProgress] = useState<OnboardingProgress>({
    completedSteps: [],
    totalSteps: 5,
    percentage: 0,
  })

  const completeStep = useCallback((stepId: string) => {
    setProgress((prev) => {
      if (prev.completedSteps.includes(stepId)) return prev

      const newCompletedSteps = [...prev.completedSteps, stepId]
      const percentage = Math.round(
        (newCompletedSteps.length / prev.totalSteps) * 100,
      )

      return { ...prev, completedSteps: newCompletedSteps, percentage }
    })
  }, [])

  const resetProgress = useCallback(() => {
    setProgress({
      completedSteps: [],
      totalSteps: 5,
      percentage: 0,
    })
  }, [])

  const isStepCompleted = useCallback(
    (stepId: string) => progress.completedSteps.includes(stepId),
    [progress.completedSteps],
  )

  return {
    progress,
    completeStep,
    resetProgress,
    isStepCompleted,
  }
}
