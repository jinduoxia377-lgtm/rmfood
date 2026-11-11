"""RMFOODFP MCP 服务器 —— 药材安全与功效只读工具组（接真实 FoodMaterial）。

在 search_herbs / get_ingredient / get_formula 等工具之上，新增三个只读工具，
全部读真实 ``app.models.food_material.FoodMaterial``（表 food_materials）：

- ``get_herb_safety``            药材安全数据查询（毒性/禁忌/相互作用/安全剂量/法规）
- ``get_herb_active_compounds``  活性成分查询（active_ingredients + compound_refs）
- ``search_herbs_by_effect``     按功效搜药材（FoodMaterial.effects ARRAY 包含匹配）

重要边界（诚实说明）：
- ``get_herb_safety`` 是**纯数据查询**——只读 FoodMaterial 已有的安全字段做参考
  数据展示，**不做任何合规判断/禁忌推导**。区别于 HTTP 注册表里的
  ``check_compliance`` / ``check_contraindications``（那两个涉及判断，不在本次范围）。
- 所有工具 description 均注明"参考数据，非诊疗依据"，避免被当作诊疗建议。

数据来源与降级策略（与 tools.py / tools_p1.py 完全一致）：
1. 优先走真实数据：``app.mcp_server.db.db_session`` + SQLAlchemy 查询，
   外层 ``asyncio.wait_for(DB_TIMEOUT_S)`` 超时保护。
2. DB 不可用/超时则降级到内置静态示例数据（带 ``_source: "sample"``）。
   **注意**：安全/禁忌/剂量类 sample 仅作结构示意，不伪造具体禁忌或剂量数值
   （避免误导），sample 里这些字段留空并在文本中提示"sample 结构示意"。

只读约束：本模块所有函数只做 SELECT，无任何 INSERT/UPDATE/DELETE。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("rmfood.mcp_server.tools_safety")

# 与 tools.py / tools_p1.py 一致的真实库查询超时（秒）
DB_TIMEOUT_S = 3.0

# ── 安全/功效工具 JSON Schema ────────────────────────────────────────

TOOL_DEFINITIONS_SAFETY: list[dict[str, Any]] = [
    {
        "name": "get_herb_safety",
        "title": "查询药材安全数据",
        "description": (
            "按中文名或 id 查询药食同源药材/食材的安全参考数据：毒性等级、禁忌、"
            "相互作用、安全剂量范围、每日最大摄入量、法规状态、批准地区。"
            "纯数据查询（读平台已有的安全字段做参考展示，非合规判断）。"
            "参考数据，非诊疗依据。只读。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "药材中文名，如 茯苓 / 山药"},
                "ingredient_id": {"type": "integer", "description": "食材 ID（与 name 二选一）"},
            },
            "required": [],
        },
    },
    {
        "name": "get_herb_active_compounds",
        "title": "查询药材活性成分",
        "description": (
            "按中文名或 id 查询药食同源药材/食材的活性成分列表（active_ingredients）"
            "及关联化合物 ID（compound_refs，关联 tcm_compounds.id）。"
            "参考数据，非诊疗依据。只读。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "药材中文名，如 茯苓 / 山药"},
                "ingredient_id": {"type": "integer", "description": "食材 ID（与 name 二选一）"},
            },
            "required": [],
        },
    },
    {
        "name": "search_herbs_by_effect",
        "title": "按功效搜索药材",
        "description": (
            "按功效关键词（如 利水渗湿 / 健脾 / 补脾）在药食同源药材库中检索，"
            "对 effects 标签做包含匹配，返回命中药材的 id、名称、英文名、分类、功效标签。"
            "参考数据，非诊疗依据。只读。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "effect": {"type": "string", "description": "功效关键词，如 利水渗湿 / 健脾"},
                "limit": {"type": "integer", "default": 20, "description": "返回数量上限（1-50）"},
            },
            "required": ["effect"],
        },
    },
]


# ── 静态示例数据（降级兜底，非真实库；安全/剂量字段留空不伪造）────────

# 结构示意：仅演示返回结构，禁忌/剂量/法规一律留空，避免伪造具体安全数据误导。
_SAMPLE_SAFETY: dict[str, Any] = {
    "name": "（示例）茯苓",
    "toxicity_class": None,
    "contraindications": [],
    "interactions": [],
    "safe_dose_min": None,
    "safe_dose_max": None,
    "max_daily_intake": None,
    "regulatory_status": None,
    "approved_regions": [],
}

_SAMPLE_COMPOUNDS: dict[str, Any] = {
    "name": "（示例）茯苓",
    "active_ingredients": [],
    "compound_refs": [],
}

_SAMPLE_EFFECT_HITS: list[dict[str, Any]] = [
    {"id": 52, "name_cn": "（示例）茯苓", "name_en": "Poria", "category": "中药材",
     "effects": ["利水渗湿", "健脾宁心"]},
    {"id": 17, "name_cn": "（示例）山药", "name_en": "Chinese Yam", "category": "中药材",
     "effects": ["健脾养胃", "润肺止咳", "益肾固精"]},
]


# ── 真实数据访问（失败即降级）────────────────────────────────────────

async def _load_material(db, name: str | None, ingredient_id: int | None):
    """按 name(name_cn 精确) 或 ingredient_id 加载单个 FoodMaterial；无则 None。"""
    from sqlalchemy import select

    from app.models.food_material import FoodMaterial

    stmt = select(FoodMaterial)
    if ingredient_id is not None:
        stmt = stmt.where(FoodMaterial.id == ingredient_id)
    elif name:
        stmt = stmt.where(FoodMaterial.name_cn == name)
    else:
        return None
    return (await db.execute(stmt)).scalars().first()


async def _try_real_get_herb_safety(name: str | None, ingredient_id: int | None) -> dict | None:
    """查询药材安全数据（纯 SELECT）。异常返回 None 触发降级。"""
    try:
        async with _db_session() as db:
            row = await _load_material(db, name, ingredient_id)
            if row is None:
                ident = ingredient_id if ingredient_id is not None else name
                return {"error": f"未找到药材: {ident}", "_source": "db"}
            return {
                "id": row.id,
                "name": row.name_cn,
                "name_en": row.name_en,
                "toxicity_class": row.toxicity_class,
                "contraindications": row.contraindications or [],
                "interactions": row.interactions or [],
                "safe_dose_min": row.safe_dose_min,
                "safe_dose_max": row.safe_dose_max,
                "max_daily_intake": row.max_daily_intake,
                "regulatory_status": row.regulatory_status,
                "approved_regions": row.approved_regions or [],
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001 - DB 不可用即降级
        logger.info("get_herb_safety 走真实库失败，降级示例: %s", exc)
        return None


async def _try_real_get_herb_active_compounds(
    name: str | None, ingredient_id: int | None,
) -> dict | None:
    """查询药材活性成分（纯 SELECT）。异常返回 None 触发降级。"""
    try:
        async with _db_session() as db:
            row = await _load_material(db, name, ingredient_id)
            if row is None:
                ident = ingredient_id if ingredient_id is not None else name
                return {"error": f"未找到药材: {ident}", "_source": "db"}
            return {
                "id": row.id,
                "name": row.name_cn,
                "name_en": row.name_en,
                "active_ingredients": row.active_ingredients or [],
                "compound_refs": row.compound_refs or [],
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001
        logger.info("get_herb_active_compounds 走真实库失败，降级示例: %s", exc)
        return None


async def _try_real_search_herbs_by_effect(effect: str, limit: int) -> list[dict] | None:
    """按功效搜药材：FoodMaterial.effects(ARRAY) 包含匹配（纯 SELECT）。

    匹配策略：优先用 Postgres ``.any()``（生成 ``effect = ANY(effects)``，对
    ARRAY(Text) 稳定）做精确标签匹配；再回退到 Python 侧"子串包含"过滤
    （覆盖 effect 传部分关键词如"利水"命中"利水渗湿"的情况），两路结果按 id 去重。
    """
    try:
        from sqlalchemy import or_, select

        from app.mcp_server.db import db_session as _db_sess
        from app.models.food_material import FoodMaterial

        out: list[dict] = []
        seen: set[int] = set()
        async with _db_sess() as db:
            # 路 1：数据库端精确标签匹配（.any()）
            try:
                stmt = select(FoodMaterial).where(
                    FoodMaterial.effects.any(effect)
                ).limit(limit)
                rows = (await db.execute(stmt)).scalars().all()
                for r in rows:
                    if r.id in seen:
                        continue
                    seen.add(r.id)
                    out.append(_material_light(r))
            except Exception as exc:  # noqa: BLE001 - .any() 不可用时回退 Python
                logger.debug("effects.any() 匹配失败，回退 Python 过滤: %s", exc)

            # 路 2：Python 侧子串包含（覆盖部分关键词），补齐未见过的
            if effect not in seen or len(out) < limit:
                all_rows = (await db.execute(select(FoodMaterial))).scalars().all()
                for r in all_rows:
                    if r.id in seen:
                        continue
                    effects = r.effects or []
                    if any(effect in (e or "") for e in effects):
                        seen.add(r.id)
                        out.append(_material_light(r))
                        if len(out) >= limit:
                            break

        return out
    except Exception as exc:  # noqa: BLE001
        logger.info("search_herbs_by_effect 走真实库失败，降级示例: %s", exc)
        return None


def _material_light(r) -> dict[str, Any]:
    """裁剪 FoodMaterial 为功效搜索结果字段。"""
    return {
        "id": r.id,
        "name_cn": r.name_cn,
        "name_en": r.name_en,
        "category": r.category,
        "effects": r.effects or [],
        "_source": "db",
    }


# db_session 延迟导入包装（便于 _try_real_* 内统一使用）
from contextlib import asynccontextmanager  # noqa: E402


@asynccontextmanager
async def _db_session():
    from app.mcp_server.db import db_session

    async with db_session() as db:
        yield db


# ── 工具执行入口 ─────────────────────────────────────────────────────

async def call_tool_safety(name: str, args: dict, tenant_id: int | None = None) -> dict:
    """执行药材安全/功效只读工具，返回 MCP content 结构。

    与 tools.call_tool / tools_p1.call_tool_p1 同签名，由 server 接线转发。
    tenant_id 暂不参与过滤（food_materials 为全局字典表，无租户字段）。
    """
    if name == "get_herb_safety":
        nm = (str(args.get("name")).strip() if args.get("name") else None)
        iid = args.get("ingredient_id")
        iid = int(iid) if iid is not None else None
        if not nm and iid is None:
            return {"content": [{"type": "text", "text": "必须提供 name 或 ingredient_id"}], "isError": True}
        try:
            real = await asyncio.wait_for(
                _try_real_get_herb_safety(nm, iid), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        record = real if real is not None else _sample_safety(nm, iid)
        if "error" in record:
            return {"content": [{"type": "text", "text": record["error"]}], "isError": True}
        return {"content": [{"type": "text", "text": _render_safety(record)}]}

    if name == "get_herb_active_compounds":
        nm = (str(args.get("name")).strip() if args.get("name") else None)
        iid = args.get("ingredient_id")
        iid = int(iid) if iid is not None else None
        if not nm and iid is None:
            return {"content": [{"type": "text", "text": "必须提供 name 或 ingredient_id"}], "isError": True}
        try:
            real = await asyncio.wait_for(
                _try_real_get_herb_active_compounds(nm, iid), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        record = real if real is not None else _sample_compounds(nm, iid)
        if "error" in record:
            return {"content": [{"type": "text", "text": record["error"]}], "isError": True}
        return {"content": [{"type": "text", "text": _render_compounds(record)}]}

    if name == "search_herbs_by_effect":
        effect = str(args.get("effect", "")).strip()
        if not effect:
            return {"content": [{"type": "text", "text": "参数 effect 不能为空"}], "isError": True}
        limit = max(1, min(int(args.get("limit", 20) or 20), 50))
        try:
            real = await asyncio.wait_for(
                _try_real_search_herbs_by_effect(effect, limit), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            payload = real
            source = payload[0]["_source"] if payload else "none"
        else:
            q = effect.lower()
            payload = [
                {**r, "_source": "sample"}
                for r in _SAMPLE_EFFECT_HITS
                if any(q in (e or "").lower() for e in r["effects"])
            ][:limit]
            source = "sample"
        text = f"按功效'{effect}'命中 {len(payload)} 条药材（source={source}）:\n"
        text += "\n".join(
            f"- [{r['id']}] {r['name_cn']}（{r.get('name_en')}）分类:{r.get('category')} 功效:{','.join(r.get('effects') or [])}"
            for r in payload
        ) or "  （无匹配）"
        text += "\n（参考数据，非诊疗依据）"
        return {"content": [{"type": "text", "text": text}]}

    raise KeyError(name)


# ── 渲染 ─────────────────────────────────────────────────────────────

def _render_safety(r: dict) -> str:
    lines = [f"{r['name']}（{r.get('name_en')}）安全参考数据"]
    lines.append(f"毒性等级: {r.get('toxicity_class') or '（无数据）'}")
    contra = r.get("contraindications") or []
    lines.append("禁忌: " + ("；".join(contra) if contra else "（无数据）"))
    inter = r.get("interactions") or []
    lines.append("相互作用: " + ("；".join(inter) if inter else "（无数据）"))
    smin, smax = r.get("safe_dose_min"), r.get("safe_dose_max")
    lines.append(f"安全剂量(g/天): {smin if smin is not None else '?'} ~ {smax if smax is not None else '?'}")
    lines.append(f"每日最大摄入量: {r.get('max_daily_intake') or '（无数据）'}")
    lines.append(f"法规状态: {r.get('regulatory_status') or '（无数据）'}")
    regions = r.get("approved_regions") or []
    lines.append(f"批准地区: {','.join(regions) if regions else '（无数据）'}")
    lines.append(f"(source={r.get('_source')})")
    if r.get("_source") == "sample":
        lines.append("注：sample 结构示意，不含真实禁忌/剂量，避免误导。")
    lines.append("（参考数据，非诊疗依据）")
    return "\n".join(lines)


def _render_compounds(r: dict) -> str:
    lines = [f"{r['name']}（{r.get('name_en')}）活性成分"]
    act = r.get("active_ingredients") or []
    if act:
        lines.append(f"活性成分({len(act)}):")
        for a in act:
            lines.append(f"  - {a}")
    else:
        lines.append("活性成分: （无数据）")
    refs = r.get("compound_refs") or []
    lines.append("关联化合物ID(tcm_compounds.id): " + (",".join(str(x) for x in refs) if refs else "（无数据）"))
    lines.append(f"(source={r.get('_source')})")
    if r.get("_source") == "sample":
        lines.append("注：sample 结构示意，不含真实活性成分，避免误导。")
    lines.append("（参考数据，非诊疗依据）")
    return "\n".join(lines)


def _sample_safety(nm: str | None, iid: int | None) -> dict:
    r = dict(_SAMPLE_SAFETY)
    r["name"] = f"（示例）{nm}" if nm else f"（示例）id={iid}"
    r["_source"] = "sample"
    return r


def _sample_compounds(nm: str | None, iid: int | None) -> dict:
    r = dict(_SAMPLE_COMPOUNDS)
    r["name"] = f"（示例）{nm}" if nm else f"（示例）id={iid}"
    r["_source"] = "sample"
    return r
