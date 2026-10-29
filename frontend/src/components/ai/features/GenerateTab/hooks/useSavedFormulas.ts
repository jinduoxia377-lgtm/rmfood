import { useRef, useCallback } from 'react'
import { DEFAULTS, TIMEOUTS } from '@/config'
import type { AICandidate } from '@/api/ai'
import { useGenerationStore } from '@/stores/generationStore'

export interface SavedFormulaState {
  formulaId: number
  savedAt: number
}

export function useSavedFormulas() {
  // P1-6：已保存映射提升到全局 Zustand store，切 tab（GenerateTab 卸载）后保留，
  // 避免「已保存」标记丢失与重复保存。
  const savedFormulas = useGenerationStore((s) => s.savedFormulas)
  const setSavedFormulas = useGenerationStore((s) => s.setSavedFormulas)
  const saveSuccess = useGenerationStore((s) => s.saveSuccess)
  const setSaveSuccess = useGenerationStore((s) => s.setSaveSuccess)
  const resetSavedFormulas = useGenerationStore((s) => s.resetSavedFormulas)
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
    setSavedFormulas(new Map(savedFormulas).set(candidateId, {
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
  }, [getCandidateId, savedFormulas, setSavedFormulas, setSaveSuccess])

  return {
    savedFormulas,
    saveSuccess,
    setSaveSuccess,
    getCandidateId,
    handleSaveSuccess,
    resetSavedFormulas,
  }
}