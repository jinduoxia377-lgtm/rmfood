"""
Agent 辩论机制

让不同 Agent 对同一配方提出正反意见，由编排器综合决策。

架构：
1. FormulaAgent 提出配方方案
2. SafetyAgent 评估风险
3. KnowledgeAgent 提供文献依据
4. Orchestrator 综合各方意见生成最终建议
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.ai.agent.tools import get_tool_registry

logger = logging.getLogger(__name__)


@dataclass
class DebateRound:
    """辩论轮次"""
    round_number: int
    formula_agent_opinion: Dict[str, Any] = field(default_factory=dict)
    safety_agent_opinion: Dict[str, Any] = field(default_factory=dict)
    knowledge_agent_opinion: Dict[str, Any] = field(default_factory=dict)
    consensus: Optional[str] = None


@dataclass
class DebateResult:
    """辩论结果"""
    formula: str
    is_safe: bool
    risk_summary: str
    supporting_evidence: List[str] = field(default_factory=list)
    concerns: List[str] = field(default_factory=list)
    final_recommendation: str = ""
    rounds: List[DebateRound] = field(default_factory=list)
    total_latency_ms: float = 0.0
    consensus: Optional[str] = None


class AgentDebate:
    """
    Agent 间辩论机制

    多 Agent 对同一配方进行多维度评估，生成综合建议。
    """

    def __init__(self):
        self._registry = get_tool_registry()

    async def run_debate(
        self,
        formula: str,
        ingredients: List[Dict[str, Any]],
        target_effects: List[str],
        debate_rounds: int = 2,
    ) -> DebateResult:
        """
        运行多轮辩论

        Args:
            formula: 配方名称/描述
            ingredients: 成分列表 [{"name": str, "dosage_mg": float}]
            target_effects: 目标功效列表
            debate_rounds: 辩论轮次

        Returns:
            DebateResult: 综合辩论结果
        """
        total_start = time.time()
        result = DebateResult(formula=formula, is_safe=True, risk_summary="")
        rounds = []

        for round_idx in range(debate_rounds):
            round_start = time.time()
            debate_round = DebateRound(round_number=round_idx + 1)

            # 并行调用各 Agent
            tasks = [
                self._safety_debate(ingredients, round_idx),
                self._knowledge_debate(formula, target_effects, round_idx),
            ]
            safety_opinion, knowledge_opinion = await asyncio.gather(*tasks)

            debate_round.safety_agent_opinion = safety_opinion
            debate_round.knowledge_agent_opinion = knowledge_opinion

            # 综合判断
            is_safe = safety_opinion.get("is_safe", True)
            risks = safety_opinion.get("risks", [])
            evidence = knowledge_opinion.get("evidence", [])
            concerns = [r.get("description", "") for r in risks if r.get("level") == "high"]

            debate_round.formula_agent_opinion = {
                "formula": formula,
                "is_safe": is_safe,
                "round": round_idx + 1,
            }

            # 多轮辩论时综合前轮结论
            if round_idx > 0 and result.consensus:
                debate_round.consensus = f"第{round_idx}轮结论：{result.consensus}"

            rounds.append(debate_round)
            result.rounds.append(debate_round)
            result.supporting_evidence.extend(evidence)
            result.concerns.extend(concerns)
            result.is_safe = is_safe and result.is_safe

            round_latency = (time.time() - round_start) * 1000
            logger.info(
                "Debate round %d: safe=%s latency=%.0fms",
                round_idx + 1, is_safe, round_latency,
            )

        # 生成最终建议
        result.final_recommendation = self._synthesize_recommendation(result, rounds)
        result.total_latency_ms = (time.time() - total_start) * 1000

        logger.info(
            "Debate complete: safe=%s rounds=%d latency=%.0fms",
            result.is_safe, len(rounds), result.total_latency_ms,
        )
        return result

    async def _safety_debate(
        self, ingredients: List[Dict[str, Any]], round_idx: int
    ) -> Dict[str, Any]:
        """Safety Agent 发言"""
        tool = self._registry.get("safety_assess")
        if not tool:
            return {"is_safe": True, "risks": [], "opinion": f"Round {round_idx + 1}: 无安全评估工具"}

        try:
            result = await tool.execute(
                {"ingredients": ingredients, "target_population": "adults"},
                {},
            )
            return {
                "is_safe": result.data.get("is_safe", True) if result.success else True,
                "risks": result.data.get("risks", []),
                "risk_count": result.data.get("risk_count", 0),
                "opinion": f"Round {round_idx + 1}: {'安全' if result.data.get('is_safe') else '存在风险'}",
            }
        except Exception as e:
            logger.warning("Safety agent error in round %d: %s", round_idx + 1, e)
            return {"is_safe": True, "risks": [], "opinion": f"Round {round_idx + 1}: 评估失败"}

    async def _knowledge_debate(
        self, formula: str, effects: List[str], round_idx: int
    ) -> Dict[str, Any]:
        """Knowledge Agent 发言"""
        tool = self._registry.get("literature_search")
        if not tool:
            return {"evidence": [], "opinion": f"Round {round_idx + 1}: 无文献检索工具"}

        try:
            result = await tool.execute(
                {"query": f"{formula} {effects[0] if effects else '功效'} 文献依据", "top_k": 3},
                {},
            )
            evidence = [
                item.get("content", "")[:150]
                for item in (result.data.get("items", []))
                if result.success
            ]
            return {
                "evidence": evidence,
                "source_count": len(evidence),
                "opinion": f"Round {round_idx + 1}: 找到 {len(evidence)} 条文献依据",
            }
        except Exception as e:
            logger.warning("Knowledge agent error in round %d: %s", round_idx + 1, e)
            return {"evidence": [], "opinion": f"Round {round_idx + 1}: 检索失败"}

    def _synthesize_recommendation(
        self, result: DebateResult, rounds: List[DebateRound]
    ) -> str:
        """综合所有轮次意见，生成最终建议"""
        parts = [f"## 配方辩论结论：{result.formula}\n"]

        if result.is_safe:
            parts.append("**安全性评估：通过**\n")
        else:
            parts.append("**安全性评估：存在风险，需要调整**\n")

        if result.concerns:
            parts.append("**主要风险点：**\n")
            for concern in result.concerns[:3]:
                parts.append(f"- {concern}\n")

        if result.supporting_evidence:
            parts.append("**文献依据：**\n")
            for evidence in result.supporting_evidence[:2]:
                parts.append(f"- {evidence[:100]}...\n")

        # 基于最后一轮共识生成建议
        if rounds:
            last_round = rounds[-1]
            if last_round.safety_agent_opinion.get("is_safe"):
                parts.append(
                    "\n**综合建议**：配方安全性良好，建议按此方案推进后续实验验证。"
                )
            else:
                parts.append(
                    "\n**综合建议**：配方存在安全风险，建议调整成分后重新评估。"
                )

        return "\n".join(parts)
