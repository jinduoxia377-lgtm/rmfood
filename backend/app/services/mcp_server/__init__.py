"""
Model Context Protocol (MCP) 服务器

提供只读工具集供外部 AI 助手查询 RMFOODFP 平台数据。
遵循标准 MCP 协议，通过 SSE 或 stdio 传输。
对标 FormLab 的 20+ 只读 MCP 工具。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# MCP server 运行时状态（由 main.py 注入）
_mcp_app = None
_db_getter = None


def init_mcp_server(app, get_db):
    """注入 FastAPI app 和数据库会话工厂"""
    global _mcp_app, _db_getter
    _mcp_app = app
    _db_getter = get_db


def get_mcp_app():
    return _mcp_app


# ═══════════════════════════════════════════
# MCP 工具定义（用于 /api/v1/mcp/tools 元数据端点）
# ═══════════════════════════════════════════

MCP_TOOL_REGISTRY: List[Dict[str, Any]] = [
    # ── 配方查询 ──
    {
        "name": "list_formulas",
        "description": "列出配方，支持按组织和状态筛选",
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": {"type": ["integer", "null"], "description": "组织 ID，null 表示全部"},
                "status": {"type": ["string", "null"], "description": "状态过滤：draft | active | archived"},
                "limit": {"type": "integer", "default": 20, "description": "返回数量上限"},
            },
            "required": [],
        },
    },
    {
        "name": "get_formula",
        "description": "获取配方详情，包括成分列表、比例、功效标签",
        "input_schema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID"},
                "include_versions": {"type": "boolean", "default": False},
            },
            "required": ["formula_id"],
        },
    },
    {
        "name": "search_formulas",
        "description": "搜索配方（按名称、功效标签、成分关键词）",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "category": {"type": ["string", "null"], "description": "功效分类：sleep | immunity | digestion | etc."},
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["query"],
        },
    },
    # ── 药材/食材查询 ──
    {
        "name": "search_herbs",
        "description": "搜索药食同源药材，返回性味归经和现代研究摘要",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "药材名称或关键词"},
                "limit": {"type": "integer", "default": 20},
                "include_properties": {"type": "boolean", "default": True},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_ingredient",
        "description": "获取单个药材/食材的完整信息（性味、功效、禁忌、营养成分）",
        "input_schema": {
            "type": "object",
            "properties": {
                "ingredient_id": {"type": "integer", "description": "食材 ID"},
                "name": {"type": ["string", "null"], "description": "食材名称（与 ID 二选一）"},
            },
            "required": [],
        },
    },
    {
        "name": "list_ingredients",
        "description": "列出所有药食同源食材，支持按性味/归经筛选",
        "input_schema": {
            "type": "object",
            "properties": {
                "property": {"type": ["string", "null"], "description": "性味筛选：寒 | 凉 | 平 | 温 | 热"},
                "category": {"type": ["string", "null"], "description": "分类：根茎 | 花叶 | 果实 | 种子"},
                "limit": {"type": "integer", "default": 50},
            },
            "required": [],
        },
    },
    # ── 合规检查 ──
    {
        "name": "check_compliance",
        "description": "检查配方是否合规（药食同源目录、十八反十九畏、GB 16740）",
        "input_schema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID"},
                "ingredients": {
                    "type": "array",
                    "items": {"type": "object", "properties": {"name": {"type": "string"}, "dosage_mg": {"type": "number"}}},
                    "description": "或手动传入成分列表",
                },
            },
            "required": [],
        },
    },
    {
        "name": "check_contraindications",
        "description": "检查十八反十九畏配伍禁忌",
        "input_schema": {
            "type": "object",
            "properties": {
                "ingredients": {"type": "array", "items": {"type": "string"}, "description": "药材名称列表"},
            },
            "required": ["ingredients"],
        },
    },
    # ── 成本计算 ──
    {
        "name": "calculate_cost",
        "description": "计算配方批次成本（含原料成本、加工成本分摊）",
        "input_schema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID"},
                "batch_size_kg": {"type": "number", "default": 1.0, "description": "批量 kg"},
            },
            "required": [],
        },
    },
    # ── 稳定性 ──
    {
        "name": "get_stability_prediction",
        "description": "获取配方稳定性预测（Arrhenius 模型）",
        "input_schema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID"},
                "storage_temp_c": {"type": "number", "default": 25.0, "description": "存储温度 °C"},
                "months": {"type": "integer", "default": 24, "description": "预测月数"},
            },
            "required": [],
        },
    },
    # ── 批次追溯 ──
    {
        "name": "get_batch",
        "description": "获取批记录详情（含原料批号、生产参数、产量）",
        "input_schema": {
            "type": "object",
            "properties": {
                "batch_id": {"type": "integer", "description": "批记录 ID"},
            },
            "required": ["batch_id"],
        },
    },
    {
        "name": "trace_batch_ingredients",
        "description": "反向追溯：该批次使用了哪些原料批号",
        "input_schema": {
            "type": "object",
            "properties": {
                "batch_id": {"type": "integer", "description": "批记录 ID"},
            },
            "required": ["batch_id"],
        },
    },
    {
        "name": "trace_ingredient_forward",
        "description": "正向追溯：该原料批号用到了哪些产品批次",
        "input_schema": {
            "type": "object",
            "properties": {
                "lot_id": {"type": "integer", "description": "原料批号 ID"},
            },
            "required": ["lot_id"],
        },
    },
    # ── 样品与测试 ──
    {
        "name": "list_samples",
        "description": "列出样品种类及测试项目",
        "input_schema": {
            "type": "object",
            "properties": {
                "batch_id": {"type": "integer", "description": "批记录 ID 筛选"},
                "test_type": {"type": ["string", "null"], "description": "测试类型：microbial | chemical | sensory"},
            },
            "required": [],
        },
    },
    {
        "name": "get_sample_result",
        "description": "获取单个样品的测试结果",
        "input_schema": {
            "type": "object",
            "properties": {
                "sample_id": {"type": "integer", "description": "样品 ID"},
            },
            "required": ["sample_id"],
        },
    },
    # ── 实验设计 ──
    {
        "name": "list_doe_runs",
        "description": "列出实验设计运行记录",
        "input_schema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID 筛选"},
                "design_type": {"type": ["string", "null"], "description": "设计类型：ccd | bbd | mixture"},
            },
            "required": [],
        },
    },
    {
        "name": "get_doe_model",
        "description": "获取实验设计的响应面拟合模型",
        "input_schema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "integer", "description": "DOE 运行 ID"},
            },
            "required": ["run_id"],
        },
    },
    # ── 组织/用户 ──
    {
        "name": "list_organizations",
        "description": "列出所有组织",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_organization",
        "description": "获取组织详情",
        "input_schema": {
            "type": "object",
            "properties": {
                "organization_id": {"type": "integer"},
            },
            "required": ["organization_id"],
        },
    },
    # ── 知识库 ──
    {
        "name": "search_knowledge_graph",
        "description": "在知识图谱中搜索节点和关系",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "node_type": {"type": ["string", "null"], "description": "节点类型：herb | compound | pathway | symptom"},
                "limit": {"type": "integer", "default": 20},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_erb_property",
        "description": "获取药材的中医性味归经信息",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "药材名称"},
            },
            "required": ["name"],
        },
    },
]


def list_tools() -> List[Dict[str, Any]]:
    """返回 MCP 工具注册表（JSON Schema 格式）"""
    return MCP_TOOL_REGISTRY


def get_tool_metadata(tool_name: str) -> Optional[Dict[str, Any]]:
    """获取单个工具的元数据"""
    for tool in MCP_TOOL_REGISTRY:
        if tool["name"] == tool_name:
            return tool
    return None


def list_all_tool_names() -> List[str]:
    """返回所有工具名称列表"""
    return [t["name"] for t in MCP_TOOL_REGISTRY]
