/**
 * 营养声称徽章组
 *
 * 基于GB 28050营养声称条件，展示配方的营养声称标签
 */
import { cn } from '@/lib/utils'

interface ClaimBadgeProps {
  claims: string[]
  className?: string
}

const CLAIM_VARIANTS: Record<string, { variant: string; icon: string }> = {
  高蛋白质: { variant: 'success', icon: '💪' },
  低脂肪: { variant: 'info', icon: '🟢' },
  '高膳食纤维': { variant: 'success', icon: '🌾' },
  低钠: { variant: 'info', icon: '🧂' },
  无糖: { variant: 'neutral', icon: '🍬' },
  '低饱和脂肪': { variant: 'info', icon: '🟡' },
  高钙: { variant: 'warning', icon: '🦴' },
  高铁: { variant: 'danger', icon: '🔴' },
}

export function NutritionClaimBadges({ claims, className }: ClaimBadgeProps) {
  if (!claims || claims.length === 0) {
    return (
      <div className={cn('nutrition-claims-empty', className)}>
        <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无营养声称</span>
      </div>
    )
  }

  return (
    <div className={cn('nutrition-claims', className)}>
      <div className="nutrition-claims-label">营养声称</div>
      <div className="nutrition-claims-list">
        {claims.map((claim) => {
          const base = claim.split(' ')[0]
          const config = CLAIM_VARIANTS[base] || { variant: 'neutral', icon: '✓' }
          return (
            <span
              key={claim}
              className={cn(
                'claim-chip',
                `claim-${config.variant}`,
              )}
            >
              <span className="claim-icon">{config.icon}</span>
              {claim}
            </span>
          )
        })}
      </div>
    </div>
  )
}
