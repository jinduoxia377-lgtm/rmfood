/**
 * FormulaRecommendPanel - 智能推荐面板
 *
 * @description 调用后端 /ai/recommend 端点，基于数据库用户历史 + 功效评分 + 协同配伍网络生成推荐
 * @version 1.0.0
 */
import { useState, useCallback } from 'react'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { aiApi } from '@/api/ai'
import { Card, Button } from '@/components/ui'

interface FormulaRecommendPanelProps {
  targetEffects: string[]
  onClose: () => void
}

interface Recommendation {
  reason_type: string
  formula_name: string
  herbs: Array<{ name: string; dosage_g?: number; role?: string }>
  reason: string
  confidence: number
}

export function FormulaRecommendPanel({ targetEffects, onClose }: FormulaRecommendPanelProps) {
  const { t } = useTranslation()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => aiApi.recommendFormula(targetEffects, 5),
    onSuccess: (data) => {
      setRecs((data.recommendations || []) as unknown as Recommendation[])
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : t('ai.formula.ui.recommendServiceUnavailable'))
    },
  })

  const retry = useCallback(() => {
    setError(null)
    setRecs([])
    mutation.mutate()
  }, [mutation])

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          {t('ai.formula.generateTab.smartFormulaRecommend')}
        </h3>
        <button onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 text-caption text-muted-foreground hover:text-foreground">{t('ai.formula.generateTab.close')}</button>
      </div>

      <p className="text-caption text-muted-foreground">
        {t('ai.formula.generateTab.recommendBasedOn', { effects: targetEffects.join('、') })}
      </p>

      {mutation.isPending && (
        <div className="flex items-center gap-2 text-caption text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('ai.formula.generateTab.searchingRecommendations')}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-caption text-danger">
          {error}
          <button onClick={retry} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 ml-2 underline">{t('ai.formula.generateTab.retry')}</button>
        </div>
      )}

      {!mutation.isPending && !error && recs.length === 0 && (
        <div className="text-center py-4 text-caption text-muted-foreground">
          {t('ai.formula.generateTab.noRecommendData')}
        </div>
      )}

      {recs.length > 0 && (
        <ul className="space-y-2">
          {recs.map((r, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-body-sm font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  {r.formula_name}
                </span>
                <span className="text-caption text-muted-foreground">{t('ai.formula.ui.confidencePercent', { percent: Math.round(r.confidence * 100) })}</span>
              </div>
              <p className="text-caption text-muted-foreground mb-1.5">{r.reason}</p>
              <div className="flex flex-wrap gap-1">
                {(r.herbs || []).map((h, j) => (
                  <span key={j} className="px-1.5 py-0.5 rounded bg-muted text-caption">
                    {h.role ? `[${h.role}] ` : ''}{h.name}{typeof h.dosage_g === 'number' ? ` ${h.dosage_g}g` : ''}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={retry} disabled={mutation.isPending}>{t('ai.formula.generateTab.reRecommend')}</Button>
      </div>
    </Card>
  )
}

export default FormulaRecommendPanel
