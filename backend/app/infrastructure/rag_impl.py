"""
⚠️ DEPRECATED - 请使用 app/services/ai/rag/rag_service.py（线上版）

这是 M2.1 hex 架构时期遗留的 RAG 基础设施副本（含 MockEmbeddingService / InMemoryVectorStore）。
- 线上版：app/services/ai/rag/rag_service.py + services/ai/rag/*（ChromaDB + 真实 Embedding）
- 本文件当前仅被单元测试引用：backend/tests/unit/infrastructure/test_rag.py
- MockEmbeddingService / InMemoryVectorStore 仅用于测试/开发，生产环境禁止使用。

RAG 基础设施实现（M2.1）

包含：
1. InMemoryVectorStore — 内存向量存储（测试/开发用）
2. SimpleDocumentProcessor — 文本分割处理器
"""
from __future__ import annotations

import hashlib
import logging
import re
from math import sqrt

from ..domain.rag import (
    DocumentChunk,
    EmbeddedChunk,
    RetrievalQuery,
    RetrievalResult,
)
from ..domain.rag_ports import DocumentProcessor, EmbeddingService, VectorStore

logger = logging.getLogger(__name__)


# ──────────── 内存向量存储（测试/开发） ────────────


class InMemoryVectorStore(VectorStore):
    """
    内存向量存储

    基于余弦相似度的内存向量检索。
    适用于测试和开发环境，无需外部向量数据库。
    """

    def __init__(self):
        self._collections: dict[str, list[EmbeddedChunk]] = {}
        self._default_collection = "default"

    async def store_embeddings(self, chunks: list[EmbeddedChunk], collection: str = None) -> int:
        coll = collection or self._default_collection
        if coll not in self._collections:
            self._collections[coll] = []
        self._collections[coll].extend(chunks)
        logger.debug(f"已存储 {len(chunks)} 个向量到集合 '{coll}'")
        return len(chunks)

    async def search(self, query_vector: list[float], query: RetrievalQuery) -> list[RetrievalResult]:
        coll = self._default_collection
        if coll not in self._collections:
            return []

        results = []
        for idx, chunk in enumerate(self._collections[coll]):
            score = self._cosine_similarity(query_vector, chunk.vector)

            if score < query.score_threshold:
                continue

            # 来源类型过滤
            if query.source_types and chunk.chunk.source_type not in query.source_types:
                continue

            # 元数据过滤
            if query.metadata_filter:
                match = True
                for k, v in query.metadata_filter.items():
                    if chunk.chunk.metadata.get(k) != v:
                        match = False
                        break
                if not match:
                    continue

            results.append(RetrievalResult(
                chunk=chunk.chunk,
                score=score,
                rank=0,  # 排序前暂设为0
            ))

        # 按分数降序排列
        results.sort(key=lambda r: r.score, reverse=True)
        for i, r in enumerate(results):
            r.rank = i + 1

        return results[:query.top_k]

    async def delete_collection(self, collection_name: str) -> None:
        self._collections.pop(collection_name, None)
        logger.info(f"已删除集合 '{collection_name}'")

    async def collection_stats(self, collection_name: str = None) -> dict:
        coll = collection_name or self._default_collection
        chunks = self._collections.get(coll, [])
        return {
            "name": coll,
            "chunk_count": len(chunks),
            "collections": len(self._collections),
        }

    def clear(self) -> None:
        """清空所有数据（测试用）"""
        self._collections.clear()

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        if len(a) != len(b):
            return 0.0
        dot = sum(ai * bi for ai, bi in zip(a, b))
        norm_a = sqrt(sum(ai * ai for ai in a))
        norm_b = sqrt(sum(bi * bi for bi in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)


# ──────────── 文档文本分割器 ────────────


class SimpleDocumentProcessor(DocumentProcessor):
    """
    简单文档处理器

    基于文本长度和段落结构的文档分割。
    支持按段落/句子/固定长度分割策略。
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    async def process_text(
        self,
        text: str,
        source: str,
        source_type: str,
        metadata: dict = None,
    ) -> list[DocumentChunk]:
        chunks = []
        paragraphs = self._split_paragraphs(text)

        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            # 如果单个段落就超过 chunk_size，则进一步拆分
            if len(para) > self.chunk_size:
                if current_chunk:
                    chunks.append(self._make_chunk(
                        current_chunk, source, source_type, metadata, chunk_index
                    ))
                    chunk_index += 1
                    current_chunk = ""

                for sub_chunk in self._split_long_text(para):
                    chunks.append(self._make_chunk(
                        sub_chunk, source, source_type, metadata, chunk_index
                    ))
                    chunk_index += 1
                continue

            # 如果添加此段落会超过 chunk_size，先保存当前块
            if current_chunk and len(current_chunk) + len(para) > self.chunk_size:
                chunks.append(self._make_chunk(
                    current_chunk, source, source_type, metadata, chunk_index
                ))
                chunk_index += 1
                current_chunk = ""

            current_chunk += para + "\n"

        # 最后一段
        if current_chunk.strip():
            chunks.append(self._make_chunk(
                current_chunk.strip(), source, source_type, metadata, chunk_index
            ))

        logger.debug(f"文档 '{source}' 已分割为 {len(chunks)} 个块")
        return chunks

    async def process_file(self, file_path: str, source_type: str) -> list[DocumentChunk]:
        """处理文件"""
        import os
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

        filename = os.path.basename(file_path)
        return await self.process_text(text, filename, source_type)

    def _split_paragraphs(self, text: str) -> list[str]:
        """按空行分割段落"""
        paras = re.split(r'\n\s*\n', text)
        return [p.strip() for p in paras if p.strip()]

    def _split_long_text(self, text: str) -> list[str]:
        """将长文本按句子或固定长度分割"""
        # 优先按句子分割
        sentences = re.split(r'(?<=[。！？.!?])\s*', text)
        chunks = []
        current = ""
        for sent in sentences:
            if len(current) + len(sent) > self.chunk_size and current:
                chunks.append(current.strip())
                # 重叠部分：保留末尾的 overlap 字符
                current = current[-self.chunk_overlap:] if self.chunk_overlap > 0 else ""
            current += sent
        if current.strip():
            chunks.append(current.strip())
        return chunks if chunks else [text[:self.chunk_size]]

    def _make_chunk(
        self, content: str, source: str, source_type: str,
        metadata: dict | None, index: int,
    ) -> DocumentChunk:
        chunk_id = hashlib.md5(f"{source}:{index}:{content[:50]}".encode()).hexdigest()[:12]
        return DocumentChunk(
            id=chunk_id,
            content=content,
            source=source,
            source_type=source_type,
            metadata=metadata or {},
            chunk_index=index,
        )


# ──────────── 模拟嵌入服务（测试/开发） ────────────


class MockEmbeddingService(EmbeddingService):
    """
    模拟嵌入服务（测试用）

    生成固定维度的随机向量，用于验证检索流程。
    """

    def __init__(self, dimension: int = 128):
        self._dimension = dimension

    async def embed_text(self, text: str) -> list[float]:
        """基于文本 hash 生成确定性向量（相同文本始终相同向量）"""
        h = hashlib.sha256(text.encode()).hexdigest()
        return [int(h[i:i+2], 16) / 255.0 for i in range(0, min(64, self._dimension * 2), 2)]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed_text(t) for t in texts]

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return "mock-embedding-v1"
