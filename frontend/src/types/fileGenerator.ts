// 文件生成服务类型定义
export enum FileFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  MARKDOWN = 'markdown'
}

export interface FileGenerationRequest {
  content: any
  format: FileFormat
  filename: string
  template?: string
}

export interface TaskStatus {
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

export interface MarkdownConversionRequest {
  markdown: string
  template?: string
}

export interface TemplateInfo {
  name: string
  description: string
  structure: string[]
  styles: any
}

export interface FileDownloadOptions {
  taskId: string
  filename: string
}

export interface FilePreviewOptions {
  taskId: string
  format: FileFormat
}
