/**
 * RAG 知识库 API 客户端
 *
 * 提供文档上传、检索、统计等 API 调用。
 */

import api from '@/api/client';
import { logger } from '@/utils/safeLogger';
import type { AxiosProgressEvent } from 'axios';

/**
 * ── 超时与重试策略（API 韧性）────────────────────────────────────
 * 后端 RAG 检索/嵌入偶发慢查询：30s 的旧超时会让你「以为界面卡死」。
 * - 单次查询上限 12s（原 30s），失败即由上层降级，用户不等待。
 * - 首次失败后等 2s 重试一次（瞬时网关/慢查询常可自行恢复）。
 * - 重试仍失败才抛错，且各次重试延迟按 2 的幂指数退避（2s → 4s → …），
 *   避免立即重试放大瞬时故障（如把 502 放大成 502 风暴）。
 */
const RAG_QUERY_TIMEOUT = 12_000;
/** RAG 知识块检索超时（毫秒），与 query 对齐 */
const RAG_SEARCH_TIMEOUT = 12_000;
/** RAG 查询首次超时后的重试延迟基数（毫秒），后续按 2 的幂退避 */
const RAG_RETRY_BASE_DELAY = 2_000;
/** RAG 查询最大重试次数（不含首次调用） */
const RAG_MAX_RETRIES = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断错误是否为可重试的瞬时故障。
 * - 5xx（502/503/504 网关或上游错误）→ 可重试
 * - 超时 / 连接中断（axios ECONNABORTED 等）→ 可重试
 * - 4xx（含 401 未认证、403 权限）→ 确定性错误，重试无意义，快速失败
 */
function isRetryableError(err: unknown): boolean {
  const anyErr = err as {
    code?: string;
    response?: { status?: number };
  };
  const status = anyErr?.response?.status;
  if (status) return status >= 500;
  return (
    anyErr?.code === 'ECONNABORTED' ||
    anyErr?.code === 'ETIMEDOUT' ||
    anyErr?.code === 'ECONNRESET'
  );
}

/**
 * 带指数退避的重试执行器（零新依赖）。
 *
 * @param fn 要执行的异步操作
 * @param options.maxRetries 最大重试次数（不含首次调用）
 * @param options.baseDelayMs 首次重试前延迟，之后按 2 的幂递增
 * @param options.label 日志标签
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; label: string },
): Promise<T> {
  const maxRetries = options.maxRetries ?? RAG_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? RAG_RETRY_BASE_DELAY;
  let lastError: unknown = new Error(`[${options.label}] 操作失败`);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !isRetryableError(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      logger.debug(`[withRetry] ${options.label} 第 ${attempt + 1} 次失败，${delay}ms 后重试`, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

export interface DocumentInfo {
  id: string;
  filename: string;
  content_type: string;
  chunk_count: number;
  created_at: string;
  file_size: number;
}

export interface RAGChunkResult {
  content: string;
  source: string;
  score: number;
}

export interface RAGQueryResponse {
  chunks: RAGChunkResult[];
  augmented_prompt: string;
  total_chunks: number;
}

export interface RAGDocument {
  filename: string;
  latest_version: number;
  total_versions: number;
  chunks: number;
  created_at: string | null;
}

export interface RAGStats {
  total_chunks: number;
  documents?: string[];
  total_docs?: number;
  last_updated?: string;
  embedding_dim?: number;
  document_count?: number;
  total_versions?: number;
}

export interface SearchChunkResult {
  content: string;
  doc_filename: string;
  similarity: number;
  section?: string;
}

/**
 * 上传文档到知识库
 * @param file 要上传的文件
 * @param onProgress 上传进度回调 (0-100)
 */
export async function uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<DocumentInfo> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<DocumentInfo>('/rag/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
    timeout: 120000, // 文件上传可能需要更长时间
  });
  return response.data;
}

/** 获取知识库中文档列表（后端返回对象数组，含版本/分块信息） */
export async function listDocuments(): Promise<RAGDocument[]> {
  const response = await api.get<{ documents: RAGDocument[] }>('/rag/documents');
  return response.data.documents;
}

/** 从知识库删除文档 */
export async function deleteDocument(filename: string): Promise<void> {
  await api.delete(`/rag/documents/${encodeURIComponent(filename)}`);
}

/** 获取知识库统计 */
export async function getRAGStats(): Promise<RAGStats> {
  const response = await api.get<RAGStats>('/rag/stats');
  return response.data;
}

/**
 * 基于知识库内容进行 RAG 问答。
 * 单次超时 12s（原 30s），超时/5xx 后等 2s 重试一次，仍失败才抛错。
 */
export async function queryRAG(question: string, topK: number = 5): Promise<RAGQueryResponse> {
  return withRetry(
    async () => {
      const response = await api.post<RAGQueryResponse>('/rag/query', null, {
        params: { question, top_k: topK },
        timeout: RAG_QUERY_TIMEOUT,
      });
      return response.data;
    },
    { maxRetries: RAG_MAX_RETRIES, baseDelayMs: RAG_RETRY_BASE_DELAY, label: 'queryRAG' },
  );
}

/** 检索知识块（用于检索测试）。后端返回 { success, data: { chunks } }，这里解包并归一化字段。 */
export async function searchChunks(query: string, topK: number = 5): Promise<SearchChunkResult[]> {
  const response = await api.post<{
    success: boolean;
    data: {
      chunks: Array<{ content: string; source: string; score: number; section?: string }>;
    };
  }>('/rag/search', null, {
    params: { question: query, top_k: topK },
    timeout: RAG_SEARCH_TIMEOUT,
  });
  const chunks = response.data?.data?.chunks ?? [];
  return chunks.map((c) => ({
    content: c.content,
    doc_filename: c.source,
    similarity: c.score,
    section: c.section,
  }));
}

/** 注入内置知识库种子 */
export async function seedKnowledgeBase(): Promise<{ seeded: boolean; documents: number; total_chunks: number }> {
  const response = await api.post('/rag/seed');
  return response.data;
}

/** 查询种子注入状态 */
export async function getSeedStatus(): Promise<{ is_seeded: boolean; total_chunks: number; documents: string[] }> {
  const response = await api.get('/rag/seed/status');
  return response.data;
}
