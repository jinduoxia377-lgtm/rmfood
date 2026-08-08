"""
RAG 检索工具

包装 RAGService，为 Agent 提供知识检索能力。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.services.ai.rag.rag_service import rag_service

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@register_tool
class RAGRetrievalTool(BaseAgentTool):
    """检索知识库中的相关片段，用于回答配方/法规/原料相关问题"""

    @property
    def name(self) -> str:
        return "rag_retrieve"

    @property
    def description(self) -> str:
        return (
            "从药食同源知识库中检索与查询相关的文档片段。"
            "适用场景：查询药材功效、法规标准、原料信息、配方设计依据。"
            "返回包含来源、相关度和文本片段的检索结果。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "检索查询语句，应具体明确",
                },
                "top_k": {
                    "type": "integer",
                    "description": "返回结果数量，默认5",
                    "default": 5,
                },
                "source_filter": {
                    "type": "string",
                    "description": "可选，限制特定文档来源（如 'TCMSP' 或 'DFBP'）",
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

            chunks = [
                {
                    "content": c.chunk.content,
                    "source": c.chunk.metadata.get("source", "unknown"),
                    "score": round(c.score, 4),
                    "section": c.chunk.metadata.get("section", ""),
                }
                for c in result.chunks
            ]

            elapsed = (time.time() - start) * 1000
            logger.info(
                "RAG tool: query=%r top_k=%d results=%d latency=%dms",
                query[:50], top_k, len(chunks), elapsed,
            )
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "chunks": chunks,
                    "augmented_prompt": result.augmented_prompt,
                    "total_chunks_indexed": result.total_chunks,
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("RAG tool error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )


@register_tool
class RAGStatsTool(BaseAgentTool):
    """查询知识库统计信息"""

    @property
    def name(self) -> str:
        return "rag_stats"

    @property
    def description(self) -> str:
        return "查询知识库的统计信息，包括文档数量、分块数量和来源列表。"

    @property
    def parameters(self) -> dict:
        return {"type": "object", "properties": {}}

    async def execute(self, params: dict, context: dict) -> ToolResult:
        try:
            stats = rag_service.get_stats()
            return ToolResult(
                tool_name=self.name,
                success=True,
                data=stats,
            )
        except Exception as e:
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )
