import React from 'react'
import { BookOpen, ShieldCheck, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { AICandidate } from '@/api/ai'

interface FormulaExplanationModalProps {
  candidate: AICandidate | null
  isOpen: boolean
  onClose: () => void
}

// 药材角色颜色映射
const ROLE_COLORS = {
  '君药': 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-300 border-error-200 dark:border-error-800',
  '臣药': 'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-300 border-warning-200 dark:border-warning-800',
  '佐药': 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800',
  '使药': 'bg-success-100 text-success-700 dark:bg-success-300/25 dark:text-success-300 border-success-200 dark:border-success-800',
}

function HerbRoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS['佐药']
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', color)}>
      {role}
    </span>
  )
}

function ExplanationSection({
  icon,
  title,
  content,
  className,
}: {
  icon: React.ReactNode
  title: string
  content: string
  className?: string
}) {
  return (
    <div className={cn('mb-4 last:mb-0', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h4 className="text-h6 font-semibold">{title}</h4>
      </div>
      <p className="text-body-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    </div>
  )
}

export function FormulaExplanationModal({ candidate, isOpen, onClose }: FormulaExplanationModalProps) {
  const { t } = useTranslation()
  if (!candidate) return null

  const explanation = candidate.explanation

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-h4">
            <BookOpen className="w-5 h-5 text-primary" />
            {explanation?.formula_name || candidate.formula_name || candidate.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* 药材组成 */}
          {candidate.herb_combination && candidate.herb_combination.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-h6 font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t('ai.formula.generateTab.formulaComposition')}
              </h4>
              <div className="space-y-2">
                {candidate.herb_combination.map((herb, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-background rounded border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <HerbRoleBadge role={herb.role || t('ai.formula.ui.herbRoleAssistant')} />
                      <span className="font-medium">{herb.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {herb.dosage_g ? `${herb.dosage_g}g` : herb.dosage || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 配方解释内容 */}
          {explanation ? (
            <>
              <ExplanationSection
                icon={<ShieldCheck className="w-4 h-4" />}
                title={t('ai.formula.generateTab.structureAnalysis')}
                content={explanation.structure_analysis}
              />

              <ExplanationSection
                icon={<BookOpen className="w-4 h-4" />}
                title={t('ai.formula.generateTab.modernMechanism')}
                content={explanation.mechanism_explanation}
              />

              <ExplanationSection
                icon={<ShieldCheck className="w-4 h-4" />}
                title={t('ai.formula.generateTab.synergyPrinciple')}
                content={explanation.synergistic_analysis}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ExplanationSection
                  icon={<ShieldCheck className="w-4 h-4 text-info" />}
                  title={t('ai.formula.generateTab.suitablePopulation')}
                  content={explanation.suitable_population}
                  className="bg-info/5 rounded-lg p-3"
                />
                <ExplanationSection
                  icon={<AlertCircle className="w-4 h-4 text-warning" />}
                  title={t('ai.formula.generateTab.contraindications')}
                  content={explanation.contraindications}
                  className="bg-warning/5 rounded-lg p-3"
                />
              </div>

              <ExplanationSection
                icon={<ShieldCheck className="w-4 h-4 text-success" />}
                title={t('ai.formula.generateTab.usageAdvice')}
                content={explanation.usage_instructions}
                className="bg-success/5 rounded-lg p-3"
              />

              <ExplanationSection
                icon={<ShieldCheck className="w-4 h-4" />}
                title={t('ai.formula.generateTab.monitoringIteration')}
                content={explanation.monitoring_suggestions}
                className="bg-muted/30 rounded-lg p-3"
              />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('ai.formula.generateTab.explanationGenerating')}</p>
            </div>
          )}

          {/* 免责声明 */}
          <div className="text-caption text-muted-foreground bg-muted/50 rounded-lg p-3">
            <strong>{t('ai.formula.generateTab.disclaimer')}</strong>{t('ai.formula.generateTab.disclaimerText')}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('ai.formula.generateTab.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FormulaExplanationModal
