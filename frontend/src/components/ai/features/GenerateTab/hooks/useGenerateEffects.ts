import { useCallback, useMemo } from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'
import { STORAGE_KEYS, VALIDATION } from '@/config'
import { logger } from '@/utils/safeLogger'

interface EffectOption {
  id: string
  label: string
  labelKey: string
  category: string
  categoryKey: string
  popular: boolean
}

export function useGenerateEffects() {
  const [selectedEffects, setSelectedEffects] = usePersistentState<EffectOption[]>(
    STORAGE_KEYS.GENERATE_SELECTED_EFFECTS,
    [],
  )

  const toggleEffect = useCallback((effect: EffectOption) => {
    setSelectedEffects((prev) => {
      const isSelected = prev.some(e => e.id === effect.id)

      if (isSelected) {
        return prev.filter(e => e.id !== effect.id)
      }

      if (prev.length >= VALIDATION.maxEffectSelection) {
        logger.warn('达到最大功效选择数量', {
          current: prev.length,
          max: VALIDATION.maxEffectSelection,
        })
        return prev
      }

      return [...prev, effect]
    })
  }, [setSelectedEffects])

  const clearEffects = useCallback(() => {
    setSelectedEffects([])
  }, [setSelectedEffects])

  const effectLabels = useMemo(
    () => selectedEffects.map(effect => effect.label),
    [selectedEffects],
  )

  return {
    selectedEffects,
    setSelectedEffects,
    toggleEffect,
    clearEffects,
    effectLabels,
    canSelectMore: selectedEffects.length < VALIDATION.maxEffectSelection,
    selectionCount: selectedEffects.length,
  }
}
