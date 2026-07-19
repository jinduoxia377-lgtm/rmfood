import { useState, useRef, useCallback } from 'react'
import { DEFAULTS, TIMEOUTS } from '@/config'
import { logger } from '@/utils/safeLogger'
import type { AICandidate } from '@/api/ai'

interface SavedFormulaState {
  formulaId: number
  savedAt: number
}

export function useSavedFormulas() {
  const [savedFormulas, setSavedFormulas] = useState<Map<string, SavedFormulaState>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState<{ formulaId: number; formulaName: string } | null>(null)
  const candidateIdCache = useRef<Map<string, string>>(new Map())

  const getCandidateId = useCallback((candidate: AICandidate, index: number): string => {
    const cacheKey = `${index}_${candidate.id || candidate.name || 'unknown'}`

    const cached = candidateIdCache.current.get(cacheKey)
    if (cached) return cached

    const safeName = typeof candidate.formula_name === 'string'
      ? candidate.formula_name.replace(/\s+/g, '_').toLowerCase()
      : (typeof candidate.name === 'string' ? candidate.name.replace(/\s+/g, '_').toLowerCase() : 'unknown')

    const newId = `candidate_${index}_${safeName}`
    candidateIdCache.current.set(cacheKey, newId)

    return newId
  }, [])

  const handleSaveSuccess = useCallback((
    formulaId: number,
    candidateId: string,
    generateResult: AICandidate[] | null,
  ) => {
    setSavedFormulas(prev => new Map(prev).set(candidateId, {
      formulaId,
      savedAt: Date.now(),
    }))

    const savedCandidate = generateResult?.find((c, i) => getCandidateId(c, i) === candidateId)

    if (savedCandidate) {
      const formulaName = typeof savedCandidate.formula_name === 'string'
        ? savedCandidate.formula_name
        : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_FORMULA

      setSaveSuccess({ formulaId, formulaName })

      setTimeout(() => {
        setSaveSuccess(null)
      }, TIMEOUTS.saveSuccessDisplay)
    }
  }, [getCandidateId])

  const resetSavedFormulas = useCallback(() => {
    setSavedFormulas(new Map())
    setSaveSuccess(null)
  }, [])

  return {
    savedFormulas,
    saveSuccess,
    setSaveSuccess,
    getCandidateId,
    handleSaveSuccess,
    resetSavedFormulas,
  }
}
