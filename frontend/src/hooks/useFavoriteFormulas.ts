import { useState, useEffect, useCallback } from 'react'
import type { AICandidate } from '@/api/ai'
import { logger } from '@/utils/safeLogger'
import { STORAGE } from '@/constants/businessRules'

export interface FavoriteFormula {
  id: string
  candidate: AICandidate
  addedAt: number
  notes?: string
}

const STORAGE_KEY = 'rmfood_favorite_formulas'
const MAX_FAVORITES = STORAGE.MAX_FAVORITES

export function useFavoriteFormulas() {
  const [favorites, setFavorites] = useState<FavoriteFormula[]>([])

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setFavorites(parsed)
          logger.info('配方收藏列表加载成功', { count: parsed.length })
        }
      }
    } catch (error) {
      logger.error('加载配方收藏失败', error)
    }
  }, [])

  const saveFavorites = useCallback((newFavorites: FavoriteFormula[]) => {
    try {
      const limited = newFavorites.slice(0, MAX_FAVORITES)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
      setFavorites(limited)
    } catch (error) {
      logger.error('保存配方收藏失败', error)
    }
  }, [])

  const isFavorite = useCallback((candidateId: string): boolean => {
    return favorites.some(f => f.id === candidateId)
  }, [favorites])

  const addToFavorites = useCallback((candidate: AICandidate, notes?: string) => {
    if (isFavorite(candidate.id)) {
      logger.info('配方已在收藏列表中', { id: candidate.id })
      return
    }

    const newFavorite: FavoriteFormula = {
      id: candidate.id,
      candidate,
      addedAt: Date.now(),
      notes,
    }

    saveFavorites([newFavorite, ...favorites])
    logger.info('配方已添加到收藏', { id: candidate.id, name: candidate.name })
  }, [favorites, isFavorite, saveFavorites])

  const removeFromFavorites = useCallback((candidateId: string) => {
    const newFavorites = favorites.filter(f => f.id !== candidateId)
    saveFavorites(newFavorites)
    logger.info('配方已从收藏移除', { id: candidateId })
  }, [favorites, saveFavorites])

  const clearFavorites = useCallback(() => {
    saveFavorites([])
    logger.info('配方收藏已清空')
  }, [saveFavorites])

  const updateFavoriteNotes = useCallback((candidateId: string, notes: string) => {
    const newFavorites = favorites.map(f =>
      f.id === candidateId ? { ...f, notes } : f,
    )
    saveFavorites(newFavorites)
    logger.info('配方收藏备注已更新', { id: candidateId })
  }, [favorites, saveFavorites])

  return {
    favorites,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    clearFavorites,
    updateFavoriteNotes,
  }
}

export default useFavoriteFormulas
