import { useState, useRef, useCallback } from 'react'
import { DEFAULTS, VALIDATION } from '@/config'
import { HERB_ROLES } from '../config/generateTabConfig'
import { logger } from '@/utils/safeLogger'
import type { AICandidate } from '@/api/ai'

interface FormulaVersionData {
  id: string
  versionNumber: number
  formulaName: string
  effects: string[]
  ingredients: { name: string; dosage: string; role: string }[]
  scores: { synergy: number; taste: number; stability: number; overall: number }
  createdAt: number
  remark: string
}

export function useFormulaVersions() {
  const [formulaVersions, setFormulaVersions] = useState<FormulaVersionData[]>([])
  const versionCounterRef = useRef(0)

  const addVersion = useCallback((candidates: AICandidate[], effects: string[]) => {
    if (candidates.length === 0) return

    const topCandidate = candidates[0]
    versionCounterRef.current += 1

    const newVersion: FormulaVersionData = {
      id: `version_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      versionNumber: versionCounterRef.current,
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
        taste: (topCandidate as any).taste_score || DEFAULTS.DEFAULT_TASTE_SCORE,
        stability: (topCandidate as any).stability_score || DEFAULTS.DEFAULT_STABILITY_SCORE,
        overall: (topCandidate as any).overall_score || (topCandidate.synergy_score || 0),
      },
      createdAt: Date.now(),
      remark: `${DEFAULTS.PLACEHOLDER_TEXTS.VERSION_REMARK_PREFIX} [${effects.join(', ')}] ${DEFAULTS.PLACEHOLDER_TEXTS.VERSION_REMARK_SUFFIX}`,
    }

    setFormulaVersions(prev =>
      [newVersion, ...prev].slice(0, VALIDATION.maxFormulaVersions),
    )

    logger.info('添加新配方版本', {
      versionNumber: newVersion.versionNumber,
      formulaName: newVersion.formulaName,
    })
  }, [])

  return {
    formulaVersions,
    setFormulaVersions,
    addVersion,
    versionCount: formulaVersions.length,
  }
}
