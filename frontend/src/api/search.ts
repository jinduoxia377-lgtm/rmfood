/**
 * 全局搜索 API
 */
import api from './client'

export interface SearchResult {
  id: number
  title: string
  subtitle: string
  status: string
  type: 'formula' | 'experiment' | 'herb' | 'peptide'
}

export interface GlobalSearchResponse {
  query: string
  total: number
  results: {
    formulas?: SearchResult[]
    experiments?: SearchResult[]
    herbs?: SearchResult[]
    peptides?: SearchResult[]
  }
}

export interface SearchSuggestion {
  id: number
  text: string
  hint: string
  type: 'formula' | 'experiment' | 'herb'
}

export const searchApi = {
  global: (q: string, types?: string, limit = 10) =>
    api
      .get<GlobalSearchResponse>('/search/global', { params: { q, types, limit } })
      .then((r) => r.data),

  suggest: (q: string, limit = 8) =>
    api
      .get<{ suggestions: SearchSuggestion[] }>('/search/suggest', { params: { q, limit } })
      .then((r) => r.data),
}
