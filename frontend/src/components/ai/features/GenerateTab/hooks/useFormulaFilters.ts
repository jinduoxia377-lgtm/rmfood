import { useState, useMemo, useCallback } from 'react'
import { CATEGORY_EFFECTS, FORMULA_CATEGORY_LIST, type FormulaCategory } from '../config/generateTabConfig'
import type { AICandidate } from '@/api/ai'

type SortBy = 'score' | 'name' | 'synergy'
type SortOrder = 'asc' | 'desc'

export function useFormulaFilters() {
  const [selectedCategory, setSelectedCategory] = useState<FormulaCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const filteredAndSortedResults = useMemo(() => {
    return (generateResult: AICandidate[] | null) => {
      if (!generateResult) return []

      let results = [...generateResult]

      if (selectedCategory !== 'all') {
        const targetEffects = CATEGORY_EFFECTS[selectedCategory]
        results = results.filter(candidate =>
          candidate.effects?.some(effect => targetEffects.includes(effect)),
        )
      }

      results.sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case 'score':
            comparison = (a.score || 0) - (b.score || 0)
            break
          case 'name':
            comparison = (a.formula_name || '').localeCompare(b.formula_name || '')
            break
          case 'synergy':
            comparison = (a.synergy_score || 0) - (b.synergy_score || 0)
            break
        }

        return sortOrder === 'desc' ? -comparison : comparison
      })

      return results
    }
  }, [selectedCategory, sortBy, sortOrder])

  const toggleSort = useCallback((newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }, [sortBy])

  return {
    selectedCategory,
    setSelectedCategory,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    toggleSort,
    filteredAndSortedResults,
    formulaCategories: FORMULA_CATEGORY_LIST,
  }
}
