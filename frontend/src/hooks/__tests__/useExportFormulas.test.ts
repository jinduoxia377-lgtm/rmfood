import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useExportFormulas from '../useExportFormulas'

const mockCandidates = [
  {
    id: 'test_formula_1',
    name: '测试配方1',
    formula_name: '测试配方1',
    score: 0.85,
    synergy_score: 0.80,
    effects: ['增强免疫', '抗疲劳'],
    ingredients: [
      { name: '黄芪', dosage: '10g', unit: 'g' },
      { name: '党参', dosage: '8g', unit: 'g' },
    ],
    herb_combination: [
      { name: '黄芪', dosage: '10g', role: '君药' },
      { name: '党参', dosage: '8g', role: '臣药' },
    ],
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
    taste_score: 0.75,
    stability_score: 0.88,
    overall_score: 0.85,
    safety_passed: true,
    generated_by: 'rule_engine',
    generated_at: '2024-01-01T12:00:00Z',
  },
  {
    id: 'test_formula_2',
    name: '测试配方2',
    formula_name: '测试配方2',
    score: 0.90,
    synergy_score: 0.85,
    effects: ['补气养血'],
    ingredients: [
      { name: '人参', dosage: '6g', unit: 'g' },
    ],
    herb_combination: [
      { name: '人参', dosage: '6g', role: '君药' },
    ],
    peptide_candidates: [],
    patent_synergy_scores: {
      bliss_independence: 0.80,
      pk_interaction: 0.85,
      gibbs_stability: 0.82,
      network_pharmacology: 0.88,
      taste_matrix: 0.65,
      overall_si: 0.84,
      weighted_score: 88,
      dominant_mechanism: '气血双补',
      quality_level: 'A',
      confidence: 0.95,
    },
    taste_score: 0.70,
    stability_score: 0.90,
    overall_score: 0.88,
    safety_passed: true,
    generated_by: 'rule_engine',
    generated_at: '2024-01-02T12:00:00Z',
  },
]

describe('useExportFormulas', () => {
  let appendChildSpy: vi.SpyInstance
  let removeChildSpy: vi.SpyInstance

  beforeEach(() => {
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation()
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation()
    vi.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export to JSON with default options', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToJSON(mockCandidates)
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
  })

  it('should export to JSON with custom filename', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToJSON(mockCandidates, { filename: 'custom_export.json' })
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
  })

  it('should export to JSON without details', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToJSON(mockCandidates, { includeDetails: false })
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
  })

  it('should export to CSV', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToCSV(mockCandidates)
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
  })

  it('should export to CSV with custom filename', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToCSV(mockCandidates, { filename: 'custom_export.csv' })
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
  })

  it('should export formulas using exportFormulas wrapper', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportFormulas(mockCandidates, 'json')
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
  })

  it('should not export when no formulas provided', () => {
    const { result } = renderHook(() => useExportFormulas())
    
    appendChildSpy.mockClear()
    
    act(() => {
      result.current.exportFormulas([], 'json')
    })
    
    expect(appendChildSpy).not.toHaveBeenCalled()
  })

  it('should handle CSV escape for special characters', () => {
    const candidatesWithSpecialChars = [
      {
        ...mockCandidates[0],
        name: '测试,配方',
      },
    ]
    
    const { result } = renderHook(() => useExportFormulas())
    
    act(() => {
      result.current.exportToCSV(candidatesWithSpecialChars)
    })
    
    expect(appendChildSpy).toHaveBeenCalled()
  })
})