# ruff: noqa: E402
"""向量存储 — ChromaDB 封装

提供文档向量的增删查操作，使用 ChromaDB PersistentClient
实现本地持久化存储。
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import chromadb
    from chromadb.config import Settings
    _HAS_CHROMADB = True
    # 必须在任何 client / collection 操作之前打补丁，
    # 否则 SQLite >= 3.50 会触发 _decode_seq_id 的 TypeError 并中断后端启动。
    from ._chroma_compat import apply_chroma_compat
    apply_chroma_compat()
except ImportError:
    _HAS_CHROMADB = False
    chromadb = None
    Settings = None  # type: ignore[assignment]

from .models import ChunkResult, DocumentChunk


class VectorStore:
    """ChromaDB 向量数据库封装

    支持：
    - 批量添加文档块（含向量）
    - 余弦相似度语义检索
    - 按来源文档删除
    - 统计信息查询

    数据持久化在 data/chromadb 目录。
    当 chromadb 未安装时，所有操作返回空结果（不报错）。
    """

    def __init__(self, persist_dir: str = ""):
        # 持久化目录可配置（CHROMA_PERSIST_DIR）：默认 data/chromadb。
        # 2026-10-28 迁移到 data/chromadb_v2（旧目录被运行中服务锁定且含 HNSW 段残留，
        # 无法原地重建；新目录可干净注入 330+ 种子块）。
        self.persist_dir = persist_dir or os.getenv("CHROMA_PERSIST_DIR", "data/chromadb")
        self._client = None
        # collection 名可配置（CHROMA_COLLECTION）：默认 rag_documents。
        self._collection_name = os.getenv("CHROMA_COLLECTION", "rag_documents")
        self._collection_ref = None
        if not _HAS_CHROMADB:
            return
        try:
            os.makedirs(self.persist_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=Settings(anonymized_telemetry=False),
            )
        except Exception as e:
            logger.warning("ChromaDB initialization failed, RAG features will be unavailable: %s", e)
            self._client = None
        self._collection_ref = None  # 惰性加载缓存

    @property
    def _collection(self):
        """获取或创建文档集合（惰性加载 + 缓存）"""
        if self._collection_ref is None:
            if not _HAS_CHROMADB or self._client is None:
                return None
            self._collection_ref = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection_ref

    def add_chunks(self, chunks: list[DocumentChunk], embeddings: list[list[float]], user_id: str = "system"):
        """批量添加文档块到向量库"""
        if not chunks or not embeddings or self._collection is None:
            return
        # 注入 user_id 到 metadata 以实现租户隔离
        metadatas = []
        for c in chunks:
            meta = dict(c.metadata)  # 避免修改原始数据
            meta["user_id"] = user_id
            metadatas.append(meta)
        self._collection.add(
            ids=[c.id for c in chunks],
            documents=[c.content for c in chunks],
            metadatas=metadatas,
            embeddings=embeddings,
        )

    def _visible_where(self, user_id: str = None) -> Optional[dict]:
        """构建租户可见性 where 子句（P0-5）。

        种子库以 user_id="system" 注入，对所有租户可见。因此查询某租户的可见内容时，
        取「该租户自己的分块 ∪ 系统种子分块」。否则 where={"user_id": user_id} 会
        永远排除 user_id="system" 的种子，导致核心知识库经向量路径不可达。

        ChromaDB 0.5.0 支持 where 的 $or 操作符（已实测验证），本方案即使用 $or；
        若未来 ChromaDB 版本不支持 $or，可回退为「两次查询合并」。
        """
        if not user_id:
            return None  # 无 user_id → 不过滤（全局）；调用方应尽量传 user_id
        return {"$or": [{"user_id": user_id}, {"user_id": "system"}]}

    def search(self, query_embedding: list[float], top_k: int = 5, user_id: str = None) -> list[ChunkResult]:
        """语义检索最相关的文档块

        Args:
            query_embedding: 查询向量
            top_k: 返回数量上限
            user_id: 租户过滤。种子库（user_id="system"）对所有租户可见；
                传入 user_id 时返回「该租户自己的块 + system 种子块」。
        """
        if self._collection is None:
            return []

        # 构建 where 过滤条件（租户可见性：自己的 + system 种子）
        where = self._visible_where(user_id)

        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, max(1, self._collection.count())),
            where=where,
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

    def list_sources(self, user_id: str = None) -> list[str]:
        """列出所有文档来源名

        Args:
            user_id: 租户过滤。种子库（user_id="system"）对所有租户可见；
                传入 user_id 时返回「该租户自己的来源 + system 种子来源」。
        """
        if self._collection is None:
            return []
        try:
            # 构建 where 过滤条件（租户可见性：自己的 + system 种子）
            where = self._visible_where(user_id)
            all_data = self._collection.get(include=["metadatas"], where=where)
        except Exception:
            return []
        sources: set[str] = set()
        for meta in all_data.get("metadatas", []) or []:
            if meta and "source" in meta:
                sources.add(str(meta["source"]))
        return sorted(sources)

    def get_chunks_by_ids(self, ids: list[str], user_id: str = None) -> list[ChunkResult]:
        """按 ID 获取文档块（用于 RRF 重排序时补充 BM25-only 文档）

        Args:
            ids: 目标文档块 ID 列表（可能来自全局 BM25 索引，跨租户）。
            user_id: 若传入，按租户可见性过滤——仅保留「该租户自己的块 + system 种子块」。

        根因（P0-3）：BM25 索引是全局的（_build_bm25_index 读取全部 collection），
        `bm25_only_ids` 会包含其他租户的命中块。ChromaDB 的 where 与 ids 组合在部分
        版本上行为不一致，因此采用「取回后内存过滤」——更稳妥，不依赖 where+ids 语义。
        """
        if self._collection is None or not ids:
            return []
        try:
            data = self._collection.get(ids=ids, include=["documents", "metadatas"])
        except Exception:
            return []
        chunks: list[ChunkResult] = []
        for i, doc_id in enumerate(data.get("ids", [])):
            meta = data.get("metadatas", [{}])[i] if i < len(data.get("metadatas", [])) else {}
            meta = meta or {}
            # 租户可见性过滤：仅保留 user_id 自己的块 + system 种子块
            if user_id:
                meta_uid = meta.get("user_id")
                if meta_uid not in (user_id, "system"):
                    continue
            chunk = DocumentChunk(
                id=doc_id,
                content=data.get("documents", [""])[i] if i < len(data.get("documents", [])) else "",
                metadata=meta,
            )
            chunks.append(ChunkResult(chunk=chunk, score=0.0))
        return chunks

    def delete_by_source(self, source: str, user_id: str = None):
        """按来源删除文档块

        P0-5：种子库（user_id="system"）为公共知识库，**禁止**任何租户删除。
        本方法仅按调用方自己的 user_id 匹配（不带 "system"），因此删除 where
        永远不会命中 user_id="system" 的种子块——对种子 source 删除即为「无效果」。
        端点层（rag_router.delete_document）还会对种子文档名显式返回 403。
        """
        if self._collection is None:
            return
        # 构建 where 过滤条件：仅匹配调用方自己的分块（绝不匹配 system 种子）
        if user_id:
            where = {"$and": [{"source": source}, {"user_id": user_id}]}
        else:
            where = {"source": source}
        self._collection.delete(where=where)

    def count_visible(self, user_id: str = None) -> int:
        """统计当前租户可见的分块数（自己的 + system 种子）。

        与 list_sources / search 的可见性语义保持一致，供 get_stats / augment_query
        计算 total_chunks，避免「documents 已按租户过滤但 total_chunks 用全局计数」矛盾。
        user_id 为空时返回全局计数（保持兼容）。
        """
        if self._collection is None:
            return 0
        where = self._visible_where(user_id)
        if not where:
            return self.chunk_count
        try:
            data = self._collection.get(where=where, include=["metadatas"])
            return len(data.get("ids", []) or [])
        except Exception:
            return 0

    @property
    def chunk_count(self) -> int:
        """当前向量库中的文档块总数"""
        if self._collection is None:
            return 0
        try:
            return self._collection.count()
        except Exception:
            return 0

    def reset(self):
        """清空向量库"""
        if self._client is None:
            return
        try:
            self._client.delete_collection(self._collection_name)
        except Exception as e:
            logger.debug("向量库删除集合失败: %s", e)
        finally:
            # 清除缓存的 collection 引用，否则后续 _collection 会返回已删除的
            # 旧 collection 对象，导致 add/query/count 抛 "collection does not exist"。
            self._collection_ref = None
