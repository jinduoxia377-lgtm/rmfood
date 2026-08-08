import { Activity } from 'lucide-react'

interface Herb {
  name?: string
  role?: string
}

interface FormulaCompositionProps {
  herbCombination: Herb[]
}

const getRoleColor = (role: string) => {
  if (/君/i.test(role)) return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-danger-600)', border: 'rgba(239, 68, 68, 0.15)' }
  if (/臣/i.test(role)) return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--color-warning-600)', border: 'rgba(245, 158, 11, 0.15)' }
  if (/佐/i.test(role)) return { bg: 'rgba(37, 99, 235, 0.12)', color: 'var(--color-blue-600)', border: 'rgba(37, 99, 235, 0.15)' }
  if (/使/i.test(role)) return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-success-600)', border: 'rgba(16, 185, 129, 0.15)' }
  return { bg: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-muted)', border: 'transparent' }
}

export function FormulaComposition({ herbCombination }: FormulaCompositionProps) {
  return (
    <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4" style={{ color: 'var(--color-primary-500)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          配方组成
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ({herbCombination.length}味药材)
        </span>
      </div>
      <div className="space-y-2">
        {herbCombination.map((herb, i) => {
          const roleColor = getRoleColor(typeof herb.role === 'string' ? herb.role : '其他')
          return (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-neutral-800/50 group"
              style={{ backgroundColor: roleColor.bg }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {typeof herb.name === 'string' ? herb.name : '未知药材'}
                </span>
              </div>
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-transform duration-200 group-hover:scale-105"
                style={{ backgroundColor: roleColor.bg, color: roleColor.color, border: `1px solid ${roleColor.border}` }}
              >
                {typeof herb.role === 'string' ? herb.role : '其他'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FormulaComposition
