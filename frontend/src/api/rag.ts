/**
 * RAG 知识库 API 客户端
 *
 * 提供文档上传、检索、统计等 API 调用。
 */

import api from '@/api/client'
import type { AxiosProgressEvent } from 'axios'

export interface DocumentInfo {
  id: string
  filename: string
  content_type: string
  chunk_count: number
  created_at: string
  file_size: number
}

export interface RAGChunkResult {
  content: string
  source: string
  score: number
}

export interface RAGQueryResponse {
  chunks: RAGChunkResult[]
  augmented_prompt: string
  total_chunks: number
}

export interface RAGStats {
  total_chunks: number
  documents: string[]
}

/**
 * 上传文档到知识库
 * @param file 要上传的文件
 * @param onProgress 上传进度回调 (0-100)
 */
export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<DocumentInfo> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<DocumentInfo>('/rag/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
    timeout: 120000, // 文件上传可能需要更长时间
  })
  return response.data
}

/** 获取知识库中文档列表 */
export async function listDocuments(): Promise<string[]> {
  const response = await api.get<{ documents: string[] }>('/rag/documents')
  return response.data.documents
}

/** 从知识库删除文档 */
export async function deleteDocument(filename: string): Promise<void> {
  await api.delete(`/rag/documents/${encodeURIComponent(filename)}`)
}

/** 获取知识库统计 */
export async function getRAGStats(): Promise<RAGStats> {
  const response = await api.get<RAGStats>('/rag/stats')
  return response.data
}

/** 基于知识库内容进行 RAG 问答 */
export async function queryRAG(
  question: string,
  topK: number = 5,
): Promise<RAGQueryResponse> {
  const response = await api.post<RAGQueryResponse>('/rag/query', null, {
    params: { question, top_k: topK },
    timeout: 30000,
  })
  return response.data
}
