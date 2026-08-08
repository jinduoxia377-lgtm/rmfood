"""
RAG 问答工具 (v1.0)

基于 RAG 知识库的专业问答工具，为 Agent 提供知识检索能力。
集成 PromptGuard 安全检测，确保问答内容安全合规。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.services.ai.rag.rag_service import rag_service
from app.services.ai.safety import check_prompt, check_output

from . import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@register_tool
class QAAnswerTool(BaseAgentTool):
    """基于RAG知识库的专业问答工具"""

    @property
    def name(self) -> str:
        return "qa_answer"

    @property
    def description(self) -> str:
        return (
            "基于药食同源知识库回答专业问题。"
            "适用场景：药材功效查询、法规标准咨询、配方设计建议、配伍禁忌查询。"
            "返回结构化答案，包含引用来源和相关度评分。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "专业问题，应具体明确",
                },
                "top_k": {
                    "type": "integer",
                    "description": "返回引用数量，默认5",
                    "default": 5,
                },
                "include_sources": {
                    "type": "boolean",
                    "description": "是否包含引用来源详情",
                    "default": True,
                },
            },
            "required": ["question"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            question: str = params["question"]
            top_k: int = params.get("top_k", 5)
            include_sources: bool = params.get("include_sources", True)

            # 安全检查：问题注入检测
            guard_result = check_prompt(question)
            if guard_result.is_blocked:
                return ToolResult(
                    tool_name=self.name,
                    success=False,
                    error=f"问题包含安全风险: {guard_result.action}",
                    latency_ms=0,
                )

            # 调用 RAG 服务
            result = await rag_service.augment_query(question, top_k=top_k)

            # 构建答案
            answer_parts = [f"**问题**: {question}\n"]

            if result.chunks:
                answer_parts.append(f"**检索到 {len(result.chunks)} 条相关资料**:\n")
                for i, chunk in enumerate(result.chunks, 1):
                    source = chunk.chunk.metadata.get("source", "未知来源")
                    answer_parts.append(
                        f"\n---\n**[{i}] {source}** (相关度: {chunk.score:.2f})\n"
                        f"{chunk.chunk.content}"
                    )

                if include_sources:
                    answer_parts.append("\n---\n**参考来源**:\n")
                    for i, chunk in enumerate(result.chunks, 1):
                        source = chunk.chunk.metadata.get("source", "未知来源")
                        answer_parts.append(
                            f"{i}. [{source}] (相关度: {chunk.score:.2f})\n"
                        )
            else:
                answer_parts.append(
                    "\n⚠️ 知识库中未找到相关资料，请尝试换种提问方式。\n"
                )

            # 输出安全检查
            raw_answer = "\n".join(answer_parts)
            output_result = check_output(raw_answer)
            final_answer = (
                output_result.sanitized_text if not output_result.is_safe else raw_answer
            )

            elapsed = (time.time() - start) * 1000
            logger.info(
                "QA tool: question=%r top_k=%d chunks=%d latency=%dms",
                question[:50], top_k, len(result.chunks), elapsed,
            )

            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "question": question,
                    "answer": final_answer,
                    "chunks_count": len(result.chunks),
                    "sources": [
                        c.chunk.metadata.get("source", "unknown")
                        for c in result.chunks
                    ],
                    "safety_check": {
                        "input_score": guard_result.security_score,
                        "output_safe": output_result.is_safe,
                    },
                },
                latency_ms=elapsed,
            )

        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("QA tool error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )
