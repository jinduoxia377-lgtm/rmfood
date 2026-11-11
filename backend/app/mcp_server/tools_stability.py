"""RMFOODFP MCP 服务器 —— 药材稳定性参考参数只读工具。

- ``get_herb_stability`` 单个药材的稳定性参考参数：月降解速率(degradation_rate)、
  货架期(shelf_life_months)、logP(max/avg)、TPSA(avg)、分析化合物数(compounds_analyzed)。

数据来源与**降级策略（照 tools_pharmaco.py，宁缺毋滥）**：
1. 优先走真实 DB：``app.models.herb_pharmaco_params.StabilityData``（stability_data，
   全库 612 行，是药理类数据里覆盖最广的），经 db.py 的 ``db_session`` 查询。
2. **不做 sample 兜底、绝不编造数值**。degradation_rate / shelf_life_months 若伪造会
   直接误导下游（易被误当货架期承诺），故：
   - DB 查无该药材 → 诚实"暂无该药材稳定性数据"，不填推测数值。
   - DB 不可用/超时 → 诚实"查询暂不可用"，不填推测数值。

**安全边界（务必区分，本模块核心）**：
- 本工具是**单个药材的稳定性参考参数展示**（带 source/confidence 溯源），
  **不是**配方稳定性"预测"。HTTP 注册表里另有一个 ``get_stability_prediction``
  是 Arrhenius 公式做**配方货架期预测**，属诊断/预测类，已按平台合规边界排除、
  不在本 stdio 服务器暴露。本工具只读展示单药材已推导好的参考值，不做任何预测计算。
- degradation_rate / shelf_life_months **多为 model_derived 推导值**
  （真实行 source=model_derived，derived_from=model_derived(TCMSP_alogP+Arrhenius)，
  confidence≈0.55），**非实测**。本工具**原样呈现 source/confidence/derived_from**，
  并明确"非实测、勿当货架期承诺"。

多租户：StabilityData 为全局药材字典（无租户字段），不做租户过滤，注释说明。
只读约束：本模块所有函数只做 SELECT，无任何 INSERT/UPDATE/DELETE。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("rmfood.mcp_server.tools_stability")

# 与 tools.py / tools_pharmaco.py 一致的真实库查询超时（秒）
DB_TIMEOUT_S = 3.0

# ── 稳定性工具 JSON Schema ───────────────────────────────────────────

TOOL_DEFINITIONS_STABILITY: list[dict[str, Any]] = [
    {
        "name": "get_herb_stability",
        "title": "药材稳定性参考参数",
        "description": (
            "查询单个 TCM 药材的稳定性参考参数：月降解速率(degradation_rate)、"
            "货架期(shelf_life_months)、logP(最大/平均)、TPSA(平均)、分析化合物数。"
            "每项附数据溯源(source)与置信度(confidence)。"
            "【重要区分】本工具是*药材稳定性参考参数*（带来源标注的已推导参考值），"
            "*不是*配方稳定性/货架期*预测*（预测类属诊断边界，已排除）。"
            "degradation_rate/shelf_life 多为 model_derived 推导值"
            "（TCMSP alogP + Arrhenius 加速模型），**非实测、勿当货架期承诺**。"
            "输入 herb_name_cn（如 茯苓）或 herb_id。只读参考数据，非诊疗依据。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "herb_name_cn": {"type": "string", "description": "药材中文名，如 茯苓 / 黄芪（与 herb_id 二选一）"},
                "herb_id": {"type": "integer", "description": "药材 ID（与 herb_name_cn 二选一，优先）"},
            },
            "required": [],
        },
    },
]

_TOOL_NAMES_STABILITY = {t["name"] for t in TOOL_DEFINITIONS_STABILITY}

# 覆盖与安全边界提示（诚实：不硬编码精确条数，避免数据演进后过时）
_COVERAGE_NOTE = "⚠ 覆盖说明：stability_data 覆盖较广（数百条药材稳定性记录）但仍非全部药材；未收录的药材会返回“暂无数据”。"
_DISCLAIMER = (
    "参考数据，非诊疗依据。degradation_rate/shelf_life_months 为 model_derived 推导值"
    "（TCMSP alogP + Arrhenius），非实测；本工具是单药材稳定性参考参数展示，"
    "不是配方货架期预测，勿作为货架期承诺或诊疗依据。"
)


# ── 真实数据访问（查无 / 异常均不编造）──────────────────────────────

async def _try_real_get_herb_stability(
    herb_name_cn: str | None, herb_id: int | None,
) -> dict | None:
    """查 StabilityData（stability_data）。返回：
    - None                ：DB 异常（触发上层"查询暂不可用"诚实提示）
    - {"error": ...}      ：DB 正常但查无该药材（触发"暂无数据"诚实提示，不编造）
    - {完整记录, _source} ：查到真实行
    全局表，无租户字段，不做租户过滤。herb_id 优先于 herb_name_cn。
    """
    try:
        from sqlalchemy import select

        from app.mcp_server.db import db_session
        from app.models.herb_pharmaco_params import StabilityData

        async with db_session() as db:
            stmt = select(StabilityData)
            if herb_id is not None:
                stmt = stmt.where(StabilityData.herb_id == herb_id)
            elif herb_name_cn:
                stmt = stmt.where(StabilityData.herb_name_cn == herb_name_cn)
            else:
                return {"error": "必须提供 herb_name_cn 或 herb_id", "_source": "validation"}

            row = (await db.execute(stmt)).scalars().first()
            if not row:
                return {"error": f"暂无该药材的稳定性数据: {herb_name_cn or herb_id}", "_source": "db"}

            return {
                "herb_id": row.herb_id,
                "herb_name_cn": row.herb_name_cn,
                "degradation_rate": row.degradation_rate,
                "shelf_life_months": row.shelf_life_months,
                "logp_max": row.logp_max,
                "logp_avg": row.logp_avg,
                "tpsa_avg": row.tpsa_avg,
                "compounds_analyzed": row.compounds_analyzed,
                "source": getattr(row, "source", None),
                "confidence": row.confidence,
                "derived_from": getattr(row, "derived_from", None),
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001 - DB 不可用→诚实"暂不可用"，不编造
        logger.info("get_herb_stability 走真实库失败: %s", exc)
        return None


# ── 渲染（显式标注 source / confidence，区分参考非预测）──────────────

def _num(v: Any, unit: str = "") -> str:
    return f"{v}{unit}" if v is not None else "无数据"


def _fmt_stability(r: dict) -> str:
    lines = [
        f"{r['herb_name_cn']}（herb_id={r['herb_id']}）稳定性参考参数",
        f"  月降解速率(degradation_rate) : {_num(r.get('degradation_rate'))}",
        f"  货架期(shelf_life_months)    : {_num(r.get('shelf_life_months'), ' 月')}",
        f"  logP 最大 / 平均             : {_num(r.get('logp_max'))} / {_num(r.get('logp_avg'))}",
        f"  TPSA 平均(tpsa_avg)          : {_num(r.get('tpsa_avg'))}",
        f"  分析化合物数(compounds_analyzed): {_num(r.get('compounds_analyzed'))}",
        f"各参数来源(source): {r.get('source') or '未标注'}",
        f"置信度(confidence): {r.get('confidence')} （1.0=实测 / 0=推测）",
    ]
    if r.get("derived_from"):
        lines.append(f"推导依据(derived_from): {str(r['derived_from'])[:180]}")
    lines.append(f"说明: {_DISCLAIMER}")
    lines.append(_COVERAGE_NOTE)
    lines.append(f"(source={r.get('_source')})")
    return "\n".join(lines)


# ── 稳定性工具执行入口 ───────────────────────────────────────────────

async def call_tool_stability(name: str, args: dict, tenant_id: int | None = None) -> dict:
    """执行稳定性只读工具，返回 MCP content 结构。

    与 tools.call_tool / tools_pharmaco.call_tool_pharmaco 同签名；由接线方
    （tools/server）转发未命中的 name 进来。tenant_id 对 StabilityData 全局表
    无意义（无租户字段），忽略。

    降级策略（宁缺毋滥，照 tools_pharmaco）：
    - 真实行 → 渲染 + source/confidence
    - 查无该药材（{"error":...}）→ 诚实"暂无数据"，**不填推测数值**
    - DB 异常/超时（None）→ 诚实"查询暂不可用"，**不填推测数值**
    """
    herb_name_cn = str(args.get("herb_name_cn") or "").strip() or None
    raw_id = args.get("herb_id")
    herb_id: int | None
    try:
        herb_id = int(raw_id) if raw_id is not None else None
    except (TypeError, ValueError):
        herb_id = None

    if name not in _TOOL_NAMES_STABILITY:
        raise KeyError(name)
    if herb_id is None and not herb_name_cn:
        return {"content": [{"type": "text", "text": "必须提供 herb_name_cn 或 herb_id"}], "isError": True}

    if name == "get_herb_stability":
        try:
            real = await asyncio.wait_for(
                _try_real_get_herb_stability(herb_name_cn, herb_id), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is None:
            text = "稳定性数据查询暂不可用（数据库连接失败/超时）。为避免误导，不返回任何推测数值。\n参考数据，非诊疗依据。"
            return {"content": [{"type": "text", "text": text}], "isError": True}
        if "error" in real:
            text = f"{real['error']}\n{_COVERAGE_NOTE}\n为避免误导，未返回任何替代/推测数值。\n参考数据，非诊疗依据。"
            return {"content": [{"type": "text", "text": text}]}
        return {"content": [{"type": "text", "text": _fmt_stability(real)}]}

    # 理论不可达（前面已 KeyError）
    raise KeyError(name)
