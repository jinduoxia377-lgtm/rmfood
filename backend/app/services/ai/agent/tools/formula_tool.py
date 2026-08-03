"""
配方生成工具

基于 KnowledgeRetriever + FormulaDesigner，为 Agent 提供配方自动生成能力。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from app.services.knowledge_retriever import KnowledgeRetriever
from app.services.formula_designer import FormulaDesigner
from . import BaseAgentTool, ToolResult, register_tool
from .compliance_tool import FOOD_HERB_LIMITS

logger = logging.getLogger(__name__)


# 内置知识库种子（小样本，实际数据从 TCMSP/DFBP 导入）
_KB_SEED: Dict[str, Dict[str, Any]] = {
    "人参": {
        "pinyin": "ren shen",
        "property": "微温",
        "meridian": ["脾", "肺", "心"],
        "effects": ["大补元气", "复脉固脱", "补脾益肺", "生津安神"],
        "chemicals": ["人参皂苷Rg1", "人参皂苷Rb1", "人参皂苷Rg3"],
        "dosage": "3-9g",
        "is_food_homology": False,
    },
    "黄芪": {
        "pinyin": "huang qi",
        "property": "微温",
        "meridian": ["肺", "脾"],
        "effects": ["补气升阳", "固表止汗", "利水消肿", "托毒排脓"],
        "chemicals": ["黄芪多糖", "黄芪皂苷I", "毛蕊异黄酮"],
        "dosage": "9-30g",
        "is_food_homology": True,
    },
    "枸杞": {
        "pinyin": "gou qi",
        "property": "平",
        "meridian": ["肝", "肾"],
        "effects": ["滋补肝肾", "益精明目"],
        "chemicals": ["枸杞多糖", "玉米黄质", "β-胡萝卜素"],
        "dosage": "6-12g",
        "is_food_homology": True,
    },
    "红枣": {
        "pinyin": "hong zao",
        "property": "温",
        "meridian": ["脾", "胃"],
        "effects": ["补中益气", "养血安神"],
        "chemicals": ["环磷酸腺苷", "红枣多糖", "维生素C"],
        "dosage": "9-15g",
        "is_food_homology": True,
    },
    "茯苓": {
        "pinyin": "fu ling",
        "property": "平",
        "meridian": ["心", "肺", "脾", "肾"],
        "effects": ["利水渗湿", "健脾宁心"],
        "chemicals": ["茯苓多糖", "茯苓酸", "麦角甾醇"],
        "dosage": "9-15g",
        "is_food_homology": True,
    },
    "山药": {
        "pinyin": "shan yao",
        "property": "平",
        "meridian": ["脾", "肺", "肾"],
        "effects": ["补脾养胃", "生津益肺", "补肾涩精"],
        "chemicals": ["薯蓣皂苷", "多酚氧化酶", "粘液蛋白"],
        "dosage": "15-30g",
        "is_food_homology": True,
    },
    "菊花": {
        "pinyin": "ju hua",
        "property": "微寒",
        "meridian": ["肺", "肝"],
        "effects": ["散风清热", "平肝明目", "清热解毒"],
        "chemicals": ["菊花黄酮", "芹菜素", "龙胆素"],
        "dosage": "5-10g",
        "is_food_homology": True,
    },
    "薄荷": {
        "pinyin": "bo he",
        "property": "凉",
        "meridian": ["肺", "肝"],
        "effects": ["疏散风热", "清利头目", "利咽透疹", "疏肝行气"],
        "chemicals": ["薄荷脑", "薄荷酮", "薄荷醇"],
        "dosage": "3-6g",
        "is_food_homology": True,
    },
}


@register_tool
class FormulaGenerationTool(BaseAgentTool):
    """根据用户意图自动生成药食同源配方"""

    @property
    def name(self) -> str:
        return "generate_formula"

    @property
    def description(self) -> str:
        return (
            "根据目标功效和用户约束，自动生成药食同源配方。"
            "支持多功效组合、人群适配和剂量推荐。"
            "返回包含君臣佐使结构的完整配方方案。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "target_effects": {
                    "type": "array",
                    "description": "目标功效列表，如 ['免疫调节', '抗氧化']",
                    "items": {"type": "string"},
                },
                "product_type": {
                    "type": "string",
                    "description": "产品类型，如 '饮品', '粉剂', '胶囊'",
                    "default": "饮品",
                },
                "target_population": {
                    "type": "string",
                    "description": "目标人群",
                    "default": "adults",
                },
                "budget_constraint": {
                    "type": "number",
                    "description": "预算约束（元/kg），可选",
                },
            },
            "required": ["target_effects"],
        }

    def __init__(self):
        self._knowledge_base = _KB_SEED
        self._retriever = KnowledgeRetriever(self._knowledge_base)
        self._designer = FormulaDesigner(self._knowledge_base)

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            target_effects: List[str] = params["target_effects"]
            product_type: str = params.get("product_type", "饮品")
            population: str = params.get("target_population", "adults")

            # 构建意图
            intent = {
                "target_effects": target_effects,
                "product_type": product_type,
                "target_population": population,
            }

            # 检索相关知识
            retrieval_result = self._retriever.retrieve(intent)

            # 设计配方
            formula_result = await self._designer.design(intent, self._knowledge_base)

            elapsed = (time.time() - start) * 1000
            logger.info(
                "Formula generated: effects=%r product=%s latency=%dms",
                target_effects, product_type, elapsed,
            )

            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    **formula_result,
                    "knowledge_context": retrieval_result,
                    "product_type": product_type,
                    "target_population": population,
                },
                latency_ms=elapsed,
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.warning("Formula generation error: %s", e, exc_info=True)
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
                latency_ms=elapsed,
            )


@register_tool
class IngredientInfoTool(BaseAgentTool):
    """查询单个药材/食材的详细信息"""

    @property
    def name(self) -> str:
        return "ingredient_info"

    @property
    def description(self) -> str:
        return "查询药食同源药材的详细信息，包括性味归经、功效、化学成分和用量范围。"

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "药材名称",
                },
            },
            "required": ["name"],
        }

    def __init__(self):
        self._kb = _KB_SEED

    async def execute(self, params: dict, context: dict) -> ToolResult:
        try:
            name = params["name"]
            info = self._kb.get(name)
            if not info:
                # 模糊匹配
                matches = [k for k in self._kb if name in k or k in name]
                if matches:
                    return ToolResult(
                        tool_name=self.name,
                        success=True,
                        data={
                            "suggestions": matches,
                            "message": f"未找到'{name}'，您是否指：{matches}",
                        },
                    )
                return ToolResult(
                    tool_name=self.name,
                    success=False,
                    error=f"未知药材: {name}",
                )
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={
                    "name": name,
                    **info,
                    "max_dosage": FOOD_HERB_LIMITS.get(name, {}).get("max_dosage_mg_per_day", "N/A"),
                },
            )
        except Exception as e:
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e),
            )
