"""RAG 配方知识库种子注入脚本（可重复运行）

将平台内置的三大知识源注入 ChromaDB `rag_documents` collection：
1. tcm_herb_encyclopedia.md  （药食同源药材百科，MMID 传统属性合并）
2. food_homology_catalog.md  （药食同源物品目录）
3. food_safety_regulations.md（食品安全法规与标准）

幂等设计：已注入则跳过（seed_if_needed 按 source 文件名检查）。
运行后直接调用 augment_query / rag_enhance_formula_generation 验证检索可用。

用法（backend 目录）：
    venv/Scripts/python.exe scripts/seed_rag_formula_docs.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# 将 backend 目录加入 sys.path（脚本位于 backend/scripts/ 下）
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# 控制台输出使用 UTF-8（避免 Windows GBK 控制台对中文/emoji 报 UnicodeEncodeError）
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 加载 backend/.env（EMBEDDING_PROVIDER=local → fastembed 本地向量化，无需 API Key）
from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env", override=False)


async def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="RAG 配方知识库种子注入")
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制重建：先删除已有种子文档再注入（用于修复旧版缺 user_id 元数据的种子块）",
    )
    args = parser.parse_args()

    # 1) 幂等注入种子文档
    from app.services.ai.rag.seeder import SEED_DOCUMENT_NAMES, seed_if_needed
    from app.services.ai.rag.rag_service import rag_service
    from app.services.ai.rag.formula_rag_hook import rag_enhance_formula_generation

    if args.force:
        print("=== [0] --force 模式：整体重置 rag_documents collection（修复旧版缺 user_id 元数据/残留 ID） ===")
        # 直接删除整个 collection（比逐文档 delete 更彻底，避免 ChromaDB 段文件残留导致
        # 重新 add 时 “Add of existing embedding ID” 冲突与半成品数据）。
        rag_service.vector_store.reset()
        print("  已重置 collection，当前统计:", rag_service.get_stats(user_id=None))

    print("=== [1/4] 执行 seed_if_needed() ===")
    result = await seed_if_needed()
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))

    # 2) 查看 collection 统计
    print("\n=== [2/4] RAG collection 统计 ===")
    stats = rag_service.get_stats(user_id=None)
    print(json.dumps(stats, ensure_ascii=False, indent=2, default=str))

    # 3) 直调 augment_query 验证能返回 chunks
    print("\n=== [3/4] augment_query('增强免疫 药食同源 功效') ===")
    qres = await rag_service.augment_query("增强免疫 药食同源 功效", top_k=5, user_id=None)
    print(f"total_chunks(可见)={qres.total_chunks}, 返回 chunks={len(qres.chunks)}")
    for i, cr in enumerate(qres.chunks[:5], 1):
        src = (cr.chunk.metadata or {}).get("source", "unknown")
        print(f"  [{i}] source={src} score={cr.score:.4f} content={cr.chunk.content[:80]!r}")

    # 4) 直调 RAG 钩子验证 enabled=True 且 chunks 非空
    print("\n=== [4/4] rag_enhance_formula_generation(['增强免疫']) ===")
    signals = await rag_enhance_formula_generation(["增强免疫"], top_k=6, user_id=None)
    if signals is None:
        print("!! 钩子返回 None（异常降级）")
        return 2
    print(json.dumps(
        {
            "enabled": signals.get("enabled"),
            "query": signals.get("query"),
            "chunk_count": len(signals.get("chunks", [])),
            "whitelist": signals.get("whitelist"),
            "blacklist": signals.get("blacklist"),
            "summary": (signals.get("summary") or "")[:200],
        },
        ensure_ascii=False,
        indent=2,
    ))
    if not signals.get("enabled") or not signals.get("chunks"):
        print("!! RAG 钩子未生效：enabled=False 或 chunks 为空")
        return 3

    print("\n[OK] RAG 种子注入与检索验证通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))