import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { aiApi } from '@/api/ai'
import type { SynergyResult } from '@/types'
import { Input, Button, Card } from '@/components/ui'
import { logger } from '@/utils/safeLogger'
import {
  GitMerge,
} from 'lucide-react'

export function SynergyTab() {
  // ===== i18n =====
  const { t } = useTranslation()
  const [synergyInput, setSynergyInput] = useState('')
  const [synergyResult, setSynergyResult] = useState<SynergyResult | null>(null)

  const mutation = useMutation({
    mutationFn: (names: string[]) => aiApi.synergyAnalysis(names),
    onSuccess: (data) => setSynergyResult(data),
    onError: (error: any) => {
      logger.error('协同分析失败:', error)
    },
  })

  const handleAnalysis = () => {
    const names = synergyInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    if (names.length === 0) return
    mutation.mutate(names)
  }

  // 协同分析矩阵数据
  const matrixData = useMemo(() => {
    if (!synergyResult) return null
    const herbSet = new Set<string>()
    synergyResult.synergy_pairs.forEach((p) => { herbSet.add(p.a); herbSet.add(p.b) })
    synergyResult.antagonism_warnings.forEach((w) => { herbSet.add(w.a); herbSet.add(w.b) })
    const herbs = Array.from(herbSet)
    if (herbs.length === 0) return null

    const matrix: Record<string, Record<string, { value: number; type: 'synergy' | 'antagonism' | 'none' }>> = {}
    herbs.forEach((h) => { matrix[h] = {} })
    herbs.forEach((h1) => {
      herbs.forEach((h2) => {
        if (h1 === h2) { matrix[h1][h2] = { value: 0, type: 'none' }; return }
        const synPair = synergyResult.synergy_pairs.find((p) =>
          (p.a === h1 && p.b === h2) || (p.a === h2 && p.b === h1),
        )
        const antPair = synergyResult.antagonism_warnings.find((w) =>
          (w.a === h1 && w.b === h2) || (w.a === h2 && w.b === h1),
        )
        if (synPair) matrix[h1][h2] = { value: synPair.score, type: 'synergy' }
        else if (antPair) matrix[h1][h2] = { value: -1, type: 'antagonism' }
        else matrix[h1][h2] = { value: 0, type: 'none' }
      })
    })
    return { herbs, matrix }
  }, [synergyResult])

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-primary-500" />
          {t('ai.synergy.synergyTab.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('ai.synergy.synergyTab.inputDescription')}</p>
      </div>
      <div className="flex gap-3">
        <Input
          value={synergyInput}
          onChange={(e) => setSynergyInput(e.target.value)}
          placeholder={t('ai.synergy.synergyTab.inputPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalysis()}
          className="flex-1"
        />
        <Button
          disabled={!synergyInput.trim() || mutation.isPending}
          onClick={handleAnalysis}
          loading={mutation.isPending}
          icon={<GitMerge className="w-4 h-4" />}
        >
          {t('ai.synergy.synergyTab.analyze')}
        </Button>
      </div>
      {mutation.isError && (
        <div className="bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl p-5 text-sm text-danger-600 dark:text-danger-400">
          {t('ai.synergy.synergyTab.analyzeFailed')}{(mutation.error)?.message || t('ai.synergy.synergyTab.retryTip')}
        </div>
      )}
      {synergyResult && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-5 bg-primary-50/50 dark:bg-primary-900/10">
              <h4 className="font-semibold text-primary-600">{t('ai.synergy.synergyTab.synergyScore')}{synergyResult.score}</h4>
              <p className="text-sm text-gray-500 mt-2">{synergyResult.summary}</p>
              {synergyResult.synergy_pairs.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {synergyResult.synergy_pairs.map((p, i) => (
                    <li key={i} className="text-sm text-success-600">+ {p.a} + {p.b} ({t('ai.synergy.confidence')}: {p.score})</li>
                  ))}
                </ul>
              )}
            </div>
            {synergyResult.antagonism_warnings.length > 0 && (
              <div className="border border-danger-200 rounded-xl p-5 bg-danger-50/50 dark:bg-danger-500/10">
                <h4 className="font-semibold text-danger-600">{t('ai.synergy.synergyTab.antagonismWarning')}</h4>
                <ul className="mt-3 space-y-2">
                  {synergyResult.antagonism_warnings.map((w, i) => (
                    <li key={i} className="text-sm text-danger-600">! {w.a} + {w.b}: {w.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {matrixData && matrixData.herbs.length >= 2 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('ai.synergy.synergyTab.relationshipMatrix')}</h4>
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="p-3 text-gray-500 font-normal" />
                      {matrixData.herbs.map((h) => (
                        <th key={h} className="p-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.herbs.map((h1) => (
                      <tr key={h1}>
                        <td className="p-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{h1}</td>
                        {matrixData.herbs.map((h2) => {
                          const cell = matrixData.matrix[h1][h2]
                          let bgClass = 'bg-gray-100 dark:bg-gray-800'
                          let textClass = 'text-gray-400'
                          let symbol = '-'
                          if (h1 === h2) { bgClass = 'bg-gray-200 dark:bg-gray-700'; symbol = '·' }
                          else if (cell.type === 'synergy') {
                            bgClass = 'bg-primary-100 dark:bg-primary-900/30'
                            textClass = 'text-primary-700 dark:text-primary-400'
                            symbol = '+'
                          } else if (cell.type === 'antagonism') {
                            bgClass = 'bg-danger-100 dark:bg-danger-500/20'
                            textClass = 'text-danger-700 dark:text-danger-400'
                            symbol = '!'
                          }
                          return (
                            <td key={h2} className={`p-3 text-center rounded ${bgClass} ${textClass} min-w-[56px]`}>
                              {symbol}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span><span className="inline-block w-3 h-3 rounded bg-primary-100 dark:bg-primary-900/30 mr-1 align-middle" /> {t('ai.synergy.synergyTab.synergy')}</span>
                <span><span className="inline-block w-3 h-3 rounded bg-danger-100 dark:bg-danger-500/20 mr-1 align-middle" /> {t('ai.synergy.synergyTab.antagonism')}</span>
                <span><span className="inline-block w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 mr-1 align-middle" /> {t('ai.synergy.synergyTab.noData')}</span>
              </div>
            </div>
          )}

          {synergyResult.shared_pathways.length > 0 && (
            <div className="text-sm text-gray-500">
              <span className="font-medium">{t('ai.synergy.synergyTab.sharedPathways')} </span>
              {synergyResult.shared_pathways.join('、')}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
