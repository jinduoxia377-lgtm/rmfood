/**
 * 附件 API
 */
import api from './client'

export interface Attachment {
  id: number
  file_name: string
  file_size: number
  mime_type: string | null
  uploaded_by: number
  created_at: string
}

export const attachmentApi = {
  list: (params: { formula_id?: number; experiment_id?: number }) =>
    api.get<Attachment[]>('/attachments', { params }).then((r) => r.data),

  upload: (file: File, params: { formula_id?: number; experiment_id?: number }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (params.formula_id) formData.append('formula_id', String(params.formula_id))
    if (params.experiment_id) formData.append('experiment_id', String(params.experiment_id))
    return api.post<Attachment>('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  delete: (id: number) =>
    api.delete(`/attachments/${id}`),
}
