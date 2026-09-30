/**
 * 术语管理 API 服务
 * 封装所有术语相关的 API 调用
 */
import api from '@/api/client'

// ==================== 类型定义 ====================

export interface TermCategory {
  id: number
  name: string
  name_en?: string
  description?: string
  parent_id?: number | null
  level: number
  sort_order: number
  children?: TermCategory[]
  created_at?: string
  updated_at?: string
}

export interface TermCategoryCreate {
  name: string
  name_en?: string
  description?: string
  parent_id?: number | null
  level?: number
  sort_order?: number
}

export interface TermCategoryUpdate {
  name?: string
  name_en?: string
  description?: string
  parent_id?: number | null
  level?: number
  sort_order?: number
}

export interface Term {
  id: number
  term: string
  term_en?: string
  pinyin?: string
  pinyin_abbr?: string
  abbreviation?: string
  definition?: string
  definition_en?: string
  category_id: number
  subcategory?: string
  unit?: string
  examples?: string[]
  synonyms?: string[]
  related_terms?: string[]
  source?: string
  is_standard: boolean
  confidence?: number
  frequency?: number
  created_at?: string
  updated_at?: string
}

export interface TermCreate {
  term: string
  term_en?: string
  pinyin?: string
  pinyin_abbr?: string
  abbreviation?: string
  definition?: string
  definition_en?: string
  category_id: number
  subcategory?: string
  unit?: string
  examples?: string[]
  synonyms?: string[]
  related_terms?: string[]
  source?: string
  is_standard?: boolean
  confidence?: number
  frequency?: number
}

export interface TermUpdate {
  term?: string
  term_en?: string
  pinyin?: string
  pinyin_abbr?: string
  abbreviation?: string
  definition?: string
  definition_en?: string
  category_id?: number
  subcategory?: string
  unit?: string
  examples?: string[]
  synonyms?: string[]
  related_terms?: string[]
  source?: string
  is_standard?: boolean
  confidence?: number
  frequency?: number
}

export interface TermVariant {
  id: number
  variant: string
  term_id: number
  term?: string
  similarity: number
  variant_type: string
  created_at?: string
}

export interface TermVariantCreate {
  variant: string
  term_id: number
  similarity?: number
  variant_type?: string
}

export interface TermNormalizationRule {
  id: number
  pattern: string
  replacement: string
  rule_type: string
  priority: number
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface TermNormalizationRuleCreate {
  pattern: string
  replacement: string
  rule_type?: string
  priority?: number
  description?: string
  enabled?: boolean
}

export interface TermValidationRequest {
  term: string
  category_id?: number
  strict_mode?: boolean
}

export interface TermValidationResponse {
  is_valid: boolean
  corrected_term?: string
  suggestions?: string[]
  category_match?: boolean
  standard_match?: boolean
  confidence?: number
  error?: string
}

export interface BatchTermValidationRequest {
  terms: string[]
  category_id?: number
  strict_mode?: boolean
}

export interface TermSearchRequest {
  query: string
  category_id?: number
  fuzzy_search?: boolean
  max_results?: number
}

export interface TermSuggestionRequest {
  input: string
  limit?: number
  include_synonyms?: boolean
}

export interface TermSuggestionResponse {
  suggestions: { term: string; similarity: number; is_standard: boolean }[]
}

export interface TermStatistics {
  total_terms: number
  total_categories: number
  total_variants: number
  total_validations: number
  category_stats: { category_id: number; category_name: string; term_count: number }[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ==================== API 调用 ====================

const BASE_URL = '/api/v1/terminology'

// --- 分类 ---

export async function getCategories(): Promise<TermCategory[]> {
  const { data } = await api.get(`${BASE_URL}/categories`)
  return data.data || []
}

export async function getCategory(id: number): Promise<TermCategory> {
  const { data } = await api.get(`${BASE_URL}/categories/${id}`)
  return data.data
}

export async function createCategory(payload: TermCategoryCreate): Promise<TermCategory> {
  const { data } = await api.post(`${BASE_URL}/categories`, payload)
  return data.data
}

export async function updateCategory(id: number, payload: TermCategoryUpdate): Promise<TermCategory> {
  const { data } = await api.put(`${BASE_URL}/categories/${id}`, payload)
  return data.data
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/categories/${id}`)
}

// --- 术语 ---

export async function getTerms(params: {
  category_id?: number
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}): Promise<PaginatedResponse<Term>> {
  const { data } = await api.get(`${BASE_URL}/terms`, { params })
  return data.data
}

export async function getTerm(id: number): Promise<Term> {
  const { data } = await api.get(`${BASE_URL}/terms/${id}`)
  return data.data
}

export async function createTerm(payload: TermCreate): Promise<Term> {
  const { data } = await api.post(`${BASE_URL}/terms`, payload)
  return data.data
}

export async function updateTerm(id: number, payload: TermUpdate): Promise<Term> {
  const { data } = await api.put(`${BASE_URL}/terms/${id}`, payload)
  return data.data
}

export async function deleteTerm(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/terms/${id}`)
}

// --- 验证 ---

export async function validateTerm(payload: TermValidationRequest): Promise<TermValidationResponse> {
  const { data } = await api.post(`${BASE_URL}/validate`, payload)
  return data.data
}

export async function batchValidateTerms(payload: BatchTermValidationRequest): Promise<TermValidationResponse[]> {
  const { data } = await api.post(`${BASE_URL}/validate/batch`, payload)
  return data.data
}

// --- 搜索 ---

export async function searchTerms(params: {
  query: string
  category_id?: number
  fuzzy_search?: boolean
  max_results?: number
}): Promise<Term[]> {
  const { data } = await api.post(`${BASE_URL}/search`, params)
  return data.data
}

export async function searchTermsGet(params: {
  query: string
  category_id?: number
  fuzzy_search?: boolean
  max_results?: number
}): Promise<Term[]> {
  const { data } = await api.get(`${BASE_URL}/search`, { params })
  return data.data
}

// --- 建议 ---

export async function getSuggestions(payload: TermSuggestionRequest): Promise<TermSuggestionResponse> {
  const { data } = await api.post(`${BASE_URL}/suggest`, payload)
  return data.data
}

// --- 变体 ---

export async function getVariants(term_id?: number): Promise<TermVariant[]> {
  const params = term_id ? { term_id } : undefined
  const { data } = await api.get(`${BASE_URL}/variants`, { params })
  return data.data || []
}

export async function createVariant(payload: TermVariantCreate): Promise<TermVariant> {
  const { data } = await api.post(`${BASE_URL}/variants`, payload)
  return data.data
}

export async function deleteVariant(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/variants/${id}`)
}

// --- 标准化规则 ---

export async function getNormalizationRules(): Promise<TermNormalizationRule[]> {
  const { data } = await api.get(`${BASE_URL}/normalization-rules`)
  return data.data || []
}

export async function createNormalizationRule(payload: TermNormalizationRuleCreate): Promise<TermNormalizationRule> {
  const { data } = await api.post(`${BASE_URL}/normalization-rules`, payload)
  return data.data
}

export async function updateNormalizationRule(id: number, payload: TermNormalizationRuleCreate): Promise<TermNormalizationRule> {
  const { data } = await api.put(`${BASE_URL}/normalization-rules/${id}`, payload)
  return data.data
}

export async function deleteNormalizationRule(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/normalization-rules/${id}`)
}

// --- 统计 ---

export async function getStatistics(): Promise<TermStatistics> {
  const { data } = await api.get(`${BASE_URL}/statistics`)
  return data.data
}
