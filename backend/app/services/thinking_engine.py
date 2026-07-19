"""
智能推理引擎 - AI 思考过程与配方生成核心

将配方的生成过程分解为可追溯的推理步骤：
1. 问题理解 (Understand)
2. 知识检索 (KnowledgeRetrieval)
3. 配方设计 (FormulaDesign)
4. 安全评估 (SafetyCheck)
5. 优化建议 (Optimization)

拆分后的模块：
- knowledge_base: 药材知识库数据
- intent_analyzer: 意图分析
- knowledge_retriever: 知识检索
- reasoner: 推理分析
- formula_designer: 配方设计
- answer_formatter: 回答格式化
"""
from __future__ import annotations
import logging
import time
from typing import AsyncGenerator

from .knowledge_base import HERB_KNOWLEDGE_BASE, search_herbs
from .intent_analyzer import IntentAnalyzer
from .knowledge_retriever import KnowledgeRetriever
from .reasoner import Reasoner
from .formula_designer import FormulaDesigner
from .answer_formatter import AnswerFormatter

logger = logging.getLogger(__name__)


class ThinkingEngine:
    """
    AI 配方推理引擎 - 生成带思考过程的流式响应

    每个推理步骤包含：
    - step: 步骤名称
    - content: 推理内容
    - status: thinking/complete
    - detail: 详细推理说明（折叠）
    """

    def __init__(self):
        self._knowledge_base = HERB_KNOWLEDGE_BASE
        self._intent_analyzer = IntentAnalyzer(herb_matcher=search_herbs)
        self._retriever = KnowledgeRetriever(self._knowledge_base)
        self._reasoner = Reasoner(self._knowledge_base)
        self._designer = FormulaDesigner(self._knowledge_base)
        self._formatter = AnswerFormatter(self._knowledge_base)

    async def generate_thinking_stream(
        self, question: str
    ) -> AsyncGenerator[dict, None]:
        """生成带思考过程的流式响应"""

        intent = self._intent_analyzer.analyze(question)

        # Step 1: 问题理解
        yield {
            "type": "thinking",
            "step": "问题理解",
            "status": "thinking",
            "content": "正在分析用户问题意图...",
        }
        await self._simulate_delay(0.3)
        yield {
            "type": "thinking",
            "step": "问题理解",
            "status": "complete",
            "content": intent["analysis"],
        }

        # Step 2: 知识检索
        yield {
            "type": "thinking",
            "step": "知识检索",
            "status": "thinking",
            "content": "正在检索相关药食同源知识库...",
        }
        await self._simulate_delay(0.5)
        knowledge = self._retriever.retrieve(intent)
        yield {
            "type": "thinking",
            "step": "知识检索",
            "status": "complete",
            "content": knowledge["summary"],
            "detail": knowledge["details"],
        }

        # Step 3: 推理分析
        yield {
            "type": "thinking",
            "step": "推理分析",
            "status": "thinking",
            "content": "正在基于知识库进行综合推理...",
        }
        await self._simulate_delay(0.4)
        reasoning = self._reasoner.reason(intent)
        yield {
            "type": "thinking",
            "step": "推理分析",
            "status": "complete",
            "content": reasoning["summary"],
            "detail": reasoning["details"],
        }

        # Step 4: 配方设计（如果是配方相关问题）
        if intent["needs_formula"]:
            yield {
                "type": "thinking",
                "step": "配方设计",
                "status": "thinking",
                "content": "正在根据君臣佐使原则设计配方...",
            }
            await self._simulate_delay(0.6)
            reasoning = await self._designer.design(intent, knowledge)
            yield {
                "type": "thinking",
                "step": "配方设计",
                "status": "complete",
                "content": reasoning.get("summary", ""),
                "detail": reasoning.get("details", ""),
                "formula_data": reasoning.get("data"),
            }

        # Step 5: 生成最终回答
        yield {
            "type": "thinking",
            "step": "生成回答",
            "status": "thinking",
            "content": "正在整理最终回答...",
        }
        await self._simulate_delay(0.3)
        final_answer = self._formatter.format(intent, knowledge, reasoning)
        yield {
            "type": "text",
            "content": final_answer,
        }

    async def _simulate_delay(self, seconds: float):
        """模拟思考延迟（已禁用 — 改为即时输出以提升降级路径体验）"""
        return


# 全局推理引擎实例
thinking_engine = ThinkingEngine()
