/**
 * FormulaExplanationPanel - 配方智能方解面板
 *
 * @description 调用后端 /ai/interpret 端点，基于网络药理学与中医理论生成方解
 * @version 1.0.0
 */
import { useState, useEffect } from 'react'
import { Loader2, FlaskConical, Shield, Lightbulb, Clock } from 'lucide-react'
import { aiApi } from '@/api/ai'
import type { AICandidate } from '@/api/ai'
import { Card } from '@/components/ui'

interface FormulaExplanationPanelProps {
  candidate: AICandidate
  targetEffects: string[]
  onClose: () => void
}

type Interpretation = {
  constitution?: string
  mechanism?: Array<{ herb: string; effects: string[]; compounds: Array<{ name: string; mol_weight?: string | number }>; targets: string[]; diseases: string[]; note: string }>
  synergy?: string
  safety?: { food_homology_ratio: string; risk_level: string; notes: string[] }
  usage?: { form: string; dosage_summary: string; frequency: string; course: string; adjustment_hint: string }
  monitoring?: Array<{ effect: string; metric: string; frequency: string }>
  disclaimer?: string
}

export function FormulaExplanationPanel({ candidate, targetEffects, onClose }: FormulaExplanationPanelProps) {
  const [interp, setInterp] = useState<Interpretation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const herbs = (candidate.herb_combination || []).map((h: any) => ({
          name: h.name || '',
          dosage_g: Number(h.dosage_g ?? h.dosage ?? h.dose_g ?? 0),
          role: h.role || '',
        }))
        const res = await aiApi.interpretFormula({
          formula_name: candidate.formula_name || candidate.name || '',
          herbs,
          target_effects: targetEffects,
        })
        if (!cancelled) setInterp((res.interpretation || {}) as Interpretation)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '解释服务暂不可用')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [candidate, targetEffects])

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-title-sm font-semibold flex items-center gap-1.5">
          <FlaskConical className="w-4 h-4 text-primary" />
          配方方解与机理
        </h3>
        <button onClick={onClose} className="text-caption text-muted-foreground hover:text-foreground">关闭</button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-caption text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> 正在生成方解…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-caption text-danger">{error}</div>
      )}

      {!loading && !error && interp && (
        <div className="space-y-3 text-body-sm">
          {interp.constitution && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" />君臣佐使结构</h4>
              <p className="text-muted-foreground">{interp.constitution}</p>
            </div>
          )}

          {interp.mechanism && interp.mechanism.length > 0 && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1">现代药理机制</h4>
              <ul className="space-y-1.5">
                {interp.mechanism.map((m, i) => (
                  <li key={i} className="rounded-lg bg-muted/50 p-2.5">
                    <span className="font-semibold">{m.herb}</span>
                    {m.compounds?.length > 0 && (
                      <p className="text-caption text-muted-foreground">活性成分：{m.compounds.map(c => c.name).filter(Boolean).join('、')}</p>
                    )}
                    {m.targets?.length > 0 && (
                      <p className="text-caption text-muted-foreground">作用靶点：{m.targets.join('、')}</p>
                    )}
                    <p className="text-caption text-muted-foreground mt-1">{m.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {interp.synergy && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1">配伍协同效应</h4>
              <p className="text-muted-foreground">{interp.synergy}</p>
            </div>
          )}

          {interp.safety && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1 flex items-center gap-1"><Shield className="w-3 h-3" />安全性评估</h4>
              <p className="text-caption text-muted-foreground">药食同源占比 {interp.safety.food_homology_ratio} · 风险等级 {interp.safety.risk_level}</p>
              <ul className="text-caption text-muted-foreground mt-1 list-disc pl-4">
                {(interp.safety.notes || []).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          {interp.usage && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />用法用量</h4>
              <p className="text-muted-foreground">{interp.usage.form} · {interp.usage.dosage_summary} · {interp.usage.frequency}</p>
              <p className="text-caption text-muted-foreground">{interp.usage.course}。{interp.usage.adjustment_hint}</p>
            </div>
          )}

          {interp.monitoring && interp.monitoring.length > 0 && (
            <div>
              <h4 className="text-caption font-semibold text-primary mb-1">效果监测指标</h4>
              <ul className="text-caption text-muted-foreground space-y-1">
                {interp.monitoring.map((m, i) => (
                  <li key={i}>「{m.effect}」：{m.metric}（{m.frequency}）</li>
                ))}
              </ul>
            </div>
          )}

          {interp.disclaimer && (
            <p className="text-caption text-muted-foreground/70 border-t border-border pt-2">{interp.disclaimer}</p>
          )}
        </div>
      )}
    </Card>
  )
}

export default FormulaExplanationPanel
