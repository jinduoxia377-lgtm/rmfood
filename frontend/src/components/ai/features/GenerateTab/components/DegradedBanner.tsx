import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

interface DegradedBannerProps {
  /** 是否降级（后端响应级 degraded=true，表示由规则引擎兜底、未经 GA 优化） */
  degraded: boolean
  /** 降级原因（后端 fallback_reason 原文），缺省时用通用文案 */
  fallbackReason?: string | null
  className?: string
}

/**
 * 配方生成降级横幅（ADR-046 L5 可信呈现·原则2「降级必须可见」）。
 *
 * 当后端 /ai/generate 返回 degraded=true 时，说明本次结果由规则引擎兜底、
 * 未经遗传算法（GA）优化。必须在结果区顶部明示，禁止把兜底结果伪装成 GA 优化结果。
 * 参考 ChatTab.tsx 会话级降级横幅的视觉模式（warning 色带 + 可关闭）。
 */
export function DegradedBanner({ degraded, fallbackReason, className = '' }: DegradedBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!degraded || dismissed) return null

  return (
    <div
      role="note"
      className={`flex items-start gap-2 px-4 py-2.5 mb-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning-600 dark:text-warning-500" />
      <div className="flex-1 min-w-0 text-xs leading-relaxed text-warning-800 dark:text-warning-200">
        <span className="font-semibold">本次由规则引擎兜底，未经 GA 优化：</span>
        <span>
          {fallbackReason
            ? `${fallbackReason}。以下配方为规则引擎兜底方案，未经遗传算法优化，仅供参考。`
            : '优化引擎暂不可用，以下配方为规则引擎兜底方案，未经遗传算法优化，仅供参考。'}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-warning-600 dark:text-warning-500 hover:bg-warning-100 dark:hover:bg-warning-500/20 transition-colors"
        aria-label="关闭降级提示"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default DegradedBanner
