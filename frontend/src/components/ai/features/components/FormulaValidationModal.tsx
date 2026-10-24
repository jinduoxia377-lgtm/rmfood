/**
 * FormulaValidationModal - 成分级配方校验报告弹窗
 *
 * 输入 validateAiFormula 返回的校验结果，展示：
 * - 总体风险评分与 blocked_by_critical 状态
 * - 每成分识别状态/药食同源/毒性等级/剂量状态/安全剂量范围/禁忌
 * - 配伍禁忌与过敏原条目（error/warning 着色）
 * - 建议列表
 *
 * 交互：
 * - CRITICAL 阻断时禁用「确认保存」，只能取消；
 * - 有 warnings 未阻断时可「确认保存」继续。
 */
import React from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui'
import type { AiFormulaValidationResponse } from '@/api/ai'

export interface FormulaValidationModalProps {
  open: boolean
  result: AiFormulaValidationResponse | null
  formulaName?: string
  /** 确认保存回调（用户点击「确认保存」时触发） */
  onConfirm: () => void
  /** 取消/关闭回调 */
  onCancel: () => void
}

export function FormulaValidationModal({
  open,
  result,
  formulaName,
  onConfirm,
  onCancel,
}: FormulaValidationModalProps) {
  if (!open || !result) return null

  const blocked = !!result.blocked_by_critical
  const riskScore = result.risk_score ?? (blocked ? 80 : 0)
  const ingredients = result.ingredients ?? []
  const issues = result.compatibility_issues ?? []
  const recommendations = result.recommendations ?? []
  const alerts = result.alerts ?? []

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="配方校验报告"
      data-testid="formula-validation-modal"
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="min-w-0">
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ShieldAlert className="w-4 h-4 text-warning-600" aria-hidden="true" />
              配方校验报告
            </h3>
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
              {formulaName ? `配方：${formulaName}` : '配方校验结果'}
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="关闭"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 可滚动内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 总体风险 */}
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              blocked
                ? 'bg-error-50 dark:bg-error-300/15 border-error-200 dark:border-error-800'
                : 'bg-success-50 dark:bg-success-300/15 border-success-200 dark:border-success-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {blocked ? (
                <AlertTriangle className="w-4 h-4 text-error-600" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-success-600" aria-hidden="true" />
              )}
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {blocked ? '校验未通过（CRITICAL）' : '校验通过'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: blocked ? 'var(--color-error-600)' : 'var(--color-success-600)' }}>
                {Math.round(riskScore)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>风险评分</div>
            </div>
          </div>

          {/* 成分明细 */}
          {ingredients.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>成分明细</h4>
              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-xs min-w-[560px]">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-800/60 text-left" style={{ color: 'var(--text-muted)' }}>
                      <th className="px-3 py-2 font-medium">成分</th>
                      <th className="px-3 py-2 font-medium">识别</th>
                      <th className="px-3 py-2 font-medium">药食同源</th>
                      <th className="px-3 py-2 font-medium">毒性</th>
                      <th className="px-3 py-2 font-medium">剂量状态</th>
                      <th className="px-3 py-2 font-medium">安全剂量</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {ingredients.map((ing, idx) => {
                      const row = ing as Record<string, unknown>
                      const name = String(row.name ?? '')
                      const recognized = !!row.recognized
                      const foodHomology = !!row.food_homology
                      const toxicity = row.toxicity_class ? String(row.toxicity_class) : '—'
                      const dosageStatus = String(row.dosage_status ?? '未知')
                      const doseRange = row.safe_dose_range as { min_g?: number | null; max_g?: number | null } | null | undefined
                      const doseText = doseRange
                        ? `${doseRange.min_g ?? '?'}-${doseRange.max_g ?? '?'}g/天`
                        : '未收录'
                      const contraindications = Array.isArray(row.contraindications) ? (row.contraindications as string[]) : []

                      return (
                        <tr key={`${name}-${idx}`}>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {name}
                            {contraindications.length > 0 && (
                              <div className="text-[10px] text-warning-600 mt-0.5">{contraindications.join('、')}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {recognized ? (
                              <span className="text-success-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />已识别</span>
                            ) : (
                              <span className="text-warning-600">未识别</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{foodHomology ? '是' : '否'}</td>
                          <td className="px-3 py-2">{toxicity}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded-md ${
                                dosageStatus === '超上限'
                                  ? 'bg-error-50 dark:bg-error-300/15 text-error-600'
                                  : dosageStatus === '范围内'
                                    ? 'bg-success-50 dark:bg-success-300/15 text-success-600'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                              }`}
                            >
                              {dosageStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{doseText}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 配伍禁忌与过敏原 */}
          {(issues.length > 0 || alerts.length > 0) && (
            <section>
              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                配伍禁忌与过敏原
              </h4>
              <div className="space-y-2">
                {issues.map((issue, idx) => {
                  const isError = issue.level === 'error' || issue.category === 'allergen'
                  return (
                    <div
                      key={`issue-${idx}`}
                      className={`px-3 py-2 rounded-xl border text-xs ${
                        isError
                          ? 'bg-error-50 dark:bg-error-300/15 border-error-200 dark:border-error-800 text-error-700 dark:text-error-700'
                          : 'bg-warning-50 dark:bg-warning-300/15 border-warning-200 dark:border-warning-800 text-warning-700 dark:text-warning-700'
                      }`}
                    >
                      <div className="font-medium">
                        {isError ? '🔴' : '⚠️'} {issue.description}
                      </div>
                      {issue.suggestion && <div className="mt-0.5 opacity-90">建议：{issue.suggestion}</div>}
                    </div>
                  )
                })}
                {alerts.map((alert, idx) => (
                  <div
                    key={`alert-${idx}`}
                    className={`px-3 py-2 rounded-xl border text-xs ${
                      alert.level === 'critical'
                        ? 'bg-error-50 dark:bg-error-300/15 border-error-200 dark:border-error-800 text-error-700 dark:text-error-700'
                        : 'bg-warning-50 dark:bg-warning-300/15 border-warning-200 dark:border-warning-800 text-warning-700 dark:text-warning-700'
                    }`}
                  >
                    <div className="font-medium">
                      {alert.level === 'critical' ? '🔴' : '⚠️'} {alert.message}
                    </div>
                    {alert.recommendation && <div className="mt-0.5 opacity-90">建议：{alert.recommendation}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 建议列表 */}
          {recommendations.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>校验建议</h4>
              <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {recommendations.map((rec, idx) => (
                  <li key={`rec-${idx}`} className="flex items-start gap-2">
                    <span className="text-primary-600 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={blocked}
            onClick={onConfirm}
            data-testid="validation-confirm-save"
          >
            {blocked ? 'CRITICAL 阻断' : '确认保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FormulaValidationModal