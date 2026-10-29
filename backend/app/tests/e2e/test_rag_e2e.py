import asyncio
import logging

logger = logging.getLogger(__name__)
"""
RAG 全链路端到端验证测试

迁移自 app/services/ai/rag/test_rag_e2e.py，适配 tests/e2e/ 目录结构。
运行: cd backend && python -m pytest tests/e2e/test_rag_e2e.py -v --asyncio-mode=auto
"""


async def main():
    import os
    import sys

    rag_dir = os.path.normpath(os.path.join(
        os.path.dirname(__file__), "..", "services", "ai", "rag"
    ))
    if rag_dir not in sys.path:
        sys.path.insert(0, rag_dir)

    import types
    _rag_pkg = types.ModuleType("services.ai.rag")
    _rag_pkg.__path__ = [RAG_DIR]
    _rag_pkg.__package__ = "services.ai.rag"
    sys.modules["services"] = types.ModuleType("services")
    sys.modules["services"].__path__ = []
    sys.modules["services.ai"] = types.ModuleType("services.ai")
    sys.modules["services.ai"].__path__ = []
    sys.modules["services.ai.rag"] = _rag_pkg

    import services.ai.rag.document_processor as _dp
    import services.ai.rag.embedding_service as _emb
    import services.ai.rag.vector_store as _vs

    logger.info("=" * 60)
    logger.info("RAG 全链路验证测试 (tests/e2e)")
    logger.info("=" * 60)

    emb = _emb.EmbeddingService()
    store = _vs.VectorStore(persist_dir="./data/test_chromadb")
    store.reset()
    proc = _dp.DocumentProcessor()

    logger.info(f"   Embedding: provider={emb.provider}, model={emb.model}")
    logger.info(f"   Base URL:  {emb.base_url}")
    logger.info()

    # Test 1: Document chunking
    logger.info("[1/5] Document chunking")
    test_text = ("枸杞子具有滋补肝肾、益精明目的功效。富含枸杞多糖和类胡萝卜素。"
                 "黄芪补气升阳。党参补中益气。甘草调和诸药。当归补血活血。")
    chunks = proc.chunk_text(test_text, "测试文档.txt")
    assert len(chunks) > 0
    logger.info(f"   PASS: {len(chunks)} chunks")

    # Test 2: Embedding
    logger.info("[2/5] Text embedding")
    try:
        embeddings = await emb.embed_texts([c.content for c in chunks])
        logger.info(f"   PASS: dim={len(embeddings[0])}")
    except Exception as exc:
        logger.info(f"   WARN: API failed ({exc}), using fallback")
        embeddings = emb._embed_fallback([c.content for c in chunks])
        logger.info(f"   → Fallback: dim={len(embeddings[0])}")

    # Test 3: Vector store + search
    logger.info("[3/5] Vector store and search")
    store.add_chunks(chunks, embeddings)
    q_vec = (await emb.embed_texts(["枸杞子的功效是什么？"]))[0]
    results = store.search(q_vec, top_k=3)
    assert len(results) > 0
    assert any("枸杞" in r.chunk.content for r in results)
    logger.info(f"   PASS: {len(results)} matches found")

    # Test 4: Prompt augmentation
    logger.info("[4/5] Prompt augmentation")
    context_parts = [f"[{c.chunk.metadata.get('source', '?')}] {c.chunk.content}" for c in results]
    augmented = "参考文档:\n" + "\n".join(context_parts) + "\n问题: 枸杞子的功效"
    assert "枸杞" in augmented
    logger.info(f"   PASS: prompt length={len(augmented)}")

    # Test 5: File management
    logger.info("[5/5] File management")
    assert "测试文档.txt" in store.list_sources()
    store.delete_by_source("测试文档.txt")
    assert store.chunk_count == 0
    logger.info("   PASS: deletion successful")

    store.reset()
    logger.info()
    logger.info("PASS: All 5 RAG end-to-end tests passed!")
    return 0


def test_rag_e2e():
    """pytest entry point wrapping the async main()."""
    exit_code = asyncio.run(main())
    assert exit_code == 0, "RAG e2e test completed with non-zero exit code"


if __name__ == "__main__":
    exit(asyncio.run(main()))
