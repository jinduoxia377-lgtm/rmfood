import { useState, useMemo } from 'react'
import { Tooltip } from '@/components/ui'

interface RiskFactor {
  name: string
  value: number
  description: string
}

interface RiskIndicatorProps {
  score: number
  size?: 'small' | 'medium' | 'large'
  riskFactors?: RiskFactor[]
  thresholds?: {
    low: number
    medium: number
  }
  showTooltip?: boolean
  className?: string
}

const SIZE_MAP = {
  small: { width: 24, height: 24, fontSize: 10 },
  medium: { width: 36, height: 36, fontSize: 12 },
  large: { width: 48, height: 48, fontSize: 14 },
}

export function RiskIndicator({
  score,
  size = 'medium',
  riskFactors = [],
  thresholds = { low: 80, medium: 50 },
  showTooltip = true,
  className = '',
}: RiskIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false)

  const riskLevel = useMemo(() => {
    if (score >= thresholds.low) return { level: 'low', color: '#10B981', label: '低风险', bgClass: 'bg-green-500' }
    if (score >= thresholds.medium) return { level: 'medium', color: '#F59E0B', label: '中风险', bgClass: 'bg-yellow-500' }
    return { level: 'high', color: '#EF4444', label: '高风险', bgClass: 'bg-red-500' }
  }, [score, thresholds])

  const dimensions = SIZE_MAP[size]

  const tooltipContent = useMemo(() => (
    <div className="space-y-2 min-w-[200px]">
      <div className="font-semibold text-gray-900 dark:text-gray-100">
        风险等级: {riskLevel.label}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        风险评分: {score}/100
      </div>
      {riskFactors.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">风险因子:</div>
          {riskFactors.map((factor, index) => (
            <div key={index} className="flex justify-between items-center text-sm py-0.5">
              <span>{factor.name}</span>
              <span className={`font-medium ${
                factor.value >= 80 ? 'text-green-600' :
                factor.value >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {factor.value}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  ), [riskLevel, score, riskFactors])

  const indicator = (
    <div
      className={`relative inline-flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 ${className}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: isHovered ? `${riskLevel.color}CC` : `${riskLevel.color}99`,
        boxShadow: isHovered ? `0 0 20px ${riskLevel.color}66` : `0 0 10px ${riskLevel.color}33`,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className="font-bold text-white"
        style={{ fontSize: dimensions.fontSize }}
      >
        {score}
      </span>
    </div>
  )

  if (!showTooltip || riskFactors.length === 0) {
    return indicator
  }

  return (
    <Tooltip content={tooltipContent} placement="top">
      {indicator}
    </Tooltip>
  )
}

export type { RiskIndicatorProps, RiskFactor }
