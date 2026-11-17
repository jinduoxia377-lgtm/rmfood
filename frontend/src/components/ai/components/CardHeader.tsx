import { Brain, Shield, ShieldAlert, ShieldQuestion, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { SafetyVerdict, SafetyVerdictStatus } from '@/types/ai.api'

interface CardHeaderProps {
  isEditing: boolean
  editedName: string
  /**
   * 安全合规三态裁定（ADR-046 L5）。由 api/ai.ts deriveSafetyVerdict 唯一推导，
   * undefined 等同于 unverified（灰态）。禁止由 safety_score 反推绿色「安全合规」。
   */
  safetyVerdict?: SafetyVerdict
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

/** 安全合规三态色板：绿（passed）/ 黄（needs_attention）/ 灰虚线（unverified）。 */
function getSafetyBadge(verdict?: SafetyVerdict): {
  variant: 'success' | 'warning' | 'outline'
  label: string
  Icon: typeof Shield
  dashed: boolean
  title: string
} {
  const status: SafetyVerdictStatus = verdict?.status ?? 'unverified'
  switch (status) {
    case 'passed':
      return {
        variant: 'success',
        label: '安全合规',
        Icon: Shield,
        dashed: false,
        title: verdict?.source === 'backend_verdict'
          ? '后端安全合规闸门校验通过'
          : '后端显式标记为安全',
      }
    case 'needs_attention':
      return {
        variant: 'warning',
        label: '需关注',
        Icon: ShieldAlert,
        dashed: false,
        title: verdict?.reason || '存在需关注的配伍/用量问题，请查看详情',
      }
    case 'unverified':
    default:
      return {
        variant: 'outline',
        label: '未校验',
        Icon: ShieldQuestion,
        dashed: true,
        // 灰态：无裁定=未校验，明确不传递「安全」信任
        title: '本次未执行安全合规校验（无裁定），不构成安全结论',
      }
  }
}

export function CardHeader({ isEditing, editedName, safetyVerdict, overallScore, nameInputRef, onNameChange, generatorType }: CardHeaderProps) {
  const scoreColor = getScoreColor(overallScore ?? 0)
  const badge = getSafetyBadge(safetyVerdict)
  // 原则4「缺失即缺失」：overall_score 缺失显「暂无数据」，不补 0（补 0 会伪装成 0 分）
  const hasScore = typeof overallScore === 'number' && Number.isFinite(overallScore)

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
            variant={badge.variant}
            title={badge.title}
            className={`px-2.5 py-1 text-xs font-medium gap-1.5 ${badge.dashed ? 'border-dashed text-muted-foreground bg-transparent' : ''}`}
          >
            <badge.Icon className="w-3.5 h-3.5" />
            {badge.label}
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
        {hasScore ? (
          <div
            className="text-4xl font-bold leading-none tracking-tight"
            style={{ color: scoreColor }}
          >
            {((overallScore as number) * 100).toFixed(0)}
            <span className="text-sm font-medium opacity-60 ml-0.5">分</span>
          </div>
        ) : (
          <div
            className="text-2xl font-semibold leading-none tracking-tight text-muted-foreground"
            title="后端未返回综合评分"
          >
            暂无数据
          </div>
        )}
        <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>综合评分</span>
      </div>
    </div>
  )
}

export default CardHeader
