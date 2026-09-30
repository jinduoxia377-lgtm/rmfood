/**
 * Label Generator API Client
 * 对接 /labels/* 端点（axios baseURL 已含 /api/v1，路径不带前缀）
 */
import api from '@/api/client'

export type EntityType = 'batch' | 'sample' | 'ingredient' | 'equipment'
export type LabelFormat = 'code128' | 'qr' | 'both'
export type LabelSize = 'small' | 'medium' | 'large'
export type OutputFormat = 'png' | 'svg'

export interface GenerateLabelRequest {
  entity_type: EntityType
  entity_id: number
  entity_name: string
  label_size?: LabelSize
  format?: LabelFormat
  output_format?: OutputFormat
}

export interface PreviewLabelParams {
  entity_type: EntityType
  entity_id: number
  entity_name: string
  label_size?: LabelSize
  format?: LabelFormat
}

export interface PreviewLabelResponse {
  data_url: string
  mime_type: string
  width_px: number
  height_px: number
  qr_size_px: number
  entity_type: EntityType
  entity_id: number
  entity_name: string
  format: LabelFormat
}

export const labelApi = {
  generate: (data: GenerateLabelRequest): Promise<Blob> => {
    return api.post(`/labels/generate`, data, {
      responseType: 'blob' as const,
    })
  },

  preview: async (params: PreviewLabelParams): Promise<PreviewLabelResponse> => {
    const qs = new URLSearchParams()
    qs.set('entity_type', params.entity_type)
    qs.set('entity_id', String(params.entity_id))
    qs.set('entity_name', params.entity_name)
    if (params.label_size) qs.set('label_size', params.label_size)
    if (params.format) qs.set('format', params.format)
    const res = await api.get<{ status: string; data: PreviewLabelResponse }>(
      `/labels/preview?${qs.toString()}`,
    )
    return res.data.data
  },

  getSizes: () => api.get('/labels/sizes'),

  health: () => api.get('/labels/health'),
}
