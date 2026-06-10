/**
 * 用户偏好 Store - 配方生成个性化推荐
 * 基于用户历史行为构建用户画像，提供智能推荐
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserPreference {
  frequentEffects: string[]
  favoriteIngredients: string[]
  tasteProfile: {
    sweetness: number
    bitterness: number
    astringency: number
    umami: number
  }
  safetyLevel: number
  budgetRange: {
    min: number
    max: number
  }
  lastUpdated: number
}

export interface GenerationHistory {
  id: string
  effects: string[]
  ingredients: string[]
  scores: {
    synergy: number
    taste: number
    stability: number
    overall: number
  }
  generator: string
  createdAt: number
  liked?: boolean
}

export interface RecommendationFeedback {
  recommendationId: string
  liked: boolean
  timestamp: number
}

interface UserPreferenceState {
  preferences: UserPreference
  generationHistory: GenerationHistory[]
  recommendationFeedback: RecommendationFeedback[]

  updatePreferences: (updates: Partial<UserPreference>) => void
  addGenerationHistory: (history: Omit<GenerationHistory, 'id' | 'createdAt'>) => void
  toggleHistoryLike: (historyId: string) => void
  addRecommendationFeedback: (feedback: RecommendationFeedback) => void
  getFrequentEffects: () => string[]
  getFavoriteIngredients: () => string[]
  getTasteProfile: () => UserPreference['tasteProfile']
  getPersonalizedRecommendations: () => GenerationHistory[]
  clearHistory: () => void
}

const DEFAULT_PREFERENCES: UserPreference = {
  frequentEffects: [],
  favoriteIngredients: [],
  tasteProfile: {
    sweetness: 0.5,
    bitterness: 0.3,
    astringency: 0.2,
    umami: 0.4,
  },
  safetyLevel: 0.8,
  budgetRange: {
    min: 0,
    max: 1000,
  },
  lastUpdated: Date.now(),
}

export const useUserPreferenceStore = create<UserPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      generationHistory: [],
      recommendationFeedback: [],

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...updates,
            lastUpdated: Date.now(),
          },
        }))
      },

      addGenerationHistory: (history) => {
        const newHistory: GenerationHistory = {
          ...history,
          id: `gen_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: Date.now(),
        }

        set((state) => {
          const updatedHistory = [newHistory, ...state.generationHistory].slice(0, 100)

          const effectCounts: Record<string, number> = {}
          const ingredientCounts: Record<string, number> = {}

          updatedHistory.forEach((h) => {
            h.effects.forEach((e) => {
              effectCounts[e] = (effectCounts[e] || 0) + 1
            })
            h.ingredients.forEach((i) => {
              ingredientCounts[i] = (ingredientCounts[i] || 0) + 1
            })
          })

          const sortedEffects = Object.entries(effectCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([effect]) => effect)

          const sortedIngredients = Object.entries(ingredientCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([ingredient]) => ingredient)

          return {
            generationHistory: updatedHistory,
            preferences: {
              ...state.preferences,
              frequentEffects: sortedEffects,
              favoriteIngredients: sortedIngredients,
              lastUpdated: Date.now(),
            },
          }
        })
      },

      toggleHistoryLike: (historyId) => {
        set((state) => ({
          generationHistory: state.generationHistory.map((h) =>
            h.id === historyId ? { ...h, liked: !h.liked } : h,
          ),
        }))
      },

      addRecommendationFeedback: (feedback) => {
        set((state) => ({
          recommendationFeedback: [
            feedback,
            ...state.recommendationFeedback.filter(
              (f) => f.recommendationId !== feedback.recommendationId,
            ),
          ].slice(0, 50),
        }))
      },

      getFrequentEffects: () => {
        return get().preferences.frequentEffects
      },

      getFavoriteIngredients: () => {
        return get().preferences.favoriteIngredients
      },

      getTasteProfile: () => {
        return get().preferences.tasteProfile
      },

      getPersonalizedRecommendations: () => {
        const { generationHistory } = get()

        if (generationHistory.length === 0) {
          return []
        }

        const likedHistory = generationHistory.filter((h) => h.liked)

        if (likedHistory.length === 0) {
          return generationHistory.slice(0, 5)
        }

        const effectScores: Record<string, number> = {}
        const ingredientScores: Record<string, number> = {}

        likedHistory.forEach((h) => {
          const weight = h.scores.overall
          h.effects.forEach((e) => {
            effectScores[e] = (effectScores[e] || 0) + weight
          })
          h.ingredients.forEach((i) => {
            ingredientScores[i] = (ingredientScores[i] || 0) + weight
          })
        })

        const recommendedEffects = Object.entries(effectScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([effect]) => effect)

        const recommendedIngredients = Object.entries(ingredientScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([ingredient]) => ingredient)

        const scoredHistory = generationHistory.map((h) => {
          let score = 0
          const effectMatch = h.effects.filter((e) => recommendedEffects.includes(e)).length
          const ingredientMatch = h.ingredients.filter((i) => recommendedIngredients.includes(i)).length
          score += effectMatch * 2
          score += ingredientMatch
          if (h.liked) score += 5
          score += h.scores.overall

          return { ...h, matchScore: score }
        })

        return scoredHistory
          .sort((a, b) => (b as any).matchScore - (a as any).matchScore)
          .slice(0, 5)
      },

      clearHistory: () => {
        set({
          generationHistory: [],
          preferences: DEFAULT_PREFERENCES,
        })
      },
    }),
    {
      name: 'rmfood-user-preferences',
      partialize: (state) => ({
        preferences: state.preferences,
        generationHistory: state.generationHistory,
        recommendationFeedback: state.recommendationFeedback,
      }),
    },
  ),
)
