import { Brain, Shield, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui'

interface CardHeaderProps {
  isEditing: boolean
  editedName: string
  safetyPassed: boolean
  overallScore: number | null | undefined
  nameInputRef: React.RefObject<HTMLInputElement>
  onNameChange: (value: string) => void
  generatorType?: string
}

const getGeneratorLabel = (gen?: string): string => {
  switch (gen) {
    case 'neural_network': return '神经网络'
    case 'llm': return 'AI 大模型'
    default: return '遗传算法'
  }
}

const getScoreColor = (score: number) => {
  if (score >= 0.8) return 'var(--color-success-600)'
  if (score >= 0.6) return 'var(--color-warning-600)'
  return 'var(--color-danger-600)'
}

export function CardHeader({ isEditing, editedName, safetyPassed, overallScore, nameInputRef, onNameChange, generatorType }: CardHeaderProps) {
  const scoreColor = getScoreColor(overallScore ?? 0)

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/25 transition-transform duration-300 hover:scale-105">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            {isEditing ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full bg-transparent border-b-2 border-primary-300 focus:border-primary-500 focus:outline-none text-lg font-semibold leading-tight transition-colors"
                style={{ color: 'var(--text-primary)' }}
                placeholder="输入配方名称"
              />
            ) : (
              <h3 className="text-lg font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                {editedName}
              </h3>
            )}
            <p className="text-xs text-muted mt-0.5">{getGeneratorLabel(generatorType)}生成</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={safetyPassed ? 'success' : 'danger'}
            className="px-2.5 py-1 text-xs font-medium gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            {safetyPassed ? '安全合规' : '需关注'}
          </Badge>
          <Badge
            variant="primary"
            className="px-2.5 py-1 text-xs font-medium gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI生成
          </Badge>
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <div
          className="text-4xl font-bold leading-none tracking-tight"
          style={{ color: scoreColor }}
        >
          {((overallScore ?? 0) * 100).toFixed(0)}
          <span className="text-sm font-medium opacity-60 ml-0.5">分</span>
        </div>
        <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>综合评分</span>
      </div>
    </div>
  )
}

export default CardHeader
