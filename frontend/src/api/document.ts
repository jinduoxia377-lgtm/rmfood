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
  /** OCR 表格解析出的检验明细（COA 扫描件，中英文分离） */
  inspection_items?: Array<{
    item: string
    item_en?: string
    standard: string
    standard_en?: string
    result: string
    result_en?: string
    judgment: string
    judgment_en?: string
  }>
  metadata: {
    ingredient_id: number | null
    extracted_at: string
    total_fields_expected: number
    total_fields_found: number
  }
}

/** 备案保存请求体 */
export interface ArchiveSavePayload {
  document_type: DocumentType
  ingredient_id?: number | null
  extracted_fields: Record<string, ExtractedField>
  confidence_scores: Record<string, number>
  inspection_items?: Array<{
    item: string
    item_en?: string
    standard: string
    standard_en?: string
    result: string
    result_en?: string
    judgment: string
    judgment_en?: string
  }>
  overall_confidence: number
  requires_review: boolean
  raw_text_preview?: string
  source_file_name?: string
  source_hash?: string
}

/** 备案记录条目（列表/详情） */
export interface ArchiveRecord {
  id: number
  document_type: DocumentType
  ingredient_id: number | null
  product_name?: string | null
  overall_confidence: number
  requires_review: boolean
  field_count: number
  inspection_count?: number
  source_file_name: string | null
  created_by: number | null
  created_at: string | null
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

/** 文档提取备案 API（持久化提取结果，实现备案与调用） */
export const documentArchiveApi = {
  /** 保存提取结果（备案） */
  save: (payload: ArchiveSavePayload) =>
    api.post('/api/v1/documents/extractions', payload),

  /** 查询备案列表 */
  list: (params?: { document_type?: string; ingredient_id?: number; skip?: number; limit?: number }) =>
    api.get('/api/v1/documents/extractions', { params }),

  /** 查询备案详情 */
  detail: (id: number) =>
    api.get(`/api/v1/documents/extractions/${id}`),

  /** 删除备案记录 */
  remove: (id: number) =>
    api.delete(`/api/v1/documents/extractions/${id}`),

  /** 更新备案记录（人工复核后修正字段值） */
  update: (id: number, payload: Partial<ArchiveSavePayload> & { overall_confidence?: number; requires_review?: boolean }) =>
    api.put(`/api/v1/documents/extractions/${id}`, payload),

  /** 将备案记录生成为食源性多肽质检档案（PeptideBatchCOA） */
  toPeptideCoa: (id: number) =>
    api.post(`/api/v1/documents/extractions/${id}/to-peptide-coa`),
}
