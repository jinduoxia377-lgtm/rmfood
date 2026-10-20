/**
 * FormulaComparePanel - 配方版本对比增强面板
 *
 * @description 雷达图对比 + 差异分析 + 药材组成对比
 * @version 1.0.0
 */
import { useMemo } from 'react'
import { Badge } from '@/components/ui'

interface AICandidateLike {
  formula_name?: string
  name?: string
  herb_combination?: Array<Record<string, any>>
  overall_score?: number
  synergy_score?: number
  taste_score?: number
  stability_score?: number
  safety_score?: number
  cost_score?: number
  efficacy_score?: number
  safety_passed?: boolean
  effects?: string[]
  /** 兼容不同端点字段：fitness / efficacy / safety / taste / cost */
  fitness?: number
  efficacy?: number
  safety?: number
  taste?: number
  cost?: number
}

interface CompareMetrics {
  efficacy: number
  safety: number
  taste: number
  cost: number
  synergy: number
  stability: number
}

interface FormulaComparePanelProps {
  version1: AICandidateLike
  version2: AICandidateLike
  label1?: string
  label2?: string
}

const getScorePct = (v?: number) => {
  const n = (v ?? 0) * (v !== undefined && v <= 1 ? 100 : 1)
  return Math.max(0, Math.min(100, n))
}

/** 从候选配方中提取六维评分，兼容 genetic / multi-objective / v2 / 主端点等不同字段 */
const extractMetrics = (c: AICandidateLike): CompareMetrics => ({
  efficacy: getScorePct(c.overall_score ?? c.efficacy_score ?? c.fitness ?? c.efficacy),
  safety: getScorePct(
    c.safety_score ?? (c.safety_passed !== undefined ? (c.safety_passed ? 100 : 40) : c.safety),
  ),
  taste: getScorePct(c.taste_score ?? c.taste),
  cost: getScorePct(c.cost_score ?? c.cost),
  synergy: getScorePct(c.synergy_score),
  stability: getScorePct(c.stability_score ?? 0),
})

export function FormulaComparePanel({
  version1,
  version2,
  label1 = '当前版本',
  label2 = '对比版本',
}: FormulaComparePanelProps) {
  const metrics1: CompareMetrics = useMemo(() => extractMetrics(version1), [version1])
  const metrics2: CompareMetrics = useMemo(() => extractMetrics(version2), [version2])

  const diffs: Array<{ key: keyof CompareMetrics; label: string; diff: number }> = useMemo(() => [
    { key: 'efficacy', label: '综合功效', diff: metrics1.efficacy - metrics2.efficacy },
    { key: 'safety', label: '安全性', diff: metrics1.safety - metrics2.safety },
    { key: 'taste', label: '口感', diff: metrics1.taste - metrics2.taste },
    { key: 'cost', label: '成本效率', diff: metrics1.cost - metrics2.cost },
    { key: 'synergy', label: '协同效应', diff: metrics1.synergy - metrics2.synergy },
    { key: 'stability', label: '稳定性', diff: metrics1.stability - metrics2.stability },
  ], [metrics1, metrics2])

  const herbs1 = version1.herb_combination || []
  const herbs2 = version2.herb_combination || []
  const names1 = new Set(herbs1.map(h => String(h.name)))
  const names2 = new Set(herbs2.map(h => String(h.name)))
  const added = herbs2.filter(h => !names1.has(String(h.name)))
  const removed = herbs1.filter(h => !names2.has(String(h.name)))

  return (
    <div className="space-y-4">
      {/* 版本信息 */}
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span>{version1.formula_name || version1.name || label1}</span>
        <Badge variant="neutral">VS</Badge>
        <span>{version2.formula_name || version2.name || label2}</span>
      </div>

      {/* 六维评分条对比 */}
      <div className="space-y-3">
        {/* 图例 */}
        <div className="flex items-center gap-4 text-caption text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded-full bg-primary" /> {label1}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded-full bg-info" /> {label2}
          </span>
        </div>
        {diffs.map(d => {
          const better = d.diff >= 0 ? 1 : 2
          return (
            <div key={d.key} className="space-y-1">
              <div className="flex items-center justify-between text-caption">
                <span>{d.label}</span>
                <span className={d.diff === 0 ? 'text-muted-foreground' : 'text-primary font-semibold'}>
                  {d.diff > 0 ? `+${Math.round(d.diff)}` : Math.round(d.diff)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${metrics1[d.key]}%` }} />
                </div>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${better === 1 ? 'bg-primary' : 'bg-info'}`} style={{ width: `${metrics2[d.key]}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 药材组成对比 */}
      {(added.length > 0 || removed.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-success/20 bg-success/5 p-3">
            <h4 className="text-caption font-semibold text-success mb-1.5">新增药材</h4>
            <ul className="space-y-1">
              {added.map((h, i) => (
                <li key={i} className="text-caption">{h.name} {h.dosage_g ? `${h.dosage_g}g` : ''}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-danger/20 bg-danger/5 p-3">
            <h4 className="text-caption font-semibold text-danger mb-1.5">移除药材</h4>
            <ul className="space-y-1">
              {removed.map((h, i) => (
                <li key={i} className="text-caption">{h.name} {h.dosage_g ? `${h.dosage_g}g` : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {added.length === 0 && removed.length === 0 && (
        <p className="text-caption text-muted-foreground">两个版本的药材组成完全相同，差异体现在剂量或评分上。</p>
      )}
    </div>
  )
}

export default FormulaComparePanel
