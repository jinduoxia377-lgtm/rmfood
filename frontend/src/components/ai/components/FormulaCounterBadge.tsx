import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import { FlaskConical } from 'lucide-react'
import type { ParsedFormula } from '@/types/ai.types'

interface FormulaCounterBadgeProps {
  count: number
  onClick?: () => void
  formulas?: ParsedFormula[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

type BadgeSize = 'sm' | 'md' | 'lg'

const SIZE_CONFIG: Record<BadgeSize, { diameter: string; fontSize: string; iconSize: number }> = {
  sm: { diameter: 'w-6 h-6', fontSize: 'text-xs', iconSize: 12 },
  md: { diameter: 'w-7 h-7', fontSize: 'text-sm', iconSize: 14 },
  lg: { diameter: 'w-8 h-8', fontSize: 'text-base', iconSize: 16 },
}

function getBadgeColor(count: number): string {
  if (count === 0) {
    return 'bg-neutral-400 text-white dark:bg-neutral-500'
  }
  if (count > 0 && count < 5) {
    return 'bg-secondary-container text-secondary-main dark:bg-secondary-container'
  }
  return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white dark:from-emerald-600 dark:to-teal-700'
}

const FormulaCounterBadgeComponent = ({
  count,
  onClick,
  formulas = [],
  className = '',
  size = 'md',
}: FormulaCounterBadgeProps) => {
  const [isBouncing, setIsBouncing] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const prevCountRef = useRef(count)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const badgeRef = useRef<HTMLButtonElement>(null)

  const sizeConfig = SIZE_CONFIG[size]
  const badgeColor = useMemo(() => getBadgeColor(count), [count])

  const displayFormulas = useMemo(() => {
    if (!formulas || formulas.length === 0) return []
    return formulas.slice(-3).reverse().map(f => ({
      ...f,
      ingredientCount: f.ingredientCount ?? f.ingredients?.length ?? 0,
    }))
  }, [formulas])

  useEffect(() => {
    let bounceTimer: NodeJS.Timeout | undefined
    let pulseTimer: NodeJS.Timeout | undefined
    if (prevCountRef.current !== count && prevCountRef.current !== undefined) {
      setIsBouncing(true)
      setIsPulsing(true)

      bounceTimer = setTimeout(() => setIsBouncing(false), 300)
      pulseTimer = setTimeout(() => setIsPulsing(false), 1200)
    }
    prevCountRef.current = count

    return () => {
      if (bounceTimer) clearTimeout(bounceTimer)
      if (pulseTimer) clearTimeout(pulseTimer)
    }
  }, [count])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    if (formulas && formulas.length > 0) {
      const timer = setTimeout(() => setShowTooltip(true), 100)
      tooltipTimeoutRef.current = timer
    }
  }, [formulas])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
    setShowTooltip(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  }, [onClick])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }, [onClick])

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative inline-block">
      <button
        ref={badgeRef}
        type="button"
        role="button"
        aria-label={`识别到 ${count} 个配方${count > 0 ? '，点击查看详情' : ''}`}
        tabIndex={0}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex items-center justify-center
          ${sizeConfig.diameter} rounded-full font-bold
          ${sizeConfig.fontSize}
          ${badgeColor}
          ${className}
          transition-all duration-200 ease-out
          ${isHovered ? 'scale-110 shadow-lg' : 'scale-100 shadow-md'}
          ${isBouncing ? 'animate-bounce-custom' : ''}
          ${isPulsing ? 'animate-pulse-glow-custom' : ''}
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
          dark:focus:ring-blue-500 dark:focus:ring-offset-slate-800
          cursor-pointer select-none
          overflow-hidden
        `}
        style={{
          animation: isBouncing ? 'bounce 300ms ease-out' : undefined,
        }}
      >
        <FlaskConical
          className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'} mr-0.5`}
          strokeWidth={2.5}
        />
        <span className="tabular-nums">{count}</span>
      </button>

      {showTooltip && displayFormulas.length > 0 && (
        <div
          className="
            absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2
            w-56 bg-neutral-900 text-white text-xs rounded-lg shadow-xl p-3
            border border-neutral-700 dark:bg-neutral-800 dark:border-neutral-600
            animate-fade-in
          "
          role="tooltip"
          aria-label="最近配方列表"
        >
          <div className="font-semibold mb-2 text-secondary-300 flex items-center gap-1.5">
            <span>📋</span>
            <span>最近配方 ({Math.min(formulas.length, 3)})</span>
          </div>

          <ul className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
            {displayFormulas.map((formula, idx) => (
              <li
                key={formula.id}
                className="flex items-center gap-2 truncate group"
              >
                <span
                  className="
                    w-4 h-4 rounded-full bg-secondary-500 flex-shrink-0
                    flex items-center justify-center text-[10px] font-bold
                    group-hover:bg-secondary-400 transition-colors
                  "
                >
                  {idx + 1}
                </span>
                <span className="truncate flex-1 text-neutral-200 group-hover:text-white transition-colors">
                  {formula.name}
                </span>
                <span className="text-neutral-400 ml-auto flex-shrink-0 tabular-nums">
                  {formula.ingredientCount}种
                </span>
              </li>
            ))}
          </ul>

          {formulas.length > 3 && (
            <div className="mt-2 pt-2 border-t border-neutral-700 dark:border-neutral-600 text-center text-neutral-400 text-[11px]">
              还有 {formulas.length - 3} 个配方...
            </div>
          )}

          <div
            className="
              absolute top-full left-1/2 -translate-x-1/2
              border-8 border-transparent border-t-slate-900
              dark:border-t-slate-800
            "
          />
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            opacity: 0.6;
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .animate-bounce-custom {
          animation: bounce 300ms ease-out;
        }

        .animate-pulse-glow-custom {
          animation: pulse-glow 600ms ease-in-out 2;
        }

        .animate-fade-in {
          animation: fade-in 150ms ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}

FormulaCounterBadgeComponent.displayName = 'FormulaCounterBadge'

export const FormulaCounterBadge = memo(FormulaCounterBadgeComponent)
export default FormulaCounterBadge
export type { FormulaCounterBadgeProps, BadgeSize as FormulaCounterBadgeSize }
