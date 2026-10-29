"""
RAG 全链路端到端验证测试

直接通过 Python import 使用 RAG 模块，不经过 app 包。
运行: cd backend && python tests/test_rag_e2e.py
"""

import sys, os, asyncio
RAG_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "app", "services", "ai", "rag"
))
sys.path.insert(0, RAG_DIR)

# 手动注册 rag 包，使相对导入有效
import types  # noqa: E402
_rag_pkg = types.ModuleType("services.ai.rag")
_rag_pkg.__path__ = [RAG_DIR]
_rag_pkg.__package__ = "services.ai.rag"
sys.modules["services"] = types.ModuleType("services")
sys.modules["services"].__path__ = []
sys.modules["services.ai"] = types.ModuleType("services.ai")
sys.modules["services.ai"].__path__ = []
sys.modules["services.ai.rag"] = _rag_pkg

# 导入 RAG 模块
import services.ai.rag.document_processor as _dp  # noqa: E402
import services.ai.rag.vector_store as _vs  # noqa: E402
import services.ai.rag.embedding_service as _emb  # noqa: E402


async def main():
    print("=" * 60)
    print("🚀 RMFOOD RAG 全链路验证测试")
    print("=" * 60)

    emb = _emb.EmbeddingService()
    store = _vs.VectorStore(persist_dir="./data/test_chromadb")
    store.reset()
    proc = _dp.DocumentProcessor()

    print(f"   Embedding: provider={emb.provider}, model={emb.model}")
    print(f"   Base URL:  {emb.base_url}")
    print(f"   API Key:   {emb.api_key[:8]}...{emb.api_key[-4:] if len(emb.api_key) > 12 else '(none)'}")
    print()

    # 测试 1: 文档分块
    print("🧪 测试 1: 文档分块")
    test_text = "枸杞子具有滋补肝肾、益精明目的功效。富含枸杞多糖和类胡萝卜素。黄芪补气升阳。党参补中益气。甘草调和诸药。当归补血活血。"
    chunks = proc.chunk_text(test_text, "测试文档.txt")
    print(f"   ✅ {len(chunks)} 个片段")
    assert len(chunks) > 0

    # 测试 2: 向量化
    print("\n🧪 测试 2: 文本向量化")
    try:
        embeddings = await emb.embed_texts([c.content for c in chunks])
        print(f"   ✅ API: {len(embeddings)} 维={len(embeddings[0])}")
    except Exception as e:
        print(f"   ⚠️  API 失败 ({e})")
        embeddings = emb._embed_fallback([c.content for c in chunks])
        print(f"   → Fallback: 维={len(embeddings[0])}")

    # 测试 3: 向量存储 + 检索
    print("\n🧪 测试 3: 向量存储与检索")
    store.add_chunks(chunks, embeddings)
    print(f"   ✅ 存储: {store.chunk_count} 块")
    q_vec = (await emb.embed_texts(["枸杞子的功效是什么？"]))[0]
    results = store.search(q_vec, top_k=3)
    print(f"   ✅ 检索: {len(results)} 个匹配")
    for r in results:
        print(f"      score={r.score:.4f} | {r.chunk.content[:50]}...")
    assert len(results) > 0
    assert any("枸杞" in r.chunk.content for r in results)

    # 测试 4: Prompt 增强
    print("\n🧪 测试 4: Prompt 增强")
    context_parts = [f"[{c.chunk.metadata.get('source', '?')}] {c.chunk.content}" for c in results]
    augmented = f"参考文档:\n" + "\n".join(context_parts) + f"\n问题: 枸杞子的功效"
    print(f"   ✅ Prompt ({len(augmented)} 字)")
    assert "枸杞" in augmented

    # 测试 5: 文件管理
    print("\n🧪 测试 5: 文件管理")
    assert "测试文档.txt" in store.list_sources()
    store.delete_by_source("测试文档.txt")
    assert store.chunk_count == 0
    print(f"   ✅ 删除成功")

    store.reset()
    print("\n" + "=" * 60)
    print("✅ 全部测试通过！RAG 全链路验证成功！")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    exit(asyncio.run(main()))
