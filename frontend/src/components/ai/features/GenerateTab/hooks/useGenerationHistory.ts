import { useState, useEffect, useCallback } from 'react'
import type { AICandidate } from '@/api/ai'
import { logger } from '@/utils/safeLogger'
import { STORAGE } from '@/constants/businessRules'

export interface GenerationHistoryItem {
  id: string
  timestamp: number
  targetEffects: string[]
  candidates: AICandidate[]
  generator: string
  processingTime?: number
}

const STORAGE_KEY = 'rmfood_generation_history'
const MAX_HISTORY_SIZE = STORAGE.MAX_HISTORY_SIZE

export function useGenerationHistory() {
  const [history, setHistory] = useState<GenerationHistoryItem[]>([])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
          logger.info('配方生成历史加载成功', { count: parsed.length })
        }
      }
    } catch (error) {
      logger.error('加载配方生成历史失败', { error })
      setHistory([])
    }
  }, [])

  const saveHistory = useCallback((items: GenerationHistoryItem[]) => {
    try {
      const trimmed = items.slice(0, MAX_HISTORY_SIZE)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      setHistory(trimmed)
    } catch (error) {
      logger.error('保存配方生成历史失败', { error })
    }
  }, [])

  const addToHistory = useCallback((item: Omit<GenerationHistoryItem, 'id'>) => {
    const newItem: GenerationHistoryItem = {
      ...item,
      id: `history_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    }

    setHistory((prev) => {
      const updated = [newItem, ...prev]
      const trimmed = updated.slice(0, MAX_HISTORY_SIZE)
      saveHistory(trimmed)
      return trimmed
    })

    logger.info('配方生成记录已保存到历史', { effects: item.targetEffects })
  }, [saveHistory])

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      saveHistory(updated)
      return updated
    })
    logger.info('配方生成记录已从历史删除', { id })
  }, [saveHistory])

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setHistory([])
    logger.info('配方生成历史已清空')
  }, [])

  const getRecentEffects = useCallback(() => {
    const effectsSet = new Set<string>()
    history.forEach((item) => {
      item.targetEffects.forEach((effect) => effectsSet.add(effect))
    })
    return Array.from(effectsSet).slice(0, STORAGE.MAX_HISTORY_SIZE)
  }, [history])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentEffects,
    loadHistory,
  }
}
