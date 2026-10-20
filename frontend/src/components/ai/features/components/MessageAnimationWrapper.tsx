import React, { memo, useEffect, useState } from 'react'

interface MessageAnimationWrapperProps {
  type?: 'user' | 'ai' | 'system'
  children: React.ReactNode
  animate?: boolean
  className?: string
}

const ANIMATION_CONFIG = {
  user: {
    className: 'chat-message-user',
    animationName: 'slideInRight',
    duration: '200ms',
  },
  ai: {
    className: 'chat-message-ai',
    animationName: 'slideInLeft',
    duration: '200ms',
  },
  system: {
    className: 'chat-message-system',
    animationName: 'fadeInUp',
    duration: '150ms',
  },
}

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefersReduced(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

function MessageAnimationWrapper({
  type = 'ai',
  children,
  animate = true,
  className = '',
}: MessageAnimationWrapperProps) {
  const prefersReduced = usePrefersReducedMotion()
  const config = ANIMATION_CONFIG[type]
  const shouldAnimate = animate && !prefersReduced

  if (!shouldAnimate) {
    return (
      <div className={className} style={{ opacity: 1, transform: 'none' }}>
        {children}
      </div>
    )
  }

  return (
    <div className={`${config.className} ${className}`}>
      {children}
    </div>
  )
}

export default memo(MessageAnimationWrapper)
