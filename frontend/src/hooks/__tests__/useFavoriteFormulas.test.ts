import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useFavoriteFormulas from '../useFavoriteFormulas'

const mockCandidate = {
  id: 'test_formula_1',
  name: '测试配方',
  formula_name: '测试配方',
  score: 0.85,
  synergy_score: 0.80,
  effects: ['增强免疫'],
  ingredients: [],
  herb_combination: [],
  peptide_candidates: [],
  patent_synergy_scores: {
    bliss_independence: 0.75,
    pk_interaction: 0.82,
    gibbs_stability: 0.78,
    network_pharmacology: 0.85,
    taste_matrix: 0.70,
    overall_si: 0.80,
    weighted_score: 85,
    dominant_mechanism: '免疫调节',
    quality_level: 'A',
    confidence: 0.92,
  },
  generated_by: 'rule_engine',
  generated_at: new Date().toISOString(),
}

describe('useFavoriteFormulas', () => {
  let getItemSpy: vi.SpyInstance
  let setItemSpy: vi.SpyInstance

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('[]')
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with empty favorites', () => {
    const { result } = renderHook(() => useFavoriteFormulas())
    
    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite('test')).toBe(false)
  })

  it('should add formula to favorites', () => {
    const { result } = renderHook(() => useFavoriteFormulas())
    
    act(() => {
      result.current.addToFavorites(mockCandidate)
    })
    
    expect(result.current.favorites.length).toBe(1)
    expect(result.current.favorites[0].id).toBe('test_formula_1')
    expect(result.current.isFavorite('test_formula_1')).toBe(true)
    expect(setItemSpy).toHaveBeenCalled()
  })

  it('should not add duplicate formula to favorites', () => {
    const favoritesData = JSON.stringify([{
      id: 'test_formula_1',
      candidate: mockCandidate,
      addedAt: Date.now(),
    }])
    getItemSpy.mockReturnValueOnce(favoritesData)
    
    const { result } = renderHook(() => useFavoriteFormulas())
    
    expect(result.current.favorites.length).toBe(1)
    
    act(() => {
      result.current.addToFavorites(mockCandidate)
    })
    
    expect(result.current.favorites.length).toBe(1)
  })

  it('should remove formula from favorites', () => {
    const favoritesData = JSON.stringify([{
      id: 'test_formula_1',
      candidate: mockCandidate,
      addedAt: Date.now(),
    }])
    getItemSpy.mockReturnValueOnce(favoritesData)
    
    const { result } = renderHook(() => useFavoriteFormulas())
    
    expect(result.current.favorites.length).toBe(1)
    
    act(() => {
      result.current.removeFromFavorites('test_formula_1')
    })
    
    expect(result.current.favorites.length).toBe(0)
    expect(result.current.isFavorite('test_formula_1')).toBe(false)
  })

  it('should clear all favorites', () => {
    const favoritesData = JSON.stringify([
      { id: 'test_1', candidate: mockCandidate, addedAt: Date.now() },
      { id: 'test_2', candidate: { ...mockCandidate, id: 'test_2' }, addedAt: Date.now() },
    ])
    getItemSpy.mockReturnValueOnce(favoritesData)
    
    const { result } = renderHook(() => useFavoriteFormulas())
    
    expect(result.current.favorites.length).toBe(2)
    
    act(() => {
      result.current.clearFavorites()
    })
    
    expect(result.current.favorites.length).toBe(0)
  })

  it('should update favorite notes', () => {
    const favoritesData = JSON.stringify([{
      id: 'test_formula_1',
      candidate: mockCandidate,
      addedAt: Date.now(),
      notes: '原始备注',
    }])
    getItemSpy.mockReturnValueOnce(favoritesData)
    
    const { result } = renderHook(() => useFavoriteFormulas())
    
    expect(result.current.favorites[0].notes).toBe('原始备注')
    
    act(() => {
      result.current.updateFavoriteNotes('test_formula_1', '更新后的备注')
    })
    
    expect(result.current.favorites[0].notes).toBe('更新后的备注')
  })
})