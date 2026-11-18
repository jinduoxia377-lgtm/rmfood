/**
 * FormulaExplanationPanel - 配方智能方解面板
 *
 * @description 调用后端 /ai/interpret 端点，基于网络药理学与中医理论生成方解
 * @version 1.0.0
 */
import { useState, useEffect } from 'react'
import { Loader2, FlaskConical, Shield, Lightbulb, Clock, RefreshCw, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { aiApi } from '@/api/ai'
import type { AICandidate } from '@/api/ai'
import { Card } from '@/components/ui'
import MarkdownRenderer from '@/components/ai/features/components/pro/MarkdownRenderer'
import { MechanismNetworkPanel } from './MechanismNetworkPanel'

interface FormulaExplanationPanelProps {
  candidate: AICandidate
  targetEffects: string[]
  onClose: () => void
}

type Interpretation = {
  constitution?: string
  /** 方解与机理主文本（后端 L4 mechanism.explanation，Markdown 散文） */
  explanation?: string
  mechanism?: Array<{ herb: string; effects: string[]; compounds: Array<{ name: string; mol_weight?: string | number }>; targets: string[]; diseases: string[]; note: string }>
  synergy?: string
  safety?: { food_homology_ratio: string; risk_level: string; notes: string[] }
  usage?: { form: string; dosage_summary: string; frequency: string; course: string; adjustment_hint: string }
  monitoring?: Array<{ effect: string; metric: string; frequency: string }>
  disclaimer?: string
}

/** 归一化 mech.safety（后端字段 food_homology_ratio / risk_level / notes） */
function adaptSafety(raw: unknown): Interpretation['safety'] {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === 'string') : []
  const ratio = typeof r.food_homology_ratio === 'string' ? r.food_homology_ratio : ''
  const level = typeof r.risk_level === 'string' ? r.risk_level : ''
  if (!ratio && !level && notes.length === 0) return undefined
  return { food_homology_ratio: ratio, risk_level: level, notes }
}

/** 归一化 mech.usage（后端字段 form / dosage_summary / frequency / course / adjustment_hint） */
function adaptUsage(raw: unknown): Interpretation['usage'] {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  const form = str('form')
  const dosageSummary = str('dosage_summary')
  const frequency = str('frequency')
  const course = str('course')
  const adjustmentHint = str('adjustment_hint')
  if (!form && !dosageSummary && !frequency && !course && !adjustmentHint) return undefined
  return { form, dosage_summary: dosageSummary, frequency, course, adjustment_hint: adjustmentHint }
}

/** 归一化 mech.monitoring（后端 Array<{effect,metric,frequency}>） */
function adaptMonitoring(raw: unknown): Interpretation['monitoring'] {
  if (!Array.isArray(raw)) return undefined
  const items = raw
    .map((m) => {
      if (!m || typeof m !== 'object') return null
      const r = m as Record<string, unknown>
      const effect = typeof r.effect === 'string' ? r.effect : ''
      const metric = typeof r.metric === 'string' ? r.metric : ''
      const frequency = typeof r.frequency === 'string' ? r.frequency : ''
      if (!effect && !metric) return null
      return { effect, metric, frequency }
    })
    .filter((x): x is { effect: string; metric: string; frequency: string } => x !== null)
  return items.length > 0 ? items : undefined
}

export function FormulaExplanationPanel({ candidate, targetEffects, onClose }: FormulaExplanationPanelProps) {
  const { t } = useTranslation()
  const [interp, setInterp] = useState<Interpretation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 重试计数：递增触发下方 useEffect 重新加载方解（错误态"重试"按钮）
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // ★ 优先复用后端生成时已产出的 candidate.mechanism（L4 机理阐释，阶段2续接入），
        //   零额外请求。字段适配：后端 mechanisms[]/compounds:string[] → 面板 mechanism[]/compounds:{name}[]。
        //   仅当候选无 mechanism 时才回退调用 /ai/interpret。
        const mech = candidate.mechanism
        if (mech && (mech.explanation || mech.mechanisms?.length || mech.synergy)) {
          const adapted: Interpretation = {
            constitution: mech.constitution,
            // 方解与机理散文（含具体药材+活性成分+靶点通路），Markdown 渲染
            explanation: mech.explanation,
            mechanism: (mech.mechanisms || []).map((m) => ({
              herb: m.herb || '',
              effects: m.effects ? [m.effects] : [],
              compounds: (m.compounds || []).map((name) => ({ name })),
              targets: m.targets || [],
              diseases: m.diseases || [],
              note: m.note || '',
            })),
            synergy: mech.synergy,
            // 用法/安全/监测：后端 mech.usage / mech.safety / mech.monitoring 存在即展示
            safety: adaptSafety(mech.safety),
            usage: adaptUsage(mech.usage),
            monitoring: adaptMonitoring(mech.monitoring),
            disclaimer: mech.disclaimer,
          }
          if (!cancelled) {
            setInterp(adapted)
            setLoading(false)
          }
          return
        }

        // 回退：候选无现成机理，调用 /ai/interpret 按需生成
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
        if (!cancelled) setError(e instanceof Error ? e.message : t('ai.formula.ui.interpretServiceUnavailable'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [candidate, targetEffects, t, reloadKey])

  // 空态判定：回退接口 res.interpretation 可能为 {} (truthy) 但所有字段皆无 → 避免静默空容器
  const isInterpEmpty = !!interp && (
    !interp.constitution &&
    !interp.synergy &&
    !interp.explanation &&
    !interp.safety &&
    !interp.usage &&
    !interp.disclaimer &&
    !(interp.mechanism && interp.mechanism.length > 0) &&
    !(interp.monitoring && interp.monitoring.length > 0) &&
    !(candidate.mechanism?.mechanisms && candidate.mechanism.mechanisms.length > 0)
  )

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-semibold flex items-center gap-1.5">
          <FlaskConical className="w-4 h-4 text-primary" />
          {t('ai.formula.generateTab.formulaExplanationTitle')}
        </h3>
        <button onClick={onClose} className="inline-flex items-center min-h-[44px] px-3 text-caption text-muted-foreground hover:text-foreground">{t('ai.formula.generateTab.close')}</button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-caption text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('ai.formula.generateTab.generatingExplanation')}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-caption text-danger flex items-center justify-between gap-3">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center min-h-[44px] gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-caption font-medium text-danger hover:bg-danger/10 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('ai.formula.generateTab.retryExplanation')}
          </button>
        </div>
      )}

      {!loading && !error && interp && (
        <div className="space-y-3 text-body-sm">
          {interp.constitution && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" />{t('ai.formula.generateTab.monarchMinisterStructure')}</h4>
              <p className="text-muted-foreground">{interp.constitution}</p>
            </div>
          )}

          {/* 方解与机理散文（后端 L4 mechanism.explanation）—— Markdown 渲染正文 */}
          {interp.explanation && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" />{t('ai.formula.generateTab.formulaExplanationProse')}</h4>
              <div className="text-muted-foreground">
                <MarkdownRenderer content={interp.explanation} />
              </div>
            </div>
          )}

          {candidate.mechanism?.mechanisms ? (
            // 后端 L4 机理（阶段2续）→ 网络药理可视化（突出共享靶点=配伍协同）
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1">{t('ai.formula.generateTab.modernMechanism')}</h4>
              <MechanismNetworkPanel mechanisms={candidate.mechanism.mechanisms} />
            </div>
          ) : interp.mechanism && interp.mechanism.length > 0 ? (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1">{t('ai.formula.generateTab.modernMechanism')}</h4>
              <ul className="space-y-1.5">
                {interp.mechanism.map((m, i) => (
                  <li key={i} className="rounded-lg bg-muted/50 p-2.5">
                    <span className="font-semibold">{m.herb}</span>
                    {m.compounds?.length > 0 && (
                      <p className="text-caption text-muted-foreground">{t('ai.formula.ui.activeCompounds', { compounds: m.compounds.map(c => c.name).filter(Boolean).join('、') })}</p>
                    )}
                    {m.targets?.length > 0 && (
                      <p className="text-caption text-muted-foreground">{t('ai.formula.ui.actionTargetsValue', { targets: m.targets.join('、') })}</p>
                    )}
                    <p className="text-caption text-muted-foreground mt-1">{m.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {interp.synergy && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1">{t('ai.formula.generateTab.synergyEffectTitle')}</h4>
              <p className="text-muted-foreground">{interp.synergy}</p>
            </div>
          )}

          {interp.safety && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1"><Shield className="w-3 h-3" />{t('ai.formula.generateTab.safetyAssessment')}</h4>
              <p className="text-caption text-muted-foreground">{t('ai.formula.ui.safetySummary', { ratio: interp.safety.food_homology_ratio, level: interp.safety.risk_level })}</p>
              <ul className="text-caption text-muted-foreground mt-1 list-disc pl-4">
                {(interp.safety.notes || []).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          {interp.usage && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />{t('ai.formula.generateTab.usageDosage')}</h4>
              <p className="text-muted-foreground">{interp.usage.form} · {interp.usage.dosage_summary} · {interp.usage.frequency}</p>
              <p className="text-caption text-muted-foreground">{interp.usage.course}。{interp.usage.adjustment_hint}</p>
            </div>
          )}

          {interp.monitoring && interp.monitoring.length > 0 && (
            <div>
              <h4 className="text-h6 font-semibold text-[var(--text-primary)] mb-1">{t('ai.formula.generateTab.monitoringIndicators')}</h4>
              <ul className="text-caption text-muted-foreground space-y-1">
                {interp.monitoring.map((m, i) => (
                  <li key={i}>「{m.effect}」：{m.metric}（{m.frequency}）</li>
                ))}
              </ul>
            </div>
          )}

          {interp.disclaimer && (
            <p className="text-caption text-muted-foreground border-t border-border pt-2">{interp.disclaimer}</p>
          )}
        </div>
      )}

      {!loading && !error && isInterpEmpty && (
        <p className="text-caption text-muted-foreground py-4">暂无方解数据</p>
      )}
    </Card>
  )
}

export default FormulaExplanationPanel
