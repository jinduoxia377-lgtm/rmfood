import { Users, Zap, BarChart3, Activity } from 'lucide-react'

interface ScoreCardsProps {
  synergyScore: number | null | undefined
  tasteScore: number | null | undefined
  stabilityScore: number | null | undefined
  overallScore: number | null | undefined
}

const getScoreColor = (score: number) => {
  if (score >= 0.8) return 'var(--color-success-600)'
  if (score >= 0.6) return 'var(--color-warning-600)'
  return 'var(--color-danger-600)'
}

export function ScoreCards({ synergyScore, tasteScore, stabilityScore, overallScore }: ScoreCardsProps) {
  const scores = [
    { label: '协同', value: synergyScore, icon: Users, color: 'var(--color-primary-500)', bgColor: 'rgba(16, 185, 129, 0.08)' },
    { label: '口感', value: tasteScore, icon: Zap, color: 'var(--color-accent-500)', bgColor: 'rgba(139, 92, 246, 0.08)' },
    { label: '稳定性', value: stabilityScore, icon: BarChart3, color: 'var(--color-warning-500)', bgColor: 'rgba(245, 158, 11, 0.08)' },
    { label: '综合', value: overallScore, icon: Activity, color: 'var(--color-success-500)', bgColor: 'rgba(34, 197, 94, 0.08)' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {scores.map((score, i) => {
        const Icon = score.icon
        const displayValue = (score.value ?? 0) * 100
        const scoreColorValue = getScoreColor(score.value ?? 0)

        return (
          <div
            key={i}
            className="relative text-center p-3 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-md"
            style={{ backgroundColor: score.bgColor }}
          >
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${score.color}15` }}>
              <Icon className="w-4 h-4" style={{ color: score.color }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              {score.label}
            </p>
            <p className="text-lg font-bold" style={{ color: scoreColorValue }}>
              {displayValue.toFixed(0)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
