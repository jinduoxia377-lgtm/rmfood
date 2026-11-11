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
  /** 后端返回的专业专有名称（如「药食同源目录（2024版·106种）」），未返回时前端自行兜底 */
  display_name?: string;
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
  /** 后端下发的专业专有名称（如「《本草纲目》（明·李时珍）」），缺失时前端用 getSourceDisplayName 兜底 */
  display_name?: string;
  /** 文档分类：seed（平台种子）/ ancient_book（本草古籍）/ upload（用户上传） */
  category?: 'seed' | 'ancient_book' | 'upload';
  /** 仅古籍有值：朝代 */
  dynasty?: string | null;
  /** 仅古籍有值：作者 */
  author?: string | null;
  /** 平台种子/本草古籍为 true —— 公共知识，租户不可删除 */
  is_protected?: boolean;
  /** 最近更新时间（古籍取书目表 updated_at，其余取最新版本 created_at） */
  updated_at?: string | null;
  /** 最新版本文件大小（字节），无版本记录时为 null */
  size_bytes?: number | null;
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
  /** 后端返回的专业专有名称（如「药食同源目录（2024版·106种）」），未返回时前端自行兜底 */
  display_name?: string;
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

/**
 * react-query 的 queryFn 上下文形状。
 * `useQuery({ queryFn: listDocuments })` 会把该上下文作为第一个实参传入；
 * 它不是查询参数，listDocuments 在运行时需识别并忽略。
 * （仅为保持既有 `queryFn: listDocuments` 调用向后兼容。）
 */
interface RAGQueryFunctionContextLike {
  queryKey?: unknown;
  signal?: unknown;
  client?: unknown;
  meta?: unknown;
}

/** 入参是否为真正的文档查询参数（而非 react-query QueryFunctionContext） */
function isDocumentQueryParam(
  value: RAGDocumentQuery | RAGQueryFunctionContextLike | undefined,
): value is RAGDocumentQuery {
  if (!value || typeof value !== 'object') return false;
  return !('queryKey' in value || 'client' in value || 'signal' in value);
}

/** 获取知识库中文档列表（后端返回对象数组，含版本/分块信息）。
 *
 * 可选查询参数 `q` / `category` / `sort` / `page` / `page_size` 由后端过滤分页；
 * 不传参数时行为与旧版完全一致（返回全部文档）。
 * 同时兼容 `useQuery({ queryFn: listDocuments })` 的旧写法：react-query 传入的
 * QueryFunctionContext 会被识别并忽略，不会误当查询参数发给后端。
 */
export async function listDocuments(
  params?: RAGDocumentQuery | RAGQueryFunctionContextLike,
): Promise<RAGDocument[]> {
  const query = isDocumentQueryParam(params) ? params : undefined;
  // 不传参数时不带 config，保持旧调用（含既有测试的断言）行为不变
  const response = query
    ? await api.get<{ documents: RAGDocument[] }>('/rag/documents', { params: query })
    : await api.get<{ documents: RAGDocument[] }>('/rag/documents');
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
 * @param signal 可选 AbortSignal（P1-11：调用方超时/卸载时中止底层请求，防止迟到结果写状态）
 */
export async function queryRAG(question: string, topK: number = 5, signal?: AbortSignal): Promise<RAGQueryResponse> {
  return withRetry(
    async () => {
      const response = await api.post<RAGQueryResponse>('/rag/query', null, {
        params: { question, top_k: topK },
        timeout: RAG_QUERY_TIMEOUT,
        signal,
      });
      return response.data;
    },
    { maxRetries: RAG_MAX_RETRIES, baseDelayMs: RAG_RETRY_BASE_DELAY, label: 'queryRAG' },
  );
}

/**
 * 检索知识块（用于检索测试）。后端返回 { success, data: { chunks } }，这里解包并归一化字段。
 * @param signal 可选 AbortSignal（P1-11：调用方超时/卸载时中止底层请求）
 */
export async function searchChunks(query: string, topK: number = 5, signal?: AbortSignal): Promise<SearchChunkResult[]> {
  const response = await api.post<{
    success: boolean;
    data: {
      chunks: Array<{ content: string; source: string; score: number; section?: string; display_name?: string }>;
    };
  }>('/rag/search', null, {
    params: { question: query, top_k: topK },
    timeout: RAG_SEARCH_TIMEOUT,
    signal,
  });
  const chunks = response.data?.data?.chunks ?? [];
  return chunks.map((c) => ({
    content: c.content,
    doc_filename: c.source,
    similarity: c.score,
    section: c.section,
    display_name: c.display_name,
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

/* ═══════════════════════════════════════════════════════════════════════
 * 本草古籍书目（PostgreSQL 表 rag_knowledge_sources，只读接口）
 *
 * 与 ChromaDB 向量块互补：这里是「书目元数据」的唯一权威来源，
 * 前端「古籍书目」标签页直接消费下面 3 个接口（42 部本草古籍）。
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * 书目元数据（JSONB 列 `metadata`）。
 * 后端写入的字段：original_file（原始文件）/ md_file（清洗后 Markdown）/
 * lines（行数）/ estimated_chunks（预估块数）；其余键透传保留。
 */
export interface KnowledgeSourceMetadata {
  original_file?: string
  md_file?: string
  lines?: number
  estimated_chunks?: number
  [key: string]: unknown
}

/**
 * 单部古籍书目。
 * `metadata` 在前端只读展示，故用可选精确字段 + 索引签名承载后端透传键。
 */
export interface KnowledgeSource {
  id: number
  /** 向量库 source（如 ancient/本草纲目-明-李时珍.md） */
  source: string
  title: string
  /** 朝代（可空） */
  dynasty: string | null
  /** 作者（可空） */
  author: string | null
  /** ancient_book / seed / upload */
  category: string
  /** 展示名（如《本草纲目》（明·李时珍）），可空时前端回退 title */
  display_name: string | null
  chunk_count: number
  char_count: number
  /** sha256 前 32 位，可空 */
  checksum: string | null
  user_id: string
  metadata: KnowledgeSourceMetadata | null
  imported_at: string
  created_at: string
  updated_at: string
}

/** 后端支持的排序方式（默认 dynasty_asc） */
export type KnowledgeSourceSort = 'dynasty_asc' | 'chunk_desc' | 'title_asc' | 'imported_desc'

/** GET /rag/knowledge-sources 分页响应 */
export interface KnowledgeSourceListResponse {
  items: KnowledgeSource[]
  total: number
  page: number
  page_size: number
}

/** GET /rag/knowledge-sources/stats 汇总统计 */
export interface KnowledgeSourceStats {
  total_books: number
  total_chunks: number
  total_chars: number
  by_dynasty: Array<{ dynasty: string | null; count: number; chunks: number }>
  by_category: Array<{ category: string | null; count: number; chunks: number }>
}

/** 书目列表查询参数（category/dynasty 精确匹配，author/q 模糊匹配） */
export interface KnowledgeSourceQuery {
  category?: string
  dynasty?: string
  author?: string
  q?: string
  page?: number
  page_size?: number
  sort?: KnowledgeSourceSort
}

/** 分页查询本草古籍书目（公共知识，不按租户过滤） */
export async function listKnowledgeSources(params?: KnowledgeSourceQuery): Promise<KnowledgeSourceListResponse> {
  const response = await api.get<KnowledgeSourceListResponse>('/rag/knowledge-sources', { params });
  return response.data;
}

/** 本草古籍汇总统计（总量 + 按朝代/分类分布，用于筛选 chips 与统计卡） */
export async function getKnowledgeSourceStats(): Promise<KnowledgeSourceStats> {
  const response = await api.get<KnowledgeSourceStats>('/rag/knowledge-sources/stats');
  return response.data;
}

/** 按主键查询单部古籍书目（不存在时后端返回 404） */
export async function getKnowledgeSource(id: number): Promise<KnowledgeSource> {
  const response = await api.get<KnowledgeSource>(`/rag/knowledge-sources/${id}`);
  return response.data;
}

/* ═══════════════════════════════════════════════════════════════════════
 * 文档管理视图（DocumentListView）
 *
 * 后端 `GET /rag/documents` 向后兼容：不传参时仍只返回 documents；
 * 传参（q/category/sort/page/page_size）时额外返回 summary/total/page/page_size。
 * 以下类型/函数只做「追加」，不改动上方既有行为。
 * ═══════════════════════════════════════════════════════════════════════ */

/** 文档分类：平台种子 / 本草古籍 / 用户上传 */
export type RAGDocumentCategory = 'seed' | 'ancient_book' | 'upload';

/** 文档排序：名称升序 / 块数降序 / 最近更新 */
export type RAGDocumentSort = 'name' | 'chunks_desc' | 'updated_desc';

/**
 * 全库口径的文档分类统计（不受 q/category 过滤影响）。
 * `total_chunks` 以后端向量库真实可见块数为准。
 */
export interface RAGDocumentsSummary {
  seed: number;
  ancient_book: number;
  upload: number;
  total_chunks: number;
}

/** `GET /rag/documents` 完整响应（page_size=0 时不返回 total/page/page_size） */
export interface RAGDocumentsResponse {
  documents: RAGDocument[];
  summary?: RAGDocumentsSummary;
  total?: number;
  page?: number;
  page_size?: number;
}

/** 文档列表查询参数（page_size=0 表示不分页，返回全部） */
export interface RAGDocumentQuery {
  q?: string;
  category?: RAGDocumentCategory;
  sort?: RAGDocumentSort;
  page?: number;
  page_size?: number;
}

/**
 * 获取文档列表 + 分类统计（完整响应）。
 * 与 `listDocuments` 的区别：返回 `summary/total/page/page_size` 供统计条与分页使用。
 */
export async function listDocumentsWithSummary(
  params?: RAGDocumentQuery,
): Promise<RAGDocumentsResponse> {
  const response = params
    ? await api.get<RAGDocumentsResponse>('/rag/documents', { params })
    : await api.get<RAGDocumentsResponse>('/rag/documents');
  return response.data;
}

/**
 * 单个文档版本历史（后端 `GET /rag/documents/{filename}/versions`）。
 * 实际返回字段为 `chunks`（不是 chunk_count）；为兼容可能的字段差异，
 * 归一化时同时接受 `chunks` 与 `chunk_count`。
 */
export interface RAGDocumentVersion {
  version: number;
  /** 该版本的块数 */
  chunks: number;
  /** 该版本文件大小（字节），可能为空 */
  file_size?: number | null;
  /** 版本创建时间（ISO 字符串） */
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

/** 后端 versions 数组的原始形状（字段可能缺失/命名不同） */
interface RawRAGDocumentVersion {
  version: number;
  chunks?: number;
  chunk_count?: number;
  file_size?: number | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * 查询指定文档的全部版本历史（需登录，按当前租户过滤）。
 * 文档不存在时后端返回 404，此处抛错由调用方降级展示。
 */
export async function listDocumentVersions(filename: string): Promise<RAGDocumentVersion[]> {
  const response = await api.get<{ filename: string; versions: RawRAGDocumentVersion[] }>(
    `/rag/documents/${encodeURIComponent(filename)}/versions`,
  );
  const versions = response.data?.versions ?? [];
  return versions.map((item) => ({
    version: item.version,
    chunks: item.chunks ?? item.chunk_count ?? 0,
    file_size: item.file_size ?? null,
    created_at: item.created_at,
    metadata: item.metadata ?? null,
  }));
}
