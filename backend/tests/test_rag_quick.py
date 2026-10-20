"""
RAG 快速验证测试（使用 fallback embedding，不需要 API Key）
运行: cd backend && python tests/test_rag_quick.py

注意：`EmbeddingService._embed_fallback` 已被移除（生产代码不再提供
无语义意义的 fallback 哈希向量）。本脚本依赖该旧 API，整体跳过，
待基于当前 `embed_texts` API 重写。
"""
import sys, os, asyncio
import pytest

pytestmark = pytest.mark.skip(reason="依赖已移除的 EmbeddingService._embed_fallback API，待重写")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "services", "ai"))
import rag.document_processor as _dp
import rag.vector_store as _vs
import rag.embedding_service as _emb

async def main():
    emb = _emb.EmbeddingService(provider="local", api_key="", model="", base_url="")
    store = _vs.VectorStore(persist_dir="./data/test_chromadb")
    store.reset()
    proc = _dp.DocumentProcessor()

    chunks = proc.chunk_text("枸杞子滋补肝肾、益精明目。富含枸杞多糖。黄芪补气升阳。", "test.txt")
    print(f"分块: {len(chunks)} ✅")

    vecs = emb._embed_fallback([c.content for c in chunks])
    store.add_chunks(chunks, vecs)
    print(f"存储: {store.chunk_count} 块 ✅")

    q = emb._embed_fallback(["枸杞功效"])[0]
    r = store.search(q, 3)
    print(f"检索: {len(r)} 结果, best={r[0].score:.3f} ✅" if r and "枸杞" in r[0].chunk.content else "检索: 失败 ❌")
    assert r and "枸杞" in r[0].chunk.content

    store.delete_by_source("test.txt")
    assert store.chunk_count == 0
    store.reset()
    print("删除: ✅")
    print("\n✅ RAG 核心功能验证通过！")

if __name__ == "__main__":
    asyncio.run(main())