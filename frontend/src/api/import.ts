/**
 * 数据导入 API
 * 文件上传、预览、执行导入、进度追踪、错误日志
 */
import api from './client'

// ── Types ────────────────────────────────────────────────────────

export interface FieldMappingConfig {
  source: string
  target: string
  required?: boolean
  default?: unknown
  transform?: string
}

export interface ImportTaskSummary {
  task_id: string
  adapter_type: string
  target_table: string
  status: string
  total_rows: number
  processed_rows: number
  inserted_rows: number
  updated_rows: number
  error_rows: number
  progress_pct: number
  success_rate: number
  file_name?: string
  created_at: string
  updated_at: string
}

export interface ImportTaskDetail extends ImportTaskSummary {
  error_summary: string
  file_size_bytes?: number
  mapping_config?: Record<string, unknown>
}

export interface ImportErrorItem {
  row: number
  raw_data: string
  error: string
  type: string
}

export interface ImportReportResponse {
  task_id: string
  status: string
  stats: Record<string, unknown>
  duration_seconds: number
  message: string
}

export interface UploadResponse {
  task_id: string
  file_name: string
  file_size_bytes: number
  status: string
  message: string
}

// ── API ──────────────────────────────────────────────────────────

export const importApi = {
  /** 上传文件并创建导入任务 */
  uploadFile: async (file: File, fileType: string, delimiter: string): Promise<UploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('file_type', fileType)
    formData.append('delimiter', delimiter)
    return api.post('/imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /** 预览数据 */
  preview: async (taskId: string, limit: number, delimiter: string, dataType: string): Promise<{ total_rows: number; preview: Record<string, unknown>[] }> => {
    return api.post(`/imports/${taskId}/preview?limit=${limit}&delimiter=${encodeURIComponent(delimiter)}&file_type=${dataType}`).then(r => r.data)
  },

  /** 执行导入 */
  runImport: async (taskId: string, targetTable: string, idField: string, mappings: FieldMappingConfig[]): Promise<ImportReportResponse> => {
    return api.post(`/imports/${taskId}/run`, {
      target_table: targetTable,
      id_field: idField,
      mappings,
    }).then(r => r.data)
  },

  /** 列出所有导入任务 */
  listTasks: async (status?: string, page = 1, pageSize = 20): Promise<{ tasks: ImportTaskSummary[]; total: number }> => {
    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (status) params.status = status
    return api.get('/imports', { params }).then(r => r.data)
  },

  /** 获取任务详情 */
  getTaskDetail: async (taskId: string): Promise<ImportTaskDetail> => {
    return api.get(`/imports/${taskId}`).then(r => r.data)
  },

  /** 取消/删除任务 */
  cancelTask: async (taskId: string): Promise<{ task_id: string; status: string; message: string }> => {
    return api.delete(`/imports/${taskId}`).then(r => r.data)
  },

  /** 获取错误日志 */
  getErrors: async (taskId: string, page = 1, pageSize = 50, errorType?: string): Promise<{ errors: ImportErrorItem[]; total: number; page: number; page_size: number }> => {
    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (errorType) params.error_type = errorType
    return api.get(`/imports/${taskId}/errors`, { params }).then(r => r.data)
  },
}
