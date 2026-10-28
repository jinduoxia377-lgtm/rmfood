"""
⚠️ DEPRECATED - 请使用 app/services/ai/rag/rag_service.py（线上版）

这是 M2.1 hex 架构时期遗留的 RAG 服务副本，与线上版并存。
- 线上版：app/services/ai/rag/rag_service.py（ChromaDB + 真实 Embedding + BM25/RRF 混合检索）
- 本文件当前仅被单元测试引用：backend/tests/unit/infrastructure/test_rag.py
- 新增功能请勿基于本文件实现；建议后续将相关测试迁移到线上版后删除本文件。

RAG 检索增强生成服务（M2.1）

编排完整的 RAG 流程：文档索引 → 嵌入 → 检索 → 上下文组装
"""
from __future__ import annotations

import logging

from ..domain.rag import (
    DocumentChunk,
    RAGContext,
    RetrievalQuery,
)
from ..domain.rag_ports import DocumentProcessor, EmbeddingService, VectorStore

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAG 检索增强生成服务

    职责：
    1. 文档索引：将文档分割、嵌入并存储到向量库
    2. 语义检索：根据查询检索最相关的文档块
    3. 上下文组装：将检索结果格式化为 LLM 上下文
    """

    def __init__(
        self,
        vector_store: VectorStore,
        embedding_service: EmbeddingService,
        document_processor: DocumentProcessor,
    ):
        self._vector_store = vector_store
        self._embedding_service = embedding_service
        self._document_processor = document_processor

    # ─── 索引 ───

    async def index_text(
        self,
        text: str,
        source: str,
        source_type: str,
        metadata: dict = None,
    ) -> int:
        """索引一段文本"""
        chunks = await self._document_processor.process_text(
            text, source, source_type, metadata
        )
        return await self._index_chunks(chunks)

    async def index_file(self, file_path: str, source_type: str) -> int:
        """索引一个文件"""
        chunks = await self._document_processor.process_file(file_path, source_type)
        return await self._index_chunks(chunks)

    async def _index_chunks(self, chunks: list[DocumentChunk]) -> int:
        """将文档块嵌入并存储"""
        texts = [c.content for c in chunks]
        vectors = await self._embedding_service.embed_batch(texts)

        from ..domain.rag import EmbeddedChunk
        embedded = [
            EmbeddedChunk(chunk=c, vector=v, model=self._embedding_service.model_name)
            for c, v in zip(chunks, vectors)
        ]

        count = await self._vector_store.store_embeddings(embedded)
        logger.info(f"已索引 {count} 个文档块（来源: {chunks[0].source if chunks else 'unknown'}）")
        return count

    # ─── 检索 ───

    async def retrieve(
        self,
        query_text: str,
        top_k: int = 5,
        score_threshold: float = 0.5,
        source_types: list[str] = None,
    ) -> RAGContext:
        """检索与查询最相关的文档块"""
        query_vector = await self._embedding_service.embed_text(query_text)

        query = RetrievalQuery(
            text=query_text,
            top_k=top_k,
            score_threshold=score_threshold,
            source_types=source_types,
        )

        results = await self._vector_store.search(query_vector, query)

        if not results:
            logger.info(f"查询无结果: '{query_text[:50]}...'")
            return RAGContext(query=query_text, results=[])

        logger.info(f"检索到 {len(results)} 个相关文档块（top-1 分数: {results[0].score:.3f}）")
        return RAGContext(query=query_text, results=results)

    # ─── 问答（检索 + 上下文组装） ───

    async def query(self, question: str, top_k: int = 5) -> tuple[str, list[str]]:
        """执行完整 RAG 查询"""
        context = await self.retrieve(question, top_k=top_k)

        if not context.results:
            return "未找到相关信息。", []

        context_str = context.to_context_string()
        sources = context.get_sources()

        return context_str, sources

    # ─── 状态 ───

    async def stats(self) -> dict:
        """获取 RAG 系统统计信息"""
        return await self._vector_store.collection_stats()
