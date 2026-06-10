"""
RAG 检索增强生成测试（M2.1）

覆盖：文档分块、向量检索、上下文组装、完整 RAG 流程
"""
import pytest
from math import sqrt

from app.domain.rag import (
    DocumentChunk, RetrievalQuery, RetrievalResult, RAGContext,
)
from app.infrastructure.rag_impl import (
    InMemoryVectorStore,
    SimpleDocumentProcessor,
    MockEmbeddingService,
)
from app.application.rag_service import RAGService


# ──────────── Fixtures ────────────


@pytest.fixture
def vector_store():
    return InMemoryVectorStore()


@pytest.fixture
def embedding_service():
    return MockEmbeddingService(dimension=32)


@pytest.fixture
def document_processor():
    return SimpleDocumentProcessor(chunk_size=200, chunk_overlap=20)


@pytest.fixture
def rag_service(vector_store, embedding_service, document_processor):
    return RAGService(vector_store, embedding_service, document_processor)


# ──────────── 文档分块测试 ────────────


class TestDocumentProcessor:
    """文档分块测试"""

    @pytest.mark.asyncio
    async def test_split_simple_text(self, document_processor):
        # 使用较小的 chunk_size 确保段落被拆分
        proc = SimpleDocumentProcessor(chunk_size=10, chunk_overlap=0)
        text = "第一段落。\n\n第二段落。\n\n第三段落。"
        chunks = await proc.process_text(text, "test.txt", "internal")
        assert len(chunks) >= 2  # 短文本被分割为多块
        assert all(c.source == "test.txt" for c in chunks)
        assert all(c.source_type == "internal" for c in chunks)

    @pytest.mark.asyncio
    async def test_chunk_ids_unique(self, document_processor):
        text = "\n\n".join([f"第{i}段内容。" for i in range(10)])
        chunks = await document_processor.process_text(text, "test.txt", "internal")
        ids = [c.id for c in chunks]
        assert len(set(ids)) == len(ids)  # 所有 ID 唯一

    @pytest.mark.asyncio
    async def test_long_text_split(self, document_processor):
        """长文本应被分割为多个块"""
        text = "有效成分。" * 100  # 600 字符
        chunks = await document_processor.process_text(text, "long.txt", "patent")
        assert len(chunks) > 1

    @pytest.mark.asyncio
    async def test_empty_text(self, document_processor):
        chunks = await document_processor.process_text("", "empty.txt", "internal")
        assert len(chunks) == 0

    @pytest.mark.asyncio
    async def test_file_not_found(self, document_processor):
        with pytest.raises(FileNotFoundError):
            await document_processor.process_file("/nonexistent/file.txt", "internal")

    @pytest.mark.asyncio
    async def test_chunk_metadata(self, document_processor):
        text = "测试内容。"
        chunks = await document_processor.process_text(
            text, "src.txt", "tcmsp", {"herb_id": "H-001"}
        )
        assert len(chunks) == 1
        assert chunks[0].metadata.get("herb_id") == "H-001"
        assert chunks[0].chunk_index == 0


# ──────────── 向量检索测试 ────────────


class TestVectorStore:
    """向量存储和检索测试"""

    @pytest.mark.asyncio
    async def test_store_and_search(self, vector_store, embedding_service):
        # 索引文本
        texts = ["枸杞子具有抗氧化功效", "人参用于补气", "山楂用于消食"]
        chunks = [
            DocumentChunk(id=f"c{i}", content=t, source="test", source_type="tcmsp")
            for i, t in enumerate(texts)
        ]
        vectors = await embedding_service.embed_batch(texts)
        from app.domain.rag import EmbeddedChunk
        embedded = [
            EmbeddedChunk(chunk=c, vector=v, model=embedding_service.model_name)
            for c, v in zip(chunks, vectors)
        ]
        await vector_store.store_embeddings(embedded)

        # 搜索"枸杞"
        query_vec = await embedding_service.embed_text("枸杞")
        query = RetrievalQuery(text="枸杞", top_k=3, score_threshold=0.0)
        results = await vector_store.search(query_vec, query)

        assert len(results) >= 1
        # Mock嵌入基于hash，不保证语义相关性，仅验证返回结果
        assert results[0].score > 0

    @pytest.mark.asyncio
    async def test_search_empty_store(self, vector_store, embedding_service):
        query_vec = await embedding_service.embed_text("test")
        query = RetrievalQuery(text="test", top_k=5)
        results = await vector_store.search(query_vec, query)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_search_with_score_threshold(self, vector_store, embedding_service):
        chunks = [
            DocumentChunk(id="c1", content="抗氧化配方", source="a", source_type="internal"),
            DocumentChunk(id="c2", content="完全无关的内容", source="b", source_type="internal"),
        ]
        texts = [c.content for c in chunks]
        vectors = await embedding_service.embed_batch(texts)
        from app.domain.rag import EmbeddedChunk
        await vector_store.store_embeddings([
            EmbeddedChunk(chunk=c, vector=v, model=embedding_service.model_name)
            for c, v in zip(chunks, vectors)
        ])

        # 高阈值筛选
        query_vec = await embedding_service.embed_text("抗氧化")
        query = RetrievalQuery(text="抗氧化", top_k=5, score_threshold=0.5)
        results = await vector_store.search(query_vec, query)

        # 至少返回"抗氧化配方"
        assert len(results) >= 1

    @pytest.mark.asyncio
    async def test_search_with_source_filter(self, vector_store, embedding_service):
        chunks = [
            DocumentChunk(id="c1", content="配方内容", source="a", source_type="patent"),
            DocumentChunk(id="c2", content="药材内容", source="b", source_type="tcmsp"),
        ]
        texts = [c.content for c in chunks]
        vectors = await embedding_service.embed_batch(texts)
        from app.domain.rag import EmbeddedChunk
        await vector_store.store_embeddings([
            EmbeddedChunk(chunk=c, vector=v, model=embedding_service.model_name)
            for c, v in zip(chunks, vectors)
        ])

        # 只搜索 patent 类型
        query_vec = await embedding_service.embed_text("内容")
        query = RetrievalQuery(text="内容", top_k=5, score_threshold=0.0, source_types=["patent"])
        results = await vector_store.search(query_vec, query)

        assert len(results) == 1
        assert results[0].chunk.source_type == "patent"

    @pytest.mark.asyncio
    async def test_cosine_similarity(self):
        """验证余弦相似度计算"""
        store = InMemoryVectorStore()
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        assert store._cosine_similarity(a, b) == 1.0  # 完全相同

        c = [0.0, 1.0, 0.0]
        assert store._cosine_similarity(a, c) == 0.0  # 正交

        d = [-1.0, 0.0, 0.0]
        assert store._cosine_similarity(a, d) == -1.0  # 完全相反

    @pytest.mark.asyncio
    async def test_clear_store(self, vector_store, embedding_service):
        chunk = DocumentChunk(id="c1", content="test", source="t", source_type="internal")
        vec = await embedding_service.embed_text("test")
        from app.domain.rag import EmbeddedChunk
        await vector_store.store_embeddings([
            EmbeddedChunk(chunk=chunk, vector=vec, model="test")
        ])
        stats = await vector_store.collection_stats()
        assert stats["chunk_count"] >= 1
        vector_store.clear()
        stats = await vector_store.collection_stats()
        assert stats["chunk_count"] == 0


# ──────────── RAG 上下文组装测试 ────────────


class TestRAGContext:
    """RAG 上下文组装测试"""

    def test_empty_context(self):
        ctx = RAGContext(query="test", results=[])
        assert ctx.to_context_string() == ""
        assert ctx.get_sources() == []

    def test_context_format(self):
        results = [
            RetrievalResult(
                chunk=DocumentChunk(id="c1", content="枸杞含枸杞多糖",
                                    source="tcmsp_1", source_type="tcmsp"),
                score=0.95, rank=1,
            ),
            RetrievalResult(
                chunk=DocumentChunk(id="c2", content="人参含人参皂苷",
                                    source="tcmsp_2", source_type="tcmsp"),
                score=0.80, rank=2,
            ),
        ]
        ctx = RAGContext(query="配方成分", results=results)
        context_str = ctx.to_context_string()

        assert "枸杞含枸杞多糖" in context_str
        assert "人参含人参皂苷" in context_str
        assert "tcmsp_1" in context_str
        assert "0.95" in context_str

    def test_get_sources_unique(self):
        results = [
            RetrievalResult(
                chunk=DocumentChunk(id="c1", content="a", source="src1", source_type="patent"),
                score=0.9, rank=1,
            ),
            RetrievalResult(
                chunk=DocumentChunk(id="c2", content="b", source="src1", source_type="patent"),
                score=0.8, rank=2,
            ),
        ]
        ctx = RAGContext(query="test", results=results)
        sources = ctx.get_sources()
        assert len(sources) == 1  # 去重

    def test_context_token_limit(self):
        """长上下文应被截断"""
        results = [
            RetrievalResult(
                chunk=DocumentChunk(id=f"c{i}", content="A" * 500, source=f"s{i}", source_type="internal"),
                score=0.9, rank=i,
            )
            for i in range(20)
        ]
        ctx = RAGContext(query="test", results=results, max_tokens=4000)
        context_str = ctx.to_context_string(max_chars=500)
        assert len(context_str) <= 600  # 截断在限制附近


# ──────────── 完整 RAG 流程测试 ────────────


class TestRAGService:
    """RAG 服务端到端测试"""

    @pytest.mark.asyncio
    async def test_index_and_retrieve(self, rag_service):
        count = await rag_service.index_text(
            "枸杞子（Lycium barbarum）具有抗氧化、免疫调节等功效。",
            source="tcmsp_herb_001.md",
            source_type="tcmsp",
        )
        assert count == 1

        context = await rag_service.retrieve("枸杞的功效")
        assert len(context.results) >= 1
        assert "抗氧化" in context.results[0].chunk.content

    @pytest.mark.asyncio
    async def test_retrieve_no_results(self, rag_service):
        context = await rag_service.retrieve("完全不存在的查询内容")
        assert len(context.results) == 0

    @pytest.mark.asyncio
    async def test_query_end_to_end(self, rag_service):
        # 索引知识
        await rag_service.index_text(
            "人参（Panax ginseng）归脾、肺经，大补元气。",
            source="tcmsp_herb_002.md",
            source_type="tcmsp",
        )

        # 查询
        context_str, sources = await rag_service.query("人参的功效")
        assert "人参" in context_str
        assert len(sources) >= 1

    @pytest.mark.asyncio
    async def test_index_multiple_documents(self, rag_service):
        texts = [
            ("枸杞子抗氧化", "枸杞.md", "tcmsp"),
            ("山楂消食", "山楂.md", "tcmsp"),
            ("人参补气", "人参.md", "tcmsp"),
        ]
        total = 0
        for text, source, stype in texts:
            total += await rag_service.index_text(text, source, stype)
        assert total >= 3

        stats = await rag_service.stats()
        assert stats["chunk_count"] >= 3

    @pytest.mark.asyncio
    async def test_source_type_filter(self, rag_service):
        await rag_service.index_text("专利配方内容", "patent_001.md", "patent")
        await rag_service.index_text("药材成分信息", "tcmsp_001.md", "tcmsp")

        # 只检索 patent
        context = await rag_service.retrieve("配方", source_types=["patent"])
        assert all(r.chunk.source_type == "patent" for r in context.results)
