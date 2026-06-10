"""向量存储 — ChromaDB 封装

提供文档向量的增删查操作，使用 ChromaDB PersistentClient
实现本地持久化存储。
"""

import os
from typing import Optional
import chromadb
from chromadb.config import Settings
from .models import DocumentChunk, ChunkResult


class VectorStore:
    """ChromaDB 向量数据库封装

    支持：
    - 批量添加文档块（含向量）
    - 余弦相似度语义检索
    - 按来源文档删除
    - 统计信息查询

    数据持久化在 data/chromadb 目录。
    """

    def __init__(self, persist_dir: str = "data/chromadb"):
        self.persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection_name = "rag_documents"

    @property
    def _collection(self):
        """获取或创建文档集合（惰性加载）"""
        return self._client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list[DocumentChunk], embeddings: list[list[float]]):
        """批量添加文档块到向量库

        Args:
            chunks: 文档块列表
            embeddings: 对应的向量列表
        """
        if not chunks or not embeddings:
            return
        self._collection.add(
            ids=[c.id for c in chunks],
            documents=[c.content for c in chunks],
            metadatas=[c.metadata for c in chunks],
            embeddings=embeddings,
        )

    def search(self, query_embedding: list[float], top_k: int = 5) -> list[ChunkResult]:
        """语义检索最相关的文档块

        Args:
            query_embedding: 查询向量
            top_k: 返回 TOP K 结果

        Returns:
            按相关性排序的 ChunkResult 列表
        """
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, max(1, self._collection.count())),
        )
        if not results.get("ids") or not results["ids"]:
            return []

        chunks: list[ChunkResult] = []
        for i in range(len(results["ids"][0])):
            chunk = DocumentChunk(
                id=results["ids"][0][i],
                content=results["documents"][0][i] if results.get("documents") else "",
                metadata=results["metadatas"][0][i] if results.get("metadatas") else {},
            )
            distance = results["distances"][0][i] if results.get("distances") else 0
            score = max(0, 1 - distance)
            chunks.append(ChunkResult(chunk=chunk, score=score))

        return chunks

    def list_sources(self) -> list[str]:
        """列出所有文档来源名"""
        all_data = self._collection.get(include=["metadatas"])
        sources: set[str] = set()
        for meta in all_data.get("metadatas", []) or []:
            if meta and "source" in meta:
                sources.add(str(meta["source"]))
        return sorted(sources)

    def delete_by_source(self, source: str):
        """按来源删除文档块"""
        self._collection.delete(where={"source": source})

    @property
    def chunk_count(self) -> int:
        """当前向量库中的文档块总数"""
        return self._collection.count()

    def reset(self):
        """清空向量库"""
        try:
            self._client.delete_collection(self._collection_name)
        except Exception:
            pass
