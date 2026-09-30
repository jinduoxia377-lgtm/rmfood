"""Seed RAG database with formula_tool built-in herb knowledge."""
import asyncio, sys
sys.path.insert(0, '.')

from app.services.ai.rag.rag_service import rag_service
from app.services.ai.agent.tools.formula_tool import _KB_SEED

async def main():
    # Build seed documents from _KB_SEED
    lines = [
        "# 药食同源药材知识库",
        "",
        "以下是药食同源药材的详细信息，包含性味归经、功效、活性成分和用量范围。",
        "",
    ]
    for name, info in _KB_SEED.items():
        lines.append(f"## {name}")
        lines.append(f"- 性味：{info.get('property', '')}")
        lines.append(f"- 归经：{', '.join(info.get('meridian', []))}")
        lines.append(f"- 功效：{', '.join(info.get('effects', []))}")
        lines.append(f"- 活性成分：{', '.join(info.get('chemicals', []))}")
        lines.append(f"- 建议用量：{info.get('dosage', '')}")
        lines.append(f"- 药食同源：{'是' if info.get('is_food_homology') else '否'}")
        lines.append("")

    doc_content = "\n".join(lines)
    print(f"Document length: {len(doc_content)} chars")
    print(f"First 200 chars: {doc_content[:200]}")

    # Ingest into RAG
    result = await rag_service.ingest_document(
        content=doc_content.encode('utf-8'),
        filename="herb_knowledge_base.md",
    )
    print(f"Ingest result: {result}")

    # Verify
    stats = rag_service.get_stats()
    print(f"Stats: {stats}")

if __name__ == "__main__":
    asyncio.run(main())
