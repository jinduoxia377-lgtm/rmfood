"""
成分贡献度分析服务

量化每个成分对目标功效的贡献程度，
支持"君臣佐使"角色分配。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.services.report.explainability_report import (
    ExplainabilityService,
)

logger = logging.getLogger(__name__)


class ContributionAnalyzer:
    """
    成分贡献度分析器

    分析每个成分对目标功效的贡献，
    并分配"君臣佐使"角色。
    """

    def __init__(self, service: Optional[ExplainabilityService] = None):
        self._service = service or ExplainabilityService()

    def analyze(
        self,
        ingredients: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> Dict[str, Any]:
        """
        分析成分贡献度

        Returns:
            {
                "core": [...],     # 君药
                "primary": [...],  # 臣药
                "supporting": [...], # 佐药
                "moderator": [...],  # 使药
                "summary": {...}
            }
        """
        # 复用 ExplainabilityService 的分析逻辑
        report = self._service.analyze(
            formula_name="contribution_analysis",
            ingredients=ingredients,
            target_effects=target_effects,
        )

        # 构建贡献度报告
        return {
            "core": [
                {
                    "name": i.name,
                    "efficacy_contribution": i.efficacy_contribution,
                    "mechanism": i.mechanism,
                    "evidence": i.evidence,
                    "safety_score": i.safety_score,
                }
                for i in report.core_ingredients
            ],
            "primary": [
                {
                    "name": i.name,
                    "efficacy_contribution": i.efficacy_contribution,
                    "mechanism": i.mechanism,
                }
                for i in report.primary_ingredients
            ],
            "supporting": [
                {
                    "name": i.name,
                    "efficacy_contribution": i.efficacy_contribution,
                }
                for i in report.supporting_ingredients
            ],
            "total_ingredients": len(ingredients),
            "effect_coverage": report.efficacy_score,
        }

    def get_role_assignment(
        self,
        ingredients: List[Dict[str, Any]],
        target_effects: List[str],
    ) -> Dict[str, List[str]]:
        """获取君臣佐使角色分配"""
        analysis = self.analyze(ingredients, target_effects)

        return {
            "君 (Core)": [i["name"] for i in analysis["core"]],
            "臣 (Primary)": [i["name"] for i in analysis["primary"]],
            "佐 (Supporting)": [i["name"] for i in analysis["supporting"]],
            "使 (Moderator)": [],  # 暂不支持自动识别
        }
