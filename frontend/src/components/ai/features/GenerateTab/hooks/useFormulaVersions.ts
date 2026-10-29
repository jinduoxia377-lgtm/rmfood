import { useCallback } from 'react'
import { DEFAULTS } from '@/config'
import { HERB_ROLES } from '../config/generateTabConfig'
import { logger } from '@/utils/safeLogger'
import type { AICandidate } from '@/api/ai'
import { useGenerationStore, type FormulaVersionData } from '@/stores/generationStore'

export function useFormulaVersions() {
  // P3：版本历史提升到全局 Zustand store，切换 tab 后保留
  const formulaVersions = useGenerationStore((s) => s.formulaVersions)
  const addFormulaVersion = useGenerationStore((s) => s.addFormulaVersion)
  const setFormulaVersions = useGenerationStore((s) => s.setFormulaVersions)

  const addVersion = useCallback((candidates: AICandidate[], effects: string[]) => {
    if (candidates.length === 0) return

    const topCandidate = candidates[0]
    // 从现有版本推导下一个版本号（避免切 tab 重挂载后 ref 重置导致版本号冲突）
    const nextVersionNumber =
      formulaVersions.length > 0
        ? Math.max(...formulaVersions.map((v) => v.versionNumber)) + 1
        : 1

    const newVersion: FormulaVersionData = {
      id: `version_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      versionNumber: nextVersionNumber,
      formulaName: typeof topCandidate.formula_name === 'string'
        ? topCandidate.formula_name
        : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_FORMULA,
      effects,
      ingredients: (topCandidate.herb_combination || []).map((h: any, i: number) => ({
        name: typeof h.name === 'string' ? h.name : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_INGREDIENT,
        dosage: h.dosage || DEFAULTS.PLACEHOLDER_TEXTS.DEFAULT_DOSAGE_RANGE,
        role: HERB_ROLES[i % HERB_ROLES.length] || '君药',
      })),
      scores: {
        synergy: topCandidate.synergy_score || 0,
        taste: ((topCandidate as unknown) as Record<string, unknown>).taste_score as number || DEFAULTS.DEFAULT_TASTE_SCORE,
        stability: ((topCandidate as unknown) as Record<string, unknown>).stability_score as number || DEFAULTS.DEFAULT_STABILITY_SCORE,
        overall: ((topCandidate as unknown) as Record<string, unknown>).overall_score as number || (topCandidate.synergy_score || 0),
      },
      createdAt: Date.now(),
      remark: `${DEFAULTS.PLACEHOLDER_TEXTS.VERSION_REMARK_PREFIX} [${effects.join(', ')}] ${DEFAULTS.PLACEHOLDER_TEXTS.VERSION_REMARK_SUFFIX}`,
    }

    addFormulaVersion(newVersion)

    logger.info('添加新配方版本', {
      versionNumber: newVersion.versionNumber,
      formulaName: newVersion.formulaName,
    })
  }, [formulaVersions, addFormulaVersion])

  return {
    formulaVersions,
    setFormulaVersions,
    addVersion,
    versionCount: formulaVersions.length,
  }
}
