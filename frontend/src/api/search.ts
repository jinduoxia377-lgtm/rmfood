/**
 * 全局搜索 API
 */
import api from './client'

export interface SearchResult {
  id: number
  title: string
  description?: string
  subtitle?: string
  url?: string
  score?: number
  type: string
  status?: string
  metadata?: Record<string, unknown>
  created_at?: string
  highlights?: Record<string, string>
}

export interface SearchTypeResponse {
  items: SearchResult[]
  total: number
  page: number
  page_size: number
  total_pages: number
  query_time_ms: number
  suggestions: unknown[]
  facets: Record<string, unknown>
}

export interface GlobalSearchResponse {
  keyword: string
  query?: string
  total?: number
  types: {
    formula?: SearchTypeResponse
    experiment?: SearchTypeResponse
    herb?: SearchTypeResponse
    peptide?: SearchTypeResponse
  }
  // 向后兼容：CommandPalette 等组件使用旧格式
  results?: {
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
