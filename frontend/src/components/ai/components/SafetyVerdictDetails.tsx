/**
 * SafetyVerdictDetails - 安全合规三态明细面板
 *
 * 渲染后端 safety_verdict 的完整明细（violations / warnings），
 * 区分「真违规」（红）与「咨询级提示」（黄/中性），避免把
 * is_compliant=true 却带咨询级 warning 的情况渲染成红色吓用户。
 *
 * 三态约定（ADR-046 L5）：
 * - passed           → 绿（合规，即使有咨询级 warnings 仍为绿底，warnings 单独黄标列出）
 * - needs_attention  → 黄（有真违规，violations 红字 + warnings 黄字）
 * - unverified       → 灰虚线（未校验，不构成安全结论）
 *
 * 所有文案走 i18n（zh-CN / en-US / de-DE），不硬编码中文。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  XCircle,
} from 'lucide-react'
import type { SafetyVerdict } from '@/types/ai.api'

interface SafetyVerdictDetailsProps {
  verdict?: SafetyVerdict
  /** 默认展开状态（有违规时建议默认展开，便于用户即时看到原因） */
  defaultExpanded?: boolean
}

export function SafetyVerdictDetails({ verdict, defaultExpanded }: SafetyVerdictDetailsProps) {
  const { t } = useTranslation()
  const status = verdict?.status ?? 'unverified'
  const violations = verdict?.violations ?? []
  const warnings = verdict?.warnings ?? []
  const hasDetails = violations.length > 0 || warnings.length > 0

  // 有真违规时默认展开；纯通过/未校验默认收起（避免刷屏）
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? (violations.length > 0),
  )

  if (!verdict) return null

  // 状态元数据：三态色板与图标
  const statusMeta = (() => {
    switch (status) {
      case 'passed':
        return {
          label: t('ai.formula.generateTab.safetyPassed'),
          hint: warnings.length > 0
            ? t('ai.formula.generateTab.safetyPassedWithWarningsHint')
            : t('ai.formula.generateTab.safetyPassedHint'),
          Icon: Shield,
          containerCls: 'bg-success-50 dark:bg-success-300/15 border-success-200 dark:border-success-800',
          titleCls: 'text-success-700 dark:text-success-300',
          iconCls: 'text-success-600 dark:text-success-400',
        }
      case 'needs_attention':
        return {
          label: t('ai.formula.generateTab.safetyNeedsAttention'),
          hint: t('ai.formula.generateTab.safetyNeedsAttentionHint'),
          Icon: ShieldAlert,
          containerCls: 'bg-warning-50 dark:bg-warning-300/15 border-warning-200 dark:border-warning-800',
          titleCls: 'text-warning-700 dark:text-warning-300',
          iconCls: 'text-warning-600 dark:text-warning-400',
        }
      case 'unverified':
      default:
        return {
          label: t('ai.formula.generateTab.safetyUnverified'),
          hint: t('ai.formula.generateTab.safetyUnverifiedHint'),
          Icon: ShieldQuestion,
          containerCls: 'bg-muted/30 dark:bg-muted/10 border-border border-dashed',
          titleCls: 'text-muted-foreground',
          iconCls: 'text-muted-foreground',
        }
    }
  })()

  return (
    <section
      className={`rounded-xl border ${statusMeta.containerCls} p-3 space-y-2`}
      aria-label={t('ai.formula.generateTab.safetyVerdictDetailsTitle')}
    >
      {/* 头部：状态标题 + 展开/收起按钮（仅有明细时可展开） */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <statusMeta.Icon className={`w-4 h-4 shrink-0 ${statusMeta.iconCls}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className={`text-sm font-semibold leading-tight ${statusMeta.titleCls}`}>
              {statusMeta.label}
            </p>
            <p className="text-caption text-muted-foreground mt-0.5 leading-snug">
              {statusMeta.hint}
            </p>
          </div>
        </div>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 min-h-[32px] px-2 rounded-md text-caption text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            aria-expanded={expanded}
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" />{t('ai.formula.generateTab.collapseDetails')}</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" />{t('ai.formula.generateTab.expandDetails')}</>
            )}
          </button>
        )}
      </div>

      {/* 明细清单：violations（红/真违规）+ warnings（黄/咨询级） */}
      {expanded && hasDetails && (
        <div className="space-y-2 pt-1">
          {violations.length > 0 && (
            <div>
              <p className="text-caption font-semibold text-danger-700 dark:text-danger-300 mb-1 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t('ai.formula.generateTab.safetyViolationsLabel', { count: violations.length })}
              </p>
              <ul className="space-y-1">
                {violations.map((v, i) => (
                  <li
                    key={`violation-${i}`}
                    className="text-caption text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-300/15 border border-danger-200 dark:border-danger-800 rounded-md px-2.5 py-1.5 leading-relaxed"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="text-caption font-semibold text-warning-700 dark:text-warning-300 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t('ai.formula.generateTab.safetyWarningsLabel', { count: warnings.length })}
              </p>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li
                    key={`warning-${i}`}
                    className="text-caption text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-300/15 border border-warning-200 dark:border-warning-800 rounded-md px-2.5 py-1.5 leading-relaxed flex items-start gap-1.5"
                  >
                    <Info className="w-3 h-3 mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default SafetyVerdictDetails
