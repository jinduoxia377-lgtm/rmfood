"""
预置报表模板定义

供 /analytics/reports/templates 接口使用，
避免将模板逻辑硬编码在 API 路由文件中。

扩展方式：在此文件末尾追加新模板字典即可。
"""

from typing import Any, Dict, List


REPORT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "formula_overview",
        "name": "配方总览报表",
        "description": "包含配方状态分布、月度趋势、TOP20 配方排行",
        "category": "summary",
        "widgets": [
            {
                "type": "kpi",
                "title": "配方总数",
                "metric": "total_formulas",
            },
            {
                "type": "chart",
                "title": "配方状态分布",
                "chart_type": "pie",
                "entity": "formulas",
                "group_by": "status",
            },
            {
                "type": "chart",
                "title": "月度创建趋势",
                "chart_type": "area",
                "entity": "formulas",
                "group_by": "month",
            },
            {
                "type": "table",
                "title": "TOP20 配方",
                "entity": "formulas",
                "columns": ["id", "name", "code", "status", "creator_id", "created_at"],
                "limit": 20,
                "sort_by": "created_at",
                "sort_order": "desc",
            },
        ],
    },
    {
        "id": "experiment_analysis",
        "name": "实验分析报告",
        "description": "实验完成率、成功率趋势、研究者绩效排行",
        "category": "detail",
        "widgets": [
            {
                "type": "kpi",
                "title": "实验总数",
                "metric": "total_experiments",
            },
            {
                "type": "chart",
                "title": "实验趋势（近 12 月）",
                "chart_type": "line",
                "entity": "experiments",
                "metric": "count",
                "group_by": "month",
            },
            {
                "type": "chart",
                "title": "实验状态分布",
                "chart_type": "bar",
                "entity": "experiments",
                "group_by": "status",
            },
            {
                "type": "table",
                "title": "研究者实验排行",
                "entity": "experiments",
                "columns": ["researcher_id", "experiment_count", "completed_count"],
                "limit": 20,
                "sort_by": "experiment_count",
                "sort_order": "desc",
            },
        ],
    },
    {
        "id": "user_activity",
        "name": "用户活跃度报告",
        "description": "用户注册趋势、活跃用户统计、用户行为分析",
        "category": "summary",
        "widgets": [
            {
                "type": "kpi",
                "title": "总用户数",
                "metric": "total_users",
            },
            {
                "type": "kpi",
                "title": "30 天活跃用户",
                "metric": "active_users_30d",
            },
            {
                "type": "chart",
                "title": "用户注册趋势",
                "chart_type": "area",
                "entity": "users",
                "metric": "count",
                "group_by": "month",
            },
            {
                "type": "table",
                "title": "最新注册用户",
                "entity": "users",
                "columns": ["id", "username", "email", "role", "created_at"],
                "limit": 50,
                "sort_by": "created_at",
                "sort_order": "desc",
            },
        ],
    },
    {
        "id": "ingredient_inventory",
        "name": "食材库存报告",
        "description": "食材使用频率、类别分布、药食同源占比",
        "category": "detail",
        "widgets": [
            {
                "type": "table",
                "title": "食材列表",
                "entity": "ingredients",
                "columns": ["id", "name", "name_cn", "category", "source", "is_food_homology", "created_at"],
                "limit": 200,
            },
            {
                "type": "chart",
                "title": "食材类别分布",
                "chart_type": "pie",
                "entity": "ingredients",
                "group_by": "category",
            },
            {
                "type": "chart",
                "title": "来源分布",
                "chart_type": "bar",
                "entity": "ingredients",
                "group_by": "source",
            },
        ],
    },
    {
        "id": "food_homology_special",
        "name": "药食同源专题报告",
        "description": "药食同源食材使用统计、配伍规律、功效分析",
        "category": "trend",
        "widgets": [
            {
                "type": "kpi",
                "title": "药食同源配方占比",
                "metric": "food_homology_ratio",
            },
            {
                "type": "chart",
                "title": "药食同源食材使用 Top20",
                "chart_type": "bar",
                "entity": "ingredients",
                "group_by": "name",
                "filter": {"is_food_homology": True},
                "limit": 20,
            },
            {
                "type": "chart",
                "title": "药食同源配方月度趋势",
                "chart_type": "line",
                "entity": "formulas",
                "metric": "count",
                "group_by": "month",
                "filter": {"food_homology": True},
            },
        ],
    },
]


def get_template_by_id(template_id: str) -> Dict[str, Any] | None:
    """按 ID 查找报表模板。"""
    for tpl in REPORT_TEMPLATES:
        if tpl["id"] == template_id:
            return tpl
    return None


def get_templates_by_category(category: str | None = None) -> List[Dict[str, Any]]:
    """按分类过滤模板列表。"""
    if category:
        return [t for t in REPORT_TEMPLATES if t.get("category") == category]
    return REPORT_TEMPLATES


__all__ = [
    "REPORT_TEMPLATES",
    "get_template_by_id",
    "get_templates_by_category",
]
