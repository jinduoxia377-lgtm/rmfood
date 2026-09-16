import { memo } from 'react'
import type { Precaution, PrecautionSeverity } from '@/types/ai.types'
import {
  getPrecautionIcon,
  getPrecautionColor,
} from '@/services/precautionEngine'

type BadgeSize = 'sm' | 'md' | 'lg'

interface PrecautionBadgeProps {
  precautions: Precaution[]
  size?: BadgeSize
  onClick?: () => void
}

const SIZE_CONFIG: Record<BadgeSize, { iconSize: string; textSize: string; padding: string }> = {
  sm: { iconSize: 'text-xs', textSize: 'text-xs', padding: 'px-1.5 py-0.5' },
  md: { iconSize: 'text-sm', textSize: 'text-sm', padding: 'px-2 py-1' },
  lg: { iconSize: 'text-base', textSize: 'text-base', padding: 'px-3 py-1.5' },
}

function getHighestSeverity(precautions: Precaution[]): PrecautionSeverity | null {
  if (precautions.length === 0) return null

  const severityOrder: Record<PrecautionSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return precautions.reduce((highest, current) => {
    const highestOrder = severityOrder[highest] ?? 4
    const currentOrder = severityOrder[current.severity] ?? 4
    return currentOrder < highestOrder ? current.severity : highest
  }, precautions[0]?.severity ?? 'low')
}

const PrecautionBadge = memo(({ precautions, size = 'sm', onClick }: PrecautionBadgeProps) => {
  if (!precautions || precautions.length === 0) {
    return <span className="text-neutral-300">—</span>
  }

  const highestSeverity = getHighestSeverity(precautions)
  if (!highestSeverity) {
    return <span className="text-neutral-300">—</span>
  }

  const config = SIZE_CONFIG[size]
  const icon = getPrecautionIcon(highestSeverity)
  const color = getPrecautionColor(highestSeverity)
  const count = precautions.length
  const hasCriticalOrHigh = highestSeverity === 'critical' || highestSeverity === 'high'
  const hasMediumOnly = highestSeverity === 'medium'

  const baseClasses = `
    inline-flex items-center gap-1 rounded-full font-medium cursor-pointer
    transition-all duration-200 select-none
    ${config.padding}
    ${config.textSize}
    ${onClick ? 'hover:scale-105 hover:shadow-md active:scale-95' : ''}
  `

  const pulseAnimation = hasCriticalOrHigh
    ? 'animate-pulse'
    : hasMediumOnly
    ? 'hover:animate-pulse'
    : ''

  let badgeContent: React.ReactNode
  let badgeStyle: React.CSSProperties = {}

  if (hasCriticalOrHigh) {
    // Red badge with forced pulse animation for danger/critical
    badgeStyle = {
      backgroundColor: `${color}15`,
      color,
      border: `1.5px solid ${color}`,
    }
    badgeContent = (
      <>
        <span className={`${config.iconSize} ${pulseAnimation}`}>{icon}</span>
        {count > 1 && (
          <span className="min-w-[16px] h-4 flex items-center justify-center bg-white rounded-full text-[10px] font-bold px-1" style={{ color }}>
            {count}
          </span>
        )}
      </>
    )
  } else if (hasMediumOnly) {
    // Yellow/Orange badge for warnings with optional pulse
    badgeStyle = {
      backgroundColor: `${color}10`,
      color,
      border: `1px solid ${color}40`,
    }
    badgeContent = (
      <>
        <span className={config.iconSize}>{icon}</span>
        {count > 1 && (
          <span className="font-bold">{count}</span>
        )}
      </>
    )
  } else {
    // Blue/Green badge for info/tips
    badgeStyle = {
      backgroundColor: `${color}08`,
      color,
      border: `1px solid ${color}30`,
    }
    badgeContent = (
      <>
        <span className={config.iconSize}>{icon}</span>
        {count > 1 && (
          <span className="font-bold">{count}</span>
        )}
      </>
    )
  }

  const highestTitle = precautions.find((p) => p.severity === highestSeverity)?.content || '注意事项'

  return (
    <div
      className={`${baseClasses} ${pulseAnimation}`}
      style={badgeStyle}
      title={highestTitle}
      role="button"
      tabIndex={0}
      aria-label={`注意事项: ${count}条${highestSeverity === 'critical' ? '危险' : highestSeverity === 'high' ? '警告' : highestSeverity === 'medium' ? '提示' : '建议'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {badgeContent}
    </div>
  )
})

PrecautionBadge.displayName = 'PrecautionBadge'

export default PrecautionBadge

