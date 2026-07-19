import { useState, useEffect, useRef, memo } from 'react'

interface DosagePercentageBarProps {
  percentage: number | null
  maxValue?: number
  showLabel?: boolean
  size?: 'small' | 'medium' | 'large'
  colorScheme?: string
  absoluteAmount?: { value: number; unit: string }
}

const SIZE_CONFIG = {
  small: {
    height: 'h-1.5',
    fontSize: 'text-[10px]',
    minWidth: 'min-w-[40px]',
  },
  medium: {
    height: 'h-2.5',
    fontSize: 'text-xs',
    minWidth: 'min-w-[60px]',
  },
  large: {
    height: 'h-4',
    fontSize: 'text-sm',
    minWidth: 'min-w-[80px]',
  },
}

function getBarColor(percentage: number): string {
  if (percentage >= 30) return '#003E87'
  if (percentage >= 10) return '#007AFF'
  return '#9ca3af'
}

function getBarColorDark(percentage: number): string {
  if (percentage >= 30) return '#6ECAFF'
  if (percentage >= 10) return '#A8DFFF'
  return '#6b7280'
}

const DosagePercentageBar = memo(({
  percentage,
  maxValue = 100,
  showLabel = true,
  size = 'small',
  colorScheme,
  absoluteAmount,
}: DosagePercentageBarProps) => {
  const [animatedWidth, setAnimatedWidth] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationRef = useRef<boolean>(false)

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }

    checkDarkMode()

    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!animationRef.current && percentage !== null && percentage > 0) {
      animationRef.current = true

      const timer = setTimeout(() => {
        setAnimatedWidth(Math.min(percentage, maxValue))
      }, 50)

      return () => clearTimeout(timer)
    } else if (percentage === null || percentage === 0) {
      setAnimatedWidth(0)
      animationRef.current = false
    }
    return () => {}
  }, [percentage, maxValue])

  const handleMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }

    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, 200)
  }

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
    setShowTooltip(false)
  }

  if (percentage === null) {
    return (
      <span className={`${SIZE_CONFIG[size].fontSize} text-neutral-400 dark:text-neutral-500`}>
        —
      </span>
    )
  }

  const displayPercentage = parseFloat(percentage.toFixed(1))
  const barColor = isDarkMode ? getBarColorDark(displayPercentage) : getBarColor(displayPercentage)
  const config = SIZE_CONFIG[size]

  return (
    <div className="relative inline-flex flex-col items-center gap-1 group">
      <div
        className={`relative ${config.minWidth} w-full max-w-[120px]`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`
            ${config.height} w-full rounded-full overflow-hidden
            bg-neutral-200 dark:bg-neutral-700
            transition-all duration-500 ease-out
          `}
          role="progressbar"
          aria-valuenow={displayPercentage}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          aria-label={`用量占比: ${displayPercentage}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${animatedWidth}%`,
              backgroundColor: colorScheme || barColor,
              boxShadow: animatedWidth > 0 ? `0 0 8px ${colorScheme || barColor}40` : 'none',
            }}
          />
        </div>

        {showTooltip && (
          <div
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              px-3 py-2 text-xs
              bg-neutral-900 dark:bg-neutral-100
              text-white dark:text-neutral-900
              rounded-lg shadow-lg
              z-50
              whitespace-nowrap
              pointer-events-none
              animate-in fade-in zoom-in-95 duration-200
            "
            style={{ animationDuration: '150ms' }}
          >
            <div className="font-medium">
              用量占比: {displayPercentage}%
            </div>
            {absoluteAmount && (
              <div className="text-neutral-300 dark:text-neutral-600 mt-0.5">
                绝对用量: {absoluteAmount.value.toFixed(2)} {absoluteAmount.unit}
              </div>
            )}
            <div
              className="
                absolute top-full left-1/2 -translate-x-1/2
                -mt-px border-4 border-transparent
                border-t-slate-900 dark:border-t-slate-100
              "
            />
          </div>
        )}
      </div>

      {showLabel && (
        <span
          className={`
            ${config.fontSize} font-mono font-medium
            text-neutral-700 dark:text-neutral-300
            tabular-nums
          `}
          style={{ color: colorScheme || barColor }}
        >
          {displayPercentage}%
        </span>
      )}
    </div>
  )
})

DosagePercentageBar.displayName = 'DosagePercentageBar'

export default DosagePercentageBar
