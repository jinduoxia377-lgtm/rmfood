"""
知识图谱推理 Agent (v1.0)

基于 ReAct 模式的图谱推理 Agent，支持：
- 图谱查询（kg_query）
- 图谱推理（kg_reason）
- 可视化建议（kg_visualize）

Agent 可以驱动 LLM 进行图谱探索和问题解答。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from app.services.kg.reasoning_engine import (
    KnowledgeGraphReasoningEngine,
    get_reasoning_engine,
)

from ..ai.agent.tools import BaseAgentTool, ToolResult, register_tool

logger = logging.getLogger(__name__)


@register_tool
class KGQueryTool(BaseAgentTool):
    """知识图谱查询工具"""

    @property
    def name(self) -> str:
        return "kg_query"

    @property
    def description(self) -> str:
        return (
            "查询知识图谱中的节点和关系。"
            "支持搜索药材、化合物、靶点、疾病等节点，"
            "获取节点的邻居关系和路径信息。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["search", "neighbors", "path"],
                    "description": "查询动作：search=搜索节点, neighbors=获取邻居, path=查找路径",
                },
                "query": {
                    "type": "string",
                    "description": "搜索关键词或节点标签",
                },
                "node_type": {
                    "type": "string",
                    "enum": ["herb", "compound", "target", "disease"],
                    "description": "节点类型过滤",
                },
                "target_node": {
                    "type": "string",
                    "description": "path动作时的目标节点",
                },
                "max_depth": {
                    "type": "integer",
                    "description": "搜索深度，默认3",
                    "default": 3,
                },
            },
            "required": ["action", "query"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            action = params["action"]
            query = params["query"]
            node_type = params.get("node_type")
            max_depth = params.get("max_depth", 3)

            if action == "search":
                result = await self._search_nodes(query, node_type, max_depth)
            elif action == "neighbors":
                result = await self._get_neighbors(query, max_depth)
            elif action == "path":
                target = params.get("target_node", "")
                result = await self._find_path(query, target, max_depth)
            else:
                return ToolResult(
                    tool_name=self.name,
                    success=False,
                    error=f"未知动作: {action}",
                )

            elapsed = (time.time() - start) * 1000
            logger.info(
                "KG query tool: action=%s query=%r results=%d latency=%dms",
                action, query[:30], len(result.get("nodes", [])), elapsed,
            )
            return ToolResult(
                tool_name=self.name,
                success=True,
                data=result,
                latency_ms=elapsed,
            )

        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("KG query tool error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )

    async def _search_nodes(
        self, query: str, node_type: Optional[str], max_depth: int
    ) -> Dict[str, Any]:
        """搜索节点"""
        # 简化实现：返回模拟数据
        # 实际项目应调用 GraphQueryService
        return {
            "nodes": [
                {"label": query, "type": node_type or "herb", "id": 1},
            ],
            "edges": [],
            "count": 1,
        }

    async def _get_neighbors(
        self, node_label: str, depth: int
    ) -> Dict[str, Any]:
        """获取邻居"""
        return {
            "center": node_label,
            "neighbors": [],
            "depth": depth,
        }

    async def _find_path(
        self, source: str, target: str, max_depth: int
    ) -> Dict[str, Any]:
        """查找路径"""
        return {
            "source": source,
            "target": target,
            "path": [],
            "found": False,
        }


@register_tool
class KGReasonTool(BaseAgentTool):
    """知识图谱推理工具"""

    @property
    def name(self) -> str:
        return "kg_reason"

    @property
    def description(self) -> str:
        return (
            "执行知识图谱推理，包括：路径发现、协同效应预测、配伍冲突检测。"
            "适用场景：分析药材组合的功效、检测配伍禁忌、发现潜在协同关系。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "reasoning_type": {
                    "type": "string",
                    "enum": ["path", "synergy", "conflict", "all"],
                    "description": "推理类型",
                },
                "herbs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "药材列表",
                },
                "source_herb": {
                    "type": "string",
                    "description": "path推理的源药材",
                },
                "target_disease": {
                    "type": "string",
                    "description": "path推理的目标疾病",
                },
                "population": {
                    "type": "string",
                    "enum": ["adults", "children", "pregnancy"],
                    "description": "目标人群（conflict推理）",
                    "default": "adults",
                },
            },
            "required": ["reasoning_type", "herbs"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            engine: KnowledgeGraphReasoningEngine = get_reasoning_engine()
            reasoning_type = params.get("reasoning_type", "all")
            herbs = params.get("herbs", [])
            population = params.get("population", "adults")

            if reasoning_type == "path":
                source = params.get("source_herb", herbs[0] if herbs else "")
                target = params.get("target_disease", "")
                paths = await engine.infer_path(source, target)
                result = {"paths": [p.to_dict() if hasattr(p, 'to_dict') else vars(p) for p in paths]}

            elif reasoning_type == "synergy":
                synergies = await engine.infer_synergy(herbs)
                result = {
                    "synergies": [
                        {
                            "herb_a": s.herb_a,
                            "herb_b": s.herb_b,
                            "type": s.synergy_type.value,
                            "confidence": s.confidence,
                            "reasoning": s.reasoning,
                        }
                        for s in synergies
                    ]
                }

            elif reasoning_type == "conflict":
                conflicts = await engine.infer_conflicts(herbs, population)
                result = {
                    "conflicts": [
                        {
                            "herb_a": c.herb_a,
                            "herb_b": c.herb_b,
                            "type": c.conflict_type.value,
                            "severity": c.severity,
                            "description": c.description,
                            "suggestion": c.suggestion,
                        }
                        for c in conflicts
                    ]
                }

            else:  # all
                report = await engine.infer(
                    query=f"分析{herbs}",
                    inference_type="all",
                    herbs=herbs,
                )
                result = report.to_dict()

            elapsed = (time.time() - start) * 1000
            logger.info(
                "KG reason tool: type=%s herbs=%s results=%d latency=%dms",
                reasoning_type, herbs, len(str(result)), elapsed,
            )
            return ToolResult(
                tool_name=self.name,
                success=True,
                data=result,
                latency_ms=elapsed,
            )

        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("KG reason tool error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )


@register_tool
class KGVisualizeTool(BaseAgentTool):
    """知识图谱可视化建议工具"""

    @property
    def name(self) -> str:
        return "kg_visualize"

    @property
    def description(self) -> str:
        return (
            "生成知识图谱可视化建议。"
            "返回节点列表、边列表和布局建议，供前端 D3 渲染。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "nodes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "要可视化的节点标签列表",
                },
                "include_neighbors": {
                    "type": "boolean",
                    "description": "是否包含邻居节点",
                    "default": True,
                },
                "max_neighbors": {
                    "type": "integer",
                    "description": "每个节点的最大邻居数",
                    "default": 10,
                },
            },
            "required": ["nodes"],
        }

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            nodes = params.get("nodes", [])
            params.get("include_neighbors", True)
            params.get("max_neighbors", 10)

            # 简化实现：返回模拟可视化数据
            viz_data = {
                "nodes": [
                    {"id": n, "label": n, "type": "herb", "x": 0, "y": 0}
                    for n in nodes
                ],
                "edges": [],
                "layout": "force_directed",
                "suggestions": [
                    "使用 D3 force simulation 布局",
                    "按 node_type 着色",
                    "边粗细表示关系强度",
                ],
            }

            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=True,
                data=viz_data,
                latency_ms=elapsed,
            )

        except Exception as e:
            elapsed = (time.time() - start) * 1000
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )
