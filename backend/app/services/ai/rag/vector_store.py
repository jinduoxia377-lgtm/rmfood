# ruff: noqa: E402
"""向量存储 — ChromaDB 封装

提供文档向量的增删查操作，使用 ChromaDB PersistentClient
实现本地持久化存储。
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# chromadb 0.5.0 与新版 posthog 不兼容：即使 Settings(anonymized_telemetry=False)，
# 其 telemetry 仍会在 client/collection 初始化时调用新版 posthog 的 _direct_capture，
# 抛 "capture() takes 1 positional argument but 3 were given" 并以 ERROR 刷屏。
# 该异常被 chromadb 内部 try/except 吞掉（只打日志），不会崩溃进程，
# 但会污染 stderr 掩盖真实错误。这里压制该 logger（与
# backend/scripts/backfill_rag_knowledge_sources.py 同一处理），不影响 ChromaDB 功能。
logging.getLogger("chromadb.telemetry").setLevel(logging.CRITICAL)

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

    def _reset_collection_ref(self):
        """丢弃缓存的 collection 引用，强制下次访问用新连接重开集合。

        ChromaDB 0.5.0 在 WAL 异常后，已打开的 collection 句柄会持续报
        "unable to open database file"；实测用全新的 PersistentClient 连接 +
        分页 get 可正常读取。此方法用于在 get 类操作失败后重建连接。
        """
        self._collection_ref = None

    def _safe_get(self, **kwargs):
        """执行 collection.get，WAL 异常时重置连接并重试一次。

        ChromaDB 0.5.0 的 collection.get 在 WAL consumer 异常时会抛
        "unable to open database file"，且已缓存的 collection 句柄持续失败；
        丢弃引用后用新连接重试通常可恢复（分页读取验证过）。仍失败则返回空。
        """
        if self._collection is None:
            return None
        try:
            return self._collection.get(**kwargs)
        except Exception:
            # 重试一次：重置连接后重新获取 collection
            try:
                self._reset_collection_ref()
                if self._collection is None:
                    return None
                return self._collection.get(**kwargs)
            except Exception as e:
                logger.warning("ChromaDB get 失败（已重置连接重试）: %s", e)
                return None

    def add_chunks(self, chunks: list[DocumentChunk], embeddings: list[list[float]], user_id: str = "system"):
        """批量添加文档块到向量库

        P4（2026-11-05）：分批写入以规避 ChromaDB 0.5.0 在单次大写入时
        WAL consumer 报 "unable to open database file" 的问题（本草古籍导入
        触发）。默认每批 50 块，批间 sleep 10ms 让 SQLite checkpoint 跟上。
        """
        if not chunks or not embeddings or self._collection is None:
            return
        import time as _time
        batch_size = int(os.getenv("RAG_ADD_BATCH_SIZE", "50"))
        metadatas = []
        for c in chunks:
            meta = dict(c.metadata)  # 避免修改原始数据
            meta["user_id"] = user_id
            metadatas.append(meta)
        for i in range(0, len(chunks), batch_size):
            self._collection.add(
                ids=[c.id for c in chunks[i:i + batch_size]],
                documents=[c.content for c in chunks[i:i + batch_size]],
                metadatas=metadatas[i:i + batch_size],
                embeddings=embeddings[i:i + batch_size],
            )
            _time.sleep(0.01)

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

    def search(self, query_embedding: list[float], top_k: int = 5, user_id: str = None,
               source_filter: list[str] = None) -> list[ChunkResult]:
        """语义检索最相关的文档块

        Args:
            query_embedding: 查询向量
            top_k: 返回数量上限
            user_id: 租户过滤。种子库（user_id="system"）对所有租户可见；
                传入 user_id 时返回「该租户自己的块 + system 种子块」。
            source_filter: 可选，限定只检索这些 source（用于「书名感知检索」：
                问题提到《本草纲目》时定向检索该书，避免被其他文档挤占）。
        """
        if self._collection is None:
            return []

        # 构建 where 过滤条件（租户可见性：自己的 + system 种子）
        where = self._visible_where(user_id)

        # 书名感知：叠加 source 限定（$and 组合租户可见性与 source IN 列表）
        if source_filter:
            source_where = {"source": {"$in": list(source_filter)}}
            where = {"$and": [where, source_where]} if where else source_where

        try:
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, max(1, self._collection.count())),
                where=where,
            )
        except Exception as e:
            # 书名过滤失败（如该 source 无块）不应影响主检索，由调用方回退
            logger.warning("ChromaDB 检索失败 (source_filter=%s): %s", source_filter, e)
            return []
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

    def _sqlite_meta_path(self) -> Optional[str]:
        """返回 ChromaDB 元数据 SQLite 文件路径（不可用时返回 None）。"""
        try:
            path = os.path.join(self.persist_dir, "chroma.sqlite3")
            return path if os.path.isfile(path) else None
        except Exception:
            return None

    def _query_sqlite_sources(self, user_id: str = None) -> Optional[list[str]]:
        """直查 ChromaDB 元数据表获取去重来源（毫秒级）。

        ChromaDB 0.5.0 的 ``collection.get`` 分页扫描在 1.6 万块时需要 ~40s
        （41 页 × SQLite 查询），而直接对 ``embedding_metadata`` 做
        ``SELECT DISTINCT`` 实测仅 0.12s。故大集合走 SQL 快路径；
        失败时返回 None，由调用方回退到原分页实现。
        """
        db_path = self._sqlite_meta_path()
        if not db_path:
            return None
        try:
            import sqlite3
            uri = f"file:{db_path}?mode=ro"
            con = sqlite3.connect(uri, uri=True, timeout=10)
            try:
                cur = con.cursor()
                if user_id:
                    rows = cur.execute(
                        """
                        SELECT DISTINCT m.string_value
                        FROM embedding_metadata m
                        WHERE m.key = 'source'
                          AND m.id IN (
                              SELECT u.id FROM embedding_metadata u
                              WHERE u.key = 'user_id'
                                AND (u.string_value = ? OR u.string_value = 'system')
                          )
                        """,
                        (user_id,),
                    ).fetchall()
                else:
                    rows = cur.execute(
                        "SELECT DISTINCT string_value FROM embedding_metadata WHERE key = 'source'"
                    ).fetchall()
            finally:
                con.close()
            return sorted({str(r[0]) for r in rows if r and r[0]})
        except Exception as e:
            logger.debug("SQLite 直查来源失败，回退分页读取: %s", e)
            return None

    def list_sources(self, user_id: str = None) -> list[str]:
        """列出所有文档来源名

        Args:
            user_id: 租户过滤。种子库（user_id="system"）对所有租户可见；
                传入 user_id 时返回「该租户自己的来源 + system 种子来源」。
        """
        if self._collection is None:
            return []
        # 快路径：直查 SQLite 元数据（大集合下比 ChromaDB 分页 get 快两个数量级）
        fast = self._query_sqlite_sources(user_id=user_id)
        if fast is not None:
            return fast
        # 构建 where 过滤条件（租户可见性：自己的 + system 种子）
        where = self._visible_where(user_id)
        # P4：分页读取。ChromaDB 0.5.0 单次 get 在数据量大时（实测 limit>=1000）
        # 会抛 SQLite "unable to open database file"；limit<=500 稳定。取 400。
        sources: set[str] = set()
        offset = 0
        page_size = 400
        while True:
            page = self._safe_get(include=["metadatas"], where=where, limit=page_size, offset=offset)
            if not page or not page.get("metadatas"):
                break
            metas = page["metadatas"]
            for meta in metas:
                if meta and "source" in meta:
                    sources.add(str(meta["source"]))
            if len(metas) < page_size:
                break
            offset += page_size
        return sorted(sources)

    def counts_by_source(self, user_id: str = None) -> dict[str, int]:
        """按来源统计可见分块数（毫秒级）。

        用于文档列表回填 ``chunks``（种子库/上传文档没有版本记录时也能取到准确块数）。

        Args:
            user_id: 租户过滤；传入时统计「该租户自己的 + system 种子」的块数。

        Returns:
            {source: chunk_count}；SQL 不可用时返回空 dict（调用方回退）。
        """
        db_path = self._sqlite_meta_path()
        if not db_path:
            return {}
        try:
            import sqlite3
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=10)
            try:
                if user_id:
                    rows = con.execute(
                        """
                        SELECT m.string_value, COUNT(*)
                        FROM embedding_metadata m
                        WHERE m.key = 'source'
                          AND m.id IN (
                              SELECT u.id FROM embedding_metadata u
                              WHERE u.key = 'user_id'
                                AND (u.string_value = ? OR u.string_value = 'system')
                          )
                        GROUP BY m.string_value
                        """,
                        (user_id,),
                    ).fetchall()
                else:
                    rows = con.execute(
                        "SELECT string_value, COUNT(*) FROM embedding_metadata WHERE key = 'source' GROUP BY string_value"
                    ).fetchall()
            finally:
                con.close()
            return {str(r[0]): int(r[1]) for r in rows if r and r[0]}
        except Exception as e:
            logger.debug("SQLite 按来源统计失败: %s", e)
            return {}

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
        data = self._safe_get(ids=ids, include=["documents", "metadatas"])
        if not data:
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

        P1-3：ChromaDB 0.5.0 的 delete+重灌存在 WAL 损坏风险（删除后后续写入失败）。
        因此删除操作包 try/except，并在删除后立即执行健康自检（count + get）；
        若自检异常，记录清晰错误日志并抛出明确异常，提示重建集合，避免静默损坏。
        """
        if self._collection is None:
            return
        # 构建 where 过滤条件：仅匹配调用方自己的分块（绝不匹配 system 种子）
        if user_id:
            where = {"$and": [{"source": source}, {"user_id": user_id}]}
        else:
            where = {"source": source}

        try:
            self._collection.delete(where=where)
        except Exception as e:
            logger.error(
                "ChromaDB 删除失败 (source=%s, user_id=%s): %s",
                source, user_id, e, exc_info=True,
            )
            raise

        # P1-3：删除后健康自检，确认集合仍可正常读写
        try:
            self._collection.count()
            self._collection.get(limit=1, include=["metadatas"])
        except Exception as e:
            logger.error(
                "ChromaDB 删除后健康自检失败 (source=%s, user_id=%s) —— 可能存在 WAL 损坏，"
                "后续写入可能失败。建议重建向量集合（参考 scripts/rag_rebuild_seed.py）"
                "或重启服务后重试。异常: %s",
                source, user_id, e, exc_info=True,
            )
            # 清除缓存的 collection 引用，强制下次访问重新打开集合
            self._collection_ref = None
            raise RuntimeError(
                f"向量库删除后自检失败（可能存在 WAL 损坏），请重建集合后重试: {e}"
            ) from e

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
        # 快路径：直查 SQLite 元数据统计可见块数（大集合下毫秒级）
        db_path = self._sqlite_meta_path()
        if db_path:
            try:
                import sqlite3
                con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=10)
                try:
                    row = con.execute(
                        """
                        SELECT COUNT(*)
                        FROM embedding_metadata u
                        WHERE u.key = 'user_id'
                          AND (u.string_value = ? OR u.string_value = 'system')
                        """,
                        (user_id,),
                    ).fetchone()
                finally:
                    con.close()
                return int(row[0]) if row else 0
            except Exception as e:
                logger.debug("SQLite 直查可见块数失败，回退分页统计: %s", e)
        # P4：分页统计，避免单次 get 全量触发 SQLite "unable to open database file"
        # （实测 limit>=1000 失败，limit<=500 稳定；取 400）。
        total = 0
        offset = 0
        page_size = 400
        while True:
            page = self._safe_get(where=where, include=["metadatas"], limit=page_size, offset=offset)
            if not page or not page.get("ids"):
                break
            ids = page["ids"]
            total += len(ids)
            if len(ids) < page_size:
                break
            offset += page_size
        return total

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
