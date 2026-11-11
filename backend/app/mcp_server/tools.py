"""RMFOODFP MCP 服务器 —— 工具定义与只读执行。

MVP 只暴露 2 个真实只读工具（对应设计文档"分期落地路线"M0）：
- ``search_herbs``    搜索药食同源药材/食材（按名称/拼音）
- ``get_ingredient``  获取单个药材/食材的性味归经、功效、毒性

数据来源与降级策略：
1. 优先走真实数据：复用 ``app.models.food_material.FoodMaterial``（与
   ``services/mcp_server/handlers.py`` 的 ``_search_herbs`` / ``_get_ingredient``
   同源），通过共享的 async session 工厂查询。
2. 若数据库/模型不可用（骨架独立运行、无 DB、模型字段差异），自动降级到
   内置 *静态示例数据*，保证 ``tools/call`` 永远能返回合理结果，用于证明
   骨架可跑通 MCP 握手与工具调用链路。降级结果带 ``_source: "sample"`` 标记，
   绝不伪装成真实库数据。

只读约束：本模块所有函数只做 SELECT，无任何 INSERT/UPDATE/DELETE。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("rmfood.mcp_server.tools")

# 真实库查询超时（秒）。超时即降级到静态示例数据，避免 DB 不可达时挂住 stdio。
DB_TIMEOUT_S = 3.0

# ── 工具 JSON Schema（对齐 MCP tools/list 的 inputSchema 字段）──────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "search_herbs",
        "title": "搜索药食同源药材/食材",
        "description": (
            "按名称或拼音模糊搜索 RMFOODFP 平台的药食同源药材/食材，"
            "返回 id、名称、拼音、四气（寒凉平温热）、五味、分类。只读。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "药材名称或拼音关键词，如 茯苓 / fuling"},
                "limit": {"type": "integer", "default": 20, "description": "返回数量上限（1-50）"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_ingredient",
        "title": "获取药材/食材详情",
        "description": (
            "按 id 或名称获取单个药食同源药材/食材的完整信息：性味归经、功效、毒性、分类。只读。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "ingredient_id": {"type": "integer", "description": "食材 ID（与 name 二选一）"},
                "name": {"type": "string", "description": "食材名称（与 ingredient_id 二选一）"},
            },
            "required": [],
        },
    },
]

# P1 扩展只读工具（配方 + 知识图谱），定义在 tools_p1.py，此处追加进同一列表，
# 使 tools/list 一并暴露，call_tool 末尾把未命中 name 转发给 call_tool_p1。
from app.mcp_server.tools_p1 import TOOL_DEFINITIONS_P1  # noqa: E402
from app.mcp_server.tools_pharmaco import TOOL_DEFINITIONS_PHARMACO  # noqa: E402
from app.mcp_server.tools_safety import TOOL_DEFINITIONS_SAFETY  # noqa: E402
from app.mcp_server.tools_stability import TOOL_DEFINITIONS_STABILITY  # noqa: E402

TOOL_DEFINITIONS += TOOL_DEFINITIONS_P1
TOOL_DEFINITIONS += TOOL_DEFINITIONS_PHARMACO
TOOL_DEFINITIONS += TOOL_DEFINITIONS_SAFETY
TOOL_DEFINITIONS += TOOL_DEFINITIONS_STABILITY

_TOOL_NAMES = {t["name"] for t in TOOL_DEFINITIONS}

# ── 静态示例数据（降级兜底，非真实库）────────────────────────────────
# 字段对齐 FoodMaterial 模型的常用列；仅覆盖少量代表性药食同源原料。
_SAMPLE_HERBS: list[dict[str, Any]] = [
    {
        "id": 1, "name": "茯苓", "pinyin": "fuling",
        "property": "平", "flavor": "甘淡", "category": "根茎",
        "meridian": "脾、肺、肾经", "toxicity": "无",
        "functions": "利水渗湿、健脾宁心",
    },
    {
        "id": 2, "name": "山药", "pinyin": "shanyao",
        "property": "平", "flavor": "甘", "category": "根茎",
        "meridian": "脾、肺、肾经", "toxicity": "无",
        "functions": "补脾养胃、生津益肺、补肾涩精",
    },
    {
        "id": 3, "name": "枸杞子", "pinyin": "gouqizi",
        "property": "平", "flavor": "甘", "category": "果实",
        "meridian": "肝、肾经", "toxicity": "无",
        "functions": "滋补肝肾、益精明目",
    },
    {
        "id": 4, "name": "菊花", "pinyin": "juhua",
        "property": "凉", "flavor": "甘苦", "category": "花叶",
        "meridian": "肺、肝经", "toxicity": "无",
        "functions": "疏散风热、平肝明目、清热解毒",
    },
    {
        "id": 6, "name": "藿香", "pinyin": "huoxiang",
        "property": "温", "flavor": "辛", "category": "花叶",
        "meridian": "脾、胃、肺经", "toxicity": "无",
        "functions": "芳香化浊、和中止呕、发表解暑",
    },
    {
        "id": 5, "name": "薏苡仁", "pinyin": "yiyiren",
        "property": "凉", "flavor": "甘淡", "category": "种子",
        "meridian": "脾、胃、肺经", "toxicity": "无",
        "functions": "利水渗湿、健脾止泻、除痹、清热排脓",
    },
]


def _sample_to_public(row: dict, detail: bool) -> dict:
    """把示例行裁剪成对外字段（detail 控制是否含功效/归经/毒性）。"""
    base = {
        "id": row["id"], "name": row["name"], "pinyin": row["pinyin"],
        "property": row["property"], "flavor": row["flavor"], "category": row["category"],
    }
    if detail:
        base.update({
            "meridian": row["meridian"],
            "toxicity": row["toxicity"],
            "functions": row["functions"],
        })
    return base


# ── 真实数据访问（失败即降级）────────────────────────────────────────

async def _try_real_search_herbs(query: str, limit: int) -> list[dict] | None:
    """尝试用真实 FoodMaterial 表查询；任何异常返回 None 触发降级。

    字段映射（真实模型 app/models/food_material.py）：
    - 名称 = ``name_cn``（中文名，非空）；**模型无 ``name``/``pinyin`` 字段**。
    - 名称模糊匹配走 name_cn + name_en ILIKE。
    - **拼音补充匹配**：当 query 为纯拼音（如 "huoxiang"→藿香、"fuling"→茯苓）时，
      ILIKE 对中文 name_cn 匹配不到，这里追加拼音路——复用已验证的
      ``app.services.food_search.pinyin`` 对 approved 的 FoodMaterial 全表（≈142 行
      小表）实时比对，拼音命中但未被 ILIKE 命中的项补齐到结果（按 id 去重），
      标 ``pinyin_matched=True``（仍是真实库数据，故 ``_source`` 保持 "db"）。
      非拼音 query 行为完全不变。拼音路 try/except 包裹，pypinyin 异常不阻断。
    - 返回字段全部来自真实存在的列，缺列一律 None，绝不臆造。
    """
    try:
        from sqlalchemy import or_, select

        from app.mcp_server.db import db_session
        from app.models.food_material import FoodMaterial

        async with db_session() as db:
            stmt = (
                select(FoodMaterial)
                .where(or_(
                    FoodMaterial.name_cn.ilike(f"%{query}%"),
                    FoodMaterial.name_en.ilike(f"%{query}%"),
                ))
                .limit(limit)
            )
            rows = (await db.execute(stmt)).scalars().all()
            results = [
                {
                    "id": r.id,
                    "name": r.name_cn,
                    "pinyin": None,                       # 模型无此字段
                    "property": None,                     # 四气：模型无此字段
                    "flavor": None,                       # 五味：模型无此字段
                    "category": getattr(r, "category", None),
                    "toxicity": getattr(r, "toxicity_class", None),
                    "food_homology": getattr(r, "food_homology", None),
                    "_source": "db",
                }
                for r in rows
            ]

            # 拼音补充匹配（仅纯拼音 query；失败不阻断主搜索）
            try:
                from app.services.food_search.pinyin import (
                    is_pinyin_query,
                    pinyin_match_materials,
                )

                if is_pinyin_query(query):
                    existing_ids = {r["id"] for r in results}
                    all_rows = (
                        await db.execute(
                            select(FoodMaterial).where(FoodMaterial.review_status == "approved")
                        )
                    ).scalars().all()
                    pinyin_hits = pinyin_match_materials(list(all_rows), query, limit=limit)
                    for hit in pinyin_hits:
                        if hit["id"] in existing_ids:
                            continue
                        existing_ids.add(hit["id"])
                        results.append({
                            "id": hit["id"],
                            "name": hit.get("name_cn"),
                            "pinyin": None,
                            "property": None,
                            "flavor": None,
                            "category": hit.get("category"),
                            "toxicity": None,
                            "food_homology": None,
                            "_source": "db",
                            "pinyin_matched": True,   # 按拼音匹配到的真实库数据
                        })
                        if len(results) >= limit:
                            break
            except Exception as exc:  # noqa: BLE001 - 拼音路异常不阻断
                logger.debug("search_herbs 拼音补充匹配失败（忽略）: %s", exc)

            return results
    except Exception as exc:  # noqa: BLE001 - 骨架阶段：DB 不可用即降级
        logger.info("search_herbs 走真实库失败，降级示例数据: %s", exc)
        return None


async def _try_real_get_ingredient(ingredient_id: int | None, name: str | None) -> dict | None:
    """按 id 或中文名取单个 FoodMaterial 真实行；异常返回 None 触发降级。

    字段映射（真实模型）：name_cn / category / toxicity_class / effects(数组) /
    food_homology / safe_dose_min-max / contraindications / indications / description。
    模型**无** pinyin / property(四气) / flavor(五味) / meridian(归经)，一律返回 None。
    """
    try:
        from sqlalchemy import select

        from app.mcp_server.db import db_session
        from app.models.food_material import FoodMaterial

        if ingredient_id is None and not name:
            return {"error": "必须提供 ingredient_id 或 name", "_source": "validation"}

        async with db_session() as db:
            stmt = select(FoodMaterial)
            if ingredient_id is not None:
                stmt = stmt.where(FoodMaterial.id == ingredient_id)
            else:
                stmt = stmt.where(FoodMaterial.name_cn == name)
            row = (await db.execute(stmt)).scalars().first()
            if not row:
                return {"error": f"未找到食材: {ingredient_id or name}", "_source": "db"}
            return {
                "id": row.id,
                "name": row.name_cn,
                "pinyin": None,                                  # 模型无此字段
                "property": None,                                # 四气：模型无此字段
                "flavor": None,                                  # 五味：模型无此字段
                "category": getattr(row, "category", None),
                "meridian": None,                                # 归经：模型无此字段
                "toxicity": getattr(row, "toxicity_class", None),
                "functions": getattr(row, "effects", None),       # 功效标签数组
                "food_homology": getattr(row, "food_homology", None),
                "safe_dose_g_per_day": (
                    (getattr(row, "safe_dose_min", None), getattr(row, "safe_dose_max", None))
                ),
                "contraindications": getattr(row, "contraindications", None),
                "indications": getattr(row, "indications", None),
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001
        logger.info("get_ingredient 走真实库失败，降级示例数据: %s", exc)
        return None


# ── 工具执行入口 ─────────────────────────────────────────────────────

# ── 输出格式化（跳过真实库中不存在的字段，避免渲染出 None）──────────


def _fmt_herb_row(r: dict) -> str:
    """单行药材摘要；仅渲染非空字段（db 路径无拼音/四气/五味，自动省略）。"""
    parts = [f"[{r.get('id')}] {r.get('name')}"]
    if r.get("pinyin"):
        parts.append(f"拼音:{r['pinyin']}")
    if r.get("property"):
        parts.append(f"性:{r['property']}")
    if r.get("flavor"):
        parts.append(f"味:{r['flavor']}")
    if r.get("category"):
        parts.append(f"类:{r['category']}")
    if r.get("toxicity"):
        parts.append(f"毒性:{r['toxicity']}")
    if r.get("food_homology") is not None:
        parts.append("药食同源" if r["food_homology"] else "非药食同源")
    return "- " + " ".join(parts)


def _fmt_ingredient_block(rec: dict) -> str:
    """药材详情块；仅渲染非空字段，并显式标注 _source。"""
    head = f"{rec.get('name')}"
    if rec.get("pinyin"):
        head += f"（{rec['pinyin']}）"
    lines = [head]
    tcm = [x for x in (
        f"四气:{rec['property']}" if rec.get("property") else None,
        f"五味:{rec['flavor']}" if rec.get("flavor") else None,
        f"归经:{rec['meridian']}" if rec.get("meridian") else None,
    ) if x]
    if tcm:
        lines.append(" | ".join(tcm))
    meta = [x for x in (
        f"分类:{rec['category']}" if rec.get("category") else None,
        f"毒性:{rec['toxicity']}" if rec.get("toxicity") else None,
        "药食同源" if rec.get("food_homology") else None,
    ) if x]
    if meta:
        lines.append(" | ".join(meta))
    fn = rec.get("functions")
    if fn:
        # effects 为数组（真实库）；sample 兜底为字符串，均兼容
        lines.append("功效: " + ("、".join(fn) if isinstance(fn, (list, tuple)) else str(fn)))
    if rec.get("indications"):
        lines.append(f"适应症: {rec['indications']}")
    dose = rec.get("safe_dose_g_per_day")
    if isinstance(dose, (tuple, list)) and any(d is not None for d in dose):
        lines.append(f"安全剂量(g/天): {dose[0]}~{dose[1]}")
    contra = rec.get("contraindications")
    if contra:
        lines.append("禁忌: " + ("、".join(contra) if isinstance(contra, (list, tuple)) else str(contra)))
    lines.append(f"(source={rec.get('_source')})")
    return "\n".join(lines)


async def call_tool(name: str, args: dict, tenant_id: int | None = None) -> dict:
    """执行只读工具，返回 MCP content 结构。

    tenant_id 来自启动参数（多租户隔离）。MVP 单租户：真实库路径暂不按
    tenant 过滤（FoodMaterial 为全局字典表）；未来接组织级数据时必须在此
    追加 ``where(model.tenant_id == tenant_id)``，见设计文档"多租户隔离"。
    """
    if name not in _TOOL_NAMES:
        raise KeyError(name)

    if name == "search_herbs":
        query = str(args.get("query", "")).strip()
        if not query:
            return {
                "content": [{"type": "text", "text": "参数 query 不能为空"}],
                "isError": True,
            }
        limit = max(1, min(int(args.get("limit", 20) or 20), 50))

        try:
            real = await asyncio.wait_for(
                _try_real_search_herbs(query, limit), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            payload: list[dict] = real
        else:
            q = query.lower()
            payload = [
                _sample_to_public(r, detail=False)
                for r in _SAMPLE_HERBS
                if q in r["name"].lower() or q in r["pinyin"].lower()
            ][:limit]
            for item in payload:
                item["_source"] = "sample"

        header = f"搜索'{query}'命中 {len(payload)} 条（source={payload[0]['_source'] if payload else 'none'}）:"
        body = "\n".join(_fmt_herb_row(r) for r in payload) or "  （无匹配）"
        return {"content": [{"type": "text", "text": header + "\n" + body}]}

    if name == "get_ingredient":
        ingredient_id = args.get("ingredient_id")
        name_arg = args.get("name")
        if ingredient_id is None and not name_arg:
            return {
                "content": [{"type": "text", "text": "必须提供 ingredient_id 或 name"}],
                "isError": True,
            }

        try:
            real = await asyncio.wait_for(
                _try_real_get_ingredient(
                    int(ingredient_id) if ingredient_id is not None else None,
                    str(name_arg) if name_arg else None,
                ),
                timeout=DB_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            real = None
        if real is not None:
            record = real
        else:
            record = None
            for r in _SAMPLE_HERBS:
                if (ingredient_id is not None and r["id"] == int(ingredient_id)) or (
                    name_arg and r["name"] == name_arg
                ):
                    record = _sample_to_public(r, detail=True)
                    record["_source"] = "sample"
                    break
            if record is None:
                record = {"error": f"未找到食材: {ingredient_id or name_arg}", "_source": "sample"}

        if "error" in record:
            return {"content": [{"type": "text", "text": record["error"]}], "isError": True}

        return {"content": [{"type": "text", "text": _fmt_ingredient_block(record)}]}

    # P1 / 药理 / 安全 / 稳定性 扩展工具转发：MVP 两工具未命中时交给对应模块
    if name not in ("search_herbs", "get_ingredient"):
        from app.mcp_server.tools_pharmaco import (
            TOOL_DEFINITIONS_PHARMACO as _PK_DEFS,
        )
        from app.mcp_server.tools_safety import (
            TOOL_DEFINITIONS_SAFETY as _SF_DEFS,
        )
        from app.mcp_server.tools_stability import (
            TOOL_DEFINITIONS_STABILITY as _ST_DEFS,
        )

        _pk_names = {t["name"] for t in _PK_DEFS}
        _sf_names = {t["name"] for t in _SF_DEFS}
        _st_names = {t["name"] for t in _ST_DEFS}

        if name in _pk_names:
            from app.mcp_server.tools_pharmaco import call_tool_pharmaco

            return await call_tool_pharmaco(name, args, tenant_id)
        if name in _sf_names:
            from app.mcp_server.tools_safety import call_tool_safety

            return await call_tool_safety(name, args, tenant_id)
        if name in _st_names:
            from app.mcp_server.tools_stability import call_tool_stability

            return await call_tool_stability(name, args, tenant_id)

        # 其余（配方 + 知识图谱）交给 tools_p1
        from app.mcp_server.tools_p1 import call_tool_p1

        return await call_tool_p1(name, args, tenant_id)

    # 理论上不可达（前面已 KeyError）
    raise KeyError(name)
