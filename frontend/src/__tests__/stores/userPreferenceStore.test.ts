import { act, renderHook } from '@testing-library/react'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'

describe('useUserPreferenceStore', () => {
  beforeEach(() => {
    const store = useUserPreferenceStore.getState()
    store.clearHistory()
  })

  describe('updatePreferences', () => {
    it('updates user preferences correctly', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.updatePreferences({
          frequentEffects: ['增强免疫', '抗氧化'],
          safetyLevel: 0.9,
        })
      })

      expect(result.current.preferences.frequentEffects).toEqual(['增强免疫', '抗氧化'])
      expect(result.current.preferences.safetyLevel).toBe(0.9)
      expect(result.current.preferences.lastUpdated).toBeGreaterThan(0)
    })

    it('preserves existing preferences when updating', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.updatePreferences({
          frequentEffects: ['增强免疫'],
        })
      })

      act(() => {
        result.current.updatePreferences({
          safetyLevel: 0.9,
        })
      })

      expect(result.current.preferences.frequentEffects).toEqual(['增强免疫'])
      expect(result.current.preferences.safetyLevel).toBe(0.9)
    })

    it('updates taste profile correctly', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.updatePreferences({
          tasteProfile: {
            sweetness: 0.8,
            bitterness: 0.2,
            astringency: 0.1,
            umami: 0.5,
          },
        })
      })

      expect(result.current.preferences.tasteProfile.sweetness).toBe(0.8)
      expect(result.current.preferences.tasteProfile.bitterness).toBe(0.2)
    })
  })

  describe('addGenerationHistory', () => {
    it('adds new history entry', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞', '黄芪'],
          scores: { synergy: 0.85, taste: 0.78, stability: 0.82, overall: 0.82 },
          generator: 'neural',
        })
      })

      expect(result.current.generationHistory.length).toBe(1)
      expect(result.current.generationHistory[0].effects).toEqual(['增强免疫'])
      expect(result.current.generationHistory[0].ingredients).toEqual(['枸杞', '黄芪'])
    })

    it('generates unique id for history entry', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      expect(result.current.generationHistory[0].id).toMatch(/^gen_/)
    })

    it('limits history to 100 entries', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      for (let i = 0; i < 105; i++) {
        act(() => {
          result.current.addGenerationHistory({
            effects: [`功效${i}`],
            ingredients: [`原料${i}`],
            scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
            generator: 'rule',
          })
        })
      }

      expect(result.current.generationHistory.length).toBe(100)
    })

    it('updates frequent effects based on history', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫', '抗氧化'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫', '降血压'],
          ingredients: ['黄芪'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      expect(result.current.preferences.frequentEffects).toContain('增强免疫')
    })

    it('updates favorite ingredients based on history', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞', '黄芪', '党参'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      expect(result.current.preferences.favoriteIngredients).toContain('枸杞')
      expect(result.current.preferences.favoriteIngredients).toContain('黄芪')
    })
  })

  describe('toggleHistoryLike', () => {
    it('toggles like status', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      const historyId = result.current.generationHistory[0].id

      act(() => {
        result.current.toggleHistoryLike(historyId)
      })

      expect(result.current.generationHistory[0].liked).toBe(true)

      act(() => {
        result.current.toggleHistoryLike(historyId)
      })

      expect(result.current.generationHistory[0].liked).toBe(false)
    })

    it('does nothing for non-existent id', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      act(() => {
        result.current.toggleHistoryLike('non-existent-id')
      })

      expect(result.current.generationHistory[0].liked).toBeUndefined()
    })
  })

  describe('addRecommendationFeedback', () => {
    it('adds feedback correctly', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addRecommendationFeedback({
          recommendationId: 'rec_1',
          liked: true,
          timestamp: Date.now(),
        })
      })

      expect(result.current.recommendationFeedback.length).toBe(1)
      expect(result.current.recommendationFeedback[0].recommendationId).toBe('rec_1')
      expect(result.current.recommendationFeedback[0].liked).toBe(true)
    })

    it('updates existing feedback', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addRecommendationFeedback({
          recommendationId: 'rec_1',
          liked: true,
          timestamp: Date.now(),
        })
      })

      act(() => {
        result.current.addRecommendationFeedback({
          recommendationId: 'rec_1',
          liked: false,
          timestamp: Date.now(),
        })
      })

      expect(result.current.recommendationFeedback.length).toBe(1)
      expect(result.current.recommendationFeedback[0].liked).toBe(false)
    })

    it('limits feedback to 50 entries', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      for (let i = 0; i < 55; i++) {
        act(() => {
          result.current.addRecommendationFeedback({
            recommendationId: `rec_${i}`,
            liked: i % 2 === 0,
            timestamp: Date.now(),
          })
        })
      }

      expect(result.current.recommendationFeedback.length).toBe(50)
    })
  })

  describe('getPersonalizedRecommendations', () => {
    it('returns empty array when no history', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      const recommendations = result.current.getPersonalizedRecommendations()

      expect(recommendations).toEqual([])
    })

    it('returns recent history when no liked items', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      const recommendations = result.current.getPersonalizedRecommendations()

      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('prioritizes liked items', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫', '抗氧化'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
          liked: false,
        })
      })

      act(() => {
        result.current.addGenerationHistory({
          effects: ['降血压'],
          ingredients: ['黄芪'],
          scores: { synergy: 0.9, taste: 0.8, stability: 0.85, overall: 0.85 },
          generator: 'neural',
          liked: true,
        })
      })

      const recommendations = result.current.getPersonalizedRecommendations()

      expect(recommendations[0].liked).toBe(true)
    })

    it('scores based on effect match', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫', '抗氧化'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.8 },
          generator: 'rule',
          liked: true,
        })
      })

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['黄芪'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      const recommendations = result.current.getPersonalizedRecommendations()

      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('getFrequentEffects', () => {
    it('returns frequent effects', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫', '抗氧化'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      const effects = result.current.getFrequentEffects()

      expect(effects).toContain('增强免疫')
      expect(effects).toContain('抗氧化')
    })
  })

  describe('getFavoriteIngredients', () => {
    it('returns favorite ingredients', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞', '黄芪', '党参'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      const ingredients = result.current.getFavoriteIngredients()

      expect(ingredients.length).toBeGreaterThan(0)
    })
  })

  describe('getTasteProfile', () => {
    it('returns taste profile', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      const profile = result.current.getTasteProfile()

      expect(profile).toHaveProperty('sweetness')
      expect(profile).toHaveProperty('bitterness')
      expect(profile).toHaveProperty('astringency')
      expect(profile).toHaveProperty('umami')
    })
  })

  describe('clearHistory', () => {
    it('clears all history and resets preferences', () => {
      const { result } = renderHook(() => useUserPreferenceStore())

      act(() => {
        result.current.addGenerationHistory({
          effects: ['增强免疫'],
          ingredients: ['枸杞'],
          scores: { synergy: 0.8, taste: 0.7, stability: 0.75, overall: 0.75 },
          generator: 'rule',
        })
      })

      act(() => {
        result.current.updatePreferences({
          frequentEffects: ['增强免疫'],
        })
      })

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.generationHistory).toEqual([])
      expect(result.current.preferences.frequentEffects).toEqual([])
    })
  })
})
