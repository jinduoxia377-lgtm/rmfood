import { useState } from 'react'
import { Badge } from '@/components/ui'
import {
  Award,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Target,
  Activity,
  Network,
  Palette,
  Sparkles,
} from 'lucide-react'

interface PatentSynergyScores {
  quality_level?: string
  bliss_independence: number
  pk_interaction: number
  gibbs_stability: number
  network_pharmacology: number
  taste_matrix: number
  overall_si: number
  dominant_mechanism?: string
  confidence: number
  weighted_score: number
}

interface PatentSynergyDetailsProps {
  patentSynergyScores: PatentSynergyScores
}

const getQualityLevelColor = (level: string) => {
  switch (level) {
    case '优秀':
      return { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-primary-400)', border: 'var(--color-primary-400)' }
    case '良好':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-secondary-500)', border: 'var(--color-secondary-500)' }
    case '一般':
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#D97706', border: '#D97706' }
    case '待优化':
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#FF3B30', border: '#FF3B30' }
    default:
      return { bg: 'rgba(156, 163, 175, 0.15)', color: '#9CA3AF', border: '#9CA3AF' }
  }
}

export function PatentSynergyDetails({ patentSynergyScores }: PatentSynergyDetailsProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="mt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-1"
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4" style={{ color: 'var(--color-primary-500)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            专利协同评分详情
          </span>
          {patentSynergyScores.quality_level && (
            <Badge
              variant="neutral"
              className="text-xs"
              style={{ backgroundColor: getQualityLevelColor(patentSynergyScores.quality_level).bg }}
            >
              {patentSynergyScores.quality_level}
            </Badge>
          )}
        </div>
        {showDetails ? (
          <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {showDetails && (
        <div className="pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <FlaskConical className="w-4 h-4" style={{ color: 'var(--color-primary, var(--color-primary-400))' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">药效增强</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.bliss_independence * 100).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <Target className="w-4 h-4" style={{ color: 'var(--color-secondary, #0A84FF)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">药代动力学</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.pk_interaction * 100).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <Activity className="w-4 h-4" style={{ color: 'var(--color-warning, #FF9F0A)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">结构稳定性</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.gibbs_stability * 100).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <Network className="w-4 h-4" style={{ color: 'var(--color-tertiary, var(--color-accent-500))' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">靶点通路</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.network_pharmacology * 100).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <Palette className="w-4 h-4" style={{ color: 'var(--color-danger-500, #D946EF)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">感官品质</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.taste_matrix * 100).toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary, var(--color-primary-400))' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">综合协同指数</p>
                <p className="text-sm font-semibold">{(patentSynergyScores.overall_si * 100).toFixed(1)}</p>
              </div>
            </div>
          </div>

          {patentSynergyScores.dominant_mechanism && (
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
              <span className="text-sm text-muted-foreground">主导机制</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-primary, var(--color-primary-400))' }}>
                {patentSynergyScores.dominant_mechanism}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>置信度: {(patentSynergyScores.confidence * 100).toFixed(0)}%</span>
            <span>加权总分: {patentSynergyScores.weighted_score}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatentSynergyDetails
