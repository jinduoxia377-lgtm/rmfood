"""RMFOODFP MCP 服务器 —— P1 扩展只读工具（配方 + 知识图谱）。

在 MVP 的 search_herbs / get_ingredient 之上，按设计文档"分期落地路线"P1 新增
只读工具，接真实 DB 模型：

- ``search_formulas``        按名称/简介关键词搜配方（返回 id/名称/简介/状态）
- ``get_formula``            按 id 获取单个配方详情（含组成药材 + 剂量，若模型有）
- ``search_knowledge_graph`` 知识图谱检索（按节点标签/类型查实体及其关系）

数据来源与降级策略（与 tools.py 完全一致）：
1. 优先走真实数据：复用 ``app.models.formula.Formula`` 与
   ``app.models.knowledge_graph.KGNode / KGEdge``，通过共享 async session 工厂查询。
2. DB / 模型不可用时自动降级到内置静态示例数据，降级结果带 ``_source: "sample"``，
   绝不伪装成真实库数据。

多租户隔离：
- Formula 用 ``organization_id`` 字段（平台约定：None 表示全局共享）。tenant_id
  参数非空时，追加 ``or_(Formula.organization_id == tenant_id,
  Formula.organization_id.is_(None))``，让租户既看到自有配方又看到全局共享配方。
- KGNode / KGEdge 为全局知识图谱表（模型无租户字段），不做租户过滤，注释说明。

合规边界（有意不暴露）：
- 不提供合规检查（compliance/safety_check）、成本预测（cost）、配方设计/优化、
  体质辨识、氮折算等写路径或诊断责任边界类能力。本模块只暴露纯 SELECT 的
  配方检索与知识图谱检索，供下游参考，不做任何设计决策或合规判定。

只读约束：本模块所有函数只做 SELECT，无任何 INSERT/UPDATE/DELETE。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("rmfood.mcp_server.tools_p1")

# 与 tools.py 保持一致的真实库查询超时（秒）
DB_TIMEOUT_S = 3.0

# ── P1 工具 JSON Schema ──────────────────────────────────────────────

TOOL_DEFINITIONS_P1: list[dict[str, Any]] = [
    {
        "name": "search_formulas",
        "title": "搜索配方",
        "description": (
            "按名称或简介关键词模糊搜索 RMFOODFP 平台的配方，"
            "返回 id、名称、编码、简介、状态、目标功效。只读，按租户隔离（含全局共享）。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "配方名称或简介关键词，如 降尿酸 / 安神"},
                "limit": {"type": "integer", "default": 10, "description": "返回数量上限（1-50）"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_formula",
        "title": "获取配方详情",
        "description": (
            "按 id 获取单个配方的详情：名称、简介、目标功效、剂型、剂量、"
            "组成药材（名称 + 用量 + 单位）。只读，按租户隔离（含全局共享）。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "formula_id": {"type": "integer", "description": "配方 ID"},
            },
            "required": ["formula_id"],
        },
    },
    {
        "name": "search_knowledge_graph",
        "title": "知识图谱检索",
        "description": (
            "在平台知识图谱中按节点标签（可选节点类型）检索实体，并返回其最相关的"
            "关系边（协同/拮抗/含有/作用于/治疗等）。只读，全局知识图谱。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "节点标签关键词，如 茯苓 / uric_acid"},
                "node_type": {
                    "type": "string",
                    "description": "可选节点类型过滤: herb/compound/target/disease/peptide/protein/food",
                },
                "limit": {"type": "integer", "default": 10, "description": "返回节点数量上限（1-30）"},
            },
            "required": ["query"],
        },
    },
]

_TOOL_NAMES_P1 = {t["name"] for t in TOOL_DEFINITIONS_P1}


# ── 静态示例数据（降级兜底，非真实库）────────────────────────────────

_SAMPLE_FORMULAS: list[dict[str, Any]] = [
    {
        "id": 101, "name": "茯菊安神饮", "code": "F-ANSHEN-001",
        "description": "健脾宁心、清热平肝，辅助改善睡眠",
        "status": "published", "target_effects": ["改善睡眠", "健脾宁心"],
        "dosage": "每日 1 剂，代茶饮",
        "ingredients": [
            {"name": "茯苓", "amount": 15.0, "unit": "g"},
            {"name": "菊花", "amount": 6.0, "unit": "g"},
            {"name": "枸杞子", "amount": 10.0, "unit": "g"},
        ],
    },
    {
        "id": 102, "name": "薏苡降酸汤", "code": "F-UA-002",
        "description": "利水渗湿、健脾泄浊，辅助降尿酸",
        "status": "draft", "target_effects": ["降尿酸", "利水渗湿"],
        "dosage": "每日 1 剂，水煎",
        "ingredients": [
            {"name": "薏苡仁", "amount": 30.0, "unit": "g"},
            {"name": "茯苓", "amount": 20.0, "unit": "g"},
        ],
    },
]

_SAMPLE_KG_NODES: list[dict[str, Any]] = [
    {
        "id": 1, "node_type": "herb", "node_label": "茯苓",
        "properties": {"pinyin": "fuling"}, "source": "manual",
        "edges": [
            {"source": "茯苓", "target": "茯苓多糖", "type": "contains", "strength": 0.9},
            {"source": "茯苓", "target": "脾经", "type": "targets", "strength": 0.7},
        ],
    },
    {
        "id": 2, "node_type": "herb", "node_label": "菊花",
        "properties": {"pinyin": "juhua"}, "source": "manual",
        "edges": [
            {"source": "菊花", "target": "黄酮类", "type": "contains", "strength": 0.8},
        ],
    },
]


# ── 真实数据访问（失败即降级）────────────────────────────────────────

async def _try_real_search_formulas(query: str, limit: int, tenant_id: int | None) -> list[dict] | None:
    """尝试用真实 Formula 表查询；任何异常返回 None 触发降级。

    租户隔离：tenant_id 非空时，返回 (organization_id == tenant_id) 或全局共享
    (organization_id IS NULL) 的配方。
    """
    try:
        from sqlalchemy import or_, select

        from app.core.database.session import get_db
        from app.models.formula import Formula

        gen = get_db()
        db = await gen.__anext__()
        try:
            stmt = select(Formula).where(or_(
                Formula.name.ilike(f"%{query}%"),
                Formula.description.ilike(f"%{query}%"),
            ))
            if tenant_id is not None:
                stmt = stmt.where(or_(
                    Formula.organization_id == tenant_id,
                    Formula.organization_id.is_(None),
                ))
            stmt = stmt.order_by(Formula.updated_at.desc()).limit(limit)
            rows = (await db.execute(stmt)).scalars().all()
            return [
                {
                    "id": r.id, "name": r.name,
                    "code": getattr(r, "code", None),
                    "description": getattr(r, "description", None),
                    "status": str(getattr(r, "status", None)),
                    "target_effects": getattr(r, "target_effects", None),
                    "_source": "db",
                }
                for r in rows
            ]
        finally:
            await gen.aclose()
    except Exception as exc:  # noqa: BLE001 - DB 不可用即降级
        logger.info("search_formulas 走真实库失败，降级示例数据: %s", exc)
        return None


async def _try_real_get_formula(formula_id: int, tenant_id: int | None) -> dict | None:
    """按 id 获取单个配方详情（含组成药材 + 剂量）。异常返回 None 触发降级。"""
    try:
        from sqlalchemy import or_, select

        from app.core.database.session import get_db
        from app.models.formula import Formula

        gen = get_db()
        db = await gen.__anext__()
        try:
            stmt = select(Formula).where(Formula.id == formula_id)
            if tenant_id is not None:
                stmt = stmt.where(or_(
                    Formula.organization_id == tenant_id,
                    Formula.organization_id.is_(None),
                ))
            row = (await db.execute(stmt)).scalars().first()
            if not row:
                return {"error": f"未找到配方: {formula_id}", "_source": "db"}

            # 组成药材：显式查 formula_ingredients 关联表（amount/unit 是关联表列，
            # 不在 Ingredient 实体上），JOIN ingredients 取名称，按 sort_order 排序。
            from app.models.formula import Ingredient, formula_ingredients

            ing_rows = (await db.execute(
                select(
                    Ingredient.id,
                    Ingredient.name,
                    formula_ingredients.c.amount,
                    formula_ingredients.c.unit,
                    formula_ingredients.c.percentage,
                )
                .join(formula_ingredients, formula_ingredients.c.ingredient_id == Ingredient.id)
                .where(formula_ingredients.c.formula_id == row.id)
                .order_by(formula_ingredients.c.sort_order)
            )).all()
            ingredients_out = [
                {
                    "ingredient_id": r.id,
                    "name": r.name,
                    "amount": r.amount,
                    "unit": r.unit,
                    "percentage": r.percentage,
                }
                for r in ing_rows
            ]

            return {
                "id": row.id, "name": row.name,
                "code": getattr(row, "code", None),
                "description": getattr(row, "description", None),
                "status": str(getattr(row, "status", None)),
                "target_effects": getattr(row, "target_effects", None),
                "dosage": getattr(row, "dosage", None),
                "processing_method": getattr(row, "processing_method", None),
                "composition": getattr(row, "composition", None),
                "ingredients": ingredients_out,
                "_source": "db",
            }
        finally:
            await gen.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.info("get_formula 走真实库失败，降级示例数据: %s", exc)
        return None


async def _try_real_search_knowledge_graph(
    query: str, node_type: str | None, limit: int,
) -> list[dict] | None:
    """知识图谱检索：按节点标签（+可选类型）查实体，并带出其关系边。

    KGNode/KGEdge 为全局表（无租户字段），不做租户过滤。
    """
    try:
        from sqlalchemy import or_, select

        from app.core.database.session import get_db
        from app.models.knowledge_graph import KGEdge, KGNode

        gen = get_db()
        db = await gen.__anext__()
        try:
            node_stmt = select(KGNode).where(
                KGNode.node_label.ilike(f"%{query}%")
            )
            if node_type:
                node_stmt = node_stmt.where(KGNode.node_type == node_type)
            node_stmt = node_stmt.limit(limit)
            nodes = (await db.execute(node_stmt)).scalars().all()
            if not nodes:
                return []

            node_ids = [n.id for n in nodes]
            edge_stmt = select(KGEdge).where(or_(
                KGEdge.source_id.in_(node_ids),
                KGEdge.target_id.in_(node_ids),
            )).limit(limit * 5)
            edges = (await db.execute(edge_stmt)).scalars().all()

            # 建立节点 id -> label 映射，用于边端点显示
            involved_ids = set(node_ids)
            for e in edges:
                involved_ids.add(e.source_id)
                involved_ids.add(e.target_id)
            id2label: dict[int, str] = {n.id: n.node_label for n in nodes}
            if len(involved_ids) > len(node_ids):
                extra = (await db.execute(
                    select(KGNode).where(KGNode.id.in_(list(involved_ids - set(node_ids))))
                )).scalars().all()
                for n in extra:
                    id2label[n.id] = n.node_label

            edges_out = [
                {
                    "source": id2label.get(e.source_id, str(e.source_id)),
                    "target": id2label.get(e.target_id, str(e.target_id)),
                    "type": e.edge_type,
                    "strength": e.strength,
                }
                for e in edges
            ]
            return [
                {
                    "id": n.id,
                    "node_type": n.node_type,
                    "node_label": n.node_label,
                    "properties": n.properties or {},
                    "source_system": n.source,
                    "edges": [
                        e for e in edges_out
                        if e["source"] == n.node_label or e["target"] == n.node_label
                    ][:5],
                    "_source": "db",
                }
                for n in nodes
            ]
        finally:
            await gen.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.info("search_knowledge_graph 走真实库失败，降级示例数据: %s", exc)
        return None


# ── P1 工具执行入口 ──────────────────────────────────────────────────

async def call_tool_p1(name: str, args: dict, tenant_id: int | None = None) -> dict:
    """执行 P1 只读工具，返回 MCP content 结构。

    与 tools.call_tool 同签名；由 tools.call_tool 末尾把未命中的 name 转发进来。
    tenant_id 用于 Formula 的租户隔离（organization_id），KG 为全局表不过滤。
    tenant_id 可能以 str 传入（stdio JSON 参数），统一转 int 保证与
    organization_id(BigInt) 比较类型一致，避免静默匹配不到。
    """
    if tenant_id is not None and not isinstance(tenant_id, int):
        try:
            tenant_id = int(tenant_id)
        except (TypeError, ValueError):
            tenant_id = None

    if name == "search_formulas":
        query = str(args.get("query", "")).strip()
        if not query:
            return {"content": [{"type": "text", "text": "参数 query 不能为空"}], "isError": True}
        limit = max(1, min(int(args.get("limit", 10) or 10), 50))
        try:
            real = await asyncio.wait_for(
                _try_real_search_formulas(query, limit, tenant_id), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            payload = real
        else:
            q = query.lower()
            payload = [
                {k: v for k, v in r.items()}
                for r in _SAMPLE_FORMULAS
                if q in r["name"].lower() or q in (r.get("description") or "").lower()
            ][:limit]
            for item in payload:
                item["_source"] = "sample"
        text = f"搜索配方'{query}'命中 {len(payload)} 条（source={payload[0]['_source'] if payload else 'none'}）:\n"
        text += "\n".join(
            f"- [{r['id']}] {r['name']}（{r.get('code')}）状态:{r.get('status')} 目标:{','.join(r.get('target_effects') or [])}"
            for r in payload
        ) or "  （无匹配）"
        return {"content": [{"type": "text", "text": text}]}

    if name == "get_formula":
        fid = args.get("formula_id")
        if fid is None:
            return {"content": [{"type": "text", "text": "必须提供 formula_id"}], "isError": True}
        try:
            real = await asyncio.wait_for(
                _try_real_get_formula(int(fid), tenant_id), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            record = real
        else:
            record = None
            for r in _SAMPLE_FORMULAS:
                if r["id"] == int(fid):
                    record = {k: v for k, v in r.items()}
                    record["_source"] = "sample"
                    break
            if record is None:
                record = {"error": f"未找到配方: {fid}", "_source": "sample"}
        if "error" in record:
            return {"content": [{"type": "text", "text": record["error"]}], "isError": True}
        lines = [
            f"{record['name']}（{record.get('code')}）状态:{record.get('status')}",
            f"简介: {record.get('description')}",
            f"目标功效: {','.join(record.get('target_effects') or [])}",
            f"剂量: {record.get('dosage')}",
        ]
        ings = record.get("ingredients") or []
        if ings:
            lines.append("组成:")
            for ing in ings:
                amt = ing.get("amount")
                unit = ing.get("unit") or ""
                lines.append(f"  - {ing.get('name')} {amt if amt is not None else '?'}{unit}")
        lines.append(f"(source={record.get('_source')})")
        return {"content": [{"type": "text", "text": "\n".join(lines)}]}

    if name == "search_knowledge_graph":
        query = str(args.get("query", "")).strip()
        if not query:
            return {"content": [{"type": "text", "text": "参数 query 不能为空"}], "isError": True}
        node_type = str(args.get("node_type") or "").strip() or None
        limit = max(1, min(int(args.get("limit", 10) or 10), 30))
        try:
            real = await asyncio.wait_for(
                _try_real_search_knowledge_graph(query, node_type, limit), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            payload = real
        else:
            q = query.lower()
            payload = [
                {k: v for k, v in r.items()}
                for r in _SAMPLE_KG_NODES
                if q in r["node_label"].lower()
                and (node_type is None or r["node_type"] == node_type)
            ][:limit]
            for item in payload:
                item["_source"] = "sample"
        text = f"知识图谱检索'{query}'命中 {len(payload)} 个节点（source={payload[0]['_source'] if payload else 'none'}）:\n"
        for n in payload:
            text += f"- [{n['node_type']}] {n['node_label']}\n"
            for e in (n.get("edges") or []):
                text += f"    · {e['source']} --{e['type']}({e.get('strength')})--> {e['target']}\n"
        if not payload:
            text += "  （无匹配）"
        return {"content": [{"type": "text", "text": text}]}

    raise KeyError(name)
