/**
 * Document Extractor API Client
 * 对接 /api/v1/documents/* 端点
 */
import api from '@/api/client'

export type DocumentType = 'coa' | 'pds' | 'sd'

export interface ExtractedField {
  value: string
  label: string
  confidence: number
}

export interface ExtractionResult {
  document_type: DocumentType
  extracted_fields: Record<string, ExtractedField>
  confidence_scores: Record<string, number>
  requires_review: boolean
  overall_confidence: number
  raw_text_preview: string
  metadata: {
    ingredient_id: number | null
    extracted_at: string
    total_fields_expected: number
    total_fields_found: number
  }
}

export const documentApi = {
  extractText: (text: string, docType: DocumentType = 'coa', ingredientId?: number) =>
    api.post('/api/v1/documents/extract/text', {
      text,
      document_type: docType,
      ingredient_id: ingredientId ?? null,
    }),

  getSchemas: () =>
    api.get('/api/v1/documents/schemas'),

  health: () => api.get('/api/v1/documents/health'),
}
