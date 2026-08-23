"""
文献检索工具

基于 RAG 知识库进行学术文献检索。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.services.ai.rag.rag_service import rag_service

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@register_tool
class LiteratureSearchTool(BaseAgentTool):
    """检索药食同源相关学术文献"""

    @property
    def name(self) -> str:
        return "literature_search"

    @property
    def description(self) -> str:
        return (
            "从药食同源知识库中检索与查询相关的学术文献和研究报告。"
            "返回文献标题、来源、相关度和摘要片段。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "检索查询语句",
                },
                "top_k": {
                    "type": "integer",
                    "description": "返回结果数量",
                    "default": 5,
                },
                "source_filter": {
                    "type": "string",
                    "description": "限制特定来源（如 'TCMSP', '文献'）",
                },
            },
            "required": ["query"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            query: str = params["query"]
            top_k: int = params.get("top_k", 5)

            result = await rag_service.augment_query(query, top_k=top_k)

            items = [
                {
                    "content": c.chunk.content[:300],
                    "source": c.chunk.metadata.get("source", "unknown"),
                    "score": round(c.score, 4),
                    "section": c.chunk.metadata.get("section", ""),
                }
                for c in result.chunks
            ]

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "items": items,
                    "total_found": len(items),
                    "query": query,
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Literature search error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )
