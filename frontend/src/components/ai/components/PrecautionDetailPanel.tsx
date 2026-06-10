import { memo, useEffect, useState } from 'react'
import type { Precaution, PrecautionSeverity } from '@/types/ai.types'
import { X, AlertOctagon, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import {
  getPrecautionIcon,
  getPrecautionColor,
} from '@/services/precautionEngine'

interface PrecautionDetailPanelProps {
  precautions: Precaution[]
  visible: boolean
  onClose: () => void
}

const SEVERITY_GROUPS: { severity: PrecautionSeverity; label: string; icon: React.ComponentType<any> }[] = [
  { severity: 'critical', label: '危险', icon: AlertOctagon },
  { severity: 'high', label: '警告', icon: AlertTriangle },
  { severity: 'medium', label: '提示', icon: AlertCircle },
  { severity: 'low', label: '建议', icon: Info },
]

const PrecautionDetailPanel = memo(({ precautions, visible, onClose }: PrecautionDetailPanelProps) => {
  const [isVisible, setIsVisible] = useState(visible)
  const [shouldRender, setShouldRender] = useState(visible)

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (visible) {
      setShouldRender(true)
      // Small delay to trigger animation
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      // Wait for animation to complete before unmounting
      timer = setTimeout(() => setShouldRender(false), 200)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [visible])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [visible, onClose])

  if (!shouldRender || !precautions || precautions.length === 0) {
    return null
  }

  const groupedPrecautions = SEVERITY_GROUPS.map((group) => ({
    ...group,
    items: precautions.filter((p) => p.severity === group.severity),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`
          fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-900 shadow-2xl z-50
          transform transition-transform duration-300 ease-out overflow-y-auto
          ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-label="注意事项详情"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              注意事项详情
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              共 {precautions.length} 条提醒
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="关闭面板"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6 pb-8">
          {groupedPrecautions.map((group) => (
            <div key={group.severity}>
              {/* Group Header */}
              <div className="flex items-center gap-2 mb-3">
                <group.icon
                  className="w-5 h-5"
                  style={{ color: getPrecautionColor(group.severity) }}
                />
                <h3
                  className="font-semibold text-base"
                  style={{ color: getPrecautionColor(group.severity) }}
                >
                  {group.label}
                </h3>
                <span
                  className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${getPrecautionColor(group.severity)}15`,
                    color: getPrecautionColor(group.severity),
                  }}
                >
                  {group.items.length}条
                </span>
              </div>

              {/* Precaution Cards */}
              <div className="space-y-3">
                {group.items.map((precaution, index) => (
                  <PrecautionCard
                    key={`${precaution.severity}-${index}`}
                    precaution={precaution}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
})

const PrecautionCard = memo(({ precaution }: { precaution: Precaution }) => {
  const color = getPrecautionColor(precaution.severity)

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Left colored bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />

      <div className="pl-4 pr-4 py-3">
        {/* Title */}
        <div className="flex items-start gap-2 mb-2">
          <span className="text-base">{getPrecautionIcon(precaution.severity)}</span>
          <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex-1 leading-tight">
            {precaution.content}
          </h4>
        </div>

        {/* Recommendation */}
        {precaution.recommendation && (
          <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border-l-2" style={{ borderColor: color }}>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <span className="font-medium">建议：</span>
              {precaution.recommendation}
            </p>
          </div>
        )}

        {/* Reference */}
        {precaution.reference && (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>{precaution.reference}</span>
          </div>
        )}

        {/* Trigger Conditions (if available) */}
        {precaution.triggerConditions && precaution.triggerConditions.length > 0 && (
          <div className="mt-2 space-y-1">
            {precaution.triggerConditions.map((condition, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${condition.isHardLimit ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <span>{condition.description}</span>
                {condition.isHardLimit && (
                  <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-[10px] font-medium">
                    硬性限制
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

PrecautionCard.displayName = 'PrecautionCard'

export default PrecautionDetailPanel
