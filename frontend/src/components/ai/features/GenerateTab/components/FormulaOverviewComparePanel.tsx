/**
 * FormulaOverviewComparePanel - 配方概览对比面板（卡片视图）
 *
 * @description 自动对比前 N 个候选的药材多样性、总剂量、安全评分、君臣佐使结构，
 *              让用户一屏看清候选差异，无需切换表格模式。消费 formulaCompare 引擎。
 *              （区别于 FormulaComparePanel 的版本雷达图对比，本组件是轻量概览表。）
 * @version 1.0.0
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Columns3 } from 'lucide-react'
import { Card } from '@/components/ui'
import type { AICandidate } from '@/api/ai'
import { buildFormulaComparison } from '../utils/formulaCompare'

interface FormulaOverviewComparePanelProps {
  candidates: AICandidate[]
  maxCompare?: number
}

export function FormulaOverviewComparePanel({ candidates, maxCompare = 3 }: FormulaOverviewComparePanelProps) {
  const { t } = useTranslation()

  const comparison = useMemo(() => {
    const top = candidates.slice(0, maxCompare)
    if (top.length < 2) return null
    return buildFormulaComparison(top)
  }, [candidates, maxCompare])

  // P6：不足 2 个候选时不再静默返回 null（占位空白），改为显式占位提示，
  // 避免用户在卡片视图底部看到一个无解释的空白块。
  // key 暂未入 locale（zh/en/de 三语文件不在本次改动范围），先用 t() 的 defaultValue 兜底，
  // 后续补齐 key 即可自动走翻译。需补 i18n。
  if (!comparison) {
    return (
      <div className="text-caption text-muted-foreground">
        {t('ai.formula.generateTab.overviewCompareNeedTwo', '需≥2个候选方可对比')}
      </div>
    )
  }

  const safetyLabel = (status?: string) => {
    switch (status) {
      case 'passed':
        // H3：green-600/amber-600 绕过令牌、违反三色体系 → 改用已登记语义色（暗色自适配）
        return { text: t('ai.formula.generateTab.safetyPassed'), cls: 'text-success' }
      case 'needs_attention':
        return { text: t('ai.formula.generateTab.safetyNeedsAttention'), cls: 'text-warning' }
      default:
        return { text: t('ai.formula.generateTab.safetyUnverified'), cls: 'text-muted-foreground' }
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-1.5">
        <Columns3 className="w-4 h-4 text-primary" />
        <h3 className="text-h4 font-semibold">
          {t('ai.formula.generateTab.formulaOverviewCompareTitle')}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-caption">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 pr-3 font-medium">{t('ai.formula.generateTab.compareMetricHeader')}</th>
              {comparison.formulas.map((f) => (
                <th key={f.id} className="text-left py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 pr-3 text-muted-foreground">{t('ai.formula.generateTab.compareMetricHerbCount')}</td>
              {comparison.formulas.map((f) => (
                <td key={f.id} className="py-2 px-3">{f.herbCount}</td>
              ))}
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 pr-3 text-muted-foreground">{t('ai.formula.generateTab.compareMetricTotalDose')}</td>
              {comparison.formulas.map((f) => (
                <td key={f.id} className="py-2 px-3">{f.totalG}g</td>
              ))}
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 pr-3 text-muted-foreground">{t('ai.formula.generateTab.compareMetricRoleStructure')}</td>
              {comparison.formulas.map((f) => (
                <td key={f.id} className="py-2 px-3">
                  {Object.entries(f.roleStructure)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([role, count]) => `${role}×${count}`)
                    .join(' ') || '—'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 pr-3 text-muted-foreground">{t('ai.formula.generateTab.compareMetricSafety')}</td>
              {comparison.formulas.map((f) => {
                const s = safetyLabel(f.safetyStatus)
                return (
                  <td key={f.id} className={`py-2 px-3 ${s.cls}`}>
                    {s.text}
                    {typeof f.safetyScore === 'number' ? ` (${f.safetyScore.toFixed(2)})` : ''}
                  </td>
                )
              })}
            </tr>
            <tr>
              <td className="py-2 pr-3 text-muted-foreground">{t('ai.formula.generateTab.compareMetricOverall')}</td>
              {comparison.formulas.map((f) => (
                <td key={f.id} className="py-2 px-3">
                  {typeof f.overallScore === 'number' ? f.overallScore.toFixed(2) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {comparison.sharedHerbs.length > 0 && (
        <div className="text-caption text-muted-foreground">
          <span className="font-medium">
            {t('ai.formula.generateTab.compareMaxDiffSharedHerbs')}
          </span>
          {comparison.sharedHerbs.slice(0, 3).map((s) => `${s.herb}(Δ${s.maxDiffG}g)`).join('、')}
        </div>
      )}
    </Card>
  )
}

export default FormulaOverviewComparePanel
