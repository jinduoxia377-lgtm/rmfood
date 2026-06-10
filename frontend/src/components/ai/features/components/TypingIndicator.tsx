import React, { memo } from 'react'

interface TypingIndicatorProps {
  variant?: 'dots' | 'pulse' | 'bar'
  color?: string
  size?: 'sm' | 'md'
  className?: string
}

const SIZE_MAP = {
  sm: { dot: 6, barWidth: 3, barHeight: 12 },
  md: { dot: 8, barWidth: 4, barHeight: 16 },
}

function TypingIndicator({
  variant = 'dots',
  color = '#667eea',
  size = 'md',
  className = '',
}: TypingIndicatorProps) {
  const dimensions = SIZE_MAP[size]

  if (variant === 'pulse') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        role="status"
        aria-label="AI 正在思考"
      >
        <span
          className="typing-indicator-pulse rounded-full"
          style={{
            width: dimensions.dot * 2,
            height: dimensions.dot * 2,
            backgroundColor: color,
          }}
        />
      </div>
    )
  }

  if (variant === 'bar') {
    return (
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        role="status"
        aria-label="AI 正在输入"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-indicator-bar rounded-full origin-bottom"
            style={{
              width: dimensions.barWidth,
              height: dimensions.barHeight,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role="status"
      aria-label="AI 正在输入"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-indicator-dot rounded-full"
          style={{
            width: dimensions.dot,
            height: dimensions.dot,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  )
}

export default memo(TypingIndicator)
