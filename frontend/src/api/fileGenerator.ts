// 文件生成服务API客户端
import { FileFormat } from '@/types/fileGenerator'
import { envConfig } from '@/config/env'
import { createError, parseError } from '@/utils/errorHandler'
import { ERROR_CODES } from '@/constants/errorCodes'

const API_BASE = envConfig.env === 'development'
  ? envConfig.api.baseUrl
  : `${window.location.origin}/api/v1`

interface FileGenerationRequest {
  content: any
  format: FileFormat
  filename: string
  template?: string
}

interface TaskStatus {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  file_path?: string
  file_name?: string
  file_size?: number
  error_message?: string
  created_at: string
  completed_at?: string
}

interface MarkdownConversionRequest {
  markdown: string
  template?: string
}

interface TemplateListResponse {
  templates: {
    name: string
    description: string
  }[]
}

export const fileGeneratorApi = {
  // 生成文件（同步）
  generateFile: async (request: FileGenerationRequest): Promise<{ file_path: string; file_name: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-generator/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw createError(ERROR_CODES.API_REQUEST_FAILED, { message: error.message, details: { originalError: error } })
      }

      return await response.json()
    } catch (err) {
      throw parseError(err, ERROR_CODES.BUSINESS_EXPORT_FAILED)
    }
  },

  // 生成文件（异步）
  generateFileAsync: async (request: FileGenerationRequest): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-generator/generate-async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw createError(ERROR_CODES.API_REQUEST_FAILED, { message: error.message, details: { originalError: error } })
      }

      const result = await response.json()
      return result.task_id
    } catch (err) {
      throw parseError(err, ERROR_CODES.BUSINESS_EXPORT_FAILED)
    }
  },

  // 获取任务状态
  getTaskStatus: async (taskId: string): Promise<TaskStatus> => {
    const response = await fetch(`${API_BASE}/api/file-generator/task/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || '获取任务状态失败')
    }

    return await response.json()
  },

  // 下载文件
  downloadFile: async (taskId: string): Promise<Blob> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-generator/download/${taskId}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw createError(ERROR_CODES.API_REQUEST_FAILED, { message: error.message, details: { originalError: error } })
      }

      return await response.blob()
    } catch (err) {
      throw parseError(err, ERROR_CODES.BUSINESS_EXPORT_FAILED)
    }
  },

  // 转换Markdown
  convertMarkdown: async (request: MarkdownConversionRequest): Promise<any> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-generator/convert-markdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw createError(ERROR_CODES.API_REQUEST_FAILED, { message: error.message, details: { originalError: error } })
      }

      return await response.json()
    } catch (err) {
      throw parseError(err, ERROR_CODES.API_PARSE_ERROR)
    }
  },

  // 获取可用模板列表
  getTemplates: async (): Promise<TemplateListResponse> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-generator/templates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw createError(ERROR_CODES.API_REQUEST_FAILED, { message: error.message, details: { originalError: error } })
      }

      return await response.json()
    } catch (err) {
      throw parseError(err, ERROR_CODES.API_REQUEST_FAILED)
    }
  },

  // 从模板生成文件
  generateFromTemplate: async (templateName: string, data: any, format: FileFormat, filename: string): Promise<{ file_path: string; file_name: string }> => {
    const response = await fetch(`${API_BASE}/api/file-generator/generate-from-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: templateName,
        data,
        format,
        filename,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || '模板生成失败')
    }

    return await response.json()
  },
}
